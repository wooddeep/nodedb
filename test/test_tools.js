const { PAGE_SIZE } = require('../common/const');
const winston = require('../winston/config');
const Bptree = require("../bptree/bptree");
const Table = require("../table/table")
const Column = require("../table/column")
const tools = require('../common/tools');
const assert = require('assert');


function random(min, max) {
    return Math.floor(Math.random() * (max - min)) + min;
}

async function writeRange(bptree, a, b) {
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


const test_tools = {
    random: random,
    writeRange: writeRange,
    writeOne: writeOne,
    writeAny: writeAny,
    find: find,
    removeOne: removeOne,
    removeAny: removeAny,
    removeRange: removeRange,
}

module.exports = test_tools;
