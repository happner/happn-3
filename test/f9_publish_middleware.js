var Happn = require('..')
  , service = Happn.service
  , expect = require('expect.js')
  , async = require('async')
  , shortid = require('shortid')
  , Promise = require('bluebird')
  ;

describe('f9_publish_middleware', function () {

  var serviceInstance;
  var clientInstance;

  afterEach('stop the client', function(done){
    if (clientInstance) clientInstance.disconnect(done);
    else done();
  });

  afterEach('stop the server', function(done){
    if (serviceInstance) serviceInstance.stop(done);
    else done();
  });

  it('should instantiate a service with a piece of middleware', function (done) {

    var recipientFilterFunction = function (messsage, recipients, callback) {
      //filter recipients by message and recipient meta
      callback(null, recipients.filter(function (recipient) {
        console.log('recipient to filter:::', recipient);
        return true;
      }));
    };

    var clientConfig = {};

    var config = {
      services: {
        subscription: {
          config: {
            filter: recipientFilterFunction
          }
        }
      }
    };

    var ran1 = false, ran2 = false;

    service.create(config)
      .then(function (instance) {
        serviceInstance = instance;
        return Happn.client.create(clientConfig);
      })
      .then(function (client) {
        clientInstance = client;

        return new Promise(function (resolve, reject) {
          clientInstance.on('/test/path/*', {meta: {publish: true}}, function () {
            console.log('/test/path/1:::');
            ran1 = true;
          }, function (e) {
            if (e) return reject(e);
            resolve();
          });
        });
      })
      .then(function () {

        return new Promise(function (resolve, reject) {
          clientInstance.on('/test/path/*', {meta: {publish: false}}, function () {
            console.log('/test/path/2:::');
            ran2 = true;
          }, function (e) {
            if (e) return reject(e);
            resolve();
          });
        });
      })
      .then(function () {

        return clientInstance.set('/test/path/1', {test: 'data'}, {meta: {filter: true}})

      })
      .then(function () {

        return Promise.delay(200);
      })
      .then(function () {

        expect(ran1).to.be(true);
        expect(ran2).to.be(false);
      })
      .then(done)
      .catch(done)

    //create 1 client, 2 subscriptions, filter must remove one


  });
});
