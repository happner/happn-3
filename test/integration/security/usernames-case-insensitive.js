describe(
  require('../../__fixtures/utils/test_helper')
    .create()
    .testName(__filename, 3),
  function() {
    const happn = require('../../../lib/index');
    const expect = require('expect.js');

    function createService(config, endpoints) {
      return new Promise((resolve, reject) => {
        happn.service.create(config, (e, service) => {
          if (e) return reject(e);
          if (endpoints && endpoints.length > 0)
            endpoints.forEach(endpoint => {
              service.connect.use(endpoint.path, function(req, res) {
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(endpoint.returnValue));
              });
            });
          resolve(service);
        });
      });
    }

    function stopService(service) {
      return new Promise((resolve, reject) => {
        service.stop({ reconnect: false }, e => {
          if (e) return reject(e);
          resolve();
        });
      });
    }

    async function createTestUser(service, username, password, group) {
      const addedTestuser = await service.services.security.users.upsertUser(
        {
          username,
          password
        },
        {
          overwrite: true
        }
      );

      if (group) await service.services.security.users.linkGroup(group, addedTestuser);
      return addedTestuser;
    }

    it('does not allow case insensitive logins', async () => {
      const service = await createService({
        secure: true
      });
      let errorHappened = false;
      try {
        await createTestUser(service, 'TEST', 'TEST');
        await service.services.session.localClient({
          username: 'test',
          password: 'TEST'
        });
      } catch (e) {
        expect(e.message).to.be('Invalid credentials');
        errorHappened = true;
      }
      expect(errorHappened).to.be(true);
      await stopService(service);
    });

    it('does allow case sensitive logins', async () => {
      const service = await createService({
        secure: true,
        services: {
          security: {
            config: {
              usernamesCaseInsensitive: true
            }
          }
        }
      });
      let errorHappened = false;
      try {
        await createTestUser(service, 'TEST', 'TEST');
        await service.services.session.localClient({
          username: 'test',
          password: 'TEST'
        });
      } catch (e) {
        expect(e.message).to.be('Invalid credentials');
        errorHappened = true;
      }
      expect(errorHappened).to.be(false);
      await stopService(service);
    });

    it('does allow case insensitive user searching', async () => {
      const service = await createService({
        secure: true,
        services: {
          security: {
            config: {
              usernamesCaseInsensitive: true
            }
          }
        }
      });
      await createTestUser(service, 'TEST1', 'TEST');
      await createTestUser(service, 'TEST2', 'TEST');
      await createTestUser(service, 'TEST3', 'TEST');
      await createTestUser(service, 'test4', 'TEST');

      let users = await service.services.security.users.listUsers('TEST*');
      expect(users.length).to.be(4);

      let users1 = await service.services.security.users.listUsers('test*');
      expect(users1.length).to.be(4);

      let users2 = await service.services.security.users.listUsers('tst*');
      expect(users2.length).to.be(0);

      let users3 = await service.services.security.users.listUsers('T*st');
      expect(users3.length).to.be(4);

      await stopService(service);
    });

    it('does not allow case insensitive user searching', async () => {
      const service = await createService({
        secure: true
      });
      await createTestUser(service, 'TEST1', 'TEST');
      await createTestUser(service, 'TEST2', 'TEST');
      await createTestUser(service, 'TEST3', 'TEST');
      await createTestUser(service, 'test4', 'TEST');

      let users = await service.services.security.users.listUsers('TEST*');
      expect(users.length).to.be(3);

      let users1 = await service.services.security.users.listUsers('test*');
      expect(users1.length).to.be(1);

      let users2 = await service.services.security.users.listUsers('tst*');
      expect(users2.length).to.be(0);

      let users3 = await service.services.security.users.listUsers('T*st');
      expect(users3.length).to.be(0);

      await stopService(service);
    });
  }
);
