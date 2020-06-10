const _ = require('lodash');
module.exports = class PermissionsTree {
  constructor(permissionsObj, utilsService) {
    this.tree = this.buildTree(permissionsObj || {});
    this.utils = utilsService || require('../utils/shared');
  }

  static create(permissionsObj) {
    return new PermissionsTree(permissionsObj);
  }

  buildTree(permissions) {
    return (this.tree = Object.keys(permissions).reduce(this.mergeBranch(permissions), {}));
  }

  mergeBranch(permissions) {
    return (tree, path) =>
      _.set(tree, path.split('/').slice(path.startsWith('/') ? 1 : 0), {
        $leaf: path,
        ...permissions[path]
      });
  }

  createBranch(permissionPath, permission) {
    return permissionPath
      .split('/')
      .slice(permissionPath.startsWith('/') ? 1 : 0)
      .reverse()
      .reduce((branch, segment) => {
        return branch
          ? { [segment]: branch }
          : { [segment]: { $leaf: permissionPath, ...permission } };
      }, null);
  }

  spliceActions(branch, branchSegment, actions) {
    if (branch[branchSegment].actions)
      actions.splice(actions.length - 1, 0, ...branch[branchSegment].actions);
    if (branch[branchSegment].action)
      actions.splice(actions.length - 1, 0, ...branch[branchSegment].action);
    if (branch[branchSegment].prohibit)
      actions.splice(
        actions.length - 1,
        0,
        ...branch[branchSegment].prohibit.map(action => `!${action}`)
      );
  }

  matchBranches(actions, permissionPath) {
    return (tree, segment) => {
      return tree.reduce((matched, branch) => {
        Object.keys(branch).forEach(branchSegment => {
          if (
            branch[branchSegment].$leaf &&
            this.utils.wildcardMatch(branch[branchSegment].$leaf, permissionPath, 'PERMISSION-PATH')
          ) {
            this.spliceActions(branch, branchSegment, actions);
            matched.push(branch[branchSegment]);
          } else if (this.utils.wildcardMatch(branchSegment, segment, 'PERMISSION-SEGMENT'))
            matched.push(branch[branchSegment]);
        });
        return matched;
      }, []);
    };
  }

  search(permissionPath, tree) {
    const searchTree = tree || this.tree;
    const actions = [];
    permissionPath
      .split('/')
      .slice(permissionPath.startsWith('/') ? 1 : 0)
      .reduce(this.matchBranches(actions, permissionPath), [{ ...searchTree }]);
    return [...new Set(actions)].sort(); //use spread to turn deduplicated Set back into array
  }
};
