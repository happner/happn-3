var testHelper = require('../../__fixtures/utils/test_helper').create()

describe(testHelper.testName(__filename, 3), function () {

  var happn = require('../../../lib/index');
  var async = require('async');
  var serviceInstance;
  var adminClient;
  var expect = require('expect.js');

  var getService = function (config, callback) {
    happn.service.create(config,
      callback
    );
  };

  before('it starts the service with limited cache sizes for the security service', function (callback) {

    getService({
      secure: true,
      services: {
        security: {
          config: {
            __cache_checkpoint_authorization: {//checkpoint auth cache
              max: 5,
              maxAge: 0
            },
            __cache_checkpoint_permissionset: {//checkpoint auth cache
              max: 6,
              maxAge: 0
            },
            __cache_groups: {//groups cache
              max: 5,
              maxAge: 0
            },
            __cache_users: {
              max: 5,
              maxAge: 0
            },
            __cache_permissions: {
              max: 5,
              maxAge: 0
            }
          }
        }
      }
    }, function (e, service) {

      if (e) return callback(e);

      serviceInstance = service;

      expect(serviceInstance.services.security.groups.__cache_groups.__cache.max).to.be(5);
      expect(serviceInstance.services.security.users.__cache_users.__cache.max).to.be(5);
      expect(serviceInstance.services.security.groups.__cache_permissions.__cache.max).to.be(5);
      expect(serviceInstance.services.security.checkpoint.__cache_checkpoint_authorization.__cache.max).to.be(5);
      expect(serviceInstance.services.security.checkpoint.__cache_checkpoint_permissionset.__cache.max).to.be(6);

      serviceInstance.services.session.localClient({
          username: '_ADMIN',
          password: 'happn'
        })

        .then(function (clientInstance) {
          adminClient = clientInstance;
          callback();
        })

        .catch(function (e) {
          callback(e);
        });
    });
  });

  var SESSION_COUNT = 10;

  this.timeout(SESSION_COUNT * 1000);

  var groups = [];
  var users = [];
  var sessions = [];

  before('it creates test groups', function (callback) {

    async.timesSeries(SESSION_COUNT, function (time, timeCB) {

      var group = {
        name: 'TEST_GRP_' + time.toString(),
        permissions: {}
      };

      group.permissions['test/permission/on/' + time.toString()] = {actions: ['on', 'set']};
      group.permissions['test/permission/get/' + time.toString()] = {actions: ['get']};
      group.permissions['test/permission/all/' + time.toString()] = {actions: ['*']};

      serviceInstance.services.security.groups.upsertGroup(group, function (e, upserted) {

        if (e) return timeCB(e);

        groups.push(upserted);
        timeCB();
      });

    }, callback);
  });

  before('it creates test users', function (callback) {

    async.timesSeries(SESSION_COUNT, function (time, timeCB) {

      var user = {
        username: 'TEST_USR_' + time.toString(),
        password: 'TEST_USR_' + time.toString()
      };

      serviceInstance.services.security.users.upsertUser(user, function (e, upserted) {

        if (e) return timeCB(e);

        serviceInstance.services.security.groups.linkGroup(groups[time], upserted, function(e){

          if (e) return timeCB(e);

          users.push(upserted);
          timeCB();
        });
      });

    }, callback);
  });

  before('it creates test sessions', function (callback) {

    async.timesSeries(SESSION_COUNT, function (time, timeCB) {

      serviceInstance.services.session.localClient({
          username: 'TEST_USR_' + time.toString(),
          password: 'TEST_USR_' + time.toString()
        })

        .then(function (clientInstance) {
          sessions.push(clientInstance);
          timeCB();
        })

        .catch(function (e) {
          timeCB(e);
        });

    }, callback);

  });

  after('should delete the temp data file and disconnect all test clients', function (callback) {

    this.timeout(15000);

    if (adminClient) adminClient.disconnect({reconnect: false});

    setTimeout(function () {
      serviceInstance.stop(function () {
        callback();
      });
    }, 3000);
  });

  it('does a bunch of user and groups fetches- checks the security caches are the correct size', function (done) {

    async.timesSeries(SESSION_COUNT * 100, function (time, timeCB) {

      var randomInt = testHelper.randomInt(0, SESSION_COUNT - 1);

      serviceInstance.services.security.groups.getGroup('TEST_GRP_' + randomInt.toString(), function(e, group){

        if (e) return timeCB(e);

        expect(serviceInstance.services.security.groups.__cache_groups.__cache.get('TEST_GRP_' + randomInt.toString()).data.name).to.be(group.name);

        serviceInstance.services.security.users.getUser('TEST_USR_' + randomInt.toString(), function(e, user){

          if (e) return timeCB(e);

          expect(serviceInstance.services.security.users.__cache_users.__cache.get('TEST_USR_' + randomInt.toString()).data.username).to.be(user.username);
          expect(serviceInstance.services.security.users.__cache_passwords.__cache.get('TEST_USR_' + randomInt.toString())).to.not.be(null);
          expect(serviceInstance.services.security.users.__cache_passwords.__cache.get('TEST_USR_' + randomInt.toString())).to.not.be(undefined);

          timeCB();
        })
      })

    }, function(e){

      if (e) return done(e);

      expect(serviceInstance.services.security.groups.__cache_groups.__cache.values().length).to.be(5);
      expect(serviceInstance.services.security.users.__cache_users.__cache.values().length).to.be(5);
      expect(serviceInstance.services.security.users.__cache_passwords.__cache.values().length).to.be(5);

      done();
    });

  });

  it('does a bunch of data activity - checks the security caches are the correct size', function (done) {

    async.timesSeries(SESSION_COUNT * 100, function (time, timeCB) {

      var randomInt = testHelper.randomInt(0, SESSION_COUNT - 1);

      var session = sessions[randomInt];

      session.offAll().then(function(){

        session.on('test/permission/on/' + randomInt, function (ondata) {

          session.get('test/permission/get/' + randomInt, function (e, getdata) {

            if (e) return timeCB(e);

            session.set('test/permission/all/' + randomInt, {all: randomInt}, timeCB);
          });
        }, function(e){

          if (e) return timeCB(e);

          session.set('test/permission/on/' + randomInt, {set: randomInt});
        });

      }).catch(timeCB);

    }, function (e) {

      if (e) return done(e);

      expect(serviceInstance.services.security.checkpoint.__cache_checkpoint_authorization.__cache.values().length).to.be(5);
      expect(serviceInstance.services.security.checkpoint.__cache_checkpoint_permissionset.__cache.values().length).to.be(6);
      expect(serviceInstance.services.security.groups.__cache_permissions.__cache.values().length).to.be(5);

      done();
    });
  });

  it('lists all users, checks we have the all users list cached, then update a user and esnure the cache is cleared', function (done) {

    expect(serviceInstance.services.security.users.__cache_list_all_users).to.be(null);

    serviceInstance.services.security.users.listUsers('*', function(e, allUsers){

      if (e) return done(e);

      expect(serviceInstance.services.security.users.__cache_list_all_users).to.eql(allUsers);

      serviceInstance.services.security.users.__cache_list_all_users.push({test:'data'});

      serviceInstance.services.security.users.listUsers('*', function(e, allUsers) {

        if (e) return done(e);

        //check we got the cached version - which we sneakily added some data to
        expect(allUsers.pop().test).to.be('data');

        var user = {
          username: 'TEST_USR_ALL_TEST',
          password: 'TEST_USR_ALL_TEST'
        };
        //add a user - ensure our cache is clear
        serviceInstance.services.security.users.upsertUser(user, function (e) {

          if (e) return done(e);

          expect(serviceInstance.services.security.users.__cache_list_all_users).to.be(null);

          done();
        });
      });
    });
  });
});
