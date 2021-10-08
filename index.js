const winston = require('./winston/config');
const Bptree = require("./bptree.js");
const fileops = require("./fileops.js");
const constant = require("./const.js");
const PageBuff = require("./pbuff.js");
const tools = require('./tools')
const assert = require('assert');

const bptree = new Bptree()
//const buffer = new PageBuff(1)

async function writeRange(a, b) {
    if (a >= b) {
        for (var value = a; value >= b; value--) {
            let kbuf = tools.buffer(value)
            await bptree.insert(kbuf, value)
        }
    } else {
        for (var value = a; value <= b; value++) {
            let kbuf = tools.buffer(value)
            await bptree.insert(kbuf, value)
        }
    }
}

async function writeOne(value) {
    let kbuf = tools.buffer(value)
    await bptree.insert(kbuf, value)
}

async function writeAny(keys) {
    keys.forEach(key => {
        let kbuf = tools.buffer(key)
        bptree.insert(kbuf, key)
    })
}

async function find(key) {
    let kbuf = tools.buffer(key)
    let value = bptree.select(kbuf)
    if (value == undefined) {
        console.log("#####")
    }
    winston.info("value = " + value)
    return value
}

async function removeOne(key) {
    let kbuf = tools.buffer(key)
    await bptree.remove(kbuf)
}

async function removeAny(keys) {
    keys.forEach(key => {
        try {
            let kbuf = tools.buffer(key)
            bptree.remove(kbuf)
            winston.info(`# delete: key = ${key} ok`)
        } catch (e) {
            winston.error(`# delete: key = ${key} error`)
        }
    })
}

async function removeRange(a, b) {
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
    let dbname = "test.db"
    await bptree.drop(dbname)
    await bptree.init(dbname)
    await writeRange(100, 80)
    await bptree.dump()
    await bptree.flush()
    let value = await find(100)
    assert.equal(value, 100)
}

async function test1() {
    let dbname = "test.db"
    await bptree.drop(dbname)
    await bptree.init(dbname)

    await writeRange(100, 97)
    await removeAny([100, 99, 98, 97])
    await writeOne(100)
    await writeOne(99)

    let value = await find(100)
    assert.equal(value, 100)

    value = await findTest(98)
    assert.equal(value, undefined)

    await bptree.flush()
    await bptree.close()
}


async function test2() {
    let dbname = "test.db"
    try {
        await bptree.drop(dbname)
    } catch (e) {
        winston.warn(`drop error!`)
    }

    await bptree.init(dbname)

    await writeRange(1000, 0)

    for (var i = 0; i < 1000; i++) {
        let value = await find(i)
        assert.equal(value, i)
    }

    await bptree.flush()

    await bptree.close()
}


async function test3() {
    let dbname = "test.db"
    try {
        await bptree.drop(dbname)
    } catch (e) {
        winston.warn(`drop error!`)
    }

    await bptree.init(dbname)

    await writeRange(0, 1000)
    for (var i = 0; i < 1000; i++) {
        let value = await find(i)
        assert.equal(value, i)
    }

    await removeRange(0, 1000)

    await bptree.flush()
    await bptree.close()
}

function random(min, max) {
    return Math.floor(Math.random() * (max - min)) + min;
}

/* dynamic data insert and delete test! */
async function test4() {
    // [56,13,419,741,820,564,737,612,703,581,805,587,789,642,616,869,981,259,479,54]
    // [25,29,72,94,71,26,17,96,22,86,1,22,13,69,62,95,24,22,34,81]
    let array = [] //[25, 29, 72, 94, 71, 26, 17, 96, 22, 86, 1, 22, 13, 69, 62, 95, 24, 22, 34, 81]
    //array = [44, 42, 44, 48, 19, 2, 15, 87, 29, 24, 60, 40, 75, 56, 83, 46, 85, 41, 94, 62]
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
    await writeAny(array)

    for (var i = 0; i < number; i++) {
        let key = array[i]
        let value = await find(key)
        winston.error(`# find: key:${key} => value:${value}`)
        assert.equal(value, key)
    }

    await removeAny(array)
    await bptree.flush()
    await bptree.close()
}

async function test5() {
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
    await writeAny(array)

    for (var i = 0; i < number; i++) {
        let key = array[i]
        let value = await find(key)
        winston.info(`# find: key:${key} => value:${value}`)
        assert.equal(value, key)
    }

    for (var i = 0; i < number; i++) {
        let pos = random(0, array.length - 1)
        let key = array[pos]
        let value = await removeOne(key) 
        array.splice(pos, 1)
    }

    await bptree.flush()
    await bptree.close()
}

const funcList = [test0, test1, test2, test3, test4, test5]
const filterOut = [test0, test1, test2]

//funcList.filter(x => !filterOut.includes(x)).forEach(async func => await func())

//test3()
test5()
//test5()