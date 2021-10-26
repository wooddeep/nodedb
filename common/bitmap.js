class BitMap {

    constructor() {

    }

    /*
     * @description: 获取bitmap中，第一个空洞位置
     * @bitmap: bitmap的字节数组
     * @bitsNum: bit数量
     */
    getFirstHole(bitmap, bitsNum) {
        let bytes = Math.floor(bitsNum / 8) // 整的
        let remain = Math.floor(bitsNum - 8 * bytes) // 余下的
        for (var byteIndex = 0; byteIndex < bytes; byteIndex++) {
            let byte = bitmap[byteIndex]
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

        let byte = bitmap[bytes] // 最后一个字节，并未填满
        for (var bitIndex = 7; bitIndex >= 8 - remain; bitIndex--) {
            let ret = byte & (0x01 << bitIndex)
            if (ret == 0) {
                return [byteIndex, bitIndex]
            }
        }

        return undefined
    }


    getHoles(bitmap, bitsNum) {
        let holes = []
        let bytes = Math.floor(bitsNum / 8) // 整的
        let remain = Math.floor(bitsNum - 8 * bytes) // 余下的
        for (var byteIndex = 0; byteIndex < bytes; byteIndex++) {
            let byte = bitmap[byteIndex]
            for (var bitIndex = 7; bitIndex >= 0; bitIndex--) {
                let ret = byte & (0x01 << bitIndex)
                if (ret == 0) {
                    holes.push([byteIndex, bitIndex])
                }
            }
        }

        let byte = bitmap[bytes] // 最后一个字节，并未填满
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
    fillHole(bitmap, bitPos) {
        let bytes = Math.floor(bitPos / 8) // 整的
        let remain = Math.floor(bitPos - 8 * bytes) // 余下的

        let byte = bitmap[bytes]
        byte = byte | (0x01 << (7 - remain))

        bitmap[bytes] = byte
    }

}

module.exports = BitMap