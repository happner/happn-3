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

  async upsertLookupPermission(group, permission) {
    let lookuPath = `/_SYSTEM/_SECURITY/_PERMISSIONS/_LOOKUP/${group.groupName}/${permission.table}`;
    let permissions = await this.dataService.get(lookupPath);
    if (!permissions) return this.dataService.upsert(lookupPath, { permissions: [permission] });
    let savedPermissions = this.dataService.extractData(permissions);
    savedPermissions.permissions.push(permission);
    return this.dataService.upsert(lookupPath, { permissions: [permission] });
  }

  async insertPath(path, tableName) {
    path = this.__stripLeadingSlashes(path);
    return this.dataService.upsert(`/_SYSTEM/_SECURITY/_LOOKUP/${tableName}/${path}`, {
      authorized: true
    });
  }
  __stripLeadingSlashes(path) {
    return path.replace(/^\//, '');
  }

  async removePath(path, tableName) {
    path = this.__stripLeadingSlashes(path);
    return this.dataService.remove(`/_SYSTEM/_SECURITY/_LOOKUP/${tableName}/${path}`);
  }

  async fetchLookupTable(tableName) {
    let tablePaths = await this.dataService.get(`/_SYSTEM/_SECURITY/_LOOKUP/${tableName}/**`);
    let paths = tablePaths
      .filter(tp => tp.data.authorized)
      .map(tp => this.extractPath(tp._meta.path, tableName));
    return { name: tableName, paths };
  }

  extractPath(path, tableName) {
    return path
      .split(tableName + '/')
      .slice(1)
      .join(tableName + '/');
  }

  async testLookupTables(user, groupName, path, action) {
    let permissions = this.__fetchGroupLookupPermissions(groupName);
    if (!permissions || permissions.length === 0) return; //Nothing to test
    return permissions.reduce(
      (authorized, permission) =>
        authorized || this.__testLookupPermission(user, permission, path, action),
      false
    );
  }

  async __testLookupPermission(user, permission, path, action) {
    if (!permission.actions.includes(action)) return false;
    let matches = path.match(permission.regEx);
    if (!matches) return false;
    let permissionPaths = this.__buildPermissionPaths(user, permission.path, matches);
    let lookupPaths = (await this.fetchLookupTable(permission.table)).paths || [];
    return permissionPaths.some(permPath => lookupPaths.includes(permPath));
  }

  // __buildPermissionPaths(identity, path, matches) {
  //   let template = path.replace(/\{\{\$([0-9]*)\}\}/g, (m, num) => matches[num]);
  //   // let templatedRegex = /\{\{([^\$].*?)\}\}/g;

  //   // let templateMatches = templatedRegex.exec(path)
  //   // while (templateMatches) {
  //   //   if Array.isArray(_.get())
  //   // }
  //   let paths = handlebars.compile(template)(identity);
  //   return Array.isArray(paths) ? paths : [paths];
  // }

  __buildPermissionPaths(identity, path, matches) {
    let template = path.replace(/\{\{\$([0-9]*)\}\}/g, (m, num) => matches[num]);
    let templates = [template]
    let templatedRegex = /\{\{(.*?)\}\}/g;

    let templateMatch = templatedRegex.exec(template);
    while (templateMatch) {
      let possibleValueArray = _.get(identity, templateMatch[1]);
      if (Array.isArray(possibleValueArray)) {
        templates = possibleValueArray.map(val =>
          templates.map(temp => temp.replaceAll(templateMatch[0], val))
        );
      }
      templateMatch = templatedRegex.exec(template);
    }
    return templates.map(template => handlebars.compile(template)(identity));
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
};
