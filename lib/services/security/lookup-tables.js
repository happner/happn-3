const handlebars = require('handlebars'),
  _ = require('lodash'),
  nodeUtil = require('util'),
  TameSearch = require('tame-search'),
  CONSTANTS = require('../..').constants;
module.exports = class LookupTables {
  constructor() {
    this.authorizeCallback = nodeUtil.callbackify(this.authorize);
  }

  static create() {
    return new LookupTables();
  }

  initialize(happn, config) {
    this.config = this.defaults(config);
    this.happn = happn;
    this.cacheService = this.happn.services.cache;
    this.dataService = this.happn.services.data;
    this.securityService = this.happn.services.security;
    this.tables = TameSearch.create(this.config.subscriptionTree);
    this.caches = {
      groupsByTable: this.cacheService.new('lookup-groups-by-table', {
        type: 'LRU',
        cache: this.config.caches.groupsByTable
      }),
      permissions: this.cacheService.new('lookup-permissions', {
        type: 'LRU',
        cache: this.config.caches.permisions
      })
    };
    this.initialized = true;
  }

  defaults(config) {
    config = config || {};
    config.subscriptionTree = config.subscriptionTree || {};
    config.subscriptionTree.searchCache = config.subscriptionTree.searchCache || 2500;
    config.subscriptionTree.permutationCache = config.subscriptionTree.permutationCache || 2500;
    config.caches = config.caches || {};
    config.caches.groupsByTable = config.caches.groupsByTable || {
      max: 300,
      maxAge: 0
    };
    config.caches.permisions = config.caches.permisions || {
      max: 300,
      maxAge: 0
    };
    return config;
  }

  async upsertLookupTable(table) {
    for (let path of table.paths) await this.insertPath(table.name, path, false);
    let affectedGroups = await this.__getGroupsByTable(table.name);
    return this.securityService.dataChanged(
      CONSTANTS.SECURITY_DIRECTORY_EVENTS.LOOKUP_TABLE_CHANGED,
      {
        groups: affectedGroups,
        table: table.name
      },
      null
    );
  }

  async insertPath(tableName, path, callDataChanged = true) {
    path = this.__stripLeadingSlashes(path);
    this.tables.subscribe(tableName, path, { path, authorized: true });
    await this.dataService.upsert(`/_SYSTEM/_SECURITY/_LOOKUP/${tableName}/${path}`, {
      authorized: true
    });
    if (callDataChanged) {
      let affectedGroups = await this.__getGroupsByTable(tableName);
      return this.securityService.dataChanged(
        CONSTANTS.SECURITY_DIRECTORY_EVENTS.LOOKUP_TABLE_CHANGED,
        {
          groups: affectedGroups,
          table: tableName
        },
        null
      );
    }
  }

  async removePath(tableName, path) {
    path = this.__stripLeadingSlashes(path);
    this.tables.unsubscribe(tableName, path);
    await this.dataService.remove(`/_SYSTEM/_SECURITY/_LOOKUP/${tableName}/${path}`);
    let affectedGroups = await this.__getGroupsByTable(tableName);
    return this.securityService.dataChanged(
      CONSTANTS.SECURITY_DIRECTORY_EVENTS.LOOKUP_TABLE_CHANGED,
      {
        groups: affectedGroups,
        table: tableName
      },
      null
    );
  }

  async __getGroupsByTable(tableName) {
    let cachedGroups = this.caches.groupsByTable.getSync(tableName, { clone: false });
    if (cachedGroups) return cachedGroups || [];
    let lookupPath = `/_SYSTEM/_SECURITY/_PERMISSIONS/_LOOKUP/${tableName}/**`;
    let storedGroups = await this.dataService.get(lookupPath);
    let groups = storedGroups ? storedGroups.map(data => data._meta.path.split('/').pop()) : [];
    this.caches.groupsByTable.setSync(tableName, groups, { clone: false });
    return groups;
  }

  async fetchLookupTable(name) {
    let paths = this.tables
      .searchAll({ filter: { subscriberKey: name, authorized: true } })
      .map(sub => sub.path);

    if (paths) return { name, paths };
    let tablePaths = await this.dataService.get(`/_SYSTEM/_SECURITY/_LOOKUP/${name}/**`);
    paths = tablePaths
      .filter(tp => tp.data.authorized)
      .map(tp => this.__extractPath(tp._meta.path, name));
    return { name, paths };
  }

  __stripLeadingSlashes(path) {
    return path.replace(/^\//, '');
  }

  __extractPath(path, tableName) {
    return path
      .split(tableName + '/')
      .slice(1)
      .join(tableName + '/');
  }

  async upsertLookupPermission(groupName, permission) {
    let groups = await this.__getGroupsByTable(permission.table);
    groups = groups.includes(groupName) ? groups : groups.concat([groupName]);
    this.caches.groupsByTable.setSync(permission.table, groups, { clone: false });

    let storedPermissions = await this.__fetchGroupLookupPermissions(groupName);
    if (_.findIndex(storedPermissions, perm => _.isEqual(perm, permission)) === -1) {
      //The above is to prevent data bloat. not sure if necessary
      storedPermissions.push(permission);
      this.__storeGroupPermissions(groupName, storedPermissions, permission.table);
      return this.securityService.dataChanged(
        CONSTANTS.SECURITY_DIRECTORY_EVENTS.LOOKUP_PERMISSION_UPSERTED,
        {
          group: groupName,
          table: permission.table
        },
        null
      );
    }
  }

  async __storeGroupPermissions(groupName, permissions, changedTable) {
    let dataPath = `/_SYSTEM/_SECURITY/_PERMISSIONS/_LOOKUP/${changedTable}/${groupName}`;
    this.caches.permissions.setSync(groupName, permissions, { clone: false });
    return this.dataService.upsert(dataPath, {
      permissions: permissions.filter(perm => perm.table === changedTable)
    });
  }

  async removeLookupPermission(groupName, permission) {
    let storedPermissions = await this.__fetchGroupLookupPermissions(groupName);
    if (!storedPermissions) return;
    let index = _.findIndex(storedPermissions, perm => _.isEqual(perm, permission));
    if (index === -1) return;
    storedPermissions.splice(index, 1);
    if (storedPermissions.length === 0) this.removeGroupFromCache(groupName, permission.table);
    this.__storeGroupPermissions(groupName, storedPermissions, permission.table);
  }

  async removeAllTablePermission(groupName, tableName) {
    let storedPermissions = await this.__fetchGroupLookupPermissions(groupName);
    if (!storedPermissions) return this.removeGroupFromCache(groupName, tableName);
    storedPermissions = storedPermissions.filter(permission => !permission.table === tableName);
    this.__storeGroupPermissions(groupName, storedPermissions, tableName);
  }

  removeGroupFromCache(groupName, tableName) {
    let cachedGbT = this.caches.groupsByTable.getSync(tableName, { clone: false });
    let index = cachedGbT.findIndex(groupName);
    if (index === -1) return;
    cachedGbT.splice(index, 1);
    this.caches.groupsByTable.setSync(tableName, cachedGbT, { clone: false });
  }

  async __fetchGroupLookupPermissions(groupName) {
    let cachedPermissions = this.caches.permissions.getSync(groupName, { clone: false });
    if (cachedPermissions) return cachedPermissions;
    let storedPermissions = await this.dataService.get(
      `/_SYSTEM/_SECURITY/_PERMISSIONS/_LOOKUP/${groupName}/**`
    );
    if (storedPermissions) {
      let permissions = this.dataService
        .extractData(storedPermissions)
        .reduce((perms, table) => perms.concat(table.permissions), []);
      this.caches.permissions.setSync(groupName, permissions, { clone: false });
      return permissions;
    }
    this.caches.permissions.setSync(groupName, [], { clone: false });
    return [];
  }

  async authorize(session, path, action) {
    // May need to user users.getUser to fetch groups. Not sure. Testing will show.
    let groups = Object.keys(session.user.groups);
    let authorized = false;
    for (let group of groups) {
      let ok = await this.authorizeGroup(session, group, path, action);
      if (ok) {
        authorized = true;
        break;
      }
    }
    return authorized;
  }

  async authorizeGroup(session, groupName, path, action) {
    let permissions = await this.__fetchGroupLookupPermissions(groupName);
    if (!permissions || permissions.length === 0) return false; //Nothing to test
    return permissions.reduce(
      (authorized, permission) =>
        authorized || this.__testLookupPermission(session, permission, path, action),
      false
    );
  }

  async __testLookupPermission(session, permission, path, action) {
    if (!permission.actions.includes(action)) return false;
    let matches = path.match(permission.regex);
    if (!matches) return false;

    let permissionPaths =
      this.__buildPermissionPaths(session, permission.path, matches).map(path =>
        this.__stripLeadingSlashes(path)
      ) || [];
    // Benchmarks...
    let lookupPaths = (await this.fetchLookupTable(permission.table)).paths || [];
    return permissionPaths.some(permPath =>
      lookupPaths.some(luPath => this.__wildCardMatch(permPath, luPath))
    );

    //Following is on hold - either add ability to use wildcards searches (wildcard in middle of paths) in tame search
    // Or  just use the above.

    // return permissionPaths.some(
    //   permPath => {
    //     let results = this.tables.search(permPath)
    //     //   , {
    //     //   filter: { subscriberKey: permission.table, authorized: true }
    //     // })

    //     return results.length > 0
    //   }
    // );
  }

  //  Doesn't handle arrays, old code kept just in case.
  // __buildPermissionPaths(session, path, matches) {
  //   let template = path.replace(/\{\{\$([0-9]*)\}\}/g, (m, num) => matches[num]);
  //   let paths = handlebars.compile(template)(session);
  //   return Array.isArray(paths) ? paths : [paths];
  // }

  __wildCardMatch(pattern, matchTo) {
    if (pattern.indexOf('*') === -1) return pattern === matchTo;
    let firstArray = pattern.split('/');
    let secondArray = matchTo.split('/');
    if (firstArray.length !== secondArray.length) return false;

    for (let [index, item] of firstArray.entries()) {
      // -NB assuming for now that wildcards will be full segments, i.e. no /Ja*Yspeert/;
      if (item !== '*') continue;
      firstArray[index] = secondArray[index];
    }
    return firstArray.join('/') === secondArray.join('/');
  }

  __buildPermissionPaths(session, path, matches) {
    // With Array variables
    let template = path.replace(/\{\{\$([0-9]*)\}\}/g, (m, num) => matches[num]);
    let templates = [template];
    let templatedRegex = /\{\{(.*?)\}\}/g;

    let templateMatch = templatedRegex.exec(template);
    while (templateMatch) {
      let possibleValueArray = _.get(session, templateMatch[1]);
      let values = Array.isArray(possibleValueArray) ? possibleValueArray : [possibleValueArray];

      templates = templates.reduce(
        (temps, current) =>
          temps.concat(values.map(val => this.__replaceAll(current, templateMatch[0], val))),
        []
      );
      templateMatch = templatedRegex.exec(template);
    }

    return templates;
  }

  __replaceAll(str, search, replacement) {
    while (str.indexOf(search) > -1) {
      str = str.replace(search, replacement);
    }
    return str;
  }
};
