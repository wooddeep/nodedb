class Column {

    constructor(
        name,
        type, // 0 ~ int, 1 ~ float, 2 ~ string
        typeAux, // 字符串长度
        keyType = undefined,
        keyName = undefined
    ) {
        this.name = name
        this.type = type
        this.keyType = keyType
        this.keyName = keyName
        this.typeAux = typeAux
    }
}

module.exports = Column