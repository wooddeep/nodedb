const tools = require('../common/tools');

var data = tools.tableDisplayData(['tables'], [['test'], ['demo']])

console.log(data)

data = tools.tableDisplayData(['Field', 'Type'], [['id', '1'], ['name', '2']])

console.log(data)

const Table = require("../table/table.js")

var table = new Table()

table.descTable(`test`)