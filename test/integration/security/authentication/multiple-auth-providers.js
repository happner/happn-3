describe(
  require('../../../__fixtures/utils/test_helper')
    .create()
    .testName(__filename, 3),
  function() {
    const happn = require('../../../../lib/index');
    const expect = require('expect.js');
    const path = require('path');
    let instance;
    async function getService(config) {
      return new Promise((res, rej) => {
        happn.service.create(config, (e, service) => {
          if (e) rej(e);
          res(service);
        });
      });
    }

    afterEach(async () => {
      if (instance) await stopService(instance);
    });
    async function stopService(instance) {
      return new Promise((res, rej) => {
        instance.stop(e => {
          if (e) rej(e);
          res();
        });
      });
    }

    it('Tests having two auth providers in config, and that the correct one can be called by adding authType to credentials', async () => {
      instance = await getService({
        secure: true,
        services: {
          security: {
            config: {
              authProviders: {
                blankAuth: path.resolve(
                  __dirname,
                  '../../../__fixtures/test/integration/security/authentication/secondAuthProvider.js'
                )
              },
              defaultAuthProvider: 'blankAuth'
            }
          }
        }
      });

      let testUser = {
        username: 'TEST USE1R@blah.com',
        password: 'TEST PWD',
        custom_data: {
          something: 'usefull'
        }
      };
      let addedTestuser = await instance.services.security.users.upsertUser(testUser, {
        overwrite: false
      });

      expect(Object.keys(instance.services.security.authProviders)).to.eql([
        'happn',
        'blankAuth',
        'default'
      ]);
      expect(instance.services.security.authProviders.default).to.be(
        instance.services.security.authProviders.blankAuth
      );
      //Over-ridden function
      expect(instance.services.security.login()).to.eql('Login called in second auth provider');
      expect(instance.services.security.login({ authType: 'blankAuth' })).to.eql(
        'Login called in second auth provider'
      );
      expect(instance.services.security.login({ authType: 'default' })).to.eql(
        'Login called in second auth provider'
      );
      instance.services.security.login(
        { authType: 'happn', username: 'non', password: 'non' },
        'session',
        null,
        (e, result) => {
          expect(e.toString()).to.eql('AccessDenied: Invalid credentials');
          expect(result).to.be(undefined);
          //Base class function
          instance.services.security.login(
            { authType: 'happn', username: testUser.username, password: testUser.password },
            'session',
            null,
            (e, result) => {
              expect(e).to.be(null);
              expect(result.user).to.eql({ ...addedTestuser, groups: {} });
            }
          );
        }
      );
    });

    it('Tests having two auth providers in config, and that the correct one can be called by adding authType at client  creation', async () => {
      instance = await getService({
        port: 55555,
        secure: true,
        services: {
          security: {
            config: {
              authProviders: {
                second: path.resolve(
                  __dirname,
                  '../../../__fixtures/test/integration/security/authentication/workingAuth.js'
                )
              },
              defaultAuthProvider: 'second'
            }
          }
        }
      });

      let testUser = {
        username: 'happnTestuser@somewhere.com',
        password: 'password'
      };

      let testUser2 = {
        username: 'secondTestuser@somewhere.com',
        password: 'secondPass'
      };

      await instance.services.security.users.upsertUser(testUser, {
        overwrite: false
      });

      let client = await happn.client.create({
        port: 55555,
        ...testUser,
        authType: 'happn'
      });
      expect(client).to.be.ok();
      await client.disconnect({ reconnect: false });
      try {
        client = await happn.client.create({
          port: 55555,
          ...testUser2,
          authType: 'happn'
        });
        throw new Error('Should have errored');
      } catch (e) {
        expect(e.toString()).to.be('AccessDenied: Invalid credentials');
      }
      try {
        client = await happn.client.create({
          port: 55555,
          ...testUser
          //should default auth provider to 'second'
        });
        throw new Error('Should have errored');
      } catch (e) {
        expect(e.toString()).to.be('AccessDenied: Invalid credentials');
      }
      expect(client).to.be.ok();
      await client.disconnect({ reconnect: false });
      client = await happn.client.create({
        port: 55555,
        ...testUser2
      });
      expect(client).to.be.ok();
      await client.disconnect({ reconnect: false });
    });
  }
);
