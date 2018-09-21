var Primus = require('happn-primus'),
  util = require('util'),
  EventEmitter = require('events').EventEmitter,
  uuid = require('uuid'),
  path = require('path'),
  Promise = require('bluebird'),
  async = require('async'),
  constants = require('../../constants');

module.exports = SessionService;

function SessionService(opts) {

  this.log = opts.logger.createLogger('Session');
  this.log.$$TRACE('construct(%j)', opts);

  this.__sessions = {};
}

// Enable subscription to key lifecycle events
util.inherits(SessionService, EventEmitter);

SessionService.prototype.stats = stats;
SessionService.prototype.__safeSessionData = __safeSessionData;
SessionService.prototype.initializeCaches = initializeCaches;
SessionService.prototype.attachSession = attachSession;
SessionService.prototype.processRevokeSession = processRevokeSession;
SessionService.prototype.__revokeSession = __revokeSession;
SessionService.prototype.__updateSession = __updateSession;
SessionService.prototype.getClient = getClient;
SessionService.prototype.getSession = getSession;
SessionService.prototype.disconnectSession = disconnectSession;
SessionService.prototype.each = each;
SessionService.prototype.destroyPrimus = destroyPrimus;
SessionService.prototype.stop = stop;
SessionService.prototype.disconnectAllClients = disconnectAllClients;
SessionService.prototype.initialize = initialize;
SessionService.prototype.localClient = Promise.promisify(localClient);
SessionService.prototype.localAdminClient = Promise.promisify(localAdminClient);
SessionService.prototype.__configureSession = Promise.promisify(__configureSession);
SessionService.prototype.processConfigureSession = Promise.promisify(processConfigureSession);
SessionService.prototype.__discardMessage = __discardMessage;
SessionService.prototype.handleMessage = Promise.promisify(handleMessage);
SessionService.prototype.finalizeDisconnect = finalizeDisconnect;
SessionService.prototype.disconnectClient = disconnectClient;
SessionService.prototype.disconnect = disconnect;
SessionService.prototype.onConnect = onConnect;
SessionService.prototype.onDisconnect = onDisconnect;

function stats() {
  return {
    sessions: Object.keys(this.__sessions).length
  };
};

function __safeSessionData(sessionData) {

  var safeSessionData = {

    "id": sessionData.id,
    "info": sessionData.info,
    "type": sessionData.type,
    "timestamp": sessionData.timestamp,
    "isEncrypted": sessionData.isEncrypted ? true : false,
    "policy": sessionData.policy,
    "token": sessionData.token,
    "encryptedSecret": sessionData.encryptedSecret

  };

  if (sessionData.user) safeSessionData.user = {
    username: sessionData.user.username,
    publicKey: sessionData.user.publicKey
  };

  return safeSessionData;
};

function initializeCaches(callback) {

  if (!this.config.queuedDisconnectsTTL) this.config.queuedDisconnectsTTL = 300000; // 5 minutes

  if (!this.config.activeSessionsCache) this.config.activeSessionsCache = {
    type: 'static'
  };

  this.__activeSessions = this.happn.services.cache.new('service_session_active_sessions', this.config.activeSessionsCache);

  callback();
};

function attachSession(sessionId, session) {

  var _this = this;

  var sessionData = _this.__updateSession(sessionId, session);
  if (sessionData == null) return;
  _this.emit('authentic', _this.__safeSessionData(sessionData));
  _this.__activeSessions.set(sessionId, sessionData);

  return sessionData;
};

function processRevokeSession(message, callback) {

  var _this = this;

  return new Promise(function(resolve, reject){
    _this.__revokeSession(message.session, 'CLIENT', function(e) {
      if (e) return reject(e);
      message.data = 'ok';
      resolve(message);
    });
  });
};

function __revokeSession(session, reason, callback) {

  if (!this.__sessions[session.id]) return callback();

  this.happn.services.security.revokeSession(session, reason, function(e) {
    callback(e);
  });
};


function __updateSession(sessionId, updated) {

  var _this = this;

  if (!_this.__sessions[sessionId])
    return null;

  for (var propertyName in updated) _this.__sessions[sessionId].data[propertyName] = updated[propertyName];

  return _this.__sessions[sessionId].data;

};

function getClient(sessionId) {

  return this.__sessions[sessionId] ? this.__sessions[sessionId].client : null;
};

function getSession(sessionId) {

  return this.__sessions[sessionId] ? this.__sessions[sessionId].data : null;
};

function disconnectSession(sessionId, callback, message) {

  if (!this.__sessions[sessionId]) {
    if (callback) callback();
    return;
  }
  var client = this.__sessions[sessionId].client;
  this.disconnectClient(client, callback, {_meta:{type:'system'}, data: message, eventKey:'server-side-disconnect', __outbound:true});
};

function each(eachHandler, callback) {
  //the caller can iterate through the sessions
  var _this = this;

  var sessionKeys = Object.keys(_this.__sessions);

  if (sessionKeys.length == 0) return callback();

  async.each(sessionKeys, function(sessionKey, sessionKeyCallback) {

    eachHandler.call(eachHandler, _this.__sessions[sessionKey].data, sessionKeyCallback);

  }, callback);
};

function destroyPrimus(options, callback){

  var _this = this;

  var shutdownTimeout = setTimeout(function() {

    _this.log.error('primus destroy timed out after ' + options.timeout + ' milliseconds');
    _this.__shutdownTimeout = true; //instance level flag to ensure callback is not called multiple times
    callback();
  }, options.timeout);

  _this.primus.destroy({
    // // have primus close the http server and clean up
    close: true,
    // have primus inform clients to attempt reconnect
    reconnect: typeof options.reconnect === 'boolean' ? options.reconnect : true
  }, function(e) {

    //we ensure that primus didn't time out earlier
    if (!_this.__shutdownTimeout) {
      clearTimeout(shutdownTimeout);
      callback(e);
    }
  });
}

function stop(options, callback) {

  var _this = this;

  if (typeof options == 'function') {
    callback = options;
    options = null;
  }

  if (!options) options = {};
  if (!this.primus) return callback();
  if (!options.timeout) options.timeout = 10000;

  if (options.reconnect === false) // this must happen rarely or in test cases
    return _this.disconnectAllClients(function(e) {

      if (e) _this.log.error('failed disconnecting clients gracefully', e);
      _this.destroyPrimus(options, callback);
    });

  return this.destroyPrimus(options, callback);
};

function disconnectAllClients(callback) {

  var _this = this;

  _this.each(function(sessionData, sessionDataCallback) {
    _this.disconnectSession(sessionData.id, sessionDataCallback, {reason:'reconnect-false'});
  }, callback);
};

function initialize(config, callback) {

  var _this = this;

  try {

    if (!config) config = {};

    if (!config.timeout) config.timeout = false;

    if (!config.disconnectTimeout) config.disconnectTimeout = 1000;

    _this.errorService = _this.happn.services.error;

    _this.config = config;

    _this.__shutdownTimeout = false; //used to flag an incomplete shutdown

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

function localClient(config, callback) {

  var _this = this;

  if (typeof config == 'function') {
    callback = config;
    config = {};
  }

  var ClientBase = require('../../client');
  var LocalPlugin = require('./localclient');

  return ClientBase.create({
    config: config,
    plugin: LocalPlugin,
    context: _this.happn
  }, function(e, instance) {

    if (e) return callback(e);
    callback(null, instance);
  });
};

function localAdminClient(callback) {

  var _this = this;

  var ClientBase = require('../../client');
  var AdminPlugin = require('./adminclient');

  return ClientBase.create({
    config: {
      username: '_ADMIN',
      password: 'LOCAL'
    }, //the AdminPlugin is directly connected to the security service, this password is just a place holder to get around client validation
    plugin: AdminPlugin,
    context: _this.happn
  }, function(e, instance) {

    if (e) return callback(e);
    callback(null, instance);
  });
};

// so we can update the session data to use a different protocol, or start encrypting payloads etc
function __configureSession(message, client) {
  var _this = this;

  //limit what properties you are allowed to set - for the moment protocol only
  //TODO - encrypted/compressed
  var configuration = {
    protocol: message.data.protocol
  };

  return _this.__updateSession(client.sessionId, configuration);

};

function processConfigureSession(message, callback) {

  this.emit('session-configured', message);
  callback(null, message);
};

function __discardMessage(message) {

  this.emit('message-discarded', message);
};

function handleMessage(message, client) {

  var _this = this;

  if (message.action === 'configure-session') this.__configureSession(message, client);
  if (!_this.__sessions[client.sessionId]) return _this.__discardMessage(message);
  _this.__currentMessageId++;

  _this.happn.services.queue.pushInbound({
      raw: message,
      session: _this.__sessions[client.sessionId].data,
      id: _this.__currentMessageId
    })
    .then(function(processed) {
      processed.response.__outbound = true;
      client.write(processed.response);
    })
    .catch(function(e) {
      _this.happn.services.error.handleSystem(e, 'SessionService.handleMessage', constants.ERROR_SEVERITY.MEDIUM);
    });
};

function finalizeDisconnect(client, callback){
  try{
    if (!this.__sessions[client.sessionId]) return callback();
    this.happn.services.subscription.clearSessionSubscriptions(client.sessionId);
    var sessionData = this.__sessions[client.sessionId].data;
    this.__activeSessions.remove(client.sessionId);
    delete this.__sessions[client.sessionId];
    this.emit('disconnect', sessionData); //emit the disconnected event
    this.emit('client-disconnect', client.sessionId); //emit the disconnected event
    callback();
  }catch(e){
    callback(e);
  }
}

function disconnectClient(client, callback, message) {
  if (!callback) callback = function(){};
  if (!this.__sessions[client.sessionId]) return callback();
  if (client.__readyState === 2) return this.finalizeDisconnect(client, callback);
  var _this = this;
  client.once('end', function(){
    _this.finalizeDisconnect(client, callback);
  });
  if (message) return client.end(message);
  client.end();
};

function disconnect(client, callback) {
  var _this = this;
  _this.disconnectClient(client, callback);
};

function onConnect(client) {

  var _this = this;

  client.sessionId = uuid.v4();

  _this.__sessions[client.sessionId] = {
    client: client,
    data: {
      id: client.sessionId,
      protocol: 'happn', //we default to the oldest protocol
      happn: _this.happn.services.system.getDescription()
    }
  };

  client.on('error', function(err) {
    _this.log.error('socket error', err);
  });

  client.on('data', function(message) {
    _this.handleMessage(message, client);
  });

  _this.emit('connect', _this.__sessions[client.sessionId].data);
};

function onDisconnect(client, options) {
  var _this = this;
  _this.finalizeDisconnect(client, function(e){
    _this.log.error('client disconnect error, for session id: ' + client.sessionId, e);
  });
};
