const winston = require('./winston/config');
const Bptree = require("./bptree.js");
const fileops = require("./fileops.js");
const constant = require("./const.js");
const Buffer = require("./buffer.js");
const tools = require('./tools')
const assert = require('assert');

const bptree = new Bptree()

const buffer = new Buffer(1)

async function fileOperTest() {
    let fd = await fileops.openFile("lee.db")
    const buffer = Buffer.alloc(10);
    buffer.write("helloworld")
    await fileops.writeFile(fd, buffer, 0, 10)
    await fileops.closeFile(fd)
    let exists = await fileops.existFile("lee.db")
    winston.info(exists)
}

async function writeTest(upper, lower) {
    for (var value = upper; value >= lower; value--) {
        let kbuf = tools.buffer(value)
        await bptree.insert(kbuf, value)
    }
}

async function writeOneTest(value) {
    let kbuf = tools.buffer(value)
    await bptree.insert(kbuf, value)
}

async function findTest(key) {
    let kbuf = tools.buffer(key)
    let value = bptree.select(kbuf)
    winston.info("value = " + value)
    return value
}

async function removeOneTest(key) {
    let kbuf = tools.buffer(key)
    bptree.remove(kbuf)
}

async function removeTest(keys) {
    keys.forEach(key => {
        let kbuf = tools.buffer(key)
        bptree.remove(kbuf)
        winston.warn(`delete: key = ${key}`)
    })
}

async function test0() {
    let dbname = "test.db"
    await bptree.drop(dbname)
    await bptree.init(dbname)
    await writeTest(100, 80)
    await bptree.dump()
    await bptree.flush()
    let value = await findTest(100)
    assert.equal(value, 100)
}

async function test1() {
    let dbname = "test.db"
    await bptree.drop(dbname)
    await bptree.init(dbname)

    await writeTest(100, 97)
    await removeTest([100, 99, 98, 97])
    await writeOneTest(100)
    await writeOneTest(99)
    

    let value = await findTest(100)
    assert.equal(value, 100)

    value = await findTest(98)
    assert.equal(value, undefined)

    await bptree.flush()
    await bptree.close()
}

const funcList = [test0, test1]
const filterOut = [test1]

funcList.filter(x => !filterOut.includes(x)).forEach(func => func())

