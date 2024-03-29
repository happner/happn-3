const CONSTANTS = require('../..').constants;
const SD_EVENTS = CONSTANTS.SECURITY_DIRECTORY_EVENTS;
const PermissionManager = require('./permissions');
const util = require('../utils/shared');
const nodeUtil = require('util');
const UsersByGroupCache = require('./users-by-group-cache');
function SecurityUsers(opts) {
  this.log = opts.logger.createLogger('SecurityUsers');
  this.log.$$TRACE('construct(%j)', opts);

  this.opts = opts;
}

SecurityUsers.prototype.initialize = util.maybePromisify(initialize);
SecurityUsers.prototype.clearCaches = clearCaches;
SecurityUsers.prototype.__validate = __validate;
SecurityUsers.prototype.getPasswordHash = getPasswordHash;

SecurityUsers.prototype.upsertUser = util.maybePromisify(upsertUser);
SecurityUsers.prototype.__upsertUser = __upsertUser;
SecurityUsers.prototype.deleteUser = deleteUser;
SecurityUsers.prototype.getUser = util.maybePromisify(getUser);
SecurityUsers.prototype.getUserNoGroups = nodeUtil.callbackify(getUserNoGroups);
SecurityUsers.prototype.listUsers = util.maybePromisify(listUsers);

SecurityUsers.prototype.listUserNamesByGroup = listUserNamesByGroup;
SecurityUsers.prototype.listUsersByGroup = util.maybePromisify(listUsersByGroup);
SecurityUsers.prototype.__getUserNamesFromGroupLinks = __getUserNamesFromGroupLinks;
SecurityUsers.prototype.prepareUserName = prepareUserName;
SecurityUsers.prototype.clearGroupUsersFromCache = clearGroupUsersFromCache;
SecurityUsers.prototype.__linkGroupsToUser = __linkGroupsToUser;
SecurityUsers.prototype.getGroupMemberships = getGroupMemberships;
SecurityUsers.prototype.listPermissions = listPermissions;
SecurityUsers.prototype.attachPermissions = attachPermissions;
SecurityUsers.prototype.removePermission = removePermission;
SecurityUsers.prototype.upsertPermission = upsertPermission;
SecurityUsers.prototype.validateDeleteUser = validateDeleteUser;
SecurityUsers.prototype.upsertPermissions = util.maybePromisify(upsertPermissions);

/**
 * Clones the passed in user, and generates a hash of the users password to be pushed into the data store.
 */
SecurityUsers.prototype.__prepareUserForUpsert = __prepareUserForUpsert;

function initialize(config, securityService, callback) {
  try {
    this.securityService = securityService;
    this.permissionManager = PermissionManager.create(config, 'user', this.happn, securityService);
    this.cacheService = this.happn.services.cache;
    this.dataService = this.happn.services.data;

    this.utilsService = this.happn.services.utils;
    this.errorService = this.happn.services.error;
    this.cryptoService = this.happn.services.crypto;
    this.sessionService = this.happn.services.session;

    if (!config.__cache_users)
      config.__cache_users = {
        max: 5000,
        maxAge: 0
      };

    this.__cache_users = this.cacheService.new('cache_security_users', {
      type: 'LRU',
      cache: config.__cache_users
    });
    this.__cache_passwords = this.cacheService.new('cache_security_passwords', {
      type: 'LRU',
      cache: config.__cache_users
    });

    if (!config.__cache_users_by_groups)
      config.__cache_users_by_groups = {
        max: 10000,
        maxAge: 0
      };
    this.__cache_users_by_groups = UsersByGroupCache.create(
      this.cacheService,
      config.__cache_users_by_groups
    );
    //backward compatibility after taking groups methods out
    this.unlinkGroup = this.groups.unlinkGroup.bind(this.groups);
    this.linkGroup = this.groups.linkGroup.bind(this.groups);
    this.getGroup = this.groups.getGroup.bind(this.groups);
    this.listGroups = this.groups.listGroups.bind(this.groups);
    this.deleteGroup = this.groups.deleteGroup.bind(this.groups);
    this.upsertGroup = this.groups.upsertGroup.bind(this.groups);

    if (config.usernamesCaseInsensitive) {
      if (!Array.isArray(config.usernamesCaseInsensitiveExclude))
        config.usernamesCaseInsensitiveExclude = [];
      if (config.usernamesCaseInsensitiveExclude.indexOf('_ADMIN') === -1)
        config.usernamesCaseInsensitiveExclude.push('_ADMIN');
    }

    this.config = config;

    callback();
  } catch (e) {
    callback(e);
  }
}

function clearGroupUsersFromCache(groupName) {
  return this.listUserNamesByGroup(groupName).then(usernames => {
    usernames.forEach(username => {
      this.__cache_users.remove(username);
    });
  });
}

function clearCaches(whatHappnd, changedData) {
  if (whatHappnd == null)
    return this.__cache_users
      .clear()
      .then(() => {
        return this.__cache_passwords.clear();
      })
      .then(() => {
        return this.__cache_users_by_groups.clear();
      })
      .then(() => {
        return this.permissionManager.cache.clear();
      });
  if (
    whatHappnd === SD_EVENTS.DELETE_GROUP ||
    whatHappnd === SD_EVENTS.UNLINK_GROUP ||
    whatHappnd === SD_EVENTS.LINK_GROUP
  ) {
    let groupName;
    if (whatHappnd === SD_EVENTS.DELETE_GROUP) groupName = changedData.obj.name;
    if (whatHappnd === SD_EVENTS.LINK_GROUP) groupName = changedData._meta.path.split('/').pop();
    if (whatHappnd === SD_EVENTS.UNLINK_GROUP) groupName = changedData.path.split('/').pop();
    this.__cache_users_by_groups.groupChanged(groupName);
    return this.clearGroupUsersFromCache(groupName);
  }

  if (whatHappnd === SD_EVENTS.PERMISSION_REMOVED || whatHappnd === SD_EVENTS.PERMISSION_UPSERTED) {
    if (changedData.username) {
      this.__cache_users.remove(changedData.username);
      if (this.permissionManager) this.permissionManager.cache.remove(changedData.username);
    }
  }

  return new Promise((resolve, reject) => {
    try {
      if (whatHappnd === SD_EVENTS.UPSERT_USER || whatHappnd === SD_EVENTS.DELETE_USER) {
        const userName =
          whatHappnd === SD_EVENTS.UPSERT_USER
            ? changedData.username
            : changedData.obj._meta.path.replace('/_SYSTEM/_SECURITY/_USER/', '');
        this.__cache_users_by_groups.userChanged(userName);
        this.__cache_passwords.remove(userName);
        this.__cache_users.remove(userName);
        if (this.permissionManager) this.permissionManager.cache.remove(userName);
      }
      return resolve();
    } catch (e) {
      reject(e);
    }
  });
}

function __validate(validationType, options, obj, callback) {
  if (obj.name) {
    this.securityService.validateName(obj.name || obj.username, validationType);
  }
  if (validationType === 'user') {
    if (!obj.username) return callback(new Error('validation failure: no username specified'));

    if (obj.username.indexOf(':nogroups') > -1) {
      return callback(
        new Error("validation failure: username cannot contain the ':nogroups' directive")
      );
    }
    if (obj.username === '_ANONYMOUS') {
      return callback(new Error('validation failure: username cannot be reserved name _ANONYMOUS'));
    }
    if (!obj.password && !obj.publicKey) {
      return this.dataService.get('/_SYSTEM/_SECURITY/_USER/' + obj.username, {}, (e, result) => {
        if (e) return callback(e);

        if (!result)
          return callback(
            new Error('validation failure: no password or publicKey specified for a new user')
          );

        this.securityService.checkOverwrite(
          validationType,
          obj,
          '/_SYSTEM/_SECURITY/_USER/' + obj.username,
          obj.username,
          options,
          callback
        );
      });
    }
    return this.securityService.checkOverwrite(
      validationType,
      obj,
      '/_SYSTEM/_SECURITY/_USER/' + obj.username,
      obj.username,
      options,
      callback
    );
  }

  return callback(new Error('Unknown validation type: ' + validationType));
}

function getPasswordHash(username, callback) {
  this.__cache_passwords.get(username, (e, hash) => {
    if (e) return callback(e);

    if (hash) return callback(null, hash);

    this.dataService.get('/_SYSTEM/_SECURITY/_USER/' + username, (e, user) => {
      if (e) return callback(e);

      if (!user) return callback(new Error(username + ' does not exist in the system'));

      this.__cache_passwords.set(user.data.username, user.data.password, e => {
        if (e) return callback(e);

        callback(null, user.data.password);
      });
    });
  });
}

function __prepareUserForUpsert(user) {
  return new Promise((resolve, reject) => {
    this.getUserNoGroups(user.username, (e, existing) => {
      if (e) return reject(e);
      var clonedUser = this.utilsService.clone(user); //we are passing the back to who knows where and it lives here in the cache...
      if (!existing) clonedUser.userid = require('uuid').v4();
      if (!user.password) return resolve(clonedUser);
      return this.cryptoService.generateHash(
        user.password,
        this.config.pbkdf2Iterations,
        (e, hash) => {
          if (e) return reject(e);
          clonedUser.password = hash;
          resolve(clonedUser);
        }
      );
    });
  });
}

async function __upsertUser(user) {
  const permissions = this.utilsService.clone(user.permissions);
  const prepared = await this.__prepareUserForUpsert(user);

  delete prepared.permissions; //Don't store in DB
  const result = await this.dataService.upsert(
    '/_SYSTEM/_SECURITY/_USER/' + prepared.username,
    prepared,
    { merge: true }
  );

  this.log.info(`user upserted: ${prepared.username}`);

  const upserted = this.securityService.serialize('user', result);
  upserted.permissions = permissions || {};

  if (permissions)
    await this.permissionManager.upsertMultiplePermissions(upserted.username, permissions);

  await this.securityService.dataChanged(
    CONSTANTS.SECURITY_DIRECTORY_EVENTS.UPSERT_USER,
    upserted,
    user
  );

  if (!permissions) return upserted;
  upserted.permissions = permissions;
  return upserted;
}

function upsertUser(user, options, callback) {
  if (typeof options === 'function') callback = options;

  if (typeof user !== 'object' || user == null)
    return callback(new Error('user is null or not an object'));

  user.username = this.prepareUserName(user.username);
  this.__validate('user', options, user, async e => {
    if (e) return callback(e);
    try {
      let upserted = await this.__upsertUser(user, options);
      callback(null, upserted);
    } catch (e) {
      callback(e);
    }
  });
}

async function upsertPermissions(user, callback) {
  try {
    await this.permissionManager.upsertMultiplePermissions(user.username, user.permissions);
    await this.securityService.dataChanged(CONSTANTS.SECURITY_DIRECTORY_EVENTS.UPSERT_USER, user); // Using the upsert event, as the logic is the same.
  } catch (e) {
    callback(e);
    return;
  }
  callback(null, user);
}

function validateDeleteUser(username) {
  return ['_ADMIN', '_ANONYMOUS'].indexOf(username) === -1;
}

function throwOrReturnOrCallback(result, callback) {
  if (typeof callback !== 'function') {
    if (result instanceof Error) {
      throw result;
    }
    return result;
  }
  if (result instanceof Error) {
    callback(result);
    return;
  }
  callback(null, result);
}

async function deleteUser(user, callback) {
  if (typeof user !== 'object' || user == null) {
    throwOrReturnOrCallback(new Error('user is null or not an object'), callback);
    return;
  }
  const preparedUserName = this.prepareUserName(user.username);
  if (!this.validateDeleteUser(preparedUserName)) {
    throwOrReturnOrCallback(
      new Error(`unable to delete a user with the reserved name: ${preparedUserName}`),
      callback
    );
    return;
  }
  let deleted;
  try {
    await this.permissionManager.removeAllUserPermissions(preparedUserName);

    const tree = await this.dataService.remove(`/_SYSTEM/_SECURITY/_USER/${preparedUserName}/*`);
    const obj = await this.dataService.remove(`/_SYSTEM/_SECURITY/_USER/${preparedUserName}`);

    this.log.info(`user deleted: ${user.username}`);
    deleted = {
      obj,
      tree
    };

    await this.__cache_users.remove(preparedUserName);
    await this.__cache_passwords.remove(preparedUserName);

    this.securityService.dataChanged(
      CONSTANTS.SECURITY_DIRECTORY_EVENTS.DELETE_USER,
      deleted,
      null,
      e => {
        if (e) {
          this.log.error(`user delete failure to propagate event: ${e.message}`);
        }
      }
    );
  } catch (e) {
    throwOrReturnOrCallback(e, callback);
    return;
  }
  return throwOrReturnOrCallback(deleted, callback);
}

function prepareUserName(userName, dontRemoveWildCards) {
  let preparedUserName = userName;
  if (!dontRemoveWildCards) preparedUserName = userName.replace(/[*]/g, ''); //remove any wildcards
  if (
    this.config.usernamesCaseInsensitive &&
    this.config.usernamesCaseInsensitiveExclude.indexOf(userName) === -1
  )
    preparedUserName = preparedUserName.toLowerCase();
  return preparedUserName;
}

async function getUserNoGroups(userName) {
  const preparedUserName = this.prepareUserName(userName);
  if (this.__cache_users.has(preparedUserName)) {
    //we strip out the groups (cloning the cached user) - just in case it contains groups
    return this.utilsService.omitProperty(this.__cache_users.getSync(preparedUserName), ['groups']);
  }

  const userPath = '/_SYSTEM/_SECURITY/_USER/' + preparedUserName;
  const found = await this.dataService.get(userPath);

  if (!found) return null;

  const password = found.data.password;
  const returnUser = this.securityService.serialize('user', found);

  const attached = await this.permissionManager.attachPermissions(returnUser);

  this.__cache_users.setSync(preparedUserName, attached, { clone: false });
  this.__cache_passwords.setSync(preparedUserName, password, { clone: false });

  return attached;
}

function __linkGroupsToUser(user, callback) {
  user.groups = {};
  this.getGroupMemberships(user.username, (e, userGroups) => {
    if (e) return callback(e);
    userGroups.forEach(userGroup => {
      //we have found a group linked to the user, add the group, by its name to the groups object
      user.groups[userGroup.groupName] = userGroup.membership;
    });
    callback(null, user);
  });
}

function getGroupMemberships(username, callback) {
  const userPath = `/_SYSTEM/_SECURITY/_USER/${username}`;
  this.dataService.get(
    `${userPath}/_USER_GROUP/*`,
    {
      sort: {
        path: 1
      }
    },
    (e, userGroups) => {
      if (e) return callback(e);
      callback(
        null,
        userGroups
          .filter(userGroup => {
            return userGroup._meta.path.indexOf(`${userPath}/`) === 0;
          })
          .map(membership => {
            return {
              groupName: membership._meta.path.replace(`${userPath}/_USER_GROUP/`, ''),
              membership: this.utilsService.omitProperty(membership, ['_meta'])
            };
          })
      );
    }
  );
}

function getUser(userName, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  this.getUserNoGroups(userName, (e, user) => {
    if (e) return callback(e);
    if (!user) return callback(null, null);
    if (options.includeGroups === false) return callback(null, user);
    this.__linkGroupsToUser(user, callback);
  });
}

function listUsers(userName, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }

  if (typeof userName === 'function') {
    callback = userName;
    userName = '*';
    options = {};
  }

  if (!options) options = {};

  let preparedUserName = this.prepareUserName(userName, true);
  if (preparedUserName[preparedUserName.length - 1] !== '*') preparedUserName += '*';
  const searchPath = '/_SYSTEM/_SECURITY/_USER/' + preparedUserName;
  options.clone = false;
  if (!options.criteria) {
    options.criteria = {};
  }

  options.criteria.$and = [{ username: { $exists: true } }];

  let searchParameters = {
    criteria: options.criteria,
    sort: options.sort,
    options: {}
  };

  if (options.limit) searchParameters.options.limit = options.limit;
  if (options.skip) searchParameters.options.skip = options.skip;
  if (options.collation) searchParameters.options.collation = options.collation;

  if (options.count) {
    this.dataService.count(searchPath, searchParameters, (e, results) => {
      if (e) return callback(e);
      callback(null, results.data);
    });
    return;
  }

  this.dataService.get(searchPath, searchParameters, (e, results) => {
    if (e) return callback(e);
    var returnUsers = this.securityService.serializeAll('user', results, options);
    callback(null, returnUsers);
  });
}

function __getUserNamesFromGroupLinks(userGroupLinks) {
  if (userGroupLinks == null) return [];
  let iterableUserGroupLinks = userGroupLinks.paths ? userGroupLinks.paths : userGroupLinks;
  return iterableUserGroupLinks.map(link => {
    return link._meta.path.split('/_SYSTEM/_SECURITY/_USER/')[1].split('/_USER_GROUP/')[0];
  });
}

function listUserNamesByGroup(groupName) {
  return new Promise((resolve, reject) => {
    if (typeof groupName !== 'string')
      return reject(new Error('validation error: groupName must be specified'));

    let cachedResult;
    if (groupName.indexOf('*') === -1) {
      cachedResult = this.__cache_users_by_groups.getResult(groupName);
      if (cachedResult != null) return resolve(cachedResult);
    }

    this.dataService
      .get('/_SYSTEM/_SECURITY/_USER/*/_USER_GROUP/' + groupName, { path_only: true }) // TODO return to true once #180 is resolved
      .then(userGroupLinks => {
        let result = this.__getUserNamesFromGroupLinks(userGroupLinks);
        if (groupName.indexOf('*') === -1) {
          this.__cache_users_by_groups.cacheResult(groupName, result);
        }
        resolve(result);
      })
      .catch(reject);
  });
}

function listUsersByGroup(groupName, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }

  if (typeof groupName !== 'string')
    return callback(new Error('validation error: groupName must be specified'));

  if (!options) options = {};
  var userSearchCriteria = { $and: [] };
  if (options.criteria) userSearchCriteria.$and.push(options.criteria);

  userSearchCriteria.$and.push({ username: { $exists: true } });

  this.listUserNamesByGroup(groupName)
    .then(usernames => {
      if (usernames.length === 0) return callback(null, []);
      userSearchCriteria.$and.push({ username: { $in: usernames } });
      this.dataService.get(
        '/_SYSTEM/_SECURITY/_USER/*',
        { criteria: userSearchCriteria },
        (e, results) => {
          if (e) return callback(e);
          callback(null, this.securityService.serializeAll('user', results, options));
        }
      );
    })
    .catch(callback);
}

function listPermissions(username) {
  return this.permissionManager.listPermissions(username);
}

function attachPermissions(user) {
  return this.permissionManager.attachPermissions(user);
}

function removePermission(username, path, action) {
  return this.permissionManager.removePermission(username, path, action);
}

function upsertPermission(username, path, action, authorized) {
  return this.permissionManager.upsertPermission(username, path, action, authorized);
}
module.exports = SecurityUsers;
