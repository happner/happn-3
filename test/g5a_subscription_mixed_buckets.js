var happn = require('..'),
  service = happn.service,
  client = happn.client,
  expect = require('expect.js'),
  Promise = require('bluebird');

describe('g5a_subscription_mixed_buckets', function () {

  var serviceInstance;

  var testClientMethodsAndEvents = function (client) {

    return new Promise(function (resolve, reject) {

      client.on('/strict/*', function (data) {

        client.on('/strict/all/**', function (data) {

          expect(serviceInstance.services.subscription.__buckets[0].__subscriptions.children.array.length).to.be(1);

          var forbiddenFruit = false;

          client.on('/strict/not/*', function (data) {

            forbiddenFruit = true;

          }, function (e) {

            if (e) return reject(e);

            client.set('/strict/not/allowed/to', {
              test: 'data'
            }, function (e) {

              if (e) return reject(e);

              setTimeout(function () {

                if (forbiddenFruit) return reject(new Error('forbidden fruit was picked'));

                client.on('/strict/yes/*',

                  function (data) {

                    client.on('/notstrict/*', function (data) {

                      resolve();

                    }, function (e) {

                      if (e) return reject(e);

                      client.set('/notstrict/any/length', {
                        test: 'data'
                      }, function (e) {
                        if (e) return reject(e);
                      });
                    })

                  },
                  function (e) {
                    if (e) return reject(e);

                    client.set('/strict/yes/allowed', {
                      test: 'data'
                    }, function (e) {
                      if (e) return reject(e);
                    });
                  }
                );
              }, 400);
            });
          });

        }, function (e) {

          if (e) return reject(e);

          client.set('/strict/all/and/any', {
            test: 'data'
          }, function (e) {
            if (e) return reject(e);
          })
        });

      }, function (e) {

        if (e) return reject(e);

        client.set('/strict/1', {
          test: 'data'
        }, function (e) {
          if (e) return reject(e);
        })
      });
    });
  };

  it('starts a mixed bucket service, tests the various behaviours', function (done) {

    this.timeout(10000);

    var config = {
      services: {
        subscription: {
          config: {
            buckets: [{
                name: 'strict',
                channel: '*@/strict/*', //any messages (SET or REMOVE) with path starting with /strict/
                implementation: happn.bucketStrict
              },
              {
                name: 'default', //using the default implementation (backwards compatible)
                channel: '*' //any messages, that were not strict
              }
            ]
          }
        }
      }
    };

    var wsClient;
    var eeClient;

    service.create(config)

      .then(function (instance) {

        serviceInstance = instance;

        return new Promise(function (resolve, reject) {

          instance.services.session.localClient(function (e, client) {

            if (e) return reject(e);

            eeClient = client;
            resolve();
          });
        });
      })
      .then(function () {
        return client.create();
      })
      .then(function (client) {

        wsClient = client;

        return testClientMethodsAndEvents(wsClient);
      })
      .then(function () {

        return testClientMethodsAndEvents(eeClient);
      })
      .then(function () {

        wsClient.disconnect(function () {

          serviceInstance.stop(done);
        });
      })
      .catch(done);
  });
});
