/*
 * Author: lihan@xx.cn
 * History: create at 20210811
 */

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
    PAGE_TYPE_OFFSET,
    PAGE_PARENT_OFFSET,
    PAGE_NEXT_OFFSET,
    PAGE_PREV_OFFSET,
    PARENT_CELL_OFFSET,
    CELL_USED_OFFSET,
    VAL_IDX_LEN,
} = require("./const.js");

class Page {

    // 构造方法
    constructor(
        index,
        type,
        parent,
        next,
        prev,
        pcell,
        used,
        ocnt,
        cells,
        inuse = true
    ) {
        this.index = index
        this.type = type
        this.parent = parent
        this.next = next
        this.prev = prev
        this.pcell = pcell
        this.used = used
        this.ocnt = ocnt
        this.cells = cells
        this.inuse = inuse
    }

    // 静态函数
    static sayHello(name) {
        return 'Hello, ' + name;
    }

    newCell(keyBuf = undefined, value = 0) {
        if (keyBuf == undefined) {
            keyBuf = Buffer.alloc(KEY_MAX_LEN)
        }

        let buffer = Buffer.alloc(KEY_MAX_LEN)
        keyBuf.copy(buffer, 0, 0, KEY_MAX_LEN)

        return {
            key: buffer,
            index: value,
        }
    }

    copyCell(source) {
        let buffer = Buffer.alloc(KEY_MAX_LEN)
        source.key.copy(buffer, 0, 0, KEY_MAX_LEN)
        return {
            key: buffer,
            index: source.index,
        }
    }

    parseCell(buf) {
        var key = Buffer.alloc(KEY_MAX_LEN)
        buf.copy(key, 0, 0, KEY_MAX_LEN)
        var index = buf.readInt32LE(KEY_MAX_LEN)
        return {
            key: key,
            index: index,
        }
    }

    newPage(type) {
        var cells = []
        for (var index = 0; index < ORDER_NUM; index++) {
            var cell = this.newCell()
            cells.push(cell)
        }

        return new Page(
            -1,
            type,
            -1,
            -1,
            -1,
            -1,
            0,
            0,
            cells,
            true
        )
    }

    copyPage(target, source) {
        target.type = source.type
        target.parent = source.parent
        target.next = source.next
        target.prev = source.prev
        target.pcell = source.pcell
        target.used = source.used

        for (var index = 0; index < ORDER_NUM; index++) {
            target.cells[index] = this.copyCell(source.cells[index])
        }
    }

    pageToBuff(page) {
        let buff = Buffer.alloc(PAGE_SIZE)
        buff.writeInt32LE(page.type, PAGE_TYPE_OFFSET)
        buff.writeInt32LE(page.parent, PAGE_PARENT_OFFSET)
        buff.writeInt32LE(page.next, PAGE_NEXT_OFFSET)
        buff.writeInt32LE(page.prev, PAGE_PREV_OFFSET)
        buff.writeInt16LE(page.pcell, PARENT_CELL_OFFSET)
        buff.writeInt16LE(page.used, CELL_USED_OFFSET)
        var cellStart = CELL_OFFSET
        var cellLength = CELL_LEN

        // buf.copy(targetBuffer[, targetStart[, sourceStart[, sourceEnd]]])
        var cells = page.cells
        for (var ci = 0; ci < ORDER_NUM; ci++) {
            cells[ci].key.copy(buff, cellStart + ci * cellLength, 0, KEY_MAX_LEN) // 键值
            buff.writeInt32LE(cells[ci].index, cellStart + ci * cellLength + KEY_MAX_LEN) // 子节点索引值
        }

        return buff
    }

    buffToPage(buf) {
        var type = buf.readInt32LE(PAGE_TYPE_OFFSET)
        var parent = buf.readInt32LE(PAGE_PARENT_OFFSET)
        var next = buf.readInt32LE(PAGE_NEXT_OFFSET)
        var prev = buf.readInt32LE(PAGE_PREV_OFFSET)
        var pcell = buf.readInt16LE(PARENT_CELL_OFFSET)
        var used = buf.readInt16LE(CELL_USED_OFFSET) // 已经使用的cell
        var cellStart = CELL_OFFSET
        var cellLength = CELL_LEN

        var cells = []
        for (var index = 0; index < ORDER_NUM; index++) {
            var cellBuff = Buffer.alloc(CELL_LEN)
            buf.copy(cellBuff, 0, cellStart + index * cellLength, cellStart + (index + 1) * cellLength)
            var cell = this.parseCell(cellBuff)
            cells.push(cell)
        }

        return new Page(
            -1,
            type,
            parent,
            next,
            prev,
            pcell,
            used,
            0,
            cells,
            true
        )
    }

    occupy() {
        this.inuse++
    }

    release() {
        this.inuse--
    }
}

module.exports = Page;
