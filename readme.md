<!-- https://ecotrust-canada.github.io/markdown-toc/ -->
- [1. 说明](#1-说明)
- [2. 目录说明](#2-目录说明)
- [3. 设计及实现](#3-设计及实现)
  - [3.1 b+树](#31-b树)
    - [3.1.1 页结构](#311-页结构)
      - [页节点布局及关系：](#页节点布局及关系)
        - [页节点结构说明](#页节点结构说明)
        - [页节点关系说明](#页节点关系说明)
      - [页节点存储说明](#页节点存储说明)
    - [3.1.2 页节点插入](#312-页节点插入)
    - [3.1.2 叶结点删除](#312-叶结点删除)
    - [3.1.3 叶结点查询](#313-叶结点查询)
    - [3.1.4 空闲节点管理](#314-空闲节点管理)
    - [3.1.5 buffer管理](#315-buffer管理)
  - [3.2 数据表](#32-数据表)
- [4. 测试](#4-测试)
  - [4.1 测试b+树](#41-测试b树)
  - [4.2 测试数据表](#42-测试数据表)

## 1. 说明 
任何一个应用系统中，数据库都处于核心的地位。不管是业务逻辑的设计，系统性能的优化最终都归结于数据库的选型和表设计。而数据库的引擎核心在于b+树，为了厘清b+树的底层原理，我准备从零开始手撸一颗b+树，并计划将来在该b+树的基础上，实现一个简单的kv存储的玩具，如果有机会的话，还可以引入sql的解析，让这个玩具更加逼真。为了劲量的降低开发难度，首先采用nodejs来实现这颗b+树，在原型验证通过之后，可以考虑切换到其他语言。目前已经实现了b+树节点的增删查改、磁盘文件的持久化，其余功能准备完善中！
</br>

## 2. 目录说明
```bash
winston/   # 引用三方日志组件
common/    # 通用包: 包括工具, 缓存管理, 常量定义, 文件操作, page管理基础类等
bptree/    # b+树包
table/     # rdbms 数据库表相关包
data/      # 生成数据库相关文件目录
test/      # 测试程序路径
```
</br>

## 3. 设计及实现
### 3.1 b+树

#### 3.1.1 页结构
 
##### 页节点布局及关系：  

|图1. 页节点内部布局          |图2.  叶结点之间关系
:-------------------------:|:-------------------------:
![](image/page-struct.png) |  ![](image/page-relation.png)

###### 页节点结构说明
其中页的类型定义如下：
```javascript
const NODE_TYPE_LEAF = 0  // 叶结点
const NODE_TYPE_STEM = 1  // 茎节点
const NODE_TYPE_ROOT = 2  // 根节点
const NODE_TYPE_DATA = 3  // 数据节点
const NODE_TYPE_FREE = -1 // 空闲叶结点
```

如图1所示，为叶结点内部结构，页节点的头6个字段分别存储的为页类型、父页节点下标、兄页节点下标、弟叶结点下标、父节点CELL索引(即由父节点的哪个VAL代表的下标所指向)，节点内已经填充的数据个数，前4个字段各4个字节，以小端模式存储，后两个字段各2个字节。这6个字段长度的定位在const.js文件中如下：  
```javascript
const PAGE_TYPE_LEN = 4       // 代表类型的字节数
const PAGE_PARENT_IDX_LEN = 4 // 父节点索引的字节数
const PAGE_NEXT_IDX_LEN = 4   // 兄节点索引的字节数
const PAGE_PREV_IDX_LEN = 4   // 弟节点索引的字节数
const PARENT_CELL_IDX_LEN = 2 // 父节点CELL的索引
const CELL_USED_LEN = 2       // 使用键值数的字节数
```

从每页的第20（4 * 5）个字节开始, 便存储的是页的具体数据，以键值对（KEY：VAL）的形式，存储的页的数据。其中，若页的类型为2或者1， 则VAL存储的是子节点的页节点下标，若页类型为0，则VAL存储的是具体的数值, 这里设计存储4字节数据，后续可扩展。其中键和值的所占字节长度定义在const.js文件中：   
```javascript
const KEY_MAX_LEN = 9    // 键值长度
const VAL_TYPE_LEN = 1   // 值类型长度
const VAL_IDX_LEN = 4    // 值数据长度, 如果中间节点指向子页面, 叶子节点指向值
```

其中，VAL包括两个部分(type: value), type即为数据的类型， value为数据的实际值，type的定义在const.js中:
```javascript
const VAL_TYPE_IDX = 0 // 非叶子节点存储子节点索引
const VAL_TYPE_NUM = 1 // 叶子节点存储内容为数字
const VAL_TYPE_STR = 2 // 叶子节点存储内容为字符串
const VAL_TYPE_FPN = 3 // 叶子节点存储内容为浮点数
const VAL_TYPE_OBJ = 4 // 叶子节点存储内容为对象
const VAL_TYPE_UNK = 5 // 未知
```

为了调试方便，设置页的大小为64，这样，可计算出每页中最大的键值对个数为3，即ORDER_NUM，这个数称为b+数的阶，定义在const.js文件中；当然实际的b+树页面不可能只存三个数据，可以增加PAGE_SIZE值来增加页面存储数据的个数。在调试成功之后，可以扩大PAGE_SIZE, 以增加每页可存储的数据：
```javascript
const PAGE_SIZE = 64 // 页大小
const PAGE_TYPE_OFFSET = 0    // 页类型页内偏移
const PAGE_PARENT_OFFSET = PAGE_TYPE_OFFSET + PAGE_TYPE_LEN       // 页类型页内偏移
const PAGE_NEXT_OFFSET = PAGE_PARENT_OFFSET + PAGE_PARENT_IDX_LEN // 父索引页内偏移
const PAGE_PREV_OFFSET = PAGE_NEXT_OFFSET + PAGE_NEXT_IDX_LEN     // 兄索引页内偏移
const PARENT_CELL_OFFSET = PAGE_PREV_OFFSET + PAGE_PREV_IDX_LEN   // 父节点CELL索引偏移
const CELL_USED_OFFSET = PARENT_CELL_OFFSET + PARENT_CELL_IDX_LEN // 弟索引页内偏移
const CELL_OFFSET = CELL_USED_OFFSET + CELL_USED_LEN              // 存KV值的页内偏移
const HEAD_LEN = CELL_OFFSET  

const CELL_LEN = KEY_MAX_LEN + VAL_IDX_LEN                        // 每一对KV的长度

const ORDER_NUM = Math.floor((PAGE_SIZE - HEAD_LEN) / CELL_LEN)   // b+树的阶
const LESS_HALF_NUM = Math.floor(ORDER_NUM / 2)  // 少的一半
const MORE_HALF_NUM = Math.ceil(ORDER_NUM / 2)   // 多的一半

```

###### 页节点关系说明
如图2所示，每个页节点的PARENT存储父节点的节点下标，NEXT存储兄节点的节点下标，PREV存储弟节点的节点下标，若节点类型非页节点，则VAL存储子节点的节点下标，通过PARENT, NEXT, PREV, VAL这些节点下标, 则可以把所有的节点组成树形结构。 

</br>  


##### 页节点存储说明
数据按页连续存入单文件中，第1页的范围为0-63byte, 页下标为0，第2页的范围为64-127byte，页下标为1，依次类推，以插入数据100为例，存储文件以16进制dump出来显示如下：  
<div align=center>
<img src="image/100-store.png" alt="drawing" width="100%"/>  
</div>
<p align="center">图 3. 存储文件十六进制dump</p>

</br>
上图是存储bin文件的16进制显示，为了便于理解，把上图进行更加详细的标注和说明，按第一页和第二页分开说明：
<div align=center>
<img src="image/100-store-analys.png" alt="drawing" width="100%"/>  
</div>
<p align="center">图 4. 存储文件十六进制详解</p>
</br>


&nbsp;&nbsp;&nbsp;&nbsp;结合页存储布局图可见，第1页的类型为2，说明是根节点，其兄、弟节点索引都是0xFFFFFFFF代表无所指，USED字段值为0，代表数据节点有1个被用，已知设计叶结点的数据从小到大排列，这里只有1个数据(100, 十六进制0x64)，故而把100存在下标为ORDER_NUM - 1 的位置，因为设计页的ORDER_NUM为3，故而100存在下标为2的位置，由前面的说明知道，键长度为10，这里如图即为：64 00 00 00 00 00 00 00 00 00(代表键100), 而值长度为4，这里如图即为: 01 00 00 00(代表值1)，因为本页为根节点，所以这里的1代表子节点的下标为1即第二页.   
</br>
&nbsp;&nbsp;&nbsp;&nbsp;第2页的类型为0，说明是叶节点，其父节点为0，代表其父节点为第1页，USED字段值为1，代表数据节点有1个被用，由前面的说明知道，把100存在下标为ORDER_NUM - 1 的位置，键长度为10，这里如图即为：64 00 00 00 00 00 00 00 00 00(代表键100), 而值长度为4，这里如图即为: 64 00 00 00(代表值100)，因为本页为页节点，所以这里的64代表具体的数值.  

</br>


#### 3.1.2 页节点插入
选取具有代表性的步骤进行说明，已知节点的阶为3，故而如果插入节点的数据超过3，就需要对节点进行分裂，生成两个节点，新节点的最大值提取出来，再插入到父节点，父节点的个数也会增加，所以也需要对父节点进行分裂判断和操作，这样一直向上进行分裂判断和操作，直到根节点，如果根节点的数据个数也超过了阶数，则需要对根节点进行分裂，以形成新的根节点；如果插入的数据大于根节点的最大数据，则需要从叶子节点向上回溯，更新所有相关节点的最大值。 
</br>

|图5. 插入100 到 98  |图6.  插入97分离前  | 图7. 插入97后分裂|
:-------------------------:|:-------------------------:|-------------------------:
![](image/100-98.png)      |  ![](image/100-97-pre.png)|  ![](image/100-97.png)


**a. 插入100到98:**

如图5所示，插入100，99，98 三个数据到数据节点，3个数据等于数据节点的阶数，故而可以放在一个叶子节点中，根节点的用一对KV：V指向叶子节点， K即100(所指向叶子节点中数据最大值)。

**b. 插入97未分裂:**    

如图6所示：继续插入数据97，此时数据节点中数据的个数为4，需要进行分裂操作

**c. 插入97分裂:**      

如图8所示：节点内数据个数为4， 大于order数目，需要对节点数据分裂，分裂后，左右点数据为97、98，右节点数据为99、100，分别取两个节点的最大值98，100，抽取作为父节点的数据：  

|图8. 插入96  |图9.  插入95分离前  | 图10. 插入95后分裂|
:-------------------------:|:-------------------------:|-------------------------:
![](image/100-96.png)      |  ![](image/100-95-pre.png)|  ![](image/100-95.png)

**d. 插入96:**

如图5所示，插入96后，96，97，98三个数据等于数据节点的阶数，故而可以放在一个叶子节点中。

**e. 插入95未分裂:**    

如图9所示：继续插入数据95，此时数据节点中数据的个数为4，需要进行分裂操作

**f. 插入95分裂:**      

如图10所示：对节点进行分裂，分裂后，左右点数据为95、96，右节点数据为97、98，分别取两个节点的最大值96，98，抽取作为父节点的数据。此时根节点有三个cell被使用：96，98，100。

**g. 继续插入:** 

同理，当继续插入时，会对根节点进行分裂，形成新的根节点，以保持节点的数据个数不大于节点阶数，最终插入到80后，形成的b+树如图11所示。
<div align=center>
<img src="image/100-80.png" alt="drawing" width="100%"/>  
</div>
<p align="center">图 11. 插入到80</p>
</br>

**h. 插入101:** 

如图12所示：插入101，此时101大于根节点的最大值，需要从叶结点向根节点回溯，更新相关节点最大值。
<div align=center>
<img src="image/101-pre.png" alt="drawing" width="100%"/>  
</div>
<p align="center">图 12. 插入101未更新最大值</p>
</br>

**i. 插入101后更新最大值:** 

如果13所示：更新最大值后的最终结果。
<div align=center>
<img src="image/101.png" alt="drawing" width="100%"/>  
</div>
<p align="center">图 13. 插入101最终效果</p>
</br>


#### 3.1.2 叶结点删除
叶结点删除较为复杂，1)首先找到存储该数据所在的叶节点，如果改节点的数据个数大于阶数的一般，则做删除操作不会破坏b+树，可以直接删除；


</br>

#### 3.1.3 叶结点查询
TODO

</br>

#### 3.1.4 空闲节点管理
TODO

</br>

#### 3.1.5 buffer管理
TODO

</br>

### 3.2 数据表
TODO

</br>

## 4. 测试
测试的demo文件在test目录下面，test_bptree.js用于测试b+树，test_table.js用于测试数据库, 直接执行:
```bash
node test_bptree.js  # 测试b+树
node test_tables.js  # 测试表
```
测试生成的数据，存储在data目录，在任何路径下执行test_bptree.js、test_tables.js的数据都放在根目录下的data目录

</br>

### 4.1 测试b+树
```javascript
const { PAGE_SIZE } = require('../common/const');
const winston = require('../winston/config');
const Bptree = require("../bptree/bptree");
const tools = require('./test_tools');
const assert = require('assert');

async function test0() {
    let bptree = new Bptree(4)
    let dbname = "test.db"
    await bptree.drop(dbname)
    await bptree.init(dbname)
    await tools.writeRange(bptree, 1000, 1)
    await bptree.flush()
    let value = await tools.find(bptree, 100)
    assert.equal(value, 100)
    winston.error(`$$ the buffer's final size is: ${bptree.getBuffer().buffSize()}`)
    await bptree.close()
}

async function test1() {
    let bptree = new Bptree(2)
    let dbname = "test.db"
    await bptree.drop(dbname)
    await bptree.init(dbname)

    await tools.writeRange(bptree, 100, 97)
    await tools.removeAny(bptree, [100, 99, 98, 97])
    await tools.writeOne(bptree, 100, 100)
    await tools.writeOne(bptree, 99, 99)

    let value = await tools.find(bptree, 100)
    assert.equal(value, 100)

    value = await tools.find(bptree, 98)
    assert.equal(value, undefined)

    await bptree.flush()
    await bptree.close()
}

async function test2() {
    let bptree = new Bptree(300)
    let dbname = "test.db"
    try {
        await bptree.drop(dbname)
    } catch (e) {
        winston.warn(`drop error!`)
    }

    await bptree.init(dbname)

    await tools.writeRange(bptree, 100000, 0)

    for (var i = 0; i < 100000; i++) {
        let value = await tools.find(bptree, i)
        assert.equal(value, i)
    }

    await bptree.flush()
    winston.error(`$$ the buffer's final size is: ${bptree.getBuffer().buffSize()}`)
    await bptree.close()
}

async function test3() {
    let bptree = new Bptree(10)
    let dbname = "test.db"
    try {
        await bptree.drop(dbname)
    } catch (e) {
        winston.warn(`drop error!`)
    }

    await bptree.init(dbname)

    await tools.writeRange(bptree, 0, 1000)
    for (var i = 0; i < 1000; i++) {
        let value = await tools.find(bptree, i)
        assert.equal(value, i)
    }

    await tools.removeRange(bptree, 0, 1000)
    winston.error(`$$ the buffer's final size is: ${bptree.getBuffer().buffSize()}`)
    await bptree.flush()
    await bptree.close()
}

/* dynamic data insert and delete test! */
async function test4() {
    let bptree = new Bptree(50)
    let array = []
    let number = array.length > 0 ? array.length : 1000
    if (array.length == 0) {
        for (var i = 0; i < number; i++) {
            array.push(tools.random(0, 1000))
        }
    }
    winston.error(array)

    let dbname = "test.db"
    try {
        await bptree.drop(dbname)
    } catch (e) {
        winston.warn(`drop error!`)
    }

    await bptree.init(dbname)
    await tools.writeAny(bptree, array)

    for (var i = 0; i < number; i++) {
        let key = array[i]
        let value = await tools.find(bptree, key)
        winston.error(`# find: key:${key} => value:${value}`)
        assert.equal(value, key)
    }

    await tools.removeAny(bptree, array)
    await bptree.flush()
    await bptree.close()
}

async function test5() {
    let bptree = new Bptree(50)
    let array = []
    let number = array.length > 0 ? array.length : 1000
    if (array.length == 0) {
        for (var i = 0; i < number; i++) {
            array.push(tools.random(0, 1000))
        }
    }
    winston.info(array)

    let dbname = "test.db"
    try {
        await bptree.drop(dbname)
    } catch (e) {
        winston.warn(`drop error!`)
    }

    await bptree.init(dbname)
    await tools.writeAny(bptree, array)

    for (var i = 0; i < number; i++) {
        let key = array[i]
        let value = await tools.find(bptree, key)
        winston.info(`# find: key:${key} => value:${value}`)
        assert.equal(value, key)
    }

    for (var i = 0; i < number; i++) {
        let pos = tools.random(0, array.length - 1)
        let key = array[pos]
        let value = await tools.removeOne(bptree, key)
        array.splice(pos, 1)
    }

    await bptree.flush()
    await bptree.close()
}

/* 测试value为字符串 */
async function test6() {
    let bptree = new Bptree(3, 1024, 9, 100)
    let dbname = "test.db"
    await bptree.drop(dbname)
    await bptree.init(dbname)
    await tools.writeOne(bptree, 100, 'hello world')
    await bptree.flush()
    let value = await tools.find(bptree, 100)
    assert.equal(value, 'hello world')
    await bptree.close()
}

/* 测试value为浮点数 */
async function test7() {
    let bptree = new Bptree(3)
    let dbname = "test.db"
    await bptree.drop(dbname)
    await bptree.init(dbname)
    await tools.writeOne(bptree, 100, 1.2345)
    await bptree.flush()
    let value = await tools.find(bptree, 100)
    winston.error(`## map[100] = ${value}`)
    await bptree.close()
}

async function test8() {
    let bptree = new Bptree(100, PAGE_SIZE, 4, 6)
    let dbname = "test.db"
    await bptree.drop(dbname)
    await bptree.init(dbname)

    let buff = Buffer.alloc(6)
    buff.writeUInt32LE(10, 0)
    buff.writeUInt16LE(1, 4)

    await tools.writeOne(bptree, 100, buff)
    await bptree.flush()
    let value = await tools.find(bptree, 100)

    let pageIndex = value.readUInt32LE()
    let slotIndex = value.readUInt16LE(4)

    winston.error(`## pageIndex = ${pageIndex}, slotIndex= ${slotIndex}`)

    await bptree.close()
}

const funcList = [
    test0,
    test1,
    test2,
    test3,
    test4,
    test5,
    test6,
    test7,
    test8,
]

async function test() {
    for (var i = 0; i < funcList.length; i++) {
        func = funcList[i]
        winston.error(`>>>>>>>>>(${func.name})`)
        await func()
        winston.error(`<<<<<<<<<(${func.name})`)
    }
}

test()

```
</br>

### 4.2 测试数据表
```javascript
const winston = require('../winston/config');
const Table = require("../table/table.js")
const Column = require("../table/column")
const assert = require('assert');


// 数据插入表中，并读取测试，作为测试，索引添加在AID之上, 索引尚不可配置
async function test0() {
    let tbname = "test"
    let columns = []
    col0 = new Column("AID", 0, undefined, 1, "key0")
    col1 = new Column("name", 2, 32, 0, undefined)    // 最大长度为32
    col2 = new Column("age", 0, undefined, 0, undefined)

    columns.push(col0)
    columns.push(col1)
    columns.push(col2)

    let table = new Table(tbname, columns, 500)
    await table.drop()
    await table.init()

    let value = [1, "lihan", 38]

    await table.insert(value)

    let row = await table.selectById(1)

    let nameBuff = Buffer.alloc(32)
    row.copy(nameBuff, 0, 4, 36)
    let name = nameBuff.toString().replace(/^[\s\uFEFF\xA0\0]+|[\s\uFEFF\xA0\0]+$/g, "")
    let age = row.readUInt32LE(36)
    
    winston.error(`##name = ${name}, age = ${age}`)

    await table.flush()
    await table.close()
}

const funcList = [
    test0,
]

async function test() {
    for (var i = 0; i < funcList.length; i++) {
        func = funcList[i]
        winston.error(`>>>>>>>>>(${func.name})`)
        await func()
        winston.error(`<<<<<<<<<(${func.name})`)
    }
}

test()

```



