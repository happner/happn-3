describe(
  require('../../__fixtures/utils/test_helper')
    .create()
    .testName(__filename, 3),
  function() {
    const request = require('request');
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

    //eslint-disable-next-line
    function doRequest(path, token) {
      return new Promise((resolve, reject) => {
        let options = {
          url: 'http://127.0.0.1:55000' + path
        };
        options.headers = {
          Cookie: ['happn_token=' + token]
        };
        request(options, function(error, response) {
          if (error) return reject(error);
          resolve(response);
        });
      });
    }

    //eslint-disable-next-line
    async function createTestGroup(service, name, permissions, custom_data) {
      return await service.services.security.users.upsertGroup(
        {
          name,
          custom_data,
          permissions
        },
        {
          overwrite: false
        }
      );
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

    it('does allow case sensitive user searching', async () => {
      throw new Error('test not implemented yet');
    });
  }
);
