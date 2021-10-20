/*
 * Author: lihan@xx.cn
 * History: create at 20210811
 */

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

const PageBase = require("../common/pagebase")

const {
    PAGE_SIZE,
    NODE_TYPE_ROOT,
    VAL_TYPE_STR,
    COL_NUM_OFFSET,
    ROW_SIZE_OFFSET,
    PREV_OFFSET,
    NEXT_OFFSET,
    COL_NAME_OFFSET,
    COL_TYPE_OFFSET,
    COL_TYPE_AUX_OFFSET,
    KEY_TYPE_OFFSET,
    KEY_NAME_OFFSET,
    COL_NAME_LEN,
    KEY_NAME_LEN,
} = require("../common/const")

class DataPage extends PageBase {

    constructor(type, size) {
        super()
        this.type = type // page type
        this.size = size // page size
    }

    newPage(type, size = PAGE_SIZE) {
        return new DataPage(type, size)
    }

    pageToBuff() {
        let buff = Buffer.alloc(this.size)

        if (this.type == NODE_TYPE_ROOT) {  // 数据文件头结点
            buff.writeInt32LE(this.prev, PREV_OFFSET)  // 列数目
            buff.writeInt32LE(this.next, NEXT_OFFSET) // 一行大小
            buff.writeInt32LE(this.colNum, COL_NUM_OFFSET)    // 空闲链表指针
            buff.writeInt32LE(this.rowSize, ROW_SIZE_OFFSET)    // 空闲链表指针

            for (var i = 0; i < this.colNum; i++) {
                this.columns[i].name.copy(buff, COL_NAME_OFFSET + COL_NAME_LEN * i, 0, COL_NAME_LEN) // 列名称, 规定 < 64
                let type = this.columns[i].type // 0 ~ int, 1 ~ float, 2 ~ string
                buff.writeInt16LE(type, COL_TYPE_OFFSET + COL_NAME_LEN * i)
                if (type == VAL_TYPE_STR) {
                    let aux = this.columns[i].typeAux
                    buff.writeInt16LE(type, COL_TYPE_AUX_OFFSET + COL_NAME_LEN * i)
                }
                let keyType = this.columns[i].keyType
                buff.writeInt8(keyType, KEY_TYPE_OFFSET + KEY_NAME_LEN * i)
                this.columns[i].keyName.copy(buff, KEY_NAME_OFFSET + KEY_NAME_LEN * i, 0, KEY_NAME_LEN)
            }

        } else {

        }

        return buff
    }
}

module.exports = DataPage