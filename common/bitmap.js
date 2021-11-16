class BitMap {

    constructor(bitMapSize, buff = undefined) {
        this.bitmap = Buffer.alloc(bitMapSize)
        if (buff == undefined) {
            this.bitmap.fill(0)
        } else {
            buff.copy(this.bitmap, 0)
        }
    }

    getBuff() {
        return this.bitmap
    }

    /*
     * @description: 获取bitmap中，第一个空洞位置
     * @bitmap: bitmap的字节数组
     * @bitsNum: bit数量
     */
    getFirstHole(bitsNum) {
        let bytes = Math.floor(bitsNum / 8) // 整的
        let remain = Math.floor(bitsNum - 8 * bytes) // 余下的
        for (var byteIndex = 0; byteIndex < bytes; byteIndex++) {
            let byte = this.bitmap[byteIndex]
            for (var bitIndex = 7; bitIndex >= 0; bitIndex--) {
                let ret = byte & (0x01 << bitIndex)
                if (ret == 0) {
                    return [byteIndex, bitIndex]
                }
            }
        }

        if (remain == 0) {
            return undefined
        }

        let byte = this.bitmap[bytes] // 最后一个字节，并未填满
        for (var bitIndex = 7; bitIndex >= 8 - remain; bitIndex--) {
            let ret = byte & (0x01 << bitIndex)
            if (ret == 0) {
                return [byteIndex, bitIndex]
            }
        }

        return undefined
    }


    getHoles(bitsNum) {
        let holes = []
        let bytes = Math.floor(bitsNum / 8) // 整的
        let remain = Math.floor(bitsNum - 8 * bytes) // 余下的
        for (var byteIndex = 0; byteIndex < bytes; byteIndex++) {
            let byte = this.bitmap[byteIndex]
            for (var bitIndex = 7; bitIndex >= 0; bitIndex--) {
                let ret = byte & (0x01 << bitIndex)
                if (ret == 0) {
                    holes.push([byteIndex, bitIndex])
                }
            }
        }

        let byte = this.bitmap[bytes] // 最后一个字节，并未填满
        for (var bitIndex = 7; bitIndex >= 8 - remain; bitIndex--) {
            let ret = byte & (0x01 << bitIndex)
            if (ret == 0) {
                holes.push([byteIndex, bitIndex])
            }
        }

        return holes
    }


    /*
     * @description: 填充空洞位置
     */
    fillHole(bitPos) {
        let bytes = Math.floor(bitPos / 8) // 整的
        let remain = Math.floor(bitPos - 8 * bytes) // 余下的

        let byte = this.bitmap[bytes]
        byte = byte | (0x01 << remain)

        this.bitmap[bytes] = byte
    }

}

module.exports = BitMap