const winston = require('../winston/config')

class PageIndex {

    constructor(mi = 0) {
        this.maxIndex = mi
    }

    set(mi) {
        this.maxIndex = mi
    }

    get() {
        return this.maxIndex
    }

    incr() {
        this.maxIndex++
    }
}

module.exports = PageIndex;