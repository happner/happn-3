module.exports = LayerService;

var util = require('util'),
  EventEmitter = require('events').EventEmitter,
  uuid = require('uuid'),
  path = require('path');

// Enable subscription to key lifecycle events
util.inherits(LayerService, EventEmitter);

LayerService.prototype.initialize = initialize;
LayerService.prototype.stats = stats;
LayerService.prototype.stop = stop;
LayerService.prototype.__registerLayer = __registerLayer;

function LayerService(opts) {
  this.log = opts.logger.createLogger('Layer');
  this.log.$$TRACE('construct(%j)', opts);

  this.__Layers = {};
}

function initialize(config, callback) {
  var _this = this;

  try {

    if (!config) config = {};

    _this.config = config;

    // this.__registerLayer('security', ['doAudit', 'doUnsecureLogin', 'processLogin', 'processAuthorize', 'processNonceRequest', 'processLogin']);
    //
    // this.__registerLayer('publisher', ['processPublish', 'processAcknowledge']);
    //
    // this.__registerLayer('subscription', ['processSubscribe', 'processUnsubscribe', 'processGetRecipients', 'prepareSubscribeMessage']);
    //
    // this.__registerLayer('log');
    //
    // this.__registerLayer('data', ['doStore', 'doNoStore', 'doGet', 'doRemove', 'doSecureStore']);
    //
    // this.__registerLayer('session', ['configured', 'processDisconnect', 'processRevokeSession']);
    //
    // this.__registerLayer('system');

    this.begin = function (message) {
      return function (callback) {
        callback(null, message);
      };
    };

    callback();

  } catch (e) {
    callback(e);
  }
}

function stats() {
  return {
    Layers: this.__Layers.length
  };
}

function stop(options, callback) {
  try {
    var _this = this;

    if (typeof options == 'function') {
      callback = options;
      options = null;
    }

    if (!options) options = {};

    callback();

  } catch (e) {
    callback(e);
  }
}

function __registerLayer(serviceName, methods) {
  var service = this.happn.services[serviceName];

  if (!service) throw new this.happn.services.error.SystemError('service ' + serviceName + ' not found for layer', 'layer');

  if (service.processMessage) this[serviceName] = service.processMessage.bind(service);
  else this[serviceName] = {};

  if (service.processMessageIn) {
    if (!this[serviceName]) this[serviceName] = {};
    this[serviceName].in = service.processMessageIn.bind(service);
  }

  if (service.processMessageOut) {
    if (!this[serviceName]) this[serviceName] = {};
    this[serviceName].out = service.processMessageOut.bind(service);
  }

  //specified layers
  if (methods) {
    var _this = this;
    methods.forEach(function (methodName) {
      _this[serviceName][methodName] = service[methodName].bind(service);
    });
  }
}
