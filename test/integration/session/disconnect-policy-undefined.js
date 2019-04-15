xdescribe(require('../../__fixtures/utils/test_helper').create().testName(__filename, 3),function () {

  var delay = require('await-delay');
  var happn = require('../../../lib/index');
  var service = happn.service;
  var happn_client = happn.client;
  var serviceInstance;

  var serviceConfig = {
    secure:true
  };

  this.timeout(20000);

  before('it starts up the service', function(callback){

    service.create(serviceConfig,
      function (e, happnInst) {

        if (e) return callback(e);

        serviceInstance = happnInst;

        serviceInstance.services.session.on('authentic', function (data) {
        });

        serviceInstance.services.session.on('disconnect', function (data) {
        });

        callback();
      });
  })

  after('it stops up the service', function(callback){

    if (!serviceInstance) return callback();

    serviceInstance.stop({
      reconnect: false
    }, callback);
  });

  xit('disconnects and reconnects a client a lot, _authorizeSession does not raise the undefined/undefined error', async () => {

    for (var i = 0; i < 10; i++){

      var client = await happn_client.create({config: {
        username: '_ADMIN',
        password: 'happn'
      }});

      for (var ii = 0;ii < 1000; ii++) {
        client.set('/test/path/', {test:'did set:::' + i + '.' + ii}, function(e, result) {
          console.log(e, result);
        });
      }

      await delay(200);

      await client.disconnect();
      console.log('disconnected:::');
    }
  });
});
