var async = require('async'),
  Utils = require('../utils/service'),
  utils = new Utils(),
  CONSISTENCY = require('../../../').constants.CONSISTENCY;

function Publication(message, options) {

  this.message = message;
  this.options = message.request.options || {};

  this.result = {
    successful: 0,
    failed: 0,
    skipped: 0,
    queued: message.recipients.length
  };

  if (!options) options = {};

  if (!options.acknowledgeTimeout) options.acknowledgeTimeout = 60000;

  this.publication_options = options;

  if (this.options.consistency == null) this.options.consistency = CONSISTENCY.TRANSACTIONAL; //by default

  if (this.options.consistency == CONSISTENCY.ACKNOWLEDGED) {

    this.unacknowledged_recipients = [];
    this.options.publishResults = true;
    this.result.acknowledged = 0;
  }

  this.id = message.session.id + '-' + message.request.eventId;
  this.origin = message.session;
  this.recipients = message.recipients;

  this.duplicate_channels = {};

  this.__configurePayload(message, message.response.data, message.response._meta, 'payload');
  this.__configurePayload(message, message.request.data, message.response._meta, 'mergePayload');
}

Publication.create = function(message, options){
  return new Publication(message, options);
};

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

Publication.prototype.__configurePayload = function(message, data, meta, payloadType){

  var payload = {
    data:data,
    _meta:{
      action: '/' + message.request.action.toUpperCase() + '@' + message.request.path,
      type:'data',
      sessionId:message.session.id,
      consistency:this.options.consistency,
      publicationId:this.id,
      path:message.request.path,
      created:meta.created,
      modified:meta.modified
    },
    protocol:message.protocol,
    __outbound:true
  };

  if (message.request.options && typeof message.request.options.meta == 'object') {

    var _this = this;

    Object.keys(message.request.options.meta).forEach(function (key) {
      if (_this.__reservedMetaKeys.indexOf(key) >= 0) return;
      payload._meta[key] = message.request.options.meta[key];
    });
  }

  this[payloadType]  = JSON.stringify(payload);
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
    _this.unacknowledged_recipients.push(recipient.data.session.id);
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

Publication.prototype.publish = function (queue, callback) {

  var _this = this;

  async.each(_this.recipients, function (recipient, recipientCB) {

    if (_this.options.noCluster && recipient.data.session.info.clusterName) {

      _this.skipped++;
      return recipientCB();
    }

    var message = (recipient.data.options && recipient.data.options.merge == true)?JSON.parse(_this.mergePayload):JSON.parse(_this.payload);

    message._meta.channel = '/' + recipient.data.action + '@' + recipient.data.path;

    if (recipient.data.options.depth > 0) message._meta.depth = recipient.data.options.depth;

    //deduplcate messages with same client and channel (2 identical listeners)
    if (_this.duplicate_channels[recipient.data.session.id + message._meta.channel]) return recipientCB();

    _this.duplicate_channels[recipient.data.session.id + message._meta.channel] = true;

    queue.pushOutbound({
      request: {
        publication: message,
        options: recipient.data.options,
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
    request: {
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
    message.request.publication.error = e.toString().replace('Error: ', '');
    message.request.publication.status = 'error';
  }

  return message;
};

module.exports = Publication;
