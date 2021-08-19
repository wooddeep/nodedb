const bptree = require("./bptree.js");
const fileops = require("./fileops.js");
const constant = require("./const.js");

async function fileOperTest() {
    let fd = await fileops.openFile("lee.db")
    const buffer = Buffer.alloc(10);
    buffer.write("helloworld")
    await fileops.writeFile(fd, buffer, 0, 10)
    await fileops.closeFile(fd)
    let exists = await fileops.existFile("lee.db")
    console.log(exists)
}

async function dbTest() {
    let dbname = "test.db"
    let fd = await bptree.init(dbname)
    for (var value = 92; value >= 92; value--) {    // 先定位指针的问题
        let key = Buffer.alloc(constant.KEY_MAX_LEN)
        key.fill(0)
        key.writeInt32LE(value)
        await bptree.insert(key, value)
        await bptree.flush(fd)
    }
    await bptree.close(dbname)
}

dbTest()
