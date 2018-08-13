describe(require('../../__fixtures/utils/test_helper').create().testName(__filename, 3), function () {

  var expect = require('expect.js');
  var happn = require('../../../lib/index');
  var service = happn.service;
  var happnInstance = null;
  var test_id;

  it('should initialize the service with no config', function (callback) {

    this.timeout(20000);
    test_id = Date.now() + '_' + require('shortid').generate();

    try {

      service.create()

        .then(function (happnInst) {
          happnInstance = happnInst;
          callback();
        })

        .catch(callback)

      ;

    } catch (e) {
      callback(e);
    }

  });

  after(function (done) {
    happnInstance.stop(done);
  });
});
