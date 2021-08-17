/*
 * Author: lihan@migu.cn
 * History: create at 20210811
 */

const KEY_MAX_LEN = 10 // 键值最大长度
const VAL_IDX_LEN = 4  // 值页索引长度, 如果中间节点指向子页面, 叶子节点指向值
const PAGE_SIZE = 64 // 页大小
const PAGE_PARENT_IDX_LEN = 4
const PAGE_PREV_IDX_LEN = 4
const PAGE_NEXT_IDX_LEN = 4
const PAGE_TYPE_LEN = 4
const CELL_USED_LEN = 4

const ORDER_NUM = Math.floor((PAGE_SIZE - PAGE_TYPE_LEN - PAGE_PARENT_IDX_LEN - CELL_USED_LEN -
    PAGE_PREV_IDX_LEN - PAGE_NEXT_IDX_LEN) / (KEY_MAX_LEN + VAL_IDX_LEN)) // b+树的阶

const LESS_HALF_NUM = Math.floor(ORDER_NUM / 2)  // 少的一半
const MORE_HALF_NUM = Math.ceil(ORDER_NUM / 2) // 多的一半
const CELL_LEN = KEY_MAX_LEN + VAL_IDX_LEN
const CELL_START = PAGE_PARENT_IDX_LEN + PAGE_PREV_IDX_LEN + PAGE_NEXT_IDX_LEN + PAGE_TYPE_LEN + CELL_USED_LEN
const OFFSET_START = 0   // 其实偏移量

var constant = {
    KEY_MAX_LEN: KEY_MAX_LEN,
    VAL_IDX_LEN: VAL_IDX_LEN,
    PAGE_SIZE: PAGE_SIZE,
    LESS_HALF_NUM: LESS_HALF_NUM,
    MORE_HALF_NUM: MORE_HALF_NUM,
    ORDER_NUM: ORDER_NUM,
    PAGE_PARENT_IDX_LEN, PAGE_PARENT_IDX_LEN,
    PAGE_PREV_IDX_LEN, PAGE_PREV_IDX_LEN,
    PAGE_NEXT_IDX_LEN, PAGE_NEXT_IDX_LEN,
    CELL_LEN, CELL_LEN,
    CELL_START, CELL_START
}

module.exports = constant;