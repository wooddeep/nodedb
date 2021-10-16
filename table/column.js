class Column {

    constructor(
        name,
        type,
        keyType = undefined,
        keyName = undefined
    ) {
        this.name = name
        this.type = type
        this.keyType = keyType
        this.keyName = keyName
    }
}

module.exports = Column