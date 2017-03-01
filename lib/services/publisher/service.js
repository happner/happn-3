var path = require('path')
  , util = require('util')
  , EventEmitter = require('events').EventEmitter
  , async = require('async')
  , Publication = require('./publication')
  , CONSISTENCY = require('../../../').constants.CONSISTENCY
  ;

function PublisherService(opts) {

  this.log = opts.logger.createLogger('Publisher');

  this.log.$$TRACE('construct(%j)', opts);
}

// Enable subscription to key lifecycle events
util.inherits(PublisherService, EventEmitter);

PublisherService.prototype.stats = function (opts) {
  return {}
};

PublisherService.prototype.processPublish = function (message, callback) {

  try {

    return this.publishMessage(message, function (e) {

      callback(e, message);
    });

  } catch (e) {
    callback(e);
  }
};

PublisherService.prototype.processInitialEmit = function (message, callback) {

  var _this = this;

  try {

    if (message.response.initialValues.length == 0) return callback(null, message);

    async.eachSeries(message.response.initialValues, function (itemData, itemDataCallback) {

      var requestParts = message.request.path.split('@');

      var action = requestParts[0].replace('/', '');

      var path = requestParts[1];

      itemData._meta = {};

      var initialMessage = {
        request: message.request,
        session: message.session,
        response: itemData,
        recipients: [{
          subscription: {
            sessionId: message.session.id,
            action: action,
            data: {session: message.session},
            fullPath: path
          }
        }],
        options: {
          consistency: CONSISTENCY.TRANSACTIONAL
        }
      };

      _this.publishMessage(initialMessage, itemDataCallback);

    }, function (e) {

      if (e) return callback(e);

      callback(null, message);

    });

  } catch (e) {
    callback(e);
  }
};

PublisherService.prototype.processAcknowledge = function (message, callback) {

  this.__recipientAcknowledge(message, callback);
};

PublisherService.prototype.initialize = function (config, callback) {

  var _this = this;

  try {

    if (!config) config = {};

    if (config.timeout) config.timeout = false;

    _this.dataService = _this.happn.services.data;

    _this.securityService = _this.happn.services.security;

    if (!config.publicationOptions) config.publicationOptions = {};

    if (!config.publicationOptions.acknowledgeTimeout) config.publicationOptions.acknowledgeTimeout = 60000;//1 minute

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

    if (e) return callback(e);//happens after the DEFERRED, as the error is handled there as well

    callback(null, publication.message);
  });
};

PublisherService.prototype.__emitPublicationLog = function (publication, e, callback) {

  var resultsMessage = publication.resultsMessage(e);

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

  try {

    var publication = new Publication(message, _this.config.publicationOptions);

    message.publication = {
      id: publication.id
    };

    if (publication.options.consistency == CONSISTENCY.QUEUED || publication.options.consistency == CONSISTENCY.DEFERRED) {

      _this.happn.services.queue.pushPublication(publication);

      return callback(null, message);
    }

    if (publication.options.consistency == CONSISTENCY.ACKNOWLEDGED) {

      _this.__unacknowledgedPublications[publication.id] = publication;

      _this.happn.services.queue.pushPublication(publication);

      return callback(null, message);
    }

    //all other types of publications get processed up to whatever point consistency is set to - then response happens
    _this.happn.services.queue.pushPublication(publication, callback);

  } catch (e) {
    callback(e);
  }
};

module.exports = PublisherService;
