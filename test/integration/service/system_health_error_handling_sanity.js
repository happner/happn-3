describe.only(require('../../__fixtures/utils/test_helper').create().testName(__filename, 3),  function () {

  var happn = require('../../../lib/index');
  var serviceInstance;
  var expect = require('expect.js');
  var constants = happn.constants;
  var Promise = require('bluebird');

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

  after('stop the test service', function (callback) {
    serviceInstance.stop(callback);
  });

  it('logs errors via the error service, ensures system health changes as required', function (done) {

    var e = new Error('TEST ERROR');

    expect(serviceInstance.services.system.__stats.HEALTH.STATUS).to.be(constants.SYSTEM_HEALTH.EXCELLENT);

    serviceInstance.services.error.handleSystem(e, 'test', constants.ERROR_SEVERITY.LOW);

    expect(serviceInstance.services.system.__stats.HEALTH.STATUS).to.be(constants.SYSTEM_HEALTH.FAIR);

    expect(serviceInstance.services.system.__stats.HEALTH.BY_SEVERITY[constants.ERROR_SEVERITY.LOW]).to.be(1);

    serviceInstance.services.error.handleSystem(e, 'test', constants.ERROR_SEVERITY.LOW);

    expect(serviceInstance.services.system.__stats.HEALTH.BY_SEVERITY[constants.ERROR_SEVERITY.LOW]).to.be(2);

    serviceInstance.services.error.handleSystem(e, 'test', constants.ERROR_SEVERITY.MEDIUM);

    expect(serviceInstance.services.system.__stats.HEALTH.STATUS).to.be(constants.SYSTEM_HEALTH.TAKING_STRAIN);

    expect(serviceInstance.services.system.__stats.HEALTH.BY_SEVERITY[constants.ERROR_SEVERITY.MEDIUM]).to.be(1);

    serviceInstance.services.error.handleSystem(e, 'test', constants.ERROR_SEVERITY.LOW);

    expect(serviceInstance.services.system.__stats.HEALTH.STATUS).to.be(constants.SYSTEM_HEALTH.TAKING_STRAIN);

    serviceInstance.services.error.handleSystem(e, 'test', constants.ERROR_SEVERITY.HIGH);

    expect(serviceInstance.services.system.__stats.HEALTH.STATUS).to.be(constants.SYSTEM_HEALTH.POOR);

    serviceInstance.services.system.resetStats();

    expect(serviceInstance.services.system.__stats.HEALTH.STATUS).to.be(constants.SYSTEM_HEALTH.EXCELLENT);

    serviceInstance.services.error.handleSystem(e, 'test', constants.ERROR_SEVERITY.FATAL);

    expect(serviceInstance.services.system.__stats.HEALTH.STATUS).to.be(constants.SYSTEM_HEALTH.POOR);

    expect(serviceInstance.services.system.__stats.HEALTH.lastError.message).to.be('Error: TEST ERROR');

    expect(serviceInstance.services.system.__stats.HEALTH.lastError.severity).to.be(constants.ERROR_SEVERITY.FATAL);

    expect(serviceInstance.services.system.__stats.HEALTH.lastError.area).to.be('test');

    done();
  });

  it('tests failures in the data service', function (done) {

    var testProvider = serviceInstance.services.data.db('/test/path');

    testProvider.__oldFindOne = testProvider.findOne;

    testProvider.findOne = function (criteria, fields, callback) {
      return callback(new Error('test error'));
    };

    serviceInstance.services.data.getOneByPath('/test/path', null, function (e) {

      expect(e.toString()).to.be('SystemError: test error');

      testProvider.findOne = testProvider.__oldFindOne;

      done();
    });

  });

  it('tests failures in the subscription service', function (done) {

    serviceInstance.services.session.localClient({
        username: '_ADMIN',
        password: 'happn'
      })

      .then(function (client) {

        serviceInstance.services.subscription.__oldAddListener = serviceInstance.services.subscription.addListener.bind(serviceInstance.services.subscription);

        serviceInstance.services.subscription.addListener = function (channel, key, sessionId, parameters, callback) {

          return callback(new Error('test subscribe error'));

        }.bind(serviceInstance.services.subscription);

        client.on('/test/on', function (data) {
          //do nothing
        }, function (e) {

          expect(e.toString()).to.be('SystemError: subscribe failed');

          var stats = serviceInstance.services.system.stats();

          expect(stats.HEALTH.lastError.message).to.be('SystemError: subscribe failed');
          expect(stats.HEALTH.lastError.area).to.be('ProtocolService');
          expect(stats.HEALTH.lastError.severity).to.be(1);

          serviceInstance.services.subscription.addListener = serviceInstance.services.subscription.__oldAddListener;

          done();
        });
      })

      .catch(function (e) {
        if (e) return done(e);
      });

  });

  it('tests failures in the publisher service', function (done) {

    serviceInstance.services.session.localClient({
        username: '_ADMIN',
        password: 'happn'
      })

      .then(function (client) {

        serviceInstance.services.publisher.__oldPublishMessage = serviceInstance.services.publisher.processPublish.bind(serviceInstance.services.publisher);

        serviceInstance.services.publisher.processPublish = function (message) {
          return Promise.reject(new Error('a test publication error'));
        };

        client.on('/test/publication', function (data) {
          //do nothing
        }, function (e) {

          if (e) return done(e);

          client.set('/test/publication', {
            test: 'data'
          }, {
            consistency: constants.CONSISTENCY.TRANSACTIONAL
          }, function (e) {

            var stats = serviceInstance.services.system.stats();

            expect(stats.HEALTH.lastError.message).to.be('Error: a test publication error');
            expect(stats.HEALTH.lastError.area).to.be('ProtocolService');
            expect(stats.HEALTH.lastError.severity).to.be(1);

            serviceInstance.services.publisher.publishMessage = serviceInstance.services.publisher.__oldPublishMessage;

            done();
          });
        });
      })
      .catch(function (e) {
        if (e) return done(e);
      });
  });
});
