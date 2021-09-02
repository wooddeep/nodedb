const bptree = require("./bptree.js");
const fileops = require("./fileops.js");
const constant = require("./const.js");
const winston = require('./winston/config');
const tools = require('./tools')

async function fileOperTest() {
    let fd = await fileops.openFile("lee.db")
    const buffer = Buffer.alloc(10);
    buffer.write("helloworld")
    await fileops.writeFile(fd, buffer, 0, 10)
    await fileops.closeFile(fd)
    let exists = await fileops.existFile("lee.db")
    console.log(exists)
}

async function writeTest() {
    let dbname = "test_80.db"
    let fd = await bptree.init(dbname)
    for (var value = 100; value >= 80; value--) {
        let kbuf = tools.buffer(value)
        await bptree.insert(kbuf, value)
    }
    await bptree.flush(fd)

}

async function findTest(key) {
    let dbname = "test.db"
    await bptree.init(dbname)

    let kbuf = tools.buffer(key)
    let value = bptree.select(kbuf)

    await bptree.close(dbname)
    console.log("value = " + value)
}

async function removeTest(key) {
    let dbname = "test.db"
    let fd = await bptree.init(dbname)

    let kbuf = tools.buffer(key)
    bptree.remove(kbuf)
    await bptree.flush(fd)
}

//writeTest()

//findTest(80)

removeTest(90)
