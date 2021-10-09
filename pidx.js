const winston = require('./winston/config')

class PageIndex {

    static set(mi) {
        PageIndex.maxIndex = mi
    }

    static get() {
        return PageIndex.maxIndex
    }

    static incr() {
        PageIndex.maxIndex++
    }
}

PageIndex.maxIndex = 0
module.exports = PageIndex;