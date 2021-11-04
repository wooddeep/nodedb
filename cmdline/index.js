#!/usr/bin/env node

// 构建命令行交互工具方法: 
// https://zhuanlan.zhihu.com/p/53902095
// https://blog.csdn.net/culiu9261/article/details/107542220
// https://www.jianshu.com/p/db8294cfa2f7  # inquirer的使用


// readline keypress
// https://github.com/SBoudrias/Inquirer.js/issues/662

const winston = require('../winston/config');
const inquirer = require("inquirer");
const readline = require('readline')
const figlet = require("figlet");
const shell = require("shelljs");
const chalk = require("chalk");

const history = []
var cmdIndex = 0

readline.emitKeypressEvents(process.stdin)
process.stdin.setRawMode(true)
process.stdin.resume()

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

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

const interactive = () => {
    rl.question('> ', (answer) => { // prompt
        process.stdout.write(`${answer}`);
        history.push(answer)
        interactive()
    });
}

process.stdin.on('keypress', (str, key) => {
    winston.info(key)
    if (key.name == "tab") {
        process.stdout.clearLine();  // clear current text
        process.stdout.cursorTo(0);  // move cursor to beginning of line
        process.stdout.write("> ");
        process.stdout.cursorTo(2);  // move cursor to beginning of line
        if (history.length > 0) {
            process.stdout.write(history[cmdIndex % history.length]);
            cmdIndex++;
        }
    }

    if (str === '\u0003') {
        process.exit()
    }
})

// start
init()
interactive()