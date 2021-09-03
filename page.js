/*
 * Author: lihan@xx.cn
 * History: create at 20210811
 */

const {
    START_OFFSET,
    KEY_MAX_LEN,
    KEY_IDX_LEN,
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
    CELL_USED_OFFSET,
} = require("./const.js");

const winston = require('./winston/config')

class Page {

    // 构造方法
    constructor(name, age) {
        this.name = name;
        this.age = age;
    }

    // 静态函数
    static sayHello(name) {
        this.para = name;         //修改静态变量
        return 'Hello, ' + name;
    }
    
    newCell(keyBuf = undefined, value = 0, keyIdx = -1) {
        if (keyBuf == undefined) {
            keyBuf = Buffer.alloc(KEY_MAX_LEN)
        }
        return {
            key: keyBuf,
            keyIdx: keyIdx,   // 在父节点中的cells中的下标
            index: value,
        }
    }

    parseCell(buf) {
        var key = Buffer.alloc(KEY_MAX_LEN)
        buf.copy(key, 0, 0, KEY_MAX_LEN)
        var keyIdx = buf.readInt32LE(KEY_MAX_LEN) 
        var index = buf.readInt32LE(KEY_MAX_LEN + KEY_IDX_LEN)
        return {
            key: key,
            keyIdx: keyIdx,   // 在父节点中的cells中的下标
            index: index,
        }
    }

    setKeyInCell(page, cellIndex) {
        for (var i = ORDER_NUM - 1; i >= ORDER_NUM - 1 - page.used; i--) {
            page.cells[i].keyIdx = cellIndex
        }
    }

    newPage(type) {
        var cells = []
        for (var index = 0; index < ORDER_NUM; index++) {
            var cell = this.newCell()
            cells.push(cell)
        }

        return {
            type: type,        // 页类型：2 ~ 根, 1 ~ 中间节点, 0 ~ 叶子节点
            parent: -1,         // 父节点
            next: -1,           // 兄节点
            prev: -1,           // 弟节点 
            used: 0,
            cells: cells,
        }
    }

    copyPage(target, source) {
        target.type = source.type
        target.parent = source.parent
        target.next = source.next
        target.prev = source.prev
        target.used = source.used

        for (var index = 0; index < ORDER_NUM; index++) {
            target.cells[index] = source.cells[index]
        }
    }

    pageToBuff(page) {
        let buff = Buffer.alloc(PAGE_SIZE)
        buff.writeInt32LE(page.type, PAGE_TYPE_OFFSET)
        buff.writeInt32LE(page.parent, PAGE_PARENT_OFFSET)
        buff.writeInt32LE(page.next, PAGE_NEXT_OFFSET)
        buff.writeInt32LE(page.prev, PAGE_PREV_OFFSET)
        buff.writeInt32LE(page.used, CELL_USED_OFFSET)

        // buf.copy(targetBuffer[, targetStart[, sourceStart[, sourceEnd]]])
        var cells = page.cells
        for (var ci = 0; ci < ORDER_NUM; ci++) {
            cells[ci].key.copy(buff, CELL_OFFSET + ci * CELL_LEN, 0, KEY_MAX_LEN) // 键值
            buff.writeInt32LE(cells[ci].keyIdx, CELL_OFFSET + ci * CELL_LEN + KEY_MAX_LEN) // 在父节点中的cells中的下标
            buff.writeInt32LE(cells[ci].index, CELL_OFFSET + ci * CELL_LEN + (KEY_MAX_LEN + KEY_IDX_LEN)) // 子节点索引值
        }

        return buff
    }

    buffToPage(buf) {
        var type = buf.readInt32LE(PAGE_TYPE_OFFSET)
        var parent = buf.readInt32LE(PAGE_PARENT_OFFSET)
        var next = buf.readInt32LE(PAGE_NEXT_OFFSET)
        var prev = buf.readInt32LE(PAGE_PREV_OFFSET)
        var used = buf.readInt32LE(CELL_USED_OFFSET) // 已经使用的cell

        var cells = []
        for (var index = 0; index < ORDER_NUM; index++) {
            var cellBuff = Buffer.alloc(CELL_LEN)
            buf.copy(cellBuff, 0, CELL_OFFSET + index * CELL_LEN, CELL_OFFSET + (index + 1) * CELL_LEN)
            var cell = this.parseCell(cellBuff)
            cells.push(cell)
        }

        return {
            type: type,
            parent: parent,
            next: next,
            prev: prev,
            used: used,
            cells: cells
        }
    }
}

// 静态变量
Page.para = 'lee';
module.exports = Page;
