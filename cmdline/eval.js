const Table = require("../table/table.js")

class Evaluator {
    constructor() {
        this.tableMap = {}
    }

    // {
    //     with: null,
    //     type: 'select',
    //     options: null,
    //     distinct: null,
    //     columns: '*',
    //     from: [ { db: null, table: 'test', as: null } ],
    //     where: null,
    //     groupby: null,
    //     having: null,
    //     orderby: null,
    //     limit: null,
    //     for_update: null
    // }

    // {                                                                                    
    //     with: null,                                                                        
    //     type: 'select',                                                                    
    //     options: null,                                                                     
    //     distinct: null,                                                                    
    //     columns: [                                                                         
    //       {                                                                                
    //         expr: { type: 'column_ref', table: 't', column: 'id' },                        
    //         as: null                                                                       
    //       },                                                                               
    //       {                                                                                
    //         expr: { type: 'column_ref', table: 't', column: 'name' },                      
    //         as: null                                                                       
    //       },                                                                               
    //       {                                                                                
    //         expr: { type: 'column_ref', table: 't', column: 'age' },                       
    //         as: null                                                                       
    //       },                                                                               
    //       {                                                                                
    //         expr: { type: 'column_ref', table: 'd', column: 'demo_id' },                   
    //         as: null                                                                       
    //       },                                                                               
    //       {                                                                                
    //         expr: { type: 'column_ref', table: 'd', column: 'name' },                      
    //         as: null                                                                       
    //       }                                                                                
    //     ],                       

    //     from: [                                                                            
    //       { db: null, table: 'test', as: 't' },                                            
    //       {                                                                                
    //         db: null,                                                                      
    //         table: 'demo',                                                                 
    //         as: 'd',                                                                       
    //         join: 'LEFT JOIN',                                                             
    //         on: {                                                                          
    //           type: 'binary_expr',                                                         
    //           operator: '=',                                                               
    //           left: { type: 'column_ref', table: 't', column: 'id' },                      
    //           right: { type: 'column_ref', table: 'de', column: 'demo_id' }                
    //         }                                                                              
    //       }                                                                                
    //     ],       

    //     where: null,                                                                       
    //     groupby: null,                                                                     
    //     having: null,                                                                      
    //     orderby: null,                                                                     
    //     limit: null,                                                                       
    //     for_update: null                                                                   
    //   }                                                                                    

    // select * from test left join demo on test.id = demo.demo_id;
    // select  t.id, t.name, t.age, d.demo_id, d.name from test t left join demo d on t.id = de.demo_id;

    // console.dir(ast, {depth: null, colors: true})

    async evalWhere(ast) {
        let columns = ast.columns
        let from = ast.from
        let where = ast.where

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

            if (columns instanceof Array) {

            }

            for (var dbi = 0; dbi < from.length; dbi++) {
                //console.dir(from[dbi], { depth: null, colors: true })
            }

        }

    }

    // 假设orderby 默认以聚簇索引排序, 如果指明了具体的orderby的字段, 则必须在字段上面添加索引!
    async evalSelect(ast) {
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
            console.log(out)
        }


        let orderby = ast.orderby
        let limit = ast.limit
    }
}

module.exports = Evaluator