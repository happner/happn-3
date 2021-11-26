describe(
  require('../../__fixtures/utils/test_helper')
    .create()
    .testName(__filename, 3),
  function() {
    var expect = require('expect.js');
    var happn = require('../../../lib/index');
    var service = happn.service;
    var happnInstance = null;

    if (process.env.RUNNING_IN_ACTIONS) return; //skip all tests in github actions CI

    it('should initialize the service', function(callback) {
      this.timeout(20000);
      try {
        service.create(function(e, happnInst) {
          if (e) return callback(e);

          happnInstance = happnInst;
          callback();
        });
      } catch (e) {
        callback(e);
      }
    });

    after(function(done) {
      happnInstance.stop(done);
    });

    it('should fetch the browser client', function(callback) {
      this.timeout(5000);

      try {
        require('request')(
          {
            uri: 'http://127.0.0.1:55000/browser_client',
            method: 'GET'
          },
          function(e, r, b) {
            if (!e) {
              var path = require('path');
              var happnPath = path.dirname(
                path.resolve(require.resolve('../../../lib/index'), '..' + path.sep)
              );
              var happnVersion = require(happnPath + path.sep + 'package.json').version;
              expect(b.indexOf('//happn client v' + happnVersion)).to.be(0);
              callback();
            } else callback(e);
          }
        );
      } catch (e) {
        callback(e);
      }
    });
  }
);
