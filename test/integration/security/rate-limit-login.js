const delay = require('await-delay');
describe(
  require('../../__fixtures/utils/test_helper')
    .create()
    .testName(__filename, 3),
  function() {
    var expect = require('expect.js');
    var fs = require('fs');
    var happn = require('../../../lib/index');
    var tmpFile = __dirname + '/tmp/testdata_' + require('shortid').generate() + '.db';
    var currentService = null;

    var stopService = function(callback) {
      if (currentService) {
        currentService.services.session.disconnectAllClients();
        currentService.stop(function(e) {
          if (e && e.toString() !== 'Error: Not running') return callback(e);
          callback();
        });
      } else callback();
    };

    var initService = function(filename, name, callback) {
      stopService(function(e) {
        if (e) return callback(e);
        var serviceConfig = {
          secure:true,
          name: name,
          services: {
            session: {
              config: {
                connectionLimit: {
                  activated:true,
                  start:10,
                  interval:60e3,
                  append:100,
                  ceiling:10e3,
                  delay: 10e3
                }
              }
            },
            data: {
              config: {
                filename: filename
              }
            }
          }
        };

        happn.service.create(serviceConfig, function(e, happnService) {
          if (e) return callback(e);
          currentService = happnService;
          callback();
        });
      });
    };

    var getClient = function() {
      return new Promise((resolve, reject) => {
        let timeout = setTimeout(() => {
          return reject('timed out');
        }, 2000);
        happn.client.create({
          config: {
            username: '_ADMIN',
            password: 'happn'
          },
          secure: true
        }).then((client) => {
          clearTimeout(timeout);
          resolve(client);
        });
      });
    };

    before('should initialize the service', function(callback) {
      this.timeout(20000);
      initService(tmpFile, 'admin_login', callback);
    });

    after('should delete the temp data file', function(callback) {
      this.timeout(20000);
      stopService(function() {
        fs.unlink(tmpFile, function() {
          callback();
        });
      });
    });

    this.timeout(50000);

    it('does an admin login, should modify the admin password, restart the service and do an admin login, then pull data from a restricted path', async () => {
      let connectionErrors = [];
      let connectedClients = [];
      for (let connectionAttempt = 0; connectionAttempt < 12; connectionAttempt++){
        try{
          let testClient = await getClient();
          connectedClients.push(testClient);
        }catch(e){
          connectionErrors.push(e);
        }
        await delay(1000);
      }
      expect(connectedClients.length).to.be(10);
      expect(connectionErrors.length).to.be(2);

      connectedClients.forEach((client) => {
        client.disconnect();
      });
    });
  }
);
