var Promise = require('bluebird');

function SecurityGroups(opts) {

  this.log = opts.logger.createLogger('SecurityGroups');
  this.log.$$TRACE('construct(%j)', opts);

  this.opts = opts;
}

SecurityGroups.prototype.initialize = Promise.promisify(initialize);
SecurityGroups.prototype.clearCaches = clearCaches;
SecurityGroups.prototype.__validate = __validate;

SecurityGroups.prototype.__upsertGroup = __upsertGroup;

SecurityGroups.prototype.upsertGroup = Promise.promisify(upsertGroup);
SecurityGroups.prototype.deleteGroup = Promise.promisify(deleteGroup);
SecurityGroups.prototype.listGroups = Promise.promisify(listGroups);

SecurityGroups.prototype.getGroup = Promise.promisify(getGroup);
SecurityGroups.prototype.linkGroup = Promise.promisify(linkGroup);
SecurityGroups.prototype.unlinkGroup = Promise.promisify(unlinkGroup);

SecurityGroups.prototype.listPermissions = listPermissions;
SecurityGroups.prototype.__attachPermissions = __attachPermissions;
SecurityGroups.prototype.__attachPermissionsAll = __attachPermissionsAll;

SecurityGroups.prototype.upsertPermission = upsertPermission;
//nb internal (starting with __) functions dont emit dataCHanged to the security service
SecurityGroups.prototype.__upsertPermission = __upsertPermission;
SecurityGroups.prototype.__upsertGroupPermissions = __upsertGroupPermissions;

SecurityGroups.prototype.removePermission = removePermission;
SecurityGroups.prototype.__removePermission = __removePermission;

SecurityGroups.prototype.__validatePermissionsPath = __validatePermissionsPath;

SecurityGroups.prototype.__escapePermissionsPath = __escapePermissionsPath;
SecurityGroups.prototype.__unescapePermissionsPath = __unescapePermissionsPath;

var ALLOWED_PERMISSIONS = ['set', 'get', 'remove', 'on', '*', 'delete', 'put', 'post', 'head', 'options'];

function initialize(config, securityService, callback) {

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
        max: 2500,
        maxAge: 0
      }
    };

    _this.__cache_groups = _this.cacheService.new('cache_security_groups', config.__cache_groups);

    if (!config.__cache_permissions) config.__cache_permissions = {
      type: 'LRU',
      cache: {
        max: 5000,
        maxAge: 0
      }
    };

    _this.__cache_permissions = _this.cacheService.new('cache_security_permissions', config.__cache_permissions);

    callback();

  } catch (e) {
    callback(e);
  }
}

function clearCaches() {

  var _this = this;

  return _this.__cache_groups.clear()
    .then(function () {
      return _this.__cache_permissions.clear();
    });
}

function __validate(validationType, options, obj, callback) {

  var _this = this;

  if (validationType == 'user-group') {

    var group = options[0];
    var user = options[1];

    return _this.getGroup(group.name)
      .then(function (group) {

        if (!group) throw new Error('validation error: group does not exist or has not been saved');

        return _this.securityService.users.getUser(user.username);
      })
      .then(function (user) {

        if (!user) throw new Error('validation error: group does not exist or has not been saved');
      })
      .then(callback)
      .catch(callback);
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

function __upsertGroup(group, options, callback) {

  var groupPath;

  if (options.parent) groupPath = options.parent._meta.path + '/' + group.name;
  else groupPath = '/_SYSTEM/_SECURITY/_GROUP/' + group.name;

  var _this = this;

  var permissions = _this.utilsService.clone(group.permissions);

  delete group.permissions;//dont want these ending up in the db

  _this.dataService.upsert(groupPath, group, {
    merge: true
  }, function (e, result) {

    group.permissions = permissions;//restore permissions

    if (e) return callback(e);

    //set the permissions back again
    result.data.permissions = permissions;

    if (!permissions) return callback(null, _this.securityService.serialize('group', result));

    _this.__upsertGroupPermissions(group.name, permissions)
      .then(function () {

        callback(null, _this.securityService.serialize('group', result));

      }).catch(callback);
  });

}

function upsertGroup(group, options, callback) {

  if (typeof options == 'function') callback = options;

  var _this = this;

  try {

    _this.__validate('group', options, group, function (e) {

      if (e) return callback(e);

      _this.__upsertGroup(group, options, function (e, upserted) {

        if (e) return callback(e);

        _this.securityService.dataChanged('upsert-group', upserted, null, function () {

          callback(null, upserted);
        });
      });
    });
  } catch (e) {
    callback(e);
  }
}

function deleteGroup(group, options, callback) {

  var _this = this;

  if (typeof options == 'function') callback = options;

  _this.getGroup(group.name, {}, function (e, group) {

    if (e) return callback(e);

    if (!group) return callback(new Error('group you are deleting does not exist'));

    try {

      var deletePath = '/_SYSTEM/_SECURITY/_PERMISSIONS/' + group.name + '/*';

      _this.dataService.remove(deletePath, {}, function (e, permissionsDeleteResults) {

        if (e) return callback(e);

        var deletePath = '/_SYSTEM/_SECURITY/_USER/*/_USER_GROUP/' + group.name;

        _this.dataService.remove(deletePath, {}, function (e, userGroupDeleteResults) {

          if (e) return callback(e);

          deletePath = '/_SYSTEM/_SECURITY/_GROUP/' + group.name;

          _this.dataService.remove(deletePath, {}, function (e, groupDeleteResults) {

            if (e) return callback(e);

            var deleted = {
              removed: groupDeleteResults.data.removed,
              obj: group,
              links: userGroupDeleteResults,
              permissions: permissionsDeleteResults
            };

            _this.securityService.dataChanged('delete-group', deleted, null, function () {

              callback(null, deleted);
            });
          });
        });
      });
    } catch (e) {
      callback(e);
    }
  });
}

function listGroups(groupName, options, callback) {

  if (typeof options == 'function') {
    callback = options;
    options = {};
  }

  if (typeof groupName == 'function') {
    callback = groupName;
    groupName = '*';
    options = {};
  }

  if (!options) options = {};

  if (groupName[groupName.length - 1] != '*') groupName += '*';

  var searchPath = '/_SYSTEM/_SECURITY/_GROUP/' + groupName;

  var _this = this;

  try {

    _this.dataService.get(searchPath, {
      sort: {
        'path': 1
      }
    }, function (e, groups) {

      if (e) return callback(e);

      var extracted = _this.dataService.extractData(groups);

      if (!options.skipPermissions) _this.__attachPermissionsAll(extracted)
        .then(callback(null, extracted))
        .catch(callback);
      else callback(null, extracted);

    });
  } catch (e) {

    callback(e);
  }
}

function getGroup(groupName, options, callback) {

  if (typeof options == 'function') callback = options;

  if (!groupName || groupName.indexOf('*') > 0) return callback('invalid group name: ' + groupName);

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

        if (result == null) return callback(null, null);

        var group = result.data;

        if (group) {

          _this.__attachPermissions(group)
            .then(function (attached) {

              _this.__cache_groups.set(groupName, attached);
              callback(null, attached);
            })
            .catch(callback);

        } else callback(null, null);
      });
    });

  } catch (e) {
    callback(e);
  }
}

function linkGroup(group, user, options, callback) {

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

        _this.securityService.dataChanged('link-group', upserted, user, function () {

          callback(null, upserted);
        });
      });
    });
  } catch (e) {
    callback(e);
  }
}

function unlinkGroup(group, user, options, callback) {

  var _this = this;

  if (typeof options == 'function') callback = options;

  try {

    _this.__validate('user-group', [group, user], null, function (e) {

      if (e) return callback(e);

      var groupLinkPath = '/_SYSTEM/_SECURITY/_USER/' + user.username + '/_USER_GROUP/' + group.name;

      _this.dataService.remove(groupLinkPath, {}, function (e, result) {

        if (e) return callback(e);

        _this.securityService.dataChanged('unlink-group', {path: groupLinkPath}, user, function () {

          callback(null, result);
        });
      });
    });
  } catch (e) {
    callback(e);
  }
}

function __attachPermissionsAll(groups) {

  var _this = this;
  var promises = [];

  groups.forEach(function (group) {
    promises.push(_this.__attachPermissions(group));
  });

  return Promise.all(promises);
}

function __attachPermissions(group) {

  var _this = this;

  return new Promise(function (resolve, reject) {

    group.permissions = {};

    _this.listPermissions(group.name)
      .then(function (permissions) {

        permissions.forEach(function (permission) {

          if (permission.authorized) {
            if (!group.permissions[permission.path]) group.permissions[permission.path] = {actions: []};
            group.permissions[permission.path].actions.push(permission.action);
          }
        });

        resolve(group);
      })
      .catch(function (e) {
        reject(e);
      });
  });
}

function listPermissions(groupName) {

  var _this = this;

  return new Promise(function (resolve, reject) {

    if (!groupName) return reject(new Error('please supply a groupName'));

    if (_this.__cache_permissions.has(groupName)) {
      return _this.__cache_permissions.get(groupName)
        .then(resolve)
        .catch(reject);
    }

    var searchPath = '/_SYSTEM/_SECURITY/_PERMISSIONS/' + groupName + '/*';

    _this.dataService.get(searchPath, {
      sort: {
        'path': 1
      }
    }, function (e, results) {

      if (e) return reject(e);

      var deserialized = _this.dataService.extractData(results);

      _this.__cache_permissions.set(groupName, deserialized);

      resolve(deserialized);
    });
  });
}

function removePermission(groupName, path, action) {

  var _this = this;

  return new Promise(function (resolve, reject) {

    if (!groupName) return reject(new Error('please supply a groupName'));
    if (!action) action = '*';
    if (!path) path = '*';

    return _this.__removePermission(groupName, path, action)

      .then(function (result) {

        if (result.data.removed)
          return _this.securityService.dataChanged('permission-removed', {
            groupName: groupName,
            path: path,
            action: action
          }, null, function () {
            resolve(result);
          });

        resolve(result);
      })
      .catch(reject);
  });
}

function __removePermission(groupName, path, action) {

  var _this = this;

  return new Promise(function (resolve, reject) {

    _this.dataService.remove(['/_SYSTEM/_SECURITY/_PERMISSIONS', groupName, action, _this.__escapePermissionsPath(path)].join('/'), function (e, result) {

      if (e) return reject(e);

      resolve(result);
    });
  });
}

function upsertPermission(groupName, path, action, authorized) {

  var _this = this;

  return new Promise(function (resolve, reject) {

    return _this.__upsertPermission(groupName, path, action, authorized)
      .then(function (result) {

        _this.securityService.dataChanged('permission-upserted', {
            groupName: groupName,
            path: path,
            action: action,
            authorized: authorized
          },
          function () {

            resolve(result);
          });
      })
      .catch(reject);
  });
}

function validateGroupPermissions(permissions) {

  var errors = [];

  Object.keys(permissions).forEach(function (permissionPath) {

    var permission = permissions[permissionPath];

    if (!permission.actions && !permission.prohibit) return errors.push('missing allowed actions or prohibit rules: ' + permissionPath);

    if (permission.actions)
      permission.actions.forEach(function (action) {
        if (ALLOWED_PERMISSIONS.indexOf(action) == -1) return errors.push('unknown action: ' + action + ' for path: ' + permissionPath);
      });

    if (permission.prohibit)
      permission.prohibit.forEach(function (action) {
        if (ALLOWED_PERMISSIONS.indexOf(action) == -1) return errors.push('unknown prohibit action: ' + action + ' for path: ' + permissionPath);
      });
  });

  if (errors.length == 0) return true;
  else return errors;
}

function __upsertGroupPermissions(groupName, permissions) {

  var _this = this;

  return new Promise(function (resolve, reject) {

    var promises = [];

    if (!groupName) return reject(new Error('please supply a groupName'));

    var permissionsValidation = validateGroupPermissions(permissions);

    if (permissionsValidation !== true) return reject(new Error('group permissions invalid: ' + permissionsValidation.join(',')));

    Object.keys(permissions).forEach(function (permissionPath) {

      var permission = permissions[permissionPath];

      if (permission.actions)
        permission.actions.forEach(function (action) {
          promises.push(_this.__upsertPermission(groupName, permissionPath, action));
        });

      if (permission.prohibit)
        permission.prohibit.forEach(function (action) {
          promises.push(_this.__upsertPermission(groupName, permissionPath, action, false));
        });
    });

    Promise.all(promises).then(function (responses) {
      resolve(responses);
    }).catch(reject);
  });
}

function __upsertPermission(groupName, path, action, authorized) {

  var _this = this;

  return new Promise(function (resolve, reject) {

    if (!groupName) return reject(new Error('please supply a groupName'));

    var validPath = _this.__validatePermissionsPath(path);
    if (validPath !== true) return reject(new Error(validPath));

    if (!action) action = '*';
    if (authorized == null) authorized = true;

    authorized = !!authorized;//must always be stored true or false

    _this.dataService.upsert(['/_SYSTEM/_SECURITY/_PERMISSIONS', groupName, action, _this.__escapePermissionsPath(path)].join('/'), {
      action: action,
      authorized: authorized,
      path: path
    }, function (e, result) {

      if (e) return reject(e);
      resolve(result);
    });
  });
}

function __escapePermissionsPath(path) {
  return path.replace(/\*/g, '{{w}}');
}

function __unescapePermissionsPath(path) {
  return path.replace(/\{\{w}}/g, '*');
}

function __validatePermissionsPath(path) {

  if (!path) return 'permission path is null';

  if (path.indexOf('{{w}}') > -1) return 'invalid permission path, cannot contain special string {{w}}';

  return true;
}

module.exports = SecurityGroups;
