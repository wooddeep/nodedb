/*
 * Author: lihan@xx.cn
 * History: create at 20211016
 */

const fileops = require("../common/fileops.js")
const StringBuffer = require("stringbuffer");
const winston = require('../winston/config')
const tools = require('../common/tools');
const BitMap = require("../common/bitmap.js")
const Bptree = require("../bptree/bptree.js");
const Pidx = require("../common/index.js")
const Buff = require("../common/buff.js")
const DataPage = require("./page.js")
const path = require('path')

const {
    PAGE_SIZE,
    NODE_TYPE_FREE,
    NODE_TYPE_ROOT,
    NODE_TYPE_DATA,
    START_OFFSET,
    DATA_HEAD_LEN,
} = require("../common/const")

class Table {

    constructor(tableName, columns = undefined, buffSize) {
        this.PAGE_SIZE = PAGE_SIZE
        this.columns = columns
        this.namePrefix = tableName
        this.tableName = `${tableName}.data`
        this.buffSize = buffSize

        this._page = new DataPage()
        this._index = new Bptree(100, PAGE_SIZE, 4, 6) // 主键索引 4: 主键是整形数，6：页索引 + 页内偏移
        this._pidx = new Pidx()
        this._buff = new Buff(this.buffSize, this._pidx)
    }

    async appendFreeNodeById(id) {
        let node = await this._buff.getPageNode(id)
        let firstFreeIndex = this.rootPage.next
        let firstFreePage = await this._buff.getPageNode(firstFreeIndex)
        this.rootPage.next = id
        node.next = firstFreeIndex
        node.prev = firstFreePage.prev
        firstFreePage.prev = id
        //node.type = NODE_TYPE_FREE
        node.dirty = true
    }

    async appendFreeNode(node) {
        let id = node.index
        let firstFreeIndex = this.rootPage.next
        let firstFreePage = await this._buff.getPageNode(firstFreeIndex)
        this.rootPage.next = id
        node.next = firstFreeIndex
        node.prev = firstFreePage.prev
        firstFreePage.prev = id
        //node.type = NODE_TYPE_FREE
        node.dirty = true
    }

    async deleteFreeNode(node) {
        let nextId = node.next
        this.rootPage.next = nextId
        let nextNode = await this._buff.getPageNode(nextId)
        nextNode.prev = node.prev
        nextNode.dirty = true
    }

    async fetchPageNode(type = NODE_TYPE_DATA) {
        // 空闲链表上无节点
        if (this.rootPage == undefined || this.rootPage.next == this.rootPage.prev) {
            let index = this._pidx.newPageIndex()
            let node = this._page.newPage(type)
            node.index = index
            let bitMapSize = Math.ceil(this.rowNum / 8) // 设置bitmap
            let bitmap = new BitMap(bitMapSize)
            node.bitmap = bitmap

            if (type == NODE_TYPE_DATA) {
                node.rowMap = {}
                node.type = type
                await this.appendFreeNode(node) // 初始的节点放入空闲链表
            }

            return node
        }

        // 空闲链表上有节点, 查看节点的bitmap, 如果bitmap还有空闲位, 则不把节点从空闲链表摘除
        let id = this.rootPage.next
        let node = await this._buff.getPageNode(id)
        let bitmap = node.bitmap
        let rowNum = this.rootPage.rowNum

        // 判断bitmap的空位
        let holes = node.bitmap.getHoles(rowNum) // 获取node对应的空洞
        if (holes.length > 0) {
            return node
        }

        // 本来不应出现这个情况, 如果出现这个情况，把该节点删除，并递归处理
        let nextId = node.next
        this.rootPage.next = nextId
        let nextNode = await this._buff.getPageNode(nextId)
        nextNode.prev = node.prev
        nextNode.dirty = true
        node.type = type
        return fetchPageNode(type)
    }

    async drop() {
        try {
            let root = await tools.findRoot(path.dirname(module.filename))
            this.tableName = path.join(root, path.basename(this.tableName))
            let ret = await fileops.unlinkFile(this.tableName)
            await this._index.drop(`${this.namePrefix}.index`)
        } catch (e) {
            winston.info(e)
        }
    }

    async init() {
        let root = await tools.findRoot(path.dirname(module.filename))
        this.tableName = path.join(root, path.basename(this.tableName))
        let exist = await fileops.existFile(this.tableName)
        if (!exist) { // 文件不存在则创建
            await fileops.createFile(this.tableName)
        }

        await this._index.init(`${this.namePrefix}.index`) // 创建索引文件 TOOD 
        this.fileId = await fileops.openFile(this.tableName)
        let stat = await fileops.statFile(this.fileId)
        winston.info("file size = " + stat.size)
        this._pidx.set(Math.floor(stat.size / PAGE_SIZE)) // 数据文件所占的总页数

        if (stat.size < PAGE_SIZE) { // 空文件
            this.rowSize = this.calRowSize(this.columns) // 行大小
            this.rowNum = this.calRowNum(this.rowSize)
            this.rootPage = await this.fetchPageNode(NODE_TYPE_ROOT, this.rowNum)    // 新生成一个根页面
            this.rootPage.index = 0       // index只存在内存中，未持久化，在初始化时添加
            this.rootPage.next = 0        // rootPage的prev和next指向自己，用于空闲链表
            this.rootPage.prev = 0
            this.rootPage.columns = this.columns
            this.rootPage.colNum = this.columns.length // 列数
            this.rootPage.rowSize = this.rowSize
            this.rootPage.rowNum = this.rowNum   // 行数
            await this._buff.setPageNode(0, this.rootPage)
            return this.fileId
        }

        let buff = Buffer.alloc(PAGE_SIZE)
        await fileops.readFile(this.fileId, buff, START_OFFSET, this.PAGE_SIZE, 0) // 文件第一页，始终放置root页
        this.rootPage = await this._page.buffToPage(buff, this.bitMapSize, this.rowSize, this.rowNum, NODE_TYPE_ROOT)
        this.rootPage.index = 0
        await this._buff.setPageNode(0, this.rootPage)
        this.columns = this.rootPage.columns
        this.rowSize = this.rootPage.rowSize
        this.rowNum = this.rootPage.rowNum
        this.bitMapSize = Math.ceil(this.rowNum / 8)

        let minSize = this.buffSize * this.PAGE_SIZE > stat.size ? stat.size : this.buffSize * this.PAGE_SIZE
        for (var index = this.PAGE_SIZE; index < minSize; index += this.PAGE_SIZE) {
            await fileops.readFile(this.fileId, buff, START_OFFSET, this.PAGE_SIZE, index) // 非root页
            let pageNode = this._page.buffToPage(buff, this.bitMapSize, this.rowSize, this.rowNum, NODE_TYPE_DATA) // TODO
            let pageIndex = Math.floor(index / this.PAGE_SIZE)
            pageNode.index = pageIndex
            await this._buff.setPageNode(pageIndex, pageNode)
        }

        return this.fileId
    }

    async insert(row) {
        // 1. 先查看空闲链表上，是否有页
        let page = await this.fetchPageNode(NODE_TYPE_DATA)
        page.bitMapSize = Math.ceil(this.rootPage.rowNum / 8)
        page.rowSize = this.rootPage.rowSize
        let holes = page.bitmap.getHoles(this.rowNum)
        let hole = holes[0]
        let byteIndex = hole[0]
        let bitIndex = hole[1]
        let slot = byteIndex * 8 + bitIndex

        let rowBuff = Buffer.alloc(this.rootPage.rowSize)
        let offset = 0
        for (var ci = 0; ci < this.columns.length; ci++) {
            let column = this.columns[ci]
            if (column.type == 0) { // 0 ~ int, 1 ~ float, 2 ~ string
                rowBuff.writeUInt32LE(row[ci], offset)
                offset += 4
            } else if (column.type == 1) {
                rowBuff.writeFloatLE(row[ci], offset)
                offset += 4
            } else if (column.type == 2) {
                rowBuff.write(row[ci], offset)
                offset += column.typeAux
            }
        }

        page.rowMap[slot] = rowBuff
        page.bitmap.fillHole(slot)

        // 2. 已无空位, 则需要从空闲链表里面摘除
        if (holes.length == 1) {
            await this.deleteFreeNode(page)
        }

        this._buff.setPageNode(page.index, page)

        // 3. 创建索引值
        let index = Buffer.alloc(6)
        index.writeUInt32LE(page.index, 0) // 页索引
        index.writeUInt16LE(slot, 4) // 页内偏移
        let kbuf = tools.buffer(row[0])
        await this._index.insert(kbuf, index) // TODO 暂时以第一列为主键，创建索引
    }


    async selectById(key) {
        let kbuf = tools.buffer(key)
        let value = await this._index.select(kbuf)

        let pageIndex = value.readUInt32LE()
        let slotIndex = value.readUInt16LE(4)

        winston.info(`## pageIndex = ${pageIndex}, slotIndex= ${slotIndex}`)

        let page = await this._buff.getPageNode(pageIndex)
        let row = page.getRow(slotIndex)

        return row
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
        await this._index.flush()
    }

    async close() {
        await fileops.closeFile(this.fileId)
    }

    /*
     * 根据数据表列的定义，计算每行数据的大小
     */
    calRowSize(columns) {
        let size = 0
        for (var i = 0; i < columns.length; i++) {
            size += columns[i].size()
        }
        return size
    }

    /*
     * 根据数据表每行数据的大小，计算数据页中最大的数据行数
     */
    calRowNum(rowSize) {
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

    // +------------------------+
    // | Tables_in_phpmyadmin   |
    // +------------------------+
    // | pma__bookmark          |
    // | pma__central_columns   |
    // | pma__column_info       |
    // | pma__designer_settings |
    // +------------------------+
    async showTables() {
        let root = await tools.findRoot(path.dirname(module.filename))
        let files = await tools.readfile(root)
        let names = files.map(obj => obj.name)
        let nset = new Set(names)
        let out = names.filter(name => name.search(".data") > 0)
            .filter(name => nset.has(name.replace(".data", ".index")))
            .map(name => [name.replace(".data", "")])

        return tools.tableDisplayData(["Tables"], out)
    }

    // +-----------+-------------+------+-----+---------+-------+
    // | Field     | Type        | Null | Key | Default | Extra |
    // +-----------+-------------+------+-----+---------+-------+
    // | username  | varchar(64) | NO   | PRI | NULL    |       |
    // | usergroup | varchar(64) | NO   | PRI | NULL    |       |
    // +-----------+-------------+------+-----+---------+-------+
    // 2 rows in set (0.00 sec)
    async descTable(tbname) {
        let root = await tools.findRoot(path.dirname(module.filename))
        let file = path.join(root, `${tbname}.data`)
        let exist = await fileops.existFile(file)
        if (!exist) {
            throw new Error(`table [${tbname}] not existed!`)
        }

        let fileId = await fileops.openFile(file)
        let page = new DataPage()
        let buff = Buffer.alloc(PAGE_SIZE)
        await fileops.readFile(fileId, buff, START_OFFSET, PAGE_SIZE, 0)
        let rootPage = page.buffToPage(buff, undefined, undefined, undefined, NODE_TYPE_ROOT)
        let columns = rootPage.columns

        let header = ['Field', 'Type', 'Key']
        let rows = []
        for (var i = 0; i < columns.length; i++) {
            let row = []
            let column = columns[i]
            row.push(column.name.toString().replace(/^[\s\uFEFF\xA0\0]+|[\s\uFEFF\xA0\0]+$/g, ""))
            row.push(columns[i].getType())
            row.push(columns[i].getKeyType())
            rows.push(row)
        }

        return tools.tableDisplayData(header, rows)
    }

}

module.exports = Table