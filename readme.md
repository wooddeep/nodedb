## 1. 概述 
基于nodejs的b+树的实现，目前实现了节点的插入，后续待逐步实现删除。计划在完全实现b+树后，以b+树的基于实现一个kv存储，目前准备完善中！文档后续补上！
</br>

## 2. 运行 
创建数据库，并插入100到80的数据，键和值相同：

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
</br>

## 3. 图解
设计每个页节点，最多可以放入3个数据，order为3  

### 插入98:   
![98 图标](image/98.png)  
</br>

### 插入97未分裂:   
![98 图标](image/97-pre.png)  
</br>

###  插入97分裂:    
节点内数据个数为4， 大于order数目，需要对节点数据分裂，分裂后，左右点数据为97、98，右节点数据为99、100，分别取两个节点的最大值98，100，抽取作为父节点的数据：  

![98 图标](image/97.png)  
</br>


