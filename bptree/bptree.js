/*
 * Author: lihan@xx.cn
 * History: create at 20210811
 */

// 
//  page node 存储分布
//  +---------------+
//  +     TYPE      +            // 叶结点类型字段：4字节
//  +---------------+
//  +    PARENT     +            // 父节点索引字段：4字节
//  +---------------+
//  +     NEXT      +            // 兄节点索引字段：4字节
//  +---------------+
//  +     PREV      +            // 弟节点索引字段：4字节  
//  +-------+-------+
//  + PCELL |  USED +            // 本节点在父节点的KV数组中的下标：2字节 | 本节点KV数组已使用的个数：2字节
//  +-------+-------+
//  |       | TYPE  |   
//  |  KEY  +-------+            // 一对KV值，K与V的长度可以配置，KV对的个数和K长度、V长度、以及页大小相关
//  |       |  VAL  |   
//  +-------+-------+
//  |    ........   |
//  +-------+-------+
//  |       | TYPE  |           // 值类型(1字节): (0 ~ 索引; 1 ~ number; 2 ~ string)
//  |  KEY  +-------+ 
//  |       |  VAL  |           // 具体值  
//  +-------+-------+
//

//const { PAGE_PARENT_IDX_LEN, PAGE_PREV_IDX_LEN, PAGE_NEXT_IDX_LEN } = require("./const.js");
const {
    START_OFFSET,
    KEY_MAX_LEN,
    VAL_TYPE_LEN,
    VAL_IDX_LEN,
    PAGE_SIZE,
    HEAD_LEN,
    NODE_TYPE_LEAF,
    NODE_TYPE_STEM,
    NODE_TYPE_ROOT,
    NODE_TYPE_FREE,
    LOC_FOR_INSERT,
    LOC_FOR_SELECT,
    LOC_FOR_DELETE,
    TRANS_MERGE,
    TRANS_BORROW,
    TRANS_SHRINK,
    VAL_TYPE_IDX,
    VAL_TYPE_NUM,
    VAL_TYPE_STR,
    VAL_TYPE_FPN,
    VAL_TYPE_OBJ,
    VAL_TYPE_UNK,
} = require("../common/const.js")

const winston = require('../winston/config')
const fileops = require("../common/fileops")
const tools = require('../common/tools')
const Buff = require('../common/buff')
const Pidx = require('../common/index')
const Page = require('./page.js')

Buffer.prototype.compare = function (to) {
    let left = this.readInt32LE(0)
    let right = to.readInt32LE(0)
    if (left == right) return 0
    if (left > right) return 1
    else return -1
}

class Bptree {

    constructor(
        buffSize = 1000,
        pageSize = PAGE_SIZE,
        keyMaxLen = KEY_MAX_LEN,
        valMaxLen = VAL_IDX_LEN
    ) {
        this.fileId = undefined
        this.rootPage = undefined // 根页面 
        this.freeNext = 0
        this.freePrev = 0
        this.buffSize = buffSize

        this.PAGE_SIZE = pageSize
        this.KEY_MAX_LEN = keyMaxLen
        this.VAL_IDX_LEN = valMaxLen
        this.CELL_LEN = this.KEY_MAX_LEN + VAL_TYPE_LEN + this.VAL_IDX_LEN
        this.ORDER_NUM = Math.floor((this.PAGE_SIZE - HEAD_LEN) / this.CELL_LEN)   // b+树的阶
        this.LESS_HALF_NUM = Math.floor(this.ORDER_NUM / 2)  // 少的一半
        this.MORE_HALF_NUM = Math.ceil(this.ORDER_NUM / 2)   // 多的一半
        this._pidx = new Pidx()

        this._page = new Page()
        this._page.attach(this)

        this._buff = new Buff(this.buffSize, this._pidx)
        this._buff.attach(this)
    }

    getBuffer() {
        return this._buff
    }

    async appendFreeNode(id) {
        let free = await this._buff.getPageNode(id)
        let firstFreeIndex = this.rootPage.next
        let firstFreePage = await this._buff.getPageNode(firstFreeIndex) // TODO 如果找不到, 需要重新加载
        this.rootPage.next = id
        free.next = firstFreeIndex
        free.prev = firstFreePage.prev
        firstFreePage.prev = id
        free.type = NODE_TYPE_FREE
        free.dirty = true
    }

    async fetchPageNode(type) {
        if (this.rootPage == undefined || this.rootPage.next == this.rootPage.prev) {
            let index = this.newPageIndex()
            let node = this._page.newPage(type)
            node.index = index
            return node
        }

        let id = this.rootPage.next
        let node = await this._buff.getPageNode(id)
        let nextId = node.next
        this.rootPage.next = nextId
        let nextNode = await this._buff.getPageNode(nextId)
        nextNode.prev = node.prev
        nextNode.dirty = true
        node.type = type
        return node
    }

    async drop(dbname) {
        try {
            let ret = await fileops.unlinkFile(dbname)
        } catch (e) {
            winston.info(e)
        }
    }

    async init(dbname) {
        let exist = await fileops.existFile(dbname)
        if (!exist) { // 文件不存在则创建
            await fileops.createFile(dbname)
        }

        this.fileId = await fileops.openFile(dbname)
        this._buff.setFileId(this.fileId)
        let stat = await fileops.statFile(this.fileId)
        winston.info("file size = " + stat.size)
        this._pidx.set(Math.floor(stat.size / this.PAGE_SIZE)) // 数据库文件所占的总页数

        if (stat.size < this.PAGE_SIZE) { // 空文件
            this.rootPage = await this.fetchPageNode(NODE_TYPE_ROOT)    // 新生成一个根页面
            this.rootPage.index = 0       // index只存在内存中，未持久化，在初始化时添加
            this.rootPage.next = 0        // rootPage的prev和next指向自己，用于空闲链表
            this.rootPage.prev = 0
            await this._buff.setPageNode(0, this.rootPage)
            return this.fileId
        }

        let buff = Buffer.alloc(this.PAGE_SIZE)
        let bytes = await fileops.readFile(this.fileId, buff, START_OFFSET, this.PAGE_SIZE, 0) // 文件第一页，始终放置root页
        this.rootPage = await this._page.buffToPage(buff)
        this.rootPage.index = 0
        await this._buff.setPageNode(0, this.rootPage)

        let minSize = this.buffSize * this.PAGE_SIZE > stat.size ? stat.size : this.buffSize * this.PAGE_SIZE
        for (var index = this.PAGE_SIZE; index < minSize; index += this.PAGE_SIZE) {
            await fileops.readFile(this.fileId, buff, START_OFFSET, this.PAGE_SIZE, index) // 非root页
            let pageNode = this._page.buffToPage(buff)
            let pageIndex = Math.floor(index / this.PAGE_SIZE)
            pageNode.index = pageIndex
            await this._buff.setPageNode(pageIndex, pageNode)
        }

        return this.fileId
    }

    /*
     * Descripiton:
     *    当根点需要分裂时，重建根节点，根节点保持在index = 0的位置，新的根节点有只有两个cell
     * Parameters:
     *    @left: 左节点
     *    @right: 右节点
     */
    async rebuildRoot(page, left, right) {
        for (var index = 0; index < this.ORDER_NUM - 2; index++) {
            var cell = this._page.newCell()
            page.cells[index] = cell
        }

        page.cells[this.ORDER_NUM - 2] = this._page.newCell(left.cells[this.ORDER_NUM - 1].key, left.index)
        page.cells[this.ORDER_NUM - 1] = this._page.newCell(right.cells[this.ORDER_NUM - 1].key, right.index)
        page.prev = -1
        page.used = 2 // 左右两个子节点

        // left节点以及right节点的子节点的parent设置成自身
        for (var idx = 0; idx < left.used; idx++) {
            var childIndex = left.cells[this.ORDER_NUM - 1 - idx].index
            let page = await this._buff.getPageNode(childIndex, true)
            page.parent = left.index
        }

        for (var idx = 0; idx < right.used; idx++) {
            var childIndex = right.cells[this.ORDER_NUM - 1 - idx].index
            let page = await this._buff.getPageNode(childIndex, true)
            page.parent = right.index
        }

        left.next = right.index
        right.prev = left.index
        left.prev = -1
        right.next = -1

        left.pcell = this.ORDER_NUM - 2
        right.pcell = this.ORDER_NUM - 1
        await this.setChildPcell(left)
        await this.setChildPcell(right)

        left.dirty = true
        right.dirty = true

        left.ocnt++
        right.ocnt++

        page.prev = this.freePrev
        page.next = this.freeNext
    }

    /*
     * 定位叶子页节点
     */
    async locateLeaf(key, currPage, locType = LOC_FOR_INSERT) {
        let cells = currPage.cells
        let maxIndex = cells.length - 1

        if (currPage.type == NODE_TYPE_LEAF) {
            return currPage
        }

        let found = true, pageIndex = -1, cellIndex = -1
        if (key.compare(cells[maxIndex].key) > 0) { // 大于最大键值 
            found = false
            pageIndex = cells[maxIndex].index
            cellIndex = maxIndex
        }
        let minIndx = currPage.used > 0 ? this.ORDER_NUM - currPage.used : this.ORDER_NUM - 1
        if (key.compare(cells[minIndx].key) <= 0) {
            pageIndex = cells[minIndx].index
            if (locType == LOC_FOR_INSERT) { //  小于最小键值
                cellIndex = minIndx
                found = false
            }
            if (locType != LOC_FOR_INSERT) { // 查找時候, 小於最小值, 視為已經查找到
                return await this.locateLeaf(key, await this._buff.getPageNode(pageIndex, false), locType)
            }
        }

        if (!found) {
            if (pageIndex == 0) { // 说明还没有分配叶子值
                let page = await this.fetchPageNode(NODE_TYPE_LEAF) // 生成叶子节点
                let pageNum = page.index
                await this._buff.setPageNode(pageNum, page) // 插入到缓存表
                page.parent = currPage.index // 父页节点下标
                page.index = pageNum
                page.dirty = true
                page.ocnt++
                page.pcell = cellIndex
                cells[cellIndex].index = pageNum
                currPage.dirty = true
                currPage.used++
                currPage.ocnt++
                return page
            } else {
                return await this.locateLeaf(key, await this._buff.getPageNode(pageIndex, false), locType) // 子页面节点查找
            }
        }

        for (var index = maxIndex; index >= 1; index--) { // TODO: 折半查找法
            if (key.compare(cells[index].key) <= 0 && key.compare(cells[index - 1].key) > 0) { // 查找到
                let page = await this._buff.getPageNode(cells[index].index, false)
                return await this.locateLeaf(key, page, locType)
            }
        }
    }

    /*
     * 查找cells的插入位置
     * 如果page的类型为NODE_TYPE_LEAF, 则pos随便插入, 否则需要比较值页内值
     */
    findInsertPos(key, page) {
        for (var i = this.ORDER_NUM - 1; i >= 0; i--) {
            if (key.compare(page.cells[i].key) >= 0) { // 找到位置
                let pos = i + 1
                return pos
            }
        }
        return 0 // 找不到比自己小的，存为第一个
    }

    newPageIndex() {
        let pageNum = this._pidx.get()
        this._pidx.incr()
        return pageNum
    }

    async setChildPcell(parent) {
        for (var i = 0; i < parent.used; i++) {
            let cellIndex = this.ORDER_NUM - 1 - i
            let childIndex = parent.cells[cellIndex].index
            let childPage = await this._buff.getPageNode(childIndex, true)
            childPage.pcell = cellIndex // 重新设置pcell
            childPage.dirty = true
            childPage.ocnt++
        }
    }

    valueType(value) {

        if (typeof (value) == 'object') {
            return VAL_TYPE_OBJ
        }

        if (typeof (value) == 'number') {
            if (Number.isInteger(value)) {
                return VAL_TYPE_NUM
            } else {
                return VAL_TYPE_FPN
            }
        }

        if (typeof (value) == 'string') {
            return VAL_TYPE_STR
        }

        return VAL_TYPE_UNK
    }

    /*
     * 如果targetPage的type为叶节点，则value代表具体值，如果type非叶子节点，则value则为子节点索引
     */
    async innerInsert(targetPage, key, value, pos = -1) {
        targetPage.dirty = true
        targetPage.ocnt++
        if (pos == -1) {
            pos = this.findInsertPos(key, targetPage) // 找到插入的cell槽位
        }

        let valType = targetPage.type == NODE_TYPE_LEAF ? this.valueType(value) : VAL_TYPE_IDX
        targetPage.cells.splice(pos, 0, this._page.newCell(key, value, valType)) //  插入：splice(pos, <delete num> , value)

        targetPage.used++
        if (targetPage.used <= this.ORDER_NUM) {
            targetPage.cells.shift() // remove left 
        }

        if (targetPage.used == this.ORDER_NUM + 1) { // 若插入后, 节点包含关键字数大于阶数, 则分裂
            if (targetPage.type == NODE_TYPE_ROOT) { // 缓存头结点的freelist信息
                this.freeNext = targetPage.next
                this.freePrev = targetPage.prev
            }

            let brotherPage = await this.fetchPageNode(undefined)    // 左边的兄弟页
            let pageIndex = brotherPage.index
            await this._buff.setPageNode(pageIndex, brotherPage)
            brotherPage.dirty = true    // 新页应该写入磁盘
            brotherPage.ocnt++
            brotherPage.type = targetPage.type
            brotherPage.parent = targetPage.parent
            let prevIndex = targetPage.prev
            if (prevIndex != -1) {
                let prevPage = await this._buff.getPageNode(prevIndex, true)
                prevPage.next = pageIndex
                prevPage.dirty = true
                prevPage.ocnt++
            }
            brotherPage.prev = prevIndex
            brotherPage.next = targetPage.index
            targetPage.prev = brotherPage.index
            targetPage.dirty = true

            // 1. 把原来的页的cells的前半部分挪入新页的cells, 清除原来页的cells的前半部分
            brotherPage.used = this.MORE_HALF_NUM
            for (var i = this.MORE_HALF_NUM - 1; i >= 0; i--) {
                brotherPage.cells[(this.ORDER_NUM - 1) - (this.MORE_HALF_NUM - 1 - i)] = targetPage.cells[i]
                if (brotherPage.type > NODE_TYPE_LEAF) {
                    let childIndex = targetPage.cells[i].index
                    let childPage = await this._buff.getPageNode(childIndex, true)
                    childPage.parent = brotherPage.index // 更新子节点的父节点索引
                }
                targetPage.cells[i] = this._page.newCell()
            }

            targetPage.used = this.ORDER_NUM + 1 - this.MORE_HALF_NUM
            targetPage.cells.shift() // 补充，把左侧多余的一个删除

            if (targetPage.type == NODE_TYPE_ROOT) { // 如果分裂了root节点
                let movePage = await this.fetchPageNode(NODE_TYPE_STEM) // 把rootPage拷贝到movePage里面
                let moveIndex = movePage.index
                await this._buff.setPageNode(moveIndex, movePage)
                this._page.copyPage(movePage, targetPage)
                movePage.type = NODE_TYPE_STEM // 降为茎节点
                movePage.parent = 0 // 父节点为根节点
                movePage.prev = brotherPage.index
                movePage.dirty = true
                movePage.ocnt++
                brotherPage.type = NODE_TYPE_STEM // 茎节点
                brotherPage.parent = 0
                brotherPage.next = moveIndex
                for (var i = 0; i < movePage.used; i++) {  // move 之后，其子节点的parent需要修改
                    let childIndex = movePage.cells[this.ORDER_NUM - 1 - i].index
                    let childPage = await this._buff.getPageNode(childIndex, true)
                    childPage.parent = moveIndex
                }

                brotherPage.dirty = true
                await this.rebuildRoot(targetPage, brotherPage, movePage) // 设置根节点的cell
                return
            }

            // 2. 新页的键值和页号(index)插入到父节点
            await this.innerInsert(await this._buff.getPageNode(brotherPage.parent),
                brotherPage.cells[this.ORDER_NUM - 1].key, brotherPage.index, targetPage.pcell)

            // 3. 重建brother pcell
            if (brotherPage.type > NODE_TYPE_LEAF) { // 非叶子节点
                await this.setChildPcell(brotherPage)
            } else {
                let parent = await this._buff.getPageNode(brotherPage.parent, false)
                await this.setChildPcell(parent)
            }
        }

        // 4. 重建target pcell
        if (targetPage.type > NODE_TYPE_LEAF) {
            await this.setChildPcell(targetPage)
        } else {
            let parent = await this._buff.getPageNode(targetPage.parent, false)
            await this.setChildPcell(parent)
        }

    }

    needUpdateMax(key) {
        if (key.compare(this.rootPage.cells[this.ORDER_NUM - 1].key) > 0) { // 大于最大键值 
            return true
        }
        return false
    }

    /*
     * @description: 更新树的最大值，比如是所有节点中的最大值
     */
    async updateMaxToLeaf(page, key) {
        page.dirty = true
        page.ocnt++
        key.copy(page.cells[this.ORDER_NUM - 1].key, 0, 0, this.KEY_MAX_LEN)
        let childIndex = page.cells[this.ORDER_NUM - 1].index

        let childPage = await this._buff.getPageNode(childIndex, true)
        if (childIndex > 0 && childPage.type > NODE_TYPE_LEAF) {
            await this.updateMaxToLeaf(childPage, key)
        }
    }

    /*
     * @description: 更新子节点的最大值到父节点，该值不一定是父节点的最大值
     * @Parameter:
     *   page: 父页面; pcell: 子页面中，存的父页面的pcell
     */
    async updateMaxToRoot(page, pcell, old, now) {

        page.dirty = true
        page.ocnt++
        let upParent = false
        if (page.cells[pcell].key.compare(now) != 0) { // 替换, 值不一样就需要替换，不一定是大于
            now.copy(page.cells[pcell].key, 0, 0, this.KEY_MAX_LEN)  // buf.copy(targetBuffer[, targetStart[, sourceStart[, sourceEnd]]])
            upParent = true
        }

        let parentPage = await this._buff.getPageNode(page.parent, true)
        if (upParent && parentPage != undefined && pcell == this.ORDER_NUM - 1) {
            await this.updateMaxToRoot(parentPage, page.pcell, old, now)
        }

    }

    async insert(key, value) {

        let targetPage = await this.locateLeaf(key, this.rootPage, LOC_FOR_INSERT) // 目标叶子节点
        await this.innerInsert(targetPage, key, value)
        if (this.needUpdateMax(key)) {
            await this.updateMaxToLeaf(this.rootPage, key)
        }
    }

    async select(key) {
        let targetPage = await this.locateLeaf(key, this.rootPage, LOC_FOR_SELECT) // 目标叶子节点
        for (var i = this.ORDER_NUM - 1; i >= 0; i--) {
            if (key.compare(targetPage.cells[i].key) == 0) { // 找到位置
                if (targetPage.cells[i].type == VAL_TYPE_NUM) {
                    return targetPage.cells[i].index.readInt32LE()
                }
                if (targetPage.cells[i].type == VAL_TYPE_FPN) {
                    return targetPage.cells[i].index.readFloatLE()
                }
                if (targetPage.cells[i].type == VAL_TYPE_STR) {
                    return targetPage.cells[i].index.toString().replace(/^[\s\uFEFF\xA0\0]+|[\s\uFEFF\xA0\0]+$/g, "")
                }
                if (targetPage.cells[i].type == VAL_TYPE_OBJ) {
                    return targetPage.cells[i].index
                }
            }
        }
        return undefined
    }

    /*
     * 判断是否需要与兄弟节点进行合并，或者从兄弟节点借数
     */
    async transDecide(page) {
        if (page.prev > 0) {
            let prevIndex = page.prev
            let prevPage = await this._buff.getPageNode(prevIndex, false)
            if (prevPage.used + page.used <= this.ORDER_NUM) {
                return {
                    "method": TRANS_MERGE,
                    "index": prevIndex,
                }
            } else {
                return {
                    "method": TRANS_BORROW,
                    "index": prevIndex,
                }
            }
        }

        if (page.next > 0) {
            let nextIndex = page.next
            let nextPage = await this._buff.getPageNode(nextIndex, false)
            if (nextPage.used + page.used <= this.ORDER_NUM) {
                return {
                    "method": TRANS_MERGE,
                    "index": nextIndex,
                }
            } else {
                return {
                    "method": TRANS_BORROW,
                    "index": nextIndex,
                }
            }
        }

        return {  // 没有兄弟节点, 则保持不动, 或者向上收缩
            "method": TRANS_SHRINK,
            "index": page.index,
        }
    }

    async shrink(page) {
        await this.appendFreeNode(page.index) // 把自己加入到空闲链表
        let parent = await this._buff.getPageNode(page.parent)
        parent.cells.splice(page.pcell, 1)
        parent.used--
        parent.cells.splice(0, 0, this._page.newCell()) // 从左侧补充一个
        if (parent.used == 0 && parent.type != NODE_TYPE_ROOT) {
            await this.shrink(parent)
        }

    }


    /*
     * 如果把from 合并到 to, 则需要修改from子节点的parent
     */
    async merge(from, to) {
        // 1. 把from的kv值逐一挪动到to, 并修改prev与next指针
        to.dirty = true
        to.ocnt++
        let beDel = from.cells[this.ORDER_NUM - 1]
        if (from.next == to.index) { // 向兄节点merge，本页的值小于兄节点的值
            for (var i = 0; i < from.used; i++) {
                let fromCell = from.cells[this.ORDER_NUM - 1 - i]
                to.cells.splice(this.ORDER_NUM - 1 - to.used, 1, fromCell) //  替换原来的值 # 插入：splice(pos, <delete num> , value)
                to.used++
            }

            let prevIndex = from.prev
            to.prev = prevIndex // 替换prev
            if (prevIndex > 0) {
                let prevPage = await this._buff.getPageNode(prevIndex, true)
                prevPage.next = to.index
                prevPage.dirty = true
                prevPage.ocnt++
            }
        }

        if (from.prev == to.index) { // 向弟节点merge，本页的值大于于兄节点的值
            let old = to.cells[this.ORDER_NUM - 1].key
            for (var i = 0; i < from.used; i++) {
                let fromCell = from.cells[this.ORDER_NUM - from.used + i]
                to.cells.splice(this.ORDER_NUM, 0, fromCell) //  替换原来的值 # 插入：splice(pos, <delete num> , value)
                to.used++
                to.cells.shift() // remove left 
            }

            let nextIndex = from.next
            to.next = nextIndex  // 替换next
            if (nextIndex > 0) {
                let nextPage = await this._buff.getPageNode(nextIndex, true)
                nextPage.prev = to.index
                nextPage.dirty = true
                nextPage.ocnt++
            }

            // 更新to页面的最大值
            let now = to.cells[this.ORDER_NUM - 1].key
            let ppage = await this._buff.getPageNode(to.parent, false)
            if (now.compare(old) != 0) { // 值不一样则更新
                await this.updateMaxToRoot(ppage, to.pcell, old, now)
            }
        }

        // 更新to节点所有kv的pcell
        if (to.type > NODE_TYPE_LEAF) {
            await this.setChildPcell(to)
        }

        // 2. 把from页面子节点的父节点索引替换成to页面的索引
        if (from.type > NODE_TYPE_LEAF) {
            for (var i = 0; i < from.used; i++) {
                let childPage = await this._buff.getPageNode(from.cells[this.ORDER_NUM - 1 - i].index, true)
                childPage.dirty = true
                childPage.ocnt++
                childPage.parent = to.index
            }
        }

        // 3. from page变成空页，需要用过空闲页链表串起来
        await this.appendFreeNode(from.index)

        // 4. 从父节点中把对应的kv值删除, 递归判断是否需要对父节点进行借用或者合并
        let parent = await this._buff.getPageNode(from.parent, true) // pageMap[from.parent]
        let pcell = from.pcell
        parent.dirty = true
        parent.ocnt++
        parent.cells.splice(pcell, 1)
        parent.used--
        let cell = this._page.newCell()
        parent.cells.splice(0, 0, cell) // 则需要从左侧补充一个

        // 更新parent对应child的kv的pcell
        await this.setChildPcell(parent)

        if (parent.used < this.MORE_HALF_NUM && parent.used > 0) { // 判断是否需要对parent进行借用或者合并
            if (parent.type < NODE_TYPE_ROOT) {
                let ret = await this.transDecide(parent)
                if (ret.method == TRANS_MERGE) {
                    await this.merge(parent, await this._buff.getPageNode(ret.index, false))
                }
                if (ret.method == TRANS_BORROW) {
                    await this.borrow(parent, await this._buff.getPageNode(ret.index, false))
                }

                //process.stdout.write("# ")
                winston.info(ret);
            } else {
                winston.info("root not need merge!!!");
            }
        }
    }

    /*
     * 从from中，借用值到 to,则需要修改from子节点的parent
     */
    async borrow(to, from) {
        // 1. 把from的kv值逐一挪动到to, 并修改prev与next指针
        to.dirty = true
        from.dirty = true
        let beMov = undefined
        to.ocnt++
        from.ocnt++

        if (from.index == to.prev) { // 向弟节点borrow
            beMov = from.cells[this.ORDER_NUM - 1] // 需要移动的cell
            from.cells.splice(this.ORDER_NUM - 1, 1) // 删除from的最大值
            let cell = this._page.newCell()
            from.cells.splice(0, 0, cell) // 从左侧补充一个
            from.used--

            // 更新from页面的最大值
            let old = beMov.key
            let now = from.cells[this.ORDER_NUM - 1].key
            let ppage = await this._buff.getPageNode(from.parent, false)
            if (now.compare(old) != 0) { // 值不一样则更新
                await this.updateMaxToRoot(ppage, from.pcell, old, now)
            }

            to.cells.splice(this.ORDER_NUM - 1 - to.used, 1, beMov) // 移动到to页面中, 作为to页面的最小值，并替换原来的空值
            to.used++
        }

        if (from.index == to.next) { // 向兄节点borrow
            beMov = from.cells[this.ORDER_NUM - from.used] // 需要移动的cell
            from.cells.splice(this.ORDER_NUM - from.used, 1) // 删除from的最小值
            let cell = this._page.newCell()
            from.cells.splice(0, 0, cell) // 从左侧补充一个
            from.used--

            // 更新to页面的最大值
            let now = beMov.key
            let old = from.cells[this.ORDER_NUM - 1].key
            let ppage = await this._buff.getPageNode(to.parent, false)
            if (now.compare(old) != 0) { // 值不一样则更新
                await this.updateMaxToRoot(ppage, to.pcell, old, now)
            }

            to.cells.splice(this.ORDER_NUM, 0, beMov) // 移动到to页面中, 作为to页面的最大值
            to.cells.shift()
            to.used++
        }

        // 更新所有kv的pcell
        if (to.type > NODE_TYPE_LEAF) {
            await this.setChildPcell(to)
            await this.setChildPcell(from)
        }

        // 2. 把from页面子节点的父节点索引替换成to页面的索引
        if (from.type > NODE_TYPE_LEAF) {
            let childPage = await this._buff.getPageNode(beMov.index, true)
            childPage.dirty = true
            childPage.ocnt++
            childPage.parent = to.index
        }

    }

    async remove(kbuf) {

        if (kbuf.compare(this.rootPage.cells[this.ORDER_NUM - 1].key) > 0) { // 大于最大值
            winston.error(`[0] key: ${tools.int32le(kbuf)} not found`)
            return false
        }

        let targetPage = await this.locateLeaf(kbuf, this.rootPage, LOC_FOR_DELETE) // 目标叶子节点
        let cellIndex = undefined
        for (var i = this.ORDER_NUM - 1; i >= 0; i--) {
            if (kbuf.compare(targetPage.cells[i].key) == 0) { // 找到位置
                cellIndex = i
                break
            }
        }

        if (cellIndex == undefined) { // 未找到数据
            winston.error(`[1] key：${tools.int32le(kbuf)} not found`)
            return false
        }

        // 1. 开始进行实际的删除操作
        targetPage.dirty = true
        targetPage.ocnt++
        let old = targetPage.cells[this.ORDER_NUM - 1].key
        targetPage.cells.splice(cellIndex, 1) // 删除从cellIndex下标开始的1个元素
        targetPage.used-- // 减去使用的个数

        if (targetPage.cells.length < this.ORDER_NUM) { // 删除使数据槽位变少
            let cell = this._page.newCell()
            targetPage.cells.splice(0, 0, cell) // 则需要从左侧补充一个
        }

        if (targetPage.used == 0) {
            await this.shrink(targetPage)
        }

        // 2. 若删除的值是该页的最大值，则需要更新父节点的kv值
        if (cellIndex == this.ORDER_NUM - 1 && targetPage.used > 0) {
            let now = targetPage.cells[this.ORDER_NUM - 1].key
            let ppage = await this._buff.getPageNode(targetPage.parent, false)
            if (now.compare(old) != 0) { // 值不一样则更新, 且本页有cell被使用
                await this.updateMaxToRoot(ppage, targetPage.pcell, old, now)
            }
        }

        // 3. 删除数据后，节点的使用数目小于多一半(More half num), 则需要归并或借用
        if (targetPage.used < this.MORE_HALF_NUM && targetPage.used > 0) {
            let ret = await this.transDecide(targetPage)
            if (ret.method == TRANS_MERGE) {
                await this.merge(targetPage, await this._buff.getPageNode(ret.index, false))
            }
            if (ret.method == TRANS_BORROW) {
                await this.borrow(targetPage, await this._buff.getPageNode(ret.index, false))
            }

            //process.stdout.write("* ")
            winston.info(ret);
        }

    }

    async flush() {
        let pageNum = this._pidx.get() // 页数
        for (var index = 0; index < pageNum; index++) {
            var page = await this._buff.getPageNode(index, true)
            if (page != undefined && page.dirty == true) {
                var buff = this._page.pageToBuff(page)
                await fileops.writeFile(this.fileId, buff, 0, this.PAGE_SIZE, index * this.PAGE_SIZE)
            }
        }
        await fileops.syncFile(this.fileId)
    }

    async dump() {
        let pageNum = this._pidx.get() // 页数
        for (var index = 0; index < pageNum; index++) {
            var page = this._buff.getPageNode(index)
            var buff = this._page.pageToBuff(page)
            let full = buff.toString('hex').toUpperCase()
            for (var i = 0; i < 32; i++) {
                process.stdout.write(full.substr(i * 2, 2));
                process.stdout.write(" ")
            }
            process.stdout.write("\r\n")
            for (var i = 32; i < 64; i++) {
                process.stdout.write(full.substr(i * 2, 2));
                process.stdout.write(" ")
            }
            process.stdout.write("\r\n")
        }
    }

    async close() {
        await fileops.closeFile(this.fileId)
    }

}

module.exports = Bptree;
