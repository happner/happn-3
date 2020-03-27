describe(
  require('../../__fixtures/utils/test_helper')
    .create()
    .testName(__filename, 3),
  function() {
    var happn = require('../../../lib/index');
    var expect = require('expect.js');
    var service = happn.service;
    var happn_client = happn.client;

    function getServiceConfig(compression) {
      return {
        secure: true,
        services: {
          session: {
            config: {
              primusOpts: {
                compression
              }
            }
          }
        }
      };
    }

    var serviceInstance;
    var clientInstance;
    this.timeout(25000);

    function createService(compressionOn, callback) {
      const config = getServiceConfig(compressionOn);
      service.create(config, function(e, happnInst) {
        if (e) return callback(e);
        serviceInstance = happnInst;
        callback();
      });
    }

    afterEach('it stops the test service', function(done) {
      clientInstance.disconnect(function() {
        serviceInstance.stop(
          {
            reconnect: false
          },
          done
        );
      });
    });

    it('test compression is switched off', function(done) {
      createService(false, function(e) {
        if (e) return done(e);
        happn_client
          .create({
            config: {
              username: '_ADMIN',
              password: 'happn'
            }
          })
          .then(function(client) {
            clientInstance = client;
            const message = getBigMessage(2048);
            clientInstance.set('/test/big/message', message, () => {
              expect(
                serviceInstance.services.session.primus.transformer.service.options
                  .perMessageDeflate
              ).to.eql(false);
              done();
            });
          })
          .catch(done);
      });
    });

    it('test compression is switched on', function(done) {
      createService(true, function(e) {
        if (e) return done(e);
        happn_client
          .create({
            config: {
              username: '_ADMIN',
              password: 'happn'
            }
          })
          .then(function(client) {
            clientInstance = client;
            const message = getBigMessage(2048);
            clientInstance.set('/test/big/message', message, () => {
              expect(
                serviceInstance.services.session.primus.transformer.service.options
                  .perMessageDeflate
              ).to.eql({});
              done();
            });
          })
          .catch(done);
      });
    });

    function getBigMessage(size) {
      const message = {
        data: []
      };

      for (var i = 0; i < size; i++) message.data.push({ counter: i });

      return message;
    }
  }
);
