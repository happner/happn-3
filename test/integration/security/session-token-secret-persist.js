describe(
  require('../../__fixtures/utils/test_helper')
    .create()
    .testName(__filename, 3),
  function() {
    var expect = require('expect.js');
    var fs = require('fs');
    var happn = require('../../../lib/index');
    var default_timeout = 10000;
    var tmpFile = __dirname + '/tmp/testdata_' + require('shortid').generate() + '.db';
    var currentService = null;

    function stopService() {
      return new Promise((resolve, reject) => {
        if (currentService) {
          currentService.stop(function(e) {
            if (e && e.toString() !== 'Error: Not running') return reject(e);
            resolve();
          });
        } else resolve();
      });
    }

    async function initService(filename, name, sessionTokenSecret) {
      await stopService();
      currentService = await happn.service.create({
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
              filename: filename
            }
          }
        },
        secure: true
      });
    }

    after('should delete the temp data file', async () => {
      this.timeout(20000);
      await stopService();
      fs.unlinkSync(tmpFile);
    });

    it('restarts the service, we ensure the sessionTokenSecret is the same between restarts', async () => {
      this.timeout(default_timeout);
      await initService(tmpFile, 'admin_login');
      let previousSessionTokenSecret = currentService.services.security.config.sessionTokenSecret;
      await initService(tmpFile, 'admin_login');
      expect(previousSessionTokenSecret).to.be(
        currentService.services.security.config.sessionTokenSecret
      );
      expect(previousSessionTokenSecret.length).to.be(72);
    });

    it('restarts the service, we ensure the sessionTokenSecret is the same between restarts, negative test', async () => {
      this.timeout(default_timeout);
      await initService(tmpFile, 'admin_login');
      let previousSessionTokenSecret = currentService.services.security.config.sessionTokenSecret;
      fs.unlinkSync(tmpFile);
      await initService(tmpFile, 'admin_login');
      expect(previousSessionTokenSecret).to.not.be(
        currentService.services.security.config.sessionTokenSecret
      );
      expect(previousSessionTokenSecret.length).to.be(72);
    });

    it('restarts the service, we ensure the sessionTokenSecret is the same between restarts, defined secret in config', async () => {
      this.timeout(default_timeout);
      await initService(tmpFile, 'admin_login', 'TEST-SECRET');
      let previousSessionTokenSecret = currentService.services.security.config.sessionTokenSecret;
      await initService(tmpFile, 'admin_login', 'TEST-SECRET');
      expect(previousSessionTokenSecret).to.be(
        currentService.services.security.config.sessionTokenSecret
      );
      expect(previousSessionTokenSecret.length).to.be(11);
    });

    it('restarts the service, we ensure the sessionTokenSecret is the same between restarts, defined secret in config, restart not defined', async () => {
      this.timeout(default_timeout);
      await initService(tmpFile, 'admin_login', 'TEST-SECRET');
      let previousSessionTokenSecret = currentService.services.security.config.sessionTokenSecret;
      await initService(tmpFile, 'admin_login');
      expect(previousSessionTokenSecret).to.be(
        currentService.services.security.config.sessionTokenSecret
      );
      expect(previousSessionTokenSecret.length).to.be(11);
    });

    it('restarts the service, we ensure the sessionTokenSecret is the same between restarts, defined secret in config, negative test', async () => {
      this.timeout(default_timeout);
      await initService(tmpFile, 'admin_login', 'TEST-SECRET');
      let previousSessionTokenSecret = currentService.services.security.config.sessionTokenSecret;
      fs.unlinkSync(tmpFile);
      await initService(tmpFile, 'admin_login');
      expect(previousSessionTokenSecret).to.not.be(
        currentService.services.security.config.sessionTokenSecret
      );
      expect(currentService.services.security.config.sessionTokenSecret.length).to.be(72);
    });
  }
);
