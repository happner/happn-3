var util = require('util'),
  EventEmitter = require('events').EventEmitter,
  Promise = require('bluebird'),
  async = require('async');

module.exports = QueueService;

function QueueService(opts) {

  if (!opts) opts = {};

  this.log = opts.logger.createLogger('Queue');
  this.log.$$TRACE('construct(%j)', opts);

  EventEmitter.call(this);

  // for calculating queue messages per second at time of calling stats()
  this.lastStatsCalledAt = Date.now();

  this.statsInternal = {
    publication: 0,
    inbound: 0,
    outbound: 0,
    system: 0,
    failures: 0
  };
}

util.inherits(QueueService, EventEmitter);

QueueService.prototype.stats = function () {

  var now = Date.now();
  var seconds = (now - this.lastStatsCalledAt) / 1000;
  this.lastStatsCalledAt = now;

  if (this.__inboundQueue != null) this.statsInternal.inbound = {
    length: this.__inboundQueue.length(),
    rate: this.__inboundQueue.__count / seconds
  };
  if (this.__outboundQueue != null) this.statsInternal.outbound = {
    length: this.__outboundQueue.length(),
    rate: this.__outboundQueue.__count / seconds
  };
  if (this.__systemQueue != null) this.statsInternal.system = {
    length: this.__systemQueue.length(),
    rate: this.__systemQueue.__count / seconds
  };
  if (this.__publicationQueue != null) this.statsInternal.publication = {
    length: this.__publicationQueue.length(),
    rate: this.__publicationQueue.__count / seconds
  };

  this.__inboundQueue.__count = 0;
  this.__outboundQueue.__count = 0;
  this.__systemQueue.__count = 0;
  this.__publicationQueue.__count = 0;

  return this.statsInternal;
};

QueueService.prototype.inboundDrain = function () {
  this.emit('inbound-queue-empty');
};

QueueService.prototype.outboundDrain = function () {
  this.emit('outbound-queue-empty');
};

QueueService.prototype.outboundDrain = function () {
  this.emit('outbound-queue-empty');
};

QueueService.prototype.systemDrain = function () {
  this.emit('system-queue-empty');
};

QueueService.prototype.publicationDrain = function () {
  this.emit('publication-queue-empty');
};

QueueService.prototype.stop = Promise.promisify(function (options, callback) {
  callback();
});

QueueService.prototype.initialize = Promise.promisify(function (config, callback) {

  var _this = this;

  if (!config) config = {};

  this.config = config;

  if (this.config.mode === 'direct') { //no queue or quality of service

    this.pushInbound = Promise.promisify(this.happn.services.protocol.processMessageIn.bind(this.happn.services.protocol));

    this.pushOutbound = Promise.promisify(this.happn.services.protocol.processMessageOut.bind(this.happn.services.protocol));

    this.pushSystem = Promise.promisify(this.happn.services.protocol.processSystem.bind(this.happn.services.protocol));

    this.pushPublication = Promise.promisify(this.happn.services.publisher.performPublication.bind(this.happn.services.publisher));

  } else {

    if (!this.config.concurrency) this.config.concurrency = 100;

    if (!this.config.systemConcurrency) this.config.systemConcurrency = 1; //system events are concurrent

    if (!this.config.concurrencyIn) this.config.concurrencyIn = this.config.concurrency;

    if (!this.config.concurrencyOut) this.config.concurrencyOut = this.config.concurrency;

    if (!this.config.concurrencyPublisher) this.config.concurrencyPublisher = this.config.concurrency  * 10;

    //GET SET ON DELETE
    this.__inboundQueue = async.queue(this.happn.services.protocol.processMessageIn.bind(this.happn.services.protocol), this.config.concurrencyIn);
    this.__inboundQueue.__count = 0;

    //outbound writes to recipients via a publication
    this.__outboundQueue = async.queue(this.happn.services.protocol.processMessageOut.bind(this.happn.services.protocol), this.config.concurrencyOut);
    this.__outboundQueue.__count = 0;

    //publications
    this.__publicationQueue = async.queue(this.happn.services.publisher.performPublication.bind(this.happn.services.publisher), this.config.concurrencyPublisher);
    this.__publicationQueue.__count = 0;

    //system events - disconnect/reconnect etc.
    this.__systemQueue = async.queue(this.happn.services.protocol.processSystem.bind(this.happn.services.protocol), this.config.systemConcurrency);
    this.__systemQueue.__count = 0;

    this.__inboundQueue.drain = this.inboundDrain.bind(this);

    this.__outboundQueue.drain = this.outboundDrain.bind(this);

    this.__publicationQueue.drain = this.publicationDrain.bind(this);

    this.__systemQueue.drain = this.systemDrain.bind(this);
  }

  return callback();

});

QueueService.prototype.pushInbound = Promise.promisify(function (message, callback) {

  var _this = this;

  this.__inboundQueue.__count++;

  _this.__inboundQueue.push(message, function (e) {

    if (e) {
      _this.stats.failures++;
      _this.emit('queue-failure', {
        message: message,
        error: e
      });
    }

    callback(e, message);
  });
  _this.emit('inbound-job-queued', message);

});


QueueService.prototype.pushOutbound = Promise.promisify(function (message, callback) {

  this.__outboundQueue.__count++;
  this.__outboundQueue.push(message, callback);
  this.emit('outbound-job-queued', message);

});

QueueService.prototype.pushSystem = Promise.promisify(function (message, callback) {

  this.__systemQueue.__count++;
  this.__systemQueue.push(message, callback);
  this.emit('system job queued', message);

});

QueueService.prototype.pushPublication = Promise.promisify(function (publication, callback) {

  this.__publicationQueue.__count++;
  this.__publicationQueue.push(publication, callback);
  this.emit('publication job queued', publication);

});
