/*
 * Author: lihan@migu.cn
 * History: create at 20210811
 */

//const { PAGE_PARENT_IDX_LEN, PAGE_PREV_IDX_LEN, PAGE_NEXT_IDX_LEN } = require("./const.js");
const { OFFSET_START, KEY_MAX_LEN, PAGE_SIZE, ORDER_NUM, CELL_LEN, CELL_START } = require("./const.js");
const fileops = require("./fileops.js");


var rootPage = undefined // 根页面 
const pageMap = {} // 页链表

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
    key.copy(key, 0, 0, KEY_MAX_LEN)
    var index = buf.readInt32LE(KEY_MAX_LEN)
    return {
        key: key,
        index: index,
    }
}

function newPage(type) {
    var cellNumber = ORDER_NUM
    var cells = []
    for (var index = 0; index < cellNumber; index++) {
        var cell = newCell()
        cells.push(cell)
    }

    return {
        type: type,        // 页类型：2 ~ 根, 1 ~ 中间节点, 0 ~ 叶子节点
        parent: 0,         // 父节点
        next: 0,           // 兄节点
        prev: 0,           // 弟节点 
        used: 0,
        cells: cells,
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
    var cellNumber = ORDER_NUM

    // buf.copy(targetBuffer[, targetStart[, sourceStart[, sourceEnd]]])
    var cells = page.cells
    for (var ci = 0; ci < cellNumber; ci++) {
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
    var cellNumber = ORDER_NUM

    var cells = []
    for (var index = 0; index < cellNumber; index++) {
        var cellBuff = Buffer.alloc(CELL_LEN)
        buf.copy(cellBuff, 0, cellStart + index * cellLength, cellStart + (index + 1) * cellLength)
        var cell = parseCell(cellBuff)
        cells.push(cell)
    }

    console.log("page type = " + type)

    return {
        type: type,
        parent: parent,
        next: next,
        prev: prev,
        used: used,
        cells: cells
    }
}

async function init(filename) {
    let exist = await fileops.existFile(filename)
    if (!exist) { // 文件不存在则创建
        await fileops.createFile(filename)
    }

    let fd = await fileops.openFile(filename)
    console.log("fd = " + fd)
    let stat = await fileops.statFile(fd)
    console.log("file size = " + stat.size)

    if (stat.size < PAGE_SIZE) { // 空文件, 写入一页
        rootPage = newPage(2)    // 新生成一个根页面
        rootPage.index = 0       // 根页面下标
        pageMap[0] = rootPage
        let buff = pageToBuff(rootPage)
        let ret = await fileops.writeFile(fd, buff, 0, PAGE_SIZE)
        console.log("file write ret = " + ret)
        await fileops.syncFile(fd)
        return fd
    }

    let buff = Buffer.alloc(PAGE_SIZE)
    let bytes = await fileops.readFile(fd, buff, OFFSET_START, PAGE_SIZE, 0) // 文件第一页，始终放置root页
    console.log("read bytes:" + bytes)
    rootPage = buffToPage(buff)
    rootPage.index = 0       // 根页面下标
    pageMap[0] = rootPage
    for (var index = PAGE_SIZE; index < stat.size; index += PAGE_SIZE) {
        let bytes = await fileops.readFile(fd, buff, OFFSET_START, PAGE_SIZE, index) // 非root页
        console.log("read bytes:" + bytes)
        let pageNode = buffToPage(buff)
        let pageIndex = Math.floor(index / PAGE_SIZE)
        pageNode.index = pageIndex
        pageMap[pageIndex] = pageNode
    }

    return fd
}


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
            let page = newPage(0) // 生成叶子节点
            page.parent = currPage.index // 父页节点下标
            let pageNum = Object.getOwnPropertyNames(pageMap).length
            pageMap[pageNum] = page // 插入到缓存表
            page.dirty = true
            cells[cellIndex].index = pageNum
            currPage.dirty = true
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

async function insert(key, value) {
    let targetPage = locatePage(key, rootPage) // 目标叶子节点
    if (targetPage.used < ORDER_NUM) { // 节点内还剩余cell
        targetPage.dirty = true
        targetPage.cells[ORDER_NUM - 1 - targetPage.used] = newCell(key, value)
        targetPage.used++
    }

    console.log(targetPage)
}

async function flush(fd) {
    let pageNum = Object.getOwnPropertyNames(pageMap).length // 页数
    let stat = await fileops.statFile(fd)
    for (var index = 0; index < pageNum; index++) {
        var page = pageMap[index]
        if (page.dirty == true) {
            var buff = pageToBuff(page)
            fileops.writeFile(fd, buff, 0, PAGE_SIZE, index * PAGE_SIZE)
        }
    }
}

var bptree = {
    init: init,
    insert: insert,
    flush: flush,
}

module.exports = bptree;