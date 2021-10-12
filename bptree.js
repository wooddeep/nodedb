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
//  |       |       |   
//  |  KEY  |  VAL  |            // 一对KV值，K与V的长度可以配置，KV对的个数和K长度、V长度、以及页大小相关
//  |       |       |   
//  +-------+-------+
//  |    ........   |
//  +-------+-------+
//  |       |       |   
//  |  KEY  |  VAL  |
//  |       |       |   
//  +-------+-------+
//

//const { PAGE_PARENT_IDX_LEN, PAGE_PREV_IDX_LEN, PAGE_NEXT_IDX_LEN } = require("./const.js");
const {
    START_OFFSET,
    KEY_MAX_LEN,
    PAGE_SIZE,
    ORDER_NUM,
    CELL_LEN,
    CELL_OFFSET,
    MORE_HALF_NUM,
    NODE_TYPE_LEAF,
    NODE_TYPE_STEM,
    NODE_TYPE_ROOT,
    NODE_TYPE_FREE,
    PAGE_TYPE_OFFSET,
    PAGE_PARENT_OFFSET,
    PAGE_NEXT_OFFSET,
    PAGE_PREV_OFFSET,
    CELL_USED_OFFSET,
    LOC_FOR_INSERT,
    LOC_FOR_SELECT,
    LOC_FOR_DELETE,
    TRANS_MERGE,
    TRANS_BORROW,
    TRANS_SHRINK
} = require("./const.js")

const winston = require('./winston/config')
const fileops = require("./fileops.js")
const tools = require('./tools')
const Buff = require('./pbuff.js')
const Page = require('./page.js')
const Pidx = require('./pidx.js')

const BUFF_CELL_SIZE = 2000

Buffer.prototype.compare = function (to) {
    let left = this.readInt32LE(0)
    let right = to.readInt32LE(0)
    if (left == right) return 0
    if (left > right) return 1
    else return -1
}

class Bptree {

    constructor() {
        this.fileId = undefined
        this.rootPage = undefined // 根页面 
        this.freeNext = 0
        this.freePrev = 0
        this._page = new Page()
        this._pidx = new Pidx()
        this._buff = new Buff(BUFF_CELL_SIZE, this._pidx)
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
        firstFreePage.release()
        free.release()
    }

    async fetchPageNode(type) {
        if (this.rootPage == undefined || this.rootPage.next == this.rootPage.prev) {
            let index = this.newPageIndex() // 此处无需插入到缓存中, 在fetchPageNode的调用点被插入，在使用后被release
            let node = this._page.newPage(type)  // newPage 返回的page的inuse字段也为true
            node.index = index
            return node // node 无需release, 在使用后被release
        }

        let id = this.rootPage.next
        let node = await this._buff.getPageNode(id)
        let nextId = node.next
        this.rootPage.next = nextId
        let nextNode = await this._buff.getPageNode(nextId)
        nextNode.prev = node.prev
        nextNode.dirty = true
        nextNode.release()
        node.type = type
        return node // node 无需release, 在使用后被release
    }

    async drop(dbname) {
        let ret = await fileops.unlinkFile(dbname)
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
        this._pidx.set(Math.floor(stat.size / PAGE_SIZE)) // 数据库文件所占的总页数

        if (stat.size < PAGE_SIZE) { // 空文件
            this.rootPage = await this.fetchPageNode(NODE_TYPE_ROOT)    // 新生成一个根页面
            this.rootPage.index = 0       // index只存在内存中，未持久化，在初始化时添加
            this.rootPage.next = 0        // rootPage的prev和next指向自己，用于空闲链表
            this.rootPage.prev = 0
            await this._buff.setPageNode(0, this.rootPage)
            return this.fileId
        }

        let buff = Buffer.alloc(PAGE_SIZE)
        let bytes = await fileops.readFile(this.fileId, buff, START_OFFSET, PAGE_SIZE, 0) // 文件第一页，始终放置root页
        this.rootPage = await this._page.buffToPage(buff)
        this.rootPage.index = 0
        await this._buff.setPageNode(0, this.rootPage)

        let minSize = BUFF_CELL_SIZE * PAGE_SIZE > stat.size ? stat.size : BUFF_CELL_SIZE * PAGE_SIZE
        for (var index = PAGE_SIZE; index < minSize; index += PAGE_SIZE) {
            await fileops.readFile(this.fileId, buff, START_OFFSET, PAGE_SIZE, index) // 非root页
            let pageNode = this._page.buffToPage(buff)
            let pageIndex = Math.floor(index / PAGE_SIZE)
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
        page.occupy()
        left.occupy()
        right.occupy()

        for (var index = 0; index < ORDER_NUM - 2; index++) {
            var cell = this._page.newCell()
            page.cells[index] = cell
        }

        page.cells[ORDER_NUM - 2] = this._page.newCell(left.cells[ORDER_NUM - 1].key, left.index)
        page.cells[ORDER_NUM - 1] = this._page.newCell(right.cells[ORDER_NUM - 1].key, right.index)
        page.prev = -1
        page.used = 2 // 左右两个子节点

        // left节点以及right节点的子节点的parent设置成自身
        for (var idx = 0; idx < left.used; idx++) {
            var childIndex = left.cells[ORDER_NUM - 1 - idx].index
            let page = await this._buff.getPageNode(childIndex, false, true)
            page.parent = left.index
        }

        for (var idx = 0; idx < right.used; idx++) {
            var childIndex = right.cells[ORDER_NUM - 1 - idx].index
            let page = await this._buff.getPageNode(childIndex, false, true)
            page.parent = right.index
        }

        left.next = right.index
        right.prev = left.index
        left.prev = -1
        right.next = -1

        left.pcell = ORDER_NUM - 2
        right.pcell = ORDER_NUM - 1
        await this.setChildPcell(left)
        await this.setChildPcell(right)

        left.dirty = true
        right.dirty = true

        left.ocnt++
        right.ocnt++

        page.prev = this.freePrev
        page.next = this.freeNext

        right.release()
        left.release()
        page.release()
    }

    /*
     * 定位叶子页节点
     */
    async locateLeaf(key, currPage, locType = LOC_FOR_INSERT) {
        currPage.occupy()
        let cells = currPage.cells
        let maxIndex = cells.length - 1

        if (currPage.type == NODE_TYPE_LEAF) {
            currPage.release()
            return currPage
        }

        let found = true, pageIndex = -1, cellIndex = -1
        if (key.compare(cells[maxIndex].key) > 0) { // 大于最大键值 
            found = false
            pageIndex = cells[maxIndex].index
            cellIndex = maxIndex
        }
        let minIndx = currPage.used > 0 ? ORDER_NUM - currPage.used : ORDER_NUM - 1
        if (key.compare(cells[minIndx].key) <= 0) {
            pageIndex = cells[minIndx].index
            if (locType == LOC_FOR_INSERT) { //  小于最小键值
                cellIndex = minIndx
                found = false
            }
            if (locType != LOC_FOR_INSERT) { // 查找時候, 小於最小值, 視為已經查找到
                currPage.release()
                return await this.locateLeaf(key, await this._buff.getPageNode(pageIndex, false, false), locType)
            }
        }

        if (!found) {
            currPage.release()
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
                return await this.locateLeaf(key, await this._buff.getPageNode(pageIndex, false, false), locType) // 子页面节点查找
            }
        }

        for (var index = maxIndex; index >= 1; index--) { // TODO: 折半查找法
            if (key.compare(cells[index].key) <= 0 && key.compare(cells[index - 1].key) > 0) { // 查找到
                let page = await this._buff.getPageNode(cells[index].index, false, false)
                currPage.release()
                return await this.locateLeaf(key, page, locType)
            }
        }
    }

    /*
     * 查找cells的插入位置
     * 如果page的类型为NODE_TYPE_LEAF, 则pos随便插入, 否则需要比较值页内值
     */
    findInsertPos(key, page) {
        for (var i = ORDER_NUM - 1; i >= 0; i--) {
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
        parent.occupy()
        try {
            for (var i = 0; i < parent.used; i++) {
                let cellIndex = ORDER_NUM - 1 - i
                let childIndex = parent.cells[cellIndex].index
                let childPage = await this._buff.getPageNode(childIndex, false, true)
                childPage.pcell = cellIndex // 重新设置pcell
                childPage.dirty = true
                childPage.ocnt++
            }
        } catch (e) {
            console.log(parent)
        }

        parent.release()
    }

    /*
     * 如果targetPage的type为叶节点，则value代表具体值，如果type非叶子节点，则value则为子节点索引
     */
    async innerInsert(targetPage, key, value, pos = -1) {
        // 插入
        targetPage.occupy()
        targetPage.dirty = true
        targetPage.ocnt++
        if (pos == -1) {
            pos = this.findInsertPos(key, targetPage) // 找到插入的cell槽位
        }
        targetPage.cells.splice(pos, 0, this._page.newCell(key, value)) //  插入：splice(pos, <delete num> , value)
        targetPage.used++
        if (targetPage.used <= ORDER_NUM) {
            targetPage.cells.shift() // remove left 
        }

        if (targetPage.used == ORDER_NUM + 1) { // 若插入后, 节点包含关键字数大于阶数, 则分裂
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
                let prevPage = await this._buff.getPageNode(prevIndex, false, true)
                prevPage.next = pageIndex
                prevPage.dirty = true
                prevPage.ocnt++
            }
            brotherPage.prev = prevIndex
            brotherPage.next = targetPage.index
            targetPage.prev = brotherPage.index
            targetPage.dirty = true

            // 1. 把原来的页的cells的前半部分挪入新页的cells, 清除原来页的cells的前半部分
            brotherPage.used = MORE_HALF_NUM
            for (var i = MORE_HALF_NUM - 1; i >= 0; i--) {
                brotherPage.cells[(ORDER_NUM - 1) - (MORE_HALF_NUM - 1 - i)] = targetPage.cells[i]
                if (brotherPage.type > NODE_TYPE_LEAF) {
                    let childIndex = targetPage.cells[i].index
                    let childPage = await this._buff.getPageNode(childIndex, false, true)
                    childPage.parent = brotherPage.index // 更新子节点的父节点索引
                }
                targetPage.cells[i] = this._page.newCell()
            }

            targetPage.used = ORDER_NUM + 1 - MORE_HALF_NUM
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
                    let childIndex = movePage.cells[ORDER_NUM - 1 - i].index
                    let childPage = await this._buff.getPageNode(childIndex, false, true)
                    childPage.parent = moveIndex
                }

                brotherPage.dirty = true
                movePage.release()
                brotherPage.release()
                targetPage.release()
                await this.rebuildRoot(targetPage, brotherPage, movePage) // 设置根节点的cell
                return
            }

            // 2. 新页的键值和页号(index)插入到父节点
            await this.innerInsert(await this._buff.getPageNode(brotherPage.parent),
                brotherPage.cells[ORDER_NUM - 1].key, brotherPage.index, targetPage.pcell)

            // 3. 重建brother pcell
            if (brotherPage.type > NODE_TYPE_LEAF) { // 非叶子节点
                await this.setChildPcell(brotherPage)
            } else {
                brotherPage.release()
                let parent = await this._buff.getPageNode(brotherPage.parent, false, false)
                await this.setChildPcell(parent)
            }
        }

        // 4. 重建target pcell
        if (targetPage.type > NODE_TYPE_LEAF) {
            await this.setChildPcell(targetPage)
        } else {
            let parent = await this._buff.getPageNode(targetPage.parent, false, false)
            await this.setChildPcell(parent)
        }

        targetPage.release()
    }

    needUpdateMax(key) {
        if (key.compare(this.rootPage.cells[ORDER_NUM - 1].key) > 0) { // 大于最大键值 
            return true
        }
        return false
    }

    /*
     * @description: 更新树的最大值，比如是所有节点中的最大值
     */
    async updateMaxToLeaf(page, key) {
        page.occupy()
        page.dirty = true
        page.ocnt++
        key.copy(page.cells[ORDER_NUM - 1].key, 0, 0, KEY_MAX_LEN)
        let childIndex = page.cells[ORDER_NUM - 1].index

        let childPage = await this._buff.getPageNode(childIndex, false, true)
        if (childIndex > 0 && childPage.type > NODE_TYPE_LEAF) {
            await this.updateMaxToLeaf(childPage, key)
        }

        page.release()
    }

    /*
     * @description: 更新子节点的最大值到父节点，该值不一定是父节点的最大值
     * @Parameter:
     *   page: 父页面; pcell: 子页面中，存的父页面的pcell
     */
    async updateMaxToRoot(page, pcell, old, now) {
        page.occupy()

        page.dirty = true
        page.ocnt++
        let upParent = false
        if (page.cells[pcell].key.compare(now) != 0) { // 替换, 值不一样就需要替换，不一定是大于
            now.copy(page.cells[pcell].key, 0, 0, KEY_MAX_LEN)  // buf.copy(targetBuffer[, targetStart[, sourceStart[, sourceEnd]]])
            upParent = true
        }

        let parentPage = await this._buff.getPageNode(page.parent, false, true)
        if (upParent && parentPage != undefined && pcell == ORDER_NUM - 1) {
            await this.updateMaxToRoot(parentPage, page.pcell, old, now)
        }

        page.release()
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
        for (var i = ORDER_NUM - 1; i >= 0; i--) {
            if (key.compare(targetPage.cells[i].key) == 0) { // 找到位置
                return targetPage.cells[i].index
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
            let prevPage = await this._buff.getPageNode(prevIndex, false, false)
            if (prevPage.used + page.used <= ORDER_NUM) {
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
            let nextPage = await this._buff.getPageNode(nextIndex, false, false)
            if (nextPage.used + page.used <= ORDER_NUM) {
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
        let beDel = from.cells[ORDER_NUM - 1]
        if (from.next == to.index) { // 向兄节点merge，本页的值小于兄节点的值
            for (var i = 0; i < from.used; i++) {
                let fromCell = from.cells[ORDER_NUM - 1 - i]
                to.cells.splice(ORDER_NUM - 1 - to.used, 1, fromCell) //  替换原来的值 # 插入：splice(pos, <delete num> , value)
                to.used++
            }

            let prevIndex = from.prev
            to.prev = prevIndex // 替换prev
            if (prevIndex > 0) {
                let prevPage = await this._buff.getPageNode(prevIndex, false, true)
                prevPage.next = to.index
                prevPage.dirty = true
                prevPage.ocnt++
            }
        }

        if (from.prev == to.index) { // 向弟节点merge，本页的值大于于兄节点的值
            let old = to.cells[ORDER_NUM - 1].key
            for (var i = 0; i < from.used; i++) {
                let fromCell = from.cells[ORDER_NUM - from.used + i]
                to.cells.splice(ORDER_NUM, 0, fromCell) //  替换原来的值 # 插入：splice(pos, <delete num> , value)
                to.used++
                to.cells.shift() // remove left 
            }

            let nextIndex = from.next
            to.next = nextIndex  // 替换next
            if (nextIndex > 0) {
                let nextPage = await this._buff.getPageNode(nextIndex, false, true)
                nextPage.prev = to.index
                nextPage.dirty = true
                nextPage.ocnt++
            }

            // 更新to页面的最大值
            let now = to.cells[ORDER_NUM - 1].key
            let ppage = await this._buff.getPageNode(to.parent, false, false)
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
                let childPage = await this._buff.getPageNode(from.cells[ORDER_NUM - 1 - i].index, false, true)
                childPage.dirty = true
                childPage.ocnt++
                childPage.parent = to.index
            }
        }

        // 3. from page变成空页，需要用过空闲页链表串起来
        await this.appendFreeNode(from.index)

        // 4. 从父节点中把对应的kv值删除, 递归判断是否需要对父节点进行借用或者合并
        let parent = await this._buff.getPageNode(from.parent, false, true) // pageMap[from.parent]
        let pcell = from.pcell
        parent.dirty = true
        parent.ocnt++
        parent.cells.splice(pcell, 1)
        parent.used--
        let cell = this._page.newCell()
        parent.cells.splice(0, 0, cell) // 则需要从左侧补充一个

        // 更新parent对应child的kv的pcell
        await this.setChildPcell(parent)

        if (parent.used < MORE_HALF_NUM && parent.used > 0) { // 判断是否需要对parent进行借用或者合并
            if (parent.type < NODE_TYPE_ROOT) {
                let ret = await this.transDecide(parent)
                if (ret.method == TRANS_MERGE) {
                    await this.merge(parent, await this._buff.getPageNode(ret.index, false, false))
                }
                if (ret.method == TRANS_BORROW) {
                    await this.borrow(parent, await this._buff.getPageNode(ret.index, false, false))
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
            beMov = from.cells[ORDER_NUM - 1] // 需要移动的cell
            from.cells.splice(ORDER_NUM - 1, 1) // 删除from的最大值
            let cell = this._page.newCell()
            from.cells.splice(0, 0, cell) // 从左侧补充一个
            from.used--

            // 更新from页面的最大值
            let old = beMov.key
            let now = from.cells[ORDER_NUM - 1].key
            let ppage = await this._buff.getPageNode(from.parent, false, false)
            if (now.compare(old) != 0) { // 值不一样则更新
                await this.updateMaxToRoot(ppage, from.pcell, old, now)
            }

            to.cells.splice(ORDER_NUM - 1 - to.used, 1, beMov) // 移动到to页面中, 作为to页面的最小值，并替换原来的空值
            to.used++
        }

        if (from.index == to.next) { // 向兄节点borrow
            beMov = from.cells[ORDER_NUM - from.used] // 需要移动的cell
            from.cells.splice(ORDER_NUM - from.used, 1) // 删除from的最小值
            let cell = this._page.newCell()
            from.cells.splice(0, 0, cell) // 从左侧补充一个
            from.used--

            // 更新to页面的最大值
            let now = beMov.key
            let old = from.cells[ORDER_NUM - 1].key
            let ppage = await this._buff.getPageNode(to.parent, false, false)
            if (now.compare(old) != 0) { // 值不一样则更新
                await this.updateMaxToRoot(ppage, to.pcell, old, now)
            }

            to.cells.splice(ORDER_NUM, 0, beMov) // 移动到to页面中, 作为to页面的最大值
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
            let childPage = await this._buff.getPageNode(beMov.index, false, true)
            childPage.dirty = true
            childPage.ocnt++
            childPage.parent = to.index
        }

    }

    async remove(kbuf) {

        if (kbuf.compare(this.rootPage.cells[ORDER_NUM - 1].key) > 0) { // 大于最大值
            winston.error(`[0] key: ${tools.int32le(kbuf)} not found`)
            return false
        }

        let targetPage = await this.locateLeaf(kbuf, this.rootPage, LOC_FOR_DELETE) // 目标叶子节点
        let cellIndex = undefined
        for (var i = ORDER_NUM - 1; i >= 0; i--) {
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
        let old = targetPage.cells[ORDER_NUM - 1].key
        targetPage.cells.splice(cellIndex, 1) // 删除从cellIndex下标开始的1个元素
        targetPage.used-- // 减去使用的个数

        if (targetPage.cells.length < ORDER_NUM) { // 删除使数据槽位变少
            let cell = this._page.newCell()
            targetPage.cells.splice(0, 0, cell) // 则需要从左侧补充一个
        }

        if (targetPage.used == 0) {
            await this.shrink(targetPage)
        }

        // 2. 若删除的值是该页的最大值，则需要更新父节点的kv值
        if (cellIndex == ORDER_NUM - 1 && targetPage.used > 0) {
            let now = targetPage.cells[ORDER_NUM - 1].key
            let ppage = await this._buff.getPageNode(targetPage.parent, false, false)
            if (now.compare(old) != 0) { // 值不一样则更新, 且本页有cell被使用
                await this.updateMaxToRoot(ppage, targetPage.pcell, old, now)
            }
        }

        // 3. 删除数据后，节点的使用数目小于 MORE_HALF_NUM, 则需要归并或借用
        if (targetPage.used < MORE_HALF_NUM && targetPage.used > 0) {
            let ret = await this.transDecide(targetPage)
            if (ret.method == TRANS_MERGE) {
                await this.merge(targetPage, await this._buff.getPageNode(ret.index, false, false))
            }
            if (ret.method == TRANS_BORROW) {
                await this.borrow(targetPage, await this._buff.getPageNode(ret.index, false, false))
            }

            //process.stdout.write("* ")
            winston.info(ret);
        }

    }

    async flush() {
        let pageNum = this._pidx.get() // 页数
        for (var index = 0; index < pageNum; index++) {
            var page = await this._buff.getPageNode(index, false, true)
            if (page != undefined && page.dirty == true) {
                var buff = this._page.pageToBuff(page)
                await fileops.writeFile(this.fileId, buff, 0, PAGE_SIZE, index * PAGE_SIZE)
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
