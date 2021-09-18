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
} = require("./const.js")

const winston = require('./winston/config')
const fileops = require("./fileops.js")
const tools = require('./tools')
var Page = require('./page.js')
const _page = new Page() // 默认构造函数
var fileId = undefined

var rootPage = undefined // 根页面 
const pageMap = {} // 页表
var freeNext = 0
var freePrev = 0

class Bptree {

    appendFreeNode(id) {
        let from = pageMap[id]
        let firstFreeIndex = rootPage.next
        let firstFreePage = pageMap[firstFreeIndex] // TODO 如果找不到, 需要重新加载
        rootPage.next = id
        from.next = firstFreeIndex
        from.prev = firstFreePage.prev
        firstFreePage.prev = id
        from.type = NODE_TYPE_FREE
    }

    fetchPageNode(type) {
        if (rootPage == undefined || rootPage.next == rootPage.prev) {
            let index = this.maxIndex() // TODO 修改为分段加载模式
            let node = _page.newPage(type)
            node.index = index
            return node
        }

        let id = rootPage.next
        let node = pageMap[id]
        let nextId = node.next
        rootPage.next = nextId
        pageMap[nextId].prev = node.prev
        node.type = type
        return node
    }

    async drop(dbname) {
        let ret = await fileops.unlinkFile(dbname)
    }

    async init(dbname) {
        let exist = await fileops.existFile(dbname)
        if (!exist) { // 文件不存在则创建
            await fileops.createFile(dbname)
        }

        let fd = await fileops.openFile(dbname)
        fileId = fd
        let stat = await fileops.statFile(fd)
        winston.info("file size = " + stat.size)

        if (stat.size < PAGE_SIZE) { // 空文件
            rootPage = this.fetchPageNode(NODE_TYPE_ROOT)    // 新生成一个根页面
            rootPage.index = 0       // index只存在内存中，未持久化，在初始化时添加
            rootPage.next = 0        // rootPage的prev和next指向自己，用于空闲链表
            rootPage.prev = 0
            pageMap[0] = rootPage
            return fd
        }

        let buff = Buffer.alloc(PAGE_SIZE)
        let bytes = await fileops.readFile(fd, buff, START_OFFSET, PAGE_SIZE, 0) // 文件第一页，始终放置root页
        rootPage = _page.buffToPage(buff)
        rootPage.index = 0
        pageMap[0] = rootPage
        let freeIdList = []
        for (var index = PAGE_SIZE; index < stat.size; index += PAGE_SIZE) {
            let bytes = await fileops.readFile(fd, buff, START_OFFSET, PAGE_SIZE, index) // 非root页
            let pageNode = _page.buffToPage(buff)
            let pageIndex = Math.floor(index / PAGE_SIZE)
            pageNode.index = pageIndex
            pageMap[pageIndex] = pageNode
            if (pageNode.type == NODE_TYPE_FREE) {
                freeIdList.push(pageIndex)
            }
        }

        freeIdList.forEach(id => {
            this.appendFreeNode(id)
        })

        return fd
    }

    /*
     * Descripiton:
     *    当根点需要分裂时，重建根节点，根节点保持在index = 0的位置，新的根节点有只有两个cell
     * Parameters:
     *    @left: 左节点
     *    @right: 右节点
     */
    rebuildRoot(page, left, right) {
        for (var index = 0; index < ORDER_NUM - 2; index++) {
            var cell = _page.newCell()
            page.cells[index] = cell
        }

        page.cells[ORDER_NUM - 2] = _page.newCell(left.cells[ORDER_NUM - 1].key, left.index)
        page.cells[ORDER_NUM - 1] = _page.newCell(right.cells[ORDER_NUM - 1].key, right.index)
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

        left.next = right.index
        right.prev = left.index
        left.prev = -1
        right.next = -1

        left.pcell = ORDER_NUM - 2
        right.pcell = ORDER_NUM - 1
        left.dirty = true
        right.dirty = true

        left.ocnt++
        right.ocnt++

        page.prev = freePrev
        page.next = freeNext
    }

    /*
     * 定位叶子页节点
     */
    locateLeaf(key, currPage) {
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
        if (key.compare(cells[0].key) <= 0) { //  小于最小键值
            found = false
            pageIndex = cells[0].index
            cellIndex = 0
        }
        if (!found) {
            if (pageIndex == 0) { // 说明还没有分配叶子值
                let page = this.fetchPageNode(NODE_TYPE_LEAF) // 生成叶子节点
                let pageNum = page.index
                pageMap[pageNum] = page // 插入到缓存表
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
                return this.locateLeaf(key, pageMap[pageIndex]) // 子页面节点查找
            }
        }

        for (var index = maxIndex; index >= 1; index--) { // TODO: 折半查找法
            if (key.compare(cells[index].key) <= 0 && key.compare(cells[index - 1].key) > 0) { // 查找到
                let page = pageMap[cells[index].index]
                return this.locateLeaf(key, page)
            }
        }
    }

    /*
     * 查找cells的插入位置
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

    maxIndex() {
        let pageNum = Object.getOwnPropertyNames(pageMap).length // 页数
        return pageNum
    }

    setChildPcell(parent) {
        for (var i = 0; i < parent.used; i++) {
            let cellIndex = ORDER_NUM - 1 - i
            let childIndex = parent.cells[cellIndex].index
            let childPage = pageMap[childIndex]
            childPage.pcell = cellIndex // 重新设置pcell
            childPage.dirty = true
            childPage.ocnt++
        }
    }

    /*
     * 如果targetPage的type为叶节点，则value代表具体值，如果type非叶子节点，则value则为子节点索引
     */
    innerInsert(targetPage, key, value) {
        // 插入
        targetPage.dirty = true
        targetPage.ocnt++
        let pos = this.findInsertPos(key, targetPage) // 找到插入的cell槽位
        targetPage.cells.splice(pos, 0, _page.newCell(key, value)) //  插入：splice(pos, <delete num> , value)
        targetPage.used++
        if (targetPage.used <= ORDER_NUM) {
            targetPage.cells.shift() // remove left 
        }

        if (targetPage.used == ORDER_NUM + 1) { // 若插入后, 节点包含关键字数大于阶数, 则分裂
            if (targetPage.type == NODE_TYPE_ROOT) { // 缓存头结点的freelist信息
                freeNext = targetPage.next
                freePrev = targetPage.prev
            }

            let brotherPage = this.fetchPageNode(undefined)    // 左边的兄弟页
            let pageIndex = brotherPage.index
            pageMap[pageIndex] = brotherPage
            brotherPage.dirty = true    // 新页应该写入磁盘
            brotherPage.ocnt++
            brotherPage.type = targetPage.type
            brotherPage.parent = targetPage.parent
            let prevIndex = targetPage.prev
            if (prevIndex != -1) {
                pageMap[prevIndex].next = pageIndex
                pageMap[prevIndex].dirty = true
                pageMap[prevIndex].ocnt++
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
                    pageMap[childIndex].parent = brotherPage.index // 更新子节点的父节点索引
                }
                targetPage.cells[i] = _page.newCell()
            }

            targetPage.used = ORDER_NUM + 1 - MORE_HALF_NUM
            targetPage.cells.shift() // 补充，把左侧多余的一个删除

            if (targetPage.type == NODE_TYPE_ROOT) { // 如果分裂了root节点
                let movePage = this.fetchPageNode(NODE_TYPE_STEM) // 把rootPage拷贝到movePage里面
                let moveIndex = movePage.index
                pageMap[moveIndex] = movePage
                _page.copyPage(movePage, targetPage)
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
                    pageMap[childIndex].parent = moveIndex
                }

                brotherPage.dirty = true
                this.rebuildRoot(targetPage, brotherPage, movePage) // 设置根节点的cell
                return
            }
            // 2. 新页的键值和页号(index)插入到父节点
            this.innerInsert(pageMap[brotherPage.parent], brotherPage.cells[ORDER_NUM - 1].key, brotherPage.index)

            // 3. 重建brother pcell
            if (brotherPage.type > NODE_TYPE_LEAF) {
                this.setChildPcell(brotherPage)
            } else {
                let parent = pageMap[brotherPage.parent]
                this.setChildPcell(parent)
            }
        }

        // 4. 重建target pcell
        if (targetPage.type > NODE_TYPE_LEAF) {
            this.setChildPcell(targetPage)
        } else {
            let parent = pageMap[targetPage.parent]
            this.setChildPcell(parent)
        }

    }

    needUpdateMax(key) {
        if (key.compare(rootPage.cells[ORDER_NUM - 1].key) > 0) { // 大于最大键值 
            return true
        }
        return false
    }

    /*
     * @description: 更新树的最大值，比如是所有节点中的最大值
     */
    updateMaxToLeaf(page, key) {
        page.dirty = true
        page.ocnt++
        key.copy(page.cells[ORDER_NUM - 1].key, 0, 0, KEY_MAX_LEN)    // TODO ORDER_NUM -> KEY_MAX_LEN
        let childIndex = page.cells[ORDER_NUM - 1].index
        winston.error(`childIndex = ${childIndex}`)
        if (childIndex > 0 && pageMap[childIndex].type > NODE_TYPE_LEAF) {
            this.updateMaxToLeaf(pageMap[childIndex], key)
        }
    }

    /*
     * @description: 更新子节点的最大值到父节点，该值不一定是父节点的最大值
     * @Parameter:
     *   page: 父页面; pcell: 子页面中，存的父页面的pcell
     */
    updateMaxToRoot(page, pcell, old, now) {
        page.dirty = true
        page.ocnt++
        let upParent = false
        if (page.cells[pcell].key.compare(now) != 0) { // 替换, 值不一样就需要替换，不一定是大于
            now.copy(page.cells[pcell].key, 0, 0, KEY_MAX_LEN)  // buf.copy(targetBuffer[, targetStart[, sourceStart[, sourceEnd]]])
            upParent = true
        }

        if (upParent && pageMap[page.parent] != undefined) {
            this.updateMaxToRoot(pageMap[page.parent], page.pcell, old, now)
        }

    }

    insert(key, value) {
        let targetPage = this.locateLeaf(key, rootPage) // 目标叶子节点
        this.innerInsert(targetPage, key, value)
        if (this.needUpdateMax(key)) {
            this.updateMaxToLeaf(rootPage, key)
        }
    }

    select(key) {
        let targetPage = this.locateLeaf(key, rootPage) // 目标叶子节点
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
    mergeOrBorrow(page) {
        if (page.prev > 0) {
            let prevIndex = page.prev
            if (pageMap[prevIndex].used + page.used <= ORDER_NUM) {
                return {
                    "method": "merge",
                    "index": prevIndex,
                }
            } else {
                return {
                    "method": "borrow",
                    "index": prevIndex,
                }
            }
        }

        if (page.next > 0) {
            let nextIndex = page.next
            if (pageMap[nextIndex].used + page.used <= ORDER_NUM) {
                return {
                    "method": "merge",
                    "index": nextIndex,
                }
            } else {
                return {
                    "method": "borrow",
                    "index": nextIndex,
                }
            }
        }

        return {  // 没有兄弟节点, 则保持不动, 或者向上收缩
            "method": "shrink",
            "index": page.index,
        }
    }

    shrink(page) {
        let parent = pageMap[page.parent]
        if (page.type == NODE_TYPE_LEAF && parent.prev == -1
            && parent.next == -1 && page.type != NODE_TYPE_ROOT) {
            appendFreeNode(page.id) // 加入到空闲链表
            parent.used = page.used
            for (var i = 0; i < page.used; i++) {
                parent.cells[ORDER_NUM - 1 - i] = _page.newCell(
                    page.cells[ORDER_NUM - 1 - i].key,
                    page.cells[ORDER_NUM - 1 - i].value
                )
            }
        }
    }


    /*
     * 如果把from 合并到 to, 则需要修改from子节点的parent
     */
    merge(from, to) {
        // 1. 把from的kv值逐一挪动到to, 并修改prev与next指针
        to.dirty = true
        to.ocnt++
        let beDel = from.cells[ORDER_NUM - 1]
        if (from.next == to.index) { // 向兄节点merge，本页的值小于兄节点的值
            for (var i = 0; i < from.used; i++) {
                let fromCell = from.cells[ORDER_NUM - 1 - i]
                to.cells.splice(ORDER_NUM - 1 - to.used - i, 1, fromCell) //  替换原来的值 # 插入：splice(pos, <delete num> , value)
                to.used++
            }

            let prevIndex = from.prev
            to.prev = prevIndex // 替换prev
            if (prevIndex > 0) {
                pageMap[prevIndex].next = to.index
                pageMap[prevIndex].dirty = true
                pageMap[prevIndex].ocnt++
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
                pageMap[nextIndex].prev = to.index
                pageMap[nextIndex].dirty = true
                pageMap[nextIndex].ocnt++
            }

            // 更新to页面的最大值
            let now = to.cells[ORDER_NUM - 1].key
            let ppage = pageMap[to.parent]
            if (now.compare(old) != 0) { // 值不一样则更新
                this.updateMaxToRoot(ppage, to.pcell, old, now)
            }
        }

        // 更新to节点所有kv的pcell
        if (to.type > NODE_TYPE_LEAF) {
            this.setChildPcell(to)
        }

        // 2. 把from页面子节点的父节点索引替换成to页面的索引
        if (from.type > NODE_TYPE_LEAF) {
            for (var i = 0; i < from.used; i++) {
                let childPage = pageMap[from.cells[ORDER_NUM - 1 - i].index]
                childPage.dirty = true
                childPage.ocnt++
                childPage.parent = to.index
            }
        }

        // 3. from page变成空页，需要用过空闲页链表串起来
        this.appendFreeNode(from.index)

        // 4. 从父节点中把对应的kv值删除, 递归判断是否需要对父节点进行借用或者合并
        let parent = pageMap[from.parent]
        let pcell = from.pcell
        parent.dirty = true
        parent.ocnt++
        parent.cells.splice(pcell, 1)
        parent.used--
        let cell = _page.newCell()
        parent.cells.splice(0, 0, cell) // 则需要从左侧补充一个

        // 更新parent对应child的kv的pcell
        this.setChildPcell(parent)

        if (parent.used < MORE_HALF_NUM) { // 判断是否需要对parent进行借用或者合并
            if (parent.type < NODE_TYPE_ROOT) {
                let ret = this.mergeOrBorrow(parent)
                if (ret.method == "merge") {
                    this.merge(parent, pageMap[ret.index])
                }
                if (ret.method == "borrow") {
                    this.borrow(parent, pageMap[ret.index])
                }
                if (ret.method == "shrink") {
                    this.shrink(parent)
                }

                winston.error(ret);
            } else {
                winston.error("root not need merge!!!");
            }
        }
    }

    /*
     * 从from中，借用值到 to,则需要修改from子节点的parent
     */
    borrow(to, from) {
        // 1. 把from的kv值逐一挪动到to, 并修改prev与next指针
        to.dirty = true
        from.dirty = true
        let beMov = undefined
        to.ocnt++
        from.ocnt++

        if (from.index == to.prev) { // 向弟节点borrow
            beMov = from.cells[ORDER_NUM - 1] // 需要移动的cell
            from.cells.splice(ORDER_NUM - 1, 1) // 删除from的最大值
            let cell = _page.newCell()
            from.cells.splice(0, 0, cell) // 从左侧补充一个
            from.used--

            // 更新from页面的最大值
            let old = beMov.key
            let now = from.cells[ORDER_NUM - 1].key
            let ppage = pageMap[from.parent]
            if (now.compare(old) != 0) { // 值不一样则更新
                this.updateMaxToRoot(ppage, from.pcell, old, now)
            }

            to.cells.splice(ORDER_NUM - 1 - to.used, 1, beMov) // 移动到to页面中, 作为to页面的最小值，并替换原来的空值
            to.used++
        }

        if (from.index == to.next) { // 向兄节点borrow
            beMov = from.cells[ORDER_NUM - from.used] // 需要移动的cell
            from.cells.splice(ORDER_NUM - from.used, 1) // 删除from的最小值
            let cell = _page.newCell()
            from.cells.splice(0, 0, cell) // 从左侧补充一个
            from.used--

            // 更新to页面的最大值
            let now = beMov.key
            let old = from.cells[ORDER_NUM - 1].key
            let ppage = pageMap[to.parent]
            if (now.compare(old) != 0) { // 值不一样则更新
                this.updateMaxToRoot(ppage, to.pcell, old, now)
            }

            to.cells.splice(ORDER_NUM, 0, beMov) // 移动到to页面中, 作为to页面的最大值
            to.cells.shift()
            to.used++
        }

        // 更新所有kv的pcell
        if (to.type > NODE_TYPE_LEAF) {
            this.setChildPcell(to)
        }

        // 2. 把from页面子节点的父节点索引替换成to页面的索引
        if (from.type > NODE_TYPE_LEAF) {
            let childPage = pageMap[beMov.index]
            childPage.dirty = true
            childPage.ocnt++
            childPage.parent = to.index
        }

    }

    remove(kbuf) {
        if (kbuf.compare(rootPage.cells[ORDER_NUM - 1].key) > 0) { // 大于最大值
            winston.error(`key: ${tools.int32le(kbuf)} not found`)
            return false
        }

        let targetPage = this.locateLeaf(kbuf, rootPage) // 目标叶子节点
        let cellIndex = undefined
        for (var i = ORDER_NUM - 1; i >= 0; i--) {
            if (kbuf.compare(targetPage.cells[i].key) == 0) { // 找到位置
                cellIndex = i
                break
            }
        }

        if (cellIndex == undefined) { // 未找到数据
            winston.error(`key：${tools.int32le(kbuf)} not found`)
            return false
        }

        // 开始进行实际的删除操作
        targetPage.dirty = true
        targetPage.ocnt++
        let old = targetPage.cells[ORDER_NUM - 1].key
        targetPage.cells.splice(cellIndex, 1) // 删除从cellIndex下标开始的1个元素
        targetPage.used-- // 减去使用的个数
        if (targetPage.cells.length < ORDER_NUM) { // 删除使数据槽位变少
            let cell = _page.newCell()
            targetPage.cells.splice(0, 0, cell) // 则需要从左侧补充一个
        }

        // 1. 若删除的值是该页的最大值，则需要更新父节点的kv值
        if (cellIndex == ORDER_NUM - 1) {
            let now = targetPage.cells[ORDER_NUM - 1].key
            let ppage = pageMap[targetPage.parent]
            if (now.compare(old) != 0 && targetPage.used > 0) { // 值不一样则更新, 且本页有cell被使用
                this.updateMaxToRoot(ppage, targetPage.pcell, old, now)
            }

            if (targetPage.used == 0) {
                this.appendFreeNode(targetPage.index)
                ppage.cells.splice(targetPage.pcell, 1) // 父节点中cell删除一个
                ppage.used--
                ppage.cells.splice(0, 0, _page.newCell()) // 则需要从左侧补充一个
                this.setChildPcell(ppage)
            }
        }

        // 删除数据后，节点的使用数目小于 MORE_HALF_NUM, 则需要归并或借用
        if (targetPage.used < MORE_HALF_NUM && targetPage.used > 0) {
            let ret = this.mergeOrBorrow(targetPage)
            if (ret.method == "merge") {
                this.merge(targetPage, pageMap[ret.index])
            }
            if (ret.method == "borrow") {
                this.borrow(targetPage, pageMap[ret.index])
            }
            if (ret.method == "shrink") {
                this.shrink(targetPage)
            }
            winston.error(ret);
        }
    }

    async flush() {
        let pageNum = Object.getOwnPropertyNames(pageMap).length // 页数
        for (var index = 0; index < pageNum; index++) {
            var page = pageMap[index]
            if (page.dirty == true) {
                var buff = _page.pageToBuff(page)
                await fileops.writeFile(fileId, buff, 0, PAGE_SIZE, index * PAGE_SIZE)
            }
        }
        await fileops.syncFile(fileId)
    }

    async dump() {
        let pageNum = Object.getOwnPropertyNames(pageMap).length // 页数
        for (var index = 0; index < pageNum; index++) {
            var page = pageMap[index]
            var buff = _page.pageToBuff(page)
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
        await fileops.closeFile(fileId)
    }

}

module.exports = Bptree;
