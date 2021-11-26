describe(
  require('../../../__fixtures/utils/test_helper')
    .create()
    .testName(__filename, 3),
  function() {
    const path = require('path');
    const happn = require('../../../../lib/index');
    const expect = require('expect.js');
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

    it('Tests that with blank config, we get a standard (happn-3) auth provider', async () => {
      let instance = await getService({});
      expect(Object.keys(instance.services.security.authProviders)).to.eql(['happn', 'default']);
      await stopService(instance);
    });

    it('Tests that with blank config, the default auth provider IS the happn-3 provider', async () => {
      let instance = await getService({});
      expect(instance.services.security.authProviders.default).to.be(
        instance.services.security.authProviders.happn
      );
      await stopService(instance);
    });

    it('Tests adding auth provider (no default), in config, the default auth provider should be the happn-3 provider', async () => {
      let instance = await getService({
        services: {
          security: {
            config: {
              authProviders: {
                blankAuth: path.resolve(
                  __dirname,
                  '../../../__fixtures/test/integration/security/authentication/secondAuthProvider.js'
                )
              }
            }
          }
        }
      });
      expect(Object.keys(instance.services.security.authProviders)).to.eql([
        'happn',
        'blankAuth',
        'default'
      ]);
      expect(instance.services.security.authProviders.default).to.be(
        instance.services.security.authProviders.happn
      );
      await stopService(instance);
    });

    it('Tests adding an incorrectly configured auth provider we should get a base auth provider which returns an error on login with creds', async () => {
      let instance = await getService({
        services: {
          security: {
            config: {
              authProviders: { bad: 'bad-provider' },
              defaultAuthProvider: 'happn'
            }
          }
        }
      });
      expect(Object.keys(instance.services.security.authProviders)).to.eql([
        'happn',
        'bad',
        'default'
      ]);
      expect(instance.services.security.authProviders.default).to.be(
        instance.services.security.authProviders.happn
      );
      instance.services.security.login(
        { username: 'blah', password: 'blah', authType: 'bad' },
        'session',
        null,
        async (error, result) => {
          expect(result).to.be(undefined);
          expect(error.toString()).to.be('AccessDenied: __providerCredsLogin not implemented.');
          await stopService(instance);
        }
      );
    });
  }
);
