var path = require('path'),
  util = require('util'),
  EventEmitter = require('events').EventEmitter,
  async = require('async'),
  Publication = require('./publication'),
  CONSISTENCY = require('../../../').constants.CONSISTENCY,
  constants = require('../../constants'),
  Promise = require('bluebird');

function PublisherService(opts) {

  this.log = opts.logger.createLogger('Publisher');

  this.log.$$TRACE('construct(%j)', opts);
}

// Enable subscription to key lifecycle events
util.inherits(PublisherService, EventEmitter);

PublisherService.prototype.stats = stats;
PublisherService.prototype.processAcknowledge = processAcknowledge;
PublisherService.prototype.initialize = initialize;
PublisherService.prototype.performPublication = performPublication;
PublisherService.prototype.processPublish = processPublish;

PublisherService.prototype.__emitPublicationLog = __emitPublicationLog;
PublisherService.prototype.__recipientAcknowledge = __recipientAcknowledge;

function stats (opts) {
  return JSON.parse(JSON.stringify(this.__stats));
}

function processAcknowledge (message) {

  var _this = this;

  return new Promise(function(resolve, reject){
    _this.__recipientAcknowledge(message, function (e, message) {
      if (e) return _this.errorService.handleSystem(new Error('processAcknowledge failed', e), 'PublisherService', constants.ERROR_SEVERITY.MEDIUM, function (e) {
        reject(e);
      });
      resolve(message);
    });
  });
}

function initialize (config, callback) {

  var _this = this;

  try {

    if (!config) config = {};

    if (config.timeout) config.timeout = false;

    _this.__stats = {
      attempted: 0,
      failed: 0,
      unacknowledged: 0
    };

    _this.errorService = _this.happn.services.error;

    _this.dataService = _this.happn.services.data;

    _this.securityService = _this.happn.services.security;

    if (!config.publicationOptions) config.publicationOptions = {};

    if (!config.publicationOptions.acknowledgeTimeout) config.publicationOptions.acknowledgeTimeout = 60000; //1 minute

    //we need to keep these, as they accept incoming ack requests
    _this.__unacknowledgedPublications = {};

    _this.config = config;

  } catch (e) {
    callback(e);
  }

  callback();
}

function performPublication (publication, callback) {

  var _this = this;

  publication.publish(_this.happn.services.queue, function (e) {

    if (publication.options.consistency == CONSISTENCY.DEFERRED)
      return _this.__emitPublicationLog(publication, e, callback);

    if (publication.options.consistency == CONSISTENCY.ACKNOWLEDGED) {
      delete _this.__unacknowledgedPublications[publication.id];
      return _this.__emitPublicationLog(publication, e, callback);
    }

    if (e) return callback(e); //happens after the DEFERRED, as the error is handled there as well
    callback(null, publication.message);
  });
}

function __emitPublicationLog (publication, e, callback) {

  // not logging 'happn.queue.outbound.time' for this use of outbound queue?
  return this.happn.services.queue.pushOutbound(publication.resultsMessage(e), callback);
}

function __recipientAcknowledge (message, callback) {

  var _this = this;

  if (!_this.__unacknowledgedPublications[message.request.data]) return callback(new Error('publication timed out'));
  _this.__unacknowledgedPublications[message.request.data].acknowledge(message.request.sessionId);
  callback(null, message);
}

function processPublish (message) {

  var _this = this;

  return new Promise(function(resolve, reject){

    var publication = Publication.create(message, _this.config.publicationOptions);

    message.publication = {
      id: publication.id
    };

    if (publication.options.consistency == CONSISTENCY.QUEUED || publication.options.consistency == CONSISTENCY.DEFERRED) {
      _this.happn.services.queue.pushPublication(publication);
      return resolve(message);
    }

    if (publication.options.consistency == CONSISTENCY.ACKNOWLEDGED) {
      _this.__unacknowledgedPublications[publication.id] = publication;
      _this.happn.services.queue.pushPublication(publication);
      return resolve(message);
    }

    //all other types of publications get processed up to whatever point consistency is set to - then response happens
    // _this.happn.services.queue.pushPublication(publication, callback);
    _this.happn.services.queue.pushPublication(publication, function (e, publication) {
      if (e) return reject(e);
      resolve(message);
    });
  });
}

module.exports = PublisherService;
