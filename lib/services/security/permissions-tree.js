const { set } = require('lodash');
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
      _.setWith(
        tree,
        path.split('/').slice(path.startsWith('/') ? 1 : 0),
        {
          $leaf: path,
          ...permissions[path]
        },
        Object
      );
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

  wildcardPathSearch(permissionPath, action, tree) {
    const searchTree = tree || this.tree;
    let pathArray = permissionPath.split('/').slice(permissionPath.startsWith('/') ? 1 : 0);

    if (pathArray.includes('**') && pathArray.indexOf('**') < pathArray.length - 1) {
      return new Error('Recursive wildcards are invalid unless at end of permission path');
    }

    return this.buildPermissionList(pathArray, action, { ...searchTree });
  }

  checkForLeaf(tree, action) {
    if (
      tree.$leaf &&
      (!tree.prohibit || !tree.prohibit[action]) &&
      tree.actions &&
      tree.actions.includes(action)
    ) {
      return tree.$leaf;
    }
    return null;
  }

  checkProhibited(branch, action) {
    return !!(branch.prohibit && branch.prohibit.includes(action));
  }

  buildPermissionList(pathArray, action, tree) {
    if (!tree || Object.keys(tree).length === 0) return { allowed: [], prohibited: [] };

    let leaf;
    if (pathArray.length === 0) {
      leaf = this.checkForLeaf(tree, action);
      if (leaf) return { allowed: [leaf], prohibited: [] };
      return { allowed: [], prohibited: [] };
    }
    {
      // if (pathArray[0] === '*') {
      //   if (tree['*']) {
      //     leaf = this.checkForLeaf(tree['*'], action);
      //     if (leaf) return { allowed: [leaf], prohibited: [] };
      //     if (this.checkProhibited(tree['*'], action)) return { allowed: [], prohibited: [] };
      //   }
      //   //Action is neither allowed nor prohibited explicitly on "*", must check all non wildcard paths
      //   let permissionPaths = [];
      //   if (pathArray.length === 1) {
      //     Object.keys(tree).forEach(branch => {
      //       let leaf = this.checkForLeaf(tree[branch], action);
      //       if (leaf) permissionPaths = [...permissionPaths, leaf];
      //     });
      //     return permissionPaths;
      //   }
      //   if (pathArray.length > 1) {
      //     Object.keys(tree).forEach(branch => {
      //       permissionPaths = [
      //         ...permissionPaths,
      //         ...this.buildPermissionList(pathArray.slice(1), action, tree[branch])
      //       ];
      //     });
      //     return permissionPaths;
      //   }
      // }
    }
    if (pathArray[0] === '**') {
      if (tree['*']) {
        leaf = this.checkForLeaf(tree['*'], action);
        if (leaf) return { allowed: [leaf], prohibited: this.listProhibitions(tree, action) };
        if (this.checkProhibited(tree['*'], action)) return { allowed: [], prohibited: [] };
      }

      return this.buildAllPermissions(tree, action);
    }

    if (!tree[pathArray[0]]) return { allowed: [], prohibited: [] };
    return this.buildPermissionList(pathArray.slice(1), action, tree[pathArray[0]]);
  }

  buildAllPermissions(tree, action) {
    if (Object.keys(tree).length === 0) return [];
    if (tree.$leaf) {
      let leaf = this.checkForLeaf(tree, action);
      if (leaf) return [leaf];
      return [];
    }
    let permissions = [];
    Object.keys(tree).forEach(branch => {
      permissions = [...permissions, ...this.buildAllPermissions(tree[branch], action)];
    });
    return permissions;
  }

  listProhibitions(tree, action) {
    const treeKeys = Object.keys(tree);
    if (treeKeys.length === 0) return [];

    const filteredBranches = ['$leaf', 'prohibit', 'actions'];
    const permissions = [];

    for (const branch of treeKeys) {
      if (filteredBranches.includes(branch)) continue;
      permissions.push(...this.listProhibitions(tree[branch], action));
    }

    if (tree.$leaf) {
      if (this.checkProhibited(tree, action)) permissions.push(tree.$leaf);
    }

    return permissions;
  }
};
