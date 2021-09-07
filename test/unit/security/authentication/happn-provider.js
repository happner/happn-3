describe(
  require('../../../__fixtures/utils/test_helper')
    .create()
    .testName(__filename, 3),
  function() {
    const async = require('async');
    const expect = require('expect.js');
    const Logger = require('happn-logger');
    const HappnProvider = require('../../../../lib/services/security/authentication/happn-provider');
    let mockHappn;
    before('It Creates a mock happn', async () => {
      mockHappn = await mockServices();
    });
    
    after('stops services', async () => {
      await stopServices(mockHappn);
    });

    it('creates a happnProvider', done => {
      let happnProvider = HappnProvider.create(mockHappn, {});
      expect(happnProvider).to.be.ok();
      done();
    });

    it('Tests __providerTokenLogin when checkTokenToUserId fails ', done => {
      mockHappn.services.security.checkTokenUserId = async function() {
        return false;
      };
      let happnProvider = HappnProvider.create(mockHappn, {});
      happnProvider.__providerTokenLogin(null, { username: 'previous' }, null, (e, r) => {
        expect(r).to.be.null;
        expect(e.toString()).to.be(
          'AccessDenied: token userid does not match userid for username: previous'
        );
        done();
      });
    });

    it('Tests __providerTokenLogin when return user is null  ', done => {
      mockHappn.services.security.checkTokenUserId = async function() {
        return true;
      };
      mockHappn.services.security.authorize = async function() {
        return true;
      };
      mockHappn.services.security.users.getUser = async function() {
        return null;
      };

      const happnProvider = HappnProvider.create(mockHappn, {});
      happnProvider.__providerTokenLogin(null, { username: 'previous' }, null, (e, r) => {
        expect(r).to.be.null;
        expect(e.toString()).to.be('AccessDenied: Invalid credentials');
        done();
      });
    });

    it('Tests __providerTokenLogin when something throws an error  ', done => {
      mockHappn.services.security.checkTokenUserId = async function() {
        throw new Error('bad');
      };
      const happnProvider = HappnProvider.create(mockHappn, {});
      happnProvider.__providerTokenLogin(null, { username: 'previous' }, null, (e, r) => {
        expect(r).to.be.null;
        expect(e.toString()).to.be('AccessDenied: Invalid credentials');
        done();
      });
    });

    it('Tests __digestLogin when verifyAuthenticationDigest returns an error', done => {
      mockHappn.services.security.verifyAuthenticationDigest = function(creds, callback) {
        callback(new Error('bad'));
      };
      const happnProvider = HappnProvider.create(mockHappn, {});
      happnProvider.__digestLogin({ publicKey: 123 }, { publicKey: 123 }, null, (e, r) => {
        expect(r).to.be.null;
        expect(e.toString()).to.be('Error: bad');
        done();
      });
    });

    it('Tests __digestLogin when verifyAuthenticationDigest returns not valid', done => {
      mockHappn.services.security.verifyAuthenticationDigest = function(creds, callback) {
        callback(null, false);
      };
      const happnProvider = HappnProvider.create(mockHappn, {});
      happnProvider.__digestLogin(
        { username: 'joe', publicKey: 123 },
        { publicKey: 123 },
        null,
        (e, r) => {
          expect(r).to.be.null;
          expect(e.toString()).to.be('AccessDenied: Invalid credentials');
          done();
        }
      );
    });

    it('Tests __providerCredsLogin when getUser returns an error  ', done => {
      mockHappn.services.security.users.getUser = function(user, callback) {
        callback(new Error('bad'));
      };

      const happnProvider = HappnProvider.create(mockHappn, {});
      happnProvider.__providerCredsLogin({ username: 'user' }, null, (e, r) => {
        expect(r).to.be.null;
        expect(e.toString()).to.be('Error: bad');
        done();
      });
    });

    it('Tests __providerCredsLogin when getUser returns null', done => {
      mockHappn.services.security.users.getUser = function(user, callback) {
        callback(null, null);
      };

      const happnProvider = HappnProvider.create(mockHappn, {});
      happnProvider.__providerCredsLogin({ username: 'user' }, null, (e, r) => {
        expect(r).to.be.null;
        expect(e.toString()).to.be('AccessDenied: Invalid credentials');
        done();
      });
    });

    it('Tests __providerCredsLogin when getPasswordHash returns user does not exist error  ', async () => {
      let mockHappn = await mockServices();
      mockHappn.services.security.users.getUser = function(user, callback) {
        callback(null, { a: 'user' });
      };

      mockHappn.services.security.users.getPasswordHash = function(user, callback) {
        callback(new Error('userJoe does not exist in the system'));
      };

      const happnProvider = HappnProvider.create(mockHappn, {});
      happnProvider.__providerCredsLogin({ username: 'userJoe' }, null, (e, r) => {
        expect(r).to.be.null;
        expect(e.toString()).to.be('AccessDenied: Invalid credentials');
      });
    });

    it('Tests __providerCredsLogin when getPasswordHash returns another error ', async () => {
      let mockHappn = await mockServices();
      mockHappn.services.security.users.getUser = function(user, callback) {
        callback(null, { a: 'user' });
      };

      mockHappn.services.security.users.getPasswordHash = function(user, callback) {
        callback(new Error('some other error'));
      };

      const happnProvider = HappnProvider.create(mockHappn, {});
      happnProvider.__providerCredsLogin({ username: 'userJoe' }, null, (e, r) => {
        expect(r).to.be.null;
        expect(e.toString()).to.be('Error: some other error');
      });
    });

    let stopServices = function(happnMock) {
      return new Promise((res, rej) => {
        async.eachSeries(
          ['log', 'error', 'utils', 'crypto', 'cache', 'session', 'data', 'security'],
          function(serviceName, eachServiceCB) {
            if (!happnMock.services[serviceName].stop) return eachServiceCB();
            happnMock.services[serviceName].stop(eachServiceCB);
          },
          (e, r) => {
            if (e) return rej(e);
            res();
          }
        );
      });
    };

    let mockServices = function(servicesConfig) {
      return new Promise((res, rej) => {
        var testConfig = {
          secure: true,
          services: {
            cache: {},
            data: {},
            crypto: {},
            security: {}
          }
        };

        var testServices = {};

        testServices.cache = require('../../../../lib/services/cache/service');
        testServices.crypto = require('../../../../lib/services/crypto/service');
        testServices.data = require('../../../../lib/services/data/service');
        testServices.security = require('../../../../lib/services/security/service');
        testServices.session = require('../../../../lib/services/session/service');
        testServices.utils = require('../../../../lib/services/utils/service');
        testServices.error = require('../../../../lib/services/error/service');
        testServices.log = require('../../../../lib/services/log/service');

        var checkpoint = require('../../../../lib/services/security/checkpoint');

        testServices.checkpoint = new checkpoint({
          logger: Logger
        });

        var happnMock = {
          config: {
            services: {
              security: {}
            }
          },
          services: {
            system: {
              package: require('../../../../package.json')
            }
          }
        };

        if (servicesConfig) testConfig = servicesConfig;

        async.eachSeries(
          ['log', 'error', 'utils', 'crypto', 'cache', 'session', 'data', 'security'],
          function(serviceName, eachServiceCB) {
            testServices[serviceName] = new testServices[serviceName]({
              logger: Logger
            });

            testServices[serviceName].happn = happnMock;

            happnMock.services[serviceName] = testServices[serviceName];

            if (serviceName === 'error')
              happnMock.services[serviceName].handleFatal = function(message, e) {
                throw e;
              };

            if (serviceName === 'session') {
              happnMock.services[serviceName].config = {};
              return happnMock.services[serviceName].initializeCaches(eachServiceCB);
            }

            if (!happnMock.services[serviceName].initialize) return eachServiceCB();
            else
              testServices[serviceName].initialize(
                testConfig.services[serviceName] || {},
                eachServiceCB
              );
          },
          function(e) {
            if (e) return rej(e);

            res(happnMock);
          }
        );
      });
    };
  }
);
