describe(require('path').basename(__filename), function () {

  var happn = require('../lib/index');
  var serviceInstance;
  var expect = require('expect.js');
  var constants = happn.constants;

  var getService = function (config, callback) {
    happn.service.create(config,
      callback
    );
  };

  before('it starts a stats enabled servoce', function (done) {

    getService({
      secure: true,
      services:{
        stats:{
          config:{
            emit:true,
            print:true,
            interval:1000
          }
        }
      }
    }, function (e, service) {

      if (e) return done(e);

      serviceInstance = service;

      done();
    });
  });

  after('stop the test service', function (callback) {
    serviceInstance.stop(callback);
  });

  it('logs errors via the error service, ensures system health changes as required', function (done) {

    this.timeout(15000)
    var statsEmitted = [];

    serviceInstance.services.stats.on('system-stats', function(stats){
      statsEmitted.push(stats);
    });

    setTimeout(function(){
      if (statsEmitted.length < 5) return done(new Error('expected stats to be emitted'));
      done();
    }, 10000);
  });

});
