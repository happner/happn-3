require('../../__fixtures/utils/test_helper').describe(__filename, 20000, test => {
  const testDbFile = test.newTestFile();
  let currentService = null;

  const originalPassword = 'original';
  const modifiedPassword = 'modified';

  before('should initialize the service', async () => {
    await initService(testDbFile, 'admin_login');
  });

  after('should delete the temp data file', async () => {
    test.cleanup([], [currentService]);
  });

  it('does an admin login, should modify the admin password, restart the service and do an admin login, then pull data from a restricted path', async () => {
    await currentService.services.security.users.__upsertUser({
      username: '_ADMIN',
      password: modifiedPassword
    });
    await test.createAdminSession(currentService);
    await initService(testDbFile, 'admin_login');
    const client = await test.createAdminSession(currentService);
    const records = await client.get('/_SYSTEM/*');
    test.expect(records.length > 0).to.be(true);
    test.expect(Object.keys(currentService.services.session.__sessions).length).to.be(1);
    client.disconnect({ reconnect: false });
    await test.delay(1000);
    test.expect(Object.keys(currentService.services.session.__sessions).length).to.be(0);
  });

  async function initService(filename, name) {
    await test.destroyInstance(currentService);
    currentService = await test.createInstance({
      port: 55505,
      name,
      services: {
        security: {
          config: {
            adminUser: { password: originalPassword }
          }
        },
        data: {
          config: {
            filename: filename
          }
        }
      },
      secure: true
    });
  }
});
