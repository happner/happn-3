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

    it('Tests adding a non-happ3 auth provider (by path) in config, by config the default auth provider should be the added provider', async () => {
      let instance = await getService({
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

      expect(Object.keys(instance.services.security.authProviders)).to.eql([
        'happn',
        'blankAuth',
        'default'
      ]);
      expect(instance.services.security.authProviders.default).to.be(
        instance.services.security.authProviders.blankAuth
      );
      //Over-ridden function
      expect(instance.services.security.authProviders.default.login()).to.eql(
        'Login called in second auth provider'
      );
      //Base class function
      instance.services.security.authProviders.default.accessDenied('Error Message', async e => {
        expect(e.toString()).to.be('AccessDenied: Error Message');
        await stopService(instance);
      });
    });

    it('Tests adding a non-happ3 auth provider (by path) in config, with happn = false', async () => {
      let instance = await getService({
        services: {
          security: {
            config: {
              authProviders: {
                blankAuth: path.resolve(
                  __dirname,
                  '../../../__fixtures/test/integration/security/authentication/secondAuthProvider.js'
                ),
                happn: false
              },
              defaultAuthProvider: 'blankAuth'
            }
          }
        }
      });

      expect(Object.keys(instance.services.security.authProviders)).to.eql([
        'blankAuth',
        'default'
      ]); //No happn
      expect(instance.services.security.authProviders.default).to.be(
        instance.services.security.authProviders.blankAuth
      );
      //Over-ridden function
      expect(instance.services.security.authProviders.default.login()).to.eql(
        'Login called in second auth provider'
      );
      //Base class function
      instance.services.security.authProviders.default.accessDenied('Error Message', async e => {
        expect(e.toString()).to.be('AccessDenied: Error Message');
        await stopService(instance);
      });
    });
  }
);
