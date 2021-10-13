const winston = require('./winston/config');
const fileops = require("./fileops.js");
const constant = require("./const.js");
const Bptree = require("./bptree.js");
const assert = require('assert');
const tools = require('./tools');


function random(min, max) {
    return Math.floor(Math.random() * (max - min)) + min;
}

async function writeRange(bptree, a, b) {
    if (a >= b) {
        for (var value = a; value >= b; value--) {
            let kbuf = tools.buffer(value)
            if (value === 85) {
                console.log(`catch`)
            }
            await bptree.insert(kbuf, value)
        }
    } else {
        for (var value = a; value <= b; value++) {
            let kbuf = tools.buffer(value)
            await bptree.insert(kbuf, value)
        }
    }
}

async function writeOne(bptree, key, value) {
    let kbuf = tools.buffer(key)
    await bptree.insert(kbuf, value)
}

async function writeAny(bptree, keys) {
    for (var i = 0; i < keys.length; i++) {
        let key = keys[i]
        let kbuf = tools.buffer(key)
        await bptree.insert(kbuf, key)
    }
}

async function find(bptree, key) {
    let kbuf = tools.buffer(key)
    let value = await bptree.select(kbuf)
    winston.info("value = " + value)
    return value
}

async function removeOne(bptree, key) {
    let kbuf = tools.buffer(key)
    await bptree.remove(kbuf)
}

async function removeAny(bptree, keys) {
    for (var i = 0; i < keys.length; i++) {
        let key = keys[i]
        try {
            let kbuf = tools.buffer(key)
            await bptree.remove(kbuf)
            winston.info(`# delete: key = ${key} ok`)
        } catch (e) {
            winston.error(`# delete: key = ${key} error`)
        }
    }
}

async function removeRange(bptree, a, b) {
    if (a >= b) {
        for (var value = a; value >= b; value--) {
            let kbuf = tools.buffer(value)
            await bptree.remove(kbuf, value)
        }
    } else {
        for (var value = a; value <= b; value++) {
            let kbuf = tools.buffer(value)
            await bptree.remove(kbuf, value)
        }
    }
}

async function test0() {
    let bptree = new Bptree()
    let dbname = "test.db"
    await bptree.drop(dbname)
    await bptree.init(dbname)
    await writeRange(bptree, 1000, 1)
    await bptree.flush()
    let value = await find(bptree, 100)
    assert.equal(value, 100)
    winston.error(`$$ the buffer's final size is: ${bptree.getBuffer().buffSize()}`)
    await bptree.close()
}

async function test1() {
    let bptree = new Bptree()
    let dbname = "test.db"
    await bptree.drop(dbname)
    await bptree.init(dbname)

    await writeRange(bptree, 100, 97)
    await removeAny(bptree, [100, 99, 98, 97])
    await writeOne(bptree, 100, 100)
    await writeOne(bptree, 99, 99)

    let value = await find(bptree, 100)
    assert.equal(value, 100)

    value = await find(bptree, 98)
    assert.equal(value, undefined)

    await bptree.flush()
    await bptree.close()
}


async function test2() {
    let bptree = new Bptree()
    let dbname = "test.db"
    try {
        await bptree.drop(dbname)
    } catch (e) {
        winston.warn(`drop error!`)
    }

    await bptree.init(dbname)

    await writeRange(bptree, 1000, 0)

    for (var i = 0; i < 1000; i++) {
        let value = await find(bptree, i)
        assert.equal(value, i)
    }

    await bptree.flush()
    await bptree.close()
}

async function test3() {
    let bptree = new Bptree()
    let dbname = "test.db"
    try {
        await bptree.drop(dbname)
    } catch (e) {
        winston.warn(`drop error!`)
    }

    await bptree.init(dbname)

    await writeRange(bptree, 0, 1000)
    for (var i = 0; i < 1000; i++) {
        let value = await find(bptree, i)
        assert.equal(value, i)
    }

    await removeRange(bptree, 0, 1000)
    winston.error(`$$ the buffer's final size is: ${bptree.getBuffer().buffSize()}`)
    await bptree.flush()
    await bptree.close()
}

/* dynamic data insert and delete test! */
async function test4() {
    let bptree = new Bptree()
    let array = []
    let number = array.length > 0 ? array.length : 1000
    if (array.length == 0) {
        for (var i = 0; i < number; i++) {
            array.push(random(0, 1000))
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
    await writeAny(bptree, array)

    for (var i = 0; i < number; i++) {
        let key = array[i]
        let value = await find(bptree, key)
        winston.error(`# find: key:${key} => value:${value}`)
        assert.equal(value, key)
    }

    await removeAny(bptree, array)
    await bptree.flush()
    await bptree.close()
}

async function test5() {
    let bptree = new Bptree()
    let array = []
    let number = array.length > 0 ? array.length : 1000
    if (array.length == 0) {
        for (var i = 0; i < number; i++) {
            array.push(random(0, 1000))
        }
    }
    winston.info(array)

    let dbname = "test5.db"
    try {
        await bptree.drop(dbname)
    } catch (e) {
        winston.warn(`drop error!`)
    }

    await bptree.init(dbname)
    await writeAny(bptree, array)

    for (var i = 0; i < number; i++) {
        let key = array[i]
        let value = await find(bptree, key)
        winston.info(`# find: key:${key} => value:${value}`)
        assert.equal(value, key)
    }

    for (var i = 0; i < number; i++) {
        let pos = random(0, array.length - 1)
        let key = array[pos]
        let value = await removeOne(bptree, key)
        array.splice(pos, 1)
    }

    await bptree.flush()
    await bptree.close()
}

/* 测试value为字符串 */
async function test6() {
    let bptree = new Bptree()
    let dbname = "test.db"
    await bptree.drop(dbname)
    await bptree.init(dbname)
    await writeOne(bptree, 100, 'hello')
    await bptree.flush()
    let value = await find(bptree, 100)
    assert.equal(value, 'hello')
    await bptree.close()
}

/* 测试value为浮点数 */
async function test7() {
    let bptree = new Bptree()
    let dbname = "test.db"
    await bptree.drop(dbname)
    await bptree.init(dbname)
    await writeOne(bptree, 100, 1.2345)
    await bptree.flush()
    let value = await find(bptree, 100)
    winston.error(`## map[100] = ${value}`)
    await bptree.close()
}

const funcList = [test0, test1, test2, test3, test4, test5, test6, test7]
const filterOut = [test0, test2, test1,  test3, test4, test5, test7]

async function test() {
    funs = funcList.filter(x => !filterOut.includes(x))
    for (var i = 0; i < funs.length; i++) {
        func = funs[i]
        winston.error(`>>>>>>>>>(${func.name})`)
        await func()
        winston.error(`<<<<<<<<<(${func.name})`)
    }
}

test()