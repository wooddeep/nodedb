
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

    for (var value = 97; value >= 97; value--) {
        key.fill(0)
        key.writeInt32LE(value) 
        await bptree.insert(key, value)
    }

    await bptree.flush(fd)
    await fileops.closeFile(fd)
}

dbTest()
