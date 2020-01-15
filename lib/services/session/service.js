var Primus = require('happn-primus-wrapper'),
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
  this.__sessionExpiryWatchers = {};
}

// Enable subscription to key lifecycle events
util.inherits(SessionService, EventEmitter);

SessionService.prototype.stats = stats;
SessionService.prototype.__safeSessionData = __safeSessionData;
SessionService.prototype.initializeCaches = initializeCaches;

SessionService.prototype.attachSession = attachSession;
SessionService.prototype.__attachSessionExpired = __attachSessionExpired;

SessionService.prototype.processRevokeSession = processRevokeSession;
SessionService.prototype.__revokeSession = __revokeSession;
SessionService.prototype.__updateSession = __updateSession;
SessionService.prototype.getClient = getClient;
SessionService.prototype.getSession = getSession;
SessionService.prototype.disconnectSession = disconnectSession;
SessionService.prototype.__detachSessionExpired = __detachSessionExpired;
SessionService.prototype.each = each;
SessionService.prototype.destroyPrimus = destroyPrimus;
SessionService.prototype.stop = stop;
SessionService.prototype.disconnectAllClients = disconnectAllClients;
SessionService.prototype.initialize = initialize;
SessionService.prototype.localClient = Promise.promisify(localClient);
SessionService.prototype.localAdminClient = Promise.promisify(localAdminClient);
SessionService.prototype.__configureSession = Promise.promisify(__configureSession);
SessionService.prototype.processConfigureSession = processConfigureSession;
SessionService.prototype.__discardMessage = __discardMessage;
SessionService.prototype.handleMessage = Promise.promisify(handleMessage);
SessionService.prototype.finalizeDisconnect = finalizeDisconnect;
SessionService.prototype.disconnectClient = disconnectClient;
SessionService.prototype.disconnect = disconnect;
SessionService.prototype.onConnect = onConnect;
SessionService.prototype.onDisconnect = onDisconnect;
SessionService.prototype.securityDirectoryChanged = securityDirectoryChanged;
SessionService.prototype.endSession = endSession;

function stats() {
  return {
    sessions: Object.keys(this.__sessions).length
  };
}

function __safeSessionData(sessionData) {
  var safeSessionData = {
    id: sessionData.id,
    info: sessionData.info,
    type: sessionData.type,
    timestamp: sessionData.timestamp,
    isEncrypted: sessionData.isEncrypted ? true : false,
    policy: sessionData.policy,
    token: sessionData.token,
    encryptedSecret: sessionData.encryptedSecret
  };

  if (sessionData.user)
    safeSessionData.user = {
      username: sessionData.user.username,
      publicKey: sessionData.user.publicKey
    };

  return safeSessionData;
}

function initializeCaches(callback) {
  if (!this.config.activeSessionsCache)
    this.config.activeSessionsCache = {
      type: 'static'
    };

  this.__activeSessions = this.happn.services.cache.new(
    'service_session_active_sessions',
    this.config.activeSessionsCache
  );

  callback();
}

function __attachSessionExpired(session) {
  if (
    session.policy &&
    session.policy['0'] &&
    session.policy['0'].ttl > 0 &&
    session.policy['0'].ttl !== Infinity
  ) {
    this.__sessionExpiryWatchers[session.id] = setTimeout(() => {
      this.endSession(session.id, 'token-expired');
      this.__detachSessionExpired(session.id);
    }, session.policy[0].ttl);
  }
}

function __detachSessionExpired(sessionId) {
  if (!this.__sessionExpiryWatchers[sessionId]) return;
  clearTimeout(this.__sessionExpiryWatchers[sessionId]);
  delete this.__sessionExpiryWatchers[sessionId];
}

function endSession(sessionId, reason) {
  this.disconnectSession(
    sessionId,
    e => {
      if (e) return this.log.error(`failed to end session ${sessionId}: ${e.message}`);
    },
    {
      reason
    }
  );
}

function attachSession(sessionId, session) {
  var sessionData = this.__updateSession(sessionId, session);
  if (sessionData == null) return;
  this.emit('authentic', this.__safeSessionData(sessionData));
  this.__activeSessions.set(sessionId, sessionData);
  this.__attachSessionExpired(session);
  return sessionData;
}

function processRevokeSession(message, callback) {
  this.__revokeSession(message.session, 'CLIENT', e => {
    if (e) return callback(e);
    message.data = 'ok';
    callback(null, message);
  });
}

function __revokeSession(session, reason, callback) {
  if (!this.__sessions[session.id]) return callback();

  this.happn.services.security.revokeSession(session, reason, function(e) {
    callback(e);
  });
}

function __updateSession(sessionId, updated) {
  if (!this.__sessions[sessionId]) return null;
  for (var propertyName in updated)
    this.__sessions[sessionId].data[propertyName] = updated[propertyName];
  return this.__sessions[sessionId].data;
}

function getClient(sessionId) {
  return this.__sessions[sessionId] ? this.__sessions[sessionId].client : null;
}

function getSession(sessionId) {
  return this.__sessions[sessionId] ? this.__sessions[sessionId].data : null;
}

function disconnectSession(sessionId, callback, message) {
  if (!this.__sessions[sessionId]) {
    if (callback) callback();
    return;
  }
  this.__detachSessionExpired(sessionId);
  var client = this.__sessions[sessionId].client;
  this.disconnectClient(client, callback, {
    _meta: {
      type: 'system'
    },
    data: message,
    eventKey: 'server-side-disconnect',
    __outbound: true
  });
}

function each(eachHandler, callback) {
  //the caller can iterate through the sessions
  var sessionKeys = Object.keys(this.__sessions);
  if (sessionKeys.length === 0) return callback();

  async.each(
    sessionKeys,
    (sessionKey, sessionKeyCallback) => {
      eachHandler.call(eachHandler, this.__sessions[sessionKey].data, sessionKeyCallback);
    },
    callback
  );
}

function destroyPrimus(options, callback) {
  var shutdownTimeout = setTimeout(() => {
    this.log.error('primus destroy timed out after ' + options.timeout + ' milliseconds');
    this.__shutdownTimeout = true; //instance level flag to ensure callback is not called multiple times
    callback();
  }, options.timeout);

  this.primus.destroy(
    {
      // // have primus close the http server and clean up
      close: true,
      // have primus inform clients to attempt reconnect
      reconnect: typeof options.reconnect === 'boolean' ? options.reconnect : true
    },
    e => {
      //we ensure that primus didn't time out earlier
      if (!this.__shutdownTimeout) {
        clearTimeout(shutdownTimeout);
        callback(e);
      }
    }
  );
}

function stop(options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = null;
  }

  if (!options) options = {};
  if (!this.primus) return callback();
  if (!options.timeout) options.timeout = 10000;

  if (options.reconnect === false)
    // this must happen rarely or in test cases
    return this.disconnectAllClients(e => {
      if (e) this.log.error('failed disconnecting clients gracefully', e);
      this.destroyPrimus(options, callback);
    });

  return this.destroyPrimus(options, callback);
}

function disconnectAllClients(callback) {
  this.each((sessionData, sessionDataCallback) => {
    this.disconnectSession(sessionData.id, sessionDataCallback, {
      reason: 'reconnect-false'
    });
  }, callback);
}

function initialize(config, callback) {
  try {
    if (!config) config = {};

    if (!config.timeout) config.timeout = false;

    if (!config.disconnectTimeout) config.disconnectTimeout = 1000;

    this.errorService = this.happn.services.error;

    this.config = config;

    this.__shutdownTimeout = false; //used to flag an incomplete shutdown

    this.__currentMessageId = 0;

    this.primus = new Primus(this.happn.server, config.primusOpts);

    this.primus.on('connection', this.onConnect.bind(this));
    this.primus.on('disconnection', this.onDisconnect.bind(this));

    //remove the __outbound tag
    this.primus.transform('outgoing', function(packet, next) {
      if (packet.data) delete packet.data.__outbound;
      next();
    });

    var clientPath = path.resolve(__dirname, '../connect/public');

    // happner is using this to create the api/client package
    this.script = clientPath + '/browser_primus.js';

    if (process.env.UPDATE_BROWSER_PRIMUS) {
      this.log.info(`writing browser primus: ${this.script}`);
      this.primus.save(this.script);
    }

    this.initializeCaches(callback);
  } catch (e) {
    callback(e);
  }
}

function localClient(config, callback) {
  if (typeof config === 'function') {
    callback = config;
    config = {};
  }

  var ClientBase = require('../../client');
  var LocalPlugin = require('./localclient').Wrapper;

  return ClientBase.create(
    {
      config: config,
      plugin: LocalPlugin,
      context: this.happn
    },
    function(e, instance) {
      if (e) return callback(e);
      callback(null, instance);
    }
  );
}

function localAdminClient(callback) {
  var ClientBase = require('../../client');
  var AdminPlugin = require('./adminclient').Wrapper;

  return ClientBase.create(
    {
      config: {
        username: '_ADMIN',
        password: 'LOCAL'
      }, //the AdminPlugin is directly connected to the security service, this password is just a place holder to get around client validation
      plugin: AdminPlugin,
      context: this.happn
    },
    function(e, instance) {
      if (e) return callback(e);
      callback(null, instance);
    }
  );
}

// so we can update the session data to use a different protocol, or start encrypting payloads etc
function __configureSession(message, client) {
  if (!this.__sessions[client.sessionId]) return;

  this.__sessions[client.sessionId].client.happnProtocol = message.data.protocol;

  var configuration = {
    protocol: message.data.protocol
  };

  return this.__updateSession(client.sessionId, configuration);
}

function processConfigureSession(message) {
  this.emit('session-configured', message);
}

function __discardMessage(message) {
  this.emit('message-discarded', message);
}

function handleMessage(message, client) {
  //legacy clients do pings
  if (message.indexOf && message.indexOf('primus::ping::') === 0)
    return client.onLegacyPing(message);

  //this must happen before the protocol service processes the message stack
  if (message.action === 'configure-session') this.__configureSession(message, client);

  if (!this.__sessions[client.sessionId]) return this.__discardMessage(message);

  this.__currentMessageId++;

  this.happn.services.protocol.processMessageIn(
    {
      raw: message,
      session: this.__sessions[client.sessionId].data,
      id: this.__currentMessageId
    },
    (e, processed) => {
      if (e)
        return this.happn.services.error.handleSystem(
          e,
          'SessionService.handleMessage',
          constants.ERROR_SEVERITY.MEDIUM
        );
      processed.response.__outbound = true;
      client.write(processed.response);
    }
  );
}

function finalizeDisconnect(client, callback) {
  try {
    if (!this.__sessions[client.sessionId]) return callback();
    this.__detachSessionExpired(client.sessionId);
    this.happn.services.subscription.clearSessionSubscriptions(client.sessionId);
    var sessionData = this.__sessions[client.sessionId].data;
    this.__activeSessions.remove(client.sessionId);
    delete this.__sessions[client.sessionId];
    this.emit('disconnect', sessionData); //emit the disconnected event
    this.emit('client-disconnect', client.sessionId); //emit the disconnected event
    callback();
  } catch (e) {
    callback(e);
  }
}

function disconnectClient(client, callback, message) {
  if (!callback) callback = function() {};
  if (!this.__sessions[client.sessionId]) return callback();
  if (client.__readyState === 2) return this.finalizeDisconnect(client, callback);
  client.once('end', () => {
    this.finalizeDisconnect(client, callback);
  });
  if (message) return client.end(message);
  client.end();
}

function disconnect(client, callback) {
  this.disconnectClient(client, callback);
}

function onConnect(client) {
  client.sessionId = uuid.v4();
  client.happnConnected = Date.now();

  this.__sessions[client.sessionId] = {
    client: client,
    data: {
      id: client.sessionId,
      protocol: 'happn', //we default to the oldest protocol
      happn: this.happn.services.system.getDescription()
    }
  };

  client.on('error', err => {
    this.log.error('socket error', err);
  });

  client.on('data', message => {
    this.handleMessage(message, client);
  });

  this.emit('connect', this.__sessions[client.sessionId].data);
}

function onDisconnect(client) {
  this.finalizeDisconnect(client, e => {
    if (e) this.log.error('client disconnect error, for session id: ' + client.sessionId, e);
  });
}

function securityDirectoryChanged(whatHappnd, changedData, effectedSessions) {
  return new Promise((resolve, reject) => {
    if (
      effectedSessions == null ||
      effectedSessions.length === 0 ||
      [
        'permission-removed',
        'permission-upserted',
        'unlink-group',
        'delete-group',
        'upsert-group',
        'upsert-user'
      ].indexOf(whatHappnd) === -1
    )
      return resolve(effectedSessions);

    async.each(
      effectedSessions,
      (effectedSession, sessionCB) => {
        try {
          var client = this.getClient(effectedSession.id);
          if (!client) return sessionCB();
          this.happn.services.protocol.processSystemOut(
            {
              session: effectedSession,
              eventKey: 'security-data-changed',
              data: {
                whatHappnd: whatHappnd,
                changedData: changedData
              }
            },
            sessionCB
          );
        } catch (e) {
          sessionCB(e);
        }
      },
      function(e) {
        if (e) return reject(e);
        resolve(effectedSessions);
      }
    );
  });
}
