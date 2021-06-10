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
    return this.buildPermissionList(pathArray, action, { ...searchTree }, permissionPath);
  }

  checkAllowedLeaf(tree, action) {
    if (
      tree.$leaf &&
      (!tree.prohibit || !tree.prohibit.includes(action)) &&
      tree.actions &&
      tree.actions.includes(action)
    ) {
      return tree.$leaf;
    }
    return null;
  }

  checkProhibitedLeaf(branch, action) {
    return !!(branch.prohibit && branch.prohibit.includes(action));
  }

  buildPermissionList(pathArray, action, tree, originalPath) { 
    originalPath = originalPath.replace(/\*\*$/, '*');
    if (!tree || Object.keys(tree).length === 0) return { allowed: [], prohibited: [] };

    if (pathArray.length === 0) {
      const leaf = this.checkAllowedLeaf(tree, action);
      if (leaf) return { allowed: [leaf], prohibited: [] };
      return { allowed: [], prohibited: [] };
    }

    if (tree['*']) {
      let leaf = this.checkAllowedLeaf(tree['*'], action);
      let final = Object.keys(tree['*']).every(key =>
        ['$leaf', 'prohibit', 'actions'].includes(key)
      );
      let final2 = Object.keys(tree).every(key =>
        ['$leaf', 'prohibit', 'actions', '*'].includes(key)
      );
      let permissions = { allowed: [originalPath], prohibited: [] };
      if (leaf && final && final2) return permissions;

      let prohibitions = this.buildProhibitions(tree, action);
      for (let prohibition of prohibitions) {
        if (prohibition.endsWith['*'] && originalPath.startsWith(prohibition.replace(/\*$/, ''))) {
          permissions = { allowed: [], prohibited: [] };
          break;
        }
        if (prohibition.startsWith(originalPath.replace(/\*+$/, '')))
          permissions.prohibited.push(prohibition);
      }
      return permissions;
    }
    if (pathArray[0] === '**') {
      if (tree['*']) {
        const leaf = this.checkAllowedLeaf(tree['*'], action);
        if (leaf) return { allowed: [leaf], prohibited: this.buildProhibitions(tree, action) };
        if (this.checkProhibitedLeaf(tree['*'], action)) return { allowed: [], prohibited: [] };
      }
      return this.buildOutWild(tree, action);
    }

    if (pathArray[0] === '*') {
      if (!tree['*']) {
        return { allowed: [], prohibited: [] };
      }
      const leaf = this.checkAllowedLeaf(tree['*'], action);
      if (leaf) return { allowed: [leaf], prohibited: this.buildProhibitions(tree, action) };
      //NB: The above results in a change in behaviour. Previously if we are allowed on 1/2/*
      //    and prohibited on 1/2/3/4, we would still get events on 1/2/3/4
      return { allowed: [], prohibited: [] };
    }

    if (!tree[pathArray[0]]) return { allowed: [], prohibited: [] };
    return this.buildPermissionList(pathArray.slice(1), action, tree[pathArray[0]], originalPath);
  }

  buildProhibitions(tree, action) {
    const treeKeys = Object.keys(tree);
    if (treeKeys.length === 0) return [];

    const filteredBranches = ['$leaf', 'prohibit', 'actions'];
    const prohibitions = [];

    for (const branch of treeKeys) {
      if (filteredBranches.includes(branch)) continue;
      prohibitions.push(...this.buildProhibitions(tree[branch], action));
    }

    if (tree.$leaf) {
      if (this.checkProhibitedLeaf(tree, action)) prohibitions.push(tree.$leaf);
    }

    return prohibitions;
  }

  buildOutWild(tree, action) {
    let allowed = [];
    let prohibited = [];
    const treeKeys = Object.keys(tree);
    if (treeKeys.length === 0) return { allowed, prohibited };
    const filteredBranches = ['$leaf', 'prohibit', 'actions'];
    if (treeKeys.every(branch => filteredBranches.includes(branch))) {
      if (this.checkProhibitedLeaf(tree, action))
        return { allowed, prohibited: [...prohibited, tree.$leaf] };
      if (this.checkAllowedLeaf(tree, action)) 
        return { allowed: [...allowed, tree.$leaf], prohibited };      
      return { allowed, prohibited };
    }

    if (tree.$leaf) {
      if (this.checkProhibitedLeaf(tree, action)) {
        prohibited.push(tree.$leaf);
      }
      if (this.checkAllowedLeaf(tree, action)) {
        allowed.push(tree.$leaf);
      }
    }
    if (tree['*'] && this.checkProhibitedLeaf(tree['*'], action)) {
      return { allowed, prohibited };
    }
    if (tree['*'] && this.checkAllowedLeaf(tree['*'], action))
      return {
        allowed: [...allowed, tree['*'].$leaf],
        prohibited: [...prohibited, ...this.buildProhibitions(tree, action)]
      };

    for (const branch of treeKeys) {
      if (filteredBranches.includes(branch)) continue;
      let newLists = this.buildOutWild(tree[branch], action);
      allowed = [...allowed, ...newLists.allowed];
      prohibited = [...prohibited, ...newLists.prohibited];
    }

    return { allowed, prohibited };
  }
};
