const _ = require('lodash');
const utils = require('../utils/shared');
module.exports = class PermissionsTree {
  constructor(permissionsObj) {
    this.tree = this.buildTree(permissionsObj || {});
  }

  static create(permissionsObj) {
    return new PermissionsTree(permissionsObj);
  }

  buildTree(permissionsObj) {
    return (this.tree = Object.keys(permissionsObj).reduce(
      (tree, permission) =>
        this.mergeBranch(tree, this.createBranch(permission, permissionsObj[permission])),
      {}
    ));
  }

  mergeBranch(tree, branch) {
    return _.merge(tree, branch);
  }

  createBranch(permissionPath, permission) {
    return permissionPath
      .split('/')
      .slice(1)
      .reverse()
      .reduce((branch, segment) => {
        return branch ? { [segment]: branch } : { [segment]: { $leaf: true, ...permission } };
      }, null);
  }

  matchBranches(actions) {
    return (tree, segment) => {
      return tree.reduce((matched, branch) => {
        Object.keys(branch).forEach(branchSegment => {
          if (utils.wildcardMatch(branchSegment, segment)) {
            if (branch[branchSegment].$leaf) {
              if (branch[branchSegment].actions)
                actions.splice(actions.length - 1, 0, ...branch[branchSegment].actions);
              if (branch[branchSegment].prohibit)
                actions.splice(
                  actions.length - 1,
                  0,
                  ...branch[branchSegment].prohibit.map(action => `!${action}`)
                );
            }
            if (utils.wildcardMatch(branchSegment, segment)) matched.push(branch[branchSegment]);
          }
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
      .slice(1)
      .reduce(this.matchBranches(actions), [{ ...searchTree }]);
    return [...new Set(actions)].sort(); //use spread to turn deduplicated Set back into array
  }
};
