const StringBuffer = require("stringbuffer");
const constant = require("./const.js");
const path = require('path')
const fs = require("fs")

const {
    START_OFFSET,
    KEY_MAX_LEN,
    VAL_TYPE_LEN,
    VAL_IDX_LEN,
    PAGE_SIZE,
    HEAD_LEN,
    NODE_TYPE_LEAF,
    NODE_TYPE_STEM,
    NODE_TYPE_ROOT,
    NODE_TYPE_FREE,
    LOC_FOR_INSERT,
    LOC_FOR_SELECT,
    LOC_FOR_DELETE,
    TRANS_MERGE,
    TRANS_BORROW,
    TRANS_SHRINK,
    VAL_TYPE_IDX,
    VAL_TYPE_NUM,
    VAL_TYPE_STR,
    VAL_TYPE_FPN,
    VAL_TYPE_OBJ,
    VAL_TYPE_UNK,
    COL_TYPE_INT,
    COL_TYPE_FPN,
    COL_TYPE_STR,
} = require("./const.js")


function buffer(key) {
    let buffer = Buffer.alloc(constant.KEY_MAX_LEN)
    buffer.fill(0)
    buffer.writeInt32LE(key)
    return buffer
}

function int32le(kbuf, pos = 0) {
    var value = kbuf.readInt32LE(pos)
    return value
}

function readdir(pwd) {
    let promise = new Promise((resolve, reject) => {
        fs.readdir(pwd, { withFileTypes: true }, (err, dirs) => {
            if (err) {
                console.log(error)
                reject(false)
            } else {
                resolve(dirs.filter(dirent => !dirent.isFile()))
            }
        })
    })
    return promise
}

function readfile(pwd) {
    let promise = new Promise((resolve, reject) => {
        fs.readdir(pwd, { withFileTypes: true }, (err, dirs) => {
            if (err) {
                console.log(error)
                reject(false)
            } else {
                resolve(dirs.filter(dirent => dirent.isFile()))
            }
        })
    })
    return promise
}


async function findRoot(pwd) {
    let dirs = await readdir(pwd)
    let out = dirs.filter(dirent => dirent.name == "data") // 生成数据库数据, 只放在 data目录

    if (out.length > 0) return path.join(pwd, 'data')

    else return await findRoot(path.dirname(pwd))
}

async function test() {
    let root = await findRoot(path.dirname(module.filename))
    console.log(root)
}


function tableDisplayData(header, rows, coldef = undefined) {

    let sb = new StringBuffer();
    let max = []
    for (var c = 0; c < header.length; c++) { // 遍历每列
        if (rows.length > 0) {
            let column = rows.map(row => row[c])
            let maxLen = column.sort((a, b) => (a.length >= b.length) ? -1 : 1)[0].length; // TODO 根据列类型求显示宽度
            let lebel = header[c]
            maxLen = Math.max(maxLen, lebel.length) // 与标签"tables"的length比较
            max.push(maxLen)
        } else {
            let lebel = header[c]
            let maxLen = lebel.length
            max.push(maxLen)
        }
    }

    // 1. 起始的 +--------+----------+
    for (var c = 0; c < header.length; c++) {
        sb.append('+')
        for (var i = 0; i < max[c] + 2; i++) sb.append('-') // 2: 左右两边的空格
    }
    sb.append('+\n') // 换行

    // 2. 表头
    for (var c = 0; c < header.length; c++) {
        sb.append('| ')
        sb.append(header[c])
        let gap = max[c] - header[c].length + 1
        for (var k = 0; k < gap; k++) sb.append(' ')
    }
    sb.append('|\n') // 换行

    for (var c = 0; c < header.length; c++) {
        sb.append('+')
        for (var i = 0; i < max[c] + 2; i++) sb.append('-') // 2: 左右两边的空格
    }
    sb.append('+\n')

    // 3. 遍历每行
    for (var r = 0; r < rows.length; r++) {
        let row = rows[r]
        for (var c = 0; c < header.length; c++) {
            sb.append('| ')
            sb.append(row[c])
            let gap = max[c] - row[c].length + 1
            for (var k = 0; k < gap; k++) sb.append(' ')
        }
        sb.append('|\n') // 换行
    }

    // 4. 结束的 +--------+----------+
    for (var c = 0; c < header.length; c++) {
        sb.append('+')
        for (var i = 0; i < max[c] + 2; i++) sb.append('-') // 2: 左右两边的空格
    }
    sb.append('+')

    return sb.toString()
}


/*
 * b+树索引 kv 中, v的类型
 */
function bptreeValType(value) {
    if (typeof (value) == 'object') {
        return VAL_TYPE_OBJ
    }

    if (typeof (value) == 'number') {
        if (Number.isInteger(value)) {
            return VAL_TYPE_NUM
        } else {
            return VAL_TYPE_FPN
        }
    }

    if (typeof (value) == 'string') {
        return VAL_TYPE_STR
    }

    return VAL_TYPE_UNK
}


/*
 * 根据数据库列的类型求值
 */
function tableColValue(value, type) {
    if (type == COL_TYPE_STR) {
        return value.toString().replace(/^[\s\uFEFF\xA0\0]+|[\s\uFEFF\xA0\0]+$/g, "")
    }

    if (type == COL_TYPE_INT) {
        return value.readInt32LE()
    }

    if (type == COL_TYPE_FPN) {
        return value.readFloatLE()
    }
}

const tools = {
    buffer: buffer,
    int32le: int32le,
    findRoot: findRoot,
    readdir: readdir,
    readfile: readfile,
    tableDisplayData: tableDisplayData,
    bptreeValType: bptreeValType,
    tableColValue: tableColValue,
}

module.exports = tools;