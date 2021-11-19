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
    path = path.replace(/^\//, '');
    return this.dataService.upsert(`/_SYSTEM/_SECURITY/_LOOKUP/${tableName}/${path}`, {
      authorized: true
    });
  }

  removePath(path, table) {}
  fetchLookupTable(name) {}

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
    return permissionPaths.some(
      async permPath => !!(await this.permissionTest(permPath, permission.table))
    );
  }

  async __permissionTest(path, table) {
    return await this.dataService.get('/_SYSTEM/_SECURITY/_LOOKUP/', table, path, join('/'));
  }

  __buildPermissionPaths(user, path, matches) {
    let template = path.replace(/\{\{\$([0-9]*)\}\}/g, (m, num) => matches[num]);
    let paths = handlebars.compile(template)(user);
    return Array.isArray(paths) ? paths : [paths];
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
