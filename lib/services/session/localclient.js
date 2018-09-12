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

  var _this = this;

  setImmediate(function () {

    if (message.__outbound) {//dont check cloned message as it will be stripped of __outbound if it is an array
      delete message.__outbound;
      return _this.handle_publication(message); //outbound messages are cloned already
    }
    _this.context.services.session.handleMessage(_this.context.services.utils.clone(message), _this);
  });
};

//needs to be here
LocalClient.prototype.removeAllListeners = function () {
  return this.__events.removeAllListeners();
};

LocalClient.prototype.disconnect = function (event, data) {

  var _this = this;

  _this.context.services.session.clientDisconnect(_this, function (e) {

    if (e) _this.context.services.error.handleSystem(e, 'Localclient', constants.ERROR_SEVERITY.LOW);

    if (data) _this.write(data);

    if (event) _this.emit(event, data);

    _this.removeAllListeners();
  });
};

LocalClient.prototype.end = function (data) {
  return this.disconnect('end', data);
};

LocalClient.prototype.destroy = function (data) {
  return this.disconnect('destroy', data);
};

function LocalClientWrapper() {

  this.clientType = 'eventemitter';

  this.__encryptLogin = function (parameters) {
    return parameters;
  };

  this.__decryptLogin = function (parameters) {
    return parameters;
  };

  this.__encryptPayload = function (message) {
    return message;
  };

  this.__decryptPayload = function (message) {
    return message;
  };

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

    return callback(null, client);
  };
}

module.exports = new LocalClientWrapper();
