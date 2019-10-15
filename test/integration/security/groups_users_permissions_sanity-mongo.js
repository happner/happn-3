describe(
  require('../../__fixtures/utils/test_helper')
    .create()
    .testName(__filename, 3),
  function() {
    this.timeout(120000);

    var expect = require('expect.js');

    let DB_NAME = 'test-happn-3-user-group-management';
    let COLL_NAME = 'test-happn-3-user-group-management-coll';

    let Happn = require('../../../lib/index');
    let happnInstance;

    before('should clear the mongo collection', async () => {
      let dropMongoDb = require('../../__fixtures/utils/drop-mongo-db');
      await dropMongoDb(DB_NAME);
    });

    before(function(done) {
      Happn.service.create(
        {
          secure: true,
          port: 8003,
          services: {
            data: {
              config: {
                autoUpdateDBVersion: true,
                datastores: [
                  {
                    name: 'mongo',
                    provider: 'happn-service-mongo-2',
                    isDefault: true,
                    settings: {
                      database: DB_NAME,
                      collection: COLL_NAME
                    }
                  }
                ]
              }
            }
          }
        },
        (e, instance) => {
          if (e) return done(e);
          happnInstance = instance;
          done();
        }
      );
    });

    after(function(done) {
      happnInstance.stop({ reconnect: false }, done);
    });

    it('tests the listUsers method with and without criteria', async () => {
      await happnInstance.services.security.users.upsertUser({
        username: 'TESTUSER_LIST1',
        password: 'TEST PWD',
        custom_data: {
          something: 'useful'
        }
      });

      await happnInstance.services.security.users.upsertUser({
        username: 'TESTUSER_LIST2',
        password: 'TEST PWD',
        custom_data: {
          something: 'useful'
        }
      });

      await happnInstance.services.security.users.upsertUser({
        username: 'TESTUSER_LIST3',
        password: 'TEST PWD',
        custom_data: {
          something: 'else'
        }
      });

      await happnInstance.services.security.users.upsertUser({
        username: 'TESTUSER_LIST4',
        password: 'TEST PWD',
        custom_data: {
          something: 'else'
        }
      });

      let usersFiltered = await happnInstance.services.security.users.listUsers('TESTUSER_LIST*', {
        criteria: {
          'custom_data.something': { $eq: 'useful' }
        }
      });

      let usersUnFiltered = await happnInstance.services.security.users.listUsers('TESTUSER_LIST*');

      expect(usersFiltered.length).to.be(2);
      expect(usersUnFiltered.length).to.be(4);
    });

    it('tests the listGroups method with and without criteria', async () => {
      await happnInstance.services.security.users.upsertGroup({
        name: 'TESTGROUP_LIST1',
        custom_data: {
          something: 'useful'
        }
      });

      await happnInstance.services.security.users.upsertGroup({
        name: 'TESTGROUP_LIST2',
        custom_data: {
          something: 'useful'
        }
      });

      await happnInstance.services.security.users.upsertGroup({
        name: 'TESTGROUP_LIST3',
        custom_data: {
          something: 'else'
        }
      });

      await happnInstance.services.security.users.upsertGroup({
        name: 'TESTGROUP_LIST4',
        custom_data: {
          something: 'else'
        }
      });

      let groupsFiltered = await happnInstance.services.security.users.listGroups(
        'TESTGROUP_LIST*',
        {
          criteria: {
            'custom_data.something': { $eq: 'useful' }
          }
        }
      );

      let groupsUnFiltered = await happnInstance.services.security.users.listGroups(
        'TESTGROUP_LIST*'
      );

      expect(groupsUnFiltered.length).to.be(4);
      expect(groupsFiltered.length).to.be(2);
    });

    it('should get groups matching special criteria with limit, skip and count', async () => {
      await happnInstance.services.security.users.upsertGroup({
        name: 'TESTGROUP_SEARCH1',
        custom_data: {
          cadre: 0
        }
      });

      await happnInstance.services.security.users.upsertGroup({
        name: 'TESTGROUP_SEARCH2',
        custom_data: {
          cadre: 0
        }
      });

      await happnInstance.services.security.users.upsertGroup({
        name: 'TESTGROUP_SEARCH3',
        custom_data: {
          cadre: 1
        }
      });

      await happnInstance.services.security.users.upsertGroup({
        name: 'TESTGROUP_SEARCH4',
        custom_data: {
          cadre: 2
        }
      });

      let results1 = await happnInstance.services.security.users.listGroups('TESTGROUP_SEARCH*', {
        criteria: {
          'custom_data.cadre': { $gt: 0 }
        },
        limit: 1
      });

      let results2 = await happnInstance.services.security.users.listGroups('TESTGROUP_SEARCH*', {
        criteria: {
          'custom_data.cadre': { $gt: 0 }
        },
        skip: 1
      });

      let resultscontrol = await happnInstance.services.security.users.listGroups(
        'TESTGROUP_SEARCH*',
        {
          criteria: {
            'custom_data.cadre': { $gt: 0 }
          }
        }
      );

      let results3 = await happnInstance.services.security.users.listGroups('TESTGROUP_SEARCH*', {
        criteria: {
          'custom_data.cadre': { $gt: 0 }
        },
        count: true
      });

      expect(results1.length).to.be(1);
      expect(results2.length).to.be(1);
      expect(resultscontrol.length).to.be(2);

      expect(results3.value).to.be(2);
    });

    it('should get users matching special criteria with limit, skip and count', async () => {
      await happnInstance.services.security.users.upsertUser({
        username: 'TESTUSER_SEARCH1',
        password: 'TEST PWD',
        custom_data: {
          cadre: 0
        }
      });

      await happnInstance.services.security.users.upsertUser({
        username: 'TESTUSER_SEARCH2',
        password: 'TEST PWD',
        custom_data: {
          cadre: 0
        }
      });

      await happnInstance.services.security.users.upsertUser({
        username: 'TESTUSER_SEARCH3',
        password: 'TEST PWD',
        custom_data: {
          cadre: 1
        }
      });

      await happnInstance.services.security.users.upsertUser({
        username: 'TESTUSER_SEARCH4',
        password: 'TEST PWD',
        custom_data: {
          cadre: 2
        }
      });

      let results1 = await happnInstance.services.security.users.listUsers('TESTUSER_SEARCH*', {
        criteria: {
          'custom_data.cadre': { $gt: 0 }
        },
        limit: 1
      });

      let results2 = await happnInstance.services.security.users.listUsers('TESTUSER_SEARCH*', {
        criteria: {
          'custom_data.cadre': { $gt: 0 }
        },
        skip: 1
      });

      let resultscontrol = await happnInstance.services.security.users.listUsers(
        'TESTUSER_SEARCH*',
        {
          criteria: {
            'custom_data.cadre': { $gt: 0 }
          }
        }
      );

      let results3 = await happnInstance.services.security.users.listUsers('TESTUSER_SEARCH*', {
        criteria: {
          'custom_data.cadre': { $gt: 0 }
        },
        count: true
      });

      expect(results1.length).to.be(1);
      expect(results2.length).to.be(1);
      expect(resultscontrol.length).to.be(2);

      expect(results3.value).to.be(2);
    });

    it('should get users matching special criteria and collation', async () => {
      await happnInstance.services.security.users.upsertUser({
        username: 'TEST_user_COLLATION1',
        password: 'TEST PWD',
        custom_data: {
          cadre: 0
        }
      });

      await happnInstance.services.security.users.upsertUser({
        username: 'TEST_USER_COLLATION1',
        password: 'TEST PWD',
        custom_data: {
          cadre: 0
        }
      });

      let results1 = await happnInstance.services.security.users.listUsers('*', {
        criteria: {
          username: 'TEST_USER_COLLATION1'
        },
        collation: {
          locale: 'en_US',
          strength: 1
        }
      });

      let results2 = await happnInstance.services.security.users.listUsers('*', {
        criteria: {
          username: 'TEST_USER_COLLATION1'
        }
      });

      expect(results1.length).to.be(2);
      expect(results2.length).to.be(1);
    });
  }
);
