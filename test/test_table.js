const winston = require('../winston/config');
const Table = require("../table/table.js")
const Column = require("../table/column")
const assert = require('assert');


// 数据插入表中，并读取测试，作为测试，索引添加在AID之上, 索引尚不可配置
async function test0() {
    let tbname = "test"
    let columns = []
    col0 = new Column("AID", 0, undefined, 1, "key0")
    col1 = new Column("name", 2, 32, 0, undefined)    // 最大长度为32
    col2 = new Column("age", 0, undefined, 0, undefined)

    columns.push(col0)
    columns.push(col1)
    columns.push(col2)

    let table = new Table(tbname, columns, 500)
    await table.drop()
    await table.init()

    let value = [1, "lihan", 38]

    await table.insert(value)

    let row = await table.selectById(1)

    let nameBuff = Buffer.alloc(32)
    row.copy(nameBuff, 0, 4, 36)
    let name = nameBuff.toString().replace(/^[\s\uFEFF\xA0\0]+|[\s\uFEFF\xA0\0]+$/g, "")
    let age = row.readUInt32LE(36)

    winston.error(`##name = ${name}, age = ${age}`)

    await table.flush()
    await table.close()
}

async function test1() {
    let tbname = "test"
    let columns = []
    col0 = new Column("AID", 0, undefined, 1, "key0")
    col1 = new Column("name", 2, 32, 0, undefined)    // 最大长度为32
    col2 = new Column("age", 0, undefined, 0, undefined)

    columns.push(col0)
    columns.push(col1)
    columns.push(col2)

    let table = new Table(tbname, columns, 500)
    await table.drop()
    await table.init()

    let value = [1, "lihan", 38]
    await table.insert(value)

    value = [2, "cao", 36]
    await table.insert(value)

    value = [3, "mora", 8]
    await table.insert(value)

    await table.flush()

    // 查询
    let row = await table.selectById(2)
    let nameBuff = Buffer.alloc(32)
    row.copy(nameBuff, 0, 4, 36)
    let name = nameBuff.toString().replace(/^[\s\uFEFF\xA0\0]+|[\s\uFEFF\xA0\0]+$/g, "")
    let age = row.readUInt32LE(36)

    winston.error(`##[1] name = ${name}, age = ${age}`)

    //await table.flush()
    await table.close()

    // table = new Table(tbname, [], 500)
    // await table.init()

    // row = await table.selectById(1)

    // nameBuff = Buffer.alloc(32)
    // row.copy(nameBuff, 0, 4, 36)
    // name = nameBuff.toString().replace(/^[\s\uFEFF\xA0\0]+|[\s\uFEFF\xA0\0]+$/g, "")
    // age = row.readUInt32LE(36)

    // winston.error(`##[2] name = ${name}, age = ${age}`)

    // await table.close()
}

async function testInsert(tbname = "test", data) {
    let table = new Table(tbname, [], 500)
    await table.init()
    await table.insert(data)
    await table.flush()
    await table.close()
}

async function testSelectAll(tbname = "test") {
    let table = new Table(tbname, [], 500)
    await table.init()

    let data = await table.selectAll()
    let rows = data.rows

    for (var i = 0; i < rows.length; i++) {
        let row = rows[i]
        let nameBuff = Buffer.alloc(32)
        row.copy(nameBuff, 0, 4, 36)
        let name = nameBuff.toString().replace(/^[\s\uFEFF\xA0\0]+|[\s\uFEFF\xA0\0]+$/g, "")
        age = row.readUInt32LE(36)

        winston.error(`##[2] name = ${name}, age = ${age}`)
    }

    await table.close()
}

// select all
async function test2() {
    await testInsert("test", [4, 'dream', 0])
    await testSelectAll("test")
}

async function test3() {
    await testSelectAll("demo")
}

const funcList = [
    //test1,
    //test1,
    //test2,
    test3,
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

