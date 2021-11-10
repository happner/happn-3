const test = require('../../__fixtures/utils/test_helper').create();

describe(test.testName(__filename), function() {
  [
    { name: 'allow-nested-deactivated', secure: true },
    { name: 'allow-nested-activated', secure: true, allowNestedPermissions: true }
  ].forEach(config => {
    context(config.name, function() {
      let instance, session;
      before('it creates a test instance and an admin user', async () => {
        instance = await test.createInstance(config);
        session = await test.createAdminSession(instance);
      });

      after('logs out and destroys instance', async () => {
        test.sinon.reset();
        await session.disconnect();
        await test.destroyInstance(instance);
      });

      it('mocks a data get failure, we ensure the error is returned on callback', async () => {
        test.sinon.stub(instance.services.data, '__getPullOptions').throws('test', 'error');
        let errorMessage;
        try {
          await session.get('test/**');
        } catch (error) {
          errorMessage = error.message;
        }

        test.expect(errorMessage).to.be('test: error');
      });
    });
  });
});
