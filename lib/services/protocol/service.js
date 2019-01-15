var util = require('util'),
  EventEmitter = require('events').EventEmitter,
  Promise = require('bluebird'),
  async = require('async'),
  constants = require('../../constants');

module.exports = ProtocolService;

function ProtocolService(opts) {

  if (!opts) opts = {};

  this.log = opts.logger.createLogger('Protocol');
  this.log.$$TRACE('construct(%j)', opts);
  this.__stackCache = {};
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

function stats () {
  return {
    protocols: Object.keys(this.config.protocols)
  };
}

//takes inbound system requests and transforms them into ones the client understands
function processSystem (message, respond) {

  if (!this.config.protocols[message.session.protocol]) return respond(this.happn.services.error.SystemError('unknown system protocol: ' + message.session.protocol, 'protocol'));
  respond(null, this.config.protocols[message.session.protocol].transformSystem(message));
}

//takes outbound system requests and transforms them into ones the client understands
function processSystemOut (message, callback) {
  try{
    var systemEvent = this.config.protocols[message.session.protocol].transformSystem(message);
    if (systemEvent.__suppress) return callback();
    this.config.protocols[message.session.protocol].emit(systemEvent, message.session);
    callback();
  }catch(e){
    this.happn.services.error.handleSystem(e, 'ProtocolService', constants.ERROR_SEVERITY.MEDIUM);
    callback(e);
  }
}

function processInboundStack (message, protocol) {

  var _this = this;
  var transformed;

  try{
    transformed = protocol.transformIn(message);
    if (transformed.__suppress) return Promise.resolve(message);
  }catch(e){
    return Promise.reject(e);
  }

  if (['set', 'remove'].indexOf(transformed.request.action) > -1){
    return _this.happn.services.security.processAuthorize(transformed)
    .then(function(authorized){
      if (transformed.request.action == 'set') return _this.happn.services.data.processStore(authorized);
      return _this.happn.services.data.processRemove(authorized);
    })
    .then(function(updated){
      return _this.happn.services.subscription.processGetRecipients(updated);
    })
    .then(function(publication){
      if (publication.request.options && publication.request.options.noPublish) return Promise.resolve(publication);
      return _this.happn.services.publisher.processPublish(publication);
    });
  }

  if (transformed.request.action == 'get'){
    return _this.happn.services.security.processAuthorize(transformed)
    .then(function(authorized){
      return _this.happn.services.data.processGet(authorized);
    });
  }

  if (transformed.request.action == 'on'){
    return _this.happn.services.security.processAuthorize(transformed)
    .then(function(authorized){
      return _this.happn.services.subscription.processSubscribe(_this.happn.services.subscription.prepareSubscribeMessage(authorized));
    });
  }

  if (transformed.request.action == 'off')
    return _this.happn.services.subscription.processUnsubscribe(_this.happn.services.subscription.prepareSubscribeMessage(transformed));

  if (transformed.request.action === 'request-nonce') return this.happn.services.security.processNonceRequest(transformed);

  if (transformed.request.action === 'describe') return this.happn.services.system.processMessage(transformed);

  if (transformed.request.action === 'configure-session') return this.happn.services.session.processConfigureSession(transformed);

  if (transformed.request.action === 'login') {
    if (this.config.secure) return this.happn.services.security.processLogin(transformed);
    else return this.happn.services.security.processUnsecureLogin(transformed);
  }

  if (transformed.request.action === 'ack') return this.happn.services.publisher.processAcknowledge(transformed);

  if (transformed.request.action === 'revoke-session') return this.happn.services.session.processRevokeSession(transformed);
}

function __handleProtocolError(protocol, message, e, callback){

  message.error = e.cause ? e.cause : e;
  callback(null, protocol.fail(message));
  //access denieds are not system errors, and should be logged as warnings
  if (e.toString() == 'AccessDenied: unauthorized' && message.request && message.request.path){

    var logMessage = 'AccessDenied: unauthorized, path: ' + message.request.path;
    logMessage += ', action: ' + message.request.action;

    if (message.session && message.session.user && message.session.user.username)
      logMessage += ', username: ' + message.session.user.username;

    this.happn.services.log.warn(logMessage, '', 'ProtocolService');

  } else this.happn.services.error.handleSystem(e, 'ProtocolService', constants.ERROR_SEVERITY.MEDIUM);
}

function processMessageIn (message, callback) {

  var _this = this;

  var protocol = _this.config.protocols[message.session.protocol];
  if (!protocol) return callback(_this.happn.services.error.SystemError('unknown inbound protocol: ' + message.session.protocol, 'protocol'));

  _this.processInboundStack(message, protocol)
  .then(function (processed) {
    callback(null, protocol.success(processed));
  })
  .catch(function(e){
    _this.__handleProtocolError(protocol, message, e, callback);
  });
}

function processLayers(message, layers){
  var _this = this;
  return new Promise(function(resolve, reject){
    if (layers == null || layers.length == 0) return resolve(message);
    async.waterfall([function(callback) {
        callback(null, message);
    }].concat(layers), function(e, result){
      if (e) return reject(e);
      resolve(result);
    });
  });
}

function processMessageInLayers (message, callback) {

  var _this = this;

  var protocol = _this.config.protocols[message.session.protocol];
  if (!protocol) return callback(_this.happn.services.error.SystemError('unknown inbound protocol: ' + message.session.protocol, 'protocol'));

  _this.processLayers(message, _this.config.inboundLayers)
  .then(function(inboundTransformed){
    return _this.processInboundStack(inboundTransformed, protocol);
  })
  .then(function (processed) {
    return _this.processLayers(processed, _this.config.outboundLayers);
  })
  .then(function (layerProcessed) {
    callback(null, protocol.success(layerProcessed));
  })
  .catch(function (e) {
    _this.__handleProtocolError(protocol, message, e, callback);
  });
}

function processMessageOutLayers (message, callback) {

  var _this = this;

  try{

    var protocol = this.config.protocols[message.session.protocol];

    _this.processLayers(protocol.transformOut(message), _this.config.outboundLayers)
    .then(function(transformedPublication){
      protocol.emit(transformedPublication, message.session);
      callback(null, transformedPublication);
    })
    .catch(function(e){
      callback(e);
    });
  }catch(e){
    callback(e);
  }
}

function processMessageOut (message, callback) {

  try{
    var protocol = this.config.protocols[message.session.protocol];
    var publication = protocol.transformOut(message);
    protocol.emit(publication, message.session);
    callback(null, publication);
  }catch(e){
    callback(e);
  }
}

function initialize (config, callback) {

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
