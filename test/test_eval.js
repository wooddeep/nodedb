const winston = require('../winston/config');
const Table = require("../table/table.js")
const Column = require("../table/column")
const assert = require('assert');
const { Parser } = require('node-sql-parser');
const Evaluator = require('../cmdline/eval')
const tools = require('../common/tools')

const parser = new Parser();
const eval = new Evaluator()

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

    let row = await table.selectById(1)

    let nameBuff = Buffer.alloc(32)
    row.copy(nameBuff, 0, 4, 36)
    let name = nameBuff.toString().replace(/^[\s\uFEFF\xA0\0]+|[\s\uFEFF\xA0\0]+$/g, "")
    let age = row.readUInt32LE(36)

    winston.error(`##[1] name = ${name}, age = ${age}`)

    await table.flush()
    await table.close()

    table = new Table(tbname, [], 500)
    await table.init()

    // rows = await table.selectAll()

    let ast = parser.astify("select * from test")
    let disp = await eval.evalSelect(ast)

    console.log(disp)

    await table.close()
}

async function test2() {
    let table = new Table('test', [], 500)
    let out = await table.descTable('test')
    return out
}

const funcList = [
    test1,
    //test2,
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

