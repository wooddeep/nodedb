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

    else return  await findRoot(path.dirname(pwd))
}

async function test () {
    let root = await findRoot(path.dirname(module.filename))
    console.log(root)
}


const tools = {
    buffer: buffer,
    int32le: int32le,
    findRoot: findRoot,
    readdir: readdir,
    readfile: readfile,
}

module.exports = tools;