describe(
  require('../../../__fixtures/utils/test_helper')
    .create()
    .testName(__filename, 3),
  function() {
    this.timeout(10e3);
    const async = require('async');
    const expect = require('expect.js');
    const Logger = require('happn-logger');
    const sinon = require('sinon');
    const path = require('path');
    const BaseAuthProvider = require('../../../../lib/services/security/authentication/provider-base');
    const dummyAuthProvider = path.resolve(
      __dirname,
      '../../../__fixtures/test/integration/security/authentication/secondAuthProvider.js'
    );
    const noAuthProvider = path.resolve(__dirname, './nonExistent.js');
    let mockHappn;
    before('It Creates a mock happn', async () => {
      mockHappn = await mockServices();
    });
    after('stops services', async () => {
      await stopServices(mockHappn);
    });

    it('tests the create method, no provider', done => {
      mockHappn.services.security.log.error = sinon.spy();
      let baseProvider = BaseAuthProvider.create(mockHappn, {});
      expect(mockHappn.services.security.log.error.calledOnce).to.be(true);
      expect(
        mockHappn.services.security.log.error.calledWith(
          'No auth provider specified, returning base auth provider with limited functionality.'
        )
      ).to.be(true);
      expect(baseProvider).to.be.ok();
      done();
    });

    it('tests the create method, other auth provider', done => {
      mockHappn.services.security.log.error = sinon.spy();
      let baseProvider = BaseAuthProvider.create(mockHappn, {}, dummyAuthProvider);
      expect(mockHappn.services.security.log.error.callCount).to.be(0);
      expect(baseProvider).to.be.ok();
      expect(baseProvider.login()).to.eql('Login called in second auth provider');
      done();
    });

    it('tests the create method, bad auth provider', done => {
      mockHappn.services.security.log.error = sinon.spy();
      let baseProvider = BaseAuthProvider.create(mockHappn, {}, noAuthProvider);
      expect(mockHappn.services.security.log.error.calledOnce).to.be(true);
      expect(
        mockHappn.services.security.log.error.calledWith(
          `Could not configure auth provider ${noAuthProvider}, returning base auth provider with limited functionality.`
        )
      ).to.be(true);
      expect(baseProvider).to.be.ok();
      done();
    });

    it('tests the login method, no sessionId or request, invalidCredentials', done => {
      let baseProvider = BaseAuthProvider.create(mockHappn, {});
      baseProvider.login({}, e => {
        expect(e.toString()).to.be('AccessDenied: Invalid credentials');
        done();
      });
    });

    it('tests the __providerCredsLogin method, when no provider is configured', done => {
      let baseProvider = BaseAuthProvider.create(mockHappn, {});
      baseProvider.__providerCredsLogin(null, null, e => {
        expect(e.toString()).to.be('AccessDenied: __providerCredsLogin not implemented.');
        done();
      });
    });

    it('tests the __providerCredsLogin method, when no provider is configured', done => {
      let baseProvider = BaseAuthProvider.create(mockHappn, {});
      baseProvider.__providerTokenLogin(null, null, e => {
        expect(e.toString()).to.be('AccessDenied: __providerTokenLogin not implemented.');
        done();
      });
    });
    it('tests the tokenlogin method, tocken locked to login type, not matched', done => {
      let baseProvider = BaseAuthProvider.create(mockHappn, { lockTokenToLoginType: true });
      baseProvider.__checkRevocations = () => true;
      let token = baseProvider.generateToken({ policy: ['whatever', 'stateful'] }, 'some type');
      baseProvider.tokenLogin({ token, type: 'some other type' }, null, null, e => {
        expect(e.toString()).to.be(
          'AccessDenied: token was created using the login type some type, which does not match how the new token is to be created'
        );
        done();
      });
    });

    it('tests the tokenlogin method, when an error is thrown', done => {
      let baseProvider = BaseAuthProvider.create(mockHappn, { lockTokenToLoginType: true });
      baseProvider.__checkRevocations = () => {
        return new Promise((res, rej) => rej('BAD'));
      };
      let token = baseProvider.generateToken({ policy: ['whatever', 'stateful'] }, 'some type');
      baseProvider.tokenLogin({ token, type: 'some other type' }, null, null, e => {
        expect(e.toString()).to.be('AccessDenied: Invalid credentials: BAD');
        done();
      });
    });

    function stopServices(happnMock) {
      return new Promise((res, rej) => {
        async.eachSeries(
          ['log', 'error', 'utils', 'crypto', 'cache', 'session', 'data', 'security'],
          function(serviceName, eachServiceCB) {
            if (!happnMock.services[serviceName].stop) return eachServiceCB();
            happnMock.services[serviceName].stop(eachServiceCB);
          },
          e => {
            if (e) return rej(e);
            res();
          }
        );
      });
    }

    function mockServices(servicesConfig) {
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
    }
  }
);
