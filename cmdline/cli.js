var readline = require('readline');

var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '>> ',
    completer: completer,
});

/*
 * 入口方法 
 */
function run() {
    // rl.question("> ", function (answer) {
    //     console.log("名字是：" + answer);
    //     run()
    // });
    rl.prompt()
}

function completer(line, callback) {
    const completions = '.help .error .exit .quit .q'.split(' ');
    const hits = completions.filter((c) => c.startsWith(line));
    // Show all completions if none found
    return [hits.length ? hits : completions, line];
}

rl.on('line', function (line) {
    switch (line.trim()) {
        case 'copy':
            console.log("复制");
            break;
        case 'hello':
            rl.write("Write");
            console.log('world!');
            break;
        case 'close':
            rl.close();
            break;
        default:
            console.log('没有找到命令！');
            break;
    }
    rl.prompt()
});

rl.on('close', function () {
    console.log('bye bye');
    process.exit(0);
});

run()