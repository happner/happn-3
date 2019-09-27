describe(
  require('../../__fixtures/utils/test_helper')
    .create()
    .testName(__filename, 3),
  function() {
    var expect = require('expect.js');

    function happnMock(config) {
      return {
        log: function() {},
        config: {
          port: config.port,
          secure: config.secure,
          services: {
            transport: {
              config: {}
            }
          }
        }
      };
    }

    async function newConnect(config) {
      return new Promise(function(resolve, reject) {
        var Connect = require('../../../lib/services/connect/service.js');
        var instance = new Connect({
          logger: {
            createLogger: function() {
              return {
                $$TRACE: function() {}
              };
            }
          }
        });
        instance.happn = happnMock(config);
        instance.initialize(config, function(e) {
          if (e) return reject(e);
          resolve(instance);
        });
      });
    }

    it('should load the connect service up, middlewares have the correct happn', async () => {
      var connect1 = await newConnect({ secure: true, port: 55001 });
      var connect2 = await newConnect({ secure: true, port: 55002 });
      var connect3 = await newConnect({ secure: true, port: 55003 });

      expect(connect1.middleware['system'].happn.config).to.eql({
        secure: true,
        port: 55001,
        services: {
          transport: {
            config: {}
          }
        }
      });
      expect(connect2.middleware['system'].happn.config).to.eql({
        secure: true,
        port: 55002,
        services: {
          transport: {
            config: {}
          }
        }
      });
      expect(connect3.middleware['system'].happn.config).to.eql({
        secure: true,
        port: 55003,
        services: {
          transport: {
            config: {}
          }
        }
      });
    });
  }
);
