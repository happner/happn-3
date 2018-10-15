describe.only(require('../../__fixtures/utils/test_helper').create().testName(__filename, 3), function () {

  var path = require('path');
  var shortid = require('shortid');
  var expect = require('expect.js');
  var Transport = require('../../../lib/services/transport/service');

  it('fails to initialize the transport service, createCertificate method raises error', function(done){

    var transportMock = new Transport();

    transportMock.happn = {
      connect:{},
      log:{
        warn:function(){}
      }
    };

    transportMock.createCertificate = function(keyPath, certPath, callback){
      return callback(new Error('test error'));
    };

    transportMock.initialize({
      mode: 'https',
      certPath: path.resolve(__dirname, '../../test-temp') + path.sep + 'https_initialization' + shortid.generate() + '.pem',
      keyPath: path.resolve(__dirname, '../../test-temp') + path.sep + 'https_initialization' + shortid.generate() + '.rsa'
    }, function(e){

      expect(e.toString()).to.be('Error: test error');
      done();
    });
  });
});
