const winston = require('../winston/config')
const fileops = require('../common/fileops')
var Page = require('./page.js')
const _page = new Page() // 默认构造函数

const {
    START_OFFSET,
    PAGE_SIZE,
    ORDER_NUM,
} = require("../common/const.js")

class PageBuff {

    constructor(size, pidx) {
        this.size = size
        this.pidx = pidx
        this.map = {}
        this.id = 0
    }

    setFileId(fd) {
        this.fd = fd
    }

    async getPageNode(index, inuse = true, dirty = false) {

        if (index < 0) return undefined

        if (index >= this.pidx.get()) return undefined

        let target = this.map[index]
        if (target == undefined) { // 没有找到目标页
            let buff = Buffer.alloc(PAGE_SIZE)
            await fileops.readFile(this.fd, buff, START_OFFSET, PAGE_SIZE, PAGE_SIZE * index) // 读目标页
            let pageNode = _page.buffToPage(buff)
            pageNode.index = index
            await this.setPageNode(index, pageNode) // 目标页加入缓存
            target = pageNode
        }

        if (target != undefined) {
            target.inuse = inuse
            target.dirty = dirty
        }

        target.ts = this.id
        this.id++

        return target
    }

    async setPageNode(index, page) {
        this.map[index] = page
        page.ts = this.id
        this.id++
        
        let size = Object.getOwnPropertyNames(this.map).length
        if (size > this.size) {
            // //let nouse = Object.keys(this.map).filter(x => x != 0).filter(x => this.map[x].inuse == false)
            // let nouse = Object.keys(this.map).filter(x => x != 0).filter(x => this.map[x].inuse == false)
            // //winston.error(`# nouse = ${nouse}`)
            // if (nouse.length > 0) {
            //     let page = this.map[nouse[0]]
            //     //winston.error(`## save index: ${page.index}!`)
            //     var buff = _page.pageToBuff(page)
            //     await fileops.writeFile(this.fd, buff, 0, PAGE_SIZE, page.index * PAGE_SIZE)
            //     delete this.map[nouse[0]]
            // } else {
            //     winston.error("@@@@ buff size is insufficent!")
            //     this.size++
            // }

            let array = Object.keys(this.map).filter(x => x != 0).filter(x => this.map[x].index != index)
                .filter(x => this.map[x].used <= ORDER_NUM)

            if (array.length > 0) {
                let toDelIndex = array.sort((a, b) => { return this.map[a].ts - this.map[b].ts; })[0];
                let page = this.map[toDelIndex]
                var buff = _page.pageToBuff(page)
                await fileops.writeFile(this.fd, buff, 0, PAGE_SIZE, page.index * PAGE_SIZE)
                delete this.map[toDelIndex]
            } else {
                winston.error("@@@@ buff size is insufficent!")
                this.size++
            }

        }

    }

    buffSize() {
        return Object.getOwnPropertyNames(this.map).length
    }

}


//PageBuff.map = {}; // 静态变量
module.exports = PageBuff;