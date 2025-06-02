var winston = require('winston');
require('winston-daily-rotate-file');
const {
  combine,
  timestamp,
  prettyPrint
} = winston.format;
const moment = require('moment-timezone');
const timezoned = () => moment().tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss');

module.exports = {

  reqLog: new winston.createLogger({
    format: combine(timestamp({
      format: timezoned
    }), prettyPrint()),
    exceptionHandlers: [
      new (winston.transports.DailyRotateFile)({
        filename: 'logs/exceptions-req-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '50m'
      })
    ],
    transports: [
      new (winston.transports.DailyRotateFile)({
        filename: 'logs/request-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '50m'
      })
    ],
    exitOnError: true
  }),
  commonLog: new winston.createLogger({
    format: combine(timestamp({
      format: timezoned
    }), prettyPrint()),
    exceptionHandlers: [
      new (winston.transports.DailyRotateFile)({
        filename: 'logs/exceptions-common-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '50m'
      })
    ],
    transports: [
      new (winston.transports.DailyRotateFile)({
        filename: 'logs/common-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '50m'
      })
    ],
    exitOnError: true
  })
};
