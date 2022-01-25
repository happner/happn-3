const _ = require('lodash');
module.exports = class PermissionsTemplate {
  static create() {
    return new PermissionsTemplate();
  }
  branchPaths(tags, rawPath) {
    return (paths, key) => {
      let values = tags[key];
      if (paths.length === 0) {
        paths = new Array(values.length).fill(rawPath);
      }
      let returnPaths = [];
      paths.forEach(path => {
        values.forEach(value => {
          const finalPath = path.replace(`{{${key}}}`, value);
          if (returnPaths.indexOf(finalPath) === -1) {
            returnPaths.push(finalPath);
          }
        });
      }, paths);
      return returnPaths;
    };
  }
  parsePermissions(rawPath, context) {
    if (rawPath.indexOf('{{') === -1) {
      // no substitution, so return
      return [rawPath];
    }
    const tags = this.getTags(rawPath, context);
    return Object.keys(tags).reduce(this.branchPaths(tags, rawPath), []);
  }
  getTags(rawPath, context) {
    return rawPath
      .split('{{')
      .slice(1)
      .map(item => item.split('}}')[0])
      .reduce(this.setValues(context, rawPath), {});
  }
  setValues(context, rawPath) {
    return (values, key) => {
      const value = _.get(context, key);
      if (value == null) {
        return values;
      }
      values[key] = this.validateAndTransformSubstitution(value, key, rawPath);
      return values;
    };
  }
  validateAndTransformSubstitution(value, key, rawPath) {
    const substition = Array.isArray(value) ? value : [value];
    substition.forEach(substitutionValue => {
      if (substitutionValue.indexOf('*') > -1) {
        throw new Error(
          `illegal promotion of permissions via permissions template, permissionPath: ${rawPath}, substitution key: ${key}, value: ${substitutionValue}`
        );
      }
    });
    return substition;
  }
};
