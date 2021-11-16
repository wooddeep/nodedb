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

const { Parser } = require('node-sql-parser');
const winston = require('../winston/config');
const readline = require('readline')
const figlet = require("figlet");
const shell = require("shelljs");
const chalk = require("chalk");
const util = require('util')
const parser = new Parser();
const commad = require('./cmd');

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

async function sqlExec(ast) {
    if (ast == undefined) return

    let out = await commad.map[ast.type].execute(ast)
    console.log(
        chalk.white(out)
    );
}

async function executeOne(line) {
    let arr = line.split(/\s+/)

    if (line == 'exit') {
        console.log('bye!');
        commad.map['quit']()
        process.exit(0);
    }

    try {
        const ast = parser.astify(line)
        await sqlExec(ast)
    } catch (e) {
        let cmds = commad.set.filter(obj => {
            let len = Math.min(arr.length, obj.cmdarr.length)
            for (var i = 0; i < len; i++) {
                if (arr[i] != obj.cmdarr[i]) {
                    return false
                }
            }
            return true
        })

        if (cmds.length > 0) {
            try {
                let out = await cmds[0].execute(arr)
                console.log(
                    chalk.white(out)
                );
            } catch (e) {
                console.log(
                    chalk.red.bgGreen.bold(`sql error!: ${e}`)
                );
            }
        } else {
            console.log(
                chalk.red.bgGreen.bold(`sql error!: ${e}`)
            );
        }

    }    
}

rl.on('line', async function (input) {
    let commands = input.split(';')
    for (var i = 0; i < commands.length; i++) {
        let line = commands[i].trim()
        await executeOne(line)
    }
    rl.prompt()
});

rl.on('close', function () {
    console.log('bye!');
    commad.map['quit']()
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