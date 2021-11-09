const StringBuffer = require("stringbuffer");
const constant = require("./const.js");
const path = require('path')
const fs = require("fs")

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
        let column = rows.map(row => row[c])
        let maxLen = column.sort((a, b) => (a.length >= b.length) ? -1 : 1)[0].length; // TODO 根据列类型求显示宽度
        let lebel = header[c]
        maxLen = Math.max(maxLen, lebel.length) // 与标签"tables"的length比较
        max.push(maxLen)
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

const tools = {
    buffer: buffer,
    int32le: int32le,
    findRoot: findRoot,
    readdir: readdir,
    readfile: readfile,
    tableDisplayData: tableDisplayData,
}

module.exports = tools;