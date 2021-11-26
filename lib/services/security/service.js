const jwt = require('jwt-simple'),
  uuid = require('uuid'),
  sift = require('sift').default,
  EventEmitter = require('events').EventEmitter,
  util = require('../utils/shared'),
  nodeUtil = require('util'),
  uuidv1 = require('uuid/v1'),
  async = require('async'),
  BaseAuthProvider = require('./authentication/provider-base'),
  path = require('path');
module.exports = SecurityService;
nodeUtil.inherits(SecurityService, EventEmitter);

function SecurityService(opts) {
  this.log = opts.logger.createLogger('Security');
  this.log.$$TRACE('construct(%j)', opts);
  //security-data-changed event causes warning
  this.setMaxListeners(35);

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

  this.__cache_revoked_tokens = null;
  this.__cache_session_activity = null;
  this.__cache_session_on_behalf_of = null;

  this.__dataHooks = [];
}

SecurityService.prototype.initialize = nodeUtil.callbackify(initialize);
SecurityService.prototype.stop = stop;

SecurityService.prototype.__initializeSessionTokenSecret = __initializeSessionTokenSecret;
SecurityService.prototype.__initializeCheckPoint = __initializeCheckPoint;
SecurityService.prototype.__initializeUsers = __initializeUsers;
SecurityService.prototype.__initializeGroups = __initializeGroups;
SecurityService.prototype.__initializeSessionManagement = __initializeSessionManagement;
SecurityService.prototype.__initializeOnBehalfOfCache = __initializeOnBehalfOfCache;
SecurityService.prototype.__clearOnBehalfOfCache = __clearOnBehalfOfCache;
SecurityService.prototype.__ensureKeyPair = __ensureKeyPair;
SecurityService.prototype.__ensureAdminUser = __ensureAdminUser;
SecurityService.prototype.__ensureAnonymousUser = __ensureAnonymousUser;
SecurityService.prototype.linkAnonymousGroup = linkAnonymousGroup;
SecurityService.prototype.unlinkAnonymousGroup = unlinkAnonymousGroup;
SecurityService.prototype.__initializeReplication = __initializeReplication;
SecurityService.prototype.__initializeAuthProviders = __initializeAuthProviders;
SecurityService.prototype.__getAuthProvider = __getAuthProvider;

SecurityService.prototype.deactivateSessionManagement = deactivateSessionManagement;
SecurityService.prototype.activateSessionActivity = activateSessionActivity;
SecurityService.prototype.activateSessionManagement = activateSessionManagement;

SecurityService.prototype.__loadRevokedTokens = __loadRevokedTokens;
SecurityService.prototype.deactivateSessionActivity = deactivateSessionActivity;
SecurityService.prototype.__loadSessionActivity = __loadSessionActivity;
SecurityService.prototype.__checkRevocations = util.maybePromisify(__checkRevocations);

SecurityService.prototype.revokeToken = revokeToken;
SecurityService.prototype.listRevokedTokens = listRevokedTokens;
SecurityService.prototype.sessionFromRequest = sessionFromRequest;
SecurityService.prototype.tokenFromRequest = tokenFromRequest;
SecurityService.prototype.getCookieName = getCookieName;
SecurityService.prototype.restoreToken = restoreToken;
SecurityService.prototype.__logSessionActivity = __logSessionActivity;

SecurityService.prototype.__listCache = __listCache;
SecurityService.prototype.listSessionActivity = listSessionActivity;
SecurityService.prototype.listActiveSessions = util.maybePromisify(listActiveSessions);

SecurityService.prototype.offDataChanged = offDataChanged;
SecurityService.prototype.onDataChanged = onDataChanged;
SecurityService.prototype.emitChanges = emitChanges;
SecurityService.prototype.resetSessionPermissions = resetSessionPermissions;
SecurityService.prototype.dataChanged = util.maybePromisify(dataChanged);
SecurityService.prototype.__replicateDataChanged = __replicateDataChanged;

//Auditing methods
//-----------------------------

SecurityService.prototype.getAuditData = getAuditData;
SecurityService.prototype.getAuditPath = getAuditPath;
SecurityService.prototype.doAudit = util.maybePromisify(doAudit);

//Request authorization methods
//-----------------------------

SecurityService.prototype.processAuthorize = processAuthorize;
SecurityService.prototype.processAuthorizeUnsecure = processAuthorizeUnsecure;
SecurityService.prototype.authorize = util.maybePromisify(authorize);
SecurityService.prototype.authorizeOnBehalfOf = authorizeOnBehalfOf;
SecurityService.prototype.__getOnBehalfOfSession = __getOnBehalfOfSession;
SecurityService.prototype.getCorrectSession = getCorrectSession;
SecurityService.prototype.getRelevantPaths = getRelevantPaths;
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
SecurityService.prototype.checkTokenUserId = util.maybePromisify(checkTokenUserId);
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
SecurityService.prototype.checkIPAddressWhitelistPolicy = checkIPAddressWhitelistPolicy;
SecurityService.prototype.__dataChangedInternal = __dataChangedInternal;

let CONSTANTS = require('../..').constants;
let AUTHORIZE_ACTIONS = CONSTANTS.AUTHORIZE_ACTIONS_COLLECTION;

async function initialize(config) {
  if (this.happn.config.disableDefaultAdminNetworkConnections === true)
    config.disableDefaultAdminNetworkConnections = true;

  this.cacheService = this.happn.services.cache;
  this.dataService = this.happn.services.data;
  this.cryptoService = this.happn.services.crypto;
  this.sessionService = this.happn.services.session;
  this.utilsService = this.happn.services.utils;
  this.errorService = this.happn.services.error;

  this.pathField = this.dataService.pathField; //backward compatible for allowing mongo plugin, which uses an actual path field

  if (config.updateSubscriptionsOnSecurityDirectoryChanged == null)
    config.updateSubscriptionsOnSecurityDirectoryChanged = true;

  if (!config.defaultNonceTTL) config.defaultNonceTTL = 60000;
  //1 minute
  else config.defaultNonceTTL = this.happn.services.utils.toMilliseconds(config.defaultNonceTTL);

  if (!config.logSessionActivity) config.logSessionActivity = false;

  if (!config.sessionActivityTTL) config.sessionActivityTTL = 60000 * 60 * 24;
  //1 day
  else
    config.sessionActivityTTL = this.happn.services.utils.toMilliseconds(config.sessionActivityTTL);

  if (typeof config.pbkdf2Iterations !== 'number') config.pbkdf2Iterations = 10000;

  //token is always locked to login type
  if (config.lockTokenToLoginType == null) config.lockTokenToLoginType = true;

  this.config = config;
  this.config.cookieName = this.config.cookieName || 'happn_token';

  if (!this.config.secure) this.processAuthorize = this.processAuthorizeUnsecure;

  //we only want 1 security directory refresh to happen at a time
  this.__dataChangedQueue = async.queue((task, callback) => {
    this.__dataChangedInternal(task.whatHappnd, task.changedData, task.additionalInfo, callback);
  }, 1);

  await this.__initializeGroups(config);
  await this.__initializeCheckPoint(config);
  await this.__initializeUsers(config);
  await this.__initializeProfiles(config);
  await this.__ensureKeyPair(config);
  await this.__initializeSessionManagement(config);
  await this.__initializeOnBehalfOfCache(config);
  await this.__ensureAdminUser(config);
  this.anonymousUser = await this.__ensureAnonymousUser(config);
  await this.__initializeReplication(config);
  await this.__initializeSessionTokenSecret(config);
  await this.__initializeAuthProviders(config);
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

function __getAuthProvider(authType) {
  return this.authProviders[authType] || this.authProviders['default'];
}

function processLogin(message, callback) {
  let credentials = message.request.data;
  let sessionId = null;
  if (message.session) sessionId = message.session.id;

  let authProvider, decodedToken;
  if (credentials.token) {
    decodedToken = this.decodeToken(credentials.token);
    authProvider = this.__getAuthProvider(decodedToken ? decodedToken.authType : 'default');
  } else authProvider = this.__getAuthProvider(credentials.authType);
  if (credentials.username === '_ADMIN' && this.authProviders.happn)
    authProvider = this.authProviders.happn;
  authProvider.login(credentials, sessionId, message.request, (e, session) => {
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

function login(...args) {
  return this.__getAuthProvider(args[0] ? args[0].authType : '').login(...args);
}

function processAuthorizeUnsecure(message, callback) {
  return callback(null, message);
}

function processAuthorize(message, callback) {
  if (AUTHORIZE_ACTIONS.indexOf(message.request.action) === -1) return callback(null, message);
  if (!message.request.path)
    return callback(this.happn.services.error.AccessDeniedError('invalid path'));

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
      if (!authorized) {
        return callback(this.happn.services.error.AccessDeniedError(reason || 'unauthorized'));
      }
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

    this.users.getUser('_ADMIN', async (e, foundUser) => {
      if (e) return reject(e);
      if (foundUser) return resolve();
      if (!config.adminUser.password) config.adminUser.password = 'happn';

      try {
        const adminGroup = await this.groups.__upsertGroup(config.adminGroup, {});
        const adminUser = await this.users.__upsertUser(config.adminUser, {});
        await this.groups.linkGroup(adminGroup, adminUser);
        resolve();
      } catch (e) {
        reject(e);
      }
    });
  });
}

async function __ensureAnonymousUser(config) {
  if (!config.allowAnonymousAccess) return null;
  let anonymousUser = await this.users.getUser('_ANONYMOUS');
  if (anonymousUser != null) return anonymousUser;
  return this.users.__upsertUser({
    username: '_ANONYMOUS',
    password: 'anonymous'
  });
}

async function linkAnonymousGroup(group) {
  if (!this.config.allowAnonymousAccess) throw new Error('Anonymous access is not configured');
  return await this.groups.linkGroup(group, this.anonymousUser);
}

async function unlinkAnonymousGroup(group) {
  if (!this.config.allowAnonymousAccess) throw new Error('Anonymous access is not configured');
  return await this.groups.unlinkGroup(group, this.anonymousUser);
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

function __initializeSessionTokenSecret(config) {
  return new Promise((resolve, reject) => {
    //eslint-disable-next-line
    if (config.sessionTokenSecret != null) {
      return this.dataService.upsert(
        '/_SYSTEM/_SECURITY/SESSION_TOKEN_SECRET',
        {
          secret: config.sessionTokenSecret
        },
        e => {
          if (e) return reject(e);
          resolve();
        }
      );
    }

    this.dataService.get('/_SYSTEM/_SECURITY/SESSION_TOKEN_SECRET', (e, found) => {
      if (e) return reject(e);
      if (found) {
        config.sessionTokenSecret = found.data.secret;
        return resolve();
      }
      const secret = uuid.v4() + uuid.v4();
      this.dataService.upsert(
        '/_SYSTEM/_SECURITY/SESSION_TOKEN_SECRET',
        {
          secret
        },
        e => {
          if (e) return reject(e);
          config.sessionTokenSecret = secret;
          resolve();
        }
      );
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
      return this.__loadRevokedTokens(e => {
        if (e) return reject(e);
        resolve();
      });
    this.activateSessionManagement(config.logSessionActivity, e => {
      if (e) return reject(e);
      resolve();
    });
  });
}

function __initializeAuthProviders(config) {
  let authProviders = config.authProviders || {};
  this.authProviders = {};

  if (authProviders.happn !== false)
    this.authProviders.happn = require(path.resolve(
      __dirname,
      `./authentication/happn-provider.js`
    )).create(this.happn, config);
  delete authProviders.happn;

  let defaultAuthProvider = config.defaultAuthProvider || 'happn';

  Object.keys(authProviders).forEach(key => {
    let provider = authProviders[key];
    this.authProviders[key] = BaseAuthProvider.create(this.happn, config, provider);
  });
  this.authProviders.default = this.authProviders[defaultAuthProvider] || this.authProviders[0]; //The || is for cases where you are not using happn3 auth provider, but have not specified another default provider
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

  this.__loadRevokedTokens(e => {
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

function __loadRevokedTokens(callback) {
  if (this.__cache_revoked_tokens) return callback();

  let config = {
    type: 'persist',
    cache: {
      dataStore: this.dataService
    }
  };

  this.__cache_revoked_tokens = this.cacheService.new('cache_revoked_tokens', config);
  this.__cache_revoked_tokens.sync(callback);
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

function __checkRevocations(token, callback) {
  if (!this.__cache_revoked_tokens) return callback(null, true);
  this.__cache_revoked_tokens.get(token, function(e, item) {
    if (e) return callback(e);
    if (item == null) return callback(null, true);
    callback(null, false, `token has been revoked`);
  });
}

function revokeToken(token, reason, callback) {
  if (typeof reason === 'function') {
    callback = reason;
    reason = 'SYSTEM';
  }

  if (token == null || token === undefined) return callback(new Error('token not defined'));

  let decoded = this.decodeToken(token);

  if (decoded == null) return callback(new Error('invalid token'));

  let ttl = 0;

  if (decoded.info && decoded.info._browser) {
    //browser logins can only be used for stateful sessions
    ttl = decoded.policy[1].ttl;
  } else if (this.config.lockTokenToLoginType && decoded.type != null) {
    // we are checking if the token contains a type - to have backward compatibility
    // with old machine to machine tokens
    ttl = decoded.policy[decoded.type].ttl;
  } else {
    //tokens are interchangeable between login types
    //if both policy types have a ttl, we set the ttl
    //of the revocation to the biggest one
    if (
      decoded.policy[0].ttl &&
      decoded.policy[0].ttl !== Infinity &&
      decoded.policy[1].ttl &&
      decoded.policy[1].ttl !== Infinity
    ) {
      if (decoded.policy[0].ttl >= decoded.policy[1].ttl) ttl = decoded.policy[0].ttl;
      else ttl = decoded.policy[1].ttl;
    }
  }

  if (ttl === 0)
    this.log.warn('revoking a token without a ttl means it stays in the revocation list forever');

  const timestamp = Date.now();

  this.__cache_revoked_tokens.set(
    token,
    {
      reason,
      timestamp,
      ttl
    },
    { ttl },
    e => {
      if (!e)
        this.dataChanged(
          CONSTANTS.SECURITY_DIRECTORY_EVENTS.TOKEN_REVOKED,
          {
            token,
            session: decoded,
            reason,
            timestamp,
            ttl
          },
          `token for session with id ${decoded.id}  and origin ${
            decoded.parentId ? decoded.parentId : decoded.id
          } revoked`
        );
      callback(e);
    }
  );
}

function getCookieName(headers, connectionData, options) {
  if (!options.cookieName) options.cookieName = this.config.cookieName;
  if (this.config.httpsCookie) {
    return headers['x-forwarded-proto'] === 'https' ||
      headers['x-forwarded-proto'] === 'wss' ||
      connectionData.encrypted
      ? `${options.cookieName}_https`
      : options.cookieName;
  }
  //fall back to the old cookie name, for backward compatibility - old browsers
  return options.cookieName;
}

function tokenFromRequest(req, options) {
  if (!options) options = {};
  if (!options.tokenName) options.tokenName = 'happn_token';
  let token;
  let cookieName = this.getCookieName(req.headers, req.connection, options);
  token = req.cookies.get(cookieName);
  if (token) return token;
  //fall back to the old cookie name, for backward compatibility - old browsers
  token = req.cookies.get(options.cookieName);
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

  let session = this.decodeToken(token);
  if (session == null) {
    this.log.warn('failed decoding session token from request');
    return null;
  }
  session.type = 0;
  session.happn = this.happn.services.system.getDescription();
  session.token = token;
  return session;
}

function restoreToken(token, callback) {
  this.__cache_revoked_tokens.remove(token, e => {
    if (!e)
      this.dataChanged(
        CONSTANTS.SECURITY_DIRECTORY_EVENTS.TOKEN_RESTORED,
        { token },
        `token restored: ${token}`
      );
    callback(e);
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

function listRevokedTokens(filter, callback) {
  if (typeof filter === 'function') {
    callback = filter;
    filter = null;
  }

  if (!this.__sessionManagementActive)
    return callback(new Error('session management not activated'));
  return this.__cache_revoked_tokens.all(filter, callback);
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
    previousPermissionSetKey: sessionData.previousPermissionSetKey,
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
    if (whatHappnd === CONSTANTS.SECURITY_DIRECTORY_EVENTS.TOKEN_REVOKED) {
      let revokedSession = getEffectedSession(changedData.session, true);
      effectedSessions.push(revokedSession);
      //disconnect the revoked session and its descendents
      this.sessionService.disconnectSessions(
        changedData.session.parentId,
        {
          reason: CONSTANTS.SECURITY_DIRECTORY_EVENTS.TOKEN_REVOKED
        },
        e => {
          if (e) this.errorService.handleSystem(e, 'SecurityService');
        }
      );

      //cache does not need to be updated, just resolve
      if (!changedData.replicated) return resolve(effectedSessions);

      //means we are getting a replication from elsewhere in the cluster
      return this.__cache_revoked_tokens.set(
        changedData.token,
        { reason: changedData.reason, id: changedData.id },
        { noPersist: true, ttl: changedData.ttl },
        e => {
          if (e) return reject(e);
          resolve(effectedSessions);
        }
      );
    }

    if (whatHappnd === CONSTANTS.SECURITY_DIRECTORY_EVENTS.TOKEN_RESTORED) {
      //remove the restored token without updating the db, the originating call to restoreToken already did this
      return this.__cache_revoked_tokens.remove(
        changedData.token,
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
        sessionData.previousPermissionSetKey = sessionData.permissionSetKey;
        if (
          whatHappnd === CONSTANTS.SECURITY_DIRECTORY_EVENTS.PERMISSION_REMOVED ||
          whatHappnd === CONSTANTS.SECURITY_DIRECTORY_EVENTS.PERMISSION_UPSERTED
        ) {
          //all we need to do, permissionSetKey remains the same (as it is the ordered list of linked groups) - all caches are cleared, but effected sessions are different
          if (
            sessionData.user.groups[changedData.groupName] != null ||
            changedData.username === sessionData.user.username
          )
            effectedSessions.push(getEffectedSession(sessionData, true));
        }

        if (
          whatHappnd === CONSTANTS.SECURITY_DIRECTORY_EVENTS.LINK_GROUP &&
          changedData._meta.path.indexOf(
            `/_SYSTEM/_SECURITY/_USER/${sessionData.user.username}/_USER_GROUP/`
          ) === 0
        ) {
          groupName = changedData._meta.path.replace(
            `/_SYSTEM/_SECURITY/_USER/${sessionData.user.username}/_USER_GROUP/`,
            ''
          );
          sessionData.user.groups[groupName] = changedData;
          sessionData.permissionSetKey = this.generatePermissionSetKey(sessionData.user);
          effectedSessions.push(getEffectedSession(sessionData, true));
        }

        if (
          whatHappnd === CONSTANTS.SECURITY_DIRECTORY_EVENTS.UPSERT_GROUP &&
          sessionData.user.groups[changedData.name]
        ) {
          //cause a subscription refresh if the group permissions were also submitted
          if (changedData.permissions && Object.keys(changedData.permissions).length > 0)
            effectedSessions.push(getEffectedSession(sessionData, true));
          else effectedSessions.push(getEffectedSession(sessionData, false));
        }

        if (whatHappnd === CONSTANTS.SECURITY_DIRECTORY_EVENTS.UNLINK_GROUP) {
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

        if (whatHappnd === CONSTANTS.SECURITY_DIRECTORY_EVENTS.DELETE_USER) {
          let userName = changedData.obj._meta.path.replace('/_SYSTEM/_SECURITY/_USER/', '');

          if (sessionData.user.username === userName) {
            effectedSessions.push(getEffectedSession(sessionData, true));
            this.sessionService.disconnectSession(sessionData.id, null, {
              reason: 'security directory update: user deleted'
            });
          }
        }

        if (whatHappnd === CONSTANTS.SECURITY_DIRECTORY_EVENTS.DELETE_GROUP) {
          if (sessionData.user.groups[changedData.obj.name]) {
            delete sessionData.user.groups[changedData.obj.name];
            sessionData.permissionSetKey = this.generatePermissionSetKey(sessionData.user);
            effectedSessions.push(getEffectedSession(sessionData, true));
          }
        }

        if (whatHappnd === CONSTANTS.SECURITY_DIRECTORY_EVENTS.UPSERT_USER) {
          if (sessionData.user.username === changedData.username) {
            return this.users.getUser(changedData.username, (e, user) => {
              if (e) return sessionCallback(e);
              if (user == null) {
                // the user was deleted while the security directory is being updated
                return sessionCallback();
              }
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
  this.__dataChangedQueue.push({ whatHappnd, changedData, additionalInfo }, callback);
}

function __dataChangedInternal(whatHappnd, changedData, additionalInfo, callback) {
  if (CONSTANTS.SECURITY_DIRECTORY_EVENTS_COLLECTION.indexOf(whatHappnd) === -1) return callback();
  this.__clearOnBehalfOfCache()
    .then(() => {
      return this.users.clearCaches(whatHappnd, changedData);
    })
    .then(() => {
      return this.groups.clearCaches(whatHappnd, changedData);
    })
    .then(() => {
      return this.resetSessionPermissions(whatHappnd, changedData, additionalInfo);
    })
    .then(effectedSessions => {
      return this.checkpoint.clearCaches(effectedSessions);
    })
    .then(effectedSessions => {
      return new Promise((resolve, reject) => {
        if (
          this.happn.services.subscription &&
          this.config.updateSubscriptionsOnSecurityDirectoryChanged
        )
          this.happn.services.subscription
            .securityDirectoryChanged(whatHappnd, changedData, effectedSessions, additionalInfo)
            .then(() => {
              resolve(effectedSessions);
            })
            .catch(reject);
        else {
          resolve(effectedSessions);
        }
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
    this.log.warn(`invalid session token: ${e.message}`);
    return null;
  }
}

function checkTokenUserId(token, callback) {
  if (!this.config.lockTokenToUserId) return callback(null, true);
  this.users.getUser(token.username, (e, user) => {
    if (e) return callback(e);
    if (!user) return callback(null, true); //user doesnt exist, authorize fails at a later point
    if (!user.userid) return callback(null, true); //backward compatibility - old users
    callback(null, user.userid === token.userid);
  });
}

function generatePermissionSetKey(user) {
  return require('crypto')
    .createHash('sha1')
    .update(
      user.permissions
        ? Object.keys(user.groups)
            .concat(Object.keys(user.permissions))
            .sort()
            .join('/')
        : Object.keys(user.groups)
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
      if (sift(filter, [decoupledSession]).length === 1) {
        session.policy[sessionType] = profile.policy;
      }
    });
  });

  if (session.policy[0] == null && session.policy[1] == null)
    throw new Error('unable to match session with a profile'); //this should never happen
}

function generateToken(session, type) {
  let decoupledSession = this.happn.services.utils.clone(session);

  decoupledSession.type = type || 1; //session based type if  not specified
  decoupledSession.isToken = true;

  delete decoupledSession.permissionSetKey; //this should never be used as it may get out of sync
  delete decoupledSession.user; //also not to be used later on as it may go out of sync

  if (session.user && session.user.username) {
    decoupledSession.username = session.user.username;
    decoupledSession.userid = session.user.userid;
  }

  let packed = require('jsonpack').pack(decoupledSession);
  return jwt.encode(packed, this.config.sessionTokenSecret);
}

function generateSession(user, sessionId, credentials, tokenLogin, additionalInfo) {
  let session = this.generateEmptySession(sessionId);
  session.httpsCookie = this.config.httpsCookie;
  session.info = credentials.info;
  if (tokenLogin) session.type = tokenLogin.session.type;
  else session.type = 1; //stateful
  session.user = user;
  session.timestamp = Date.now();
  if (tokenLogin) session.parentId = tokenLogin.session.id;
  else session.parentId = session.id;
  session.isEncrypted = credentials.isEncrypted ? true : false;
  session.origin = this.happn.services.system.name;

  this.__profileSession(session); //session ttl, activity threshold and user effective permissions are set here

  session.permissionSetKey = this.generatePermissionSetKey(session.user, session);

  additionalInfo = additionalInfo || {};
  if (tokenLogin) session.token = tokenLogin.token;
  else session.token = this.generateToken({ ...session, ...additionalInfo });

  // It is not possible for the login (websocket call) to assign the session token (cookie) server side,
  // so the cookie is therefore created in the browser upon login success.
  // It is necessary to include how to make the cookie in the login reply via this session object.
  session.cookieName = this.config.cookieName;
  //if we are logging in via websockets (and possibly the browser), we want to ensure the correct cookie name is used
  if (this.config.httpsCookie && sessionId) {
    let sessionInfo = this.sessionService.getSession(sessionId);
    if (
      sessionInfo.headers['x-forwarded-proto'] === 'https' ||
      sessionInfo.headers['x-forwarded-proto'] === 'wss' ||
      sessionInfo.encrypted
    )
      session.cookieName = `${this.config.cookieName}_https`;
  }
  if (this.config.cookieDomain) session.cookieDomain = this.config.cookieDomain;
  if (session.isEncrypted) session.secret = uuidv1().replace(/-/g, '');
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

function __loginOK(credentials, user, sessionId, callback, tokenLogin, additionalInfo) {
  delete user.password;
  if (this.__locks) this.__locks.removeSync(user.username); //remove previous locks
  callback(null, this.generateSession(user, sessionId, credentials, tokenLogin, additionalInfo));
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

function checkDisableDefaultAdminNetworkConnections(credentials, request) {
  return (
    credentials.username === '_ADMIN' &&
    this.config.disableDefaultAdminNetworkConnections === true &&
    request &&
    request.data &&
    request.data.info &&
    request.data.info._local === false
  );
}

function checkIPAddressWhitelistPolicy(credentials, sessionId, request) {
  return this.__cache_Profiles.every(profile => {
    if (profile.policy.sourceIPWhitelist == null || profile.policy.sourceIPWhitelist.length === 0)
      return true;
    if (sift(profile.session, [{ user: credentials }]).length === 0) return true;
    if (sessionId) {
      const session = this.sessionService.getSession(sessionId);
      if (!session) return false;
      return profile.policy.sourceIPWhitelist.indexOf(session.address.ip) > -1;
    }
    return profile.policy.sourceIPWhitelist.indexOf(request.address.ip) > -1;
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
  this.__checkRevocations(session.token, (e, authorized, reason) => {
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
  });
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

function getCorrectSession(message, callback) {
  if (
    !(
      message.request.options &&
      message.request.options.onBehalfOf &&
      message.request.options.onBehalfOf !== '_ADMIN'
    )
  )
    return callback(null, message.session);
  return this.__getOnBehalfOfSession(message.session, message.request.options.onBehalfOf, callback);
}

function getRelevantPaths(message, callback) {
  this.getCorrectSession(message, (e, session) => {
    if (e) callback(e);
    const authPath = message.request.path.replace(/^\/(?:REMOVE|SET|ALL)@/, '');
    this.checkpoint.listRelevantPermissions(session, authPath, message.request.action, callback);
  });
}

function stop(options, callback) {
  if (typeof options === 'function') callback = options;

  //stop cache timers
  if (this.__locks) this.__locks.stop();
  if (this.__cache_session_activity) this.__cache_session_activity.stop();
  if (this.__cache_revoked_tokens) this.__cache_revoked_tokens.stop();

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
      '_ADMIN',
      '_ANONYMOUS'
    ])
  )
    throw new this.errorService.ValidationError(
      'validation error: ' +
        validationType +
        ' names cannot contain the special _SYSTEM, _GROUP, _PERMISSION, _USER_GROUP, _ADMIN, _ANONYMOUS segment or a forward slash /'
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
