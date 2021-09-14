const winston = require('./winston/config');
const Bptree = require("./bptree.js");
const fileops = require("./fileops.js");
const constant = require("./const.js");

const tools = require('./tools')

const bptree = new Bptree()

async function fileOperTest() {
    let fd = await fileops.openFile("lee.db")
    const buffer = Buffer.alloc(10);
    buffer.write("helloworld")
    await fileops.writeFile(fd, buffer, 0, 10)
    await fileops.closeFile(fd)
    let exists = await fileops.existFile("lee.db")
    console.log(exists)
}

async function writeTest(upper, lower) {
    let dbname = "test.db"
    let fd = await bptree.init(dbname)
    for (var value = upper; value >= lower; value--) {
        let kbuf = tools.buffer(value)
        await bptree.insert(kbuf, value)
    }
    await bptree.flush(fd)

}

async function writeOneTest(value) {
    let dbname = "test.db"
    let fd = await bptree.init(dbname)
    let kbuf = tools.buffer(value)
    await bptree.insert(kbuf, value)
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

async function removeOneTest(key) {
    let dbname = "test.db"
    let fd = await bptree.init(dbname)

    let kbuf = tools.buffer(key)
    bptree.remove(kbuf)
    await bptree.flush(fd)
}

async function removeTest(keys) {
    let dbname = "test.db"
    let fd = await bptree.init(dbname)

    keys.forEach(key => {
        let kbuf = tools.buffer(key)
        bptree.remove(kbuf)
        console.log(key)
    });
    await bptree.flush(fd)
}

//writeTest(100, 97)
//writeTest(100, 97)

//writeOneTest(97)
//findTest(85)

//removeTest([100, 99, 98, 97])


removeOneTest(100)
/*removeOneTest(80)
removeOneTest(85)
removeOneTest(90)
*/