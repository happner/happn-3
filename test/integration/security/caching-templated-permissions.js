const test = require('../../__fixtures/utils/test_helper').create();
const sinon = require('sinon');
describe(test.testName(__filename), function() {
  let serviceInstance;
  let adminClient, testClient, testClient2;
  let test_id = Date.now() + '_' + require('shortid').generate();
  const filename = test.newTestFile();
  const warnings = [];

  before('it starts completely defaulted service', async () => {
    serviceInstance = await test.createInstance({
      secure: true,
      services: {
        data: {
          config: {
            datastores: [
              {
                name: 'persisted',
                settings: {
                  filename
                }
              }
            ]
          }
        }
      }
    });
    serviceInstance.services.security.checkpoint.log.warn = function(message) {
      warnings.push(message);
    };
  });

  after('should stop the service', async () => {
    await test.destroySession(testClient);
    await test.destroySession(adminClient);
    await test.destroyInstance(serviceInstance);
    test.deleteFiles();
  });

  context('resources access testing', function() {
    var testGroup = {
      name: 'TEST GROUP' + test_id,
      custom_data: {
        customString: 'custom1',
        customNumber: 0
      }
    };

    testGroup.permissions = {
      '/explicit/test/*': {
        actions: ['*']
      },
      '/gauges/{{user.username}}': {
        actions: ['*']
      },
      '/gauges/{{user.username}}/*': {
        actions: ['*']
      },
      '/custom/{{user.custom_data.custom_field1}}': {
        actions: ['get', 'set']
      },
      '/custom/{{user.custom_data.custom_field2}}': {
        actions: ['on', 'set']
      },
      '/custom/{{user.custom_data.custom_field3}}': {
        actions: ['on', 'set']
      },
      '/custom/{{user.custom_data.custom_field4}}': {
        actions: ['on', 'set']
      },
      '/custom/{{user.custom_data.custom_field5}}': {
        actions: ['on', 'set']
      },
      '/forbidden/{{user.custom_data.custom_field_forbidden}}': {
        actions: ['*']
      },
      '/custom-array/{{user.custom_data.custom_field_array}}': {
        actions: ['*']
      }
    };

    var testUser = {
      username: 'TEST USER@blah.com' + test_id,
      password: 'TEST PWD',
      custom_data: {
        custom_field1: 'custom_field1_value',
        custom_field2: 'custom_field2_value',
        custom_field3: 'custom_field3_value',
        custom_field4: 'custom_field4_value',
        custom_field5: 'custom_field5_value',
        custom_field_forbidden: '*',
        custom_field_array: ['array_item_1', 'array_item_2', 'array_item_3']
      }
    };

    var testUser2 = {
      username: 'TEST USER2@blah.com' + test_id,
      password: 'TEST PWD2',
      custom_data: {
        custom_field1: 'custom_field1_value2',
        custom_field2: 'custom_field2_value2',
        custom_field3: 'custom_field3_value2',
        custom_field4: 'custom_field4_value2',
        custom_field5: 'custom_field5_value2',
        custom_field_forbidden: '*',
        custom_field_array: ['array_item_12', 'array_item_22', 'array_item_32']
      }
    };

    var addedTestGroup;
    var addedTestuser;
    var addedTestuser2;

    before('logs in adminClient', function(done) {
      serviceInstance.services.session
        .localClient({
          username: '_ADMIN',
          password: 'happn'
        })

        .then(function(clientInstance) {
          adminClient = clientInstance;
          done();
        })

        .catch(function(e) {
          done(e);
        });
    });

    before(
      'creates a group and a  two users, adds the group to the user, logs in with test user',
      function(done) {
        serviceInstance.services.security.groups
          .upsertGroup(testGroup)
          .then(function(result) {
            addedTestGroup = result;
            return serviceInstance.services.security.users.upsertUser(testUser);
          })
          .then(function(result) {
            addedTestuser = result;
            return serviceInstance.services.security.users.upsertUser(testUser2);
          })
          .then(function(result) {
            addedTestuser2 = result;
            return serviceInstance.services.security.users.linkGroup(addedTestGroup, addedTestuser);
          })
          .then(function() {
            return serviceInstance.services.security.users.linkGroup(
              addedTestGroup,
              addedTestuser2
            );
          })
          .then(function() {
            return serviceInstance.services.session.localClient({
              username: testUser.username,
              password: 'TEST PWD'
            });
          })
          .then(function(clientInstance) {
            testClient = clientInstance;
            return serviceInstance.services.session.localClient({
              username: testUser2.username,
              password: 'TEST PWD2'
            });
          })
          .then(function(clientInstance) {
            testClient2 = clientInstance;
            done();
          })
          .catch(done);
      }
    );

    it('checks we are able to access templates using {{user.username}}', async () => {
      var username = 'TEST USER@blah.com' + test_id;
      let username2 = testUser2.username;
      let handler1 = sinon.spy();
      let handler2 = sinon.spy();
      await testClient.on('/gauges/' + username, handler1);
      await testClient2.on('/gauges/' + username2, handler2);
      await testClient2.increment('/gauges/' + username2, 'logins', 1);
      test.expect(handler1.notCalled).to.be(true);
      test.expect(handler2.calledOnce).to.be(true);
      test.expect(handler2.calledWith({ value: 1, gauge: 'logins' })).to.be(true);
    });

    it('checks we are able to access templates using {{user.custom_data.custom_field1}}', async () => {
      await testClient.set('/custom/custom_field1_value', {
        test: 'data'
      });
      let data = await testClient.get('/custom/custom_field1_value');
      test.expect(data.test).to.be('data');

      await testClient2.set('/custom/custom_field1_value2', {
        test: 'data2'
      });
      data = await testClient2.get('/custom/custom_field1_value2');
      test.expect(data.test).to.be('data2');

      try {
        await testClient.get('/custom/custom_field1_value2');
        throw new Error('SHOULD HAVE ERRORED');
      } catch (e) {
        test.expect(e.toString()).to.eql('AccessDenied: unauthorized');
      }
    }).timeout(5000);

    it('checks we are able to access templates using {{user.custom_data.custom_field2}}', async () => {
      let handler1 = sinon.spy();
      let handler2 = sinon.spy();

      await testClient.on('/custom/custom_field2_value', handler1);
      await testClient.set('/custom/custom_field2_value', {
        test: 'data'
      });
      test.expect(handler1.calledOnce).to.be(true);
      test.expect(handler1.calledWith({ test: 'data' })).to.be(true);

      await testClient2.on('/custom/custom_field2_value2', handler2);
      await testClient2.set('/custom/custom_field2_value2', {
        test: 'data'
      });
      test.expect(handler2.calledOnce).to.be(true);
      test.expect(handler2.calledWith({ test: 'data' })).to.be(true);

      try {
        await testClient.on('/custom/custom_field2_value2', handler2);
        throw new Error('SHOULD HAVE ERRORED');
      } catch (e) {
        test.expect(e.toString()).to.eql('AccessDenied: unauthorized');
      }
      await testClient.on('/custom/custom_field2_value', handler2); //Should not error
    });
  });
});
