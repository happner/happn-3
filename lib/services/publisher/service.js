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

PublisherService.prototype.__recipientAcknowledge = __recipientAcknowledge;

function stats (opts) {
  return JSON.parse(JSON.stringify(this.__stats));
}

function processAcknowledge (message, callback) {

  this.__recipientAcknowledge(message,  (e, message) => {
    if (e) return this.errorService.handleSystem(new Error('processAcknowledge failed', e), 'PublisherService', constants.ERROR_SEVERITY.MEDIUM,  (e) => {
      callback(e);
    });
    callback(null, message);
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

  publication.publish((e) => {

    if (publication.options.consistency == CONSISTENCY.DEFERRED)
      return this.happn.services.protocol.processMessageOut(publication.resultsMessage(e), callback);

    if (publication.options.consistency == CONSISTENCY.ACKNOWLEDGED) {
      delete this.__unacknowledgedPublications[publication.id];
      return this.happn.services.protocol.processMessageOut(publication.resultsMessage(e), callback);
    }

    if (e) return callback(e); //happens after the DEFERRED, as the error is handled there as well
    callback(null, publication.message);
  });
}

function __recipientAcknowledge (message, callback) {

  var _this = this;

  //if (!_this.__unacknowledgedPublications[message.request.data]) return callback(new Error('publication timed out'));
  if (_this.__unacknowledgedPublications[message.request.data]) _this.__unacknowledgedPublications[message.request.data].acknowledge(message.request.sessionId);
  callback(null, message);
}

function processPublish (message, callback) {

  var publication = Publication.create(message, this.config.publicationOptions, this.happn);

  message.publication = {
    id: publication.id
  };

  if (publication.options.consistency == CONSISTENCY.TRANSACTIONAL)
    return this.performPublication(publication, (e, publication) => {
      if (e) return callback(e);
      callback(null, message);
    });

  if (publication.options.consistency == CONSISTENCY.ACKNOWLEDGED)
    this.__unacknowledgedPublications[publication.id] = publication;

  this.performPublication(publication, (e, publication) => {
    if (e) this.errorService.handleSystem(new Error('queued or deferred publish failed', e), 'PublisherService', constants.ERROR_SEVERITY.MEDIUM);
  });

  return callback(null, message);
}

module.exports = PublisherService;
