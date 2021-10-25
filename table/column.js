class Column {

    constructor(
        name,
        type, // 0 ~ int, 1 ~ float, 2 ~ string
        typeAux, // 字符串长度
        keyType = undefined, // 0 ~ null, 1 ~ primary key, 2 ~ unique key, 3 ~ key
        keyName = undefined
    ) {
        this.name = name
        this.type = type
        this.keyType = keyType
        this.keyName = keyName
        this.typeAux = typeAux
    }

    size() {
        switch(this.type) {
            case 0: return 4;
            case 1: return 4;
            case 2: return this.typeAux;
            default: return 4;
        }
    }
}

module.exports = Column