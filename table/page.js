/*
 * Author: lihan@xx.cn
 * History: create at 20210811
 */

// 
//  data page node 数据页头结点存储分布
//  +--------+-------+---------+----------+---------+
//  |  PREV  |  NEXT | COL_NUM | ROW_SIZE | ROW_NUM |   // prev/next 空闲链表相关, 列数，行大小, 数据页每页行数
//  +--------+-------+---------+----------+---------+
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

// 
//  data page node 数据页数据结点存储分布
//  +--------+--------+------+----------------------+
//  |  PREV  |  NEXT  | TYPE |       BIT_MAP        |   // BIT_MAP：标志着每一行的使用情况：空，占用，删除
//  +--------+--------+------+----------------------+
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

const PageBase = require("../common/page")
const Column = require("./column")

const {
    PAGE_SIZE,
    NODE_TYPE_ROOT,
    NODE_TYPE_DATA,
    VAL_TYPE_STR,
    COL_NUM_OFFSET,
    ROW_SIZE_OFFSET,
    COL_DESC_LEN,
    PREV_OFFSET,
    NEXT_OFFSET,
    COL_NAME_OFFSET,
    COL_TYPE_OFFSET,
    COL_TYPE_AUX_OFFSET,
    KEY_TYPE_OFFSET,
    KEY_NAME_OFFSET,
    COL_NAME_LEN,
    KEY_NAME_LEN,
    ROW_NUM_OFFSET,
} = require("../common/const")

class DataPage extends PageBase {

    constructor(type = NODE_TYPE_ROOT, size = PAGE_SIZE) {
        super()
        this.type = type // page type
        this.size = size // page size
    }

    newPage(type = NODE_TYPE_DATA, size = PAGE_SIZE) {
        return new DataPage(type, size)
    }

    pageToBuff() {
        let buff = Buffer.alloc(this.size)

        if (this.type == NODE_TYPE_ROOT) {  // 数据文件头结点
            buff.writeInt32LE(this.prev, PREV_OFFSET)  // 列数目
            buff.writeInt32LE(this.next, NEXT_OFFSET) // 一行大小
            buff.writeInt16LE(this.colNum, COL_NUM_OFFSET)    // 空闲链表指针
            buff.writeInt16LE(this.rowSize, ROW_SIZE_OFFSET)    // 空闲链表指针
            buff.writeInt16LE(this.rowNum, ROW_NUM_OFFSET)

            for (var i = 0; i < this.colNum; i++) {
                this.columns[i].name.copy(buff, COL_NAME_OFFSET + COL_DESC_LEN * i, 0, COL_NAME_LEN) // 列名称, 规定 < 64
                let type = this.columns[i].type // 0 ~ int, 1 ~ float, 2 ~ string
                buff.writeInt16LE(type, COL_TYPE_OFFSET + COL_DESC_LEN * i)
                if (type == VAL_TYPE_STR) {
                    let aux = this.columns[i].typeAux
                    buff.writeInt16LE(aux, COL_TYPE_AUX_OFFSET + COL_DESC_LEN * i)
                }
                let keyType = this.columns[i].keyType
                buff.writeInt8(keyType, KEY_TYPE_OFFSET + COL_DESC_LEN * i)
                this.columns[i].keyName.copy(buff, KEY_NAME_OFFSET + COL_DESC_LEN * i, 0, KEY_NAME_LEN)
            }

        } else {

        }

        return buff
    }

    buffToPage(buff) {
        let page = new DataPage()

        if (this.type == NODE_TYPE_ROOT) {  // 数据文件头结点
            page.prev = buff.readInt32LE(PREV_OFFSET)
            page.next = buff.readInt32LE(NEXT_OFFSET)
            page.colNum = buff.readInt16LE(COL_NUM_OFFSET)
            page.rowSize = buff.readInt16LE(ROW_SIZE_OFFSET)
            page.rowNum = buff.readInt16LE(ROW_NUM_OFFSET)

            let columns = []
            for (var i = 0; i < page.colNum; i++) {
                let column = new Column()
                let name = Buffer.alloc(COL_NAME_LEN)
                column.name = name

                buff.copy(name, 0, COL_NAME_OFFSET + COL_DESC_LEN * i, COL_NAME_OFFSET + COL_DESC_LEN * i + COL_NAME_LEN)
                let type = buff.readInt16LE(COL_TYPE_OFFSET + COL_DESC_LEN * i) // 0 ~ int, 1 ~ float, 2 ~ string
                column.type = type

                if (type == VAL_TYPE_STR) {
                    let aux = buff.readInt16LE(COL_TYPE_AUX_OFFSET + COL_DESC_LEN * i)
                    column.typeAux = aux
                }

                let keyType = buff.readInt8(KEY_TYPE_OFFSET + COL_DESC_LEN * i)
                column.keyType = keyType

                let keyName = Buffer.alloc(KEY_NAME_LEN)
                buff.copy(keyName, 0, KEY_NAME_OFFSET + COL_DESC_LEN * i, KEY_NAME_OFFSET + COL_DESC_LEN * i + KEY_NAME_LEN)
                column.keyName = keyName

                columns.push(column)
            }

            page.columns = columns
        } else {

        }

        return page
    }
}

module.exports = DataPage