const CONSTANTS = require('../../../').constants;

module.exports = ErrorService;

function AccessDenied(message, reason) {
  this.name = 'AccessDenied';
  this.code = CONSTANTS.ERROR_TYPE.ACCESS_DENIED;
  this.message = message;

  if (reason) this.reason = reason;
}

AccessDenied.prototype = Error.prototype;

function InvalidCredentials(message, reason) {
  this.name = 'AccessDenied';
  this.code = CONSTANTS.ERROR_TYPE.INVALID_CREDENTIALS;
  this.message = message;

  if (reason) this.reason = reason;
}

InvalidCredentials.prototype = Error.prototype;

function ResourceNotFound(message) {
  this.name = 'ResourceNotFound';
  this.code = CONSTANTS.ERROR_TYPE.NOT_FOUND;
  this.message = message;
}

ResourceNotFound.prototype = Error.prototype;

function SystemError(error, reason, severity) {
  if (typeof error === 'string') {
    this.message = error;
  } else {
    this.message = error.toString().replace('Error: ', '');
    this.inner = error;
  }

  this.name = 'SystemError';
  this.code = CONSTANTS.ERROR_TYPE.SYSTEM;
  if (!severity) severity = CONSTANTS.ERROR_SEVERITY.LOW;
  this.severity = severity;
  if (reason) this.reason = reason;
  if (error.stack) {
    this.stack = error.stack;
  }
}

SystemError.prototype = Error.prototype;

SystemError.prototype.toString = function() {
  return this.name + ': ' + this.message;
};

function ValidationError(message, fields) {
  this.name = 'ValidationError';
  this.code = CONSTANTS.ERROR_TYPE.SYSTEM;
  this.message = message;

  if (fields) this.fields = fields;
}

ValidationError.prototype = Error.prototype;

function ErrorService() {}

ErrorService.prototype.AccessDeniedError = function(message, reason) {
  return new AccessDenied(message, reason);
};

ErrorService.prototype.ResourceNotFoundError = function(message, reason) {
  return new ResourceNotFound(message, reason);
};

ErrorService.prototype.SystemError = function(message, reason) {
  return new SystemError(message, reason);
};

ErrorService.prototype.ValidationError = function(message, reason) {
  return new ValidationError(message, reason);
};

ErrorService.prototype.InvalidCredentialsError = function(message, reason) {
  return new InvalidCredentials(message, reason);
};

ErrorService.prototype.handleSystem = function(e, area, severity, callback) {
  if (!area) area = 'System';

  if (!severity) severity = CONSTANTS.ERROR_SEVERITY.LOW;

  var systemError = this.SystemError(e, area, severity);

  this.happn.services.system.logError(e, area, severity);

  var logMessage = 'system error: ' + area;
  if (systemError.stack) logMessage += ', stack: ' + systemError.stack;

  this.happn.services.log.write(
    ': ' + systemError.message,
    'error',
    logMessage,
    null,
    null,
    function() {
      if (typeof callback === 'function') {
        return callback(systemError);
      }
    }
  );

  return systemError;
};

ErrorService.prototype.handleFatal = function(message, e, area) {
  if (!area) area = 'System';
  this.happn.services.log.write('fatal error', 'fatal', this.SystemError(e.toString()), area);
  // eslint-disable-next-line no-console
  console.warn(e.stack);
  process.exit(1);
};
