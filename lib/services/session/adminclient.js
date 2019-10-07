var LocalClient = require('./localclient').LocalClient;

class AdminClient extends LocalClient {
  constructor() {
    super();
  }
}

function AdminClientWrapper() {
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
    var client = new AdminClient();

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

  this.__doLogin = function(loginParameters, callback) {
    var _this = this;

    _this.context.services.security.adminLogin(_this.socket.sessionId, function(e, session) {
      if (e) return callback(e);

      if (!session.info) session.info = {};
      session.info.local = true;
      session.info.admin = true;
      _this.context.services.session.attachSession(_this.socket.sessionId, session);
      _this.__attachSession(session);

      callback();
    });
  };
}

module.exports.Wrapper = new AdminClientWrapper();
