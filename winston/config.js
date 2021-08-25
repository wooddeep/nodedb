const appRoot = require('app-root-path');
const winston = require('winston');

// define the custom settings for each transport (file, console)
const options = {
    file: {
        level: 'info',
        filename: `${appRoot}/logs/app.log`,
        handleExceptions: true,
        json: true,
        maxsize: 5242880, // 5MB
        maxFiles: 5,
        colorize: false,
    },
    console: {
        level: 'error',
        handleExceptions: true,
        json: false,
        colorize: true,
    },
};

// instantiate a new Winston Logger with the settings defined above
let logger;
if (process.env.logging === 'off') {
    logger = winston.createLogger({
        transports: [
            new winston.transports.File(options.file),
        ],
        exitOnError: false, // do not exit on handled exceptions
    });
} else {
    logger = winston.createLogger({
        transports: [
            new winston.transports.File(options.file),
            new winston.transports.Console(options.console),
        ],
        exitOnError: false, // do not exit on handled exceptions
    });
}

// create a stream object with a 'write' function that will be used by `morgan`
logger.stream = {
    write(message) {
        logger.info(message);
    },
};

module.exports = logger;