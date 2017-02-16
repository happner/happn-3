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
  configurator.setProperty(this, 'payload', payload);
  configurator.setProperty(this, 'recipients', message.recipients);

  if (message.request.options){
    this.consistency = message.request.options.consistency?message.request.options.consistency:this.consistency;
  }

  if (this.consistency == this.CONSISTENCY.ACKNOWLEDGED) this.recipientPublish = this.__recipientPublishAcknowledged;

  if (this.consistency == this.CONSISTENCY.OPTIMISTIC) this.recipientPublish = this.__recipientPublishOptimistic;

  if (this.consistency == this.CONSISTENCY.QUEUED) this.recipientPublish = this.__recipientPublishQueued;

}

Publication.prototype.CONSISTENCY = configurator.CONSISTENCY;

//default is transactional
Publication.prototype.recipientPublish = function(recipient, queue, callback){

};

Publication.prototype.publish = function(queue, callback){

  var _this = this;

  async.each(_this.recipients, function(recipient, recipientCB){

      _this.recipientPublish(recipient, queue, function(e){
        if (e) {
          _this.failed++;
          _this.lastError = e;
        } else {
          _this.successful++;

        }
      });
  }, function(e){

    if (e) return callback(e);

  });
};

module.exports = Publication;
