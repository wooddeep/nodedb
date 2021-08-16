
const bptree = require("./bptree.js");
const constant = require("./const.js");
const fileops = require("./fileops.js");

async function fileOperTest() {
    // let fd = await fileops.openFile("lee.db")
    // const buffer = Buffer.alloc(10);
    // buffer.write("helloworld")
    // await fileops.writeFile(fd, buffer, 0, 10)
    // await fileops.closeFile(fd)

    let exists = await fileops.existFile("lee.db")
    console.log(exists)

}

async function dbTest() {
    let fd = await bptree.init("test.db")
    let key = Buffer.alloc(constant.KEY_MAX_LEN)
    key.writeInt32LE(100) // 键值100序列化
    await bptree.insert(key, 100)
    await bptree.flush(fd)
    await fileops.closeFile(fd)
}

dbTest()
