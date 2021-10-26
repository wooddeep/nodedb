/*
 * Author: lihan@xx.cn
 * History: create at 20210811
 */

const {
    CELL_OFFSET,
    VAL_TYPE_LEN,
    PAGE_TYPE_OFFSET,
    PAGE_PARENT_OFFSET,
    PAGE_NEXT_OFFSET,
    PAGE_PREV_OFFSET,
    PARENT_CELL_OFFSET,
    CELL_USED_OFFSET,
    VAL_TYPE_IDX,
    VAL_TYPE_NUM,
    VAL_TYPE_STR,
    VAL_TYPE_FPN,
    VAL_TYPE_OBJ,
    VAL_IDX_LEN,
} = require("../common/const.js");

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
    }

    attach(bptree) {
        this.bptree = bptree
    }

    // 静态函数
    static sayHello(name) {
        return 'Hello, ' + name;
    }

    valueTrans(value, type) {
        if (type == VAL_TYPE_IDX) {
            return value

        } else {
            let buff = Buffer.alloc(this.bptree.VAL_IDX_LEN)
            if (type == VAL_TYPE_NUM) {
                buff.writeInt32LE(value) // TODO 区分 整形 和 浮点型
            }
            if (type == VAL_TYPE_FPN) {
                buff.writeFloatLE(value) // TODO 区分 整形 和 浮点型
            }
            if (type == VAL_TYPE_STR) {
                buff.write(value)
            }
            if (type == VAL_TYPE_OBJ) {
                value.copy(buff, 0, 0, VAL_IDX_LEN)
            }
            return buff
        }
    }

    valueToBuff(value, type) {
        let buff = Buffer.alloc(this.bptree.VAL_IDX_LEN)

        if (type == VAL_TYPE_IDX) {
            buff.writeInt32LE(value)
        } else {
            value.copy(buff, 0, 0, this.bptree.VAL_IDX_LEN)
        }

        return buff
    }

    buffTrans(type, buff, offset) {
        if (type == VAL_TYPE_IDX) {
            return buff.readInt32LE(offset)

        } else {
            let strBuff = Buffer.alloc(this.bptree.VAL_IDX_LEN)
            buff.copy(strBuff, 0, offset)
            return strBuff
        }
    }

    newCell(keyBuf = undefined, value = 0, type = VAL_TYPE_IDX) {
        if (keyBuf == undefined) {
            keyBuf = Buffer.alloc(this.bptree.KEY_MAX_LEN)
        }

        let buffer = Buffer.alloc(this.bptree.KEY_MAX_LEN)
        keyBuf.copy(buffer, 0, 0, this.bptree.KEY_MAX_LEN)

        return {
            key: buffer,
            type: type,
            index: this.valueTrans(value, type) /*value*/,
        }
    }

    copyCell(source) {
        let buffer = Buffer.alloc(this.bptree.KEY_MAX_LEN)
        source.key.copy(buffer, 0, 0, this.bptree.KEY_MAX_LEN)
        return {
            key: buffer,
            type: source.type,
            index: source.index,
        }
    }

    buffToCell(buf) {
        var key = Buffer.alloc(this.bptree.KEY_MAX_LEN)
        buf.copy(key, 0, 0, this.bptree.KEY_MAX_LEN)
        var type = buf.readInt8(this.bptree.KEY_MAX_LEN)
        var index = this.buffTrans(type, buf, this.bptree.KEY_MAX_LEN + VAL_TYPE_LEN)
        return {
            key: key,
            type: type,
            index: index,
        }
    }

    cellToBuff(cell) {
        var buff = Buffer.alloc(this.bptree.CELL_LEN)
        cell.key.copy(buff, 0, 0, this.bptree.KEY_MAX_LEN) // 键值
        buff.writeInt8(cell.type, this.bptree.KEY_MAX_LEN) // 值类型
        let valBuff = this.valueToBuff(cell.index, cell.type)
        // buf.copy(targetBuffer[, targetStart[, sourceStart[, sourceEnd]]])
        valBuff.copy(buff, this.bptree.KEY_MAX_LEN + VAL_TYPE_LEN, 0, this.bptree.VAL_IDX_LEN)

        return buff
    }

    newPage(type) {
        var cells = []
        for (var index = 0; index < this.bptree.ORDER_NUM; index++) {
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

        for (var index = 0; index < this.bptree.ORDER_NUM; index++) {
            target.cells[index] = this.copyCell(source.cells[index])
        }
    }

    pageToBuff(page) {
        let buff = Buffer.alloc(this.bptree.PAGE_SIZE)
        buff.writeInt32LE(page.type, PAGE_TYPE_OFFSET)
        buff.writeInt32LE(page.parent, PAGE_PARENT_OFFSET)
        buff.writeInt32LE(page.next, PAGE_NEXT_OFFSET)
        buff.writeInt32LE(page.prev, PAGE_PREV_OFFSET)
        buff.writeInt16LE(page.pcell, PARENT_CELL_OFFSET)
        buff.writeInt16LE(page.used, CELL_USED_OFFSET)
        var cellStart = CELL_OFFSET
        var cellLength = this.bptree.CELL_LEN

        // buf.copy(targetBuffer[, targetStart[, sourceStart[, sourceEnd]]])
        var cells = page.cells
        for (var ci = 0; ci < this.bptree.ORDER_NUM; ci++) {
            let cellBuff = this.cellToBuff(cells[ci])
            cellBuff.copy(buff, cellStart + ci * cellLength, 0, cellLength)
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
        var cellLength = this.bptree.CELL_LEN

        var cells = []
        for (var index = 0; index < this.bptree.ORDER_NUM; index++) {
            var cellBuff = Buffer.alloc(this.bptree.CELL_LEN)
            buf.copy(cellBuff, 0, cellStart + index * cellLength, cellStart + (index + 1) * cellLength)
            var cell = this.buffToCell(cellBuff)
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

}

module.exports = Page;
