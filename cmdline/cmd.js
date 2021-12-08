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


var showIndex = new Command(["show", "index", "from"], async (arr) => {
    if (arr.length < 4) {
        throw new Error(`no table name!`) 
    }
    
    let out = await eval.showIndex(arr[3])

    return out
})

var descTable = new Command(['describe'], async (arr) => {
    if (arr.length < 2) {
        throw new Error(`no table name!`)
    }
    let out = await table.descTable(arr[arr.length - 1])
    return out
})


// CREATE TABLE IF NOT EXISTS `runoob_tbl`( `runoob_id` INT UNSIGNED AUTO_INCREMENT,`runoob_title` CHAR(100) NOT NULL,PRIMARY KEY ( `runoob_id`));
var createTable = new Command(['create', 'table'], async (ast) => {
    //let keyword = ast.keyword
    let out = await eval.evalCreateTable(ast)
    return out
})

var createIndex = new Command(['create', 'index'], async (ast) => {
    //let keyword = ast.keyword
    let out = await eval.evalCreateIndex(ast)
    return out
})

const createMap = { 'table': createTable, 'index': createIndex }
var create = new Command(['create'], async (ast) => {
    let keyword = ast.keyword
    return await createMap[keyword].execute(ast)
})

var dropTable = new Command(['drop', 'table'], async (ast) => {
    let out = await eval.evalDropTable(ast)
    return out
})

var dropIndex = new Command(['drop', 'index'], async (ast) => {
    //let keyword = ast.keyword
    let out = await eval.evalDropIndex(ast)
    return out
})

const dropMap = { 'table': dropTable, 'index': dropIndex }

var drop = new Command(['drop'], async (ast) => {
    // console.dir(ast, {depth: null, colors: true})
    let keyword = ast.keyword
    return await dropMap[keyword].execute(ast)
})

// insert into test (AID, name, age) values (1, "cao", 36);
var insert = new Command(['insert', 'into'], async (ast) => {
    //console.dir(ast, {depth: null, colors: true})
    let out = await eval.evalInsert(ast)
    return out
})

var select = new Command(['select'], async (ast) => {
    let out = await eval.evalSelect(ast)
    return out
})

function quit() {
    eval.close()
}

var command = {
    set: [showTables, descTable, showIndex],
    map: {
        'create': create, 'drop': drop, 'desc': descTable,
        'insert': insert, 'select': select, 'quit': quit
    },
}

module.exports = command;
