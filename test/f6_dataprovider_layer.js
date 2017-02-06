describe('d3_data_functional', function() {

  this.timeout(20000);

  var expect = require('expect.js');

  var service = require('../lib/services/data/service');

  var serviceInstance = new service();

  var tempFile1 = __dirname + '/tmp/testdata_' + require('shortid').generate() + '.db';

  var config = {
    services:{
      data:{
        config:{
          datastores: [
            {
              name: 'persisted',
              provider:'./providers/nedb',//this by default
              isDefault: true,
              settings: {
                filename: tempFile1
              }
            }
          ]
        }
      }
    }
  };

  before('should initialize the service', function(callback) {

    serviceInstance.initialize(config, callback);
  });

  after(function(done) {

    serviceInstance.stop(done);
  });

  it('sets data', function(callback) {


  });

});
