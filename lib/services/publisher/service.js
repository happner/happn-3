var path = require('path'),
  util = require('util'),
  EventEmitter = require('events').EventEmitter,
  async = require('async'),
  Publication = require('./publication'),
  CONSISTENCY = require('../../../').constants.CONSISTENCY,
  constants = require('../../constants');

function PublisherService(opts) {

  this.log = opts.logger.createLogger('Publisher');

  this.log.$$TRACE('construct(%j)', opts);
}

// Enable subscription to key lifecycle events
util.inherits(PublisherService, EventEmitter);

PublisherService.prototype.stats = function (opts) {
  return JSON.parse(JSON.stringify(this.__stats));
};

PublisherService.prototype.processPublish = function (message, callback) {

  var _this = this;

  try {

    return this.publishMessage(message, function (e) {

      if (e) return _this.errorService.handleSystem(new Error('processPublish failed', e), 'PublisherService', constants.ERROR_SEVERITY.MEDIUM, function (e) {
        callback(e, message);
      });

      callback(e, message);
    });

  } catch (e) {
    _this.errorService.handleSystem(new Error('processPublish failed', e), 'PublisherService', constants.ERROR_SEVERITY.MEDIUM, function (e) {
      callback(e, message);
    });
  }
};

PublisherService.prototype.processAcknowledge = function (message, callback) {

  var _this = this;

  _this.__recipientAcknowledge(message, function (e, message) {

    if (e) return _this.errorService.handleSystem(new Error('processAcknowledge failed', e), 'PublisherService', constants.ERROR_SEVERITY.MEDIUM, function (e) {
      callback(e, message);
    });

    callback(null, message);
  });
};

PublisherService.prototype.initialize = function (config, callback) {

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
};

PublisherService.prototype.performPublication = function (publication, callback) {

  var _this = this;

  publication.publish(_this.happn.services.queue, function (e) {

    if (publication.options.consistency == CONSISTENCY.DEFERRED)
      return _this.__emitPublicationLog(publication, e, callback);

    if (publication.options.consistency == CONSISTENCY.ACKNOWLEDGED) {

      delete _this.__unacknowledgedPublications[publication.id];

      return _this.__emitPublicationLog(publication, e, callback);
    }

    if (e) {

      return callback(e); //happens after the DEFERRED, as the error is handled there as well
    }

    callback(null, publication.message);
  });
};

PublisherService.prototype.__emitPublicationLog = function (publication, e, callback) {

  var resultsMessage = publication.resultsMessage(e);

  // not logging 'happn.queue.outbound.time' for this use of outbound queue?
  return this.happn.services.queue.pushOutbound(resultsMessage, callback);
};

PublisherService.prototype.__recipientAcknowledge = function (message, callback) {

  var _this = this;

  if (!_this.__unacknowledgedPublications[message.request.data]) return callback(new Error('publication timed out'));

  _this.__unacknowledgedPublications[message.request.data].acknowledge(message.request.sessionId);

  callback(null, message);
};

PublisherService.prototype.publishMessage = function (message, callback) {

  var _this = this;
  var services = this.happn.services;
  var debug = services.stats.DEBUG;
  var startTime;

  try {

    var publication = Publication.create(message, _this.config.publicationOptions);

    message.publication = {
      id: publication.id
    };

    if (publication.options.consistency == CONSISTENCY.QUEUED || publication.options.consistency == CONSISTENCY.DEFERRED) {

      // not logging 'happn.queue.outbound.time' for this use of publication queue?
      _this.happn.services.queue.pushPublication(publication);

      return callback(null, message);
    }

    if (publication.options.consistency == CONSISTENCY.ACKNOWLEDGED) {

      _this.__unacknowledgedPublications[publication.id] = publication;

      // not logging 'happn.queue.outbound.time' for this use of publication queue?
      _this.happn.services.queue.pushPublication(publication);

      return callback(null, message);
    }

    if (debug) {
      startTime = process.hrtime();
    }

    //all other types of publications get processed up to whatever point consistency is set to - then response happens
    // _this.happn.services.queue.pushPublication(publication, callback);
    _this.happn.services.queue.pushPublication(publication, function (e, publication) {

      if (e) {
        return callback(e, publication);
      }

      if (debug) {
        services.stats.gauge(
          'happn.queue.publication.time',
          services.utils.hrtimeDiffInMilliseconds(startTime)
        );
      }

      callback(e, publication);

    });

  } catch (e) {
    callback(e);
  }
};

module.exports = PublisherService;
