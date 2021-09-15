const winston = require('./winston/config')

class Buffer {

    constructor(size) {
        this.size = size
    }

    addPageNode(page) {
        let index = page.index
        let csize = Object.getOwnPropertyNames(Buffer.map).length
        if (csize < this.size) {
            Buffer.map[index] = page // 存储节点
        } else { // 根据LRU算法, 移除不常用的page节点，再插入
            winston.error(`length = ${csize}`)
        } 
    }

    delPageNode(index) {

    }

    getPageNode(index) {

    }

    setPageNode(page) {

    }

}


Buffer.map = {}; // 静态变量
module.exports = Buffer;