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

/**
 * Clones the passed in user, and generates a hash of the users password to be pushed into the data store.
 */
SecurityUsers.prototype.__prepareUser = __prepareUser;


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

    if (!config.__cache_users) config.__cache_users = {
      max: 1000,
      maxAge: 0
    };

    _this.__cache_users = _this.cacheService.new('cache_security_users', {type: 'LRU', cache: config.__cache_users});
    _this.__cache_passwords = _this.cacheService.new('cache_security_passwords', {
      type: 'LRU',
      cache: config.__cache_users
    });

    _this.__cache_list_all_users = null;

    //backward compatibility after taking groups methods out

    _this.unlinkGroup = _this.groups.unlinkGroup.bind(_this.groups);
    _this.linkGroup = _this.groups.linkGroup.bind(_this.groups);
    _this.getGroup = _this.groups.getGroup.bind(_this.groups);
    _this.listGroups = _this.groups.listGroups.bind(_this.groups);
    _this.deleteGroup = _this.groups.deleteGroup.bind(_this.groups);
    _this.upsertGroup = _this.groups.upsertGroup.bind(_this.groups);

    callback();

  } catch (e) {
    callback(e);
  }
}

function clearCaches() {

  var _this = this;

  _this.__cache_list_all_users = null;

  return _this.__cache_passwords.clear()
    .then(function () {
      return _this.__cache_users.clear();
    });
}

function __validate(validationType, options, obj, callback) {

  var _this = this;

  if (obj.name) this.securityService.validateName(obj.name, validationType);

  if (validationType == 'user') {

    if (!obj.username) return callback(new Error('validation failure: no username specified'));

    if (obj.username.indexOf(':nogroups') > -1) return callback(new Error('validation failure: username cannot contain the \':nogroups\' directive'));

    if (!obj.password && !obj.publicKey) {

      return _this.dataService.get('/_SYSTEM/_SECURITY/_USER/' + obj.username, {}, function (e, result) {

        if (e) return callback(e);

        if (!result) return callback(new Error('validation failure: no password or publicKey specified for a new user'));

        _this.securityService.checkOverwrite(validationType, obj, '/_SYSTEM/_SECURITY/_USER/' + obj.username, obj.username, options, callback);
      });
    }
    return _this.securityService.checkOverwrite(validationType, obj, '/_SYSTEM/_SECURITY/_USER/' + obj.username, obj.username, options, callback);
  }

  return callback(new Error('Unknown validation type: ' + validationType));
}

function getPasswordHash(username, callback) {

  var _this = this;

  _this.__cache_passwords.get(username, function (e, hash) {

    if (e) return callback(e);

    if (hash) return callback(null, hash);

    _this.dataService.get('/_SYSTEM/_SECURITY/_USER/' + username, function (e, user) {

      if (e) return callback(e);

      if (!user) return callback(new Error(username + ' does not exist in the system'));

      _this.__cache_passwords.set(user.data.username, user.data.password, function (e) {

        if (e) return callback(e);

        callback(null, user.data.password);
      });

    });
  });
}

function __prepareUser(user, options, callback) {

  var clonedUser = this.utilsService.clone(user); //we are passing the back to who knows where and it lives here in the cache...

  if (user.password) {

    return this.cryptoService.generateHash(user.password, function (e, hash) {

      if (e) return callback(e);

      clonedUser.password = hash;
      callback(null, clonedUser);

    });

  } else {
    callback(null, clonedUser);
  }
}

function __upsertUser(user, options, callback) {

  var _this = this;

  if (typeof options == 'function') {
    callback = options;
  }

  _this.__prepareUser(user, options, function (e, prepared) {

    if (e) return callback(e);

    var userPath = '/_SYSTEM/_SECURITY/_USER/' + prepared.username;

    _this.dataService.upsert(userPath, prepared, {merge: true}, function (e, result) {

      if (e) return callback(e);

      var upserted = _this.securityService.serialize('user', result);

      _this.securityService.dataChanged('upsert-user', upserted, prepared, function () {

        callback(null, upserted);
      });
    });
  });
}

function upsertUser(user, options, callback) {

  var _this = this;

  if (typeof options == 'function') {
    callback = options;
  }

  try {
    _this.__validate('user', options, user, function (e) {

      if (e) return callback(e);
      _this.__upsertUser(user, options, callback);
    });
  } catch (e) {
    callback(e);
  }
}

function deleteUser(user, options, callback) {

  if (typeof options == 'function') callback = options;

  var _this = this;

  var userPath = '/_SYSTEM/_SECURITY/_USER/' + user.username;
  var userTree = '/_SYSTEM/_SECURITY/_USER/' + user.username + '/*';

  _this.dataService.remove(userPath, {}, function (e, result1) {

    if (e) return callback(e);

    _this.dataService.remove(userTree, {}, function (e, result2) {

      if (e) return callback(e);

      var deleted = {
        obj: result1,
        tree: result2
      };

      _this.__cache_users.remove(user.username)

        .then(_this.__cache_passwords.remove(user.username)

          .then(function () {

            _this.securityService.dataChanged('delete-user', deleted, null, function () {

              callback(null, deleted);
            });
          }))

        .catch(callback);

    });
  });
}

function getUserNoGroups(userName, callback) {

  var _this = this;

  var cacheKey = userName + ':nogroups';

  if (_this.__cache_users.has(cacheKey)) return callback(null, _this.__cache_users.getSync(cacheKey));

  var userPath = '/_SYSTEM/_SECURITY/_USER/' + userName;

  _this.dataService.get(userPath, function (e, found) {

    if (e) return callback(e);

    if (!found) return callback(null, null);

    var password = found.data.password;

    var returnUser = _this.securityService.serialize('user', found);

    _this.__cache_users.setSync(cacheKey, returnUser);
    _this.__cache_passwords.setSync(cacheKey, password);

    callback(null, returnUser);
  });
}

function getUser(userName, options, callback) {

  var _this = this;

  if (typeof options == 'function') {
    callback = options;
    options = {};
  }

  if (options.includeGroups === false) return _this.getUserNoGroups(userName, callback);

  userName = userName.replace(/[*]/g, '');

  var userPath = '/_SYSTEM/_SECURITY/_USER/' + userName;

  var searchPath = userPath + '*';

  var cachedUser = _this.__cache_users.getSync(userName);

  if (cachedUser) return callback(null, cachedUser);

  _this.dataService.get(searchPath, {
    sort: {
      'path': 1
    }
  }, function (e, results) {

    if (e) return callback(e);

    if (results.length == 0) return callback(null, null);

    var user = null;
    var password = null;
    var groups = {};

    results.forEach(function (userItem, userItemIndex) {

      if (userItem.data && userItem.data.username) {
        password = userItem.data.password;
        user = _this.securityService.serialize('user', userItem, options);
        return;
      }

      //we have found a group, add the group, by its name to the groups object
      if (results[userItemIndex]._meta.path.indexOf(userPath + '/') == 0){
        var groupName = results[userItemIndex]._meta.path.replace(userPath + '/_USER_GROUP/', '');
        delete results[userItemIndex]._meta;//remove the _meta
        groups[groupName] = results[userItemIndex];
      }
    });

    if (!user) return callback(new Error(userName + 'group links exist for non-existing user'));

    user.groups = groups;

    _this.__cache_users.setSync(userName, user);
    _this.__cache_passwords.setSync(userName, password);

    callback(null, user);
  });
}

function listUsers(userName, options, callback) {

  if (typeof options == 'function') {
    callback = options;
    options = {};
  }

  if (typeof userName == 'function') {
    callback = userName;
    userName = '*';
    options = {};
  }

  if (!options) options = {};

  var noCriteria = !options.criteria;

  //we keep a cache of all users when previously fetched with * and no criteria
  if (userName == "*" && noCriteria && this.__cache_list_all_users != null) return callback(null, this.utilsService.clone(this.__cache_list_all_users));

  if (userName[userName.length - 1] != '*') userName += '*';

  var searchPath = '/_SYSTEM/_SECURITY/_USER/' + userName;

  options.clone = false;

  if (!options.criteria) options.criteria = {};

  options.criteria.username = {$exists: true};

  var _this = this;

  _this.dataService.get(searchPath, {criteria: options.criteria}, function (e, results) {

    if (e) return callback(e);

    var returnUsers = _this.securityService.serializeAll('user', results, options);

    if (userName == "*" && noCriteria) _this.__cache_list_all_users = _this.utilsService.clone(returnUsers);//update our cache

    callback(null, returnUsers);
  });
}

module.exports = SecurityUsers;
