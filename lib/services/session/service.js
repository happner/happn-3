var Primus = require('primus')
  , util = require('util')
  , EventEmitter = require('events').EventEmitter
  , uuid = require('uuid')
  , path = require('path')
  , Promise = require('bluebird')
  , async = require('async')
  ;

module.exports = SessionService;

function SessionService(opts) {

  this.log = opts.logger.createLogger('Session');
  this.log.$$TRACE('construct(%j)', opts);

  this.__sessions = {};
}

// Enable subscription to key lifecycle events
util.inherits(SessionService, EventEmitter);

SessionService.prototype.stats = function () {
  return {
    sessions: Object.keys(this.__sessions).length
  }
};

SessionService.prototype.__safeSessionData = function(sessionData){

  var safeSessionData = {

    "id": sessionData.id,
    "info": sessionData.info,
    "type": sessionData.type,
    "timestamp": sessionData.timestamp,
    "isEncrypted": sessionData.isEncrypted?true:false,
    "policy" : sessionData.policy,
    "token":sessionData.token,
    "encryptedSecret":sessionData.encryptedSecret

  };

  if (sessionData.user) safeSessionData.user = {username:sessionData.user.username, publicKey:sessionData.user.publicKey};

  return safeSessionData;
};

SessionService.prototype.initializeCaches = function(callback){

  if (!this.config.activeSessionsCache) this.config.activeSessionsCache = {type:'static'};

  this.__activeSessions = this.happn.services.cache.new('service_session_active_sessions', this.config.activeSessionsCache);

  callback();

};

SessionService.prototype.attachSession = function(sessionId, session){

  var _this = this;

  var sessionData = _this.__updateSession(sessionId, session);

  if (sessionData == null) return;

  _this.emit('authentic', _this.__safeSessionData(sessionData));

  _this.__activeSessions.set(sessionId, sessionData);

  return sessionData;

};

SessionService.prototype.__updateSession = function(sessionId, updated){

  var _this = this;

  if (!_this.__sessions[sessionId]) return null;

  for (var propertyName in updated) _this.__sessions[sessionId].data[propertyName] = updated[propertyName];

  return _this.__sessions[sessionId].data;

};

SessionService.prototype.getClient = function(sessionId){

  return this.__sessions[sessionId]?this.__sessions[sessionId].client:null;
};

SessionService.prototype.getSession = function(sessionId){

  return this.__sessions[sessionId]?this.__sessions[sessionId].data:null;
};

SessionService.prototype.disconnectSession = function(sessionId, options){

  //TODO: session id's not matching - session from session servuce must be the same across the board
  var client = this.__sessions[sessionId].client;
  this.disconnect(client, options);
};

SessionService.prototype.each = function(eachHandler, callback){
  //the caller can iterate through the sessions
  var _this = this;

  var sessionKeys = Object.keys(_this.__sessions);

  if (sessionKeys.length == 0) return callback();

  async.each(sessionKeys, function(sessionKey, sessionKeyCallback){

    eachHandler.call(eachHandler, _this.__sessions[sessionKey].data, sessionKeyCallback);

  }, callback);
};

SessionService.prototype.stop = function (options, callback) {
  try {

    var _this = this;

    if (typeof options == 'function') {
      callback = options;
      options = null;
    }

    if (!options) options = {};

    if (this.primus) {

      if (!options.timeout) options.timeout = 10000;

      var shutdownTimeout = setTimeout(function () {
        _this.log.error('primus destroy timed out after ' + options.timeout + ' milliseconds');
        _this.__shutdownTimeout = true;//instance level flag to ensure callback is not called multiple times
        callback();
      }, options.timeout);

      _this.disconnectAllClients(options, function(e){

        if (e) _this.log.error('failed disconnecting clients gracefully', e);

        _this.primus.destroy({
          // // have primus close the http server and clean up
          close: true,
          // have primus inform clients to attempt reconnect
          reconnect: typeof options.reconnect === 'boolean' ? options.reconnect : true
        }, function (e) {
          //we ensure that primus didn't time out earlier
          if (!_this.__shutdownTimeout) {
            clearTimeout(shutdownTimeout);
            callback(e);
          }
        });
      });
    }
    else callback();

  } catch (e) {
    callback(e);
  }
};

SessionService.prototype.disconnectAllClients = function(options, callback){

  var _this = this;

  if (typeof options == 'function'){
    callback = options;
    options = {};
  }

  if (options == null) options = {};
  if (options.reconnect == null) options.reconnect = true; //if disconnect is not defined we are doing a connected restart

  _this.each(function(sessionData, sessionDataCallback){

    var client = _this.getClient(sessionData.id);

    if (client) _this.disconnect(client, {"reason":"server-side-disconnect", "reconnect":options.reconnect}, sessionDataCallback);

    else sessionDataCallback();

  }, callback);

};

SessionService.prototype.initialize = function (config, callback) {

  var _this = this;

  try {

    if (!config) config = {};

    if (!config.timeout) config.timeout = false;

    if (!config.disconnectTimeout) config.disconnectTimeout = 1000;

    _this.__activeSessions = _this.happn.services.cache.new('service-session-active-sessions', config.activeSessionsCache);

    _this.config = config;

    _this.__shutdownTimeout = false;//used to flag an incomplete shutdown

    _this.__currentMessageId = 0;

    _this.primus = new Primus(_this.happn.server, config.primusOpts);
    _this.primus.on('connection', _this.onConnect.bind(_this));
    _this.primus.on('disconnection', _this.onDisconnect.bind(_this));

    var clientPath = path.resolve(__dirname, '../connect/public');

    // happner is using this to create the api/client package
    _this.script = clientPath + '/browser_primus.js';

    if (process.env.UPDATE_BROWSER_PRIMUS) _this.primus.save(_this.script);

    _this.initializeCaches(callback);

  } catch (e) {
    callback(e);
  }
};

SessionService.prototype.localClient = Promise.promisify(function(config, callback){

  var _this = this;

  if (typeof config == 'function') {
    callback = config;
    config = {}
  }

  var ClientBase = require('../../client');
  var LocalPlugin = require('./localclient');

  ClientBase.create({
    config:config,
    plugin: LocalPlugin,
    context: _this.happn
  }, function(e, instance){
    if (e) return callback(e);
    callback(null, instance);
  });
});

// so we can update the session data to use a different protocol, or start encrypting payloads etc
SessionService.prototype.__configureSession = Promise.promisify(function (message, client) {
  var _this = this;

  //limit what properties you are allowed to set - for the moment protocol only
  //TODO - encrypted/compressed
  var configuration = {
    protocol:message.data.protocol
  };

  return _this.__updateSession(client.sessionId, configuration);

});

SessionService.prototype.configured = Promise.promisify(function(message, callback){

  this.emit('session-configured', message);
  callback(null, message);
});

SessionService.prototype.__discardMessage = function(message){

  this.emit('message-discarded', message);
  return;
};

SessionService.prototype.handleMessage = Promise.promisify(function (message, client) {

  var _this = this;

  if (message.action === 'configure-session') this.__configureSession(message, client);

  if (!_this.__sessions[client.sessionId]) return _this.__discardMessage(message);

  _this.__currentMessageId++;

  _this.happn.services.queue.pushInbound({raw:message, session:_this.__sessions[client.sessionId].data, id:_this.__currentMessageId})

    .then(function(processed){

      processed.response.__outbound = true;

      client.write(processed.response);
    })

    .catch(_this.happn.services.error.handleSystem.bind(_this.happn.services.error));

});

SessionService.prototype.clientDisconnect = function (client, options, callback) {

  var _this = this;

  if (typeof options === 'function') {
    callback = options;
    options = null;
  }

  if (!_this.__sessions[client.sessionId]) {

    if (callback) return callback();//client was previously disconnected
    else return;
  }

  if (!options) options = {};
  if (options.reconnect == null) options.reconnect = false;//this is because the client willfully disconnected

  options.clientDisconnected = true;

  _this.__finalizeDisconnect(client, options, callback);

};

SessionService.prototype.__finalizeDisconnect = function(client, options, callback){

  var _this = this;

  if (typeof options === 'function'){
    callback = options;
    options = {};
  }

  if (options == null) options = {};
  if (options.reconnect == null) options.reconnect = true;//allow for connected restarts

  options.timeout = _this.config.disconnectTimeout;

  _this.happn.services.pubsub.clearSubscriptions(client.sessionId);

  var sessionData = _this.__sessions[client.sessionId].data;

  delete _this.__sessions[client.sessionId];

  _this.__activeSessions.remove(client.sessionId);

  _this.emit('disconnect', sessionData);//emit the disconnected event

  if (options.clientDisconnected) {//this means the spark is already disconnected - so we dont need to send it a disconnect message
    if (callback) return callback();
    else return;
  }

  _this.happn.services.queue.pushSystem({action:'disconnect', options:options, session:sessionData})

    .then(function(processed){

      try{

        processed.response.__outbound = true;

        client.on('end', function(){
          if (callback) callback();
        });

        client.end(processed.response, options);

      }catch(e){
        _this.happn.services.error.handleSystem(e);
      }
    })

    .catch(_this.happn.services.error.handleSystem.bind(_this.happn.services.error));

};

SessionService.prototype.disconnect = function (client, options, callback) {

  var _this = this;

  client.__serverDisconnected = true;

  _this.__finalizeDisconnect(client, options, callback);

};

SessionService.prototype.onConnect = function (client) {
  var _this = this;

  client.sessionId = uuid.v4();

  _this.__sessions[client.sessionId] = {
    client:client
  };

  client.on('error', function (err) {
    _this.log.error('socket error', err);
  });

  client.on('data', function (message) {
    _this.handleMessage(message, client);
  });

  _this.__sessions[client.sessionId].data = {
    id: client.sessionId,
    protocol:'happn_' + require('../../../package.json').protocol,//we default to the latest protocol
    happn:_this.happn.services.system.getDescription()
  };

  _this.emit('connect', _this.__sessions[client.sessionId].data);

};

SessionService.prototype.onDisconnect = function (client) {
  if (!client.__serverDisconnected) this.clientDisconnect(client);
};
