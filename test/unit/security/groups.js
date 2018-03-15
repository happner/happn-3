describe.only(require('../../__fixtures/utils/test_helper').create().testName(__filename, 3), function () {

  this.timeout(5000);

  var expect = require('expect.js');
  var happn = require('../../../lib/index')
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
      .catch(callback)
  };


  it('tests adding a group with no permissions', function (done) {

    mockServices(function (e, happn) {

      if (e) return done(e);

      var testGroup = {
        name: 'TEST_GR_1'
      };

      happn.services.security.groups.upsertGroup(testGroup, function (e, result) {

        if (e) return done(e);

        expect(result.name).to.be('TEST_GR_1');
        expect(result.permissions).to.be(undefined);

        done();
      })
    })
  });

  it('fails adding a group, fails to attach permissions, invalid actions', function (done) {

    mockServices(function (e, happn) {

      if (e) return done(e);

      var testGroup = {
        name: 'TEST_GR_2',
        permissions: {
          '/test/path/1': {actions: ['*']},
          '/test/path/2': ['get', 'on']
        }
      };

      happn.services.security.groups.upsertGroup(testGroup, function (e, result) {

        expect(e.toString()).to.be('Error: group permissions invalid: missing actions: /test/path/2');

        done();
      })
    })
  });

  it('adds a group with valid permissions', function (done) {

    mockServices(function (e, happn) {

      if (e) return done(e);

      var testGroup = {
        name: 'TEST_GR_3',
        permissions: {
          '/test/path/1': {actions: ['*']},
          '/test/path/2': {actions: ['get', 'on']}
        }
      };

      happn.services.security.groups.upsertGroup(testGroup, function (e) {

        if (e) return done(e);

        happn.services.security.groups.getGroup(testGroup.name, function (e, fetchedGroup) {

          if (e) return done(e);

          expect(fetchedGroup.permissions['/test/path/1'].actions).to.eql(['*']);
          expect(fetchedGroup.permissions['/test/path/2'].actions).to.eql(['get', 'on']);

          done();

        });
      })
    })
  });

  it('adds a group with valid permissions, then adds further permissions, we check that the permissions have been merged in the fetched group', function (done) {

    mockServices(function (e, happn) {

      if (e) return done(e);

      var testGroup = {
        name: 'TEST_GR_4',
        permissions: {
          '/test/path/1': {actions: ['*']},
          '/test/path/2': {actions: ['get', 'on']}
        }
      };

      happn.services.security.groups.upsertGroup(testGroup, function (e) {

        if (e) return done(e);

        happn.services.security.groups.upsertPermission(testGroup.name, '/test/path/*', 'get')
          .then(function () {

            happn.services.security.groups.getGroup(testGroup.name, function (e, fetchedGroup) {

              if (e) return done(e);

              expect(fetchedGroup.permissions['/test/path/1'].actions).to.eql(['*']);
              expect(fetchedGroup.permissions['/test/path/2'].actions).to.eql(['get', 'on']);
              expect(fetchedGroup.permissions['/test/path/*'].actions).to.eql(['get']);

              done();

            });
          })
          .catch(done);
      });
    });
  });

  it('does a whole bunch of edits to the same group in parallel, we then check all the correct permissions exist in the group', function(done){

    var permissionCount = 10000;

    this.timeout(permissionCount * 10);

    mockServices(function (e, happn) {

      if (e) return done(e);

      var testGroup = {
        name: 'TEST_GR_5',
        permissions: {
          '/test/path/test': {actions: ['*']},
          '/test/path/*': {actions: ['get', 'on']}
        }
      };

      happn.services.security.groups.upsertGroup(testGroup, function (e) {

        if (e) return done(e);

        var permissions = [];

        for (var permCounter = 0; permCounter < permissionCount; permCounter++)
          permissions.push('/test/path/' + permCounter.toString());

        async.each(permissions, function(permission, permissionCB){

          happn.services.security.groups.upsertPermission(testGroup.name, permission, 'get')
            .then(function(){
              permissionCB();
            })
            .catch(done);

        }, function(e){

          if (e) return done(e);

          happn.services.security.groups.getGroup(testGroup.name, function (e, fetchedGroup) {

            if (e) return done(e);

            expect(fetchedGroup.permissions['/test/path/test'].actions).to.eql(['*']);
            expect(fetchedGroup.permissions['/test/path/*'].actions).to.eql(['get', 'on']);

            for (var permCounter = 0; permCounter < permissionCount; permCounter++)
              expect(fetchedGroup.permissions['/test/path/' + permCounter.toString()].actions).to.eql(['get']);

            done();

          });
        });
      });
    });
  });
});
