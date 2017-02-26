var configurator = require('./config')
  , async = require('async')
  , Utils = require('../utils/service')
  , utils = new Utils()
  ;

function Publication(message, options){

  configurator.setProperty(this, 'message', message);

  configurator.setProperty(this, 'options', message.request.options || {});

  configurator.setProperty(this, 'publication_options', options || {});

  if (this.options.consistency == null) this.options.consistency = this.CONSISTENCY.TRANSACTIONAL;//by default

  if (this.options.consistency == this.CONSISTENCY.ACKNOWLEDGED){
    configurator.setProperty(this, 'unacknowledged', []);
    configurator.setProperty(this, 'unacknowledged_timeout', this.publication_options.acknowledgeTimeout);//TODO need to make this configurable
    this.recipientPublish = this.__recipientPublishAcknowledged;
  }

  configurator.setProperty(this, 'id', message.session.id + '-' +  message.request.eventId);
  configurator.setProperty(this, 'origin', message.session);
  configurator.setProperty(this, 'recipients', message.recipients);

  this.configurePayload(message);

  this.result = {successful:0, failed:0, skipped:0, queued:message.recipients.length};
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

Publication.prototype.configurePayload = function(message){

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

  console.log('set payload:::', payload);

  configurator.setProperty(this, 'payload', JSON.stringify(payload));
};

Publication.prototype.__error = function(message, data){
  return new Error(message);
};

Publication.prototype.CONSISTENCY = configurator.CONSISTENCY;

Publication.prototype.acknowledge = function(publication, callback){

  var _this = this;

  _this.unacknowledged.every(function(unacknowledgedItem, unacknowledgedItemIndex){

    if (unacknowledgedItem.publication.session.id == publication.session.id){

      clearTimeout(unacknowledgedItem.timeout);

      unacknowledgedItem.handler(null, publication);//call the handler

      _this.unacknowledged.splice(unacknowledgedItemIndex, 1);//remove it

      return false;
    }
    return true;
  });

  callback();
};

Publication.prototype.__waitForAck = function(publication, handler){

  var _this = this;

  var unacknowledgedItem = {
    publication:publication,
    handler:handler
  };

  var timeout = function(){
    handler(_this.__error('timed out'));
  }.bind(unacknowledgedItem);

  unacknowledgedItem.timeout = setTimeout(timeout, _this.options.unacknowledged_timeout);

  this.unacknowledged.push(unacknowledgedItem);
};

//acknowledged publications
Publication.prototype.__recipientPublishAcknowledged = function(publication, queue, callback){

  var _this = this;

  queue.pushOutbound(
    publication,
    function(e){
      if (e) return callback(e);
      _this.__waitForAck(publication, callback);
    });
};

//default is transactional - also works for queued
Publication.prototype.recipientPublish = function(publication, queue, callback){

  queue.pushOutbound(
    publication,
    callback);
};

Publication.prototype.publish = function(queue, callback){

  var _this = this;

  async.each(_this.recipients, function(recipient, recipientCB){

    if (_this.options.noCluster && recipient.subscription.data.session.info['clusterName']) {

      _this.skipped++;

      return recipientCB();
    }

    var message = JSON.parse(_this.payload);

    message._meta.channel = '/' + recipient.subscription.action + '@' + recipient.subscription.fullPath;

    console.log('publishing:::', message);

    _this.recipientPublish({
        raw:{
          publication:message,
          action:'emit'
        },
        session: recipient.subscription.data.session
      }, queue, function(e){

        if (e) {
          _this.result.failed++;
          _this.result.lastError = e;
        } else {
          _this.result.successful++;
        }

        recipientCB();
    });

  }, function(e){

    if (e) {
      _this.message.response._meta.publishResults = _this.result;
      return callback(e);
    }

    _this.message.response._meta.published = true;

    if (_this.options.publishResults) _this.message.response._meta.publishResults = _this.result;

    callback(null, _this.result);
  });
};

Publication.prototype.resultsMessage = function(e){

  var message = {
    raw:{
      publication:{
        id:this.id,
        action:'publication-ack',
        result:this.result,
        status:'ok',
        _meta:{
          type:'ack',
          eventId:this.message.request.eventId
        }
      }
    },
    session: this.origin
  };

  if (e) {
    message.raw.publication.error = e;
    message.raw.publication.status = 'error';
  }

  return message;
};

module.exports = Publication;