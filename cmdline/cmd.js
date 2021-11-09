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
    let out = await table.descTable(arr[arr.length - 1].replace(/[;,]+/, ''))
    return out
})


var cmd = {
    showTables: showTables,
    descTable: descTable,
    cmds: [showTables, descTable],
}

module.exports = cmd;
