var Promise = require('bluebird');

function SecurityGroups(opts) {

  this.log = opts.logger.createLogger('SecurityGroups');
  this.log.$$TRACE('construct(%j)', opts);

  this.opts = opts;
}

SecurityGroups.prototype.initialize = Promise.promisify(initialize);
SecurityGroups.prototype.clearCaches = clearCaches;
SecurityGroups.prototype.__validate = __validate;

SecurityGroups.prototype.__decodeGroupPermissions = __decodeGroupPermissions;
SecurityGroups.prototype.__encodeGroupPermissions = __encodeGroupPermissions;

SecurityGroups.prototype.__upsertGroup = __upsertGroup;

SecurityGroups.prototype.upsertGroup = upsertGroup;
SecurityGroups.prototype.deleteGroup = deleteGroup;
SecurityGroups.prototype.listGroups = listGroups;

SecurityGroups.prototype.getGroup = getGroup;
SecurityGroups.prototype.linkGroup = linkGroup;
SecurityGroups.prototype.unlinkGroup = unlinkGroup;

function initialize (config, securityService, callback) {

  var _this = this;

  try {

    _this.securityService = securityService;

    _this.cacheService = _this.happn.services.cache;
    _this.dataService = _this.happn.services.data;
    _this.utilsService = _this.happn.services.utils;
    _this.errorService = _this.happn.services.error;
    _this.cryptoService = _this.happn.services.crypto;
    _this.sessionService = _this.happn.services.session;

    if (!config.__cache_groups) config.__cache_groups = {
      type: 'LRU',
      cache: {
        max: 1000,
        maxAge: 0
      }
    };

    _this.__cache_groups = _this.cacheService.new('cache_security_groups', config.__cache_groups);

    callback();

  } catch (e) {
    callback(e);
  }
}

function clearCaches () {

  return this.__cache_groups.clear();
}

function __validate (validationType, options, obj, callback) {

  var _this = this;

  if (validationType == 'user-group') {

    var group = options[0];
    var user = options[1];

    if (!group._meta) return callback(new Error('validation error: group does not exist or has not been saved'));

    if (!user._meta) return callback(new Error('validation error: user does not exist or has not been saved'));

    return _this.dataService.get(group._meta.path, {}, function (e, result) {

      if (e) return callback(e);

      if (!result) return callback(new Error('validation error: group does not exist: ' + group._meta.path));

      return _this.dataService.get(user._meta.path, {}, function (e, result) {

        if (e) return callback(e);

        if (!result) return callback(new Error('validation error: user does not exist: ' + user._meta.path));

        callback();
      });
    });
  }

  if (obj.name) _this.securityService.validateName(obj.name, validationType);

  if (validationType == 'group') {

    if (options.parent) {

      if (!options.parent._meta.path) return callback(new Error('validation error: parent group path is not in your request, have you included the _meta?'));
      //path, parameters, callback
      return _this.dataService.get(options.parent._meta.path, {}, function (e, result) {

        if (e) return callback(e);

        if (!result) return callback(new Error('validation error: parent group does not exist: ' + options.parent._meta.path));

        _this.securityService.checkOverwrite(validationType, obj, options.parent._meta.path + '/' + obj.name, obj.name, options, callback);

      });
    }
    return _this.securityService.checkOverwrite(validationType, obj, '/_SYSTEM/_SECURITY/_GROUP/' + obj.name, obj.name, options, callback);
  }

  if (validationType == 'permission') {

    var permission = options[0];
    var permissionGroup = options[1];

    if (!permissionGroup) return callback(new Error('validation error: you need a group to add a permission to'));
    if (!permissionGroup._meta.path) return callback(new Error('validation error: permission group path is not in your request, have you included the _meta?'));

    return _this.dataService.get(permissionGroup._meta.path, {}, function (e, result) {

      if (e) return callback(e);

      if (!result) return callback(new Error('validation error: permission group does not exist: ' + permissionGroup._meta.path));

      callback();
    });
  }

  return callback(new Error('Unknown validation type: ' + validationType));
}

function __decodeGroupPermissions (group) {

  var parsedPermissions = {};

  for (var permissionKey in group.permissions) {
    parsedPermissions[permissionKey.replace(/\\u002e/, ".")] = group.permissions[permissionKey];
  }

  group.permissions = parsedPermissions;

  return group;
}

function __encodeGroupPermissions (group) {

  var parsedPermissions = {};

  for (var permissionKey in group.permissions) {
    parsedPermissions[permissionKey.replace(/\./g, "\\u002e")] = group.permissions[permissionKey];
  }

  group.permissions = parsedPermissions;

  return group;

}

function __upsertGroup (group, options, callback) {

  var groupPath;

  if (options.parent) groupPath = options.parent._meta.path + '/' + group.name;
  else groupPath = '/_SYSTEM/_SECURITY/_GROUP/' + group.name;

  var _this = this;

  _this.dataService.upsert(groupPath, group, {
    merge: true
  }, function (e, result) {

    if (e) return callback(e);

    var upserted = _this.securityService.serialize('group', result);

    _this.securityService.dataChanged('upsert-group', upserted, null, function(){

      callback(null, upserted);
    });

  });
}

function upsertGroup (group, options, callback) {

  if (typeof options == 'function') callback = options;

  var _this = this;

  var preparedGroup = _this.__encodeGroupPermissions(group);
  //TODO: this was done, but the variable never used - now testing using it
  try {

    _this.__validate('group', options, preparedGroup, function (e) {
      if (e) return callback(e);
      _this.__upsertGroup(preparedGroup, options, callback);
    });
  } catch (e) {
    callback(e);
  }
}

function deleteGroup (group, options, callback) {

  var _this = this;

  if (typeof options == 'function') callback = options;

  _this.getGroup(group.name, {}, function (e, group) {

    if (e) return callback(e);

    if (!group) return callback(new Error('group you are deleting does not exist'));

    var deletePath = '/_SYSTEM/_SECURITY/_USER/*/_USER_GROUP/' + group.name + '/*';

    try {

      _this.dataService.remove(deletePath, {}, function (e, userGroupDeleteResults) {

        if (e) return callback(e);

        deletePath = '/_SYSTEM/_SECURITY/_GROUP/' + group.name;

        _this.dataService.remove(deletePath, {}, function (e, groupDeleteResults) {

          if (e) return callback(e);

          var deleted = {
            removed: groupDeleteResults.data.removed,
            obj: group,
            links: userGroupDeleteResults
          };

          _this.securityService.dataChanged('delete-group', deleted, null, function(){

            callback(null, deleted);
          });
        });
      });
    } catch (e) {
      callback(e);
    }
  });
}

function listGroups (groupName, options, callback) {

  if (typeof options == 'function') callback = options;

  if (typeof groupName == 'function') {
    callback = groupName;
    groupName = '*';
  }

  if (groupName[groupName.length - 1] != '*') groupName += '*';

  var searchPath = '/_SYSTEM/_SECURITY/_GROUP/' + groupName;

  var _this = this;

  try {

    this.dataService.get(searchPath, {
      sort: {
        'path': 1
      }
    }, function (e, results) {

      if (e) return callback(e);

      callback(null, _this.securityService.serializeAll('group', results, options));

    });
  } catch (e) {

    callback(e);
  }
}

function getGroup (groupName, options, callback) {

  if (typeof options == 'function') callback = options;

  groupName = groupName.replace(/[*]/g, '');

  var searchPath = '/_SYSTEM/_SECURITY/_GROUP/' + groupName;

  var _this = this;

  try {

    _this.__cache_groups.get(groupName, function (e, cachedGroup) {

      if (e) return callback(e);

      if (cachedGroup) return callback(null, cachedGroup);

      _this.dataService.get(searchPath, {
        sort: {
          'path': 1
        }
      }, function (e, result) {

        if (e) return callback(e);

        if (result) {

          var group = _this.__decodeGroupPermissions(_this.securityService.serialize('group', result, options));

          //add the group to the cache TODO: implement LRU cache service here
          _this.__cache_groups.set(groupName, group)
            .then(callback(null, group))
            .catch(callback);

        } else callback(null, null);

      });
    });

  } catch (e) {
    callback(e);
  }
}

function linkGroup (group, user, options, callback) {

  var _this = this;

  if (typeof options == 'function') {
    callback = options;
    options = {};
  }

  try {

    _this.__validate('user-group', [group, user], options, function (e) {

      if (e) return callback(e);

      var groupLinkPath = '/_SYSTEM/_SECURITY/_USER/' + user.username + '/_USER_GROUP/' + group.name;

      _this.dataService.upsert(groupLinkPath, options, {
        merge: true
      }, function (e, result) {

        if (e) return callback(e);

        var upserted = _this.securityService.serialize('user-group', result, options);

        _this.securityService.dataChanged('link-group', upserted, user, function(){

          callback(null, upserted);
        });
      });
    });
  } catch (e) {
    callback(e);
  }
}

function unlinkGroup (group, user, options, callback) {

  var _this = this;

  if (typeof options == 'function') callback = options;

  try {

    _this.__validate('user-group', [group, user], null, function (e) {

      if (e) return callback(e);

      var groupLinkPath = '/_SYSTEM/_SECURITY/_USER/' + user.username + '/_USER_GROUP/' + group.name;

      _this.dataService.remove(groupLinkPath, {}, function (e, result) {

        if (e) return callback(e);

        _this.securityService.dataChanged('unlink-group', groupLinkPath, user, function(){

          callback(null, result);
        });
      });
    });
  } catch (e) {
    callback(e);
  }
}

function listPermissions(group){

}

function removePermission(group, path, action){

}

function upsertPermission(group, path, action, authorization){

}

module.exports = SecurityGroups;
