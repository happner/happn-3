var Happn = require('../../..'),
  service = Happn.service,
  expect = require('expect.js'),
  Promise = require('bluebird');

describe(require('../../__fixtures/utils/test_helper').create().testName(__filename, 3),  function () {

  var serviceInstance;
  var clientInstance;

  afterEach('stop the client', function (done) {
    if (clientInstance) clientInstance.disconnect(done);
    else done();
  });

  afterEach('stop the server', function (done) {
    if (serviceInstance) serviceInstance.stop(done);
    else done();
  });

  it('should instantiate a service with a piece of middleware', function (done) {

    var recipientFilterFunction = function (message, recipients, callback) {

      //filter recipients by message and recipient meta
      callback(null, recipients.filter(function (recipient) {

        return recipient.data.options.meta.publish;
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

    var ran1 = false,
      ran2 = false;

    var eventId1, eventId2;

    service.create(config)
      .then(function (instance) {
        serviceInstance = instance;
        return Happn.client.create(clientConfig);
      })
      .then(function (client) {
        clientInstance = client;

        return new Promise(function (resolve, reject) {

          clientInstance.on('/test/path/*/*', {
            meta: {
              publish: true
            }
          }, function (data) {

            ran1 = true;

          }, function (e, eventId) {

            if (e) return reject(e);

            eventId1 = eventId;

            resolve();
          });
        });
      })
      .then(function () {

        return new Promise(function (resolve, reject) {

          clientInstance.on('/test/path/1/*', {
            meta: {
              publish: false
            }
          }, function (data) {

            ran2 = true;

          }, function (e, eventId) {

            if (e) return reject(e);

            eventId2 = eventId;

            resolve();
          });
        });
      })
      .then(function () {

        return clientInstance.set('/test/path/1/1', {
          test: 'data'
        }, {
          meta: {
            filter: true
          }
        });

      })
      .then(function () {

        return Promise.delay(300);
      })
      .then(function () {

        expect(ran1).to.be(true);
        expect(ran2).to.be(false);

      })
      .then(done)
      .catch(done);

    //create 1 client, 2 subscriptions, filter must remove one


  });
});
