## 1. 说明 
任何一个应用系统中，数据库都处于核心的地位。不管是业务逻辑的设计，系统性能的优化最终都归结于数据库的选型和表设计。而数据库的引擎核心在于b+树，为了厘清b+树的底层原理，我准备从零开始手撸一颗b+树，并计划将来在该b+树的基础上，实现一个简单的kv存储的玩具，如果有机会的话，还可以引入sql的解析，让这个玩具更加逼真。为了劲量的降低开发难度，首先采用nodejs来实现这颗b+树，在原型验证通过之后，可以考虑切换到其他语言。目前已经实现了b+树节点的增删查改、磁盘文件的持久化，其余功能准备完善中！
</br>

## 2. 运行 
```javascript
const winston = require('./winston/config');
const Bptree = require("./bptree.js");
const fileops = require("./fileops.js");
const constant = require("./const.js");

const tools = require('./tools')

const bptree = new Bptree()

async function fileOperTest() {
    let fd = await fileops.openFile("lee.db")
    const buffer = Buffer.alloc(10);
    buffer.write("helloworld")
    await fileops.writeFile(fd, buffer, 0, 10)
    await fileops.closeFile(fd)
    let exists = await fileops.existFile("lee.db")
    console.log(exists)
}

async function writeTest() {
    let dbname = "test.db"
    let fd = await bptree.init(dbname)
    for (var value = 100; value >= 98; value--) {
        let kbuf = tools.buffer(value)
        await bptree.insert(kbuf, value)
    }
    await bptree.flush(fd)

}

async function findTest(key) {
    let dbname = "test.db"
    await bptree.init(dbname)

    let kbuf = tools.buffer(key)
    let value = bptree.select(kbuf)

    await bptree.close(dbname)
    console.log("value = " + value)
}

async function removeTest(key) {
    let dbname = "test.db"
    let fd = await bptree.init(dbname)

    let kbuf = tools.buffer(key)
    bptree.remove(kbuf)
    await bptree.flush(fd)
}

writeTest() // 创建，插入

findTest(98) // 查找

removeTest(85) // 删除

```
</br>

## 3. 图解
设计每个页节点，最多可以放入3个数据，order为3  

</br>

### 3.1 页节点结构说明   
页节点的头5个字段分别存储的为页类型、父页节点下标、兄页节点下标、弟叶结点下标、节点内已经填充的数据个数，这个5个字段都是4个字节，以小端模式存储。这5个字段长度的定位在const.js文件中如下：  
```javascript
const PAGE_PARENT_IDX_LEN = 4
const PAGE_PREV_IDX_LEN = 4
const PAGE_NEXT_IDX_LEN = 4
const PAGE_TYPE_LEN = 4 // 页类型：2 ~ 头结点; 1 ~ 茎节点; 0 ~ 页节点
const CELL_USED_LEN = 4
```
从每页的第20（4 * 5）个字节开始, 便存储的是页的具体数据，以键值对（KEY：VAL）的形式，存储的页的数据。其中，若页的类型为2或者1， 则VAL存储的是子节点的页节点下标，若页类型为0，则VAL存储的是具体的数值, 这里设计存储4字节的整形数据，后续可扩展。其中键和值的所占字节长度定义在const.js文件中：   
```javascript
const KEY_MAX_LEN = 10 // 键最大长度
const VAL_IDX_LEN = 4  // 值长度, 根或茎节点指向子页面, 叶子节点指向值
```
为了调试方便，设置页的大小为64，这样，每页中最大的键值对个数为3，即ORDER_NUM，定义在const.js文件中：
```javascript
const PAGE_SIZE = 64 // 页大小
const ORDER_NUM = Math.floor((PAGE_SIZE - PAGE_TYPE_LEN - PAGE_PARENT_IDX_LEN - CELL_USED_LEN - PAGE_PREV_IDX_LEN - PAGE_NEXT_IDX_LEN) / (KEY_MAX_LEN + VAL_IDX_LEN)) // b+树的阶
```
当然，在调试成功之后，可以扩大PAGE_SIZE, 以增加每页可存储的数据。  

页节点的存储布局：  
</br>
<div align=center>
<img src="image/page-struct.png" alt="drawing" width="300"/>  
</div>

页节点的关联关系：  
</br>
<div align=center>
<img src="image/page-relation.png" alt="drawing" width="600"/>  
</div>

每个页节点的PARENT存储父节点的节点下标，NEXT存储兄节点的节点下标，PREV存储弟节点的节点下标，若节点类型非页节点，则VAL存储子节点的下标，否则存储具体的数值。  

</br>  



### 3.2 页节点存储说明   
#### 3.2.1 磁盘存储
数据按页连续存入单文件中，第1页的范围为0-63byte, 页下标为0，第2页的范围为64-127byte，页下标为1，依次内推，以插入数据100为例，存储文件以16进制dump出来显示如下：  
<div align=center>
<img src="image/100-store.png" alt="drawing" width="600"/>  
</div>
&nbsp;&nbsp;&nbsp;&nbsp;结合页存储布局图可见，第1页的类型为2，说明是根节点，其兄、弟节点索引都是0xFFFFFFFF代表无所指，USED字段值为0，代表数据节点有1个被用，已知设计叶结点的数据从小到大排列，这里只有1个数据(100, 十六进制0x64)，故而把100存在下标为ORDER_NUM - 1 的位置，因为设计页的ORDER_NUM为3，故而100存在下标为2的位置，由前面的说明知道，键长度为10，这里如图即为：64 00 00 00 00 00 00 00 00 00(代表键100), 而值长度为4，这里如图即为: 01 00 00 00(代表值1)，因为本页为根节点，所以这里的1代表子节点的下标为1即第二页.   
</br>
&nbsp;&nbsp;&nbsp;&nbsp;第2页的类型为0，说明是叶节点，其父节点为0，代表其父节点为第1页，USED字段值为1，代表数据节点有1个被用，由前面的说明知道，把100存在下标为ORDER_NUM - 1 的位置，键长度为10，这里如图即为：64 00 00 00 00 00 00 00 00 00(代表键100), 而值长度为4，这里如图即为: 64 00 00 00(代表值100)，因为本页为页节点，所以这里的64代表具体的数值.  

</br>

#### 3.2.2 内存存储

借助于nodejs的特性，以map存储页的索引以及对应的页内容，定义在bptree.js文件中：
```javascript
var rootPage = undefined // 根页面
const pageMap = {} // 页节点表

function newPage(type) {
    var cells = []
    for (var index = 0; index < ORDER_NUM; index++) { // 叶结点内数据数组
        var cell = newCell()
        cells.push(cell)
    }

    return {
        type: type,        // 页类型：2 ~ 根, 1 ~ 中间节点, 0 ~ 叶子节点
        parent: -1,         // 父节点
        next: -1,           // 兄节点
        prev: -1,           // 弟节点 
        used: 0,
        cells: cells,       // 数组数组
    }
}

```

</br>

### 3.3 页节点插入数据(选取具有说明性的步骤)  

**a. 插入98:**     
<div align=center>
<img src="image/98.png" alt="drawing" width="200"/>  
</div> 
</br>

**b. 插入97未分裂:**     
<div align=center>
<img src="image/97-pre.png" alt="drawing" width="200"/>  
</div> 
</br>

**c. 插入97分裂:**      
节点内数据个数为4， 大于order数目，需要对节点数据分裂，分裂后，左右点数据为97、98，右节点数据为99、100，分别取两个节点的最大值98，100，抽取作为父节点的数据：  
<div align=center>
<img src="image/97.png" alt="drawing" width="400"/>  
</div> 
</br>

**...... 连续插入(省略)**
</br>

**d. 插入93未分裂:**       
节点内数据个数为4， 大于order数目，需要对节点数据分裂，分裂后，左右点数据为97、98，右节点数据为99、100，分别取两个节点的最大值98，100，抽取作为父节点的数据：  
<div align=center>
<img src="image/93-pre.png" alt="drawing" width="600"/>  
</div> 
</br>

**e. 插入93分裂:**   
93 ~ 96 四个数据，进行分裂，分裂后，94和96提升到父节点中，父节点的数据为94、96、98、100,父节点数据为4，继续对父节点进行分裂： 
<div align=center>
<img src="image/93.png" alt="drawing" width="600"/>  
</div>
</br>

**...... 连续插入(省略)**   
</br>

**f. 最后，插入数据80，进行分裂的结果为:**  
<div align=center>
<img src="image/80.png" alt="drawing" width="600"/>  
</div>
