const bptree = require("./bptree.js");
const fileops = require("./fileops.js");
const constant = require("./const.js");
const winston = require('./winston/config');

async function fileOperTest() {
    let fd = await fileops.openFile("lee.db")
    const buffer = Buffer.alloc(10);
    buffer.write("helloworld")
    await fileops.writeFile(fd, buffer, 0, 10)
    //await fileops.closeFile(fd)
    let exists = await fileops.existFile("lee.db")
    console.log(exists)
}

async function writeTest() {
    let dbname = "test.db"
    let fd = await bptree.init(dbname)
    for (var value = 100; value >= 80; value--) {
        let key = Buffer.alloc(constant.KEY_MAX_LEN)
        key.fill(0)
        key.writeInt32LE(value)
        await bptree.insert(key, value)
        //await bptree.flush(fd)
    }
    await bptree.flush(fd)
    //await bptree.close(dbname)
}

async function findTest(key) {
    let dbname = "test.db"
    let fd = await bptree.init(dbname)
    let keyBuf = Buffer.alloc(constant.KEY_MAX_LEN)
    keyBuf.fill(0)
    keyBuf.writeInt32LE(key)
    let value = bptree.select(keyBuf)
    await bptree.close(dbname)
    console.log("value = " + value)
}

//winston.info('You have successfully started working with winston and morgan');
findTest(85)

