/*
 * Author: lihan@xx.cn
 * History: create at 20210811
 */

const PAGE_SIZE = 64     // 页大小
const START_OFFSET = 0   // 起始偏移量
const KEY_MAX_LEN = 6    // 键值最大长度
const KEY_IDX_LEN = 4    // 键值在父节点的cells中的下标
const VAL_IDX_LEN = 4    // 值页索引长度, 如果中间节点指向子页面, 叶子节点指向值

const PAGE_TYPE_LEN = 4       // 代表类型的字节数
const PAGE_PARENT_IDX_LEN = 4 // 代码父节点索引的字节数
const PAGE_NEXT_IDX_LEN = 4   // 代码兄节点索引的字节数
const PAGE_PREV_IDX_LEN = 4   // 代码弟节点索引的字节数
const CELL_USED_LEN = 4       // 代码使用键值数的字节数

const PAGE_TYPE_OFFSET = 0    // 页类型页内偏移
const PAGE_PARENT_OFFSET = PAGE_TYPE_OFFSET + PAGE_TYPE_LEN       // 页类型页内偏移
const PAGE_NEXT_OFFSET = PAGE_PARENT_OFFSET + PAGE_PARENT_IDX_LEN // 父索引页内偏移
const PAGE_PREV_OFFSET = PAGE_NEXT_OFFSET + PAGE_NEXT_IDX_LEN     // 兄索引页内偏移
const CELL_USED_OFFSET = PAGE_PREV_OFFSET + PAGE_PREV_IDX_LEN     // 弟索引页内偏移
const CELL_OFFSET = CELL_USED_OFFSET + CELL_USED_LEN              // 存KV值的页内偏移
const HEAD_LEN = CELL_OFFSET  

const CELL_LEN = KEY_MAX_LEN + KEY_IDX_LEN + VAL_IDX_LEN          // 每一对KV的长度

const ORDER_NUM = Math.floor((PAGE_SIZE - HEAD_LEN) / CELL_LEN)   // b+树的阶
const LESS_HALF_NUM = Math.floor(ORDER_NUM / 2)  // 少的一半
const MORE_HALF_NUM = Math.ceil(ORDER_NUM / 2)   // 多的一半

const NODE_TYPE_LEAF = 0 // 叶结点
const NODE_TYPE_STEM = 1 // 茎节点
const NODE_TYPE_ROOT = 2 // 根节点

var constant = {
    KEY_MAX_LEN: KEY_MAX_LEN,
    KEY_IDX_LEN: KEY_IDX_LEN,
    VAL_IDX_LEN: VAL_IDX_LEN,
    PAGE_SIZE: PAGE_SIZE,
    LESS_HALF_NUM: LESS_HALF_NUM,
    MORE_HALF_NUM: MORE_HALF_NUM,
    ORDER_NUM: ORDER_NUM,
    PAGE_PARENT_IDX_LEN: PAGE_PARENT_IDX_LEN,
    PAGE_PREV_IDX_LEN: PAGE_PREV_IDX_LEN,
    PAGE_NEXT_IDX_LEN: PAGE_NEXT_IDX_LEN,
    CELL_LEN: CELL_LEN,
    CELL_OFFSET: CELL_OFFSET,
    NODE_TYPE_LEAF: NODE_TYPE_LEAF,
    NODE_TYPE_STEM: NODE_TYPE_STEM,
    NODE_TYPE_ROOT: NODE_TYPE_ROOT,
    PAGE_TYPE_OFFSET: PAGE_TYPE_OFFSET,
    PAGE_PARENT_OFFSET: PAGE_PARENT_OFFSET,
    PAGE_NEXT_OFFSET: PAGE_NEXT_OFFSET,
    PAGE_PREV_OFFSET: PAGE_PREV_OFFSET,
    CELL_USED_OFFSET: CELL_USED_OFFSET,
}

module.exports = constant;