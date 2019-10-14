var Promise = require('bluebird');

function SecurityUsers(opts) {
  this.log = opts.logger.createLogger('SecurityUsers');
  this.log.$$TRACE('construct(%j)', opts);

  this.opts = opts;
}

SecurityUsers.prototype.initialize = Promise.promisify(initialize);
SecurityUsers.prototype.clearCaches = clearCaches;
SecurityUsers.prototype.__validate = __validate;
SecurityUsers.prototype.getPasswordHash = getPasswordHash;

SecurityUsers.prototype.upsertUser = Promise.promisify(upsertUser);
SecurityUsers.prototype.__upsertUser = __upsertUser;
SecurityUsers.prototype.deleteUser = Promise.promisify(deleteUser);
SecurityUsers.prototype.getUser = Promise.promisify(getUser);
SecurityUsers.prototype.getUserNoGroups = getUserNoGroups;
SecurityUsers.prototype.listUsers = Promise.promisify(listUsers);

SecurityUsers.prototype.listUserNamesByGroup = listUserNamesByGroup;
SecurityUsers.prototype.listUsersByGroup = Promise.promisify(listUsersByGroup);
SecurityUsers.prototype.__getUserNamesFromGroupLinks = __getUserNamesFromGroupLinks;

/**
 * Clones the passed in user, and generates a hash of the users password to be pushed into the data store.
 */
SecurityUsers.prototype.__prepareUser = __prepareUser;

function initialize(config, securityService, callback) {
  try {
    this.securityService = securityService;

    this.cacheService = this.happn.services.cache;
    this.dataService = this.happn.services.data;

    this.utilsService = this.happn.services.utils;
    this.errorService = this.happn.services.error;
    this.cryptoService = this.happn.services.crypto;
    this.sessionService = this.happn.services.session;

    if (!config.__cache_users)
      config.__cache_users = {
        max: 1000,
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

    //backward compatibility after taking groups methods out
    this.unlinkGroup = this.groups.unlinkGroup.bind(this.groups);
    this.linkGroup = this.groups.linkGroup.bind(this.groups);
    this.getGroup = this.groups.getGroup.bind(this.groups);
    this.listGroups = this.groups.listGroups.bind(this.groups);
    this.deleteGroup = this.groups.deleteGroup.bind(this.groups);
    this.upsertGroup = this.groups.upsertGroup.bind(this.groups);

    this.config = config;

    callback();
  } catch (e) {
    callback(e);
  }
}

function clearCaches() {
  return this.__cache_passwords.clear().then(() => {
    return this.__cache_users.clear();
  });
}

function __validate(validationType, options, obj, callback) {
  if (obj.name) this.securityService.validateName(obj.name, validationType);

  if (validationType === 'user') {
    if (!obj.username) return callback(new Error('validation failure: no username specified'));

    if (obj.username.indexOf(':nogroups') > -1)
      return callback(
        new Error("validation failure: username cannot contain the ':nogroups' directive")
      );

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

function __prepareUser(user, callback) {
  var clonedUser = this.utilsService.clone(user); //we are passing the back to who knows where and it lives here in the cache...
  if (!user.password) return callback(null, clonedUser);

  return this.cryptoService.generateHash(user.password, this.config.pbkdf2Iterations, (e, hash) => {
    if (e) return callback(e);
    clonedUser.password = hash;
    callback(null, clonedUser);
  });
}

function __upsertUser(user, options, callback) {
  if (typeof options === 'function') {
    callback = options;
  }

  this.__prepareUser(user, (e, prepared) => {
    if (e) return callback(e);

    var userPath = '/_SYSTEM/_SECURITY/_USER/' + prepared.username;

    this.dataService.upsert(userPath, prepared, { merge: true }, (e, result) => {
      if (e) return callback(e);

      var upserted = this.securityService.serialize('user', result);

      this.securityService.dataChanged('upsert-user', upserted, prepared, () => {
        callback(null, upserted);
      });
    });
  });
}

function upsertUser(user, options, callback) {
  if (typeof options === 'function') {
    callback = options;
  }

  try {
    this.__validate('user', options, user, e => {
      if (e) return callback(e);
      this.__upsertUser(user, options, callback);
    });
  } catch (e) {
    callback(e);
  }
}

function deleteUser(user, options, callback) {
  if (typeof options === 'function') callback = options;

  var userPath = '/_SYSTEM/_SECURITY/_USER/' + user.username;
  var userTree = '/_SYSTEM/_SECURITY/_USER/' + user.username + '/*';

  this.dataService.remove(userTree, {}, (e, result1) => {
    if (e) return callback(e);
    this.dataService.remove(userPath, {}, (e, result2) => {
      if (e) return callback(e);
      var deleted = {
        obj: result2,
        tree: result1
      };
      this.__cache_users
        .remove(user.username)
        .then(() => {
          return this.__cache_passwords.remove(user.username);
        })
        .then(() => {
          this.securityService.dataChanged('delete-user', deleted, null, () => {
            callback(null, deleted);
          });
        })
        .catch(callback);
    });
  });
}

function getUserNoGroups(userName, callback) {
  var cacheKey = userName + ':nogroups';

  if (this.__cache_users.has(cacheKey)) return callback(null, this.__cache_users.getSync(cacheKey));

  var userPath = '/_SYSTEM/_SECURITY/_USER/' + userName;

  this.dataService.get(userPath, (e, found) => {
    if (e) return callback(e);

    if (!found) return callback(null, null);

    var password = found.data.password;

    var returnUser = this.securityService.serialize('user', found);

    this.__cache_users.setSync(cacheKey, returnUser);
    this.__cache_passwords.setSync(cacheKey, password);

    callback(null, returnUser);
  });
}

function getUser(userName, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }

  if (options.includeGroups === false) return this.getUserNoGroups(userName, callback);

  userName = userName.replace(/[*]/g, ''); //remove any wildcards

  var userPath = '/_SYSTEM/_SECURITY/_USER/' + userName;

  var cachedUser = this.__cache_users.getSync(userName);

  if (cachedUser) return callback(null, cachedUser);

  this.dataService.get(userPath, (e, foundUser) => {
    if (e) return callback(e);

    if (!foundUser) return callback(null, null);

    var user = this.securityService.serialize('user', foundUser, options);
    var password = foundUser.data.password;
    user.groups = {};

    this.dataService.get(
      userPath + '/_USER_GROUP/*',
      {
        sort: {
          path: 1
        }
      },
      (e, userGroups) => {
        if (e) return callback(e);

        userGroups.forEach(userGroup => {
          if (userGroup._meta.path.indexOf(userPath + '/') !== 0) return;

          //we have found a group linked to the user, add the group, by its name to the groups object
          user.groups[userGroup._meta.path.replace(userPath + '/_USER_GROUP/', '')] = userGroup;
          delete userGroup._meta; //remove the _meta
        });

        this.__cache_users.setSync(userName, user);
        this.__cache_passwords.setSync(userName, password);

        callback(null, user);
      }
    );
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

  if (userName[userName.length - 1] !== '*') userName += '*';
  var searchPath = '/_SYSTEM/_SECURITY/_USER/' + userName;
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
  if (userGroupLinks == null || userGroupLinks.length === 0) return [];

  return userGroupLinks.map(link => {
    return link._meta.path.split('/_SYSTEM/_SECURITY/_USER/')[1].split('/_USER_GROUP/')[0];
  });
}

function listUserNamesByGroup(groupName) {
  return new Promise((resolve, reject) => {
    if (typeof groupName !== 'string')
      return reject(new Error('validation error: groupName must be specified'));
    this.dataService
      .get('/_SYSTEM/_SECURITY/_USER/*/_USER_GROUP/' + groupName, { path_only: false }) // TODO return to true once #180 is resolved
      .then(userGroupLinks => {
        resolve(this.__getUserNamesFromGroupLinks(userGroupLinks));
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

module.exports = SecurityUsers;
