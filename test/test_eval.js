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

    let existed = await Table.existed(tbname)

    let table = new Table(tbname, columns, 500)

    if (!existed) {
        await table.init()
        let value = [1, "lihan", 38]
        await table.insert(value)
    } else {
        await table.init()
    }

    let row = await table.selectById(1)
    let nameBuff = Buffer.alloc(32)
    row.copy(nameBuff, 0, 4, 36)
    let name = nameBuff.toString().replace(/^[\s\uFEFF\xA0\0]+|[\s\uFEFF\xA0\0]+$/g, "")
    let age = row.readUInt32LE(36)

    winston.error(`##[1] name = ${name}, age = ${age}`)

    await table.flush()
    await table.close()

}

async function test2() {
    let ast = parser.astify("insert into test (AID, name, age) values (5, 'apple', 0)")
    let disp = await eval.evalInsert(ast)
    console.log(disp)
    await eval.close()
}

async function test3() {
    let ast = parser.astify("select * from test where AID in (select AID from test)") //"select * from test where AID in (select AID from test)"
    //let ast = parser.astify("select AID, name from test") //"select * from test where AID in (select AID from test)"
    let disp = await eval.evalSelect(ast)
    console.log(disp)
    await eval.close()
}

async function test4() {
    //await cmdline.executeOne("show index from")
    //await cmdline.executeOne("select * from test where AID > (select AID from test where AID = 1)")
    //await cmdline.executeOne("select * from test where AID = 1")
    //await cmdline.executeOne("select * from test where age = 36")
}

async function test5() {
    //await cmdline.executeOne("show index from test")
    //await cmdline.executeOne("CREATE index age_index ON test (age)")
    //let ast = parser.astify("select * from test where AID >=1 and age < 38")

    //let ast = parser.astify("select count(AID), name, age from test group by age")
    //let ast = parser.astify("select count(AID), name, age from test")
    //let ast = parser.astify("select age + 10, AID, name from test")

    let ast = parser.astify("select test.AID, test.name, test.age, demo.title from test left join demo on test.AID = demo.test_id")
    //let ast = parser.astify("select * from test")
    console.dir(ast, { depth: null, colors: true })
    //let disp = await eval.evalSelect(ast)
    //console.log(disp)
    //await eval.close()    
}

const funcList = [
    //test1,
    //test2,
    //test3,
    //test4,
    test5
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

