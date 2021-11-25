const CONSTANTS = require('../..').constants;
var ALLOWED_PERMISSIONS = [
  'set',
  'get',
  'remove',
  'on',
  '*',
  'delete',
  'put',
  'post',
  'head',
  'options'
];

module.exports = class Permissions {
  constructor(config, type, happn, securityService) {
    this.__config = this.defaults(config);
    this.securityService = securityService;
    this.cacheService = happn.services.cache;
    this.dataService = happn.services.data;
    this.type = type;
    this.cache = this.cacheService.new(`cache_security_${this.type}_permissions`, {
      type: 'LRU',
      cache: this.__config.__cache_permissions
    });
    this.__userPrefix = this.__config.__userPermissionsPrefix;
  }

  static create(config, type, happn, securityService) {
    return new Permissions(config, type, happn, securityService);
  }

  defaults(config) {
    let defaultConfig = !config ? {} : { ...config };
    if (!defaultConfig.__cache_permissions)
      defaultConfig.__cache_permissions = {
        max: 10000,
        maxAge: 0
      };
    defaultConfig.__userPermissionsPrefix = defaultConfig.__userPermissionsPrefix || '_USER/';
    return defaultConfig;
  }

  attachPermissions(entity) {
    entity.permissions = {};

    return this.listPermissions(entity.name || entity.username).then(permissions => {
      permissions.forEach(permission => {
        if (typeof permission.authorized !== 'boolean') return;

        if (permission.authorized === false) {
          // explicitly deny
          if (!entity.permissions[permission.path])
            entity.permissions[permission.path] = { prohibit: [] };
          entity.permissions[permission.path].prohibit =
            entity.permissions[permission.path].prohibit || [];
          entity.permissions[permission.path].prohibit.push(permission.action);
          return;
        }
        // allow
        if (!entity.permissions[permission.path])
          entity.permissions[permission.path] = { actions: [] };
        entity.permissions[permission.path].actions =
          entity.permissions[permission.path].actions || [];
        entity.permissions[permission.path].actions.push(permission.action);
      });
      return entity;
    });
  }

  async listPermissions(name) {
    if (!name) throw new Error(`please supply a ${this.type}Name`);
    if (this.cache.has(name)) {
      return this.cache.get(name);
    }

    const rawPermissions = await this.dataService.get(
      '/_SYSTEM/_SECURITY/_PERMISSIONS/' + this.__prepareName(name) + '/*',
      {
        sort: {
          path: 1
        }
      }
    );
    const deserialized = this.dataService.extractData(rawPermissions);
    this.cache.set(name, deserialized);
    return deserialized;
  }

  async removeAllUserPermissions(name) {
    if (!name) throw new Error(`please supply a username`);
    return this.dataService.remove(`/_SYSTEM/_SECURITY/_PERMISSIONS/${this.__prepareName(name)}/*`);
  }

  removePermission(name, path, action) {
    return new Promise((resolve, reject) => {
      if (!name) return reject(new Error(`please supply a ${this.type}Name`));
      if (!action) action = '*';
      if (!path) path = '*';
      return this.__removePermission(name, path, action)
        .then(result => {
          if (!result || !result.data) return resolve();
          if (result.data.removed)
            return this.securityService.dataChanged(
              CONSTANTS.SECURITY_DIRECTORY_EVENTS.PERMISSION_REMOVED,
              {
                ...this.__getNameObj(name),
                path,
                action
              },
              null,
              () => {
                resolve(result);
              }
            );

          resolve(result);
        })
        .catch(reject);
    });
  }

  async __removePermission(name, path, action, removeProhibition = false) {
    let permissionPath = [
      '/_SYSTEM/_SECURITY/_PERMISSIONS',
      this.__prepareName(name),
      action,
      this.__escapePermissionsPath(path)
    ].join('/');
    let storedData = await this.dataService.get(permissionPath);
    if (!storedData) return;
    storedData = Array.isArray(storedData) ? storedData : [storedData];
    let promises = storedData.map(stored => {
      if (!stored || !stored.data) return;
      if (removeProhibition && stored.data.authorized === true) return;
      if (!removeProhibition && stored.data.authorized === false) return;
      return this.dataService.remove(permissionPath);
    });
    let results = await Promise.all(promises);
    return results.filter(result => result !== undefined)[0];
  }

  upsertPermission(name, path, action, authorized) {
    return new Promise((resolve, reject) => {
      if (authorized == null) authorized = true;
      authorized = !!authorized; //must always be stored true or false
      return this.__upsertPermission(name, path, action, authorized)
        .then(result => {
          this.securityService.dataChanged(
            CONSTANTS.SECURITY_DIRECTORY_EVENTS.PERMISSION_UPSERTED,
            {
              ...this.__getNameObj(name),
              path: path,
              action: action,
              authorized: authorized
            },
            () => {
              resolve(result);
            }
          );
        })
        .catch(reject);
    });
  }

  validatePermissions(permissions) {
    var errors = [];

    Object.keys(permissions).forEach(function(permissionPath) {
      var permission = permissions[permissionPath];
      if (!permission.actions && !permission.prohibit)
        return errors.push('missing allowed actions or prohibit rules: ' + permissionPath);

      if (permission.actions)
        permission.actions.forEach(function(action) {
          if (ALLOWED_PERMISSIONS.indexOf(action) === -1)
            return errors.push('unknown action: ' + action + ' for path: ' + permissionPath);
        });

      if (permission.prohibit)
        permission.prohibit.forEach(function(action) {
          if (ALLOWED_PERMISSIONS.indexOf(action) === -1)
            return errors.push(
              'unknown prohibit action: ' + action + ' for path: ' + permissionPath
            );
        });
    });
    if (errors.length === 0) return true;
    else return errors;
  }

  upsertMultiplePermissions(name, permissions) {
    return new Promise((resolve, reject) => {
      var promises = [];

      if (!name) return reject(new Error(`please supply a ${this.type}Name`));

      var permissionsValidation = this.validatePermissions(permissions);
      if (permissionsValidation !== true)
        return reject(
          new Error(`${this.type} permissions invalid: ` + permissionsValidation.join(','))
        );
      Object.keys(permissions).forEach(permissionPath => {
        var permission = permissions[permissionPath];
        if (permission.remove) {
          if (permission.actions)
            permission.actions.forEach(action => {
              promises.push(this.__removePermission(name, permissionPath, action));
            });
          if (permission.prohibit)
            permission.prohibit.forEach(action => {
              promises.push(this.__removePermission(name, permissionPath, action, true));
            });
        } else {
          if (permission.actions)
            permission.actions.forEach(action => {
              promises.push(this.__upsertPermission(name, permissionPath, action));
            });
          if (permission.prohibit)
            permission.prohibit.forEach(action => {
              promises.push(this.__upsertPermission(name, permissionPath, action, false));
            });
        }
      });

      Promise.all(promises)
        .then(responses => {
          this.cache.remove(name);
          resolve(responses);
        })
        .catch(reject);
    });
  }

  async __upsertPermissions(name, permissionPath, actions, authorized) {
    if (actions) {
      for (let action of actions) {
        await this.__upsertPermission(name, permissionPath, action, authorized);
      }
    }
  }

  async __upsertPermission(name, path, action, authorized) {
    if (!name) throw new Error(`please supply a ${this.type}Name`);

    const validPath = this.__validatePermissionsPath(path);
    if (validPath !== true) throw new Error(validPath);

    if (!action) action = '*';
    if (authorized == null) authorized = true;

    authorized = !!authorized; //must always be stored true or false
    return await this.dataService.upsert(
      [
        '/_SYSTEM/_SECURITY/_PERMISSIONS',
        this.__prepareName(name),
        action,
        this.__escapePermissionsPath(path)
      ].join('/'),
      {
        action: action,
        authorized: authorized,
        path: path
      }
    );
  }

  __escapePermissionsPath(path) {
    return path.replace(/\*/g, '{{w}}');
  }

  __unescapePermissionsPath(path) {
    return path.replace(/\{\{w}}/g, '*');
  }

  __validatePermissionsPath(path) {
    if (!path) return 'permission path is null';

    if (path.indexOf('{{w}}') > -1)
      return 'invalid permission path, cannot contain special string {{w}}';

    return true;
  }

  __getNameObj(name) {
    let nameObj = {};
    let suffix = this.type === 'user' ? 'name' : 'Name';
    nameObj[this.type + suffix] = name;
    return nameObj;
  }

  __prepareName(name) {
    return this.type === 'user' ? this.__userPrefix + name : name;
  }
};
