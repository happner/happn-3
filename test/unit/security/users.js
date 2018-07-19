describe(require('../../__fixtures/utils/test_helper').create().testName(__filename, 3), function () {

  this.timeout(5000);

  var expect = require('expect.js');
  var happn = require('../../../lib/index');
  var service = happn.service;
  var async = require('async');
  var Promise = require('bluebird');

  var Logger = require('happn-logger');

  var Services = {};

  Services.SecurityService = require('../../../lib/services/security/service');
  Services.CacheService = require('../../../lib/services/cache/service');
  Services.DataService = require('../../../lib/services/data/service');
  Services.CryptoService = require('../../../lib/services/crypto/service');
  Services.ProtocolService = require('../../../lib/services/protocol/service');
  Services.SubscriptionService = require('../../../lib/services/subscription/service');
  Services.PublisherService = require('../../../lib/services/publisher/service');
  Services.UtilsService = require('../../../lib/services/utils/service');
  Services.SessionService = require('../../../lib/services/session/service');
  Services.SystemService = require('../../../lib/services/system/service');
  Services.ErrorService = require('../../../lib/services/error/service');
  Services.QueueService = require('../../../lib/services/queue/service');
  Services.LayerService = require('../../../lib/services/layer/service');
  Services.LogService = require('../../../lib/services/log/service');

  var mockService = Promise.promisify(function (happn, serviceName, config, callback) {

    if (typeof config === 'function') {
      callback = config;
      if (config !== false) config = {};
    }

    try {

      var serviceClass = Services[serviceName + 'Service'];

      var serviceInstance = new serviceClass({
        logger: Logger
      });

      serviceInstance.happn = happn;

      serviceInstance.config = config;

      happn.services[serviceName.toLowerCase()] = serviceInstance;

      if (typeof serviceInstance.initialize != 'function' || config === false) return callback();

      serviceInstance.initialize(config, callback);

    } catch (e) {
      callback(e);
    }
  });

  var mockServices = function (callback) {

    var happn = {
      services: {},
      config: {}
    };

    mockService(happn, 'Crypto')
      .then(mockService(happn, 'Utils'))
      .then(mockService(happn, 'Log'))
      .then(mockService(happn, 'Error'))
      .then(mockService(happn, 'Session', false))
      .then(mockService(happn, 'Protocol'))
      .then(mockService(happn, 'Publisher'))
      .then(mockService(happn, 'Queue'))
      .then(mockService(happn, 'Data'))
      .then(mockService(happn, 'Cache'))
      .then(mockService(happn, 'System'))
      .then(mockService(happn, 'Security'))
      .then(mockService(happn, 'Subscription'))
      .then(mockService(happn, 'Layer'))
      .then(function () {
        happn.services.session.initializeCaches.bind(happn.services.session)(function (e) {
          if (e) return callback(e);
          callback(null, happn);
        });
      })
      .catch(callback);
  };

  function createUsersAndGroups(happn, done) {

    var upsertedGroups = [];
    var upsertedUsers = [];

    var groups = [];
    var users = [];

    for (var i = 0; i < 10; i++) groups.push({name: 'test_' + i});

    for (var i = 0; i < 10; i++) users.push({
      username: 'test_' + i,
      password: 'test_' + i,
      custom_data: {role: 'OEM Admin'}
    });

    async.each(groups, function (group, groupCB) {

      happn.services.security.groups.upsertGroup(group, function (e, upsertedGroup) {

        if (e) return groupCB(e);

        upsertedGroups.push(upsertedGroup);

        groupCB();
      });
    }, function (e) {

      if (e) return done(e);

      async.each(users, function (user, userCB) {

        happn.services.security.users.upsertUser(user, function (e, upsertedUser) {

          if (e) return groupCB(e);

          upsertedUsers.push(upsertedUser);

          userCB();
        });
      }, function (e) {

        if (e) return done(e);

        async.each(upsertedUsers, function (upsertedUser, upsertedUserCB) {

          async.each(upsertedGroups, function (upsertedGroup, upsertedGroupCB) {

            happn.services.security.groups.linkGroup(upsertedGroup, upsertedUser, upsertedGroupCB);

          }, upsertedUserCB);

        }, done);
      });
    });
  }


  it('searches for users  a custom filter to ensure we dont have to trim out groups, this will allow us to optimise the listUsers method', function (done) {

    mockServices(function (e, happn) {

      if (e) return done(e);

      createUsersAndGroups(happn, function (e) {

        if (e) return done(e);

        happn.services.data.get('/_SYSTEM/_SECURITY/_USER/*', {criteria: {"custom_data.role": {$in: ['SMC Admin', 'OEM Admin']}}}, function (e, results) {

          if (e) return done(e);

          expect(results.length == 10).to.be(true);

          done();
        });
      });
    });
  });

  it('searches for users  a custom filter to ensure we dont have to trim out groups, this will allow us to optimise the listUsers method, negative test', function (done) {

    mockServices(function (e, happn) {

      if (e) return done(e);

      createUsersAndGroups(happn, function (e) {

        if (e) return done(e);

        happn.services.data.get('/_SYSTEM/_SECURITY/_USER/*', function (e, results) {

          if (e) return done(e);

          expect(results.length > 10).to.be(true);

          done();

        });
      });
    });
  });

  it('searches for users with the $exists filter and other criteria', function (done) {

    mockServices(function (e, happn) {

      if (e) return done(e);

      createUsersAndGroups(happn, function (e) {

        if (e) return done(e);

        happn.services.data.get('/_SYSTEM/_SECURITY/_USER/*', {criteria: {"custom_data.role": {$in: ['SMC Admin', 'OEM Admin']}, "username":{$exists:true}}}, function (e, results) {

          if (e) return done(e);

          expect(results.length == 10).to.be(true);

          done();

        });
      });
    });
  });

  it('searches for users with the $exists filter and no other criteria', function (done) {

    mockServices(function (e, happn) {

      if (e) return done(e);

      createUsersAndGroups(happn, function (e) {

        if (e) return done(e);

        happn.services.data.get('/_SYSTEM/_SECURITY/_USER/*', {criteria: {"username":{$exists:true}}}, function (e, results) {

          if (e) return done(e);

          expect(results.length == 11).to.be(true);//11 to compensate for the admin user

          done();
        });
      });
    });
  });

  it('searches for users with the listUsers method, no criteria', function (done) {

    mockServices(function (e, happn) {

      if (e) return done(e);

      createUsersAndGroups(happn, function (e) {

        if (e) return done(e);

        happn.services.security.users.listUsers('*', function(e, users){

          if (e) return done(e);

          expect(users.length == 11).to.be(true);//11 to compensate for the admin user

          done();
        });
      });
    });
  });

  it('searches for users with the listUsers method, null criteria', function (done) {

    mockServices(function (e, happn) {

      if (e) return done(e);

      createUsersAndGroups(happn, function (e) {

        if (e) return done(e);

        happn.services.security.users.listUsers('*', null, function(e, users){

          if (e) return done(e);

          expect(users.length == 11).to.be(true);//11 to compensate for the admin user

          done();
        });
      });
    });
  });

  it('searches for users with the listUsers method, undefined criteria', function (done) {

    mockServices(function (e, happn) {

      if (e) return done(e);

      createUsersAndGroups(happn, function (e) {

        if (e) return done(e);

        happn.services.security.users.listUsers('*', undefined, function(e, users){

          if (e) return done(e);

          expect(users.length == 11).to.be(true);//11 to compensate for the admin user

          done();
        });
      });
    });
  });

  it('searches for users with the listUsers method, additional criteria', function (done) {

    mockServices(function (e, happn) {

      if (e) return done(e);

      createUsersAndGroups(happn, function (e) {

        if (e) return done(e);

        happn.services.security.users.listUsers('*', {criteria: {"custom_data.role": {$in: ['SMC Admin', 'OEM Admin']}}}, function(e, users){

          if (e) return done(e);

          expect(users.length == 10).to.be(true);//11 to compensate for the admin user

          done();
        });
      });
    });
  });
});
