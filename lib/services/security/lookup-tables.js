const _ = require('lodash'),
  nodeUtil = require('util'),
  CONSTANTS = require('../..').constants;
const utils = require('../utils/shared');
module.exports = class LookupTables {
  constructor() {
    this.authorizeCallback = nodeUtil.callbackify(this.authorize);
    this.wildcardMatch = utils.wildcardMatch.bind(utils);
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
  }

  defaults(config) {
    config = config || {};
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
    let lookupPath = `/_SYSTEM/_SECURITY/_PERMISSIONS/_LOOKUP/${tableName}/**`;
    let storedGroups = await this.dataService.get(lookupPath);
    let groups = storedGroups ? storedGroups.map(data => data._meta.path.split('/').pop()) : [];
    return groups;
  }

  async fetchLookupTable(name) {
    let tablePaths = await this.dataService.get(`/_SYSTEM/_SECURITY/_LOOKUP/${name}/**`);
    let paths = tablePaths
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
    let storedPermissions = await this.__fetchGroupLookupPermissions(groupName);
    if (_.findIndex(storedPermissions, perm => _.isEqual(perm, permission)) === -1) {
      //The above is to prevent data bloat. not sure if necessary
      storedPermissions.push(permission);
      await this.__storePermissions(groupName, storedPermissions, permission.table);
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

  async __storePermissions(groupName, permissions, tableName) {
    let dataPath = `/_SYSTEM/_SECURITY/_PERMISSIONS/_LOOKUP/${tableName}/${groupName}`;
    let dataPath2 = `/_SYSTEM/_SECURITY/_PERMISSIONS/_LOOKUP/${groupName}/${tableName}`;
    let relevantPermissions = permissions.filter(perm => perm.table === tableName);
    await this.dataService.upsert(dataPath, {
      // permissions: relevantPermissions
    });
    return this.dataService.upsert(dataPath2, {
      permissions: relevantPermissions
    });
  }

  async __fetchGroupLookupPermissions(groupName) {
    let storedPermissions = await this.dataService.get(
      `/_SYSTEM/_SECURITY/_PERMISSIONS/_LOOKUP/${groupName}/*`
    );

    if (storedPermissions) {
      let permissions = this.dataService
        .extractData(storedPermissions)
        .reduce((perms, table) => perms.concat(table.permissions), []);
      return permissions;
    }
    return [];
  }

  async removeLookupPermission(groupName, permission) {
    let storedPermissions = await this.__fetchGroupLookupPermissions(groupName);
    if (!storedPermissions) return;
    let index = _.findIndex(storedPermissions, perm => _.isEqual(perm, permission));
    if (index === -1) return;
    storedPermissions.splice(index, 1);
    this.__storePermissions(groupName, storedPermissions, permission.table);
  }

  async removeAllTablePermission(groupName, tableName) {
    let storedPermissions = await this.__fetchGroupLookupPermissions(groupName);
    storedPermissions = storedPermissions.filter(permission => !permission.table === tableName);
    this.__storePermissions(groupName, storedPermissions, tableName);
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
      lookupPaths.some(luPath => this.wildcardMatch(permPath, luPath))
    );
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
