describe(require('../../__fixtures/utils/test_helper').create().testName(__filename, 3), function () {

  this.timeout(5000);

  var expect = require('expect.js');
  var path = require('path');
  var HappnClient = require('../../../lib/client');
  var Constants = require('../../../lib/constants');

  it('tests the handle_error function, non fatal error', function (done) {

    var happnClient = new HappnClient();

    happnClient.__initializeEvents();
    happnClient.__initializeProperties();
    happnClient.log = {
      error:function(){}
    };

    happnClient.onEvent('error', function(error){
      expect(happnClient.state != Constants.CLIENT_STATE.ERROR).to.be(true);
      expect(error.message).to.be('test error');
      done();
    });

    happnClient.handle_error(new Error('test error'));
  });

  it('tests the handle_error function, fatal error', function (done) {

    var happnClient = new HappnClient();

    happnClient.__initializeEvents();
    happnClient.__initializeProperties();
    happnClient.log = {
      error:function(){}
    };

    happnClient.onEvent('error', function(error){
      expect(happnClient.errors.length).to.be(1);
      expect(happnClient.state == Constants.CLIENT_STATE.ERROR).to.be(true);
      done();
    });

    happnClient.handle_error(new Error('test error'), true);
  });

  it('tests the handle_error function, fatal error event', function (done) {

    var happnClient = new HappnClient();

    happnClient.__initializeEvents();
    happnClient.__initializeProperties();
    happnClient.log = {
      error:function(){}
    };

    happnClient.onEvent('fatal-error', function(error){
      expect(happnClient.state == Constants.CLIENT_STATE.ERROR).to.be(true);
      done();
    });

    happnClient.handle_error(new Error('test error'), true);
  });

  it('tests the handle_error function only stores the last 100 errors', function (done) {

    var happnClient = new HappnClient();

    happnClient.__initializeEvents();
    happnClient.__initializeProperties();
    happnClient.log = {
      error:function(){}
    };

    for (var i = 0; i <= 110; i++) happnClient.handle_error(new Error('test error: ' + i), true);

    expect(happnClient.errors.length).to.be(100);
    expect(happnClient.errors[99].error.message).to.be('test error: 110');

    done();

  });
});
