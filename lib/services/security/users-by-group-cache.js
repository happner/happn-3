module.exports = class UsersByGroupCache {
  constructor(cacheService, config) {
    this.__config = this.defaults(config);
    this.__cacheService = cacheService;
    this.__cache = this.__cache_checkpoint_permissionset = this.__cacheService.new(
      'security_cache_usersbygroup',
      {
        type: 'LRU',
        cache: {
          max: this.__config.max,
          maxAge: 0,
          dispose: this.removeMappings.bind(this)
        }
      }
    );
    this.__mappings = {};
  }

  static create(cacheService, config) {
    return new UsersByGroupCache(cacheService, config);
  }

  clear() {
    this.__cache.clear();
    this.__mappings = {};
  }

  getResult(groupName) {
    return this.__cache.getSync(groupName);
  }

  cacheResult(groupName, result) {
    result.forEach(username => {
      if (this.__mappings[username]) this.__mappings[username][groupName] = 1;
      else this.__mappings[username] = { [groupName]: 1 };
    });
    this.__cache.setSync(groupName, result);
  }

  removeMappings(groupName, result) {
    result.data.forEach(username => {
      if (this.__mappings[username]) {
        delete this.__mappings[username][groupName];
        if (this.__cacheService.happn.services.utils.isEmptyObject(this.__mappings[username]))
          delete this.__mappings[username];
      }
    });
  }

  uncacheResult(groupName) {
    this.__cache.remove(groupName);
  }

  groupChanged(groupName) {
    this.uncacheResult(groupName);
  }

  userChanged(userName) {
    if (!this.__mappings[userName]) return;
    Object.keys(this.__mappings[userName]).forEach(groupName => {
      this.uncacheResult(groupName);
    });
  }

  defaults(config) {
    let defaultConfig = !config ? {} : { ...config };
    defaultConfig.max = defaultConfig.max || 10000;
    return defaultConfig;
  }
};
