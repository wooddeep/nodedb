/*
 * Author: lihan@xx.cn
 * History: create at 20210811
 */

const winston = require('./winston/config');
var fs = require('fs');
const { PAGE_SIZE } = require('./const');

/*
 * Parameters:
 *     @filename: 打开文件的文件名
 * Return:
 *     文件句柄 promise
 */
function openFile(filename) {
    let promise = new Promise((resolve, reject) => {
        fs.open(filename, 'r+', function (err, fd) {
            if (err) {
                console.error(err)
                reject(err)
            }
            winston.info("文件打开成功！")
            resolve(fd)
        });
    });
    return promise
}


function createFile(filename) {
    let promise = new Promise((resolve, reject) => {
        fs.writeFile(filename, "", function (err) {
            if (err) {
                console.log(err)
                reject(err)
            }
            winston.info("The file was saved!")
            resolve(true)
        });
    });
    return promise
}

/*
 * Parameters:
 *     @fd: 文件句柄
 *     @buf: 
 *     @pos: 文件定位
 * Return:
 *     读取内容实际长度 promise
 */
function readFile(fd, buf, off = 0, len = PAGE_SIZE, pos = 0) {
    let promise = new Promise((resolve, reject) => {
        fs.read(fd, buf, off, len, pos, function (err, bytes) {
            if (err) {
                console.log(err)
                reject(err)
            }
            winston.info(bytes + "字节被读取");
            resolve(bytes)
        });
    })
    return promise
}

/*
 * Parameters:
 *     @fd: 文件句柄
 *     @buf: 
 * Return:
 *     写是否成功 promise
 */
function writeFile(fd, buf, offset, length, pos = 0) {
    let promise = new Promise((resolve, reject) => {
        fs.write(fd, buf, offset, length, pos, function (err) {
            if (err) {
                console.error(err);
                reject(err)
            }
            winston.info("数据写入成功！");
            resolve(true)
        });
    })
    return promise
}

function statFile(fd) {
    let promise = new Promise((resolve, reject) => {
        fs.fstat(fd, function (error, stats) {
            if (error) {
                console.error(error)
                reject(error)
            } else {
                winston.info(stats)
                resolve(stats)
            }
        })
    })
    return promise
}

function existFile(path) {
    let promise = new Promise((resolve, reject) => {
        fs.exists(path, function (exist) {
            resolve(exist)
        })
    })
    return promise
}

function syncFile(fd) {
    let promise = new Promise((resolve, reject) => {
        fs.fsync(fd, function (error, stats) {
            if (error) {
                console.error(error)
                reject(error)
            } else {
                resolve(stats)
            }
        })
    })
    return promise
}


/*
 * Parameters:
 *     @fd: 文件句柄
 *     @buf: 
 * Return:
 *     写是否成功 promise
 */
function closeFile(fd) {
    let promise = new Promise((resolve, reject) => {
        fs.close(fd, function (err) {
            if (err) {
                console.error(err);
                reject(err)
            }
            winston.info("文件关闭成功！");
            resolve(true)
        });
    })
    return promise
}

var fileops = {
    existFile: existFile,
    createFile: createFile,
    openFile: openFile,
    readFile: readFile,
    writeFile: writeFile,
    closeFile: closeFile,
    statFile: statFile,
    syncFile: syncFile,
}

module.exports = fileops;