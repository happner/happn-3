describe(require('path').basename(__filename), function () {

  this.timeout(30000);

  var expect = require('expect.js');
  var happn = require('../lib/index');
  var service = happn.service;

  var path = require('path');

  var happnInstance = null;

  var http = require('http');

  var serviceConfig = {
    port: 10000,
    secure: true,
    services: {
      data: {
        config: {
          filename: __dirname + path.sep + 'fixtures' + path.sep + 'old_db.nedb'
        }
      }
    }
  };

  before('should initialize the service', function (callback) {

    this.timeout(20000);

    try {

      service.create(serviceConfig, function (e, happnInst) {

        if (e) return callback(e);

        happnInstance = happnInst;

        callback();

      });
    } catch (e) {
      callback(e);
    }
  });

  after(function (done) {

    if (happnInstance) happnInstance.stop()
      .then(done)
      .catch(done)
    else done();
  });

  it('logs in with the correct admin password', function (done) {

    happnInstance.services.session.localClient({
        username: '_ADMIN',
        password: 'password'
      })

      .then(function (clientInstance) {
        done();
      })

      .catch(function (e) {
        done(e);
      });
  });
});
