class Evaluator {
    constructor() {

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
    evalSelect(ast) {
        let columns = ast.columns
        let from = ast.from
        let where = ast.where
    }
}

module.exports = Evaluator