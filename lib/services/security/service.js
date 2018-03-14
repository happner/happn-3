var jwt = require('jwt-simple'),
  uuid = require('uuid'),
  sift = require('sift'),
  Promise = require('bluebird'),
  EventEmitter = require('events').EventEmitter,
  util = require('util');

module.exports = SecurityService;

util.inherits(SecurityService, EventEmitter);

function SecurityService(opts) {

  this.log = opts.logger.createLogger('Security');
  this.log.$$TRACE('construct(%j)', opts);

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

  this.options = opts;

  this.__cache_revoked_sessions = null;
  this.__cache_session_activity = null;

  this.__dataHooks = [];
}

SecurityService.prototype.getAuditData = function (message) {

  var path = message.request.path ? message.request.path : message.request.action;

  if (path.indexOf('/ALL@') == 0) path = path.replace('/ALL@', '');
  if (path.indexOf('/SET@') == 0) path = path.replace('/SET@', '');
  if (path.indexOf('/REMOVE@') == 0) path = path.replace('/REMOVE@', '');

  if (this.config.audit.paths && !this.happn.services.utils.wildcardMatchMultiple(this.config.audit.paths, path))
    return null;

  var data = {};

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
};

SecurityService.prototype.getAuditPath = function (message) {

  var requestPath = message.request.path ? message.request.path : null;
  var auditPath = '/_AUDIT/';

  if (requestPath) {

    if (requestPath.indexOf('@') > -1) requestPath = requestPath.split('@')[1]; //take out 'on' event type specifiers, ie SET@

    requestPath = this.happn.services.utils.replacePrefix(requestPath, '/');
    requestPath = this.happn.services.utils.replaceSuffix(requestPath, '/');

    auditPath += requestPath + '/';
  }

  auditPath += message.request.action;

  return auditPath;

};

SecurityService.prototype.doAudit = Promise.promisify(function (message, callback) {

  var _this = this;

  var auditData = _this.getAuditData(message);

  //path, data, options, callback
  if (auditData != null) {

    var auditPath = _this.getAuditPath(message); ///_AUDIT/[message.request.path]/[message.request.action] ie: /_AUDIT/users/all/*/get

    _this.dataService.upsert(auditPath, auditData, {
      set_type: 'sibling'
    }, function (e) {

      if (e) return callback(_this.happn.services.error.SystemError('security audit failed', e.toString()));

      return callback(null, message);
    });

  } else callback(null, message);
});

SecurityService.prototype.doUnsecureLogin = Promise.promisify(function (message, callback) {

  var session = this.generateEmptySession(message.session.id);

  session.info = message.request.data.info;

  message.response = {
    data: this.happn.services.session.attachSession(message.session.id, session)
  };

  return callback(null, message);

});

SecurityService.prototype.processLogin = function (message, callback) {

  var credentials = message.request.data;

  var sessionId = null;

  if (message.session) sessionId = message.session.id;

  var _this = this;

  _this.login(credentials, sessionId, function (e, session) {

    if (e) return callback(e);

    message.response = {
      data: _this.happn.services.session.attachSession(message.session.id, session)
    };

    callback(null, message);
  });
};

SecurityService.prototype.processAuthorize = Promise.promisify(function (message, callback) {
  var _this = this;

  return _this.authorize(

    message.session,
    message.request.path.replace(/^\/(?:REMOVE|SET|ALL)@/, ''),
    message.request.action,

    function (e, authorized, reason) {

      if (e) return callback(e);

      if (!authorized) return callback(_this.happn.services.error.AccessDeniedError('unauthorized', reason));

      callback(null, message);
    }
  );
});

SecurityService.prototype.processNonceRequest = function (message, callback) {

  return this.createAuthenticationNonce(message.request.data, function (e, nonce) {

    if (e) return callback(e);

    message.response = {
      nonce: nonce,
      data: {
        nonce: nonce
      } //happn-2 backward compatability
    };

    return callback(null, message);
  });
};

SecurityService.prototype.AccessDeniedError = function (message, reason) {

  return this.happn.services.error.AccessDeniedError(message, reason);
};

SecurityService.prototype.__ensureKeyPair = function (config) {

  var _this = this;

  return new Promise(function(resolve, reject){

    _this.dataService.get('/_SYSTEM/_SECURITY/_SETTINGS/KEYPAIR', {}, function (e, response) {

      if (e) return reject(e);

      if (!response) {

        if (!config.keyPair) config.keyPair = _this.cryptoService.serializeKeyPair(_this.cryptoService.createKeyPair());

        if (typeof config.keyPair != 'string') config.keyPair = _this.cryptoService.serializeKeyPair(config.keyPair);

        return _this.dataService.upsert('/_SYSTEM/_SECURITY/_SETTINGS/KEYPAIR', config.keyPair, {}, function (e, result) {

          if (e) return reject(e);

          _this._keyPair = _this.cryptoService.deserializeKeyPair(result.data.value);

          resolve();
        });

      } else {

        try {
          _this._keyPair = _this.cryptoService.deserializeKeyPair(response.data.value);
        } catch (e) {

          var transformedKeyPair = _this.cryptoService.serializeKeyPair(_this.cryptoService.keyPairFromWIF(response.data.value));

          return _this.dataService.upsert('/_SYSTEM/_SECURITY/_SETTINGS/KEYPAIR', transformedKeyPair, {}, function (e) {

            if (e) return reject(e);

            _this._keyPair = _this.cryptoService.deserializeKeyPair(transformedKeyPair);

            resolve();
          });
        }
      }

      resolve();
    });
  });


};

SecurityService.prototype.__ensureAdminUser = function (config, callback) {

  var _this = this;

  return new Promise(function(resolve, reject){

    if (!config.adminUser) config.adminUser = {
      custom_data: {}
    };

    if (!config.adminGroup) config.adminGroup = {
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

    _this.users.getUser('_ADMIN', function (e, foundUser) {

      if (e) return reject(e);

      if (foundUser) return resolve();

      if (!config.adminUser.password) config.adminUser.password = 'happn';

      //group, options, callback
      _this.users.__upsertGroup(config.adminGroup, {}, function (e, adminGroup) {

        if (e) return reject(e);

        _this.users.__upsertUser(config.adminUser, {}, function (e, adminUser) {

          if (e) return reject(e);

          _this.users.linkGroup(adminGroup, adminUser, function(e){
            if (e) return reject(e);
            resolve();
          });
        });
      });
    });
  });
};

SecurityService.prototype.initialize = function (config, callback) {

  try {

    this.cacheService = this.happn.services.cache;
    this.dataService = this.happn.services.data;
    this.cryptoService = this.happn.services.crypto;
    this.sessionService =  this.happn.services.session;

    this.pathField = this.dataService.pathField; //backward compatible for allowing mongo plugin, which uses an actual path field

    if (!config.sessionTokenSecret) config.sessionTokenSecret = uuid.v4() + uuid.v4();

    if (!config.defaultNonceTTL) config.defaultNonceTTL = 60000; //1 minute
    else config.defaultNonceTTL = this.happn.services.utils.toMilliseconds(config.defaultNonceTTL);

    if (!config.logSessionActivity) config.logSessionActivity = false;

    if (!config.sessionActivityTTL) config.sessionActivityTTL = 60000 * 60 * 24; //1 day
    else config.sessionActivityTTL = this.happn.services.utils.toMilliseconds(config.sessionActivityTTL);

    if (typeof config.accountLockout != 'object') config.accountLockout = {};

    if (config.accountLockout.enabled == null) config.accountLockout.enabled = true;

    if (config.accountLockout.enabled) {

      this.__locks = this.happn.services.cache.new('security_account_lockout');

      if (!config.accountLockout.attempts) config.accountLockout.attempts = 4;
      if (!config.accountLockout.retryInterval) config.accountLockout.retryInterval = 60 * 1000 * 10; //10 minutes
    }

    this.config = config;

    var _this = this;

    _this.__initializeUsers(config)
      .then(function(){
        return _this.__initializeProfiles(config);
      })
      .then(function(){
        return _this.__ensureKeyPair(config);
      })
      .then(function(){
        return _this.__initializeCheckPoint(config);
      })
      .then(function(){
        return _this.__initializeSessionManagement(config);
      })
      .then(function(){
        return _this.__ensureAdminUser(config);
      })
      .then(callback)
      .catch(callback);

  } catch (e) {
    callback(e);
  }
};

SecurityService.prototype.__initializeCheckPoint = function (config) {

  var _this = this;

  return new Promise(function(resolve, reject){

    var checkpoint = require('./checkpoint');
    _this.checkpoint = new checkpoint({
      logger: _this.log
    });

    Object.defineProperty(_this.checkpoint, 'happn', {
      value: _this.happn
    });

    _this.checkpoint.initialize(config, _this, function(e){
      if (e) return reject(e);
      resolve();
    });
  });
};

SecurityService.prototype.__initializeUsers = function (config) {

  var _this = this;

  return new Promise(function(resolve, reject){

    var SecurityUsers = require('./users');

    _this.users = new SecurityUsers({
      logger: _this.log
    });

    Object.defineProperty(_this.users, 'happn', {
      value: _this.happn
    });

    _this.users.initialize(config, _this, function(e){
      if (e) return reject(e);
      resolve();
    });
  });
};

SecurityService.prototype.__initializeSessionManagement = function (config) {

  var _this = this;

  return new Promise(function(resolve, reject) {

    if (!_this.config.secure) return resolve();

    if (!config.activateSessionManagement) return _this.__loadRevokedSessions(function(e){
      if (e) return reject(e);
      resolve();
    });

    _this.activateSessionManagement(config.logSessionActivity, function(e){
      if (e) return reject(e);
      resolve();
    });
  });

};

SecurityService.prototype.deactivateSessionManagement = function () {
  this.__sessionManagementActive = false;
};

SecurityService.prototype.sessionManagementActive = function () {
  return this.__sessionManagementActive;
};

SecurityService.prototype.activateSessionActivity = function (callback) {
  return this.__loadSessionActivity(callback);
};

SecurityService.prototype.activateSessionManagement = function (logSessionActivity, callback) {
  var _this = this;

  if (typeof logSessionActivity == 'function') {
    callback = logSessionActivity;
    logSessionActivity = false;
  }

  if (!_this.config.secure) return callback(new Error('session management must run off a secure instance'));

  _this.__sessionManagementActive = true;

  _this.__loadRevokedSessions(function (e) {

    if (e) return callback(e);

    _this.dataChanged('session-management-activated');

    if (!logSessionActivity) return callback();

    _this.__loadSessionActivity(callback);

  });
};

SecurityService.prototype.deactivateSessionManagement = function (logSessionActivity, callback) {
  var _this = this;

  if (typeof logSessionActivity == 'function') {
    callback = logSessionActivity;
    logSessionActivity = false;
  }

  if (!_this.config.secure) return callback(new Error('session management must run off a secure instance'));

  _this.__sessionManagementActive = false;

  if (logSessionActivity) _this.deactivateSessionActivity(true, callback);
  else callback();

};

SecurityService.prototype.__loadRevokedSessions = function (callback) {

  if (this.__cache_revoked_sessions) return callback();

  var config = {
    type: 'persist',
    cache: {
      dataStore: this.dataService
    }
  };

  this.__cache_revoked_sessions = this.cacheService.new('cache_revoked_sessions', config);
  this.__cache_revoked_sessions.sync(callback);
};


SecurityService.prototype.deactivateSessionActivity = function (clear, callback) {

  if (typeof clear === 'function') {
    callback = clear;
    clear = false;
  }

  if (!this.__cache_session_activity) return callback();

  this.config.logSessionActivity = false;

  if (clear) return this.__cache_session_activity.clear(callback);

  callback();
};

SecurityService.prototype.__loadSessionActivity = function (callback) {

  if (!this.config.logSessionActivity) this.config.logSessionActivity = true;

  if (this.__cache_session_activity) return callback();

  var config = {
    type: 'persist',
    cache: {
      dataStore: this.dataService,
      defaultTTL: this.config.sessionActivityTTL
    }
  };

  var _this = this;

  _this.__cache_session_activity = _this.cacheService.new('cache_session_activity', config);
  _this.__cache_session_activity.sync(callback);
};


SecurityService.prototype.__checkRevocations = function (sessionId, callback) {

  if (sessionId == null || sessionId == undefined) return callback(new Error('sessionId not defined'));

  this.__cache_revoked_sessions.get(sessionId, function (e, item) {

    if (e) return callback(e);

    if (item) return callback(null, false, 'session with id ' + sessionId + ' has been revoked');

    callback(null, true);

  });
};

SecurityService.prototype.revokeSession = function (session, reason, callback) {

  if (typeof reason == 'function') {
    callback = reason;
    reason = 'SYSTEM';
  }

  if (session == null || session == undefined) return callback(new Error('session not defined'));

  try {

    var decoded;

    if (session.token) decoded = this.decodeToken(session.token);

    else decoded = this.decodeToken(session);

    var ttl = 0;
    var noTTL = false;

    if (!decoded.policy[0].ttl || decoded.policy[0].ttl == Infinity) noTTL = true;
    else ttl += decoded.policy[0].ttl;

    if (!decoded.policy[1].ttl || decoded.policy[1].ttl == Infinity) noTTL = true;
    else ttl += decoded.policy[1].ttl;

    if (noTTL) {
      this.log.warn('revoking a session without a ttl means it stays in the revocation list forever');
      ttl = 0;
    }
    this.__cache_revoked_sessions.set(session.id, {
      reason: reason,
      id: session.id
    }, {
      ttl: ttl
    }, function (e) {
      callback(e);
    });

  } catch (e) {
    callback(e);
  }
};

SecurityService.prototype.sessionFromRequest = function (req, options) {

  var _this = this;

  if (req.happn_session != null)
    return req.happn_session; //pulled this somewhere else up the call stack

  if (!options) options = {};

  if (!options.tokenName) options.tokenName = 'happn_token';

  if (!options.cookieName && _this.config.cookieName)
    options.cookieName = _this.config.cookieName;

  if (!options.cookieName) options.cookieName = 'happn_token';

  var token = req.cookies.get(options.cookieName);

  // second try extract session from url query params
  if (token == null) {

    token = require('url')
      .parse(req.url, true)
      .query[options.tokenName];
  }

  //look at the auth headers
  if (!token && req.headers.authorization != null) {

    var authHeader = req.headers.authorization.split(' ');

    //bearer token
    if (authHeader[0].toLowerCase() == 'bearer')
      token = authHeader[1];

    //TODO: Basic / Digest ?
  }

  if (!token) return null;

  try {
    var session = this.happn.services.security.decodeToken(token);
    session.type = 0;
    return session;
  } catch (e) {
    return null;
  }
};

SecurityService.prototype.restoreSession = function (sessionId, callback) {

  if (!this.__sessionManagementActive) return callback(new Error('session management not activated'));

  //in case someone passed in the session
  if (sessionId.id) sessionId = sessionId.id;

  this.__cache_revoked_sessions.remove(sessionId, callback);
};

SecurityService.prototype.__logSessionActivity = function (sessionId, path, action, err, authorized, reason, callback) {

  var activityInfo = {
    path: path,
    action: action,
    id: sessionId,
    error: err ? err.toString() : '',
    authorized: authorized,
    reason: reason
  };

  this.__cache_session_activity.set(sessionId, activityInfo, callback);
};

SecurityService.prototype.__listCache = function (cacheName, filter, callback) {

  var _this = this;

  if (typeof filter == 'function') {
    callback = filter;
    filter = null;
  }

  if (!_this[cacheName]) return callback('cache with name ' + cacheName + ' does not exist');

  _this[cacheName].all(function (e, allItems) {

    if (e) return callback(e);

    try {

      if (filter) allItems = _this.happn.services.cache.filterCacheItems(filter, allItems);
      return callback(null, allItems);

    } catch (e) {
      return callback(e);
    }
  });
};

SecurityService.prototype.listSessionActivity = function (filter, callback) {

  if (typeof filter == 'function') {
    callback = filter;
    filter = null;
  }

  if (!this.config.logSessionActivity) return callback(new Error('session activity logging not activated'));

  return this.__listCache('__cache_session_activity', filter, callback);
};

SecurityService.prototype.listActiveSessions = function (filter, callback) {

  if (typeof filter == 'function') {
    callback = filter;
    filter = null;
  }

  if (!this.__sessionManagementActive) return callback(new Error('session management not activated'));

  this.happn.services.session.__activeSessions.all(filter, callback);
};

SecurityService.prototype.listRevokedSessions = function (filter, callback) {

  if (typeof filter == 'function') {
    callback = filter;
    filter = null;
  }

  if (!this.__sessionManagementActive) return callback(new Error('session management not activated'));

  return this.__cache_revoked_sessions.all(filter, callback);
};

SecurityService.prototype.offDataChanged = function (index) {
  delete this.__dataHooks[index];
};

SecurityService.prototype.onDataChanged = function (hook) {
  this.__dataHooks.push(hook);
  return this.__dataHooks.length - 1;
};

SecurityService.prototype.resetSessionPermissions = function(whatHappnd, changedData){

  var _this = this;

  return new Promise(function(resolve, reject){

    var effectedSessions = [];

    if (['link-group', 'unlink-group', 'delete-user', 'delete-group', 'upsert-group'].indexOf(whatHappnd) > -1) {

      _this.sessionService.each(function (sessionData, sessionCallback) {

        try {

          if (!sessionData.user) return sessionCallback();

          if (whatHappnd == 'link-group') {

            if (changedData._meta.path.indexOf('/_SYSTEM/_SECURITY/_USER/' + sessionData.user.username + '/_USER_GROUP/') == 0) {

              var groupName = changedData._meta.path.replace('/_SYSTEM/_SECURITY/_USER/' + sessionData.user.username + '/_USER_GROUP/', '');

              sessionData.user.groups[groupName] = changedData;
              sessionData.permissionSetKey = _this.generatePermissionSetKey(sessionData.user);

              effectedSessions.push({id:sessionData.id, username: sessionData.user.username});
            }
          }

          if (whatHappnd == 'upsert-group') {

            if (sessionData.user.groups[changedData.name]) {
              //push to effected
              effectedSessions.push({id:sessionData.id, username: sessionData.user.username});
            }
          }

          if (whatHappnd == 'unlink-group') {

            if (changedData.indexOf('/_SYSTEM/_SECURITY/_USER/' + sessionData.user.username + '/_USER_GROUP/') == 0) {

              var groupName = changedData.replace('/_SYSTEM/_SECURITY/_USER/' + sessionData.user.username + '/_USER_GROUP/', '');
              delete sessionData.user.groups[groupName];

              sessionData.permissionSetKey = _this.generatePermissionSetKey(sessionData.user);

              effectedSessions.push({id:sessionData.id, username: sessionData.user.username});
            }
          }

          if (whatHappnd == 'delete-user') {

            var userName = changedData.obj._meta.path.replace('/_SYSTEM/_SECURITY/_USER/', '');

            if (sessionData.user.username == userName) {
              _this.sessionService.disconnectSession(sessionData.id, {
                reason: 'security directory update: user deleted'
              });

              effectedSessions.push({id:sessionData.id, username: sessionData.user.username});
            }
          }

          if (whatHappnd == 'delete-group') {

            if (sessionData.user.groups[changedData.obj.name]) {
              delete sessionData.user.groups[changedData.obj.name];
              sessionData.permissionSetKey = _this.generatePermissionSetKey(sessionData.user);

              effectedSessions.push({id:sessionData.id, username: sessionData.user.username});
            }
          }

          sessionCallback();

        } catch (e) {
          sessionCallback(e);
        }

      }, function (e) {
        if (e) return reject(e);
        resolve(effectedSessions);
      });
    } else resolve();

  });
};

SecurityService.prototype.emitChanges = function(whatHappnd, changedData, effectedSessions){

  var _this = this;

  return new Promise(function(resolve, reject){

    try{

      var changedDataSerialized = null;
      var effectedSessionsSerialized = null;

      if (changedData) changedDataSerialized = JSON.stringify(changedData);
      if (effectedSessions) effectedSessionsSerialized = JSON.stringify(effectedSessions);

      _this.__dataHooks.every(function (hook) {
        return hook.apply(hook, [whatHappnd, JSON.parse(changedDataSerialized), JSON.parse(effectedSessionsSerialized)]);
      });

      resolve();
    }catch(e){
      reject(e);
    }
  });
};

SecurityService.prototype.dataChanged = function (whatHappnd, changedData, additionalInfo, callback) {

  var _this = this;

  _this.users.clearCaches()
    .then(function(){
      return _this.resetSessionPermissions(whatHappnd, changedData, additionalInfo);
    })
    .then(function(effectedSessions){
      return _this.checkpoint.clearCaches(effectedSessions);
    })
    .then(function(effectedSessions){
      return _this.emitChanges(whatHappnd, changedData, effectedSessions, additionalInfo);
    })
    .then(function(){
      if (callback) callback();
    })
    .catch(function(e){
      _this.happn.services.error.handleFatal('failure updating cached security data', e);
    });
};

SecurityService.prototype.checkToken = function (token) {
  try {
    this.decodeToken(token);
    return true;
  } catch (e) {
    return false;
  }
};

SecurityService.prototype.decodeToken = function (token) {
  try {

    if (!token) throw new Error('missing session token');

    var decoded = jwt.decode(token, this.config.sessionTokenSecret);
    var unpacked = require('jsonpack').unpack(decoded);

    return unpacked;

  } catch (e) {
    throw new Error('invalid session token');
  }
};

SecurityService.prototype.generatePermissionSetKey = function (user) {

  if (!user.groups) return '';

  return Object.keys(user.groups).reduce(function (key, groupName) {
    return key += '/' + groupName + '/';
  }, '');

};

SecurityService.prototype.generateEmptySession = function (id) {

  if (!id) id = uuid.v4();

  return {
    id: id
  };
};

/**
 takes a login request - and matches the request to a session, the session is then encoded with its associated policies
 into a JWT token. There are 2 policies, 1 a stateful one and 0 a stateless one, they can only be matched back during session
 requests.
 */

SecurityService.prototype.__profileSession = function (session) {
  var _this = this;

  session.policy = {
    0: null,
    1: null
  };

  //we dont want to mess around with the actual sessions type
  //it is an unknown at this point
  var decoupledSession = _this.happn.services.utils.clone(session);

  for (var profileIndex in _this.__cache_Profiles) {

    if (session.policy[0] != null && session.policy[1] != null) break;

    var filter = _this.__cache_Profiles[profileIndex].session;

    [0, 1].forEach(function (sessionType) {

      if (session.policy[sessionType]) return;

      decoupledSession.type = sessionType;

      var profileMatch = sift(filter, [decoupledSession]);

      if (profileMatch.length == 1) session.policy[sessionType] = _this.__cache_Profiles[profileIndex].policy;

    });
  }

  if (session.policy[0] != null || session.policy[1] != null) return;

  throw new Error('unable to match session with a profile'); //this should never happen

};

SecurityService.prototype.generateToken = function (session) {

  var decoupledSession = this.happn.services.utils.clone(session);

  decoupledSession.type = 0; //always stateless
  decoupledSession.isToken = true;

  delete decoupledSession.user;

  if (session.user && session.user.username) decoupledSession.username = session.user.username;

  var packed = require('jsonpack').pack(decoupledSession);

  return jwt.encode(packed, this.config.sessionTokenSecret);

};

SecurityService.prototype.generateSession = function (user, sessionId, credentials, callback) {

  var session = this.generateEmptySession(sessionId);

  session.info = credentials.info;
  session.type = 1; //stateful
  session.user = user;
  session.timestamp = Date.now();

  session.isEncrypted = credentials.isEncrypted ? true : false;

  session.origin = this.happn.services.system.name;

  //TODO - THIS IS AN ISSUE - WHAT IF PERMISSIONS CHANGE
  //TODO - we want a really small token

  this.__profileSession(session); //session ttl, activity threshold and user effective permissions are set here

  session.permissionSetKey = this.generatePermissionSetKey(session.user, session);

  session.token = this.generateToken(session);

  // It is not possible for the login (websocket call) to assign the session token (cookie) server side,
  // so the cookie is therefore created in the browser upon login success.
  // It is necessary to include how to make the cookie in the login reply via this session object.
  if (this.config.cookieName) session.cookieName = this.config.cookieName;
  if (this.config.cookieDomain) session.cookieDomain = this.config.cookieDomain;

  if (session.isEncrypted) session.secret = require('shortid').generate();

  callback(null, session);
};

//so external services can use this
SecurityService.prototype.matchPassword = function (password, hash, callback) {
  this.cryptoService.verifyHash(password, hash, callback);
};

SecurityService.prototype.__cache_Profiles = null;

SecurityService.prototype.__initializeProfiles = function (config, callback) {

  var _this = this;

  return new Promise(function(resolve, reject) {

    try{
      if (!config.profiles) config.profiles = [];

      config.profiles.push({
        name: "default-browser", // this is the default underlying profile for stateful sessions
        session: {
          $and: [{
            info: {
              _browser: {
                $eq: true
              }
            }
          }]
        },
        policy: {
          ttl: '7 days', //a week
          inactivity_threshold: '1 hour'
        }
      });

      config.profiles.push({
        name: "default-stateful", // this is the default underlying profile for stateful sessions
        session: {
          $and: [{
            type: {
              $eq: 1
            }
          }]
        },
        policy: {
          ttl: 0, //session never goes stale
          inactivity_threshold: Infinity
        }
      });

      config.profiles.push({
        name: "default-stateless", // this is the default underlying profile for stateless sessions (REST
        session: {
          $and: [{
            type: {
              $eq: 0
            }
          }]
        },
        policy: {
          ttl: 0, //session never goes stale
          inactivity_threshold: Infinity
        }
      });

      config.profiles.forEach(function (profile) {
        if (profile.policy.ttl && profile.policy.ttl != Infinity) profile.policy.ttl = _this.happn.services.utils.toMilliseconds(profile.policy.ttl);
        if (profile.policy.inactivity_threshold && profile.policy.ttl != Infinity) profile.policy.inactivity_threshold = _this.happn.services.utils.toMilliseconds(profile.policy.inactivity_threshold);
      });

      _this.__cache_Profiles = config.profiles;

      resolve();

    }catch(e){
      reject(e);
    }
  });
};

SecurityService.prototype.__loginOK = function (credentials, user, sessionId, callback) {

  delete user['password'];

  return this.generateSession(user, sessionId, credentials, callback);
};

SecurityService.prototype.__checkLockedOut = function (username, callback) {

  var _this = this;

  if (!_this.config.accountLockout || !_this.config.accountLockout.enabled) return callback(null, false);

  if (!username) return callback(null, false);

  _this.__locks.get(username, function (e, existingLock) {

    if (e) return callback(e);
    callback(null, (existingLock != null && existingLock.attempts >= _this.config.accountLockout.attempts));
  });
};

SecurityService.prototype.__loginFailed = function (username, specificMessage, e, callback, overrideLockout) {

  var _this = this;

  var message = 'Invalid credentials';

  if (specificMessage) message = specificMessage;

  if (e) {
    if (e.message) message = message + ': ' + e.message;
    else message = message + ': ' + e.toString();
  }

  if (_this.config.accountLockout && _this.config.accountLockout.enabled && !overrideLockout) {

    return _this.__locks.get(username, function (e, currentLock) {

      if (e) return callback(e);

      if (!currentLock) currentLock = {
        attempts: 0
      };

      currentLock.attempts++;

      _this.__locks.set(username, currentLock, {
        ttl: _this.config.accountLockout.retryInterval
      });

      callback(_this.happn.services.error.InvalidCredentialsError(message));
    });
  }

  return callback(_this.happn.services.error.InvalidCredentialsError(message));
};

SecurityService.prototype.login = function (credentials, sessionId, callback) {

  var _this = this;

  var username = credentials.username ? credentials.username : '';

  if (typeof sessionId === 'function') {
    callback = sessionId;
    sessionId = null;
  }

  _this.__checkLockedOut(credentials.username, function (e, locked) {

    if (e) return callback(e);

    if (locked) return callback(_this.happn.services.error.AccessDeniedError('Account locked out'));

    if ((credentials.username && (credentials.password || credentials.digest)) || credentials.token) {

      if (credentials.token) {

        try {

          var previousSession = _this.decodeToken(credentials.token);

          var previousPolicy = previousSession.policy[1]; //always the stateful policy

          username = previousSession.username;

          if (previousPolicy.disallowTokenLogins)
            throw new Error('logins with this token are disallowed by policy');

          if (previousPolicy.lockTokenToOrigin && previousSession.origin != _this.happn.services.system.name)
            throw new Error('this token is locked to a different origin by policy');

          return _this.authorize(previousSession, null, 'login', function (e, authorized, reason) {

            if (e) return _this.__loginFailed(previousSession.username, 'Invalid credentials', e, callback, true);

            if (!authorized) return _this.__loginFailed(previousSession.username, reason, null, callback, true);

            _this.users.getUser(previousSession.username, function (e, user) {

              if (user == null) return _this.__loginFailed(previousSession.username, 'Invalid credentials', null, callback, true);

              return _this.__loginOK(credentials, user, sessionId, callback);
            });
          });

        } catch (e) {
          return _this.__loginFailed(username, 'Invalid credentials', e, callback);
        }

      } else return _this.users.getUser(credentials.username, function (e, user) {

        if (e) return callback(e);

        if (user == null) return _this.__loginFailed(credentials.username, 'Invalid credentials', null, callback);

        if (credentials.digest) {

          if (user.publicKey != credentials.publicKey) return _this.__loginFailed(credentials.username, 'Invalid credentials', null, callback);

          return _this.verifyAuthenticationDigest(credentials, function (e, valid) {

            if (e) return callback(e);

            if (!valid) return _this.__loginFailed(credentials.username, 'Invalid credentials', null, callback);

            return _this.__loginOK(credentials, user, sessionId, callback);
          });
        }

        _this.users.getPasswordHash(credentials.username, function (e, hash) {

          if (e) {

            if (e.toString() == 'Error: ' + credentials.username + ' does not exist in the system') return _this.__loginFailed(credentials.username, 'Invalid credentials', null, callback);
            return callback(e);
          }

          _this.matchPassword(credentials.password, hash, function (e, match) {

            if (e) return callback(e);

            if (!match)
              return _this.__loginFailed(credentials.username, 'Invalid credentials', null, callback);

            return _this.__loginOK(credentials, user, sessionId, callback);

          });
        });
      });

    } else callback(_this.happn.services.error.InvalidCredentialsError('Invalid credentials'));
  });
};

/**
 * creates a nonce, then saves the nonce and the requestors public key to the nonce cache for future verification
 */
SecurityService.prototype.createAuthenticationNonce = function (request, callback) {

  var _this = this;

  if (!request.publicKey) return callback(new Error('no public key with request'));

  var nonce = this.cryptoService.generateNonce();

  _this.cacheService.set(request.publicKey, nonce, {
    cache: 'security_authentication_nonce',
    ttl: this.config.defaultNonceTTL
  }, function (e) {

    if (e) return callback(e);
    else callback(null, nonce);

  });
};

/**
 * checks the incoming requests digest against a nonce that is cached via the public key of the request, calls back with true or false depending on
 * whether the digest and nonce are related by the same private key.
 */
SecurityService.prototype.verifyAuthenticationDigest = function (request, callback) {

  var _this = this;

  if (!request.publicKey) return callback(new Error('no publicKey in request'));
  if (!request.digest) return callback(new Error('no digest in request'));

  _this.cacheService.get(request.publicKey, {
    cache: 'security_authentication_nonce'
  }, function (e, nonce) {

    if (e) return callback(e);
    if (!nonce) return callback(new Error('nonce expired or public key invalid'));

    try {
      var verified = _this.cryptoService.verify(nonce, request.digest, request.publicKey);
      callback(null, verified);
    } catch (e) {
      callback(e);
    }
  });
};

SecurityService.prototype.authorize = function (session, path, action, callback) {

  var _this = this;

  var completeCall = function (err, authorized, reason) {
    callback(err, authorized, reason);
    if (_this.config.logSessionActivity) _this.__logSessionActivity(session.id, path, action, err, authorized, reason, function (e) {
      if (e) _this.log.warn('unable to log session activity: ' + e.toString());
    });
  };

  _this.__checkRevocations(session.id, function (e, authorized, reason) {

    if (e) return callback(e);

    if (!authorized) return completeCall(null, false, reason);

    _this.checkpoint._authorizeSession(session, path, action, function (e, authorized, reason, passthrough) { //check the session ttl, expiry,permissions etc.

      if (e) return callback(e);

      if (!authorized) return completeCall(null, false, reason);

      if (passthrough || session.bypassAuthUser) return completeCall(null, true);

      _this.checkpoint._authorizeUser(session, path, action, completeCall);
    });
  });
};

SecurityService.prototype.stop = function (options, callback) {

  if (this.__locks) this.__locks.clear();
  if (this.__cache_session_activity) this.__cache_session_activity.clear();
  if (this.__cache_revoked_sessions) this.__cache_revoked_sessions.clear();

  callback();
};

SecurityService.prototype.safe = function () {
  var _this = this;

  return {
    login: _this.login.bind(_this),
    generateSession: _this.generateSession.bind(_this),
    checkToken: _this.checkToken.bind(_this),
    authorize: _this.authorize.bind(_this),
    AccessDeniedError: _this.services.happn.error.AccessDeniedError.bind(_this),
    onDataChanged: _this.onDataChanged.bind(_this),
    offDataChanged: _this.offDataChanged.bind(_this),
    generatePermissionSetKey: _this.generatePermissionSetKey.bind(_this),
    generateEmptySession: _this.generateEmptySession.bind(_this),
    createAuthenticationNonce: _this.createAuthenticationNonce.bind(_this),
    verifyAuthenticationDigest: _this.verifyAuthenticationDigest.bind(_this),
    activateSessionManagement: _this.activateSessionManagement.bind(_this),
    sessionManagementActive: _this.sessionManagementActive.bind(_this),
    revokeSession: _this.revokeSession.bind(_this),
    restoreSession: _this.restoreSession.bind(_this),
    addActiveSession: _this.addActiveSession.bind(_this),
    removeActiveSession: _this.removeActiveSession.bind(_this),
    listSessionActivity: _this.listSessionActivity.bind(_this),
    listActiveSessions: _this.listActiveSessions.bind(_this),
    listRevokedSessions: _this.listRevokedSessions.bind(_this)
  }
};
