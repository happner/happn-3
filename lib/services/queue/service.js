var util = require('util')
  , EventEmitter = require('events').EventEmitter
  , Promise = require('bluebird')
  , async = require('async')
  ;

module.exports = QueueService;

function QueueService(opts) {

  if (!opts) opts = {};

  this.log = opts.logger.createLogger('Queue');
  this.log.$$TRACE('construct(%j)', opts);

  EventEmitter.call(this);

  this.statsInternal = {
    inbound: 0,
    outbound: 0,
    failures:0
  };
}

util.inherits(QueueService, EventEmitter);

QueueService.prototype.stats = function () {

  this.statsInternal.inbound = this.__inboundQueue.tasks.length;
  this.statsInternal.inbound_sequential = this.__inboundSequentialQueue.tasks.length;
  this.statsInternal.outbound = this.__outboundQueue.tasks.length;
  this.statsInternal.outbound_sequential = this.__outboundSequentialQueue.tasks.length;

  return this.statsInternal;
};

QueueService.prototype.inboundDrain = function () {
  this.emit('inbound-queue-empty');
};

QueueService.prototype.inboundSequentialDrain = function () {
  this.emit('inbound-sequential-queue-empty');
};

QueueService.prototype.outboundDrain = function () {
  this.emit('outbound-queue-empty');
};

QueueService.prototype.outboundSequentialDrain = function () {
  this.emit('outbound-sequential-queue-empty');
};

QueueService.prototype.stop = Promise.promisify(function (options, callback) {
  callback();
});

QueueService.prototype.initialize = Promise.promisify(function (config, callback) {

  if (!config) config = {};

  this.config = config;

  if (this.config.mode === 'direct'){ //no queue or quality of service

    this.pushInbound = Promise.promisify(this.happn.services.protocol.processMessageIn.bind(this.happn.services.protocol));

    this.pushOutbound = Promise.promisify(this.happn.services.protocol.processMessageOut.bind(this.happn.services.protocol));

    this.pushSystem = Promise.promisify(this.happn.services.protocol.processSystem.bind(this.happn.services.protocol));

  }else {

    if (!this.config.concurrency) this.config.concurrency = Infinity;
    if (!this.config.systemConcurrency) this.config.systemConcurrency = 1;//system events are concurrent

    //GET SET ON DELETE
    this.__inboundQueue = async.queue(this.happn.services.protocol.processMessageIn.bind(this.happn.services.protocol), this.config.concurrency);

    //publications based on subscriptions
    this.__outboundQueue = async.queue(this.happn.services.protocol.processMessageOut.bind(this.happn.services.protocol), this.config.concurrency);

    this.__inboundQueue.drain = this.inboundDrain.bind(this);

    this.__outboundQueue.drain = this.outboundDrain.bind(this);

    //system events - disconnect/reconnect etc.
    this.__systemQueue = async.queue(this.happn.services.protocol.processSystem.bind(this.happn.services.protocol), this.config.systemConcurrency);
  }

  return callback();

});

QueueService.prototype.pushInbound = Promise.promisify(function(message, callback){

  var _this = this;

  _this.__inboundQueue.push(message, function(e){

    if (e) {
      _this.stats.failures++;
      _this.emit('queue-failure', {message:message, error:e});
    }

    callback(e, message);
  });
  _this.emit('inbound-job-queued', message);

});


QueueService.prototype.pushOutbound = Promise.promisify(function(message, callback){

  this.__outboundQueue.push(message, callback);
  this.emit('outbound-job-queued', message);
  this.stats.outbound ++;

});

QueueService.prototype.pushSystem = Promise.promisify(function(message, callback){

  this.__systemQueue.push(message, callback);
  this.emit('system job queued', message);
  this.stats.system ++;

});

