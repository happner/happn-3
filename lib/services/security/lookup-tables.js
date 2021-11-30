const handlebars = require('handlebars'),
  _ = require('lodash'),
  nodeUtil = require('util'),
  TameSearch = require('tame-search');

module.exports = class LookupTables {
  constructor() {
    this.authorizeCallback = nodeUtil.callbackify(this.authorize);
  }

  static create() {
    return new LookupTables();
  }

  initialize(happn, config) {
    config = config || {};
    config.subscriptionTree = config.subscriptionTree || {};
    config.subscriptionTree.searchCache = config.subscriptionTree.searchCache || 2500;
    config.subscriptionTree.permutationCache = config.subscriptionTree.permutationCache || 2500;
    this.happn = happn;
    this.tables = TameSearch.create(config.subscriptionTree);
    this.dataService = this.happn.services.data;
  }

  async upsertLookupTable(table) {
    for (let path of table.paths) await this.insertPath(table.name, path);
  }

  async insertPath(tableName, path) {
    path = this.__stripLeadingSlashes(path);
    this.tables.subscribe(tableName, path, { path, authorized: true });
    return this.dataService.upsert(`/_SYSTEM/_SECURITY/_LOOKUP/${tableName}/${path}`, {
      authorized: true
    });
  }

  async removePath(tableName, path) {
    path = this.__stripLeadingSlashes(path);
    this.tables.unsubscribe(tableName, path);
    return this.dataService.remove(`/_SYSTEM/_SECURITY/_LOOKUP/${tableName}/${path}`);
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
    let lookupPath = `/_SYSTEM/_SECURITY/_PERMISSIONS/_LOOKUP/${groupName}/${permission.table}`;
    let stored = await this.dataService.get(lookupPath);
    if (!stored) return this.dataService.upsert(lookupPath, { permissions: [permission] });
    let savedPermissions = stored.data.permissions || [];
    if (_.findIndex(savedPermissions, perm => _.isEqual(perm, permission)) === -1)
      return this.dataService.upsert(lookupPath, {
        permissions: [...savedPermissions, permission]
      });
  }

  async __fetchGroupLookupPermissions(groupName) {
    let tables = await this.dataService.get(
      `/_SYSTEM/_SECURITY/_PERMISSIONS/_LOOKUP/${groupName}/**`
    );
    return tables
      ? this.dataService
          .extractData(tables)
          .reduce((perms, table) => perms.concat(table.permissions), [])
      : [];
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

  async authorizeGroup(identity, groupName, path, action) {
    let permissions = await this.__fetchGroupLookupPermissions(groupName);
    if (!permissions || permissions.length === 0) return; //Nothing to test
    return permissions.reduce(
      (authorized, permission) =>
        authorized || this.__testLookupPermission(identity, permission, path, action),
      false
    );
  }

  async __testLookupPermission(identity, permission, path, action) {
    if (!permission.actions.includes(action)) return false;
    let matches = path.match(permission.regex);
    if (!matches) return false;
    let permissionPaths = this.__buildPermissionPaths(
      identity,
      permission.path,
      matches
    ).map(path => this.__stripLeadingSlashes(path));
    // BenchMArk. Also, fetchLookupTable is possibly more resilient to data changes?
    let lookupPaths = (await this.fetchLookupTable(permission.table)).paths || [];
    return permissionPaths.some(permPath => lookupPaths.includes(permPath));
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

  __buildPermissionPaths(identity, path, matches) {
    let template = path.replace(/\{\{\$([0-9]*)\}\}/g, (m, num) => matches[num]);
    let paths = handlebars.compile(template)(identity);
    return Array.isArray(paths) ? paths : [paths];
  }

  // the following works (with arrays or string in values), not 100% tested

  // __buildPermissionPaths(identity, path, matches) {  // With Array variables
  //   let template = path.replace(/\{\{\$([0-9]*)\}\}/g, (m, num) => matches[num]);
  //   let templates = [template];
  //   let templatedRegex = /\{\{(.*?)\}\}/g;

  //   let templateMatch = templatedRegex.exec(template);
  //   while (templateMatch) {
  //     let possibleValueArray = _.get(identity, templateMatch[1]);
  //     let values = Array.isArray(possibleValueArray) ? possibleValueArray : [possibleValueArray];

  //     templates = templates.reduce(
  //       (temps, current) =>
  //         temps.concat(values.map(val => this.__replaceAll(current, templateMatch[0], val))),
  //       []
  //     );
  //     templateMatch = templatedRegex.exec(template);
  //   }

  //   return templates;
  // }

  // __replaceAll(str, search, replacement) {
  //   while (str.indexOf(search) > -1) {
  //     str = str.replace(search, replacement);
  //   }
  //   console.log({ str });
  //   return str;
  // }
};
