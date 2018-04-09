var LRU = require("lru-cache");
var async = require("async");
var Promise = require("bluebird");

module.exports = CheckPoint;

function CheckPoint(opts) {

  this.log = opts.logger.createLogger('CheckPoint');
  this.log.$$TRACE('construct(%j)', opts);

  if (!opts.permissionCache) opts.permissionCache = {
    max: 1000,
    maxAge: 0
  };

  if (!opts.expiry_grace) opts.expiry_grace = 60; //default expiry grace of 1 minute

  if (!opts.groupPermissionsPolicy) opts.groupPermissionsPolicy = 'most_restrictive';

  this.opts = opts;

  this.__permissionSets = LRU(opts.permissionCache); //LRU keyed by sessionid ordered alphabetically - pointing to permissions dictionary
  this.__permissionCache = LRU(opts.permissionCache); //LRU cache - configurable in size, keyed by permissionSetKey + path + action, result either true or false
}

CheckPoint.prototype.clearCaches = function (effectedSessions) {

  var _this = this;

  return new Promise(function (resolve, reject) {

    try {

      if (_this.__permissionSets)  _this.__permissionSets.reset();
      if (_this.__permissionCache)  _this.__permissionCache.reset();

      _this.__permissionSets = LRU(_this.opts.permissionCache); //clear the permission set cache
      _this.__permissionCache = LRU(_this.opts.permissionCache); //clear permission cache

      resolve(effectedSessions); //passing effected sessions through
    } catch (e) {
      reject(e);
    }
  })
};

CheckPoint.prototype.__authorizedAction = function (action, permission) {

  for (var permissableActionIndex in permission.actions) {
    if (permission.actions[permissableActionIndex] == action || permission.actions[permissableActionIndex] == '*')
      return true;
  }

  return false;
};

CheckPoint.prototype.__authorized = function (permissionSet, path, action) {

  for (var permissionPath in permissionSet.explicit) {

    if (permissionPath == path) {
      if (this.__authorizedAction(action, permissionSet.explicit[permissionPath])) return true;
    }
  }

  for (var permissionPath in permissionSet.wildcard) {

    if (this.securityService.happn.services.utils.wildcardMatch(permissionPath, path)) {
      if (this.__authorizedAction(action, permissionSet.wildcard[permissionPath]))
        return true;
    }
  }

  return false;
};

CheckPoint.prototype.__createPermissionSet = function (permissions) {

  var _this = this;
  var permissionSet = {
    explicit: {},
    wildcard: {}
  };

  for (var permissionPath in permissions) {
    if (permissionPath.indexOf('*') > -1) permissionSet.wildcard[permissionPath] = permissions[permissionPath];
    else permissionSet.explicit[permissionPath] = permissions[permissionPath];
  }
  permissionSet.wildcard = _this.securityService.happn.services.utils.wildcardAggregate(permissionSet.wildcard);

  return permissionSet;
};

CheckPoint.prototype.__loadPermissionSet = function (identity, callback) {

  var _this = this;

  var permissionSet = _this.__permissionSets.get(identity.permissionSetKey);

  if (permissionSet) return callback(null, permissionSet);

  var permissions = {};

  async.each(Object.keys(identity.user.groups), function (groupName, eachCB) {

    _this.securityService.users.getGroup(groupName, {}, function (e, group) {

      if (e) return eachCB(e);

      for (var permissionPath in group.permissions)
        permissions[permissionPath] = group.permissions[permissionPath];

      eachCB();
    });

  }, function (e) {

    if (e) return callback(e);

    permissionSet = _this.__createPermissionSet(permissions);

    _this.__permissionSets.set(identity.permissionSetKey, permissionSet);

    callback(null, permissionSet);
  });
};

CheckPoint.prototype.__constructPermissionSet = function (session, callback) {

  var _this = this;

  if (session.isToken) { //we are dealing with a decoded token, re-fetch the user

    _this.securityService.users.getUser(session.username, function (e, user) {

      if (e) return callback(e);

      if (user == null) return callback(_this.errorService.AccessDeniedError('user ' + session.username + ' has been deleted or does not exist'));

      _this.__loadPermissionSet({
        id: session.id,
        user: user,
        permissionSetKey: _this.securityService.generatePermissionSetKey(user)
      }, callback);
    });
  } else {
    _this.__loadPermissionSet(session, callback);
  }
};

CheckPoint.prototype.initialize = function (config, securityService, callback) {
  var _this = this;

  try {

    _this.securityService = securityService;
    _this.cacheService = _this.happn.services.cache;
    _this.errorService = _this.happn.services.error;
    _this.sessionService = _this.happn.services.session;

    _this.__checkpoint_usage_limit = _this.cacheService.new('checkpoint_usage_limit');
    _this.__checkpoint_inactivity_threshold = _this.cacheService.new('checkpoint_inactivity_threshold');

    _this.sessionService.on('client-disconnect', function (sessionId) {

      _this.__checkpoint_usage_limit.remove(sessionId);
      _this.__checkpoint_inactivity_threshold.remove(sessionId);
    });

    callback();
  } catch (e) {
    callback(e);
  }
};

CheckPoint.prototype.__checkInactivity = function (session, policy, callback) {

  var _this = this;

  if (policy.inactivity_threshold <= 0 || policy.inactivity_threshold == Infinity || policy.inactivity_threshold == null || policy.inactivity_threshold == undefined) return callback(null, true);

  var now = Date.now();

  var doSet = function () {
    _this.__checkpoint_inactivity_threshold.set(session.id, now, {
      ttl: policy.inactivity_threshold
    }, function (e) {

      if (e) return callback(e);
      else callback(null, true);
    });
  };

  _this.__checkpoint_inactivity_threshold.get(session.id, function (e, value) {

    if (e) return callback(e);

    if (value == null || value == undefined) {
      if (now - session.timestamp > policy.inactivity_threshold) return callback(null, false);
      if (now - session.timestamp < policy.inactivity_threshold) doSet();
    } else {
      if (now - value > policy.inactivity_threshold) return callback(null, false);
      if (now - value < policy.inactivity_threshold) doSet();
    }
  });
};

CheckPoint.prototype.__checkUsageLimit = function (session, policy, callback) {

  var _this = this;

  if (policy.usage_limit == null || policy.usage_limit <= 0 || policy.usage_limit == Infinity) return callback(null, true);

  var ttl = session.ttl - (Date.now() - session.timestamp); //calculate how much longer our session is valid for

  _this.__checkpoint_usage_limit.get(session.id, {
    default: {
      value: 0,
      ttl: ttl
    }
  }, function (e, value) {

    if (e) return callback(e);

    if (value >= policy.usage_limit) return callback(null, false);
    else {
      _this.__checkpoint_usage_limit.increment(session.id, 1, function (e) {
        if (e) return callback(e);
        callback(null, true);
      });
    }
  });
};

CheckPoint.prototype.__checkSessionPermissions = function (policy, path, action) {
  var permissionSet = this.__createPermissionSet(policy.permissions);

  return this.__authorized(permissionSet, path, action);
};

CheckPoint.prototype._authorizeSession = function (session, path, action, callback) {

  try {

    var _this = this;

    var policy = session.policy[session.type];

    if (!policy) return callback(null, false, 'no policy for session type: ' + session.type);

    if (policy.ttl > 0 && (Date.now()) > session.timestamp + policy.ttl) return callback(null, false, 'expired session token');

    _this.__checkInactivity(session, policy, function (e, ok) {

      if (e) return callback(e);
      if (!ok) return callback(null, false, 'session inactivity threshold reached');

      _this.__checkUsageLimit(session, policy, function (e, ok) {

        if (e) return callback(e);
        if (!ok) return callback(null, false, 'session usage limit reached');

        if (policy.permissions) {

          // this allows the caller to circumvent any further calls through the security layer
          // , idea here is that we can have tokens that have permission to do a very specific thing
          // but we also allow for a fallback to the original session users permissions
          var passthrough = _this.__checkSessionPermissions(policy, path, action);


          if (passthrough) return callback(null, true, null, true);
          else return callback(null, false, 'token permissions limited');
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

CheckPoint.prototype._authorizeUser = function (session, path, action, callback) {

  try {

    var _this = this;
    var permissionCacheKey = session.id + path + action;
    var authorized = this.__permissionCache.get(permissionCacheKey);

    if (authorized === undefined) {

      _this.__constructPermissionSet(session, function (e, permissionSet) {

        if (e) return callback(e);

        authorized = _this.__authorized(permissionSet, path, action);
        _this.__permissionCache.set(permissionCacheKey, authorized);

        return callback(null, authorized);
      });

    } else return callback(null, authorized);

  } catch (e) {
    callback(e);
  }
};
