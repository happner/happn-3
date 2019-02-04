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
      max: 2500,
      maxAge: 0
    };

    if (!config.__cache_permissions) config.__cache_permissions = {
      max: 5000,
      maxAge: 0
    };

    _this.__cache_groups = _this.cacheService.new('cache_security_groups', {
      type: 'LRU',
      cache: config.__cache_groups
    });

    _this.__cache_permissions = _this.cacheService.new('cache_security_permissions', {
      type: 'LRU',
      cache: config.__cache_permissions
    });

    callback();

  } catch (e) {
    callback(e);
  }
}

function clearCaches() {

  return this.__cache_groups.clear()
    .then(() => {
      return this.__cache_permissions.clear();
    });
}

function __validate(validationType, options, obj, callback) {

  if (validationType == 'user-group') {

    var group = options[0];
    var user = options[1];

    return this.getGroup(group.name)
      .then((group) => {

        if (!group) throw new Error('validation error: group does not exist or has not been saved');
        return this.securityService.users.getUser(user.username);
      })
      .then((user) => {

        if (!user) throw new Error('validation error: user does not exist or has not been saved');
      })
      .then(callback)
      .catch(callback);
  }

  if (obj.name) this.securityService.validateName(obj.name, validationType);

  if (validationType == 'group') {

    if (options.parent) {

      if (!options.parent._meta.path) return callback(new Error('validation error: parent group path is not in your request, have you included the _meta?'));
      //path, parameters, callback
      return this.dataService.get(options.parent._meta.path, {}, (e, result) => {

        if (e) return callback(e);

        if (!result) return callback(new Error('validation error: parent group does not exist: ' + options.parent._meta.path));

        this.securityService.checkOverwrite(validationType, obj, options.parent._meta.path + '/' + obj.name, obj.name, options, callback);

      });
    }
    return this.securityService.checkOverwrite(validationType, obj, '/_SYSTEM/_SECURITY/_GROUP/' + obj.name, obj.name, options, callback);
  }

  if (validationType == 'permission') {

    var permission = options[0];
    var permissionGroup = options[1];

    if (!permissionGroup) return callback(new Error('validation error: you need a group to add a permission to'));
    if (!permissionGroup._meta.path) return callback(new Error('validation error: permission group path is not in your request, have you included the _meta?'));

    return this.dataService.get(permissionGroup._meta.path, {}, (e, result) =>{

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

  var permissions = this.utilsService.clone(group.permissions);

  delete group.permissions;//dont want these ending up in the db

  this.dataService.upsert(groupPath, group, (e, result) => {

    group.permissions = permissions;//restore permissions

    if (e) return callback(e);

    //set the permissions back again
    result.data.permissions = permissions;

    if (!permissions) return callback(null, this.securityService.serialize('group', result));

    this.__upsertGroupPermissions(group.name, permissions)
      .then(() => {

        callback(null, this.securityService.serialize('group', result));

      }).catch(callback);
  });

}

function upsertGroup(group, options, callback) {

  if (typeof options == 'function') callback = options;

  try {

    this.__validate('group', options, group, (e) => {

      if (e) return callback(e);

      this.__upsertGroup(group, options, (e, upserted) => {

        if (e) return callback(e);

        this.securityService.dataChanged('upsert-group', upserted, null, () => {

          callback(null, upserted);
        });
      });
    });
  } catch (e) {
    callback(e);
  }
}

function deleteGroup(group, options, callback) {

  if (typeof options == 'function') callback = options;

  this.getGroup(group.name, {}, (e, group) => {

    if (e) return callback(e);

    if (!group) return callback(new Error('group you are deleting does not exist'));

    try {

      var deletePath = '/_SYSTEM/_SECURITY/_PERMISSIONS/' + group.name + '/*';

      this.dataService.remove(deletePath, {}, (e, permissionsDeleteResults) => {

        if (e) return callback(e);

        var deletePath = '/_SYSTEM/_SECURITY/_USER/*/_USER_GROUP/' + group.name;

        this.dataService.remove(deletePath, {}, (e, userGroupDeleteResults) => {

          if (e) return callback(e);

          deletePath = '/_SYSTEM/_SECURITY/_GROUP/' + group.name;

          this.dataService.remove(deletePath, {}, (e, groupDeleteResults) => {

            if (e) return callback(e);

            var deleted = {
              removed: groupDeleteResults.data.removed,
              obj: group,
              links: userGroupDeleteResults,
              permissions: permissionsDeleteResults
            };

            this.securityService.dataChanged('delete-group', deleted, null, () => {

              callback(null, deleted);
            });
          });
        });
      });
    } catch (err) {
      callback(err);
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

  try {

    this.dataService.get(searchPath, {
      sort: {
        'path': 1
      }
    }, (e, groups) => {

      if (e) return callback(e);

      var extracted = this.dataService.extractData(groups);

      if (!options.skipPermissions) this.__attachPermissionsAll(extracted)
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

  var cachedGroup = this.__cache_groups.getSync(groupName);

  if (cachedGroup) return callback(null, cachedGroup);

  this.dataService.get('/_SYSTEM/_SECURITY/_GROUP/' + groupName, {
    sort: {
      'path': 1
    }
  }, (e, result)  => {

    if (e) return callback(e);

    if (result == null) return callback(null, null);

    var group = result.data;

    this.__attachPermissions(group)
      .then((attached) => {

        this.__cache_groups.setSync(groupName, attached);
        callback(null, attached);
      })
      .catch(callback);
  });
}

function linkGroup(group, user, options, callback) {

  if (typeof options == 'function') {
    callback = options;
    options = {};
  }

  this.__validate('user-group', [group, user], options, (e) => {

    if (e) return callback(e);

    this.dataService.upsert('/_SYSTEM/_SECURITY/_USER/' + user.username + '/_USER_GROUP/' + group.name, options, (e, result) => {

      if (e) return callback(e);

      var upserted = this.securityService.serialize('user-group', result, options);

      this.securityService.dataChanged('link-group', upserted, user, () => {

        callback(null, upserted);
      });
    });
  });
}

function unlinkGroup(group, user, options, callback) {

  if (typeof options == 'function') callback = options;

  this.__validate('user-group', [group, user], null, (e) => {

    if (e) return callback(e);

    var groupLinkPath = '/_SYSTEM/_SECURITY/_USER/' + user.username + '/_USER_GROUP/' + group.name;

    this.dataService.remove(groupLinkPath, {}, (e, result) => {

      if (e) return callback(e);

      this.securityService.dataChanged('unlink-group', {path: groupLinkPath}, user, () => {

        callback(null, result);
      });
    });
  });

}

function __attachPermissionsAll(groups) {

  var promises = [];

  groups.forEach((group) => {
    promises.push(this.__attachPermissions(group));
  });

  return Promise.all(promises);
}

function __attachPermissions(group) {

  return new Promise((resolve, reject) => {

    group.permissions = {};

    this.listPermissions(group.name)
      .then((permissions) => {

        permissions.forEach((permission) => {

          if (permission.authorized) {
            if (!group.permissions[permission.path]) group.permissions[permission.path] = {actions: []};
            group.permissions[permission.path].actions.push(permission.action);
          }
        });

        resolve(group);
      })
      .catch((e) => {
        reject(e);
      });
  });
}

function listPermissions(groupName) {

  return new Promise((resolve, reject) => {

    if (!groupName) return reject(new Error('please supply a groupName'));

    if (this.__cache_permissions.has(groupName)) {
      return this.__cache_permissions.get(groupName)
        .then(resolve)
        .catch(reject);
    }

    this.dataService.get('/_SYSTEM/_SECURITY/_PERMISSIONS/' + groupName + '/*', {
      sort: {
        'path': 1
      }
    }, (e, results) => {

      if (e) return reject(e);

      var deserialized = this.dataService.extractData(results);

      this.__cache_permissions.set(groupName, deserialized);

      resolve(deserialized);
    });
  });
}

function removePermission(groupName, path, action) {

  return new Promise((resolve, reject) => {

    if (!groupName) return reject(new Error('please supply a groupName'));
    if (!action) action = '*';
    if (!path) path = '*';

    return this.__removePermission(groupName, path, action)

      .then((result) => {

        if (result.data.removed)
          return this.securityService.dataChanged('permission-removed', {
            groupName: groupName,
            path: path,
            action: action
          }, null, () => {

            resolve(result);
          });

        resolve(result);
      })
      .catch(reject);
  });
}

function __removePermission(groupName, path, action) {

  return new Promise((resolve, reject) => {

    this.dataService.remove(['/_SYSTEM/_SECURITY/_PERMISSIONS', groupName, action, this.__escapePermissionsPath(path)].join('/'), (e, result) => {

      if (e) return reject(e);

      resolve(result);
    });
  });
}

function upsertPermission(groupName, path, action, authorized) {

  return new Promise((resolve, reject) => {

    return this.__upsertPermission(groupName, path, action, authorized)
      .then((result) => {

        this.securityService.dataChanged('permission-upserted', {
            groupName: groupName,
            path: path,
            action: action,
            authorized: authorized
          },
           () => {

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

  return new Promise((resolve, reject) => {

    var promises = [];

    if (!groupName) return reject(new Error('please supply a groupName'));

    var permissionsValidation = validateGroupPermissions(permissions);

    if (permissionsValidation !== true) return reject(new Error('group permissions invalid: ' + permissionsValidation.join(',')));

    Object.keys(permissions).forEach(permissionPath => {

      var permission = permissions[permissionPath];

      if (permission.actions)
        permission.actions.forEach((action) => {
          promises.push(this.__upsertPermission(groupName, permissionPath, action));
        });

      if (permission.prohibit)
        permission.prohibit.forEach((action) => {
          promises.push(this.__upsertPermission(groupName, permissionPath, action, false));
        });
    });

    Promise.all(promises).then(responses => {
      resolve(responses);
    }).catch(reject);
  });
}

function __upsertPermission(groupName, path, action, authorized) {

  return new Promise((resolve, reject) => {

    if (!groupName) return reject(new Error('please supply a groupName'));

    var validPath = this.__validatePermissionsPath(path);
    if (validPath !== true) return reject(new Error(validPath));

    if (!action) action = '*';
    if (authorized == null) authorized = true;

    authorized = !!authorized;//must always be stored true or false

    this.dataService.upsert(['/_SYSTEM/_SECURITY/_PERMISSIONS', groupName, action, this.__escapePermissionsPath(path)].join('/'), {
      action: action,
      authorized: authorized,
      path: path
    }, (e, result) => {

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
