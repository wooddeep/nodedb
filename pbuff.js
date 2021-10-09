const winston = require('./winston/config')
const fileops = require('./fileops')
const Pidx = require('./pidx')
var Page = require('./page.js')
const _page = new Page() // 默认构造函数

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

class PageBuff {

    constructor(size) {
        this.size = size
    }

    setFileId(fd) {
        this.fd = fd
    }

    delPageNode(index) {

    }

    async getPageNode(index, inuse = true, dirty = false) {

        if (index < 0) return undefined

        if (index >= Pidx.get()) return undefined

        let target = PageBuff.map[index]
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

        return target
    }

    async setPageNode(index, page) {
        PageBuff.map[index] = page

        let size = Object.getOwnPropertyNames(PageBuff.map).length
        if (size > this.size) { 
            let nouse = Object.keys(PageBuff.map).filter(x => x != 0).filter(x => PageBuff.map[x].inuse == false)
            //winston.error(`# nouse = ${nouse}`)
            if (nouse.length > 0) {
                let page = PageBuff.map[nouse[0]]
                winston.error(`## save index: ${page.index}!`)
                var buff = _page.pageToBuff(page)
                await fileops.writeFile(this.fd, buff, 0, PAGE_SIZE, page.index * PAGE_SIZE)
                delete PageBuff.map[nouse[0]]
            } else {
                winston.error("@@@@ buff size is insufficent!")
                this.size++
            }
        }

    }

    static buffSize() {
        return Object.getOwnPropertyNames(PageBuff.map).length
    }

}


PageBuff.map = {}; // 静态变量
module.exports = PageBuff;