const PermissionsTree = require('../../../lib/services/security/permissions-tree');
const tests = require('../../__fixtures/utils/test_helper').create();
describe(tests.testName(__filename, 3), function() {
  it('tests create and search', function() {
    const permissionsTree = PermissionsTree.create(flattenedObjectScenario1());
    tests.expect(permissionsTree.tree).to.eql(expectedTreeScenario1());
    tests.expect(permissionsTree.search('/test/permission/1/1/2')).to.eql(searchResultsScenario1());
  });

  it('tests short permission path', function() {
    const permissionsTree = PermissionsTree.create(flattenedObjectScenario2());
    tests.expect(permissionsTree.tree).to.eql(expectedTreeScenario2());
    tests.expect(permissionsTree.search('/test/permission/1/1/2')).to.eql(searchResultsScenario2());
  });

  it('tests prohibited permission paths', function() {
    const permissionsTree = PermissionsTree.create(flattenedObjectScenario3());
    tests.expect(permissionsTree.tree).to.eql(expectedTreeScenario3());
    tests.expect(permissionsTree.search('/test/permission/1/1/2')).to.eql(searchResultsScenario3());
  });

  function flattenedObjectScenario3() {
    return {
      '/test/permission/*': { actions: ['remove'] },
      '/test/*': { actions: ['get'] },
      '/test/permission/*/1/2': { actions: ['set'], prohibit: ['get'] },
      '/test/permission/*/*/2': { prohibit: ['remove'] }
    };
  }

  function flattenedObjectScenario2() {
    return {
      '/test/permission/*': { actions: ['remove'] },
      '/test/*': { actions: ['get'] },
      '/test/permission/*/1/2': { actions: ['set'] }
    };
  }

  function flattenedObjectScenario1() {
    return {
      '/test/permission/1/*/2': { actions: ['remove'] },
      '/test/permission/*/1/2': { actions: ['get'] },
      '/test/permission/*/1/3': { actions: ['set'] },
      '/test/permission/2': { actions: ['set'] }
    };
  }

  function searchResultsScenario1() {
    return ['remove', 'get'].sort();
  }

  function searchResultsScenario2() {
    return ['remove', 'set', 'get'].sort();
  }

  function searchResultsScenario3() {
    return ['remove', 'set', 'get', '!remove', '!get'].sort();
  }

  function expectedTreeScenario3() {
    return {
      test: {
        permission: {
          '*': {
            '1': {
              '2': {
                $leaf: true,
                actions: ['set'],
                prohibit: ['get']
              }
            },
            $leaf: true,
            actions: ['remove'],
            '*': {
              '2': {
                $leaf: true,
                prohibit: ['remove']
              }
            }
          }
        },
        '*': {
          $leaf: true,
          actions: ['get']
        }
      }
    };
  }

  function expectedTreeScenario2() {
    return {
      test: {
        permission: {
          '*': {
            '1': {
              '2': {
                $leaf: true,
                actions: ['set']
              }
            },
            $leaf: true,
            actions: ['remove']
          }
        },
        '*': {
          $leaf: true,
          actions: ['get']
        }
      }
    };
  }

  function expectedTreeScenario1() {
    return {
      test: {
        permission: {
          '1': {
            '*': {
              '2': {
                $leaf: true,
                actions: ['remove']
              }
            }
          },
          '2': {
            $leaf: true,
            actions: ['set']
          },
          '*': {
            '1': {
              '2': {
                $leaf: true,
                actions: ['get']
              },
              '3': {
                $leaf: true,
                actions: ['set']
              }
            }
          }
        }
      }
    };
  }
});
