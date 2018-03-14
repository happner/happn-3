describe(require('../../__fixtures/utils/test_helper').create().testName(__filename, 3), function () {

  var happn = require('../../../lib/index');
  var serviceInstance;
  var adminClient;
  var expect = require('expect.js');
  var test_id = Date.now() + '_' + require('shortid').generate();

  var getService = function (config, callback) {
    happn.service.create(config,
      callback
    );
  };

  before('it starts completely defaulted service', function (done) {

    getService({
      secure: true
    }, function (e, service) {

      if (e) return done(e);

      serviceInstance = service;
      done();

    });
  });

  before('authenticates with the _ADMIN user, using the default password', function (done) {

    serviceInstance.services.session.localClient({
        username: '_ADMIN',
        password: 'happn'
      })

      .then(function (clientInstance) {
        adminClient = clientInstance;
        done();
      })

      .catch(function (e) {
        done(e);
      });
  });

  after('should delete the temp data file', function (callback) {

    this.timeout(15000);

    if (adminClient) adminClient.disconnect({reconnect:false});

    setTimeout(function(){
      serviceInstance.stop(function(){
        callback();
      });
    }, 3000);
  });

  var testGroup = {
    name: 'TEST GROUP' + test_id,
    custom_data: {
      customString: 'custom1',
      customNumber: 0,
      customArray:[1,2,3,4,5]
    }
  };

  testGroup.permissions = {};

  testGroup.permissions['/TEST/groups_custom_data/' + test_id + '/all_access'] = {
    actions: ['*']
  };


  var testUser = {
    username: 'TEST USER@blah.com' + test_id,
    password: 'TEST PWD',
    custom_data: {
      something: 'usefull'
    }
  };

  var addedTestGroup;
  var addedTestuser;

  it('creates a group and a user, adds the group to the user, logs in with test user', function (done) {

    serviceInstance.services.security.groups.upsertGroup(testGroup, {
      overwrite: false
    }, function (e, result) {

      if (e) return done(e);
      addedTestGroup = result;

      serviceInstance.services.security.users.upsertUser(testUser, {
        overwrite: false
      }, function (e, result) {

        if (e) return done(e);
        addedTestuser = result;

        serviceInstance.services.security.groups.linkGroup(addedTestGroup, addedTestuser, function (e) {

          if (e) return done(e);

          //clear the groups cache in the users module
          serviceInstance.services.security.groups.__cache_groups.clear();

          serviceInstance.services.security.groups.getGroup(testGroup.name, function(e, groupData){

            if (e) return done(e);

            expect(groupData.custom_data.customString).to.be('custom1');
            expect(groupData.custom_data.customNumber).to.be(0);
            expect(groupData.custom_data.customArray).to.eql([1,2,3,4,5]);

            done();
          });
        });
      });
    });
  });
});
