#!/usr/bin/env node

// 构建命令行交互工具方法: 
// https://zhuanlan.zhihu.com/p/53902095
// https://blog.csdn.net/culiu9261/article/details/107542220
// https://www.jianshu.com/p/db8294cfa2f7  # inquirer的使用


// readline keypress
// https://github.com/SBoudrias/Inquirer.js/issues/662

// https://www.npmjs.com/package/sql-cli-repl

// 光标位置设置
// https://blog.csdn.net/weixin_34121304/article/details/89473339

const winston = require('../winston/config');
const readline = require('readline')
const figlet = require("figlet");
const shell = require("shelljs");
const chalk = require("chalk");
const util = require('util')

// readline.cursorTo(rl.output, 0, 0)

var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '>> ',
    //completer: completer,
});

/*
 * 入口方法 
 */
function run() {
    rl.prompt()
}

function completer(line) {
    const completions = 'create select delete update from left right join on where having .quit .q'.split(' ');
    const hits = completions.filter((c) => c.startsWith(line));
    // Show all completions if none found
    return [hits.length ? hits : completions, line];
}

const { Parser } = require('node-sql-parser');
const parser = new Parser();

rl.on('line', function (line) {
    line = line.trim()

    try {
        const ast = parser.astify(line)
        console.log(ast)
        // const sql = parser.sqlify(ast)
        // console.log(sql)
    } catch (e) {
        console.log(
            chalk.red.bgGreen.bold(`sql error!: ${e}`)
        );
    }

    rl.prompt()
});

rl.on('close', function () {
    console.log('bye!');
    process.exit(0);
});

process.stdin.on('keypress-to-remove', (str, key) => {
    if (key.name == "tab") {
        winston.error(key)
    }
})

const init = () => {
    console.log(
        chalk.green(
            figlet.textSync("Nodedb CLI", {
                horizontalLayout: "default",
                verticalLayout: "default"
            })
        )
    );
};

const createFile = (filename, extension) => {
    const filePath = `${process.cwd()}/${filename}.${extension}`
    shell.touch(filePath);
    return filePath;
};

const success = filepath => {
    console.log(
        chalk.white.bgGreen.bold(`Done! File created at ${filepath}`)
    );
};

const showLog = filepath => {
    console.log(
        chalk.white.bgGreen.bold(`Done! File path: ${filepath}`)
    );
};

// start
init()

run()