describe(
  require('../../../__fixtures/utils/test_helper')
    .create()
    .testName(__filename, 3),
  function() {
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
      expect(Object.keys(instance.services.security.authProviders)).to.eql(['happn3', 'default']);
      await stopService(instance);
    });

    it('Tests that with blank config, the default auth provider IS the happn-3 provider', async () => {
      let instance = await getService({});
      expect(instance.services.security.authProviders.default).to.be(
        instance.services.security.authProviders.happn3
      );
      await stopService(instance);
    });

    it('Tests adding auth provider (no default), in config, the default auth provider should be the happn-3 provider', async () => {
      let instance = await getService({
        services: {
          security: { config: { authProviders: { happn3: 'happn3-provider' } } }
        }
      });
      expect(Object.keys(instance.services.security.authProviders)).to.eql(['happn3', 'default']);
      expect(instance.services.security.authProviders.default).to.be(
        instance.services.security.authProviders.happn3
      );
      await stopService(instance);
    });

    it('Tests adding auth provider (with a default), in config, the default auth provider should be the happn-3 provider', async () => {
      let instance = await getService({
        services: {
          security: {
            config: { authProviders: { happn3: 'happn3-provider' }, defaultAuthProvider: 'happn3' }
          }
        }
      });
      expect(Object.keys(instance.services.security.authProviders)).to.eql(['happn3', 'default']);
      expect(instance.services.security.authProviders.default).to.be(
        instance.services.security.authProviders.happn3
      );
      await stopService(instance);
    });

    it('Tests adding an incorrectly configured auth provider we should get a base auth provider which returns an error on login with creds', async () => {
      let instance = await getService({
        services: {
          security: {
            config: {
              authProviders: { happn3: 'happpppppppppn3-provider' },
              defaultAuthProvider: 'happn3'
            }
          }
        }
      });
      expect(Object.keys(instance.services.security.authProviders)).to.eql(['happn3', 'default']);
      expect(instance.services.security.authProviders.default).to.be(
        instance.services.security.authProviders.happn3
      );
      instance.services.security.login(
        { username: 'blah', password: 'blah' },
        'session',
        null,
        async (error, result) => {
          expect(result).to.be(undefined);
          expect(error.toString()).to.be(
            'AccessDenied: Authentication Provider not set up correctly.'
          );
          await stopService(instance);
        }
      );
    });
  }
);
