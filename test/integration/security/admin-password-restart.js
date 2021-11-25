require('../../__fixtures/utils/test_helper').describe(__filename, 20000, test => {
  const filename = test.newTestFile();
  let currentService = null;

  const originalPassword = 'original';
  const modifiedPassword = 'modified';

  async function stopService() {
    await test.destroyInstance(currentService);
  }

  async function initService() {
    await stopService();
    currentService = await test.createInstance({
      name: 'admin_password_restart',
      services: {
        security: {
          config: {
            adminUser: { password: originalPassword }
          }
        },
        data: {
          config: {
            filename
          }
        }
      },
      secure: true
    });
  }

  function getClient(service, password) {
    return service.services.session.localClient({
      username: '_ADMIN',
      password: password
    });
  }

  before('should initialize the service', async () => {
    await initService();
  });

  after('should delete the temp data file', async () => {
    await stopService();
  });

  it('should modify the admin password, restart the service and log in with the new password', async () => {
    await getClient(currentService, originalPassword);
    await currentService.services.security.users.__upsertUser({
      username: '_ADMIN',
      password: modifiedPassword
    });
    await getClient(currentService, modifiedPassword);
    await initService();
    await getClient(currentService, modifiedPassword);
  });
});
