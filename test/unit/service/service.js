describe(
  require('../../__fixtures/utils/test_helper')
    .create()
    .testName(__filename, 3),
  function() {
    it('should create and stop service, secure true', async () => {
      var instance = await require('../../../lib/service.js').create({
        port: 55001,
        secure: true,
        services: {
          transport: {
            config: {}
          }
        }
      });

      await instance.stop();
    });

    it('should create and stop service, secure false', async () => {
      var instance = await require('../../../lib/service.js').create({
        port: 55001,
        services: {
          transport: {
            config: {}
          }
        }
      });

      await instance.stop();
    });
  }
);
