/*
 * Author: lihan@migu.cn
 * History: create at 20210811
 */

// 
//  page node 存储分布
//  +---------------+
//  +     TYPE      +
//  +---------------+
//  +    PARENT     +
//  +---------------+
//  +     NEXT      +
//  +---------------+
//  +     PREV      +
//  +---------------+
//  +     USED      +
//  +---------------+
//


//const { PAGE_PARENT_IDX_LEN, PAGE_PREV_IDX_LEN, PAGE_NEXT_IDX_LEN } = require("./const.js");
const {
    OFFSET_START,
    KEY_MAX_LEN,
    PAGE_SIZE,
    ORDER_NUM,
    CELL_LEN,
    CELL_START,
    LESS_HALF_NUM,
    MORE_HALF_NUM
} = require("./const.js");

const fileops = require("./fileops.js");
var fs = require('fs');

var rootPage = undefined // 根页面 
const pageMap = {} // 页链表
const fidMap = {}


function newCell(keyBuf = undefined, value = 0) {
    if (keyBuf == undefined) {
        keyBuf = Buffer.alloc(KEY_MAX_LEN)
    }
    return {
        key: keyBuf,
        index: value,
    }
}

function parseCell(buf) {
    var key = Buffer.alloc(KEY_MAX_LEN)
    buf.copy(key, 0, 0, KEY_MAX_LEN)
    var index = buf.readInt32LE(KEY_MAX_LEN)
    return {
        key: key,
        index: index,
    }
}

function newPage(type) {
    var cells = []
    for (var index = 0; index < ORDER_NUM; index++) {
        var cell = newCell()
        cells.push(cell)
    }

    return {
        type: type,        // 页类型：2 ~ 根, 1 ~ 中间节点, 0 ~ 叶子节点
        parent: -1,         // 父节点
        next: -1,           // 兄节点
        prev: -1,           // 弟节点 
        used: 0,
        cells: cells,
    }
}

/*
 * Descripiton:
 *    当根点需要分裂时，重建根节点，根节点保持在index = 0的位置，新的根节点有只有两个cell
 * Parameters:
 *    @left: 左节点
 *    @right: 右节点
 */
function rebuildRootPage(page, left, right) {
    for (var index = 0; index < ORDER_NUM - 2; index++) {
        var cell = newCell()
        page.cells[index] = cell
    }
    page.cells[ORDER_NUM - 2] = newCell(left.cells[ORDER_NUM - 1].key, left.index)
    page.cells[ORDER_NUM - 1] = newCell(right.cells[ORDER_NUM - 1].key, right.index)
    page.prev = -1
    page.used = 2 // 左右两个子节点

    // left节点以及right节点的子节点的parent设置成自身
    for (var idx = 0; idx < left.used; idx++) {
        var childIndex = left.cells[ORDER_NUM - 1 - idx].index
        pageMap[childIndex].parent = left.index
    }

    for (var idx = 0; idx < right.used; idx++) {
        var childIndex = right.cells[ORDER_NUM - 1 - idx].index
        pageMap[childIndex].parent = right.index
    }

}

function copyPage(target, source) {
    target.type = source.type
    target.parent = source.parent
    target.next = source.next
    target.prev = source.prev
    target.used = source.used

    for (var index = 0; index < ORDER_NUM; index++) {
        target.cells[index] = source.cells[index]
    }
}

function pageToBuff(page) {
    let buff = Buffer.alloc(PAGE_SIZE)
    buff.writeInt32LE(page.type, 0)
    buff.writeInt32LE(page.parent, 4)
    buff.writeInt32LE(page.next, 8)
    buff.writeInt32LE(page.prev, 12)
    buff.writeInt32LE(page.used, 16)
    var cellStart = CELL_START
    var cellLength = CELL_LEN

    // buf.copy(targetBuffer[, targetStart[, sourceStart[, sourceEnd]]])
    var cells = page.cells
    for (var ci = 0; ci < ORDER_NUM; ci++) {
        cells[ci].key.copy(buff, cellStart + ci * cellLength, 0, KEY_MAX_LEN) // 键值
        buff.writeInt32LE(cells[ci].index, cellStart + ci * cellLength + KEY_MAX_LEN) // 子节点索引值
    }

    return buff
}

function buffToPage(buf) {
    var type = buf.readInt32LE(0)
    var parent = buf.readInt32LE(4)
    var next = buf.readInt32LE(8)
    var prev = buf.readInt32LE(12)
    var used = buf.readInt32LE(16) // 已经使用的cell
    var cellStart = CELL_START
    var cellLength = CELL_LEN

    var cells = []
    for (var index = 0; index < ORDER_NUM; index++) {
        var cellBuff = Buffer.alloc(CELL_LEN)
        buf.copy(cellBuff, 0, cellStart + index * cellLength, cellStart + (index + 1) * cellLength)
        var cell = parseCell(cellBuff)
        cells.push(cell)
    }

    //console.log("page type = " + type)

    return {
        type: type,
        parent: parent,
        next: next,
        prev: prev,
        used: used,
        cells: cells
    }
}

async function init(dbname) {
    let exist = await fileops.existFile(dbname)
    if (!exist) { // 文件不存在则创建
        await fileops.createFile(dbname)
    }

    let fd = await fileops.openFile(dbname)
    //console.log("fd = " + fd)
    fidMap[dbname] = fd
    let stat = await fileops.statFile(fd)
    //console.log("file size = " + stat.size)

    if (stat.size < PAGE_SIZE) { // 空文件, 写入一页
        rootPage = newPage(2)    // 新生成一个根页面
        rootPage.index = 0       // index只存在内存中，未持久化，在初始化时添加
        pageMap[0] = rootPage
        let buff = pageToBuff(rootPage)
        let ret = await fileops.writeFile(fd, buff, 0, PAGE_SIZE)
        console.log("file write ret = " + ret)
        await fileops.syncFile(fd)
        return fd
    }

    let buff = Buffer.alloc(PAGE_SIZE)
    let bytes = await fileops.readFile(fd, buff, OFFSET_START, PAGE_SIZE, 0) // 文件第一页，始终放置root页
    //console.log("read bytes:" + bytes)
    rootPage = buffToPage(buff)
    rootPage.index = 0
    pageMap[0] = rootPage
    for (var index = PAGE_SIZE; index < stat.size; index += PAGE_SIZE) {
        let bytes = await fileops.readFile(fd, buff, OFFSET_START, PAGE_SIZE, index) // 非root页
        //console.log("read bytes:" + bytes)
        let pageNode = buffToPage(buff)
        let pageIndex = Math.floor(index / PAGE_SIZE)
        pageNode.index = pageIndex
        pageMap[pageIndex] = pageNode
    }

    return fd
}

async function close(dbname) {
    await fileops.closeFile(fidMap[dbname])
}

/*
 * 定位叶子页节点
 */
function locatePage(key, currPage) {
    let cells = currPage.cells
    let maxIndex = cells.length - 1

    if (currPage.type == 0) {
        return currPage
    }

    let found = true, pageIndex = -1, cellIndex = -1
    if (key.compare(cells[maxIndex].key) > 0) { // 大于最大键值 
        found = false
        pageIndex = cells[maxIndex].index
        cellIndex = maxIndex
    }
    if (key.compare(cells[0].key) < 0) { //  小于最小键值
        found = false
        pageIndex = cells[0].index
        cellIndex = 0
    }
    if (!found) {
        if (pageIndex == 0) { // 说明还没有分配叶子值
            let pageNum = Object.getOwnPropertyNames(pageMap).length
            let page = newPage(0) // 生成叶子节点
            pageMap[pageNum] = page // 插入到缓存表
            page.parent = currPage.index // 父页节点下标
            page.index = pageNum
            page.dirty = true
            // TODO 填充key值
            cells[cellIndex].index = pageNum
            currPage.dirty = true
            currPage.used++
            return page
        } else {
            return locatePage(key, pageMap[pageIndex]) // 子页面节点查找
        }
    }

    for (var index = maxIndex; index >= 1; index--) { // TODO: 折半查找法
        if (key.compare(cells[index].key) <= 0 && key.compare(cells[index - 1].key) > 0) { // 查找到
            let page = pageMap[cells[index].index]
            return locatePage(key, page)
        }
    }
}

/*
 * 查找cells的插入位置
 */
function findInsertPos(key, page) {
    for (var i = ORDER_NUM - 1; i >= 0; i--) {
        if (key.compare(page.cells[i].key) >= 0) { // 找到位置
            let pos = i + 1
            return pos
        }
    }
    return 0 // 找不到比自己小的，存为第一个
}

function maxIndex() {
    let pageNum = Object.getOwnPropertyNames(pageMap).length // 页数
    return pageNum
}

function innerInsert(targetPage, key, value) {
    // 插入
    targetPage.dirty = true
    let pos = findInsertPos(key, targetPage)
    targetPage.cells.splice(pos, 0, newCell(key, value)) //  插入：splice(pos, <delete num> , value)
    targetPage.used++
    if (targetPage.used <= ORDER_NUM) {
        targetPage.cells.shift() // remove left 
    }

    if (targetPage.used == ORDER_NUM + 1) { // 若插入后, 节点包含关键字数大于阶数, 则分裂
        let brotherPage = newPage()    // 左边的兄弟页
        let pageIndex = maxIndex()
        pageMap[pageIndex] = brotherPage
        brotherPage.index = pageIndex // 设置页下标
        brotherPage.dirty = true    // 新页应该写入磁盘
        brotherPage.type = targetPage.type
        brotherPage.parent = targetPage.parent

        let prevIndex = targetPage.prev
        if (prevIndex != -1) {
            pageMap[prevIndex].next = pageIndex
            pageMap[prevIndex].dirty = true
        }
        brotherPage.prev = prevIndex
        brotherPage.next = targetPage.index
        targetPage.prev = brotherPage.index
        targetPage.dirty = true

        // 1. 把原来的页的cells的前半部分挪入新页的cells, 清除原来页的cells的前半部分
        brotherPage.used = MORE_HALF_NUM
        for (var i = MORE_HALF_NUM - 1; i >= 0; i--) {
            brotherPage.cells[(ORDER_NUM - 1) - (MORE_HALF_NUM - 1 - i)] = targetPage.cells[i]
            if (brotherPage.type > 0) {
                let childIndex = targetPage.cells[i].index
                pageMap[childIndex].parent = brotherPage.index // 更新子节点的父节点索引
            }
            targetPage.cells[i] = newCell()
        }
        
        targetPage.used = ORDER_NUM + 1 - MORE_HALF_NUM
        targetPage.cells.shift() // 补充，把左侧多余的一个删除

        if (targetPage.type == 2) { // 如果分裂了root节点
            let movePage = newPage(1) // 把rootPage拷贝到movePage里面
            let moveIndex = maxIndex()
            pageMap[moveIndex] = movePage
            copyPage(movePage, targetPage)
            movePage.type = 1 // 降为茎节点
            movePage.index = moveIndex
            movePage.parent = 0 // 父节点为根节点
            movePage.prev = brotherPage.index
            movePage.dirty = true
            brotherPage.type = 1 // 茎节点
            brotherPage.parent = 0
            brotherPage.next = moveIndex
            for (var i = 0; i < movePage.used; i++) {  // move 之后，其子节点的parent需要修改
                let childIndex = movePage.cells[ORDER_NUM - 1 - i].index
                pageMap[childIndex].parent = moveIndex
            }

            brotherPage.dirty = true
            rebuildRootPage(targetPage, brotherPage, movePage) // 设置根节点的cell
            return
        }

        // 2. 新页的键值和页号(index)插入到父节点
        innerInsert(pageMap[brotherPage.parent], brotherPage.cells[ORDER_NUM - 1].key, brotherPage.index)

    }
}

function needUpdateMax(key) {
    if (key.compare(rootPage.cells[ORDER_NUM - 1].key) > 0) { // 大于最大键值 
        return true
    }
    return false
}

function updateMax(page, key) {
    page.dirty = true
    key.copy(page.cells[ORDER_NUM - 1].key, 0, 0, KEY_MAX_LEN)    // TODO ORDER_NUM -> KEY_MAX_LEN
    let childIndex = page.cells[ORDER_NUM - 1].index
    console.log("childIndex = " + childIndex)
    if (childIndex > 0 && pageMap[childIndex].type > 0) {
        updateMax(pageMap[childIndex], key)
    }
}

function insert(key, value) {
    let targetPage = locatePage(key, rootPage) // 目标叶子节点
    innerInsert(targetPage, key, value)
    if (needUpdateMax(key)) {
        updateMax(rootPage, key)
    }
}

function select(key) {
    let targetPage = locatePage(key, rootPage) // 目标叶子节点
    for (var i = ORDER_NUM - 1 ; i >= 0; i--) {
        if (key.compare(targetPage.cells[i].key) == 0) { // 找到位置
            return targetPage.cells[i].index
        }
    }
    return undefined
}

async function flush(fd) {
    let pageNum = Object.getOwnPropertyNames(pageMap).length // 页数
    for (var index = 0; index < pageNum; index++) {
        var page = pageMap[index]
        if (page.dirty == true) {
            var buff = pageToBuff(page)
            fileops.writeFile(fd, buff, 0, PAGE_SIZE, index * PAGE_SIZE)
        }
    }
    fileops.syncFile(fd)
}

var bptree = {
    init: init,
    close: close,
    insert: insert,
    flush: flush,
    select: select,
    rootPage: rootPage,
    pageMap: pageMap,
}

module.exports = bptree;