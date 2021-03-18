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

  wildcardPathSearch(permissionPath, action, depth, tree) {
    const searchTree = tree || this.tree;
    let results = []    
    let pathArray = permissionPath
      .split('/')
      .slice(permissionPath.startsWith('/') ? 1 : 0)      

    if (pathArray.indexOf('**') < (pathArray.length -1))  {return new Error('kak')}
    let subTree = this.buildSubTree(pathArray, action, {...searchTree})
  }

  buildSubTree(pathArray, action, depth, tree, returnTree){
    if  (pathArray = []) {
      if (!tree.prohibit || !tree.prohibit[action])
        if (tree.actions && tree.actions[action]) return true;
      return false;  
    }
    if (pathArray[0] == '*' && pathArray.length > 1) {
      let subtree = {}
      Object.keys(tree).forEach(branch => {
        subtree[branch] = buildsubTree(pathArray.slice(1), action, depth, tree[branch]) 
      })
      return subtree
    }
    if (pathArray[0] == '*' && pathArray.length == 1) {
      let subtree = {}
      Object.keys(tree).forEach(branch => {
        if (!tree[branch].prohibit || !tree[branch].prohibit[action])
        subtree[branch] = !!(tree.actions && tree.actions[action])
      })
      return subtree
    }
    if (pathArray[0] == '**' && pathArray.length == 1) {
      //VARIABLE DEPTH ???      
      Object.keys(tree).forEach(branch => {
        if (!tree[branch].prohibit || !tree[branch].prohibit[action])
        subtree[branch] = !!(tree.actions && tree.actions[action])
      })
      return subtree
    }
    // new

    returnTree = returnTree || {};
      if (pathArray[0] !== "*" && pathArray[0] !== "**") {
      if (tree[pathArray[0]]) {
        returnTree[pathArray[0]] = buildSubTree(pathArray[0], action, tree[pathArray[0]])
      }     
    }
  }

  buildPathTree(accumulator, currentValue, currentIndex, array){ 
    if (currrentValue !== "*" && currrentValue !== "**")
    return accumulator[currentValue];
    }
  };
