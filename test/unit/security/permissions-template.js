const test = require('../../__fixtures/utils/test_helper').create();
describe(test.testName(__filename), function() {
  it('can getTags', () => {
    const permissionsTemplate = require('../../../lib/services/security/permissions-template').create();
    test
      .expect(
        permissionsTemplate.getTags('/{{test1}}/{{test2}}', {
          test1: ['test1'],
          test2: ['test2']
        })
      )
      .to.eql({
        test1: ['test1'],
        test2: ['test2']
      });

    test
      .expect(
        permissionsTemplate.getTags('{{test1}}/{{test2}}', {
          test1: ['test1', 'test3'],
          test2: ['test2']
        })
      )
      .to.eql({
        test1: ['test1', 'test3'],
        test2: ['test2']
      });
  });

  it('calculates permissions based on the contents of an object: no and single substition', () => {
    const permissionsTemplate = require('../../../lib/services/security/permissions-template').create();
    test
      .expect(
        permissionsTemplate.parsePermissions(
          '/existent/no-substitution',
          {},
          { actions: ['get', 'set'] }
        )
      )
      .to.eql([
        {
          '/existent/no-substitution': {
            actions: ['get', 'set']
          }
        }
      ]);
    test
      .expect(
        permissionsTemplate.parsePermissions(
          '/non-existentsubstitution/{{test}}',
          {},
          { actions: ['get', 'set'] }
        )
      )
      .to.eql([]);
    test
      .expect(
        permissionsTemplate.parsePermissions(
          '/single-substitution/{{test}}',
          {
            test: 'found'
          },
          { actions: ['get', 'set'] }
        )
      )
      .to.eql([{ '/single-substitution/found': { actions: ['get', 'set'] } }]);

    test
      .expect(
        permissionsTemplate.parsePermissions(
          '/matrix-substitution/{{test}}/{{test1}}',
          {
            test: ['found1', 'found2'],
            test1: ['found3', 'found4']
          },
          { actions: ['get', 'on'] }
        )
      )
      .to.eql([
        { '/matrix-substitution/found1/found3': { actions: ['get', 'on'] } },
        { '/matrix-substitution/found1/found4': { actions: ['get', 'on'] } },
        { '/matrix-substitution/found2/found3': { actions: ['get', 'on'] } },
        { '/matrix-substitution/found2/found4': { actions: ['get', 'on'] } }
      ]);
  });

  it('calculates permissions based on the contents of an object: mixed substitution', () => {
    const permissionsTemplate = require('../../../lib/services/security/permissions-template').create();
    test
      .expect(
        permissionsTemplate.parsePermissions(
          '/multiple-substitution/{{test}}',
          {
            test: ['found1', 'found2']
          },
          { actions: ['get', 'set'] }
        )
      )
      .to.eql([
        { '/multiple-substitution/found1': { actions: ['get', 'set'] } },
        { '/multiple-substitution/found2': { actions: ['get', 'set'] } }
      ]);
    test
      .expect(
        permissionsTemplate.parsePermissions(
          '/multiple-substitution/{{test}}',
          {
            test: ['found1', 'found2', 'found3']
          },
          { actions: ['get', 'set'] }
        )
      )
      .to.eql([
        { '/multiple-substitution/found1': { actions: ['get', 'set'] } },
        { '/multiple-substitution/found2': { actions: ['get', 'set'] } },
        { '/multiple-substitution/found3': { actions: ['get', 'set'] } }
      ]);
    test
      .expect(
        permissionsTemplate.parsePermissions(
          '/matrix-substitution/{{test}}/{{test1}}/{{test2}}',
          {
            test: ['found1', 'found2'],
            test1: ['found3', 'found4'],
            test2: 'found5'
          },
          { actions: ['get', 'on'] }
        )
      )
      .to.eql([
        { '/matrix-substitution/found1/found3/found5': { actions: ['get', 'on'] } },
        { '/matrix-substitution/found1/found4/found5': { actions: ['get', 'on'] } },
        { '/matrix-substitution/found2/found3/found5': { actions: ['get', 'on'] } },
        { '/matrix-substitution/found2/found4/found5': { actions: ['get', 'on'] } }
      ]);
  });
  it('calculates permissions based on the contents of an object: bad substitution', () => {
    const permissionsTemplate = require('../../../lib/services/security/permissions-template').create();
    test
      .expect(
        permissionsTemplate.parsePermissions(
          '/multiple-substitution/{{test',
          {
            test: ['found1', 'found2']
          },
          { actions: ['get', 'set'] }
        )
      )
      .to.eql([{ '/multiple-substitution/{{test': { actions: ['get', 'set'] } }]);
    test
      .expect(
        permissionsTemplate.parsePermissions(
          '/multiple-substitution/test}}',
          {
            test: ['found1', 'found2']
          },
          { actions: ['get', 'set'] }
        )
      )
      .to.eql([{ '/multiple-substitution/test}}': { actions: ['get', 'set'] } }]);
  });
});
