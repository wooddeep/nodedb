const repl = require('repl');
const replServer = repl.start({ prompt: '> ' });
replServer.defineCommand('sayhello', {
    help: '打招呼',
    action(name) {
        this.lineParser.reset();
        this.bufferedCommand = '';
        console.log(`你好，${name}！`);
        this.displayPrompt();
    }
});
replServer.defineCommand('saybye', function saybye() {
    console.log('再见！');
    this.close();
});