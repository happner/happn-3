const test = require('../../__fixtures/utils/test_helper').create();
describe(test.testName(__filename), function() {
  const UtilsService = require('../../../lib/services/utils/service');
  it('calculates permissions based on the contents of an object: no and single substition', () => {
    const permissionsTemplate = require('../../../lib/services/security/permissions-template').create(
      new UtilsService()
    );
    test
      .expect(permissionsTemplate.parsePermissions('/existent/no-substitution', {}))
      .to.eql(['/existent/no-substitution']);
    test
      .expect(
        permissionsTemplate.parsePermissions('/non-existentsubstitution/{{test}}/{{test1}}', {})
      )
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

    test
      .expect(
        permissionsTemplate.parsePermissions(
          '/matrix-substitution/{{test}}/{{test1}}/{{test2}}/{{test3}}/{{test4}}',
          {
            test: [1, 2, 3],
            test1: [4],
            test2: [5, 6],
            test3: [7, 8],
            test4: [9, 10, 11]
          }
        )
      )
      .to.eql([
        '/matrix-substitution/1/4/5/7/9',
        '/matrix-substitution/1/4/5/7/10',
        '/matrix-substitution/1/4/5/7/11',
        '/matrix-substitution/1/4/5/8/9',
        '/matrix-substitution/1/4/5/8/10',
        '/matrix-substitution/1/4/5/8/11',
        '/matrix-substitution/1/4/6/7/9',
        '/matrix-substitution/1/4/6/7/10',
        '/matrix-substitution/1/4/6/7/11',
        '/matrix-substitution/1/4/6/8/9',
        '/matrix-substitution/1/4/6/8/10',
        '/matrix-substitution/1/4/6/8/11',
        '/matrix-substitution/2/4/5/7/9',
        '/matrix-substitution/2/4/5/7/10',
        '/matrix-substitution/2/4/5/7/11',
        '/matrix-substitution/2/4/5/8/9',
        '/matrix-substitution/2/4/5/8/10',
        '/matrix-substitution/2/4/5/8/11',
        '/matrix-substitution/2/4/6/7/9',
        '/matrix-substitution/2/4/6/7/10',
        '/matrix-substitution/2/4/6/7/11',
        '/matrix-substitution/2/4/6/8/9',
        '/matrix-substitution/2/4/6/8/10',
        '/matrix-substitution/2/4/6/8/11',
        '/matrix-substitution/3/4/5/7/9',
        '/matrix-substitution/3/4/5/7/10',
        '/matrix-substitution/3/4/5/7/11',
        '/matrix-substitution/3/4/5/8/9',
        '/matrix-substitution/3/4/5/8/10',
        '/matrix-substitution/3/4/5/8/11',
        '/matrix-substitution/3/4/6/7/9',
        '/matrix-substitution/3/4/6/7/10',
        '/matrix-substitution/3/4/6/7/11',
        '/matrix-substitution/3/4/6/8/9',
        '/matrix-substitution/3/4/6/8/10',
        '/matrix-substitution/3/4/6/8/11'
      ]);
  });

  it('calculates permissions based on the contents of an object: mixed substitution', () => {
    const permissionsTemplate = require('../../../lib/services/security/permissions-template').create(
      new UtilsService()
    );
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
    const permissionsTemplate = require('../../../lib/services/security/permissions-template').create(
      new UtilsService()
    );
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
