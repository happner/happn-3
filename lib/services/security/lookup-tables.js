const handlebars = require('handlebars');
const _ = require('lodash');
module.exports = class LookupTables {
  constructor() {}
  static create() {
    return new LookupTables();
  }
  initialize(happn, config) {
    this.happn = happn;
    this.dataService = this.happn.services.data;
  }

  upsertLookupTable(table) {
    table.paths.forEach(path => this.insertPath(path, table.name));
  }

  async insertPath(path, tableName) {
    path = this.__stripLeadingSlashes(path);
    return this.dataService.upsert(`/_SYSTEM/_SECURITY/_LOOKUP/${tableName}/${path}`, {
      authorized: true
    });
  }

  async removePath(path, tableName) {
    path = this.__stripLeadingSlashes(path);
    return this.dataService.remove(`/_SYSTEM/_SECURITY/_LOOKUP/${tableName}/${path}`);
  }

  async fetchLookupTable(tableName) {
    let tablePaths = await this.dataService.get(`/_SYSTEM/_SECURITY/_LOOKUP/${tableName}/**`);
    let paths = tablePaths
      .filter(tp => tp.data.authorized)
      .map(tp => this.__extractPath(tp._meta.path, tableName));
    return { name: tableName, paths };
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

  async testLookupTables(identity, groupName, path, action) {
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
    let lookupPaths = (await this.fetchLookupTable(permission.table)).paths || [];
    return permissionPaths.some(permPath => lookupPaths.includes(permPath));
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
  //     console.log({ templates });
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
