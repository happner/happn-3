describe(
  require('../../__fixtures/utils/test_helper')
    .create()
    .testName(__filename, 3),
  function() {
    var expect = require('expect.js');
    var happn = require('../../../lib/index');
    var service = happn.service;

    var happnInstance = null;
    var encryptedPayloadInstance = null;

    var admClient, admClient1;

    var Crypto = require('happn-util-crypto');
    var crypto = new Crypto();

    var clientKeyPair = crypto.createKeyPair();
    var clientKeyPair1 = crypto.createKeyPair();
    var serverKeyPair = crypto.createKeyPair();
    this.timeout(20000);

    before('should initialize the service', function(callback) {
      try {
        service.create(
          {
            secure: true,
            encryptPayloads: true,
            services: {
              security: {
                config: {
                  keyPair: {
                    privateKey: 'Kd9FQzddR7G6S9nJ/BK8vLF83AzOphW2lqDOQ/LjU4M=',
                    publicKey: 'AlHCtJlFthb359xOxR5kiBLJpfoC2ZLPLWYHN3+hdzf2'
                  }
                }
              }
            }
          },
          function(e, happnInst) {
            if (e) return callback(e);

            happnInstance = happnInst;

            service.create(
              {
                secure: true,
                port: 10000,
                encryptPayloads: true,
                services: {
                  security: {
                    config: {
                      keyPair: serverKeyPair
                    }
                  }
                }
              },
              function(e, happnInst) {
                if (e) return callback(e);
                encryptedPayloadInstance = happnInst;
                callback();
              }
            );
          }
        );
      } catch (e) {
        callback(e);
      }
    });

    after(async () => {
      if (happnInstance) await happnInstance.stop();
      if (encryptedPayloadInstance) await encryptedPayloadInstance.stop();
    });

    afterEach(async () => {
      if (admClient) await admClient.disconnect();
      if (admClient1) await admClient1.disconnect();
    });

    it('tests the keypairs', function(callback) {
      var message = 'this is a secret';

      var encrypted = crypto.asymmetricEncrypt(
        clientKeyPair.publicKey,
        serverKeyPair.privateKey,
        message
      );
      var decrypted = crypto.asymmetricDecrypt(
        serverKeyPair.publicKey,
        clientKeyPair.privateKey,
        encrypted
      );

      if (message === encrypted) throw new Error('encrypted data matches secret message');
      if (message !== decrypted.toString())
        throw new Error('decrypted data does not match secret message');

      callback();
    });

    it('tests static keypairs', function(callback) {
      var message = 'this is a secret';

      var encrypted = crypto.asymmetricEncrypt(
        'AlHCtJlFthb359xOxR5kiBLJpfoC2ZLPLWYHN3+hdzf2',
        'FtRDNOH1gU4ShXsmGZQhLbrdzM/eMP0kkFB5x9IUPkI=',
        message
      );
      var decrypted = crypto.asymmetricDecrypt(
        'A5pIYTF6P8ZG2/4SKi6a0W9dxSyaKD/t4lH/qEfKCZtx',
        'Kd9FQzddR7G6S9nJ/BK8vLF83AzOphW2lqDOQ/LjU4M=',
        encrypted
      );

      if (message === encrypted) throw new Error('encrypted data matches secret message');

      if (message !== decrypted.toString())
        throw new Error('decrypted data does not match secret message');

      callback();
    });

    it('logs in with the test client, supplying a public key - we check that we have a session secret', function(callback) {
      happn.client
        .create({
          config: {
            username: '_ADMIN',
            password: 'happn',
            keyPair: {
              publicKey: 'AjN7wyfbEdI2LzWyFo6n31hvOrlYvkeHad9xGqOXTm1K',
              privateKey: 'y5RTfdnn21OvbQrnBMiKBP9DURduo0aijMIGyLJFuJQ='
            }
          }
        })

        .then(function(clientInstance) {
          admClient = clientInstance;

          expect(admClient.session.secret).to.not.equal(undefined);
          expect(admClient.session.secret).to.not.equal(null);

          callback();
        })

        .catch(function(e) {
          callback(e);
        });
    });

    it('logs in with the test client, supplying a public key - receives a sessionSecret annd performs a set and get operation', function(callback) {
      happn.client
        .create({
          config: {
            username: '_ADMIN',
            password: 'happn',
            keyPair: clientKeyPair
          }
        })

        .then(function(clientInstance) {
          admClient = clientInstance;

          admClient.set(
            '/an/encrypted/payload/target',
            {
              encrypted: 'test'
            },
            {},
            function(e, response) {
              expect(e).to.equal(null);
              expect(response.encrypted === 'test').to.equal(true);

              admClient.get('/an/encrypted/payload/target', function(e, response) {
                expect(e).to.equal(null);
                expect(response.encrypted === 'test').to.equal(true);

                callback();
              });
            }
          );
        })

        .catch(function(e) {
          callback(e);
        });
    });

    it('logs in with the test client, supplying a public key - receives a sessionSecret annd performs an on operation', function(callback) {
      happn.client
        .create({
          config: {
            username: '_ADMIN',
            password: 'happn',
            keyPair: clientKeyPair
          }
        })

        .then(function(clientInstance) {
          admClient = clientInstance;

          admClient.on(
            '/an/encrypted/payload/target/event',
            {
              count: 1
            },
            function() {
              callback();
            },
            function(e) {
              expect(e).to.equal(null);

              admClient.set(
                '/an/encrypted/payload/target/event',
                {
                  test: 'on'
                },
                function(e) {
                  if (e) return callback(e);
                }
              );
            }
          );
        })

        .catch(function(e) {
          callback(e);
        });
    });

    it('logs in with 2 test clients, supplying a public key - receives a sessionSecret annd performs an on operation between the 2 clients', function(callback) {
      this.timeout(20000);

      var onHappened = false;

      happn.client
        .create({
          config: {
            username: '_ADMIN',
            password: 'happn',
            keyPair: clientKeyPair
          }
        })

        .then(function(clientInstance) {
          admClient = clientInstance;

          happn.client
            .create({
              config: {
                username: '_ADMIN',
                password: 'happn',
                keyPair: clientKeyPair1
              }
            })

            .then(function(clientInstance) {
              admClient1 = clientInstance;

              admClient1.on(
                '/an/encrypted/payload/target/event',
                function() {
                  onHappened = true;
                },
                function(e) {
                  expect(e).to.equal(null);

                  admClient.set(
                    '/an/encrypted/payload/target/event',
                    {
                      test: 'on'
                    },
                    function() {
                      setTimeout(function() {
                        if (onHappened) return callback();
                        callback(new Error("on didn't happen"));
                      }, 4000);
                    }
                  );
                }
              );
            })

            .catch(function(e) {
              callback(e);
            });
        })

        .catch(function(e) {
          callback(e);
        });
    });

    xit('fails to log in with the test client, without supplying a public key to the default encryptPayload server', function(callback) {
      happn.client
        .create({
          config: {
            username: '_ADMIN',
            password: 'happn'
          },
          port: 10000,
          secure: true
        })

        .then(function() {
          callback(new Error('this wasnt meant to happen'));
        })

        .catch(function(e) {
          expect(e.toString()).to.equal('Error: no public key supplied for encrypted payloads');
          callback();
        });
    });
  }
);
