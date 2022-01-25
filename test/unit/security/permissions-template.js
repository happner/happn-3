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
      .expect(permissionsTemplate.parsePermissions('/existent/no-substitution', {}))
      .to.eql(['/existent/no-substitution']);
    test
      .expect(permissionsTemplate.parsePermissions('/non-existentsubstitution/{{test}}', {}))
      .to.eql([]);
    test
      .expect(
        permissionsTemplate.parsePermissions('/single-substitution/{{test}}', {
          test: 'found'
        })
      )
      .to.eql(['/single-substitution/found']);

    test
      .expect(
        permissionsTemplate.parsePermissions('/matrix-substitution/{{test}}/{{test1}}', {
          test: ['found1', 'found2'],
          test1: ['found3', 'found4']
        })
      )
      .to.eql([
        '/matrix-substitution/found1/found3',
        '/matrix-substitution/found1/found4',
        '/matrix-substitution/found2/found3',
        '/matrix-substitution/found2/found4'
      ]);
  });

  it('calculates permissions based on the contents of an object: mixed substitution', () => {
    const permissionsTemplate = require('../../../lib/services/security/permissions-template').create();
    test
      .expect(
        permissionsTemplate.parsePermissions('/multiple-substitution/{{test}}', {
          test: ['found1', 'found2']
        })
      )
      .to.eql(['/multiple-substitution/found1', '/multiple-substitution/found2']);
    test
      .expect(
        permissionsTemplate.parsePermissions('/multiple-substitution/{{test}}', {
          test: ['found1', 'found2', 'found3']
        })
      )
      .to.eql([
        '/multiple-substitution/found1',
        '/multiple-substitution/found2',
        '/multiple-substitution/found3'
      ]);
    test
      .expect(
        permissionsTemplate.parsePermissions('/matrix-substitution/{{test}}/{{test1}}/{{test2}}', {
          test: ['found1', 'found2'],
          test1: ['found3', 'found4'],
          test2: 'found5'
        })
      )
      .to.eql([
        '/matrix-substitution/found1/found3/found5',
        '/matrix-substitution/found1/found4/found5',
        '/matrix-substitution/found2/found3/found5',
        '/matrix-substitution/found2/found4/found5'
      ]);
  });
  it('calculates permissions based on the contents of an object: bad substitution', () => {
    const permissionsTemplate = require('../../../lib/services/security/permissions-template').create();
    test
      .expect(
        permissionsTemplate.parsePermissions('/multiple-substitution/{{test', {
          test: ['found1', 'found2']
        })
      )
      .to.eql(['/multiple-substitution/{{test']);
    test
      .expect(
        permissionsTemplate.parsePermissions('/multiple-substitution/test}}', {
          test: ['found1', 'found2']
        })
      )
      .to.eql(['/multiple-substitution/test}}']);
    test
      .expect(
        test.tryMethod(() => {
          permissionsTemplate.parsePermissions('/multiple-substitution/{{test}}', {
            test: ['found1', 'any*']
          });
        })
      )
      .to.equal(
        `illegal promotion of permissions via permissions template, permissionPath: /multiple-substitution/{{test}}, substitution key: test, value: any*`
      );
    test
      .expect(
        test.tryMethod(() => {
          permissionsTemplate.parsePermissions('/multiple-substitution/{{testSingle}}', {
            test: ['found1', 'found2'],
            testSingle: '*'
          });
        })
      )
      .to.equal(
        `illegal promotion of permissions via permissions template, permissionPath: /multiple-substitution/{{testSingle}}, substitution key: testSingle, value: *`
      );
  });
});
