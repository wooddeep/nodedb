#!/usr/bin/env node

// 构建命令行交互工具方法: 
// https://zhuanlan.zhihu.com/p/53902095
// https://blog.csdn.net/culiu9261/article/details/107542220
// https://www.jianshu.com/p/db8294cfa2f7  # inquirer的使用


// readline keypress
// https://github.com/SBoudrias/Inquirer.js/issues/662

const winston = require('../winston/config');
const readline = require('readline')
const figlet = require("figlet");
const shell = require("shelljs");
const chalk = require("chalk");

const PREFIX = '> '
const history = []
const currLine = []
const keyword = [
    "create",
    "select",
    "update",
    "delete",
    "from",
    "left join",
    "right join",
    "on",
    "in",
    "where",
    "having"
]
var cmdIndex = 0

readline.emitKeypressEvents(process.stdin)
process.stdin.setRawMode(true)
process.stdin.resume()

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function findKeyword(input) {
    if (input.length == 0) {
        return ""
    }

    for (var i = 0; i < keyword.length; i++) {
        if (keyword[i] == input) return ""
        if (keyword[i].includes(input)) {
            return keyword[i]
        }
    }
    return ""
}


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
    rl.question(PREFIX, (answer) => { // prompt
        process.stdout.write(`${answer}`);
        if (answer.length > 0) {
            history.push(currLine.join("")) // 记录历史命令
            winston.info(`cmd: ${currLine.join("")}`)
            currLine.length = 0 // 清除每行记录
        }
        interactive()
    });
}

process.stdin.on('keypress', (str, key) => {
    winston.info(key)

    if (key.sequence != undefined && key.sequence.length == 1 && key.sequence != "\r" ) {
        currLine.push(key.sequence) // 记录每行的每个输入键值
    }

    if (key.name == "tab") {
        process.stdout.clearLine();  // clear current text
        process.stdout.cursorTo(0);  // move cursor to beginning of line
        process.stdout.write(PREFIX);
        process.stdout.cursorTo(PREFIX.length);  // move cursor to beginning of line
        let curr = currLine.join("")

        let array = curr.split(/\s+/)
        let last = array[array.length - 1]

        let key = findKeyword(last)
        if (key.length > 0) {
            array.splice(array.length - 1, 1, key)
        }

        curr = array.join(" ")
        if (curr.trim().length > 0) {
            curr = curr + " "
        }

        process.stdout.write(curr)

        currLine.length = 0 // 先清除
        currLine.push(curr) // 再放入

    }

    if (key.name == "up") {
        process.stdout.clearLine();  // clear current text
        process.stdout.cursorTo(0);  // move cursor to beginning of line
        process.stdout.write(PREFIX);
        process.stdout.cursorTo(PREFIX.length);  // move cursor to beginning of line
        if (history.length > 0) {
            cmdIndex++;
            process.stdout.write(history[cmdIndex % history.length]);
            currLine.length = 0 // 先清除
            currLine.push(history[cmdIndex % history.length])
        }
    }

    if (key.name == "down") {
        process.stdout.clearLine();  // clear current text
        process.stdout.cursorTo(0);  // move cursor to beginning of line
        process.stdout.write(PREFIX);
        process.stdout.cursorTo(PREFIX.length);  // move cursor to beginning of line
        if (history.length > 0) {
            cmdIndex--;
            process.stdout.write(history[cmdIndex % history.length]);
            currLine.length = 0 // 先清除
            currLine.push(history[cmdIndex % history.length])
        }
    }

    if (str === '\u0003') {
        process.exit()
    }
})

process.on('stdout', function (data) {
    console.log(data)
});

// start
init()
interactive()