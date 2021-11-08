const Table = require("../table/table.js")

class Command {
    constructor(arr, exe) {
        this.cmdarr = arr
        this.execute = exe
    }
}

var showTables = new Command(["show", "tables"], async () => {
    let table = new Table()
    let out = await table.showTables()
    //console.log(out)
    return out
})

var cmd = {
    cmds: [showTables],
}

module.exports = cmd;

//module.exports = Command