/*
 * Author: lihan@xx.cn
 * History: create at 20210811
 */

// 
//  b+树 page node 存储分布
//  +---------------+
//  +     TYPE      +            // 叶结点类型字段：4字节
//  +---------------+
//  +    PARENT     +            // 父节点索引字段：4字节
//  +---------------+
//  +     NEXT      +            // 兄节点索引字段：4字节
//  +---------------+
//  +     PREV      +            // 弟节点索引字段：4字节  
//  +-------+-------+
//  + PCELL |  USED +            // 本节点在父节点的KV数组中的下标：2字节 | 本节点KV数组已使用的个数：2字节
//  +-------+-------+
//  |       | TYPE  |   
//  |  KEY  +-------+            // 一对KV值，K与V的长度可以配置，KV对的个数和K长度、V长度、以及页大小相关
//  |       |  VAL  |   
//  +-------+-------+
//  |    ........   |
//  +-------+-------+
//  |       | TYPE  |           // 值类型
//  |  KEY  +-------+ 
//  |       |  VAL  |           // 具体值  
//  +-------+-------+
//

const PAGE_SIZE = 4096     // 页大小
const START_OFFSET = 0   // 起始偏移量
const KEY_MAX_LEN = 9   // 键值最大长度
const VAL_TYPE_LEN = 1   // 值类型长度
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

const CELL_LEN = KEY_MAX_LEN + VAL_TYPE_LEN + VAL_IDX_LEN         // 每一对KV的长度
const ORDER_NUM = Math.floor((PAGE_SIZE - HEAD_LEN) / CELL_LEN)   // b+树的阶
const LESS_HALF_NUM = Math.floor(ORDER_NUM / 2)  // 少的一半
const MORE_HALF_NUM = Math.ceil(ORDER_NUM / 2)   // 多的一半

const NODE_TYPE_LEAF = 0 // 叶结点
const NODE_TYPE_STEM = 1 // 茎节点
const NODE_TYPE_ROOT = 2 // 根节点
const NODE_TYPE_FREE = -1 // 空闲叶结点

const VAL_TYPE_IDX = 0 // 非叶子节点存储子节点索引
const VAL_TYPE_NUM = 1 // 叶子节点存储内容为数字
const VAL_TYPE_STR = 2 // 叶子节点存储内容为字符串
const VAL_TYPE_FPN = 3 // 叶子节点存储内容为浮点数
const VAL_TYPE_UNK = 4 // 未知

// 
//  data page node 数据页头结点存储分布
//  +------------+-----------+----------+-----------+
//  |    PREV    |    NEXT   | COL-NUM  |  ROW-SIZE |   // prev/next 空闲链表相关, 列数，行大小, 
//  +------------+-----------+----+-----------------+
//  |    NAME    | TYPE-AUX  | KT |    KEY-NAME     |   // NAME：列名称(长64字节); 
//  +------------+-----------+----+-----------------+
//  |    NAME    | TYPE-AUX  | KT |    KEY-NAME     |   // TYPE-AUX: 列类型及辅助(4字节);
//  +------------+-----------+----+-----------------+
//  |    NAME    | TYPE-AUX  | KT |    KEY-NAME     |   // KT: 键类型(1字节);
//  +------------+-----------+----+-----------------+
//  |    NAME    | TYPE-AUX  | KT |    KEY-NAME     |   // KEY-NAME: 键名称(64字节);
//  +------------+-----------+----+-----------------+
//  |                  ......                       |
//  +-----------------------------------------------+
//    

const COL_NUM_LEN = 4 // 列数 所占字节数
const ROW_SIZE_LEN = 4 // 每行大小 所占字节数
const PREV_LEN = 4
const NEXT_LEN = 4
const COL_NAME_LEN = 64 // 列名称所占字节最大数
const COL_TYPE_LEN = 2  // 列类型
const COL_TYPE_AUX_LEN = 2 // 列类型辅助信息
const KEY_TYPE_LEN = 1 //  键类型
const KEY_NAME_LEN = 64 // 键名称所占字节最大数

const PREV_OFFSET = 0
const NEXT_OFFSET = PREV_OFFSET + PREV_LEN
const COL_NUM_OFFSET = NEXT_OFFSET + NEXT_LEN
const ROW_SIZE_OFFSET = COL_NUM_OFFSET + COL_NUM_LEN
const COL_NAME_OFFSET = ROW_SIZE_OFFSET + ROW_SIZE_LEN
const COL_TYPE_OFFSET = COL_NAME_OFFSET + COL_NAME_LEN
const COL_TYPE_AUX_OFFSET = COL_TYPE_OFFSET + COL_TYPE_LEN
const KEY_TYPE_OFFSET = COL_TYPE_AUX_OFFSET + COL_TYPE_AUX_LEN
const KEY_NAME_OFFSET = KEY_TYPE_OFFSET + KEY_TYPE_LEN
const COL_DESC_LEN = COL_NAME_LEN + COL_TYPE_LEN + COL_TYPE_AUX_LEN + KEY_TYPE_LEN + KEY_NAME_LEN

// 
//  data page node 数据页数据结点存储分布
//  +------------+-----------+----------+-----------+
//  |    PREV    |    NEXT   |    TYPE  |  BIT-MAP  |   // prev/next 空闲链表相关, 列数，行大小, 
//  +------------+-----------+----------+-----------+
//  |                     ROW_DATA                  |   // 一行数据
//  +-----------------------------------------------+
//  |                     ROW_DATA                  |   // 一行数据
//  +-----------------------------------------------+
//  |                     ROW_DATA                  |   // 一行数据
//  +-----------------------------------------------+
//  |                     ROW_DATA                  |   // 一行数据
//  +-----------------------------------------------+
//  |                      ......                   |
//  +-----------------------------------------------+
//  

var constant = {
    KEY_MAX_LEN: KEY_MAX_LEN,
    VAL_TYPE_LEN: VAL_TYPE_LEN,
    VAL_IDX_LEN: VAL_IDX_LEN,
    PAGE_SIZE: PAGE_SIZE,
    HEAD_LEN: HEAD_LEN,
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
    TRANS_SHRINK: TRANS_SHRINK,
    START_OFFSET: START_OFFSET,
    VAL_TYPE_IDX: VAL_TYPE_IDX,
    VAL_TYPE_NUM: VAL_TYPE_NUM,
    VAL_TYPE_STR: VAL_TYPE_STR,
    VAL_TYPE_FPN: VAL_TYPE_FPN,
    VAL_TYPE_UNK: VAL_TYPE_UNK,

    // 数据页头结点相关定义
    COL_NAME_LEN: COL_NAME_LEN,
    KEY_NAME_LEN: KEY_NAME_LEN,
    COL_NUM_OFFSET: COL_NUM_OFFSET,
    ROW_SIZE_OFFSET: ROW_SIZE_OFFSET,
    PREV_OFFSET: PREV_OFFSET,
    NEXT_OFFSET: NEXT_OFFSET,
    COL_NAME_OFFSET: COL_NAME_OFFSET,
    COL_TYPE_OFFSET: COL_TYPE_OFFSET,
    COL_TYPE_AUX_OFFSET: COL_TYPE_AUX_OFFSET,
    KEY_TYPE_OFFSET: KEY_TYPE_OFFSET,
    KEY_NAME_OFFSET: KEY_NAME_OFFSET,
    COL_DESC_LEN: COL_DESC_LEN,
}

module.exports = constant;