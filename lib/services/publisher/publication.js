var configurator = require('./config')
  , async = require('async')
  ;

function Publication(message){

  this.consistency = this.CONSISTENCY.TRANSACTIONAL;//by default

  var action = message.request.action.toUpperCase();

  var channel = '/' + action + '@' + message.request.path;

  var payload = this.__clone(message.response);

  payload._meta.action = channel;

  payload._meta.type = 'data';

  payload.protocol = message.protocol;

  payload.consistency = this.consistency;

  configurator.setProperty(this, 'id', message.session.id + '-' +  message.request.eventId);
  configurator.setProperty(this, 'origin', message.session.id);
  configurator.setProperty(this, 'payload', JSON.stringify(payload));
  configurator.setProperty(this, 'recipients', message.recipients);
  configurator.setProperty(this, 'options', message.request.options || {});

  if (this.consistency == this.CONSISTENCY.ACKNOWLEDGED){
    configurator.setProperty(this, 'unacknowledged', []);
    configurator.setProperty(this, 'unacknowledged_timeout', 30000);//need to make this configurable
  }

  this.result = {successful:0, failed:0, skipped:0};

  if (message.request.options){
    this.consistency = message.request.options.consistency?message.request.options.consistency:this.consistency;
  }

  if (this.consistency == this.CONSISTENCY.ACKNOWLEDGED) this.recipientPublish = this.__recipientPublishAcknowledged;

}

Publication.prototype.__error = function(message, data){
  return new Error(message);
};

Publication.prototype.__clone = function(obj){
  if (obj == null) return obj;
  return JSON.parse(JSON.stringify(obj));
};

Publication.prototype.CONSISTENCY = configurator.CONSISTENCY;

Publication.prototype.__receiveAck = function(publication, callback){

};

Publication.prototype.__waitForAck = function(publication, handler){

  var _this = this;

  var unacknowledgedItem = {
    publication:publication,
    handler:handler
  };

  var timeout = function(){

    handler(_this.__error('timed out'))
  }.bind(unacknowledgedItem);

  unacknowledgedItem.timeout = setTimeout(timeout, _this.options.unacknowledged_timeout)

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

    if (_this.options.noCluster && recipient.info.clusterName) {

      _this.skipped++;

      return recipientCB();
    }

    var message = JSON.parse(_this.payload);

    _this.recipientPublish({
        raw:{
          publication:message,
          channel:message._meta.action,
          opts:opts,
          action:'emit'
        },
        session: recipient
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

    if (e) return callback(e);

  });
};

module.exports = Publication;
