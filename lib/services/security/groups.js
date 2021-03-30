const CONSTANTS = require('../..').constants;
const SD_EVENTS = CONSTANTS.SECURITY_DIRECTORY_EVENTS;
const util = require('util');
function SecurityGroups(opts) {
  this.log = opts.logger.createLogger('SecurityGroups');
  this.log.$$TRACE('construct(%j)', opts);

  this.opts = opts;
}
const PermissionManager = require('./permissions');
SecurityGroups.prototype.initialize = util.promisify(initialize);
SecurityGroups.prototype.clearCaches = clearCaches;
SecurityGroups.prototype.__validate = __validate;

SecurityGroups.prototype.__upsertGroup = __upsertGroup;

SecurityGroups.prototype.upsertGroup = util.promisify(upsertGroup);
SecurityGroups.prototype.deleteGroup = util.promisify(deleteGroup);
SecurityGroups.prototype.listGroups = util.promisify(listGroups);

SecurityGroups.prototype.getGroup = util.promisify(getGroup);
SecurityGroups.prototype.linkGroup = util.promisify(linkGroup);
SecurityGroups.prototype.unlinkGroup = util.promisify(unlinkGroup);

SecurityGroups.prototype.listPermissions = listPermissions;
SecurityGroups.prototype.__attachPermissionsAll = __attachPermissionsAll;

SecurityGroups.prototype.upsertPermission = upsertPermission;
SecurityGroups.prototype.removePermission = removePermission;

function initialize(config, securityService, callback) {
  var _this = this;

  _this.securityService = securityService;
  this.permissionManager = PermissionManager.create(config, 'group', this.happn, securityService);
  _this.cacheService = _this.happn.services.cache;
  _this.dataService = _this.happn.services.data;
  _this.utilsService = _this.happn.services.utils;
  _this.errorService = _this.happn.services.error;
  _this.cryptoService = _this.happn.services.crypto;
  _this.sessionService = _this.happn.services.session;

  if (!config.__cache_groups)
    config.__cache_groups = {
      max: 5000,
      maxAge: 0
    };

  if (!config.__cache_permissions)
    config.__cache_permissions = {
      max: 10000,
      maxAge: 0
    };

  _this.__cache_groups = _this.cacheService.new('cache_security_groups', {
    type: 'LRU',
    cache: config.__cache_groups
  });

  if (config.persistPermissions !== false) return callback();

  //inject the permissions data provider
  _this.dataService._insertDataProvider(
    0,
    {
      name: 'volatile_permissions',
      provider: 'memory',
      settings: {},
      patterns: ['/_SYSTEM/_SECURITY/_PERMISSIONS/*']
    },
    e => {
      if (e) return callback(e);
      _this.dataService.addDataProviderPatterns('/_SYSTEM/_SECURITY/_GROUP', [
        '/_SYSTEM/_SECURITY/_PERMISSIONS/_*'
      ]);
      callback();
    }
  );
}

function clearCaches(whatHappnd, changedData) {
  if (whatHappnd == null) {
    this.__cache_groups.clear().then(() => {
      if (this.permissionManager) this.permissionManager.cache.clear();
    });
    return;
  }
  return new Promise((resolve, reject) => {
    try {
      if (whatHappnd === SD_EVENTS.UPSERT_GROUP || whatHappnd === SD_EVENTS.DELETE_GROUP) {
        const groupName =
          whatHappnd === SD_EVENTS.UPSERT_GROUP ? changedData.name : changedData.obj.name;
        this.__cache_groups.remove(groupName);
        if (this.permissionManager) this.permissionManager.cache.remove(groupName);
      }
      if (
        (whatHappnd === SD_EVENTS.PERMISSION_UPSERTED ||
          whatHappnd === SD_EVENTS.PERMISSION_REMOVED) &&
        changedData.groupName
      ) {
        this.__cache_groups.remove(changedData.groupName);
        if (this.permissionManager) this.permissionManager.cache.remove(changedData.groupName);
      }
      return resolve();
    } catch (e) {
      reject(e);
    }
  });
}

function __validate(validationType, options, obj, callback) {
  if (validationType === 'user-group') {
    var group = options[0];
    var user = options[1];

    return this.getGroup(group.name)
      .then(group => {
        if (!group) throw new Error('validation error: group does not exist or has not been saved');
        return this.securityService.users.getUser(user.username);
      })
      .then(user => {
        if (!user) throw new Error('validation error: user does not exist or has not been saved');
      })
      .then(callback)
      .catch(callback);
  }

  if (obj.name) this.securityService.validateName(obj.name, validationType);

  if (validationType === 'group') {
    if (options.parent) {
      if (!options.parent._meta.path)
        return callback(
          new Error(
            'validation error: parent group path is not in your request, have you included the _meta?'
          )
        );
      //path, parameters, callback
      return this.dataService.get(options.parent._meta.path, {}, (e, result) => {
        if (e) return callback(e);

        if (!result)
          return callback(
            new Error('validation error: parent group does not exist: ' + options.parent._meta.path)
          );

        this.securityService.checkOverwrite(
          validationType,
          obj,
          options.parent._meta.path + '/' + obj.name,
          obj.name,
          options,
          callback
        );
      });
    }
    return this.securityService.checkOverwrite(
      validationType,
      obj,
      '/_SYSTEM/_SECURITY/_GROUP/' + obj.name,
      obj.name,
      options,
      callback
    );
  }

  if (validationType === 'permission') {
    var permissionGroup = options[1];

    if (!permissionGroup)
      return callback(new Error('validation error: you need a group to add a permission to'));
    if (!permissionGroup._meta.path)
      return callback(
        new Error(
          'validation error: permission group path is not in your request, have you included the _meta?'
        )
      );

    return this.dataService.get(permissionGroup._meta.path, {}, (e, result) => {
      if (e) return callback(e);

      if (!result)
        return callback(
          new Error(
            'validation error: permission group does not exist: ' + permissionGroup._meta.path
          )
        );

      callback();
    });
  }

  return callback(new Error('Unknown validation type: ' + validationType));
}

function __upsertGroup(group, options) {
  var groupPath;
  if (options.parent) groupPath = options.parent._meta.path + '/' + group.name;
  else groupPath = '/_SYSTEM/_SECURITY/_GROUP/' + group.name;
  let permissions = this.utilsService.clone(group.permissions);
  delete group.permissions; //dont want these ending up in the db

  return new Promise((resolve, reject) => {
    this.dataService.upsert(groupPath, group, async (e, result) => {
      try {
        group.permissions = permissions; //restore permissions
        if (e) return reject(e);
        //set the permissions back again
        result.data.permissions = permissions;
        const returnGroup = this.securityService.serialize('group', result);
        if (!permissions) return resolve(returnGroup);
        await this.permissionManager.upsertMultiplePermissions(group.name, permissions);
        this.log.info(`group upserted: ${group.name}`);
        resolve(returnGroup);
      } catch (e) {
        reject(e);
      }
    });
  });
}

function upsertGroup(group, options, callback) {
  if (typeof options === 'function') callback = options;

  if (typeof group !== 'object' || group == null)
    return callback(new Error('group is null or not an object'));

  this.__validate('group', options, group, async e => {
    if (e) return callback(e);
    try {
      let upserted = await this.__upsertGroup(group, options);
      this.securityService.dataChanged(
        CONSTANTS.SECURITY_DIRECTORY_EVENTS.UPSERT_GROUP,
        upserted,
        null,
        () => {
          callback(null, upserted);
        }
      );
    } catch (e) {
      callback(e);
    }
  });
}

function deleteGroup(group, options, callback) {
  if (typeof options === 'function') callback = options;

  if (typeof group !== 'object' || group == null)
    return callback(new Error('group is null or not an object'));

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
            this.log.info(`group deleted: ${group.name}`);
            var deleted = {
              removed: groupDeleteResults.data.removed,
              obj: group,
              links: userGroupDeleteResults,
              permissions: permissionsDeleteResults
            };

            this.securityService.dataChanged(
              CONSTANTS.SECURITY_DIRECTORY_EVENTS.DELETE_GROUP,
              deleted,
              null,
              () => {
                callback(null, deleted);
              }
            );
          });
        });
      });
    } catch (err) {
      callback(err);
    }
  });
}

function listGroups(groupName, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }

  if (typeof groupName === 'function') {
    callback = groupName;
    groupName = '*';
    options = {};
  }

  if (!options) options = {};
  if (!options.criteria) options.criteria = {};
  if (!options.sort)
    options.sort = {
      path: 1
    };

  let searchParameters = {
    criteria: options.criteria,
    sort: options.sort,
    options: {}
  };

  if (options.limit) searchParameters.options.limit = options.limit;
  if (options.skip) searchParameters.options.skip = options.skip;
  if (options.collation) searchParameters.options.collation = options.collation;

  if (groupName[groupName.length - 1] !== '*') groupName += '*';

  var searchPath = '/_SYSTEM/_SECURITY/_GROUP/' + groupName;

  if (options.count) {
    this.dataService.count(searchPath, searchParameters, (e, results) => {
      if (e) return callback(e);
      callback(null, results.data);
    });
    return;
  }

  try {
    this.dataService.get(searchPath, searchParameters, (e, groups) => {
      if (e) return callback(e);
      var extracted = this.dataService.extractData(groups);
      if (options.skipPermissions) {
        callback(null, extracted);
        return;
      }
      this.__attachPermissionsAll(extracted)
        .then(callback(null, extracted))
        .catch(callback);
    });
  } catch (e) {
    callback(e);
  }
}

function getGroup(groupName, options, callback) {
  if (typeof options === 'function') callback = options;

  if (!groupName || groupName.indexOf('*') > 0) return callback('invalid group name: ' + groupName);

  var cachedGroup = this.__cache_groups.getSync(groupName);

  if (cachedGroup) return callback(null, cachedGroup);

  this.dataService.get(
    '/_SYSTEM/_SECURITY/_GROUP/' + groupName,
    {
      sort: {
        path: 1
      }
    },
    (e, result) => {
      if (e) return callback(e);
      if (result == null) return callback(null, null);

      var group = result.data;

      this.permissionManager
        .attachPermissions(group)
        .then(attached => {
          this.__cache_groups.setSync(groupName, attached, { clone: false });
          callback(null, attached);
        })
        .catch(callback);
    }
  );
}

function linkGroup(group, user, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }

  this.__validate('user-group', [group, user], options, e => {
    if (e) return callback(e);

    this.dataService.upsert(
      '/_SYSTEM/_SECURITY/_USER/' + user.username + '/_USER_GROUP/' + group.name,
      options,
      (e, result) => {
        if (e) return callback(e);

        var upserted = this.securityService.serialize('user-group', result, options);

        this.securityService.dataChanged(
          CONSTANTS.SECURITY_DIRECTORY_EVENTS.LINK_GROUP,
          upserted,
          user,
          () => {
            callback(null, upserted);
          }
        );
      }
    );
  });
}

function unlinkGroup(group, user, options, callback) {
  if (typeof options === 'function') callback = options;

  this.__validate('user-group', [group, user], null, e => {
    if (e) return callback(e);

    var groupLinkPath = '/_SYSTEM/_SECURITY/_USER/' + user.username + '/_USER_GROUP/' + group.name;

    this.dataService.remove(groupLinkPath, {}, (e, result) => {
      if (e) return callback(e);

      this.securityService.dataChanged(
        CONSTANTS.SECURITY_DIRECTORY_EVENTS.UNLINK_GROUP,
        { path: groupLinkPath, permissions: group.permissions },
        user,
        () => {
          callback(null, result);
        }
      );
    });
  });
}

function __attachPermissionsAll(groups) {
  var promises = [];

  groups.forEach(group => {
    promises.push(this.permissionManager.attachPermissions(group));
  });

  return Promise.all(promises);
}

function listPermissions(groupName) {
  return this.permissionManager.listPermissions(groupName);
}

function removePermission(groupName, path, action) {
  return this.permissionManager.removePermission(groupName, path, action);
}

function upsertPermission(groupName, path, action, authorized) {
  return this.permissionManager.upsertPermission(groupName, path, action, authorized);
}
module.exports = SecurityGroups;
