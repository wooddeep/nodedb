const Table = require("../table/table.js")
const tools = require('../common/tools')
const Column = require("../table/column.js")
const path = require('path')

const {
    COL_TYPE_INT,
    COL_TYPE_FPN,
    COL_TYPE_STR,
    KEY_TYPE_NULL,
    KEY_TYPE_PRIMARY,
    KEY_TYPE_INDEX,
} = require("../common/const")
const fileops = require("../common/fileops.js")

class Evaluator {

    constructor() {
        this.tableMap = {}
    }

    getColtype(type) {
        if (type.toLowerCase().search('int') >= 0) {
            return COL_TYPE_INT
        }

        if (type.toLowerCase().search('float') >= 0) { // 辅助定义
            return COL_TYPE_FPN
        }

        if (type.toLowerCase().search('char') >= 0) { // 辅助定义
            return COL_TYPE_STR
        }
    }

    resetKey(cols, colname, keyType, keyName) {
        for (var ci = 0; ci < cols.length; ci++) {
            let column = cols[ci]
            for (var cni = 0; cni < colname.length; cni++) {
                if (column.getFieldName() == colname[cni]) { // 匹配上名称
                    column.setKeyType(keyType)
                    column.setKeyName(keyName)
                }
            }
        }
    }

    // CREATE TABLE `demo`( `demo_id` INT UNSIGNED AUTO_INCREMENT, `title` CHAR(100) NOT NULL, PRIMARY KEY ( `demo_id`));
    // 目前, 只创建单表
    async evalCreateTable(ast) {

        let tableName = ast.table[0].table
        let tableAlias = ast.table[0].as

        let defs = ast.create_definitions
        // col0 = new Column("AID", 0, undefined, 1, "key0")
        let columns = []
        for (var i = 0; i < defs.length; i++) {
            let def = defs[i]
            let resource = def.resource

            if (resource == 'column') { // 列定义
                let colName = def.column.column
                let type = this.getColtype(def.definition.dataType) // INT, CHAR

                let typeAux = undefined
                if (type == COL_TYPE_STR) { // 辅助定义
                    typeAux = def.definition.length
                }

                let col = new Column(colName, type, typeAux, 0, undefined) // key type 和 key name 暂时不填
                columns.push(col)
            }
        }

        // 设置键类型
        for (var i = 0; i < defs.length; i++) {
            let def = defs[i]
            let resource = def.resource

            if (resource == 'constraint') { // 约束条件
                let type = def.constraint_type
                if (type.search('primary') >= 0) { // 主键 添加索引
                    let definition = def.definition
                    this.resetKey(columns, definition, KEY_TYPE_PRIMARY, undefined)
                }
            }

            if (resource == 'index') { // 普通索引
                let definition = def.definition
                let keyName = def.index
                this.resetKey(columns, definition, KEY_TYPE_INDEX, keyName)
            }
        }

        let primaryOk = columns[0].keyType == KEY_TYPE_PRIMARY
        if (!primaryOk) {
            return "#error: the first column must be a primary key!"
        }

        let table = new Table(tableName, columns, 500)
        await table.drop()
        await table.init()
        await table.flush()
        this.tableMap[tableName] = { "table": table, "as": tableAlias }

        return 'ok'
    }

    // 删除表时, 把表关联的index一并删除掉, 只支持删一个表
    async evalDropTable(ast) {

        let tableName = ast.name[0].table

        // 查看文件是否存在, 若存在, 则删除, 否则提示数据库不存在
        let root = await tools.findRoot(path.dirname(module.filename))
        let files = await tools.readfile(root)
        let names = files.map(obj => obj.name)

        let out = names.filter(name => name.search(tableName) >= 0)
        if (out.length <= 0) {
            return `#error: table ${tableName} not existd!`
        }

        for (var i = 0; i < out.length; i++) {
            let file = path.join(root, out[i])
            let ret = await fileops.unlinkFile(file)
            if (!ret) {
                return `#error: drop table ${tableName} fail, try again!`
            }
        }

        if (this.tableMap.hasOwnProperty(tableName)) {
            this.tableMap[tableName].table.close()
            this.tableMap[tableName] = undefined
        }

        return 'ok'
    }

    async evalDropIndex(ast) {
        console.dir(ast, { depth: null, colors: true })
        return 'ok'
    }


    // {                                                                   
    //     with: null,                                                       
    //     type: 'select',                                                   
    //     options: null,                                                    
    //     distinct: null,                                                   
    //     columns: '*',                                                     
    //     from: [ { db: null, table: 'test', as: null } ],                  
    //     where: {                                                          
    //       type: 'binary_expr',                                            
    //       operator: '>',                                                  
    //       left: { type: 'number', value: 2 },                             
    //       right: { type: 'column_ref', table: null, column: 'AID' }       
    //     },                                                                
    //     groupby: null,                                                    
    //     having: null,                                                     
    //     orderby: null,                                                    
    //     limit: null,                                                      
    //     for_update: null                                                  
    //   }                                                                       
    async evalCompareExpr(tbname, oper, leftVal, rightVal) {
        if (leftVal.type == 'column_ref' && rightVal.type == 'column_ref') { // 对比的值都是数据库的列
            return {} // TODO 
        }

        if (leftVal.type == 'column_ref' && rightVal.type != 'column_ref') { // 左值都是数据库的列
            var compValue = await this.evalValue(rightVal) // 右值为待比较值
            if (compValue instanceof Array) {
                if (compValue.length > 1) {
                    throw new Error(`be compared value is not a single value!`)
                } else {
                    compValue = compValue[0]
                }
            }

            var col = leftVal.column
            let rows = await this.tableMap[tbname].table.selectAllByColComp(col, oper, compValue) // 通过列过滤
            return rows
        }

        if (leftVal.type != 'column_ref' && rightVal.type == 'column_ref') { // 对比的值都是数据库的列
            return {} // TODO
        }

        if (leftVal.type != 'column_ref' && rightVal.type != 'column_ref') { // 对比的值都不是数据库的列
            return {} // TODO
        }

    }

    async evalLogicExpr(from, columns, oper, left, right) {

        switch (oper) {
            case oper.match(/and/i)?.input:
                var rows = left.rows.filter(lrow => right.rows.filter(rrow => lrow.slice(0, 4).compare(rrow.slice(0, 4)) == 0))
                return { 'cols': left.cols, 'rows': rows }

            case oper.match(/or/i)?.input:
                var rows = left.rows.forEach(lrow => {
                    if (right.rows.find(rrow => lrow.slice(0, 4).compare(rrow.slice(0, 4)) == 0) == undefined) { // 找不到
                        right.rows.push(lrow)
                    }
                })
                
                return { 'cols': left.cols, 'rows': right.rows }

            default:
                return {}
        }

    }

    async evalWhere(ast) {
        let columns = ast.columns
        let from = ast.from
        let where = ast.where

        // 把from 和 columns字段移入到where之中
        //where.from = from
        //where.columns = columns

        return await this.evalValue(where, from, columns)
    }

    //console.dir(from, { depth: null, colors: true })
    // TODO 和 evalWhere 关联起来
    async evalFrom(ast) {
        let columns = ast.columns
        let from = ast.from

        // 1. 先分析from看是否有join
        if (from.length == 1) { // 只从一张表中select的情况
            let tableName = from[0].table // 表名
            let tableAlias = from[0].as       // 表别名 
            if (typeof (columns) == 'string') { // select * from dbname
                let rows = await this.tableMap[tableName].table.selectAll()

                return rows
            }

            if (columns instanceof Array) { // 根据列名查询 某列, 暂时查询所有列, 后期优化
                let rows = await this.tableMap[tableName].table.selectAll()

                return rows
            }

            for (var dbi = 0; dbi < from.length; dbi++) {
                //console.dir(from[dbi], { depth: null, colors: true })
            }

        }

    }

    dataFormat(out, colSel = undefined) {
        let cols = out.cols
        let rows = out.rows

        let header = cols.map(col => col.getFieldName())

        let data = rows.map(row => {
            let out = []
            let offset = 0
            for (var c = 0; c < cols.length; c++) {

                let size = cols[c].size()
                if (cols[c].type == 0) {  // case 0: return "integer";
                    out.push(row.readUInt32LE(offset).toString())
                    offset += 4
                }

                if (cols[c].type == 1) { // case 1: return "float";
                    out.push(row.readFloatLE(offset).toString())
                    offset += 4
                }

                if (cols[c].type == 2) {  // case 2: return "string";
                    let buff = Buffer.alloc(size)
                    row.copy(buff, 0, offset, offset + size)
                    out.push(buff.toString().replace(/^[\s\uFEFF\xA0\0]+|[\s\uFEFF\xA0\0]+$/g, ""))
                    offset += size
                }

            }
            return out
        })


        // TODO 优化程序, 直接处理选中的列，无需对所有列进行处理      
        if (colSel != undefined && colSel instanceof Array) {
            let seled = colSel.filter(def => def.expr.type == 'column_ref').map(def => def.expr.column) // TODO 目前只有数据库的列, 需要加上其他列
            let index = []
            for (var i = 0; i < seled.length; i++) {
                for (var j = 0; j < header.length; j++) {
                    if (header[j] == seled[i]) {
                        index.push(j)
                    }
                }
            }

            let selData = data.map(row => { let out = []; index.forEach(i => out.push(row[i])); return out })

            return [seled, selData]
        }

        return [header, data]
    }


    // 假设orderby 默认以聚簇索引排序, 如果指明了具体的orderby的字段, 则必须在字段上面添加索引!
    async evalSelect(ast, direct = true) {

        //console.dir(ast, { depth: null, colors: true })

        let columns = ast.columns
        let from = ast.from

        for (var fi = 0; fi < from.length; fi++) { // 创建表索引
            let tableName = from[fi].table // 表名
            let tableAlias = from[fi].as       // 表别名 

            if (!this.tableMap.hasOwnProperty(tableName)) {
                let table = new Table(tableName, [], 500)
                await table.init()
                this.tableMap[tableName] = { "table": table, "as": tableAlias }
            }
        }

        let where = ast.where

        let out = []
        if (where != undefined) {
            out = await this.evalWhere(ast)
        } else {
            out = await this.evalFrom(ast)
        }

        let formed = this.dataFormat(out, columns)
        if (direct) { // 返回显示结果
            let disp = tools.tableDisplayData(formed[0], formed[1])
            return disp // 返回待显示字符串
        }

        return formed[1] // 只返回行数据, 不返回列名称


        // let orderby = ast.orderby
        // let limit = ast.limit

        // return "hello"
    }

    findColumn(columns, name) {
        for (var i = 0; i < columns.length; i++) {
            let column = columns[i]
            if (column.getFieldName() == name) {
                return column
            }
        }
        return undefined
    }


    // let table = new Table(tbname, [], 500)
    // await table.init()
    // await table.insert(data)
    // await table.flush()
    // await table.close()
    async evalInsert(ast) {
        let tables = ast.table
        for (var ti = 0; ti < tables.length; ti++) { // 创建表索引
            let tableName = tables[ti].table // 表名
            let tableAlias = tables[ti].as       // 表别名 

            if (!this.tableMap.hasOwnProperty(tableName)) {
                let table = new Table(tableName, [], 500)
                await table.init()
                this.tableMap[tableName] = { "table": table, "as": tableAlias }
            }
        }

        let columns = ast.columns // 待插入的列的列名
        let tableName = tables[0].table // 表名, 先搞点一个表的情况

        let table = this.tableMap[tableName].table

        let colsDef = table.columns // 表的列定义
        let value = ast.values[0].value // TODO 通过解析类型来计算插入的值

        let data = [] //  value = [3, "cao", 36]
        for (var c = 0; c < columns.length; c++) {
            let colName = columns[c] // 列名称
            let column = this.findColumn(colsDef, colName) // 获取列对象

            if (column.type == 0) {  // case 0: return "integer";
                data.push(parseInt(value[c].value)) // TODO 如果value是表达式, 需要计算表达式的值
            }

            if (column.type == 1) { // case 1: return "float";
                data.push(parseFloat(value[c].value))
            }

            if (column.type == 2) {  // case 2: return "string";
                data.push(value[c].value)
            }
        }

        let insertRet = await table.insert(data)
        await table.flush()
        return insertRet

    }


    async evalValue(ast, from = undefined, columns = undefined) {
        let type = ast.type

        switch (type) {

            case 'binary_expr':
                let left = ast.left
                let right = ast.right
                let oper = ast.operator

                let leftVal = await this.evalValue(left, from)
                let rightVal = await this.evalValue(right, from)

                let tbname = from == undefined ? undefined : from[0].table

                switch (oper) {
                    case oper.match(/[=\>\<]|!=|>=|<=/)?.input: // 对比运算
                        //console.dir(ast, { depth: null, colors: true })
                        var rows = await this.evalCompareExpr(tbname, oper, leftVal, rightVal) // 通过列过滤, TODO 
                        return rows

                    case oper.match(/AND|OR|and|or/)?.input: // 逻辑运算
                        console.dir(ast, { depth: null, colors: true })
                        var rows = await this.evalLogicExpr(from, columns, oper, leftVal, rightVal) // 通过列过滤, TODO 
                        return rows

                    case 'IN': // 先走全表扫描, 
                        // 优化器, 分情况讨论 column, expr(column)
                        let leftType = leftVal.type // { type: 'column_ref', table: null, column: 'AID' }
                        switch (leftType) { // 根据左值类型处理
                            case 'column_ref': // 直接通过索引
                                if (typeof (rightVal[0]) == 'object') { // 如果集合是select出来的集合，非直接数值的集合，首先转换
                                    rightVal = rightVal.map(row => row[0])
                                }

                                // TODO 如果右值的列上 有索引, 则直接通过右值查询过滤
                                var rows = await this.tableMap[tbname].table.selectAllByIndex(leftVal.column, rightVal) // 通过列过滤
                                return rows
                        }

                        break;

                    default:
                        break;
                }

                break;

            case 'column_ref': //   { type: 'column_ref', table: null, column: 'AID' },
                return ast

            case 'expr_list':
                var out = []
                let value = ast.value
                for (var i = 0; i < value.length; i++) {
                    let val = value[i]
                    let ret = await this.evalValue(val)
                    if (ret instanceof Array) {
                        out.push(...ret) // 数组解构
                    } else {
                        out.push(ret)
                    }
                }
                return out

            case 'select':
                var out = await this.evalSelect(ast, false)
                return out

            case 'number': // { type: 'number', value: 2 },  
                return ast.value // 直接返回 { type: 'number', value: 2 }

            case 'single_quote_string': // { type: 'number', value: 2 },  
                return ast.value // 直接返回 { type: 'number', value: 2 }

            default:
                return ast
        }

    }



    async close() {
        for (var name in this.tableMap) {
            var table = this.tableMap[name].table
            //await table.flush()
            await table.close()
        }
    }
}

module.exports = Evaluator