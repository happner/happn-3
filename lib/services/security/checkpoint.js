var LRU = require("lru-cache");
var async = require("async");
var Promise = require("bluebird");
var handlebars = require('handlebars');

module.exports = CheckPoint;

function CheckPoint(opts) {

  this.log = opts.logger.createLogger('CheckPoint');
  this.log.$$TRACE('construct(%j)', opts);

  String.prototype.count = function(chr) {
    var count = 0, first = this.indexOf(chr);
    if (first == -1) return 0;// return 0 if there are no occurences
    c = chr.charAt(0); // we save some time here
    for(var i = first; i < this.length; ++i)
        if(c === this.charAt(i)) ++count;

    return count;
  };
}

CheckPoint.prototype.clearCaches = function (effectedSessions) {

  var _this = this;

  return new Promise(function (resolve, reject) {

    try {

      if (_this.__cache_checkpoint_permissionset)  _this.__cache_checkpoint_permissionset.clear();
      if (_this.__cache_checkpoint_authorization)  _this.__cache_checkpoint_authorization.clear();

      resolve(effectedSessions); //passing effected sessions through
    } catch (e) {
      reject(e);
    }
  });
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

  for (var wildPermissionPath in permissionSet.wildcard) {

    if (this.securityService.happn.services.utils.wildcardMatch(wildPermissionPath, path)) {
      if (this.__authorizedAction(action, permissionSet.wildcard[wildPermissionPath]))
        return true;
    }
  }

  return false;
};

CheckPoint.prototype.__compilePermissionsTemplate = function(permissionPath, identity){

  var cachedTemplate = this.__cache_compiled_permissions_templates.getSync(permissionPath);

  if (!cachedTemplate){
    cachedTemplate = handlebars.compile(permissionPath, {strict: true});
    this.__cache_compiled_permissions_templates.setSync(permissionPath, cachedTemplate, {clone: false});
  }

  try{

    var replacedPath = cachedTemplate(identity);
    //prevents any exploit where the session data is updated with a * value
    if (replacedPath.count('*') > permissionPath.count('*')) {
      this.log.warn('illegal promotion of permissions via permissions template, permissionPath' + permissionPath + ', replaced path: ' + replacedPath);
      return null;
    }
    return replacedPath;
  }catch(e){
    this.log.warn('missing data for permissions template: ' + permissionPath);
    return null;
  }
};

CheckPoint.prototype.__createPermissionSet = function (permissions, identity) {

  var _this = this;

  var permissionSet = {
    explicit: {},
    wildcard: {}
  };

  for (var rawPath in permissions) {
    var templatedPath = rawPath.toString();
    if (rawPath.indexOf('{{') > -1) {
      templatedPath = this.__compilePermissionsTemplate(rawPath, identity);
      if (templatedPath == null) continue;//we skip templated paths that dont have matching properties in the identity
    }

    if (templatedPath.indexOf('*') > -1) permissionSet.wildcard[templatedPath] = permissions[rawPath];
    else permissionSet.explicit[templatedPath] = permissions[rawPath];
  }
  permissionSet.wildcard = _this.securityService.happn.services.utils.wildcardAggregatePermissions(permissionSet.wildcard);

  return permissionSet;
};

CheckPoint.prototype.__loadPermissionSet = function (identity, callback) {

  var _this = this;

  var permissionSet = _this.__cache_checkpoint_permissionset.getSync(identity.permissionSetKey);

  if (permissionSet) return callback(null, permissionSet);

  var permissions = {};

  async.each(Object.keys(identity.user.groups), function (groupName, eachCB) {

    _this.securityService.groups.getGroup(groupName, {}, function (e, group) {

      if (e) return eachCB(e);

      for (var permissionPath in group.permissions)
        permissions[permissionPath] = group.permissions[permissionPath];

      eachCB();
    });

  }, function (e) {

    if (e) return callback(e);

    permissionSet = _this.__createPermissionSet(permissions, identity);

    _this.__cache_checkpoint_permissionset.setSync(identity.permissionSetKey, permissionSet, {clone:false});

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

  try {

    this.config = config;

    this.securityService = securityService;
    this.cacheService = this.happn.services.cache;
    this.errorService = this.happn.services.error;
    this.sessionService = this.happn.services.session;

    if (!config.__cache_checkpoint_authorization) config.__cache_checkpoint_authorization = {
      max: 2500,
      maxAge: 0
    };

    if (!config.__cache_compiled_permissions_templates) config.__cache_compiled_permissions_templates = {
      max: 2500,
      maxAge: 0
    };

    if (!config.__cache_checkpoint_permissionset) config.__cache_checkpoint_permissionset = config.__cache_checkpoint_authorization;

    if (!config.expiry_grace) config.expiry_grace = 60; //default expiry grace of 1 minute

    if (!config.groupPermissionsPolicy) config.groupPermissionsPolicy = 'most_restrictive';

    this.__cache_checkpoint_permissionset = this.cacheService.new('checkpoint_cache_permissionset', {
      type: 'LRU',
      cache: config.__cache_checkpoint_permissionset
    });

    this.__cache_checkpoint_authorization = this.cacheService.new('checkpoint_cache_authorization', {
      type: 'LRU',
      cache: config.__cache_checkpoint_authorization
    });

    this.__cache_compiled_permissions_templates = this.cacheService.new('checkpoint_compiled_permissions_templates', {
      type: 'LRU',
      cache: config.__cache_compiled_permissions_templates
    });

    this.__checkpoint_usage_limit = this.cacheService.new('checkpoint_usage_limit');
    this.__checkpoint_inactivity_threshold = this.cacheService.new('checkpoint_inactivity_threshold');

    this.sessionService.on('client-disconnect', function (sessionId) {

      this.__checkpoint_usage_limit.remove(sessionId);
      this.__checkpoint_inactivity_threshold.remove(sessionId);
    }.bind(this));

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

CheckPoint.prototype.__checkSessionPermissions = function (policy, path, action, session) {
  var permissionSet = this.__createPermissionSet(policy.permissions, session);

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
          var passthrough = _this.__checkSessionPermissions(policy, path, action, session);


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
  var _this = this;

  var permissionCacheKey = session.id + path + action;
  var authorized = this.__cache_checkpoint_authorization.getSync(permissionCacheKey);

  if (authorized == null)
    return _this.__constructPermissionSet(session, function (e, permissionSet) {

      if (e) return callback(e);

      authorized = _this.__authorized(permissionSet, path, action);
      _this.__cache_checkpoint_authorization.setSync(permissionCacheKey, authorized, {clone:false});

      return callback(null, authorized);
    });

  return callback(null, authorized);
};
