/*
 * Author: lihan@xx.cn
 * History: create at 20211016
 */

const fileops = require("../common/fileops.js")
const winston = require('../winston/config')
const Bptree = require("../bptree/bptree.js");
const Pidx = require("../common/index.js")
const Buff = require("../common/buff.js")
const DataPage = require("./page.js")

const {
    PAGE_SIZE,
    NODE_TYPE_FREE,
    NODE_TYPE_ROOT,
    START_OFFSET,
    DATA_HEAD_LEN
} = require("../common/const")

class Table {

    constructor(tableName, columns, buffSize) {
        this.PAGE_SIZE = PAGE_SIZE
        this.columns = columns
        this.tableName = tableName
        this.buffSize = buffSize

        this._page = new DataPage()
        this._index = new Bptree() // 主键索引
        this._pidx = new Pidx()
        this._buff = new Buff(this.buffSize, this._pidx)
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
            let index = this._pidx.newPageIndex()
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

    async drop(name) {
        try {
            let ret = await fileops.unlinkFile(name)
        } catch (e) {
            winston.info(e)
        }
    }

    async init() {
        let exist = await fileops.existFile(this.tableName)
        if (!exist) { // 文件不存在则创建
            await fileops.createFile(this.tableName)
        }

        this.fileId = await fileops.openFile(this.tableName)
        let stat = await fileops.statFile(this.fileId)
        winston.info("file size = " + stat.size)
        this._pidx.set(Math.floor(stat.size / PAGE_SIZE)) // 数据文件所占的总页数

        if (stat.size < PAGE_SIZE) { // 空文件
            this.rootPage = await this.fetchPageNode(NODE_TYPE_ROOT)    // 新生成一个根页面
            this.rootPage.index = 0       // index只存在内存中，未持久化，在初始化时添加
            this.rootPage.next = 0        // rootPage的prev和next指向自己，用于空闲链表
            this.rootPage.prev = 0
            this.rootPage.columns = this.columns
            this.rootPage.colNum = this.columns.length // 列数
            this.rootPage.rowSize = this.rowSize(this.rootPage.columns) // 行大小
            this.rootPage.rowNum = this.rowNum(this.rootPage.rowSize)   // 行数
            await this._buff.setPageNode(0, this.rootPage)
            return this.fileId
        }

        let buff = Buffer.alloc(PAGE_SIZE)
        await fileops.readFile(this.fileId, buff, START_OFFSET, this.PAGE_SIZE, 0) // 文件第一页，始终放置root页
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

    async insert(row) {

    }

    async flush() {
        let pageNum = this._pidx.get() // 页数
        for (var index = 0; index < pageNum; index++) {
            var page = await this._buff.getPageNode(index, true)
            if (page != undefined && page.dirty == true) {
                let buff = page.pageToBuff()
                await fileops.writeFile(this.fileId, buff, 0, this.PAGE_SIZE, index * this.PAGE_SIZE)
            }
        }
        await fileops.syncFile(this.fileId)
    }

    async close() {
        await fileops.closeFile(this.fileId)
    }

    /*
     * 根据数据表列的定义，计算每行数据的大小
     */
    rowSize(columns) {
        let size = 0
        for (var i = 0; i < columns.length; i++) {
            size += columns[i].size()
        }
        return size
    }

    /*
     * 根据数据表每行数据的大小，计算数据页中最大的数据行数
     */
    rowNum(rowSize) {
        let num = Math.floor(8 * (PAGE_SIZE - DATA_HEAD_LEN) / (1 + 8 * rowSize))
        let bitMapSize = Math.ceil(num / 8)
        if (DATA_HEAD_LEN + bitMapSize + rowSize * num > PAGE_SIZE) {
            bitMapSize = bitMapSize - 1
        }
        return Math.min(num, 8 * bitMapSize)
    }

    header() {
        for (var i = 0; i < this.columns.length; i++) {

        }
    }
}

module.exports = Table