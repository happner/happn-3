require('../../__fixtures/utils/test_helper').describe(__filename, 20000, test => {
  var testDbFile = test.newTestFile();
  var currentService = null;

  async function stopService() {
    await test.destroyInstance(currentService);
  }

  async function initService(filename, name, sessionTokenSecret) {
    await stopService();
    currentService = await test.createInstance({
      port: 55505,
      name: name,
      services: {
        security: {
          config: {
            sessionTokenSecret
          }
        },
        data: {
          config: {
            filename
          }
        }
      },
      secure: true,
      encryptPayloads: true
    });
  }

  after('should delete the temp data file', async () => {
    await test.cleanup([], [currentService]);
  });

  it('restarts the service, we ensure the sessionTokenSecret is the same between restarts', async () => {
    await initService(testDbFile, 'admin_login');
    let previousSessionTokenSecret = currentService.services.security.config.sessionTokenSecret;
    await initService(testDbFile, 'admin_login');
    test
      .expect(previousSessionTokenSecret)
      .to.be(currentService.services.security.config.sessionTokenSecret);
    test.expect(previousSessionTokenSecret.length).to.be(72);
  });

  it('restarts the service, we ensure the sessionTokenSecret is the same between restarts, negative test', async () => {
    await initService(testDbFile, 'admin_login');
    let previousSessionTokenSecret = currentService.services.security.config.sessionTokenSecret;
    test.fs.unlinkSync(testDbFile);
    await initService(testDbFile, 'admin_login');
    test
      .expect(previousSessionTokenSecret)
      .to.not.be(currentService.services.security.config.sessionTokenSecret);
    test.expect(previousSessionTokenSecret.length).to.be(72);
  });

  it('restarts the service, we ensure the sessionTokenSecret is the same between restarts, defined secret in config', async () => {
    await initService(testDbFile, 'admin_login', 'TEST-SECRET');
    let previousSessionTokenSecret = currentService.services.security.config.sessionTokenSecret;
    await initService(testDbFile, 'admin_login', 'TEST-SECRET');
    test
      .expect(previousSessionTokenSecret)
      .to.be(currentService.services.security.config.sessionTokenSecret);
    test.expect(previousSessionTokenSecret.length).to.be(11);
  });

  it('restarts the service, we ensure the sessionTokenSecret is the same between restarts, defined secret in config, restart not defined', async () => {
    await initService(testDbFile, 'admin_login', 'TEST-SECRET');
    let previousSessionTokenSecret = currentService.services.security.config.sessionTokenSecret;
    await initService(testDbFile, 'admin_login');
    test
      .expect(previousSessionTokenSecret)
      .to.be(currentService.services.security.config.sessionTokenSecret);
    test.expect(previousSessionTokenSecret.length).to.be(11);
  });

  it('restarts the service, we ensure the sessionTokenSecret is the same between restarts, defined secret in config, negative test', async () => {
    await initService(testDbFile, 'admin_login', 'TEST-SECRET');
    let previousSessionTokenSecret = currentService.services.security.config.sessionTokenSecret;
    test.fs.unlinkSync(testDbFile);
    await initService(testDbFile, 'admin_login');
    test
      .expect(previousSessionTokenSecret)
      .to.not.be(currentService.services.security.config.sessionTokenSecret);
    test.expect(currentService.services.security.config.sessionTokenSecret.length).to.be(72);
  });
});
