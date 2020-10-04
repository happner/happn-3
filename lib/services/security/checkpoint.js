const async = require('async');
const handlebars = require('handlebars');
const CONSTANTS = require('../..').constants;
const PermissionsTree = require('./permissions-tree');

module.exports = CheckPoint;

function CheckPoint(opts) {
  this.log = opts.logger.createLogger('CheckPoint');
  this.log.$$TRACE('construct(%j)', opts);

  String.prototype.count = function(chr) {
    let count = 0,
      first = this.indexOf(chr);
    if (first === -1) return 0; // return 0 if there are no occurences
    let c = chr.charAt(0); // we save some time here
    for (let i = first; i < this.length; ++i) if (c === this.charAt(i)) ++count;
    return count;
  };
}

CheckPoint.prototype.initialize = function(config, securityService, callback) {
  try {
    this.config = config;

    this.securityService = securityService;
    this.cacheService = this.happn.services.cache;
    this.errorService = this.happn.services.error;
    this.sessionService = this.happn.services.session;
    this.utilsService = this.happn.services.utils;

    if (!config.__cache_checkpoint_authorization)
      config.__cache_checkpoint_authorization = {
        max: 5000,
        maxAge: 0
      };

    if (!config.__cache_compiled_permissions_templates)
      config.__cache_compiled_permissions_templates = {
        max: 2500,
        maxAge: 0
      };

    if (!config.__cache_checkpoint_permissionset)
      config.__cache_checkpoint_permissionset = config.__cache_checkpoint_authorization;

    if (!config.expiry_grace) config.expiry_grace = 60; //default expiry grace of 1 minute

    if (!config.groupPermissionsPolicy) config.groupPermissionsPolicy = 'most_restrictive';

    this.__cache_checkpoint_permissionset = this.cacheService.new(
      'checkpoint_cache_permissionset',
      {
        type: 'LRU',
        cache: config.__cache_checkpoint_permissionset
      }
    );

    this.__cache_checkpoint_permissionset_token = this.cacheService.new(
      'checkpoint_cache_permissionset_token',
      {
        type: 'LRU',
        cache: config.__cache_checkpoint_permissionset
      }
    );

    this.__cache_checkpoint_authorization = this.cacheService.new(
      'checkpoint_cache_authorization',
      {
        type: 'LRU',
        cache: config.__cache_checkpoint_authorization
      }
    );

    this.__cache_checkpoint_authorization_token = this.cacheService.new(
      'checkpoint_cache_authorization_token',
      {
        type: 'LRU',
        cache: config.__cache_checkpoint_authorization
      }
    );

    this.__cache_compiled_permissions_templates = this.cacheService.new(
      'checkpoint_compiled_permissions_templates',
      {
        type: 'LRU',
        cache: config.__cache_compiled_permissions_templates
      }
    );

    this.__checkpoint_usage_limit = this.cacheService.new('checkpoint_usage_limit');
    this.__checkpoint_inactivity_threshold = this.cacheService.new(
      'checkpoint_inactivity_threshold'
    );

    this.sessionService.on(
      'client-disconnect',
      function(sessionId) {
        this.__checkpoint_usage_limit.remove(sessionId);
        this.__checkpoint_inactivity_threshold.remove(sessionId);
      }.bind(this)
    );

    callback();
  } catch (e) {
    callback(e);
  }
};

CheckPoint.prototype.stop = function() {
  if (this.__cache_checkpoint_permissionset) this.__cache_checkpoint_permissionset.clear();
  if (this.__cache_checkpoint_permissionset) this.__cache_checkpoint_permissionset_token.clear();
  if (this.__cache_checkpoint_authorization) this.__cache_checkpoint_authorization.clear();
  if (this.__cache_checkpoint_authorization_token)
    this.__cache_checkpoint_authorization_token.clear();
  if (this.__cache_compiled_permissions_templates)
    this.__cache_compiled_permissions_templates.clear();
  if (this.__checkpoint_inactivity_threshold) this.__checkpoint_inactivity_threshold.clear();
  if (this.__checkpoint_usage_limit) this.__checkpoint_usage_limit.clear();
};

CheckPoint.prototype.clearCaches = function(effectedSessions) {
  return new Promise((resolve, reject) => {
    try {
      if (this.__cache_checkpoint_authorization) this.clearAuthorizationCache(effectedSessions);
      if (this.__cache_checkpoint_permissionset) this.clearPermissionSetCache(effectedSessions);
      //token based session changes have to be bludgeoned
      this.__cache_checkpoint_permissionset_token.clear();
      this.__cache_checkpoint_authorization_token.clear();
      resolve(effectedSessions); //remember to pass effected sessions through
    } catch (e) {
      reject(e);
    }
  });
};

CheckPoint.prototype.clearPermissionSetCache = function(effectedSessions) {
  effectedSessions.forEach(session => {
    if (session.previousPermissionSetKey != null) {
      this.__cache_checkpoint_permissionset.remove(session.previousPermissionSetKey);
    }
  });
};

CheckPoint.prototype.clearAuthorizationCache = function(effectedSessions) {
  const effectedSessionIds = effectedSessions.map(session => session.id);
  this.__cache_checkpoint_authorization
    .keys()
    .filter(key => {
      return effectedSessionIds.indexOf(key.split(':').shift()) >= 0;
    })
    .forEach(key => {
      this.__cache_checkpoint_authorization.remove(key);
    });
};

CheckPoint.prototype.__authorizedAction = function(action, permission) {
  for (let permissableAction of permission.actions) {
    if (permissableAction === action || permissableAction === '*') return true;
  }

  return false;
};

CheckPoint.prototype.__authorized = function(permissionSet, path, action) {
  const permissions = permissionSet.search(path);
  if (permissions.length === 0) return false;
  if (permissions.indexOf(`!${action}`) > -1 || permissions.indexOf('!*') > -1) return false;
  return permissions.indexOf(action) > -1 || permissions.indexOf('*') > -1;
};

CheckPoint.prototype.__compilePermissionsTemplate = function(permissionPath, identity) {
  let cachedTemplate = this.__cache_compiled_permissions_templates.getSync(permissionPath);

  if (!cachedTemplate) {
    cachedTemplate = handlebars.compile(permissionPath, { strict: true });
    this.__cache_compiled_permissions_templates.setSync(permissionPath, cachedTemplate, {
      clone: false
    });
  }

  try {
    let replacedPath = cachedTemplate(identity);
    //prevents any exploit where the session data is updated with a * value
    if (replacedPath.count('*') > permissionPath.count('*')) {
      this.log.warn(
        'illegal promotion of permissions via permissions template, permissionPath' +
          permissionPath +
          ', replaced path: ' +
          replacedPath
      );
      return null;
    }
    return replacedPath;
  } catch (e) {
    this.log.warn('missing data for permissions template: ' + permissionPath);
    return null;
  }
};

CheckPoint.prototype.__createPermissionSet = function(permissions, identity) {
  return PermissionsTree.create(
    Object.keys(permissions).reduce((permissionSet, rawPath) => {
      let templatedPath = rawPath.toString();
      if (rawPath.indexOf('{{') > -1) {
        templatedPath = this.__compilePermissionsTemplate(rawPath, identity);
        if (templatedPath == null) return permissionSet; //we skip templated paths that dont have matching properties in the identity
      }
      permissionSet[templatedPath] = permissions[rawPath];
      return permissionSet;
    }, {}),
    this.utilsService
  );
};

CheckPoint.prototype.__loadPermissionSet = function(identity, callback) {
  const permissionSetCache = identity.isToken
    ? this.__cache_checkpoint_permissionset_token
    : this.__cache_checkpoint_permissionset;
  let permissionSet = permissionSetCache.getSync(identity.permissionSetKey);
  if (permissionSet) {
    return callback(null, permissionSet);
  }
  let permissions = {};
  async.eachLimit(
    Object.keys(identity.user.groups),
    50,
    (groupName, eachCB) => {
      this.securityService.groups.getGroup(groupName, {}, (e, group) => {
        if (e) return eachCB(e);
        if (group == null) return eachCB();
        for (let permissionPath in group.permissions)
          permissions[permissionPath] = group.permissions[permissionPath];
        eachCB();
      });
    },
    e => {
      if (e) return callback(e);
      permissionSet = this.__createPermissionSet(permissions, identity);
      permissionSetCache.setSync(identity.permissionSetKey, permissionSet, {
        clone: false
      });
      callback(null, permissionSet);
    }
  );
};

CheckPoint.prototype.__constructPermissionSet = function(session, callback) {
  if (!session.isToken) return this.__loadPermissionSet(session, callback);

  // we fetch a fresh user, and construct a permissionset key on the fly
  this.securityService.users.getUser(session.username, (e, user) => {
    if (e) return callback(e);
    if (user == null)
      return callback(
        this.errorService.AccessDeniedError(
          'user ' + session.username + ' has been deleted or does not exist'
        )
      );

    return this.__loadPermissionSet(
      {
        id: session.id,
        happn: session.happn,
        user: user,
        permissionSetKey: this.securityService.generatePermissionSetKey(user),
        isToken: session.isToken
      },
      callback
    );
  });
};

CheckPoint.prototype.__checkInactivity = function(session, policy, callback) {
  if (!policy.inactivity_threshold || policy.inactivity_threshold === Infinity)
    return callback(null, true);

  let now = Date.now();

  let doSet = () => {
    this.__checkpoint_inactivity_threshold.set(
      session.id,
      now,
      {
        ttl: policy.inactivity_threshold
      },
      e => {
        if (e) return callback(e);
        else callback(null, true);
      }
    );
  };

  this.__checkpoint_inactivity_threshold.get(session.id, (e, value) => {
    if (e) return callback(e);

    if (value == null || value === undefined) {
      if (now - session.timestamp > policy.inactivity_threshold) return callback(null, false);
      if (now - session.timestamp < policy.inactivity_threshold) doSet();
    } else {
      if (now - value > policy.inactivity_threshold) return callback(null, false);
      if (now - value < policy.inactivity_threshold) doSet();
    }
  });
};

CheckPoint.prototype.__checkUsageLimit = function(session, policy, callback) {
  if (!policy.usage_limit || policy.usage_limit === Infinity) return callback(null, true);

  let ttl = session.ttl - (Date.now() - session.timestamp); //calculate how much longer our session is valid for

  this.__checkpoint_usage_limit.get(
    session.id,
    {
      default: {
        value: 0,
        ttl: ttl
      }
    },
    (e, value) => {
      if (e) return callback(e);

      if (value >= policy.usage_limit) return callback(null, false);
      else {
        this.__checkpoint_usage_limit.increment(session.id, 1, function(e) {
          if (e) return callback(e);
          callback(null, true);
        });
      }
    }
  );
};

CheckPoint.prototype.__checkSessionPermissions = function(policy, path, action, session) {
  let permissionSet = this.__createPermissionSet(policy.permissions, session);

  return this.__authorized(permissionSet, path, action);
};

CheckPoint.prototype._authorizeSession = function(session, path, action, callback) {
  try {
    if (session.policy == null)
      return callback(null, false, CONSTANTS.UNAUTHORISED_REASONS.NO_POLICY_SESSION);
    let policy = session.policy[session.type];
    if (!policy)
      return callback(null, false, CONSTANTS.UNAUTHORISED_REASONS.NO_POLICY_SESSION_TYPE);
    if (policy.ttl > 0 && Date.now() > session.timestamp + policy.ttl)
      return callback(null, false, CONSTANTS.UNAUTHORISED_REASONS.EXPIRED_TOKEN);

    this.__checkInactivity(session, policy, (e, ok) => {
      if (e) return callback(e);
      if (!ok)
        return callback(null, false, CONSTANTS.UNAUTHORISED_REASONS.INACTIVITY_THRESHOLD_REACHED);

      this.__checkUsageLimit(session, policy, (e, ok) => {
        if (e) return callback(e);
        if (!ok) return callback(null, false, CONSTANTS.UNAUTHORISED_REASONS.SESSION_USAGE);

        if (policy.permissions) {
          // this allows the caller to circumvent any further calls through the security layer
          // , idea here is that we can have tokens that have permission to do a very specific thing
          // but we also allow for a fallback to the original session users permissions
          if (this.__checkSessionPermissions(policy, path, action, session))
            return callback(null, true, null, true);
          return callback(null, false, 'token permissions limited');
        }

        //passthrough happens, as a token has been used to do a login re-attempt
        if (action === 'login') return callback(null, true, null, true);
        callback(null, true);
      });
    });
  } catch (e) {
    callback(e);
  }
};

CheckPoint.prototype._authorizeUser = function(session, path, action, callback) {
  let permissionCacheKey = `${session.id}:${path}:${action}`;
  const authorizationCache = session.isToken
    ? this.__cache_checkpoint_authorization_token
    : this.__cache_checkpoint_authorization;
  let authorized = authorizationCache.getSync(permissionCacheKey);

  if (authorized != null) return callback(null, authorized);

  return this.__constructPermissionSet(session, (e, permissionSet) => {
    if (e) return callback(e);

    authorized = this.__authorized(permissionSet, path, action);
    authorizationCache.setSync(permissionCacheKey, authorized, { clone: false });

    return callback(null, authorized);
  });
};
