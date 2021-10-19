/*
 * Author: lihan@xx.cn
 * History: create at 20210811
 */

// 
//  data page node 数据页头结点存储分布
//  +------------+-----------+----------+-----------+
//  |  COL-NUM   |  ROW-SIZE |   PREV   |   NEXT    |   // 列数，行大小, prev/next 空闲链表相关
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
} = require("../common/const")

class DataPage extends PageBase {

    constructor(type, size) {
        super()
        this.type = type
        this.size = size
    }

    newPage(type, size = PAGE_SIZE) {
        return new DataPage(type, size)
    }

    pageToBuff() {
        let buff = Buffer.alloc(this.size)

        if (this.type == NODE_TYPE_ROOT) {  // 数据文件头结点
            buff.writeInt32LE(this.colNum)  // 列数目
            buff.writeInt32LE(this.rowSize, 4) // 一行大小
            buff.writeInt32LE(this.prev, 8)    // 空闲链表指针
            buff.writeInt32LE(this.next, 12)    // 空闲链表指针

            for (var i = 0; i < this.colNum; i++) {
                this.columns[i].name.copy(buff, 16 + 64 * i, 0, 64) // 列名称, 规定 < 64
                let type = this.columns[i].type // 0 ~ int, 1 ~ float, 2 ~ string
                buff.writeInt16LE(type, 16 + 64 * (i + 1))

                if (type == VAL_TYPE_STR) {
                    let aux = this.columns[i].typeAux
                    buff.writeInt16LE(type, 18 + 64 * (i + 1))
                }

                let keyType = this.columns[i].keyType
                buff.writeInt8(keyType, 20 + 64 * (i + 1))

                this.columns[i].keyName.copy(buff, 21 + 64 * (i + 1), 0, 64) 
            }
        } else {

        }

        return buff
    }
}

module.exports = DataPage