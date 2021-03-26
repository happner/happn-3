var async = require('async'),
  CONSTANTS = require('../../../').constants;
const { nodes } = require('traverse');

function Publication(message, options, happn) {
  this.happn = happn;
  this.message = message;
  this.options = message.request.options || {};

  this.result = {
    successful: 0,
    failed: 0,
    skipped: 0
  };

  if (!options) options = {};

  if (!options.acknowledgeTimeout) options.acknowledgeTimeout = 60000;

  this.publication_options = options;

  if (this.options.consistency == null)
    this.options.consistency = CONSTANTS.CONSISTENCY.TRANSACTIONAL; //by default

  if (this.options.consistency === CONSTANTS.CONSISTENCY.ACKNOWLEDGED) {
    this.unacknowledged_recipients = [];
    this.options.publishResults = true;
    this.result.acknowledged = 0;
  }

  this.id = message.session.id + '-' + message.request.eventId;
  this.origin = message.session;

  if (message.recipients) this.recipients = message.recipients;
  //we are targeting specific recipients for this message
  else {
    this.recipients = this.happn.services.subscription.getRecipients(message);
  }

  this.result.queued = this.recipients.length;

  this.duplicate_channels = {};

  this.__configurePayload(message, message.response.data, 'payload');
}

Publication.create = function(message, options, happn) {
  return new Publication(message, options, happn);
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

Publication.prototype.__configurePayload = function(message, data, payloadType) {
  var payload = {
    data: data,
    _meta: {
      action: '/' + message.request.action.toUpperCase() + '@' + message.request.path,
      type: 'data',
      sessionId: message.session.id,
      consistency: this.options.consistency,
      publicationId: this.id,
      path: message.request.path,
      created: message.response._meta.created,
      modified: message.response._meta.modified
    },
    protocol: message.protocol,
    __outbound: true
  };

  if (this.origin && this.origin.user)
    payload._meta.eventOrigin = { username: this.origin.user.username, id: this.origin.id };

  if (message.request.options && typeof message.request.options.meta === 'object') {
    var _this = this;

    Object.keys(message.request.options.meta).forEach(function(key) {
      if (_this.__reservedMetaKeys.indexOf(key) >= 0) return;
      payload._meta[key] = message.request.options.meta[key];
    });
  }

  this[payloadType] = payload;
};

Publication.prototype.acknowledge = function(sessionId) {
  this.unacknowledged_recipients.every((recipientSessionId, recipientSessionIdIndex) => {
    if (recipientSessionId === sessionId) {
      this.unacknowledged_recipients.splice(recipientSessionIdIndex, 1); //remove it
      this.result.acknowledged++;
      return false;
    }

    return true;
  });

  if (this.unacknowledged_recipients.length === 0) {
    this.__acknowledgeStatus = 1;
    if (this.__onAcknowledgeComplete) this.__onAcknowledgeComplete();
  }
};

Publication.prototype.__waitForAck = function(callback) {
  this.recipients.forEach(recipient => {
    this.unacknowledged_recipients.push(recipient.data.session.id);
  });

  this.__onAcknowledgeComplete = function(e) {
    clearTimeout(this.__unacknowledgedTimedout);

    if (e) {
      this.message.response._meta.published = false;
      this.message.response._meta.publishError = e.toString();
    } else this.message.response._meta.published = true;

    this.message.response._meta.publishResults = this.result;
    callback(e, this.result);
  };

  this.__unacknowledgedTimedout = setTimeout(() => {
    this.__onAcknowledgeComplete(new Error('unacknowledged publication'));
  }, this.publication_options.acknowledgeTimeout);

  this.__checkAcknowledgeStatus(); //race condition, as we may have acknowledgements already
};

Publication.prototype.__checkAcknowledgeStatus = function() {
  if (this.__acknowledgeStatus === 1) this.__onAcknowledgeComplete();
};

Publication.prototype.getRecipientMessage = function(recipient) {
  console.log(JSON.stringify(recipient, null, 2))
  var recipientMessage,
    channel = '/' + recipient.data.action + '@' + recipient.data.path;

  if (this.duplicate_channels[recipient.data.session.id + channel]) return null;

  if (recipient.data.options && recipient.data.options.merge) {
    //lazy load mergePayload
    if (!this.mergePayload)
      this.__configurePayload(this.message, this.message.request.data, 'mergePayload');
    recipientMessage = this.mergePayload;
  } else recipientMessage = this.payload;

  recipientMessage._meta = Object.assign({}, recipientMessage._meta);

  recipientMessage._meta.channel = channel;
  if (recipient.data.options && recipient.data.options.depth > 0)
    recipientMessage._meta.depth = recipient.data.options.depth;

  this.duplicate_channels[recipient.data.session.id + channel] = true;

  return {
    request: {
      publication: recipientMessage,
      options: recipient.data.options,
      action: 'emit'
    },
    session: recipient.data.session
  };
};

Publication.prototype.publish = function(callback) {  
  setImmediate(() => {
    async.eachLimit(
      this.recipients,
      100,
      (recipient, recipientCB) => {
        if (this.options.noCluster && recipient.data.session.info.clusterName) {
          this.skipped++;
          return recipientCB();
        }

        var recipientMessage = this.getRecipientMessage(recipient);

        if (!recipientMessage) {
          this.skipped++;
          return recipientCB();
        }

        this.happn.services.protocol.processMessageOut(recipientMessage, e => {
          if (e) {
            this.result.failed++;
            this.result.lastError = e;
          } else this.result.successful++;

          recipientCB();
        });
      },
      e => {
        if (e || this.result.failed > 0) {
          this.message.response._meta.publishResults = this.result;
          return callback(e || this.result.lastError);
        }

        if (this.options.consistency === CONSTANTS.CONSISTENCY.ACKNOWLEDGED)
          return this.__waitForAck(callback);
        this.message.response._meta.published = true;
        if (this.options.publishResults) this.message.response._meta.publishResults = this.result;

        callback(null, this.result);
      }
    );
  });
};

Publication.prototype.resultsMessage = function(e) {
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
