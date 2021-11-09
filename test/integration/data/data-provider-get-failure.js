const test = require('../../__fixtures/utils/test_helper').create();

describe(test.testName(__filename), function() {
  let instance, session;
  before('it creates a test instance and an admin user', async () => {
    instance = await test.createInstance({ secure: true });
    session = await test.createAdminSession(instance);
  });

  after('logs out and destroys instance', async () => {

  })

  it('mocks a data get failure, we ensure the error is returned on callback', async () => {
      
  });
});
