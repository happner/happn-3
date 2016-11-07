var util = require('util')
  , EventEmitter = require('events').EventEmitter
  , Promise = require('bluebird')
  , async = require('async')
  ;

module.exports = ProtocolService;

function ProtocolService(opts) {

  if (!opts) opts = {};

  this.log = opts.logger.createLogger('Protocol');
  this.log.$$TRACE('construct(%j)', opts);

  this.__protocolStats = {};
  this.__stackCache = {};

  this.__benchmarkStats = {};

}

// Enable subscription to key lifecycle events
util.inherits(ProtocolService, EventEmitter);

ProtocolService.prototype.stats = function () {
  return {
    protocols:Object.keys(this.config.protocols),
    protocolCounts:this.__protocolStats,
    benchmarks:this.__benchmarkStats
  }
};

ProtocolService.prototype.processSystem = function(message, respond){

  var _this = this;

  var protocol = _this.config.protocols[message.session.protocol];//happn by default

  if (!protocol) return respond(_this.happn.services.error.SystemError('unknown system protocol: ' + message.session.protocol, 'protocol'));

  async.waterfall([

    _this.happn.services.layer.begin(message),

    _this.happn.services.layer.log,

    protocol.transformSystem

  ], respond);
};

ProtocolService.prototype.benchmarkStart = function(message, callback){

  if (!this.__benchmarkStats[message.request.action]) this.__benchmarkStats[message.request.action] = {current:{}, count:0, totalTime:0, avg:0};

  this.__benchmarkStats[message.request.action].current[message.id] = Date.now();

  this.__benchmarkStats[message.request.action].count++;

  callback(null, message);

};

ProtocolService.prototype.benchmarkEnd = function(message, callback){

  var stat = this.__benchmarkStats[message.request.action];

  var timespan = Date.now() - stat.current[message.id];

  delete stat.current[message.id];

  stat.totalTime += timespan;

  stat.avg = stat.totalTime / stat.count;

  callback(null, message);

};

ProtocolService.prototype.__getInboundStack = function(transformed){

  var stack = [this.happn.services.layer.begin(transformed)];
  var stackKey = transformed.request.action + (transformed.request.options?JSON.stringify(transformed.request.options):'');

  if (!this.__stackCache[stackKey]){

    var cachedStack = [];

    if (this.config.benchMarkEnabled) cachedStack.push(this.benchmarkStart.bind(this));

    if (this.config.loggingEnabled) cachedStack.push(this.happn.services.layer.log);

    if (this.config.secure) cachedStack.push(this.happn.services.layer.security.in);

    if (transformed.request.action === 'set'){

      if (transformed.request.options && transformed.request.options.noStore) cachedStack.push(this.happn.services.layer.data.doNoStore);

      else {

        if (this.config.secure)
          cachedStack.push(this.happn.services.layer.data.doSecureStore);

        else cachedStack.push(this.happn.services.layer.data.doStore);
      }

      if (!transformed.request.options || !transformed.request.options.noPublish) cachedStack.push(this.happn.services.layer.pubsub);
    }

    else if (transformed.request.action === 'remove'){

      cachedStack.push(this.happn.services.layer.data.doRemove);
      cachedStack.push(this.happn.services.layer.pubsub);
    }

    else if (transformed.request.action === 'get'){

      cachedStack.push(this.happn.services.layer.data.doGet);
    }

    else if (['on', 'off'].indexOf(transformed.request.action) > -1){

      cachedStack.push(this.happn.services.layer.pubsub);
    }

    else if (transformed.request.action === 'describe'){

      cachedStack.push(this.happn.services.layer.system);
    }

    else if (transformed.request.action === 'configure-session'){

      cachedStack.push(this.happn.services.layer.session.configured);
    }

    else if (transformed.request.action === 'login' && !this.config.secure){

      cachedStack.push(this.happn.services.layer.security.doUnsecureLogin);
    }

    if (this.config.benchMarkEnabled) cachedStack.push(this.benchmarkEnd.bind(this));

    if (this.config.secure && this.happn.services.security.config.audit) cachedStack.push(this.happn.services.layer.security.doAudit);

    this.__stackCache[stackKey] = cachedStack;
  }

  stack.push.apply(stack, this.__stackCache[stackKey]);

  return stack;
};

ProtocolService.prototype.__respondMessageIn = function(protocol, message, respond, e){

  try{
    if (e) return protocol.fail(e, message, respond);
    return protocol.success(message, respond);
  }catch(e){
    this.happn.services.error.handleSystem(e);
  }
};

ProtocolService.prototype.executeInboundStack = Promise.promisify(function(transformed, callback){

  var _this = this;

  return async.waterfall(

    _this.__getInboundStack(transformed),

    callback
  );
});

ProtocolService.prototype.processMessageIn = function(message, callback){

  var _this = this;

  var protocol = _this.config.protocols[message.session.protocol];//happn by default

  if (!protocol) return callback(_this.happn.services.error.SystemError('unknown inbound protocol: ' + message.session.protocol, 'protocol'));

  protocol.transformIn(message)

    .then(function (transformed) {
      return _this.executeInboundStack(transformed)
    })
    .then(function (transformed) {
      _this.__respondMessageIn(protocol, transformed, callback);
    })
    .catch(function (e) {
      _this.__respondMessageIn(protocol, message, callback, e);
    });
};

var cachedProtocol;

ProtocolService.prototype.current = function(){

  if (!cachedProtocol) cachedProtocol = 'happn_' + this.happn.services.system.package.protocol;

  return cachedProtocol;
};

ProtocolService.prototype.__getOutboundStack = function(transformed){

  var stack = [this.happn.services.layer.begin(transformed)];

  if (!this.__stackCache['system:outbound']){

    var cachedStack = [];

    //if (this.config.secure) cachedStack.push(this.happn.services.layer.security.out);
    if (this.config.loggingEnabled) cachedStack.push(this.happn.services.layer.log);

    this.__stackCache[transformed.request.action] = cachedStack;
  }

  stack.push.apply(stack, this.__stackCache['system:outbound']);

  return stack;
};

ProtocolService.prototype.processMessageOut = function(message, respond){

  var _this = this;

  var protocol = _this.config.protocols[message.session.protocol];//happn by default

  if (!protocol) return respond(_this.happn.services.error.SystemError('unknown inbound protocol: ' + message.session.protocol, 'protocol'));

  protocol.transformOut(message, function(e, transformed){

    if (e) return respond(e);

    return async.waterfall(

      _this.__getOutboundStack(transformed),

      function (e, publication) {

        if (e) return respond(e);
        protocol.emit(publication, message.session, respond);
      }
    );
  });
};

ProtocolService.prototype.initialize = Promise.promisify(function (config, callback) {

  if (!config) config = {};

  if (!config.protocols) config.protocols = {};

  HappnProtocol = require('./happn_' + require('../../../package.json').protocol);

  this.__latest = new HappnProtocol();

  config.protocols['happn_' + require('../../../package.json').protocol] = this.__latest;
  config.protocols['happn'] = this.__latest;

  for (var protocolKey in config.protocols) {

    var protocol = config.protocols[protocolKey];

    Object.defineProperty(protocol, 'happn', {value:this.happn});

    //waterfall messes with "this" - this makes the code cleaner

    protocol.transformIn = protocol.transformIn.bind(protocol);
    protocol.transformOut = protocol.transformOut.bind(protocol);
    protocol.transformSystem = protocol.transformSystem.bind(protocol);
    protocol.emit = protocol.emit.bind(protocol);
    protocol.fail = protocol.fail.bind(protocol);
    protocol.success = protocol.success.bind(protocol);

  }

  this.config = config;

  return callback();

});

