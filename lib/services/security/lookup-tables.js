const _ = require('lodash'),
  nodeUtil = require('util'),
  CONSTANTS = require('../..').constants;
const utils = require('../utils/shared');
module.exports = class LookupTables {
  constructor() {
    this.authorizeCallback = nodeUtil.callbackify(this.authorize);
    this.wildcardMatch = utils.wildcardMatch.bind(utils);
    this.stripLeadingSlashes = utils.stripLeadingSlashes;
  }

  static create() {
    return new LookupTables();
  }

  initialize(happn, config) {
    this.config = config || {};
    this.happn = happn;
    this.dataService = this.happn.services.data;
    this.securityService = this.happn.services.security;
    this.utils = this.happn.services.utils;
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

  async deleteLookupTable(name) {
    let table = await this.fetchLookupTable(name);
    for (let path of table.paths) {
      await this.removePath(name, path, false);
    }
    let affectedGroups = await this.__getGroupsByTable(name);
    return this.securityService.dataChanged(
      CONSTANTS.SECURITY_DIRECTORY_EVENTS.LOOKUP_TABLE_CHANGED,
      {
        groups: affectedGroups,
        table: name
      },
      null
    );
  }

  async insertPath(tableName, path, callDataChanged = true) {
    path = this.stripLeadingSlashes(path);
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

  async removePath(tableName, path, callDataChanged = true) {
    path = this.stripLeadingSlashes(path);
    await this.dataService.remove(`/_SYSTEM/_SECURITY/_LOOKUP/${tableName}/${path}`);
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

  async __getGroupsByTable(tableName) {
    let lookupPath = `/_SYSTEM/_SECURITY/_PERMISSIONS/_LOOKUP/${tableName}/*`;
    let storedGroups = await this.dataService.get(lookupPath);
    let groups = storedGroups.map(data => data._meta.path.split('/').pop());
    return groups;
  }

  async fetchLookupTable(name) {
    let tablePaths = await this.dataService.get(`/_SYSTEM/_SECURITY/_LOOKUP/${name}/*`);
    let paths = tablePaths
      .filter(tp => tp.data.authorized)
      .map(tp => this.__extractPath(tp._meta.path, name));
    return { name, paths };
  }

  __extractPath(path, tableName) {
    return path
      .split(tableName + '/')
      .slice(1)
      .join(tableName + '/');
  }

  async upsertLookupPermission(groupName, permission) {
    let storedPermissions = await this.fetchLookupPermissions(groupName);
    if (storedPermissions.find(current => _.isEqual(current, permission))) return; //permission already stored

    storedPermissions.push(permission);
    await this.__storePermissions(groupName, storedPermissions, permission.table);
    return this.securityService.dataChanged(
      CONSTANTS.SECURITY_DIRECTORY_EVENTS.LOOKUP_PERMISSION_CHANGED,
      {
        group: groupName,
        table: permission.table
      },
      null
    );
  }

  async __storePermissions(groupName, permissions, tableName) {
    let relevantPermissions = permissions.filter(perm => perm.table === tableName);
    let dataPathGxT = `/_SYSTEM/_SECURITY/_PERMISSIONS/_LOOKUP/${tableName}/${groupName}`;
    let dataPathTxG = `/_SYSTEM/_SECURITY/_PERMISSIONS/_LOOKUP/${groupName}/${tableName}`;
    if (relevantPermissions.length === 0) {
      await this.dataService.remove(dataPathGxT);
      return this.dataService.remove(dataPathTxG);
    } else {
      await this.dataService.upsert(dataPathGxT, {});
      return this.dataService.upsert(dataPathTxG, {
        permissions: relevantPermissions
      });
    }
  }

  async fetchLookupPermissions(groupName) {
    let storedPermissions = await this.dataService.get(
      `/_SYSTEM/_SECURITY/_PERMISSIONS/_LOOKUP/${groupName}/*`
    );
    return this.dataService
      .extractData(storedPermissions)
      .reduce((perms, table) => perms.concat(table.permissions), []);
  }

  async removeLookupPermission(groupName, permission) {
    let storedPermissions = await this.fetchLookupPermissions(groupName);
    let index = storedPermissions.findIndex(current => _.isEqual(current, permission));
    if (index > -1) {
      storedPermissions.splice(index, 1);
      return this.__storePermissions(groupName, storedPermissions, permission.table);
    }
  }

  async removeAllTablePermission(groupName, tableName) {
    let storedPermissions = await this.fetchLookupPermissions(groupName);
    storedPermissions = storedPermissions.filter(permission => permission.table !== tableName);
    return this.__storePermissions(groupName, storedPermissions, tableName);
  }

  async authorize(session, path, action) {
    if (!session.user) {
      session.user = await this.securityService.users.getUser(session.username);
      session.user.name = session.username;
      delete session.username;
    }

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
    let permissions = await this.fetchLookupPermissions(groupName);
    if (!permissions || permissions.length === 0) return false; //Nothing to test
    return permissions.reduce(
      (authorized, permission) =>
        authorized || this.__authorizeLookupPermission(session, permission, path, action),
      false
    );
  }

  async __authorizeLookupPermission(session, permission, path, action) {
    if (!permission.actions.includes(action)) return false;
    let matches = path.match(permission.regex);
    if (!matches) return false;

    let permissionPaths = this.__buildPermissionPaths(session, permission.path, matches).map(path =>
      this.stripLeadingSlashes(path)
    );
    let lookupPaths = (await this.fetchLookupTable(permission.table)).paths;
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
          temps.concat(values.map(val => this.utils.replaceAll(current, templateMatch[0], val))),
        []
      );

      templateMatch = templatedRegex.exec(template);
    }

    return templates;
  }
};
