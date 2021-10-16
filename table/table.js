/*
 * Author: lihan@xx.cn
 * History: create at 20211016
 */

const fileops = require("../common/fileops.js")
const winston = require('../winston/config')

const {
    PAGE_SIZE
} = require("../common/const")

class Table {

    async constructor(tableName, columns, buffSize) {

        this.columns = columns
        this.tableName = tableName
        this.fileId = await fileops.openFile(this.tableName)
        this.buffSize = buffSize

        this._pidx = new Pidx()
        this._buff = new Buff(this.buffSize, this._pidx)

        let stat = await fileops.statFile(this.fileId)
        winston.info("file size = " + stat.size)
        this._pidx.set(Math.floor(stat.size / PAGE_SIZE)) // 数据文件所占的总页数

        if (stat.size < PAGE_SIZE) { // 空文件
            this.rootPage = await this.fetchPageNode(NODE_TYPE_ROOT)  // 数据文件的头结点
            await this._buff.setPageNode(0, this.rootPage)
            return this.fileId
        }
    }

    header() {
        for (var i = 0; i < this.columns.length; i++) {

        }
    }
}

module.exports = Table