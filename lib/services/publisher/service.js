var util = require('util'),
  EventEmitter = require('events').EventEmitter,
  CONSTANTS = require('../..').constants;

function PublisherService(opts, publication) {
  this.log = opts.logger.createLogger('Publisher');

  this.log.$$TRACE('construct(%j)', opts);

  this.publication = publication || require('./publication');
}

// Enable subscription to key lifecycle events
util.inherits(PublisherService, EventEmitter);

PublisherService.prototype.stats = stats;
PublisherService.prototype.processAcknowledge = processAcknowledge;
PublisherService.prototype.initialize = initialize;
PublisherService.prototype.processPublish = processPublish;

PublisherService.prototype.__recipientAcknowledge = __recipientAcknowledge;

function stats() {
  return JSON.parse(JSON.stringify(this.__stats));
}

function processAcknowledge(message, callback) {
  this.__recipientAcknowledge(message, (e, message) => {
    if (e)
      return this.errorService.handleSystem(
        new Error('processAcknowledge failed', e),
        'PublisherService',
        CONSTANTS.ERROR_SEVERITY.MEDIUM,
        e => {
          callback(e);
        }
      );
    callback(null, message);
  });
}

function initialize(config, callback) {
  try {
    if (!config) config = {};

    if (config.timeout) config.timeout = false;

    this.__stats = {
      attempted: 0,
      failed: 0,
      unacknowledged: 0
    };

    this.errorService = this.happn.services.error;

    this.dataService = this.happn.services.data;

    this.securityService = this.happn.services.security;

    if (!config.publicationOptions) config.publicationOptions = {};

    if (!config.publicationOptions.acknowledgeTimeout)
      config.publicationOptions.acknowledgeTimeout = 60000; //1 minute

    //we need to keep these, as they accept incoming ack requests
    this.__unacknowledgedPublications = {};
    this.config = config;

    callback();
  } catch (e) {
    callback(e);
  }
}

function processPublish(message, callback) {
  var publication = this.publication.create(message, this.config.publicationOptions, this.happn);

  message.publication = {
    id: publication.id
  };

  if (publication.options.consistency === CONSTANTS.CONSISTENCY.ACKNOWLEDGED)
    this.__unacknowledgedPublications[publication.id] = publication;

  if (publication.options.consistency !== CONSTANTS.CONSISTENCY.TRANSACTIONAL) callback(null, message); //callback early, continue on to publish

  publication.publish(e => {
    if (publication.options.consistency === CONSTANTS.CONSISTENCY.TRANSACTIONAL) {
      //callback with publication results, return
      if (e) return callback(e);
      return callback(null, message);
    }

    if (publication.options.consistency === CONSTANTS.CONSISTENCY.ACKNOWLEDGED)
      delete this.__unacknowledgedPublications[publication.id];

    //push publication results to publishing client
    return this.happn.services.protocol.processMessageOut(publication.resultsMessage(e), e => {
      if (e)
        this.errorService.handleSystem(
          new Error('acknowledged or deferred publish results feedback failed', e),
          'PublisherService',
          CONSTANTS.ERROR_SEVERITY.MEDIUM
        );
    });
  });
}

function __recipientAcknowledge(message, callback) {
  if (this.__unacknowledgedPublications[message.request.data])
    this.__unacknowledgedPublications[message.request.data].acknowledge(message.request.sessionId);
  callback(null, message);
}

module.exports = PublisherService;
