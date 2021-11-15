const Table = require("../table/table.js")
const Evaluator = require("./eval.js")

let table = new Table()
let eval = new Evaluator()

class Command {
    constructor(arr, exe) {
        this.cmdarr = arr
        this.execute = exe
    }
}

var showTables = new Command(["show", "tables"], async (arr) => {
    let out = await table.showTables()
    return out
})

var descTable = new Command(['describe'], async (arr) => {
    if (arr.length < 2) {
        throw new Error(`no table name!`)
    }
    let out = await table.descTable(arr[arr.length - 1])
    return out
})

// insert into test (AID, name, age) values (1, "cao", 36);

var insert = new Command(['insert', 'into'], async (ast) => {
    console.dir(ast, {depth: null, colors: true})
    return ""
})

var select = new Command(['select'], async (ast) => {
    //console.dir(ast, {depth: null, colors: true})
    eval.evalSelect(ast)
    return ""
})

var command = {
    set: [showTables, descTable],
    map: { 'desc': descTable, 'insert': insert, 'select': select},
}

module.exports = command;
