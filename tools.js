const constant = require("./const.js");

function buffer(key) {
    let buffer = Buffer.alloc(constant.KEY_MAX_LEN)
    buffer.fill(0)
    buffer.writeInt32LE(key)
    return buffer
}

function int32le(kbuf, pos = 0) {
    var value = kbuf.readInt32LE(pos)
    return value
}

const tools = {
    buffer: buffer,
    int32le: int32le,
}

module.exports = tools;