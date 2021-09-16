const winston = require('./winston/config');
const Bptree = require("./bptree.js");
const fileops = require("./fileops.js");
const constant = require("./const.js");
const Buffer = require("./buffer.js");
const tools = require('./tools')

const bptree = new Bptree()

const buffer = new Buffer(1)

async function fileOperTest() {
    let fd = await fileops.openFile("lee.db")
    const buffer = Buffer.alloc(10);
    buffer.write("helloworld")
    await fileops.writeFile(fd, buffer, 0, 10)
    await fileops.closeFile(fd)
    let exists = await fileops.existFile("lee.db")
    winston.info(exists)
}

async function writeTest(upper, lower) {
    for (var value = upper; value >= lower; value--) {
        let kbuf = tools.buffer(value)
        await bptree.insert(kbuf, value)
    }
}

async function writeOneTest(value) {
    let kbuf = tools.buffer(value)
    await bptree.insert(kbuf, value)
}

async function findTest(key) {
    let kbuf = tools.buffer(key)
    let value = bptree.select(kbuf)
    winston.info("value = " + value)
}

async function removeOneTest(key) {
    let kbuf = tools.buffer(key)
    bptree.remove(kbuf)
}

async function removeTest(keys) {
    keys.forEach(key => {
        let kbuf = tools.buffer(key)
        bptree.remove(kbuf)
        winston.info(`key = $key`)
    })
}

async function test() {
    
    await bptree.init("test.db")

    await writeOneTest(1)

    await bptree.flush()
    
    await bptree.close()
}

test()

// writeTest(100, 97)
// writeTest(100, 97)
// removeTest([100, 99, 98, 97])
// writeOneTest(100)
// writeOneTest(99)

//findTest(99)
//removeOneTest(100)
//buffer.addPageNode(1)
