var EventEmitter = require('events').EventEmitter,
  constants = require('../../constants');

class LocalClient {
  constructor() {
    this._local = true;
    this.__events = new EventEmitter();
  }

  static create() {
    return new LocalClient();
  }

  on(event, handler) {
    return this.__events.on(event, handler);
  }

  once(event, handler) {
    return this.__events.once(event, handler);
  }

  off(event, handler) {
    return this.__events.removeListener(event, handler);
  }

  removeListener(event, handler) {
    return this.off(event, handler);
  }

  emit(event, data) {
    return this.__events.emit(event, data);
  }

  write(message) {
    if (!message.__outbound)
      return this.context.services.session.handleMessage(Object.assign({}, message), this);

    delete message.__outbound;
    this.handle_publication(message); //outbound messages are cloned at the client
  }

  removeAllListeners() {
    return this.__events.removeAllListeners();
  }

  disconnect(event, data) {
    var _this = this;

    _this.context.services.session.finalizeDisconnect(_this, function(e) {
      if (e)
        _this.context.services.error.handleSystem(e, 'Localclient', constants.ERROR_SEVERITY.LOW);
      if (data) _this.write(data);
      if (event) _this.emit(event, data);
      _this.removeAllListeners();
    });
  }

  end(data) {
    return this.disconnect('end', data);
  }

  destroy(data) {
    return this.disconnect('destroy', data);
  }
}

function LocalClientWrapper() {
  this.clientType = 'eventemitter';

  this.__encryptLogin = function(parameters) {
    return parameters;
  };

  this.__decryptLogin = function(parameters) {
    return parameters;
  };

  this.__encryptPayload = function(message) {
    return message;
  };

  this.__decryptPayload = function(message) {
    return message;
  };

  this.__getConnection = function(callback) {
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

module.exports.Wrapper = new LocalClientWrapper();
module.exports.LocalClient = LocalClient;
