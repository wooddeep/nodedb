const winston = require('./winston/config')

class Buffer {

    constructor(size) {
        this.size = size
    }

    addPageNode(page) {
        let index = page.index
        let csize = Object.getOwnPropertyNames(Buffer.map).length // 当前使用的长度
        winston.error(`length = ${csize}`)
        
        if (csize == this.size) { // 根据LRU算法, 移除不常用的page节点，再插入
            let toDelIndex = Object.keys(Buffer.map).sort((a, b) => { return Buffer.map[a].ocnt - Buffer.map[b].ocnt; })[0];
            let toDelPage = Buffer.map(toDelIndex);
            if (toDelPage.dirty == true) {
                // TODO 数据写入文件
            }

            
        }
        Buffer.map[index] = page // 存储节点
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