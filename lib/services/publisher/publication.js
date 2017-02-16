var configurator = require('./config')
  , async = require('async')
  ;

function Publication(message, utils){

  this.consistency = this.CONSISTENCY.TRANSACTIONAL;//by default

  var action = message.request.action.toUpperCase();

  var channel = '/' + action + '@' + message.request.path;

  var payload = utils.clone(message.response);

  payload._meta.action = channel;

  payload._meta.type = 'data';

  payload.protocol = message.protocol;

  configurator.setProperty(this, 'id', message.session.id + '-' +  message.request.eventId);
  configurator.setProperty(this, 'origin', message.session.id);
  configurator.setProperty(this, 'payload', JSON.stringify(payload));
  configurator.setProperty(this, 'recipients', message.recipients);
  configurator.setProperty(this, 'options', message.request.options || {});

  this.result = {successful:0, failed:0, skipped:0};

  if (message.request.options){
    this.consistency = message.request.options.consistency?message.request.options.consistency:this.consistency;
  }

  if (this.consistency == this.CONSISTENCY.ACKNOWLEDGED) this.recipientPublish = this.__recipientPublishAcknowledged;

  if (this.consistency == this.CONSISTENCY.OPTIMISTIC) this.recipientPublish = this.__recipientPublishOptimistic;

  if (this.consistency == this.CONSISTENCY.QUEUED) this.recipientPublish = this.__recipientPublishQueued;

}

Publication.prototype.CONSISTENCY = configurator.CONSISTENCY;

//acknowledged publications
Publication.prototype.__recipientPublishAcknowledged = function(message, recipient, queue, callback){

};

//fire and forget
Publication.prototype.__recipientPublishOptimistic = function(message, recipient, queue, callback){

};

//queue and hope for the best
Publication.prototype.__recipientPublishQueued = function(message, recipient, queue, callback){

};

//default is transactional
Publication.prototype.recipientPublish = function(message, recipient, queue, callback){

};

Publication.prototype.publish = function(queue, callback){

  var _this = this;

  async.each(_this.recipients, function(recipient, recipientCB){

    var message = JSON.parse(_this.payload);

    if (_this.options.noCluster && recipient.info.clusterName) {

      _this.skipped++;

      return recipientCB();
    }

    _this.recipientPublish(message, recipient, queue, function(e){

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
