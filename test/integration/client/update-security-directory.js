const test = require('../../__fixtures/utils/test_helper').create();
describe(test.testName(__filename, 3), function() {
  let happnInstance = null;
  this.timeout(20000);

  before('should initialize the service', async () => {
    this.timeout(20000);
    happnInstance = await test.server.createServer({ secure: true });
  });

  after(function(done) {
    happnInstance.stop(done);
  });

  it('should create a user, connect a client with the user - update the user with null user permissions', async () => {
    this.timeout(5000);
    const user = await test.security.upsertUser(
      {
        username: 'TEST',
        password: 'TEST'
      },
      happnInstance
    );
    const group = await test.security.createGroup(
      {
        name: 'TEST',
        permissions: {
          '/test/path': { actions: ['*'] }
        }
      },
      happnInstance
    );
    await test.security.linkGroup(group, user, happnInstance);
    const client = await test.security.createClient({
      username: 'TEST',
      password: 'TEST'
    });
    await client.on('/test/path', () => {
      //do nothing
    });
    user.custom_info = { something: 'custom' };

    const oldProcessSystemOut = happnInstance.services.protocol.processSystemOut.bind(
      happnInstance.services.protocol
    );
    happnInstance.services.protocol.processSystemOut = (msg, callback) => {
      delete msg.data.changedData.permissions;
      oldProcessSystemOut(msg, callback);
    };

    await test.security.upsertUser(user, happnInstance);
    await test.delay(5000);
    await client.disconnect();
  });
});
