var Promise = require('bluebird');
constants = require('../../../').constants;

module.exports = ErrorService;

function AccessDenied(message, reason) {

  this.name = 'AccessDenied';
  this.code = constants.ERROR_TYPE.ACCESS_DENIED;
  this.message = message;

  if (reason) this.reason = reason;
}

AccessDenied.prototype = Error.prototype;

function InvalidCredentials(message, reason) {

  this.name = 'AccessDenied';
  this.code = constants.ERROR_TYPE.INVALID_CREDENTIALS;
  this.message = message;

  if (reason) this.reason = reason;
}

InvalidCredentials.prototype = Error.prototype;

function ResourceNotFound(message) {

  this.name = 'ResourceNotFound';
  this.code = constants.ERROR_TYPE.NOT_FOUND;
  this.message = message;
}

ResourceNotFound.prototype = Error.prototype;

function SystemError(error, reason, severity) {

  if (typeof error == 'string') {
    this.message = error;
  } else {
    this.message = error.toString().replace('Error: ', '');
    this.inner = error;
  }

  this.name = 'SystemError';

  this.code = constants.ERROR_TYPE.SYSTEM;

  if (!severity) severity = constants.ERROR_SEVERITY.LOW;

  this.severity = severity;

  if (reason) this.reason = reason;

  if (error.stack) {
    console.log(error.stack);
    this.stack = error.stack;
  }
}

SystemError.prototype = Error.prototype;

SystemError.prototype.toString = function () {
  return this.name + ': ' + this.message;
};

function ValidationError(message, fields) {

  this.name = 'ValidationError';
  this.code = constants.ERROR_TYPE.SYSTEM;
  this.message = message;

  if (fields) this.fields = fields;
}

ValidationError.prototype = Error.prototype;

function ErrorService() {}

ErrorService.prototype.AccessDeniedError = function (message, reason) {

  return new AccessDenied(message, reason);
};

ErrorService.prototype.ResourceNotFoundError = function (message, reason) {

  return new ResourceNotFound(message, reason);
};

ErrorService.prototype.SystemError = function (message, reason) {

  return new SystemError(message, reason);
};

ErrorService.prototype.ValidationError = function (message, reason) {

  return new ValidationError(message, reason);
};

ErrorService.prototype.InvalidCredentialsError = function (message, reason) {

  return new InvalidCredentials(message, reason);
};

ErrorService.prototype.handleSystem = function (e, area, severity, callback) {

  if (!area) area = 'System';

  if (!severity) severity = constants.ERROR_SEVERITY.LOW;

  var systemError = this.SystemError(e, area, severity);

  this.happn.services.system.logError(e, area, severity);

  this.happn.services.log.write(systemError.message, 'error', 'system error: ' + area + ', stack: ' + systemError.stack, null, null, function () {
    if (typeof callback == 'function') {
      return callback(systemError);
    }
  });
};

ErrorService.prototype.handleFatal = function (message, e, area) {
  if (!area) area = 'System';
  this.happn.services.log.write('fatal error', 'fatal', this.SystemError(e.toString()), area);
  console.warn(e.stack);
  process.exit(1);
};
