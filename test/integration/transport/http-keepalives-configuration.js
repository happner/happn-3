const tests = require('../../__fixtures/utils/test_helper').create();

describe(tests.testName(__filename, 3), function() {
  const happn = require('../../../lib/index');
  const service = happn.service;
  function getServiceConfig(keepAliveTimeout) {
    return {
      secure: true,
      services: {
        transport: {
          config: {
            keepAliveTimeout
          }
        }
      }
    };
  }

  this.timeout(25000);

  function createService(keepAliveTimeout, callback) {
    service.create(getServiceConfig(keepAliveTimeout), function(e, happnInst) {
      if (e) return callback(e);
      callback(null, happnInst);
    });
  }

  it('test the default keepAliveTimeout', function(done) {
    createService(undefined, async (e, service) => {
      if (e) return done(e);
      tests.expect(service.server.keepAliveTimeout).to.be(120000);
      await service.stop();
      done();
    });
  });

  it('test the configured keepAliveTimeout', function(done) {
    createService(60000, async (e, service) => {
      if (e) return done(e);
      tests.expect(service.server.keepAliveTimeout).to.be(60000);
      await service.stop();
      done();
    });
  });
});
