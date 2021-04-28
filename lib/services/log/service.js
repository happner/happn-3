module.exports = LogService;

var Logger = require('happn-logger'),
  CONSTANTS = require('../..').constants;

const util = require('../utils/shared');

LogService.prototype.initialize = initialize;
LogService.prototype.error = util.maybePromisify(error);
LogService.prototype.info = util.maybePromisify(info);
LogService.prototype.warn = util.maybePromisify(warn);
LogService.prototype.write = util.maybePromisify(write);
LogService.prototype.processMessage = util.maybePromisify(processMessage);
LogService.prototype.stats = stats;

function LogService() {}

function initialize(config, callback) {
  this.__stats = {
    errors: {}
  };

  this.__logs = {};

  this.__logs.System = this.happn.log;

  callback();
}

function error(message, data, area, callback) {
  return this.write(message, 'error', data, area, callback);
}

function info(message, data, area, callback) {
  return this.write(message, 'info', data, area, callback);
}

function warn(message, data, area, callback) {
  return this.write(message, 'warn', data, area, callback);
}

function write(message, type, data, area, severity, callback) {
  if (!area) area = 'System';

  if (!type) type = 'info';

  if (type === 'error') {
    var logSeverity;

    if (typeof severity !== 'number') logSeverity = CONSTANTS.ERROR_SEVERITY.LOW;
    else logSeverity = severity;

    message += ', severity: ' + logSeverity.toString();
  }

  if (!this.__logs[area]) this.__logs[area] = Logger.createLogger(area);

  if (!this.__stats[area]) this.__stats[area] = {};

  if (!this.__stats[area][type]) this.__stats[area][type] = 1;
  else this.__stats[area][type]++;

  this.__logs[area][type](message, data);

  if (callback) return callback();
}

function processMessage(message, callback) {
  try {
    return callback(null, message);
  } catch (e) {
    callback(e);
  }
}

function stats() {
  return this.__stats;
}
