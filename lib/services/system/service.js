var shortid = require('shortid'),
  sillyname = require('happn-sillyname'),
  CONSTANTS = require('../../constants');

module.exports = SystemService;

function SystemService(opts) {
  this.log = opts.logger.createLogger('System');
  this.log.$$TRACE('construct(%j)', opts);

  Object.defineProperty(this, 'package', {
    value: require('../../../package.json')
  });

  this.resetStats();
}

SystemService.prototype.resetStats = function() {
  this.__stats = {
    HEALTH: {
      STATUS: CONSTANTS.SYSTEM_HEALTH.EXCELLENT,
      BY_SEVERITY: {},
      BY_AREA: {}
    }
  };

  for (var severity in CONSTANTS.ERROR_SEVERITY) {
    this.__stats.HEALTH.BY_SEVERITY[CONSTANTS.ERROR_SEVERITY[severity]] = 0;
  }

  this.__stats.HEALTH.lastError = null;
};

SystemService.prototype.stats = function() {
  var stats = JSON.parse(JSON.stringify(this.__stats));

  stats.memory = process.memoryUsage();

  return stats;
};

SystemService.prototype.uniqueName = function() {
  return (
    sillyname()
      .split(' ')[0]
      .toLowerCase() +
    '_' +
    shortid.generate()
  );
};

SystemService.prototype._ensureSystemName = function(config, callback) {
  var _this = this;

  _this.dataService.get('/_SYSTEM/_NETWORK/_SETTINGS/NAME', {}, function(e, response) {
    if (e) return callback(e);

    if (!response) {
      if (!config.name) config.name = _this.uniqueName();

      return _this.dataService.upsert('/_SYSTEM/_NETWORK/_SETTINGS/NAME', config.name, {}, function(
        e,
        result
      ) {
        if (e) return callback(e);
        _this.name = result.data.value;
        _this.happn.name = result.data.value;
        callback();
      });
    } else {
      if (config.name && response.data.value !== config.name) {
        return _this.dataService.upsert(
          '/_SYSTEM/_NETWORK/_SETTINGS/NAME',
          config.name,
          {},
          function(e, result) {
            if (e) return callback(e);
            _this.name = result.data.value;
            _this.happn.name = result.data.value;
            callback();
          }
        );
      } else {
        _this.name = response.data.value;
        _this.happn.name = response.data.value;
      }
    }

    callback();
  });
};

SystemService.prototype.processMessage = function(message) {
  if (message.request.action === 'describe')
    message.response = {
      data: this.getDescription(message)
    };

  return message;
};

SystemService.prototype.logError = function(e, area, severity) {
  if (!area) area = 'System';

  if (!severity) severity = CONSTANTS.ERROR_SEVERITY.LOW;

  this.__stats.HEALTH.BY_SEVERITY[severity]++;

  this.__stats.HEALTH.lastError = {
    message: e.toString(),
    area: area,
    severity: severity
  };

  if (!this.__stats.HEALTH.BY_AREA[area]) this.__stats.HEALTH.BY_AREA[area] = 0;

  this.__stats.HEALTH.BY_AREA[area] += severity;

  if (this.__stats.HEALTH.STATUS === CONSTANTS.SYSTEM_HEALTH.EXCELLENT) {
    if (severity === CONSTANTS.ERROR_SEVERITY.LOW)
      this.__stats.HEALTH.STATUS = CONSTANTS.SYSTEM_HEALTH.FAIR;
    if (severity === CONSTANTS.ERROR_SEVERITY.MEDIUM)
      this.__stats.HEALTH.STATUS = CONSTANTS.SYSTEM_HEALTH.TAKING_STRAIN;
    if (severity === CONSTANTS.ERROR_SEVERITY.HIGH || severity === CONSTANTS.ERROR_SEVERITY.FATAL)
      this.__stats.HEALTH.STATUS = CONSTANTS.SYSTEM_HEALTH.POOR;
  } else if (this.__stats.HEALTH.STATUS === CONSTANTS.SYSTEM_HEALTH.FAIR) {
    if (severity === CONSTANTS.ERROR_SEVERITY.MEDIUM)
      this.__stats.HEALTH.STATUS = CONSTANTS.SYSTEM_HEALTH.TAKING_STRAIN;
    if (severity === CONSTANTS.ERROR_SEVERITY.HIGH || severity === CONSTANTS.ERROR_SEVERITY.FATAL)
      this.__stats.HEALTH.STATUS = CONSTANTS.SYSTEM_HEALTH.POOR;
  } else if (this.__stats.HEALTH.STATUS === CONSTANTS.SYSTEM_HEALTH.TAKING_STRAIN) {
    if (severity === CONSTANTS.ERROR_SEVERITY.HIGH || severity === CONSTANTS.ERROR_SEVERITY.FATAL)
      this.__stats.HEALTH.STATUS = CONSTANTS.SYSTEM_HEALTH.POOR;
  }
};

SystemService.prototype.getDescription = function(message) {
  var description = {
    name: this.name,
    secure: this.happn.config.secure ? true : false,
    encryptPayloads: this.happn.config.encryptPayloads ? true : false
  };

  if (message && message.session.cookieName) description.cookieName = message.session.cookieName;

  if (this.happn.services.security._keyPair)
    description.publicKey = this.happn.services.security._keyPair.publicKey;
  return description;
};

SystemService.prototype.__processSystemMessage = function(message) {
  try {
    if (message.action === 'MEMORY_USAGE') {
      message.response = process.memoryUsage();
    }

    if (message.action === 'STATS') {
      message.response = this.stats();
    }

    if (message.action === 'GC') {
      if (!global.gc) {
        message.response = 'GC NOT ENABLED';
      } else {
        global.gc();
        message.response = 'DONE';
      }
    }
  } catch (e) {
    message.response = 'ERROR: ' + e.toString();
  }

  process.send(message);
};

SystemService.prototype.stop = function(options, callback) {
  if (typeof options === 'function') callback = options;

  process.removeAllListeners('message');

  callback();
};

SystemService.prototype.initialize = function(config, callback) {
  process.on('message', this.__processSystemMessage.bind(this));

  this.config = config;
  this.dataService = this.happn.services.data;

  this._ensureSystemName(
    config,
    function(e) {
      if (e) return callback(e);
      this.log.info('instance name: ' + this.name);
      this.log.context = this.name;
      callback();
    }.bind(this)
  );
};
