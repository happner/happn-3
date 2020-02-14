const jwt = require('jwt-simple'),
  uuid = require('uuid'),
  sift = require('sift').default,
  EventEmitter = require('events').EventEmitter,
  util = require('util'),
  uuidv1 = require('uuid/v1');

var Promise = require('bluebird');

module.exports = SecurityService;

util.inherits(SecurityService, EventEmitter);

function SecurityService(opts) {
  this.log = opts.logger.createLogger('Security');
  this.log.$$TRACE('construct(%j)', opts);
  //security-data-changed event causes warning
  this.setMaxListeners(15);

  if (!opts.groupCache)
    opts.groupCache = {
      max: 300,
      maxAge: 0
    };

  if (!opts.userCache)
    opts.userCache = {
      max: 300,
      maxAge: 0
    };

  if (!opts.onBehalfOfCache)
    opts.onBehalfOfCache = {
      max: 1000,
      maxAge: 0
    };

  this.options = opts;

  this.__cache_revoked_sessions = null;
  this.__cache_session_activity = null;
  this.__cache_session_on_behalf_of = null;

  this.__dataHooks = [];
}

SecurityService.prototype.initialize = initialize;
SecurityService.prototype.stop = stop;

SecurityService.prototype.__initializeCheckPoint = __initializeCheckPoint;
SecurityService.prototype.__initializeUsers = __initializeUsers;
SecurityService.prototype.__initializeGroups = __initializeGroups;
SecurityService.prototype.__initializeSessionManagement = __initializeSessionManagement;
SecurityService.prototype.__initializeOnBehalfOfCache = __initializeOnBehalfOfCache;
SecurityService.prototype.__clearOnBehalfOfCache = __clearOnBehalfOfCache;
SecurityService.prototype.__ensureKeyPair = __ensureKeyPair;
SecurityService.prototype.__ensureAdminUser = __ensureAdminUser;
SecurityService.prototype.__initializeReplication = __initializeReplication;

SecurityService.prototype.deactivateSessionManagement = deactivateSessionManagement;
SecurityService.prototype.activateSessionActivity = activateSessionActivity;
SecurityService.prototype.activateSessionManagement = activateSessionManagement;

SecurityService.prototype.__loadRevokedSessions = __loadRevokedSessions;
SecurityService.prototype.deactivateSessionActivity = deactivateSessionActivity;
SecurityService.prototype.__loadSessionActivity = __loadSessionActivity;
SecurityService.prototype.__checkRevocations = __checkRevocations;

SecurityService.prototype.revokeSession = revokeSession;
SecurityService.prototype.listRevokedSessions = listRevokedSessions;
SecurityService.prototype.sessionFromRequest = sessionFromRequest;
SecurityService.prototype.tokenFromRequest = tokenFromRequest;
SecurityService.prototype.restoreSession = restoreSession;
SecurityService.prototype.__logSessionActivity = __logSessionActivity;

SecurityService.prototype.__listCache = __listCache;
SecurityService.prototype.listSessionActivity = listSessionActivity;
SecurityService.prototype.listActiveSessions = Promise.promisify(listActiveSessions);

SecurityService.prototype.offDataChanged = offDataChanged;
SecurityService.prototype.onDataChanged = onDataChanged;
SecurityService.prototype.emitChanges = emitChanges;
SecurityService.prototype.resetSessionPermissions = resetSessionPermissions;
SecurityService.prototype.dataChanged = dataChanged;
SecurityService.prototype.__replicateDataChanged = __replicateDataChanged;

//Auditing methods
//-----------------------------

SecurityService.prototype.getAuditData = getAuditData;
SecurityService.prototype.getAuditPath = getAuditPath;
SecurityService.prototype.doAudit = Promise.promisify(doAudit);

//Request authorization methods
//-----------------------------

SecurityService.prototype.processAuthorize = processAuthorize;
SecurityService.prototype.processAuthorizeUnsecure = processAuthorizeUnsecure;
SecurityService.prototype.authorize = authorize;
SecurityService.prototype.authorizeOnBehalfOf = authorizeOnBehalfOf;
SecurityService.prototype.__getOnBehalfOfSession = __getOnBehalfOfSession;

//Digest Authentication methods
//-----------------------------

SecurityService.prototype.processNonceRequest = processNonceRequest;
//creates a nonce, then saves the nonce and the requestors public key to the nonce cache for future verification
SecurityService.prototype.createAuthenticationNonce = createAuthenticationNonce;
SecurityService.prototype.verifyAuthenticationDigest = verifyAuthenticationDigest;

SecurityService.prototype.processUnsecureLogin = processUnsecureLogin;
SecurityService.prototype.processLogin = processLogin;
SecurityService.prototype.login = login;
SecurityService.prototype.adminLogin = adminLogin;
SecurityService.prototype.__loginOK = __loginOK;
SecurityService.prototype.__checkLockedOut = __checkLockedOut;
SecurityService.prototype.__loginFailed = __loginFailed;

SecurityService.prototype.AccessDeniedError = AccessDeniedError;

SecurityService.prototype.decodeToken = decodeToken;
SecurityService.prototype.generateToken = generateToken;

SecurityService.prototype.generatePermissionSetKey = generatePermissionSetKey;
SecurityService.prototype.generateEmptySession = generateEmptySession;
SecurityService.prototype.generateSession = generateSession;
SecurityService.prototype.matchPassword = matchPassword;

//takes a login request - and matches the request to a session, the session is then encoded with its associated policies into a JWT token. There are 2 policies, 1 a stateful one and 0 a stateless one, they can only be matched back during session requests.
SecurityService.prototype.__profileSession = __profileSession;
SecurityService.prototype.__cache_Profiles = null;
SecurityService.prototype.__initializeProfiles = __initializeProfiles;

//Utility methods
//-----------------------------

SecurityService.prototype.validateName = validateName;
SecurityService.prototype.checkOverwrite = checkOverwrite;
SecurityService.prototype.serializeAll = serializeAll;
SecurityService.prototype.serialize = serialize;

SecurityService.prototype.checkDisableDefaultAdminNetworkConnections = checkDisableDefaultAdminNetworkConnections;

let AUTHORIZE_ACTIONS = ['get', 'set', 'on', 'remove'];

function initialize(config, callback) {
  if (this.happn.config.disableDefaultAdminNetworkConnections === true)
    config.disableDefaultAdminNetworkConnections = true;

  this.cacheService = this.happn.services.cache;
  this.dataService = this.happn.services.data;
  this.cryptoService = this.happn.services.crypto;
  this.sessionService = this.happn.services.session;
  this.utilsService = this.happn.services.utils;
  this.errorService = this.happn.services.error;

  this.pathField = this.dataService.pathField; //backward compatible for allowing mongo plugin, which uses an actual path field

  if (!config.sessionTokenSecret) config.sessionTokenSecret = uuid.v4() + uuid.v4();

  if (!config.defaultNonceTTL) config.defaultNonceTTL = 60000;
  //1 minute
  else config.defaultNonceTTL = this.happn.services.utils.toMilliseconds(config.defaultNonceTTL);

  if (!config.logSessionActivity) config.logSessionActivity = false;

  if (!config.sessionActivityTTL) config.sessionActivityTTL = 60000 * 60 * 24;
  //1 day
  else
    config.sessionActivityTTL = this.happn.services.utils.toMilliseconds(config.sessionActivityTTL);

  if (typeof config.pbkdf2Iterations !== 'number') config.pbkdf2Iterations = 10000;
  if (typeof config.accountLockout !== 'object') config.accountLockout = {};
  if (config.accountLockout.enabled == null) config.accountLockout.enabled = true;

  if (config.accountLockout.enabled) {
    this.__locks = this.happn.services.cache.new('security_account_lockout');

    if (!config.accountLockout.attempts) config.accountLockout.attempts = 4;
    if (!config.accountLockout.retryInterval) config.accountLockout.retryInterval = 60 * 1000 * 10; //10 minutes
  }

  this.config = config;

  if (!this.config.secure) this.processAuthorize = this.processAuthorizeUnsecure;

  this.__initializeGroups(config)
    .then(() => {
      return this.__initializeCheckPoint(config);
    })
    .then(() => {
      return this.__initializeUsers(config);
    })
    .then(() => {
      return this.__initializeProfiles(config);
    })
    .then(() => {
      return this.__ensureKeyPair(config);
    })
    .then(() => {
      return this.__initializeSessionManagement(config);
    })
    .then(() => {
      return this.__initializeOnBehalfOfCache(config);
    })
    .then(() => {
      return this.__ensureAdminUser(config);
    })
    .then(() => {
      this.__initializeReplication(config);
      callback();
    });
}

function getAuditData(message) {
  let path = message.request.path ? message.request.path : message.request.action;

  if (path.indexOf('/ALL@') === 0) path = path.replace('/ALL@', '');
  if (path.indexOf('/SET@') === 0) path = path.replace('/SET@', '');
  if (path.indexOf('/REMOVE@') === 0) path = path.replace('/REMOVE@', '');

  if (
    this.config.audit.paths &&
    !this.happn.services.utils.wildcardMatchMultiple(this.config.audit.paths, path)
  )
    return null;

  let data = {};

  if (message.request.action === 'get') {
    //dont need to return all the data
    if (Array.isArray(message.response)) data.response = message.response.length;
    else data.response = 1;
  } else data.response = message.response;

  data.session = {
    type: message.session.type,
    username: message.session.user.username,
    protocol: message.session.protocol
  };

  return data;
}

function getAuditPath(message) {
  let requestPath = message.request.path ? message.request.path : null;
  let auditPath = '/_AUDIT/';

  if (requestPath) {
    if (requestPath.indexOf('@') > -1) requestPath = requestPath.split('@')[1]; //take out 'on' event type specifiers, ie SET@

    requestPath = this.happn.services.utils.replacePrefix(requestPath, '/');
    requestPath = this.happn.services.utils.replaceSuffix(requestPath, '/');

    auditPath += requestPath + '/';
  }

  auditPath += message.request.action;

  return auditPath;
}

function doAudit(message, callback) {
  let auditData = this.getAuditData(message);
  //path, data, options, callback
  if (auditData != null) {
    let auditPath = this.getAuditPath(message); ///_AUDIT/[message.request.path]/[message.request.action] ie: /_AUDIT/users/all/*/get

    this.dataService.upsert(
      auditPath,
      auditData,
      {
        set_type: 'sibling'
      },
      e => {
        if (e)
          return callback(
            this.happn.services.error.SystemError('security audit failed', e.toString())
          );

        return callback(null, message);
      }
    );
  } else callback(null, message);
}

function processUnsecureLogin(message, callback) {
  let session = this.generateEmptySession(message.session.id);
  session.info = message.request.data.info;
  message.response = {
    data: this.happn.services.session.attachSession(message.session.id, session)
  };

  return callback(null, message);
}

function processLogin(message, callback) {
  let credentials = message.request.data;
  let sessionId = null;
  if (message.session) sessionId = message.session.id;

  this.login(credentials, sessionId, message.request, (e, session) => {
    if (e) return callback(e);

    let attachedSession = this.happn.services.session.attachSession(sessionId, session);
    if (!attachedSession)
      return callback(new Error('session with id ' + sessionId + ' dropped while logging in'));
    let decoupledSession = this.happn.services.utils.clone(attachedSession);
    delete decoupledSession.user.groups; //needlessly large list of security groups passed back, groups are necessary on server side though

    message.response = {
      data: decoupledSession
    };

    callback(null, message);
  });
}

function processAuthorizeUnsecure(message, callback) {
  return callback(null, message);
}

function processAuthorize(message, callback) {
  if (AUTHORIZE_ACTIONS.indexOf(message.request.action) === -1) return callback(null, message);

  const authPath = message.request.path.replace(/^\/(?:REMOVE|SET|ALL)@/, '');

  if (
    message.request.options &&
    message.request.options.onBehalfOf &&
    message.request.options.onBehalfOf !== '_ADMIN'
  )
    return this.authorizeOnBehalfOf(
      message.session,
      authPath,
      message.request.action,
      message.request.options.onBehalfOf,
      (e, authorized, reason, onBehalfOfSession) => {
        if (e) return callback(e);
        if (!authorized) {
          if (!reason) reason = '';
          reason += ' request on behalf of: ' + message.request.options.onBehalfOf;
          return callback(this.happn.services.error.AccessDeniedError('unauthorized', reason));
        }
        message.session = onBehalfOfSession;
        callback(null, message);
      }
    );

  return this.authorize(
    message.session,
    authPath,
    message.request.action,
    (e, authorized, reason) => {
      if (e) return callback(e);
      if (!authorized)
        return callback(this.happn.services.error.AccessDeniedError('unauthorized', reason));
      callback(null, message);
    }
  );
}

function processNonceRequest(message, callback) {
  return this.createAuthenticationNonce(message.request.data, (e, nonce) => {
    if (e) return callback(e);
    message.response = {
      nonce: nonce,
      data: {
        nonce: nonce
      } //happn-2 backward compatability
    };
    return callback(null, message);
  });
}

function AccessDeniedError(message, reason) {
  return this.happn.services.error.AccessDeniedError(message, reason);
}

function __ensureKeyPair(config) {
  return new Promise((resolve, reject) => {
    this.dataService.get('/_SYSTEM/_SECURITY/_SETTINGS/KEYPAIR', {}, (e, response) => {
      if (e) return reject(e);
      if (!response) {
        if (!config.keyPair)
          config.keyPair = this.cryptoService.serializeKeyPair(this.cryptoService.createKeyPair());
        if (typeof config.keyPair !== 'string')
          config.keyPair = this.cryptoService.serializeKeyPair(config.keyPair);

        return this.dataService.upsert(
          '/_SYSTEM/_SECURITY/_SETTINGS/KEYPAIR',
          config.keyPair,
          {},
          (e, result) => {
            if (e) return reject(e);
            this._keyPair = this.cryptoService.deserializeKeyPair(result.data.value);
            resolve();
          }
        );
      }

      try {
        this._keyPair = this.cryptoService.deserializeKeyPair(response.data.value);
        resolve();
      } catch (deserializeFailure) {
        //Do nothing, try things a different way
        let transformedKeyPair = this.cryptoService.serializeKeyPair(
          this.cryptoService.keyPairFromWIF(response.data.value)
        );
        return this.dataService.upsert(
          '/_SYSTEM/_SECURITY/_SETTINGS/KEYPAIR',
          transformedKeyPair,
          {},
          upsertFailed => {
            if (upsertFailed) return reject(upsertFailed);
            this._keyPair = this.cryptoService.deserializeKeyPair(transformedKeyPair);
            resolve();
          }
        );
      }
    });
  });
}

function __ensureAdminUser(config) {
  return new Promise((resolve, reject) => {
    if (!config.adminUser)
      config.adminUser = {
        custom_data: {}
      };
    if (!config.adminGroup)
      config.adminGroup = {
        custom_data: {
          description: 'the default administration group for happn'
        }
      };

    config.adminUser.username = '_ADMIN';
    config.adminGroup.name = '_ADMIN';

    config.adminGroup.permissions = {
      '*': {
        actions: ['*']
      }
    };

    this.newDB = false;

    this.users.getUser('_ADMIN', (e, foundUser) => {
      if (e) return reject(e);
      if (foundUser) return resolve();
      if (!config.adminUser.password) config.adminUser.password = 'happn';

      //group, options, callback
      this.groups.__upsertGroup(config.adminGroup, {}, (e, adminGroup) => {
        if (e) return reject(e);
        this.users.__upsertUser(config.adminUser, {}, (e, adminUser) => {
          if (e) return reject(e);
          this.groups.linkGroup(adminGroup, adminUser, e => {
            if (e) return reject(e);
            resolve();
          });
        });
      });
    });
  });
}

function __initializeReplication() {
  if (!this.happn.services.replicator) return;

  this.happn.services.replicator.on('/security/dataChanged', (payload, self) => {
    if (self) return;

    let whatHappnd = payload.whatHappnd;
    let changedData = payload.changedData;
    let additionalInfo = payload.additionalInfo;

    // flag as learned from replication - to not replicate again
    changedData.replicated = true;
    this.dataChanged(whatHappnd, changedData, additionalInfo);
  });
}

function __initializeCheckPoint(config) {
  return new Promise((resolve, reject) => {
    let checkpoint = require('./checkpoint');
    this.checkpoint = new checkpoint({
      logger: this.log
    });

    Object.defineProperty(this.checkpoint, 'happn', {
      value: this.happn
    });

    this.checkpoint.initialize(config, this, e => {
      if (e) return reject(e);
      resolve();
    });
  });
}

function __initializeUsers(config) {
  return new Promise((resolve, reject) => {
    let SecurityUsers = require('./users');
    this.users = new SecurityUsers({
      logger: this.log
    });
    Object.defineProperty(this.users, 'happn', {
      value: this.happn
    });
    Object.defineProperty(this.users, 'groups', {
      value: this.groups
    });
    this.users.initialize(config, this, e => {
      if (e) return reject(e);
      resolve();
    });
  });
}

function __initializeGroups(config) {
  return new Promise((resolve, reject) => {
    let SecurityGroups = require('./groups');

    this.groups = new SecurityGroups({
      logger: this.log
    });

    Object.defineProperty(this.groups, 'happn', {
      value: this.happn
    });

    this.groups.initialize(config, this, e => {
      if (e) return reject(e);
      resolve();
    });
  });
}

function __clearOnBehalfOfCache() {
  return new Promise(resolve => {
    if (this.__cache_session_on_behalf_of) this.__cache_session_on_behalf_of.clear();
    resolve();
  });
}

function __initializeOnBehalfOfCache() {
  return new Promise(resolve => {
    if (!this.config.secure) return resolve();
    if (this.__cache_session_on_behalf_of) return resolve();
    this.__cache_session_on_behalf_of = this.cacheService.new(
      'cache_session_on_behalf_of',
      this.options.onBehalfOfCache
    );
    resolve();
  });
}

function __initializeSessionManagement(config) {
  return new Promise((resolve, reject) => {
    if (!this.config.secure) return resolve();
    if (!config.activateSessionManagement)
      return this.__loadRevokedSessions(e => {
        if (e) return reject(e);
        resolve();
      });
    this.activateSessionManagement(config.logSessionActivity, e => {
      if (e) return reject(e);
      resolve();
    });
  });
}

function activateSessionActivity(callback) {
  return this.__loadSessionActivity(callback);
}

function activateSessionManagement(logSessionActivity, callback) {
  if (typeof logSessionActivity === 'function') {
    callback = logSessionActivity;
    logSessionActivity = false;
  }

  if (!this.config.secure)
    return callback(new Error('session management must run off a secure instance'));
  this.__sessionManagementActive = true;

  this.__loadRevokedSessions(e => {
    if (e) return callback(e);
    if (!logSessionActivity) return callback();
    this.__loadSessionActivity(callback);
  });
}

function deactivateSessionManagement(logSessionActivity, callback) {
  if (typeof logSessionActivity === 'function') {
    callback = logSessionActivity;
    logSessionActivity = false;
  }

  if (!this.config.secure)
    return callback(new Error('session management must run off a secure instance'));

  this.__sessionManagementActive = false;

  if (logSessionActivity) this.deactivateSessionActivity(true, callback);
  else callback();
}

function __loadRevokedSessions(callback) {
  if (this.__cache_revoked_sessions) return callback();

  let config = {
    type: 'persist',
    cache: {
      dataStore: this.dataService
    }
  };

  this.__cache_revoked_sessions = this.cacheService.new('cache_revoked_sessions', config);
  this.__cache_revoked_sessions.sync(callback);
}

function deactivateSessionActivity(clear, callback) {
  if (typeof clear === 'function') {
    callback = clear;
    clear = false;
  }

  if (!this.__cache_session_activity) return callback();
  this.config.logSessionActivity = false;
  if (clear) return this.__cache_session_activity.clear(callback);
  callback();
}

function __loadSessionActivity(callback) {
  if (!this.config.logSessionActivity) this.config.logSessionActivity = true;

  if (this.__cache_session_activity) return callback();

  let config = {
    type: 'persist',
    cache: {
      dataStore: this.dataService,
      defaultTTL: this.config.sessionActivityTTL
    }
  };

  this.__cache_session_activity = this.cacheService.new('cache_session_activity', config);
  this.__cache_session_activity.sync(callback);
}

function __checkRevocations(sessionId, callback, notFromTokenLogin) {
  if (!this.__cache_revoked_sessions) return callback(null, true);
  if (sessionId == null || sessionId === undefined)
    return callback(new Error('sessionId not defined'));

  this.__cache_revoked_sessions.get(sessionId, function(e, item) {
    if (e) return callback(e);
    if (item == null) return callback(null, true);
    if (notFromTokenLogin)
      return callback(null, false, `session with id ${sessionId} has been revoked`);
    callback(null, false, `session from origin session id ${sessionId} has been revoked`);
  });
}

function revokeSession(session, reason, callback) {
  if (typeof reason === 'function') {
    callback = reason;
    reason = 'SYSTEM';
  }

  if (session == null || session === undefined) return callback(new Error('session not defined'));
  let decoded = session.token ? this.decodeToken(session.token) : this.decodeToken(session);

  let ttl = 0;
  let noTTL = false;

  if (!decoded.policy[0].ttl || decoded.policy[0].ttl === Infinity) noTTL = true;
  else ttl += decoded.policy[0].ttl;

  if (!decoded.policy[1].ttl || decoded.policy[1].ttl === Infinity) noTTL = true;
  else if (decoded.policy[1].ttl > ttl) ttl = decoded.policy[1].ttl;

  if (noTTL) {
    this.log.warn('revoking a session without a ttl means it stays in the revocation list forever');
    ttl = 0;
  }

  this.__cache_revoked_sessions.set(
    session.tokenOriginSessionId || session.id,
    {
      reason: reason,
      id: session.id,
      timestamp: Date.now(),
      ttl
    },
    { ttl },
    e => {
      session.ttl = ttl;
      session.reason = reason;
      if (!e)
        this.dataChanged(
          'session-revoked',
          session,
          `session with id ${session.id}  and origin ${
            session.tokenOriginSessionId ? session.tokenOriginSessionId : session.id
          } revoked`
        );
      callback(e);
    }
  );
}

function tokenFromRequest(req, options) {
  if (!options) options = {};

  if (!options.tokenName) options.tokenName = 'happn_token';

  if (!options.cookieName && this.config.cookieName) options.cookieName = this.config.cookieName;

  if (!options.cookieName) options.cookieName = 'happn_token';

  let token = req.cookies.get(options.cookieName);

  if (token) return token;

  token = require('url').parse(req.url, true).query[options.tokenName];

  if (token) return token;

  //look in the auth headers
  if (req.headers.authorization != null) {
    let authHeader = req.headers.authorization.split(' ');
    //bearer token
    if (authHeader[0].toLowerCase() === 'bearer') token = authHeader[1];
  }

  return token;
}

function sessionFromRequest(req, options) {
  if (req.happn_session != null) return req.happn_session; //attached somewhere else up the call stack

  let token = this.tokenFromRequest(req, options);

  if (!token) return null;

  try {
    let session = this.happn.services.security.decodeToken(token);
    session.type = 0;
    session.happn = this.happn.services.system.getDescription();
    return session;
  } catch (e) {
    this.log.warn('failed decoding session token from request');
    return null;
  }
}

function restoreSession(sessionId, callback) {
  if (!this.__sessionManagementActive)
    return callback(new Error('session management not activated'));

  //in case someone passed in the session
  if (sessionId.id) sessionId = sessionId.id;
  this.__cache_revoked_sessions.get(sessionId, (e, session) => {
    if (e) return callback(e);
    if (!session) return callback();
    this.__cache_revoked_sessions.remove(sessionId, e => {
      if (!e)
        this.dataChanged('session-restored', session, `session with id ${session.id} restored`);
      callback(e);
    });
  });
}

function __logSessionActivity(sessionId, path, action, err, authorized, reason, callback) {
  let activityInfo = {
    path: path,
    action: action,
    id: sessionId,
    error: err ? err.toString() : '',
    authorized: authorized,
    reason: reason
  };

  this.__cache_session_activity.set(sessionId, activityInfo, callback);
}

function __listCache(cacheName, filter, callback) {
  if (typeof filter === 'function') {
    callback = filter;
    filter = null;
  }

  if (!this[cacheName]) return callback('cache with name ' + cacheName + ' does not exist');

  this[cacheName].all((e, allItems) => {
    if (e) return callback(e);

    try {
      if (filter) allItems = this.happn.services.cache.filterCacheItems(filter, allItems);
      return callback(null, allItems);
    } catch (filterFailed) {
      return callback(filterFailed);
    }
  });
}

function listSessionActivity(filter, callback) {
  if (typeof filter === 'function') {
    callback = filter;
    filter = null;
  }

  if (!this.config.logSessionActivity)
    return callback(new Error('session activity logging not activated'));
  return this.__listCache('__cache_session_activity', filter, callback);
}

function listActiveSessions(filter, callback) {
  if (typeof filter === 'function') {
    callback = filter;
    filter = null;
  }

  if (!this.__sessionManagementActive)
    return callback(new Error('session management not activated'));
  this.happn.services.session.__activeSessions.all(filter, callback);
}

function listRevokedSessions(filter, callback) {
  if (typeof filter === 'function') {
    callback = filter;
    filter = null;
  }

  if (!this.__sessionManagementActive)
    return callback(new Error('session management not activated'));
  return this.__cache_revoked_sessions.all(filter, callback);
}

function offDataChanged(index) {
  delete this.__dataHooks[index];
}

function onDataChanged(hook) {
  this.__dataHooks.push(hook);
  return this.__dataHooks.length - 1;
}

function getEffectedSession(sessionData, causeSubscriptionsRefresh) {
  return {
    id: sessionData.id,
    username: sessionData.user ? sessionData.user.username : 'unknown',
    isToken: sessionData.isToken == null ? false : sessionData.isToken,
    permissionSetKey: sessionData.permissionSetKey,
    user: sessionData.user,
    happn: sessionData.happn,
    protocol: sessionData.protocol,
    causeSubscriptionsRefresh: causeSubscriptionsRefresh
  };
}

function resetSessionPermissions(whatHappnd, changedData) {
  return new Promise((resolve, reject) => {
    let effectedSessions = [];
    let groupName;

    if (
      [
        'link-group',
        'unlink-group',
        'delete-user',
        'delete-group',
        'upsert-group',
        'permission-removed',
        'permission-upserted',
        'upsert-user',
        'session-revoked',
        'session-restored'
      ].indexOf(whatHappnd) === -1
    )
      return resolve();

    if (whatHappnd === 'session-revoked') {
      let revokedSession = getEffectedSession(changedData, true);
      effectedSessions.push(revokedSession);
      if (!changedData.replicated) {
        //disconnect the revoked session
        this.sessionService.disconnectSession(revokedSession.id, null, {
          reason: 'session-revoked'
        });
        return resolve(effectedSessions); //means this is the originating process
      }
      //means we are getting a replication from elsewhere in the cluster
      return this.__cache_revoked_sessions.set(
        changedData.tokenOriginSessionId || changedData.id,
        { reason: changedData.reason, id: changedData.id },
        { noPersist: true, ttl: changedData.ttl },
        e => {
          if (e) return reject(e);
          resolve(effectedSessions);
        }
      );
    }

    if (whatHappnd === 'session-restored') {
      effectedSessions.push(getEffectedSession(changedData, true));
      //remove the restored session without updating the db, the originating call to restoreSession already did this
      return this.__cache_revoked_sessions.remove(
        changedData.id,
        { noPersist: changedData.replicated },
        function(e) {
          if (e) return reject(e);
          resolve(effectedSessions);
        }
      );
    }

    this.sessionService.each(
      (sessionData, sessionCallback) => {
        if (!sessionData.user) return sessionCallback();

        if (whatHappnd === 'permission-removed') {
          if (sessionData.user.groups[changedData.groupName] != null) {
            //all we need to do, permissionSetKey remains the same (as it is the ordered list of linked groups) - all caches are cleared, but effected sessions are different
            effectedSessions.push(getEffectedSession(sessionData, true));
          }
        }

        if (whatHappnd === 'permission-upserted') {
          if (sessionData.user.groups[changedData.groupName] != null) {
            //all we need to do, permissionSetKey remains the same (as it is the ordered list of linked groups) - all caches are cleared, but effected sessions are different
            effectedSessions.push(getEffectedSession(sessionData, true));
          }
        }

        if (whatHappnd === 'link-group') {
          if (
            changedData._meta.path.indexOf(
              '/_SYSTEM/_SECURITY/_USER/' + sessionData.user.username + '/_USER_GROUP/'
            ) === 0
          ) {
            groupName = changedData._meta.path.replace(
              '/_SYSTEM/_SECURITY/_USER/' + sessionData.user.username + '/_USER_GROUP/',
              ''
            );

            sessionData.user.groups[groupName] = changedData;
            sessionData.permissionSetKey = this.generatePermissionSetKey(sessionData.user);
            effectedSessions.push(getEffectedSession(sessionData, true));
          }
        }

        if (whatHappnd === 'upsert-group') {
          if (sessionData.user.groups[changedData.name]) {
            //cause a subscription refresh if the group permissions were also submitted
            if (changedData.permissions && Object.keys(changedData.permissions).length > 0)
              effectedSessions.push(getEffectedSession(sessionData, true));
            else effectedSessions.push(getEffectedSession(sessionData, false));
          }
        }

        if (whatHappnd === 'unlink-group') {
          if (
            changedData.path.indexOf(
              '/_SYSTEM/_SECURITY/_USER/' + sessionData.user.username + '/_USER_GROUP/'
            ) === 0
          ) {
            groupName = changedData.path.replace(
              '/_SYSTEM/_SECURITY/_USER/' + sessionData.user.username + '/_USER_GROUP/',
              ''
            );
            delete sessionData.user.groups[groupName];
            sessionData.permissionSetKey = this.generatePermissionSetKey(sessionData.user);
            effectedSessions.push(getEffectedSession(sessionData, true));
          }
        }

        if (whatHappnd === 'delete-user') {
          let userName = changedData.obj._meta.path.replace('/_SYSTEM/_SECURITY/_USER/', '');

          if (sessionData.user.username === userName) {
            this.sessionService.disconnectSession(sessionData.id, null, {
              reason: 'security directory update: user deleted'
            });
          }
        }

        if (whatHappnd === 'delete-group') {
          if (sessionData.user.groups[changedData.obj.name]) {
            delete sessionData.user.groups[changedData.obj.name];
            sessionData.permissionSetKey = this.generatePermissionSetKey(sessionData.user);

            effectedSessions.push(getEffectedSession(sessionData, true));
          }
        }

        if (whatHappnd === 'upsert-user') {
          if (sessionData.user.username === changedData.username) {
            return this.users.getUser(changedData.username, (e, user) => {
              if (e) return sessionCallback(e);
              sessionData.user = user;
              effectedSessions.push(getEffectedSession(sessionData, true));
              sessionCallback();
            });
          }
        }

        sessionCallback();
      },
      e => {
        if (e) return reject(e);
        resolve(effectedSessions);
      }
    );
  });
}

function emitChanges(whatHappnd, changedData, effectedSessions) {
  return new Promise((resolve, reject) => {
    try {
      let changedDataSerialized = null;
      let effectedSessionsSerialized = null;

      if (changedData) changedDataSerialized = JSON.stringify(changedData);
      if (effectedSessions) effectedSessionsSerialized = JSON.stringify(effectedSessions);

      this.__dataHooks.every(hook => {
        return hook.apply(hook, [
          whatHappnd,
          JSON.parse(changedDataSerialized),
          JSON.parse(effectedSessionsSerialized)
        ]);
      });

      this.emit('security-data-changed', {
        whatHappnd: whatHappnd,
        changedData: changedData,
        effectedSessions: effectedSessions
      });

      resolve();
    } catch (e) {
      reject(e);
    }
  });
}

function dataChanged(whatHappnd, changedData, additionalInfo, callback) {
  if (typeof additionalInfo === 'function') {
    callback = additionalInfo;
    additionalInfo = undefined;
  }

  this.users
    .clearCaches()
    .then(() => {
      return this.__clearOnBehalfOfCache();
    })
    .then(() => {
      return this.groups.clearCaches();
    })
    .then(() => {
      return this.resetSessionPermissions(whatHappnd, changedData, additionalInfo);
    })
    .then(effectedSessions => {
      return this.checkpoint.clearCaches(effectedSessions);
    })
    .then(effectedSessions => {
      return new Promise((resolve, reject) => {
        if (this.happn.services.subscription)
          this.happn.services.subscription
            .securityDirectoryChanged(whatHappnd, changedData, effectedSessions, additionalInfo)
            .then(() => {
              resolve(effectedSessions);
            })
            .catch(reject);
        else resolve(effectedSessions);
      });
    })
    .then(effectedSessions => {
      return new Promise((resolve, reject) => {
        if (this.happn.services.session)
          this.happn.services.session
            .securityDirectoryChanged(whatHappnd, changedData, effectedSessions, additionalInfo)
            .then(() => {
              resolve(effectedSessions);
            })
            .catch(reject);
        else resolve(effectedSessions);
      });
    })
    .then(effectedSessions => {
      return this.emitChanges(whatHappnd, changedData, effectedSessions, additionalInfo);
    })
    .then(() => {
      return this.__replicateDataChanged(whatHappnd, changedData, additionalInfo);
    })
    .then(() => {
      if (callback) callback();
    })
    .catch(e => {
      this.happn.services.error.handleFatal('failure updating cached security data', e);
    });
}

function __replicateDataChanged(whatHappnd, changedData, additionalInfo) {
  let replicator = this.happn.services.replicator;
  if (!replicator) return;
  if (changedData.replicated) return; // don't re-replicate

  return new Promise((resolve, reject) => {
    replicator.send(
      '/security/dataChanged',
      {
        whatHappnd: whatHappnd,
        changedData: changedData,
        additionalInfo: additionalInfo
      },
      e => {
        if (e) {
          if (e.message === 'Replicator not ready') {
            // means not connected to self (or other peers in cluster)
            // not a problem, there will be no user/group changes to replicate
            // (other than the initial admin user create)
            // - no clients connected to this node
            // - no component start methods modifying users
            //   (the start methods only run after cluster is up)
            return resolve();
          }
          return reject(e);
        }
        resolve();
      }
    );
  });
}

function decodeToken(token) {
  try {
    if (!token) throw new Error('missing session token');

    let decoded = jwt.decode(token, this.config.sessionTokenSecret);
    let unpacked = require('jsonpack').unpack(decoded);

    return unpacked;
  } catch (e) {
    throw new Error('invalid session token');
  }
}

function generatePermissionSetKey(user) {
  return require('crypto')
    .createHash('sha1')
    .update(
      Object.keys(user.groups)
        .sort()
        .join('/')
    )
    .digest('base64');
}

function generateEmptySession(id) {
  return { id: id || uuid.v4() };
}

function __profileSession(session) {
  session.policy = {
    0: null,
    1: null
  };

  //we dont want to mess around with the actual sessions type
  //it is an unknown at this point
  let decoupledSession = this.happn.services.utils.clone(session);

  this.__cache_Profiles.forEach(profile => {
    let filter = profile.session;
    [0, 1].forEach(function(sessionType) {
      if (session.policy[sessionType] != null) return;
      decoupledSession.type = sessionType;
      if (sift(filter, [decoupledSession]).length === 1)
        session.policy[sessionType] = profile.policy;
    });
  });

  if (session.policy[0] == null && session.policy[1] == null)
    throw new Error('unable to match session with a profile'); //this should never happen
}

function generateToken(session) {
  let decoupledSession = this.happn.services.utils.clone(session);

  decoupledSession.type = 0; //always stateless
  decoupledSession.isToken = true;

  delete decoupledSession.permissionSetKey; //this should never be used as it may get out of sync

  delete decoupledSession.user; //also not to be used later on as it may go out of sync

  if (session.user && session.user.username) decoupledSession.username = session.user.username;

  let packed = require('jsonpack').pack(decoupledSession);

  return jwt.encode(packed, this.config.sessionTokenSecret);
}

function generateSession(user, sessionId, credentials, tokenOriginSessionId) {
  let session = this.generateEmptySession(sessionId);

  session.info = credentials.info;
  session.type = 1; //stateful
  session.user = user;
  session.timestamp = Date.now();
  session.tokenOriginSessionId = tokenOriginSessionId;

  session.isEncrypted = credentials.isEncrypted ? true : false;

  session.origin = this.happn.services.system.name;

  this.__profileSession(session); //session ttl, activity threshold and user effective permissions are set here

  session.permissionSetKey = this.generatePermissionSetKey(session.user, session);

  session.token = this.generateToken(session);

  // It is not possible for the login (websocket call) to assign the session token (cookie) server side,
  // so the cookie is therefore created in the browser upon login success.
  // It is necessary to include how to make the cookie in the login reply via this session object.
  if (this.config.cookieName) session.cookieName = this.config.cookieName;
  if (this.config.cookieDomain) session.cookieDomain = this.config.cookieDomain;

  //if (session.isEncrypted) session.secret = require('shortid').generate();
  if (session.isEncrypted) {
    let sec = uuidv1();
    session.secret = sec.replace(/-/g, '');
  }

  return session;
}

//so external services can use this
function matchPassword(password, hash, callback) {
  this.cryptoService.verifyHash(password, hash, this.config.pbkdf2Iterations, callback);
}

function __initializeProfiles(config) {
  return new Promise((resolve, reject) => {
    try {
      if (!config.profiles) config.profiles = [];

      config.profiles.push({
        name: 'default-browser', // this is the default underlying profile for stateful sessions
        session: {
          $and: [
            {
              info: {
                _browser: {
                  $eq: true
                }
              }
            }
          ]
        },
        policy: {
          ttl: '7 days', //a week
          inactivity_threshold: '1 hour'
        }
      });

      config.profiles.push({
        name: 'default-stateful', // this is the default underlying profile for stateful sessions
        session: {
          $and: [
            {
              type: {
                $eq: 1
              }
            }
          ]
        },
        policy: {
          ttl: 0, //session never goes stale
          inactivity_threshold: Infinity
        }
      });

      config.profiles.push({
        name: 'default-stateless', // this is the default underlying profile for stateless sessions (REST)
        session: {
          $and: [
            {
              type: {
                $eq: 0
              }
            }
          ]
        },
        policy: {
          ttl: 0, //session never goes stale
          inactivity_threshold: Infinity
        }
      });

      config.profiles.forEach(profile => {
        if (profile.policy.ttl && profile.policy.ttl !== Infinity)
          profile.policy.ttl = this.happn.services.utils.toMilliseconds(profile.policy.ttl);
        if (profile.policy.inactivity_threshold && profile.policy.ttl !== Infinity)
          profile.policy.inactivity_threshold = this.happn.services.utils.toMilliseconds(
            profile.policy.inactivity_threshold
          );
      });

      this.__cache_Profiles = config.profiles;

      resolve();
    } catch (e) {
      reject(e);
    }
  });
}

function __loginOK(credentials, user, sessionId, callback, tokenOriginSessionId) {
  delete user.password;
  if (this.__locks) this.__locks.removeSync(user.username); //remove previous locks
  callback(null, this.generateSession(user, sessionId, credentials, tokenOriginSessionId));
}

function __checkLockedOut(username) {
  if (!username || !this.config.accountLockout || !this.config.accountLockout.enabled) return false;

  let existingLock = this.__locks.getSync(username);

  return existingLock != null && existingLock.attempts >= this.config.accountLockout.attempts;
}

function __loginFailed(username, specificMessage, e, callback, overrideLockout) {
  let message = 'Invalid credentials';

  if (specificMessage) message = specificMessage;

  if (e) {
    if (e.message) message = message + ': ' + e.message;
    else message = message + ': ' + e.toString();
  }

  if (this.config.accountLockout && this.config.accountLockout.enabled && !overrideLockout) {
    let currentLock = this.__locks.getSync(username);

    if (!currentLock)
      currentLock = {
        attempts: 0
      };

    currentLock.attempts++;

    this.__locks.setSync(username, currentLock, {
      ttl: this.config.accountLockout.retryInterval
    });

    return callback(this.happn.services.error.InvalidCredentialsError(message));
  }

  return callback(this.happn.services.error.InvalidCredentialsError(message));
}

function adminLogin(sessionId, callback) {
  let credentials = { username: '_ADMIN' };

  this.users.getUser(credentials.username, (e, adminUser) => {
    if (e) return callback(e);

    return this.__loginOK(credentials, adminUser, sessionId, callback);
  });
}

function checkDisableDefaultAdminNetworkConnections(credentials) {
  return !(this.config.disableDefaultAdminNetworkConnections && credentials.token);
}

function login(credentials, sessionId, request, callback) {
  let username = credentials.username ? credentials.username : '';

  if (typeof sessionId === 'function') {
    callback = sessionId;
    sessionId = null;
  }

  if (
    !((credentials.username && (credentials.password || credentials.digest)) || credentials.token)
  )
    return callback(this.happn.services.error.InvalidCredentialsError('Invalid credentials'));

  if (
    credentials.username === '_ADMIN' &&
    this.config.disableDefaultAdminNetworkConnections === true &&
    request.data.info._local === false
  )
    return callback(
      this.happn.services.error.AccessDeniedError(
        'use of _ADMIN credentials over the network is disabled'
      )
    );

  if (credentials.token) {
    try {
      let previousSession = this.decodeToken(credentials.token);

      if (
        previousSession.username === '_ADMIN' &&
        this.config.disableDefaultAdminNetworkConnections === true &&
        request.data.info._local === false
      )
        return callback(
          this.happn.services.error.AccessDeniedError(
            'use of _ADMIN credentials over the network is disabled'
          )
        );

      let previousPolicy = previousSession.policy[1]; //always the stateful policy

      username = previousSession.username;

      if (previousPolicy.disallowTokenLogins)
        throw new Error('logins with this token are disallowed by policy');

      if (
        previousPolicy.lockTokenToOrigin &&
        previousSession.origin !== this.happn.services.system.name
      )
        throw new Error('this token is locked to a different origin by policy');

      return this.authorize(previousSession, null, 'login', (e, authorized, reason) => {
        if (e)
          return this.__loginFailed(
            previousSession.username,
            'Invalid credentials',
            e,
            callback,
            true
          );

        if (!authorized)
          return this.__loginFailed(previousSession.username, reason, null, callback, true);

        this.users.getUser(previousSession.username, (e, user) => {
          if (user == null)
            return this.__loginFailed(
              previousSession.username,
              'Invalid credentials',
              null,
              callback,
              true
            );
          return this.__loginOK(
            credentials,
            user,
            sessionId,
            callback,
            previousSession.tokenOriginSessionId || previousSession.id
          );
        });
      });
    } catch (e) {
      return this.__loginFailed(username, 'Invalid credentials', e, callback);
    }
  }

  if (this.__checkLockedOut(credentials.username))
    return callback(this.happn.services.error.AccessDeniedError('Account locked out'));

  return this.users.getUser(credentials.username, (e, user) => {
    if (e) return callback(e);

    if (user == null)
      return this.__loginFailed(credentials.username, 'Invalid credentials', null, callback);

    if (credentials.digest) {
      if (user.publicKey !== credentials.publicKey)
        return this.__loginFailed(credentials.username, 'Invalid credentials', null, callback);

      return this.verifyAuthenticationDigest(credentials, (e, valid) => {
        if (e) return callback(e);

        if (!valid)
          return this.__loginFailed(credentials.username, 'Invalid credentials', null, callback);

        return this.__loginOK(credentials, user, sessionId, callback);
      });
    }

    return this.users.getPasswordHash(credentials.username, (e, hash) => {
      if (e) {
        if (e.toString() === 'Error: ' + credentials.username + ' does not exist in the system')
          return this.__loginFailed(credentials.username, 'Invalid credentials', null, callback);
        return callback(e);
      }

      this.matchPassword(credentials.password, hash, (e, match) => {
        if (e) return callback(e);

        if (!match)
          return this.__loginFailed(credentials.username, 'Invalid credentials', null, callback);

        return this.__loginOK(credentials, user, sessionId, callback);
      });
    });
  });
}

function createAuthenticationNonce(request, callback) {
  if (!request.publicKey) return callback(new Error('no public key with request'));

  let nonce = this.cryptoService.generateNonce();

  this.cacheService.set(
    request.publicKey,
    nonce,
    {
      cache: 'security_authentication_nonce',
      ttl: this.config.defaultNonceTTL
    },
    e => {
      if (e) return callback(e);
      else callback(null, nonce);
    }
  );
}

/**
 * checks the incoming requests digest against a nonce that is cached via the public key of the request, calls back with true or false depending on
 * whether the digest and nonce are related by the same private key.
 */
function verifyAuthenticationDigest(request, callback) {
  if (!request.publicKey) return callback(new Error('no publicKey in request'));
  if (!request.digest) return callback(new Error('no digest in request'));

  this.cacheService.get(
    request.publicKey,
    {
      cache: 'security_authentication_nonce'
    },
    (e, nonce) => {
      if (e) return callback(e);
      if (!nonce) return callback(new Error('nonce expired or public key invalid'));

      try {
        let verified = this.cryptoService.verify(nonce, request.digest, request.publicKey);
        callback(null, verified);
      } catch (verifyFailed) {
        callback(verifyFailed);
      }
    }
  );
}

function authorize(session, path, action, callback) {
  let completeCall = (err, authorized, reason) => {
    callback(err, authorized, reason);
    if (this.config.logSessionActivity)
      this.__logSessionActivity(session.id, path, action, err, authorized, reason, e => {
        if (e) this.log.warn('unable to log session activity: ' + e.toString());
      });
  };

  this.__checkRevocations(
    session.tokenOriginSessionId || session.id,
    (e, authorized, reason) => {
      if (e) return callback(e);
      if (!authorized) return completeCall(null, false, reason);

      this.checkpoint._authorizeSession(
        session,
        path,
        action,
        (e, authorized, reason, passthrough) => {
          //check the session ttl, expiry,permissions etc.

          if (e) return callback(e);
          if (!authorized) return completeCall(null, false, reason);
          if (passthrough || session.bypassAuthUser) return completeCall(null, true);

          this.checkpoint._authorizeUser(session, path, action, completeCall);
        }
      );
    },
    session.tokenOriginSessionId == null
  );
}

function authorizeOnBehalfOf(session, path, action, onBehalfOf, callback) {
  let completeCall = (err, authorized, reason, onBehalfOfSession) => {
    callback(err, authorized, reason, onBehalfOfSession);
    if (this.config.logSessionActivity)
      this.__logSessionActivity(session.id, path, action, err, authorized, reason, e => {
        if (e) this.log.warn('unable to log session activity: ' + e.toString());
      });
  };

  if (session.user.username !== '_ADMIN')
    return completeCall(null, false, 'session attempting to act on behalf of is not authorized');

  this.__getOnBehalfOfSession(session, onBehalfOf, (e, behalfOfSession) => {
    if (e) return completeCall(e, false, 'failed to get on behalf of session');
    if (!behalfOfSession) return completeCall(null, false, 'on behalf of user does not exist');
    this.authorize(behalfOfSession, path, action, function(err, authorized, reason) {
      if (err) return completeCall(err, false, reason);
      if (!authorized) return completeCall(err, false, reason);
      return completeCall(err, authorized, reason, behalfOfSession);
    });
  });
}

function __getOnBehalfOfSession(delegatedBy, onBehalfOf, callback) {
  let behalfOfSession = this.__cache_session_on_behalf_of.getSync(onBehalfOf, { clone: false });
  if (behalfOfSession) return callback(null, behalfOfSession);

  this.users.getUser(onBehalfOf, (e, onBehalfOfUser) => {
    if (e) return callback(e);
    if (!onBehalfOfUser) {
      return callback(null, null);
    }
    behalfOfSession = this.generateSession(onBehalfOfUser, null, {
      info: { delegatedBy: delegatedBy.user.username }
    });
    behalfOfSession.happn = delegatedBy.happn;
    this.__cache_session_on_behalf_of.setSync(onBehalfOf, behalfOfSession, { clone: false });
    callback(null, behalfOfSession);
  });
}

function stop(options, callback) {
  if (typeof options === 'function') callback = options;

  //stop cache timers
  if (this.__locks) this.__locks.stop();
  if (this.__cache_session_activity) this.__cache_session_activity.stop();
  if (this.__cache_revoked_sessions) this.__cache_revoked_sessions.stop();

  this.checkpoint.stop();
  callback();
}

function validateName(name, validationType) {
  if (!name) throw new this.errorService.ValidationError('names cannot be empty');

  if (
    this.utilsService.stringContainsAny(name, [
      '/',
      '_SYSTEM',
      '_GROUP',
      '_PERMISSION',
      '_USER_GROUP',
      '_ADMIN'
    ])
  )
    throw new this.errorService.ValidationError(
      'validation error: ' +
        validationType +
        ' names cannot contain the special _SYSTEM, _GROUP, _PERMISSION, _USER_GROUP, _ADMIN segment or a forward slash /'
    );
}

function checkOverwrite(validationType, obj, path, name, options, callback) {
  if (!name) name = obj.name;
  if (options && options.overwrite === false)
    return this.dataService.get(path, {}, (e, result) => {
      if (e) return callback(e);
      if (result)
        return callback(
          new Error(
            'validation failure: ' + validationType + ' by the name ' + name + ' already exists'
          )
        );
      callback();
    });

  callback();
}

function serializeAll(objectType, objArray, options) {
  if (!objArray) return [];
  return objArray.map(obj => {
    return this.serialize(objectType, obj, options);
  });
}

function serialize(objectType, obj, options) {
  //don't clone if clone is explicitly set to false
  let returnObj = options && options.clone === false ? obj.data : this.utilsService.clone(obj.data);

  returnObj._meta = obj._meta;

  if (objectType === 'user') {
    delete returnObj.password;
    delete returnObj._meta;
  }

  return returnObj;
}
