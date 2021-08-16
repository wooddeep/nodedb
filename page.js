/*
 * Author: lihan@migu.cn
 * History: create at 20210811
 */

const constant = require("./const.js");

function newPage() {
    return {
        parent: 0,         // 父节点
        next: 0,           // 兄节点
        prev: 0,           // 弟节点 
    }
}

function parseBuff(buf) {
    var parent = buf.readInt32LE(0)
    var next = buf.readInt32LE(constant.PAGE_PARENT_IDX_LEN)
    var prev = buf.readInt32LE(constant.PAGE_PARENT_IDX_LEN + constant.PAGE_PREV_IDX_LEN)
    return {
        parent: parent,
        next: next,
        prev: prev,
    }
}


var page = {
    index: 0,          // 所属页编号, 存储在内存中, 无需持久化
    parent: 0,         // 父节点
    next: 0,           // 兄节点
    prev: 0,           // 弟节点
    newPage: newPage,
    parseBuff: parseBuff,
}



module.exports = page;