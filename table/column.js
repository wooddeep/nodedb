const {
    COL_NAME_LEN,
    KEY_NAME_LEN,
} = require("../common/const")

class Column {

    constructor(
        name = "",
        type = 0, // 0 ~ int, 1 ~ float, 2 ~ string
        typeAux = 0, // 字符串长度
        keyType = 0, // 0 ~ null, 1 ~ primary key, 2 ~ unique key, 3 ~ key
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
}

module.exports = Column