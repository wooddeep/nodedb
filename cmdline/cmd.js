const Table = require("../table/table.js")
let table = new Table()

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

// {
//     type: 'insert',
//     table: [ { db: null, table: 'test', as: null } ],
//     columns: [ 'AID', 'name', 'age' ],
//     values: [ { type: 'expr_list', value: [Array] } ],
//     partition: null,
//     on_duplicate_update: null
// }
var insert = new Command(['insert', "into"], async (ast) => {
    console.log(JSON.stringify(ast))
    return ""
})


var command = {
    set: [showTables, descTable],
    map: { 'desc': descTable, 'insert': insert },
}

module.exports = command;
