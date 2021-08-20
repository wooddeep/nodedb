基于nodejs的b+树的实现，目前实现了节点的插入，后续待逐步实现删除。计划在完全实现b+树后，以b+树的基于实现一个kv存储，目前准备完善中！文档后续补上！

测试:
</br>


1. 创建数据库，并插入100到80的数据，键和值相同：
```javascript
const bptree = require("./bptree.js");
const constant = require("./const.js");

async function dbTest() {
    let dbname = "test.db"
    let fd = await bptree.init(dbname)
    for (var value = 100; value >= 80; value--) {    // 先定位指针的问题
        let key = Buffer.alloc(constant.KEY_MAX_LEN) // 键值序列化为buf, 小端存储  
        key.fill(0)
        key.writeInt32LE(value)
        await bptree.insert(key, value)
    }
    await bptree.flush(fd)
    //await bptree.close(dbname)
}

dbTest()
```

