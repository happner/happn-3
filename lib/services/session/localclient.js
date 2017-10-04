var util = require('util'),
  EventEmitter = require('events').EventEmitter,
  Promise = require('bluebird'),
  constants = require('../../constants');

function LocalClient() {
  this._local = true;
  this.__events = new EventEmitter();
}

LocalClient.prototype.on = function (event, handler) {
  return this.__events.on(event, handler);
};

LocalClient.prototype.once = function (event, handler) {
  return this.__events.once(event, handler);
};

LocalClient.prototype.off = LocalClient.prototype.removeListener = function (event, handler) {
  return this.__events.removeListener(event, handler);
};

LocalClient.prototype.emit = function (event, data) {
  return this.__events.emit(event, data);
};

LocalClient.prototype.write = function (message) {

  setImmediate(function () {

    if (message.__outbound) {

      delete message.__outbound;

      return this.handle_publication(message); //outbound messages are cloned already

    } else message = this.context.services.utils.clone(message); //clone inbound stuff

    this.context.services.session.handleMessage(message, this);

  }.bind(this));
};

//needs to be here
LocalClient.prototype.removeAllListeners = function () {
  return this.__events.removeAllListeners();
};

LocalClient.prototype.__disconnect = function (event, data) {

  var _this = this;

  _this.context.services.session.clientDisconnect(_this, function (e) {

    if (e) _this.context.services.error.handleSystem(e, 'Localclient', constants.ERROR_SEVERITY.LOW);

    if (data) _this.write(data);

    _this.emit(event, data);

    _this.removeAllListeners();
  })
};

LocalClient.prototype.end = function (data) {
  return this.__disconnect('end', data);
};

LocalClient.prototype.destroy = function (data) {
  return this.__disconnect('destroy', data);
};

//events open, error, data, reconnected, reconnect timeout, reconnect scheduled

function LocalClientWrapper() {

  this.clientType = 'eventemitter';

  this.__getConnection = function (callback) {

    var client = new LocalClient();

    Object.defineProperty(client, 'context', {
      value: this.context
    });
    Object.defineProperty(client, 'handle_publication', {
      value: this.handle_publication.bind(this)
    });
    Object.defineProperty(client, 'handle_response', {
      value: this.handle_response.bind(this)
    });

    client.sessionProtocol = 'happn_' + require('../../../package.json').protocol;

    this.context.services.session.onConnect(client);

    this.__client = client;

    return callback(null, client);
  };

}

module.exports = new LocalClientWrapper();
