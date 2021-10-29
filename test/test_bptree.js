const { PAGE_SIZE } = require('../common/const');
const winston = require('../winston/config');
const Bptree = require("../bptree/bptree");
const tools = require('./test_tools');
const assert = require('assert');


async function test0() {
    let bptree = new Bptree(4)
    let dbname = "test.db"
    await bptree.drop(dbname)
    await bptree.init(dbname)
    await tools.writeRange(bptree, 1000, 1)
    await bptree.flush()
    let value = await tools.find(bptree, 100)
    assert.equal(value, 100)
    winston.error(`$$ the buffer's final size is: ${bptree.getBuffer().buffSize()}`)
    await bptree.close()
}

async function test1() {
    let bptree = new Bptree(2)
    let dbname = "test.db"
    await bptree.drop(dbname)
    await bptree.init(dbname)

    await tools.writeRange(bptree, 100, 97)
    await tools.removeAny(bptree, [100, 99, 98, 97])
    await tools.writeOne(bptree, 100, 100)
    await tools.writeOne(bptree, 99, 99)

    let value = await tools.find(bptree, 100)
    assert.equal(value, 100)

    value = await tools.find(bptree, 98)
    assert.equal(value, undefined)

    await bptree.flush()
    await bptree.close()
}

async function test2() {
    let bptree = new Bptree(300)
    let dbname = "test.db"
    try {
        await bptree.drop(dbname)
    } catch (e) {
        winston.warn(`drop error!`)
    }

    await bptree.init(dbname)

    await tools.writeRange(bptree, 100000, 0)

    for (var i = 0; i < 100000; i++) {
        let value = await tools.find(bptree, i)
        assert.equal(value, i)
    }

    await bptree.flush()
    winston.error(`$$ the buffer's final size is: ${bptree.getBuffer().buffSize()}`)
    await bptree.close()
}

async function test3() {
    let bptree = new Bptree(10)
    let dbname = "test.db"
    try {
        await bptree.drop(dbname)
    } catch (e) {
        winston.warn(`drop error!`)
    }

    await bptree.init(dbname)

    await tools.writeRange(bptree, 0, 1000)
    for (var i = 0; i < 1000; i++) {
        let value = await tools.find(bptree, i)
        assert.equal(value, i)
    }

    await tools.removeRange(bptree, 0, 1000)
    winston.error(`$$ the buffer's final size is: ${bptree.getBuffer().buffSize()}`)
    await bptree.flush()
    await bptree.close()
}

/* dynamic data insert and delete test! */
async function test4() {
    let bptree = new Bptree(50)
    let array = []
    let number = array.length > 0 ? array.length : 1000
    if (array.length == 0) {
        for (var i = 0; i < number; i++) {
            array.push(tools.random(0, 1000))
        }
    }
    winston.error(array)

    let dbname = "test.db"
    try {
        await bptree.drop(dbname)
    } catch (e) {
        winston.warn(`drop error!`)
    }

    await bptree.init(dbname)
    await tools.writeAny(bptree, array)

    for (var i = 0; i < number; i++) {
        let key = array[i]
        let value = await tools.find(bptree, key)
        winston.error(`# find: key:${key} => value:${value}`)
        assert.equal(value, key)
    }

    await tools.removeAny(bptree, array)
    await bptree.flush()
    await bptree.close()
}

async function test5() {
    let bptree = new Bptree(50)
    let array = []
    let number = array.length > 0 ? array.length : 1000
    if (array.length == 0) {
        for (var i = 0; i < number; i++) {
            array.push(tools.random(0, 1000))
        }
    }
    winston.info(array)

    let dbname = "test.db"
    try {
        await bptree.drop(dbname)
    } catch (e) {
        winston.warn(`drop error!`)
    }

    await bptree.init(dbname)
    await tools.writeAny(bptree, array)

    for (var i = 0; i < number; i++) {
        let key = array[i]
        let value = await tools.find(bptree, key)
        winston.info(`# find: key:${key} => value:${value}`)
        assert.equal(value, key)
    }

    for (var i = 0; i < number; i++) {
        let pos = tools.random(0, array.length - 1)
        let key = array[pos]
        let value = await tools.removeOne(bptree, key)
        array.splice(pos, 1)
    }

    await bptree.flush()
    await bptree.close()
}

/* 测试value为字符串 */
async function test6() {
    let bptree = new Bptree(3, 1024, 9, 100)
    let dbname = "test.db"
    await bptree.drop(dbname)
    await bptree.init(dbname)
    await tools.writeOne(bptree, 100, 'hello world')
    await bptree.flush()
    let value = await tools.find(bptree, 100)
    assert.equal(value, 'hello world')
    await bptree.close()
}

/* 测试value为浮点数 */
async function test7() {
    let bptree = new Bptree(3)
    let dbname = "test.db"
    await bptree.drop(dbname)
    await bptree.init(dbname)
    await tools.writeOne(bptree, 100, 1.2345)
    await bptree.flush()
    let value = await tools.find(bptree, 100)
    winston.error(`## map[100] = ${value}`)
    await bptree.close()
}

async function test8() {
    let bptree = new Bptree(100, PAGE_SIZE, 4, 6)
    let dbname = "test.db"
    await bptree.drop(dbname)
    await bptree.init(dbname)

    let buff = Buffer.alloc(6)
    buff.writeUInt32LE(10, 0)
    buff.writeUInt16LE(1, 4)

    await tools.writeOne(bptree, 100, buff)
    await bptree.flush()
    let value = await tools.find(bptree, 100)

    let pageIndex = value.readUInt32LE()
    let slotIndex = value.readUInt16LE(4)

    winston.error(`## pageIndex = ${pageIndex}, slotIndex= ${slotIndex}`)

    await bptree.close()
}

const funcList = [
    test0,
    test1,
    test2,
    test3,
    test4,
    test5,
    test6,
    test7,
    test8,
]

async function test() {
    for (var i = 0; i < funcList.length; i++) {
        func = funcList[i]
        winston.error(`>>>>>>>>>(${func.name})`)
        await func()
        winston.error(`<<<<<<<<<(${func.name})`)
    }
}

test()