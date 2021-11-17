const {
    COL_NAME_LEN,
    KEY_NAME_LEN,
    COL_TYPE_INT,
    KEY_TYPE_NULL,
} = require("../common/const")

class Column {

    constructor(
        name = "",
        type = COL_TYPE_INT, // 0 ~ int, 1 ~ float, 2 ~ string
        typeAux = 0, // 字符串长度
        keyType = KEY_TYPE_NULL, // 0 ~ null, 1 ~ primary key, 2 ~ unique key, 3 ~ key
        keyName = ""
    ) {
        this.name = Buffer.alloc(COL_NAME_LEN)
        this.name.write(name)
        this.type = type
        this.typeAux = typeAux
        this.keyType = keyType
        this.keyName = Buffer.alloc(KEY_NAME_LEN)
        this.keyName.write(keyName)
    }

    size() {
        switch (this.type) {
            case 0: return 4;
            case 1: return 4;
            case 2: return this.typeAux;
            default: return 4;
        }
    }

    getType() {
        switch (this.type) {
            case 0: return "integer";
            case 1: return "float";
            case 2: return "string";
            default: return "error";
        }
    }

    getKeyType() {
        switch (this.keyType) {
            case 0: return "no";
            case 1: return "primary key";
            case 2: return "unique key";
            case 3: return "key";
            default: return "error";
        }
    }

    getFieldName() {
        return this.name.toString().replace(/^[\s\uFEFF\xA0\0]+|[\s\uFEFF\xA0\0]+$/g, "")
    }

    setKeyType(type) {
        this.keyType = type
    }

    setKeyName(name) {
        if (name == undefined) return
        this.keyName.fill(0)
        this.keyName.write(name)
    }

    getKeyName() {
        return this.keyName.toString().replace(/^[\s\uFEFF\xA0\0]+|[\s\uFEFF\xA0\0]+$/g, "")
    }
}

module.exports = Column