const winston = require('./winston/config')

class PageBuff {

    constructor(size) {
        this.size = size
    }

    addPageNode(index, page) {
        // let index = page.index
        // let csize = Object.getOwnPropertyNames(PageBuff.map).length // 当前使用的长度
        // winston.error(`length = ${csize}`)

        // if (csize == this.size) { // 根据LRU算法, 移除不常用的page节点，再插入
        //     let toDelIndex = Object.keys(PageBuff.map).sort((a, b) => { return PageBuff.map[a].ocnt - PageBuff.map[b].ocnt; })[0];
        //     let toDelPage = PageBuff.map(toDelIndex);
        //     if (toDelPage.dirty == true) {
        //         // TODO 数据写入文件
        //     }


        // }
        // PageBuff.map[index] = page // 存储节点
        PageBuff.map[index] = page
    }

    delPageNode(index) {

    }

    getPageNode(index) {
        return PageBuff.map[index]
    }

    setPageNode(index, page) {
        PageBuff.map[index] = page
    }

}


PageBuff.map = {}; // 静态变量
module.exports = PageBuff;