var Primus = require('happn-primus-wrapper'),
  util = require('../utils/shared'),
  EventEmitter = require('events').EventEmitter,
  uuid = require('uuid'),
  path = require('path'),
  async = require('async'),
  CONSTANTS = require('../..').constants;

module.exports = SessionService;

function SessionService(opts) {
  this.log = opts.logger.createLogger('Session');
  this.log.$$TRACE('construct(%j)', opts);

  this.__sessions = {};
  this.__sessionExpiryWatchers = {};
}

// Enable subscription to key lifecycle events
require('util').inherits(SessionService, EventEmitter);

SessionService.prototype.stats = stats;
SessionService.prototype.__safeSessionData = __safeSessionData;
SessionService.prototype.initializeCaches = initializeCaches;

SessionService.prototype.attachSession = attachSession;
SessionService.prototype.__attachSessionExpired = __attachSessionExpired;

SessionService.prototype.processRevokeSessionToken = processRevokeSessionToken;
SessionService.prototype.__updateSession = __updateSession;
SessionService.prototype.getClient = getClient;
SessionService.prototype.getSession = getSession;
SessionService.prototype.disconnectSession = disconnectSession;
SessionService.prototype.disconnectSessions = disconnectSessions;
SessionService.prototype.__detachSessionExpired = __detachSessionExpired;
SessionService.prototype.each = each;
SessionService.prototype.destroyPrimus = destroyPrimus;
SessionService.prototype.stop = stop;
SessionService.prototype.disconnectAllClients = disconnectAllClients;
SessionService.prototype.initialize = initialize;
SessionService.prototype.localClient = util.maybePromisify(localClient);
SessionService.prototype.localAdminClient = util.maybePromisify(localAdminClient);
SessionService.prototype.__configureSession = util.maybePromisify(__configureSession);
SessionService.prototype.processConfigureSession = processConfigureSession;
SessionService.prototype.__discardMessage = __discardMessage;
SessionService.prototype.handleMessage = handleMessage;
SessionService.prototype.finalizeDisconnect = finalizeDisconnect;
SessionService.prototype.disconnectClient = disconnectClient;
SessionService.prototype.disconnect = disconnect;
SessionService.prototype.onConnect = onConnect;
SessionService.prototype.onDisconnect = onDisconnect;
SessionService.prototype.securityDirectoryChanged = securityDirectoryChanged;
SessionService.prototype.__unconfiguredSessionCleanup = __unconfiguredSessionCleanup;
SessionService.prototype.__startUnconfiguredSessionCleanup = __startUnconfiguredSessionCleanup;
SessionService.prototype.__stopUnconfiguredSessionCleanup = __stopUnconfiguredSessionCleanup;
SessionService.prototype.__sessionIsUnconfigured = __sessionIsUnconfigured;
SessionService.prototype.__configuredSessionLog = __configuredSessionLog;
SessionService.prototype.getClientUpgradeHeaders = getClientUpgradeHeaders;
SessionService.prototype.endSession = endSession;
SessionService.prototype.logSessionAttached = logSessionAttached;
SessionService.prototype.logSessionDetached = logSessionDetached;
SessionService.prototype.getSessionEventJSON = getSessionEventJSON;
SessionService.prototype.socketErrorWarning = socketErrorWarning;

function __sessionIsUnconfigured(sessionId, config) {
  let unconfigured = !this.__sessions[sessionId].data || !this.__sessions[sessionId].data.user;
  let connectedLongerThanThreshold =
    Date.now() - this.__sessions[sessionId].client.happnConnected > config.threshold;
  return unconfigured && connectedLongerThanThreshold;
}

function __configuredSessionLog(message, config) {
  if (config.verbose) this.log.info(message);
}

function __unconfiguredSessionCleanup(config) {
  return () => {
    const sessionKeys = Object.keys(this.__sessions);
    this.__configuredSessionLog(`current live sessions count ${sessionKeys.length}`, config);
    var cleanedUp = 0;
    sessionKeys.forEach(sessionId => {
      if (this.__sessionIsUnconfigured(sessionId, config)) {
        this.disconnectClient(this.__sessions[sessionId].client, e => {
          if (e) return this.log.error(`unable to remove unconfigured session: ${sessionId}`);
          this.__configuredSessionLog(`session ${sessionId} not configured, removed`, config);
        });
        cleanedUp++;
      }
    });
    this.__configuredSessionLog(`attempted to clean up ${cleanedUp} unconfigured sessions`, config);
  };
}

function __startUnconfiguredSessionCleanup(cleanupConfig) {
  if (!cleanupConfig) return;
  if (!this.config.secure) throw new Error('unable to cleanup sockets in an unsecure setup');
  this.log.info(`starting unconfigured session cleanup, at interval: ${cleanupConfig.interval}`);
  this.__unconfiguredSessionCleanupInterval = setInterval(
    this.__unconfiguredSessionCleanup(cleanupConfig),
    cleanupConfig.interval
  );
}

function __stopUnconfiguredSessionCleanup() {
  if (this.__unconfiguredSessionCleanupInterval) {
    clearInterval(this.__unconfiguredSessionCleanupInterval);
    this.__unconfiguredSessionCleanupInterval = null;
    this.log.info(`stopped unconfigured session cleanup`);
  }
}

function stats() {
  return {
    sessions: Object.keys(this.__sessions).length
  };
}

function __safeSessionData(sessionData) {
  const safeSessionData = {
    id: sessionData.id,
    info: sessionData.info,
    type: sessionData.type,
    msgCount: sessionData.msgCount,
    legacyPing: sessionData.legacyPing || false,
    timestamp: sessionData.timestamp,
    isEncrypted: sessionData.isEncrypted ? true : false,
    policy: sessionData.policy,
    protocol: sessionData.protocol,
    tlsEncrypted: sessionData.encrypted,
    cookieName: sessionData.cookieName,
    browser: sessionData.info && sessionData.info._browser ? true : false,
    intraProc:
      (sessionData.info && sessionData.info._local) || sessionData.address === 'intra-proc',
    sourceAddress: sessionData.address ? sessionData.address.ip : null,
    sourcePort: sessionData.address ? sessionData.address.port : null,
    upgradeUrl: sessionData.url,
    happnVersion: sessionData.version,
    happn: sessionData.happn
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
    //eslint-disable-next-line
    session.policy['0'].ttl != Infinity
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
  const safeSessionData = this.__safeSessionData(sessionData);
  this.logSessionAttached(safeSessionData);
  this.emit('authentic', safeSessionData);
  this.__activeSessions.set(sessionId, sessionData);
  this.__attachSessionExpired(session);
  return sessionData;
}

function logSessionAttached(safeSessionData) {
  if (this.config.disableSessionEventLogging) return;
  //logged in such a manner that we are able to ingest the data into datadog / cloudwatch etc.
  this.log.info(this.getSessionEventJSON('session attached', safeSessionData));
}

function logSessionDetached(safeSessionData) {
  if (this.config.disableSessionEventLogging) return;
  //logged in such a manner that we are able to ingest the data into datadog / cloudwatch etc.
  this.log.info(this.getSessionEventJSON('session detached', safeSessionData));
}

function getSessionEventJSON(event, safeSessionData) {
  return JSON.stringify({
    event,
    username: safeSessionData.user
      ? safeSessionData.user.username
      : 'anonymous (unsecure connection)',
    sourceAddress: safeSessionData.sourceAddress,
    sourcePort: safeSessionData.sourcePort,
    upgradeUrl: safeSessionData.upgradeUrl,
    happnVersion: safeSessionData.happnVersion,
    happnProtocolVersion: safeSessionData.protocol
  });
}

function processRevokeSessionToken(message, reason, callback) {
  this.happn.services.security.revokeToken(message.session.token, reason, function(e) {
    callback(e, message);
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

function disconnectSessions(parentSessionId, message, callback, includeParent = true) {
  async.eachSeries(
    Object.keys(this.__sessions),
    (sessionId, sessionCb) => {
      const session = this.__sessions[sessionId];
      if (!includeParent && session.data.id === parentSessionId) return sessionCb();
      if (session.data.parentId !== parentSessionId) return sessionCb();
      this.disconnectSession(sessionId, sessionCb, message);
    },
    e => {
      return callback(e);
    }
  );
}

function disconnectSession(sessionId, callback, message) {
  const session = this.__sessions[sessionId];
  if (!session) {
    if (callback) callback();
    return;
  }
  this.__detachSessionExpired(sessionId);
  this.disconnectClient(session.client, callback, {
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
  if (!options.timeout) options.timeout = 20000;

  this.__stopUnconfiguredSessionCleanup();

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

    if (config.unconfiguredSessionCleanup) {
      //ensure we have some sensible defaults
      //the interval between checks for unconfigured sessions  (5 secs)
      config.unconfiguredSessionCleanup.interval =
        config.unconfiguredSessionCleanup.interval || 5e3;
      //how long we wait to classify a session with no user data as unconfigured (30 secs)
      config.unconfiguredSessionCleanup.threshold =
        config.unconfiguredSessionCleanup.threshold || 30e3;
      //log what is happening if not explicitly set to false
      config.unconfiguredSessionCleanup.verbose =
        config.unconfiguredSessionCleanup.verbose == null
          ? true
          : config.unconfiguredSessionCleanup.verbose;

      this.__startUnconfiguredSessionCleanup(config.unconfiguredSessionCleanup);
    }

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

  let session = this.__sessions[client.sessionId];

  session.client.happnProtocol = message.data.protocol;

  var configuration = {
    version: message.data.version || 'unknown',
    protocol: message.data.protocol,
    cookieName: message.data.browser
      ? this.happn.services.security.getCookieName(session.client.headers, session.data, {})
      : undefined
  };

  const updatedSession = this.__updateSession(client.sessionId, configuration);
  return updatedSession;
}

function processConfigureSession(message) {
  this.emit('session-configured', this.__safeSessionData(message.session));
}

function __discardMessage(message) {
  this.emit('message-discarded', message);
}

function handleMessage(message, client) {
  //legacy clients do pings
  if (message.indexOf && message.indexOf('primus::ping::') === 0) {
    if (this.__sessions[client.sessionId] && this.__sessions[client.sessionId].data)
      this.__sessions[client.sessionId].data.legacyPing = true;
    return client.onLegacyPing(message);
  }
  //this must happen before the protocol service processes the message stack
  if (message.action === 'configure-session') this.__configureSession(message, client);
  if (!this.__sessions[client.sessionId]) return this.__discardMessage(message);

  this.__sessions[client.sessionId].data.msgCount++;
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
          CONSTANTS.ERROR_SEVERITY.MEDIUM
        );
      processed.response.__outbound = true;
      client.write(processed.response);
    }
  );
}

function finalizeDisconnect(client, callback) {
  try {
    const session = this.__sessions[client.sessionId];
    if (!session) return callback();
    const sessionData = session.data;
    delete this.__sessions[client.sessionId];
    this.__detachSessionExpired(client.sessionId);
    this.happn.services.subscription.clearSessionSubscriptions(client.sessionId);
    this.__activeSessions.remove(client.sessionId);
    const safeSessionData = this.__safeSessionData(sessionData);
    this.logSessionDetached(safeSessionData);
    this.emit('disconnect', safeSessionData); //emit the disconnected event
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

function getClientUpgradeHeaders(headers) {
  if (!headers) return {};
  return Object.keys(headers).reduce((headersObj, header) => {
    const headerLowerCase = header.toLowerCase();
    if (CONSTANTS.CLIENT_HEADERS_COLLECTION.indexOf(headerLowerCase) > -1)
      headersObj[headerLowerCase] = headers[header];
    return headersObj;
  }, {});
}

function socketErrorWarning(err) {
  return (
    err.message.indexOf('Failed to decode incoming data') > -1 ||
    err.message.indexOf('Invalid WebSocket frame') > -1
  );
}

function onConnect(client) {
  client.sessionId = uuid.v4();
  client.happnConnected = Date.now();
  const sessionData = {
    msgCount: 0,
    id: client.sessionId,
    protocol: 'happn', //we default to the oldest protocol
    happn: this.happn.services.system.getDescription(),
    headers: this.getClientUpgradeHeaders(client.headers),
    encrypted: client.request && client.request.connection.encrypted ? true : false,
    address: client.address || 'intra-proc',
    url: client.request && client.request.url
  };
  this.__sessions[client.sessionId] = {
    client: client,
    data: sessionData
  };
  client.on('error', err => {
    if (this.socketErrorWarning(err)) this.log.warn(`socket warning: ${err.message}`);
    else this.log.error('socket error', err);
    const errorObject = this.__safeSessionData(sessionData);
    this.log.json.warn(errorObject, 'client-socket-error');
    this.emit('client-socket-error', errorObject);
  });
  client.on('data', message => {
    setImmediate(() => {
      this.handleMessage(message, client);
    });
  });
  this.emit('connect', this.__safeSessionData(sessionData));
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
      CONSTANTS.SECURITY_DIRECTORY_CHANGE_EVENTS_COLLECTION.indexOf(whatHappnd) === -1
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
