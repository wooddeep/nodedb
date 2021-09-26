/*
 * Author: lihan@xx.cn
 * History: create at 20210811
 */

const PAGE_SIZE = 1024     // 页大小
const START_OFFSET = 0   // 起始偏移量
const KEY_MAX_LEN = 10   // 键值最大长度
const VAL_IDX_LEN = 4    // 值页索引长度, 如果中间节点指向子页面, 叶子节点指向值

const PAGE_TYPE_LEN = 4       // 代表类型的字节数
const PAGE_PARENT_IDX_LEN = 4 // 父节点索引的字节数
const PAGE_NEXT_IDX_LEN = 4   // 兄节点索引的字节数
const PAGE_PREV_IDX_LEN = 4   // 弟节点索引的字节数
const PARENT_CELL_IDX_LEN = 2 // 父节点CELL的索引
const CELL_USED_LEN = 2       // 使用键值数的字节数

const LOC_FOR_INSERT = 0      // 因插入而搜索目标页节点
const LOC_FOR_SELECT = 1      // 因查找而搜索
const LOC_FOR_DELETE = 2      // 因删除而搜索

const TRANS_MERGE = 0         // 节点合并
const TRANS_BORROW = 1        // 节点数据借用
const TRANS_SHRINK = 2        // 向根节点收缩

const PAGE_TYPE_OFFSET = 0    // 页类型页内偏移
const PAGE_PARENT_OFFSET = PAGE_TYPE_OFFSET + PAGE_TYPE_LEN       // 页类型页内偏移
const PAGE_NEXT_OFFSET = PAGE_PARENT_OFFSET + PAGE_PARENT_IDX_LEN // 父索引页内偏移
const PAGE_PREV_OFFSET = PAGE_NEXT_OFFSET + PAGE_NEXT_IDX_LEN     // 兄索引页内偏移
const PARENT_CELL_OFFSET = PAGE_PREV_OFFSET + PAGE_PREV_IDX_LEN   // 父节点CELL索引偏移
const CELL_USED_OFFSET = PARENT_CELL_OFFSET + PARENT_CELL_IDX_LEN // 弟索引页内偏移
const CELL_OFFSET = CELL_USED_OFFSET + CELL_USED_LEN              // 存KV值的页内偏移
const HEAD_LEN = CELL_OFFSET  

const CELL_LEN = KEY_MAX_LEN + VAL_IDX_LEN                        // 每一对KV的长度

const ORDER_NUM = Math.floor((PAGE_SIZE - HEAD_LEN) / CELL_LEN)   // b+树的阶
const LESS_HALF_NUM = Math.floor(ORDER_NUM / 2)  // 少的一半
const MORE_HALF_NUM = Math.ceil(ORDER_NUM / 2)   // 多的一半

const NODE_TYPE_LEAF = 0 // 叶结点
const NODE_TYPE_STEM = 1 // 茎节点
const NODE_TYPE_ROOT = 2 // 根节点
const NODE_TYPE_FREE = -1 // 空闲叶结点

var constant = {
    KEY_MAX_LEN: KEY_MAX_LEN,
    VAL_IDX_LEN: VAL_IDX_LEN,
    PAGE_SIZE: PAGE_SIZE,
    LESS_HALF_NUM: LESS_HALF_NUM,
    MORE_HALF_NUM: MORE_HALF_NUM,
    ORDER_NUM: ORDER_NUM,
    PAGE_PARENT_IDX_LEN: PAGE_PARENT_IDX_LEN,
    PAGE_PREV_IDX_LEN: PAGE_PREV_IDX_LEN,
    PAGE_NEXT_IDX_LEN: PAGE_NEXT_IDX_LEN,
    PARENT_CELL_IDX_LEN: PARENT_CELL_IDX_LEN,
    CELL_LEN: CELL_LEN,
    CELL_OFFSET: CELL_OFFSET,
    NODE_TYPE_LEAF: NODE_TYPE_LEAF,
    NODE_TYPE_STEM: NODE_TYPE_STEM,
    NODE_TYPE_ROOT: NODE_TYPE_ROOT,
    NODE_TYPE_FREE: NODE_TYPE_FREE,
    PAGE_TYPE_OFFSET: PAGE_TYPE_OFFSET,
    PAGE_PARENT_OFFSET: PAGE_PARENT_OFFSET,
    PAGE_NEXT_OFFSET: PAGE_NEXT_OFFSET,
    PAGE_PREV_OFFSET: PAGE_PREV_OFFSET,
    PARENT_CELL_OFFSET: PARENT_CELL_OFFSET,
    CELL_USED_OFFSET: CELL_USED_OFFSET,
    LOC_FOR_INSERT: LOC_FOR_INSERT,
    LOC_FOR_SELECT: LOC_FOR_SELECT,
    LOC_FOR_DELETE: LOC_FOR_DELETE,
    TRANS_MERGE: TRANS_MERGE,
    TRANS_BORROW: TRANS_BORROW,
    TRANS_SHRINK: TRANS_SHRINK
}

module.exports = constant;