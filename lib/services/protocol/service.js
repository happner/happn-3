var util = require('util'),
  EventEmitter = require('events').EventEmitter,
  async = require('async'),
  constants = require('../../constants');

module.exports = ProtocolService;

function ProtocolService(opts) {

  this.log = opts.logger.createLogger('Protocol');
  this.log.$$TRACE('construct(%j)', opts);
}

// Enable subscription to key lifecycle events
util.inherits(ProtocolService, EventEmitter);

ProtocolService.prototype.initialize = initialize;
ProtocolService.prototype.stats = stats;
ProtocolService.prototype.processSystem = processSystem;
ProtocolService.prototype.processInboundStack = processInboundStack;
ProtocolService.prototype.processLayers = processLayers;
ProtocolService.prototype.processMessageIn = processMessageIn;
ProtocolService.prototype.processMessageOut = processMessageOut;
ProtocolService.prototype.processMessageInLayers = processMessageInLayers;
ProtocolService.prototype.processMessageOutLayers = processMessageOutLayers;
ProtocolService.prototype.processSystemOut = processSystemOut;
ProtocolService.prototype.__handleProtocolError = __handleProtocolError;
ProtocolService.prototype.__getProtocol = __getProtocol;

function stats() {
  return {
    protocols: Object.keys(this.config.protocols)
  };
}

//takes inbound system requests and transforms them into ones the client understands
function processSystem(message, respond) {

  var protocol = this.__getProtocol(message);
  if (!protocol) return respond(this.happn.services.error.SystemError('unknown system protocol: ' + message.session.protocol, 'protocol'));

  respond(null, protocol.transformSystem(message));
}

//takes outbound system requests and transforms them into ones the client understands
function processSystemOut(message, callback) {
  try {
    var protocol = this.__getProtocol(message);
    if (!protocol) return callback(this.happn.services.error.SystemError('unknown system protocol: ' + message.session.protocol, 'protocol'));
    var systemEvent = protocol.transformSystem(message);
    if (systemEvent.__suppress) return callback();
    protocol.emit(systemEvent, message.session);
    callback();
  } catch (e) {
    this.happn.services.error.handleSystem(e, 'ProtocolService', constants.ERROR_SEVERITY.MEDIUM);
  }
}

function processInboundStack(message, protocol, callback) {

  var transformed;

  try {
    transformed = protocol.transformIn(message);
    if (transformed.__suppress) return callback(null, message);
  } catch (e) {
    return callback(e);
  }

  this.happn.services.security.processAuthorize(transformed, (e, authorized) => {

    if (e) return callback(e);

    if (authorized.request.action == 'set') {
      return this.happn.services.data.processStore(authorized, (e, publication) => {
        if (e) return callback(e);
        if (publication.request.options && publication.request.options.noPublish) return callback(null, publication);
        this.happn.services.publisher.processPublish(publication, function (e, result) {
          if (e) return callback(e);
          callback(null, result);
        });
      });
    }

    if (authorized.request.action == 'remove')
      return this.happn.services.data.processRemove(authorized, (e, publication) => {
        if (e) return callback(e);
        if (publication.request.options && publication.request.options.noPublish) return callback(null, publication);
        this.happn.services.publisher.processPublish(publication, (e, result) => {
          if (e) return callback(e);
          callback(null, result);
        });
      });

    if (authorized.request.action == 'get') {
      return this.happn.services.data.processGet(authorized, (e, result) => {
        if (e) return callback(e);
        callback(null, result);
      });
    }

    if (authorized.request.action == 'count') {
      return this.happn.services.data.processCount(authorized, (e, result) => {
        if (e) return callback(e);
        callback(null, result);
      });
    }

    if (authorized.request.action == 'on') {
      return this.happn.services.subscription.processSubscribe(this.happn.services.subscription.prepareSubscribeMessage(authorized), function (e, result) {
        if (e) return callback(e);
        callback(null, result);
      });
    }

    if (authorized.request.action == 'off')
      return this.happn.services.subscription.processUnsubscribe(this.happn.services.subscription.prepareSubscribeMessage(authorized), function (e, result) {
        if (e) return callback(e);
        callback(null, result);
      });

    if (authorized.request.action === 'request-nonce') return this.happn.services.security.processNonceRequest(authorized, function (e, result) {
      if (e) return callback(e);
      callback(null, result);
    });

    if (authorized.request.action === 'describe') return callback(null, this.happn.services.system.processMessage(authorized));

    if (authorized.request.action === 'configure-session') {
      this.happn.services.session.processConfigureSession(authorized);
      return callback(null, authorized);
    }

    if (authorized.request.action === 'login') {

      if (this.config.secure) return this.happn.services.security.processLogin(authorized, (e, result) => {
        if (e) return callback(e);
        callback(null, result);
      });

      return this.happn.services.security.processUnsecureLogin(authorized, (e, result) => {
        if (e) return callback(e);
        callback(null, result);
      });
    }

    if (authorized.request.action === 'ack') return this.happn.services.publisher.processAcknowledge(authorized, (e, result) => {
      if (e) return callback(e);
      callback(null, result);
    });

    if (authorized.request.action === 'revoke-session') return this.happn.services.session.processRevokeSession(authorized, function (e, result) {
      if (e) return callback(e);
      callback(null, result);
    });
  });
}

function __handleProtocolError(protocol, message, e, callback) {

  message.error = e.cause ? e.cause : e;
  callback(null, protocol.fail(message));
  var logMessage;
  //access denieds are not system errors, and should be logged as warnings
  if (e.toString() == 'AccessDenied: unauthorized' && message.request && message.request.path) {

    logMessage = 'AccessDenied: unauthorized, path: ' + message.request.path;
    logMessage += ', action: ' + message.request.action;

    if (message.session && message.session.user && message.session.user.username)
      logMessage += ', username: ' + message.session.user.username;

    if (e.reason) logMessage += ', reason: ' + e.reason;

    return this.happn.services.log.warn(logMessage, '', 'SecurityService');
  }

  if (e.toString() == 'AccessDenied: Invalid credentials') {
    logMessage = 'AccessDenied: Invalid credentials, request: ' + JSON.stringify(message.request);
    return this.happn.services.log.warn(logMessage, '', 'SecurityService');
  }

  if (e.toString() == 'AccessDenied: Account locked out') {
    logMessage = 'AccessDenied: Account locked out, request: ' + JSON.stringify(message.request);
    return this.happn.services.log.warn(logMessage, '', 'SecurityService');
  }

  this.happn.services.error.handleSystem(e, 'ProtocolService', constants.ERROR_SEVERITY.MEDIUM);
}

function __getProtocol(message) {
  var protocol = this.config.protocols[message.session.protocol];
  if (!protocol) {
    //backward compatibility happn_1.3.0
    if (message.session.protocol.indexOf('happn') == 0) protocol = this.config.protocols.happn_1;
  }
  return protocol;
}

function processMessageIn(message, callback) {

  var protocol = this.__getProtocol(message);
  if (!protocol) return callback(this.happn.services.error.SystemError('unknown inbound protocol: ' + message.session.protocol, 'protocol'));

  this.processInboundStack(message, protocol, (e, processed) => {
    if (e) return this.__handleProtocolError(protocol, message, e, callback);
    callback(null, protocol.success(processed));
  });
}

function processLayers(message, layers, callback) {

  if (layers == null || layers.length == 0) return callback(null, message);
  async.waterfall([function (layerCallback) {
    layerCallback(null, message);
  }].concat(layers), callback);
}

function processMessageInLayers(message, callback) {

  var protocol = this.__getProtocol(message);
  if (!protocol) return callback(this.happn.services.error.SystemError('unknown inbound protocol: ' + message.session.protocol, 'protocol'));

  this.processLayers(message, this.config.inboundLayers, (e, inboundTransformed) => {
    if (e) return this.__handleProtocolError(protocol, message, e, callback);
    this.processInboundStack(inboundTransformed, protocol, (e, processed) => {
      if (e) return this.__handleProtocolError(protocol, message, e, callback);
      this.processLayers(processed, this.config.outboundLayers, (e, outboundTransformed) => {
        if (e) return this.__handleProtocolError(protocol, message, e, callback);
        callback(null, protocol.success(outboundTransformed));
      });
    });
  });
}

function processMessageOutLayers(message, callback) {

  var protocol = this.__getProtocol(message);
  //dont need to check if the protocol exists because it always should

  this.processLayers(protocol.transformOut(message), this.config.outboundLayers, (e, transformedPublication) => {
    if (e) return this.__handleProtocolError(protocol, message, e, callback);
    try {
      protocol.emit(transformedPublication, message.session);
      callback(null, transformedPublication);
    } catch (protocolError) {
      this.__handleProtocolError(protocol, message, protocolError, callback);
    }
  });
}

function processMessageOut(message, callback) {

  try {
    var protocol = this.config.protocols[message.session.protocol];
    var publication = protocol.transformOut(message);
    protocol.emit(publication, message.session);
    callback(null, publication);
  } catch (e) {
    callback(e);
  }
}

function initialize(config, callback) {

  if (!config) config = {};

  if (!config.protocols) config.protocols = {};

  var packageProtocol = require('../../../package.json').protocol;

  this.__latest = require('./happn_' + packageProtocol).create();
  this.__earliest = require('./happn_1').create();

  config.protocols['happn_' + packageProtocol] = this.__latest;
  //the earliest clients have no protocol version, so we use the earliest by default
  config.protocols.happn = this.__earliest;

  for (var i = 1; i < packageProtocol; i++)
    if (!config.protocols['happn_' + i]) config.protocols['happn_' + i] = require('./happn_' + i).create();

  for (var protocolKey in config.protocols) {

    var protocol = config.protocols[protocolKey];

    protocol.happn = this.happn;
    protocol.protocolVersion = protocolKey;
    protocol.initialize();
  }

  this.config = config;

  if (this.config.outboundLayers) this.processMessageOut = this.processMessageOutLayers;
  if (this.config.inboundLayers) this.processMessageIn = this.processMessageInLayers;

  return callback();
}
