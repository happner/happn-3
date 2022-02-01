module.exports = class PermissionsTemplate {
  constructor(utilsService) {
    this.utilsService = utilsService;
  }
  static create(utilsService) {
    return new PermissionsTemplate(utilsService);
  }
  parsePermissions(path, context) {
    if (path.indexOf('{{') === -1) {
      // no substitution, so return
      return [path];
    }
    return this.utilsService.getTemplatedPathCombinations(path, context, this.validator);
  }
  validator(value, key, path) {
    if (value.toString().indexOf('*') > -1) {
      throw new Error(
        `illegal promotion of permissions via permissions template, permissionPath: ${path}, substitution key: ${key}, value: ${value}`
      );
    }
  }
};
