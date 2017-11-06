var configurator = require('./config'),
  async = require('async'),
  Utils = require('../utils/service'),
  utils = new Utils(),
  CONSISTENCY = require('../../../').constants.CONSISTENCY;

function Publication(message, options) {

  configurator.setProperty(this, 'message', message);

  configurator.setProperty(this, 'options', message.request.options || {});

  this.result = {
    successful: 0,
    failed: 0,
    skipped: 0,
    queued: message.recipients.length
  };

  if (!options) options = {};

  if (!options.acknowledgeTimeout) options.acknowledgeTimeout = 60000;

  configurator.setProperty(this, 'publication_options', options || {});

  if (this.options.consistency == null) this.options.consistency = CONSISTENCY.TRANSACTIONAL; //by default

  if (this.options.consistency == CONSISTENCY.ACKNOWLEDGED) {

    configurator.setProperty(this, 'unacknowledged_recipients', []);
    this.options.publishResults = true;
    this.result.acknowledged = 0;
  }

  configurator.setProperty(this, 'id', message.session.id + '-' + message.request.eventId);
  configurator.setProperty(this, 'origin', message.session);
  configurator.setProperty(this, 'recipients', message.recipients);

  this.configurePayload(message);
}

Publication.prototype.__reservedMetaKeys = [
  'created',
  'modified',
  'path',
  'action',
  'type',
  'published',
  'status',
  'eventId',
  'sessionId'
];

Publication.prototype.configurePayload = function (message) {

  var action = message.request.action.toUpperCase();

  var channel = '/' + action + '@' + message.request.path;

  var payload = utils.clone(message.response);

  payload._meta.channel = channel;

  payload._meta.action = channel;

  payload._meta.type = 'data';

  delete payload._meta.status;
  delete payload._meta.published;
  delete payload._meta.eventId;
  delete payload._meta._id;

  payload._meta.sessionId = message.session.id;

  payload.protocol = message.protocol;

  payload._meta.consistency = this.options.consistency;

  payload._meta.publicationId = this.id;

  payload.__outbound = true;

  if (message.request.options && typeof message.request.options.meta == 'object') {

    var _this = this;

    Object.keys(message.request.options.meta).forEach(function (key) {
      if (_this.__reservedMetaKeys.indexOf(key) >= 0) return;
      payload._meta[key] = message.request.options.meta[key];
    });
  }

  configurator.setProperty(this, 'payload', JSON.stringify(payload));
};

Publication.prototype.__error = function (message, data) {
  return new Error(message);
};

Publication.prototype.acknowledge = function (sessionId) {

  var _this = this;

  _this.unacknowledged_recipients.every(function (recipientSessionId, recipientSessionIdIndex) {

    if (recipientSessionId == sessionId) {

      _this.unacknowledged_recipients.splice(recipientSessionIdIndex, 1); //remove it

      _this.result.acknowledged++;

      return false;
    }

    return true;
  });

  if (_this.unacknowledged_recipients.length == 0) {

    _this.__acknowledgeStatus = 1;

    if (_this.__onAcknowledgeComplete) _this.__onAcknowledgeComplete();
  }
};

Publication.prototype.__waitForAck = function (callback) {

  var _this = this;

  _this.recipients.forEach(function (recipient) {

    _this.unacknowledged_recipients.push(recipient.subscription.data.session.id);
  });

  _this.__onAcknowledgeComplete = function (e) {

    clearTimeout(_this.__unacknowledgedTimedout);

    if (e) {
      _this.message.response._meta.published = false;
      _this.message.response._meta.publishError = e.toString();

    } else _this.message.response._meta.published = true;

    _this.message.response._meta.publishResults = _this.result;

    callback(e, _this.result);
  };

  _this.__unacknowledgedTimedout = setTimeout(function () {

    _this.__onAcknowledgeComplete(new Error('unacknowledged publication'));

  }, _this.publication_options.acknowledgeTimeout);

  _this.__checkAcknowledgeStatus(); //race condition, as we may have acknowledgements already
};

Publication.prototype.__checkAcknowledgeStatus = function () {

  if (this.__acknowledgeStatus == 1) this.__onAcknowledgeComplete();
};

//default is transactional - also works for queued
Publication.prototype.recipientPublish = function (publication, queue, callback) {

  queue.pushOutbound(
    publication,
    callback);
};

Publication.prototype.publish = function (queue, callback) {

  var _this = this;

  async.each(_this.recipients, function (recipient, recipientCB) {

    if (_this.options.noCluster && recipient.data.session.info['clusterName']) {

      _this.skipped++;

      return recipientCB();
    }

    var message = JSON.parse(_this.payload);

    message._meta.channel = '/' + recipient.data.action + '@' + recipient.data.path;

    queue.pushOutbound({
      raw: {
        publication: message,
        action: 'emit'
      },
      session: recipient.data.session
    }, function (e) {

      if (e) {

        _this.result.failed++;
        _this.result.lastError = e;

      } else _this.result.successful++;

      recipientCB();
    });

  }, function (e) {

    if (e || _this.result.failed > 0) {
      _this.message.response._meta.publishResults = _this.result;
      return callback(e || _this.result.lastError);
    }

    if (_this.options.consistency == CONSISTENCY.ACKNOWLEDGED) return _this.__waitForAck(callback);

    _this.message.response._meta.published = true;

    if (_this.options.publishResults) _this.message.response._meta.publishResults = _this.result;

    callback(null, _this.result);
  });
};

Publication.prototype.resultsMessage = function (e) {

  var message = {
    raw: {
      publication: {
        id: this.id,
        action: 'publication-ack',
        result: this.result,
        status: 'ok',
        _meta: {
          type: 'ack',
          eventId: this.message.request.eventId
        }
      }
    },
    session: this.origin
  };

  if (e) {
    //need to take out Error:  - or we get a double up
    message.raw.publication.error = e.toString().replace('Error: ', '');
    message.raw.publication.status = 'error';
  }

  return message;
};

module.exports = Publication;
