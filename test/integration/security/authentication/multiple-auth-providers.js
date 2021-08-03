const { pathExists } = require('fs-extra');

describe(
  require('../../../__fixtures/utils/test_helper')
    .create()
    .testName(__filename, 3),
  function() {
    const happn = require('../../../../lib/index');
    const expect = require('expect.js');
    const path = require('path');
    async function getService(config) {
      return new Promise((res, rej) => {
        happn.service.create(config, (e, service) => {
          if (e) rej(e);
          res(service);
        });
      });
    }

    async function stopService(instance) {
      return new Promise((res, rej) => {
        instance.stop(e => {
          if (e) rej(e);
          res();
        });
      });
    }

    it('Tests having two auth providers in config, and that the correct one can be called by adding authType to credentials', async () => {
      let instance = await getService({
        services: {
          security: {
            config: {
              authProviders: {
                happn3: 'happn3-provider',
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
        'happn3',
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
        { authType: 'happn3', username: 'non', password: 'non' },
        'session',
        null,
        (e, result) => {
          expect(e.toString()).to.eql('AccessDenied: Invalid credentials');
          expect(result).to.be(undefined);
          //Base class function
          instance.services.security.login(
            { authType: 'happn3', username: testUser.username, password: testUser.password },
            'session',
            null,
            async (e, result) => {
                console.log(result)
              expect(e).to.be(null)
              expect(result.user).to.be(addedTestuser)
              await stopService(instance);
            }
          );
        }
      );
    });
  }
);
