module.exports = LogService;

var util = require('util'),
  Promise = require('bluebird'),
  Logger = require('happn-logger'),
  CONSTANTS = require('../../constants');

LogService.prototype.initialize = initialize;
LogService.prototype.error = Promise.promisify(error);
LogService.prototype.info = Promise.promisify(info);
LogService.prototype.warn = Promise.promisify(warn);
LogService.prototype.write = Promise.promisify(write);
LogService.prototype.processMessage = Promise.promisify(processMessage);
LogService.prototype.stats = stats;

function LogService() {}

function initialize(config, callback) {
  this.__stats = {
    errors: {

    }
  };

  this.__logs = {};

  this.__logs['System'] = this.happn.log;

  callback();
};

function error(message, data, area, callback) {
  return this.write(message, 'error', data, area, callback);
};

function info(message, data, area, callback) {
  return this.write(message, 'info', data, area);
};

function warn(message, data, area, callback) {
  return this.write(message, 'warn', data, area);
};

function write(message, type, data, area, severity, callback) {
  if (!area) area = 'System';

  if (!type) type = 'info';

  if (type == 'error') {

    var logSeverity;

    if (typeof severity != 'number') logSeverity = CONSTANTS.ERROR_SEVERITY.LOW;

    else logSeverity = severity;

    message += ', severity: ' + logSeverity.toString();
  }

  if (!this.__logs[area]) this.__logs[area] = Logger.createLogger(area);

  if (!this.__stats[area]) this.__stats[area] = {};

  if (!this.__stats[area][type]) this.__stats[area][type] = 1;
  else this.__stats[area][type]++;

  this.__logs[area][type](message, data);

  if (callback) return callback();
};

function processMessage(message, callback) {
  try {
    return callback(null, message);
  } catch (e) {
    callback(e);
  }
};

function stats() {
  return this.__stats;
};
