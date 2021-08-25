const constant = require("./const.js");

function buffer(key) {
    let buffer = Buffer.alloc(constant.KEY_MAX_LEN)
    buffer.fill(0)
    buffer.writeInt32LE(key)
    return buffer
}

const tools = {
    buffer: buffer,
}

module.exports = tools;