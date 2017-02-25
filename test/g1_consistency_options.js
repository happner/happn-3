var Happn = require('..')
  , service = Happn.service
  , expect = require('expect.js')
  , async = require('async')
  , shortid = require('shortid')
  , Promise = require('bluebird')
  ;

describe('g1_consistency_options', function () {

  var serviceInstance;
  var clientInstance1;
  var clientInstance2;

  var CONSISTENCY = {
    DEFERRED:0,//get a consistency report back after the subscribes have been notified
    QUEUED:1,//queues the publication, then calls back
    TRANSACTIONAL:2,//waits until all recipients have been written to
    ACKNOWLEDGED:3//waits until all recipients have acknowledged
  };

  afterEach('stop the client 1', function (done) {
    if (clientInstance1) clientInstance1.disconnect(done);
    else done();
  });

  afterEach('stop the client 2', function (done) {
    if (clientInstance2) clientInstance2.disconnect(done);
    else done();
  });

  afterEach('stop the server', function (done) {
    if (serviceInstance) serviceInstance.stop(done);
    else done();
  });

  it('does a set with a publish, deferred consistency, picks up publication log from client', function (done) {

    var clientConfig = {};

    var config = {
      services: {
        subscription: {
          config: {}
        }
      }
    };

    var ran1 = false, ran2 = false;

    var eventId1, eventId2;

    service.create(config)
      .then(function (instance) {
        serviceInstance = instance;
        return Happn.client.create(clientConfig);
      })
      .then(function (client) {

        clientInstance1 = client;
        return Happn.client.create(clientConfig);
      })
      .then(function (client) {

        clientInstance2 = client;

        return new Promise(function (resolve, reject) {

          clientInstance1.on('/test/path/*', {meta: {publish: true}}, function (e) {
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

          clientInstance2.on('/test/path/*', {meta: {publish: true}}, function (e) {
            ran2 = true;
          }, function (e, eventId) {

            if (e) return reject(e);
            eventId1 = eventId;
            resolve();
          });
        });
      })
      .then(function () {

        return new Promise(function (resolve, reject) {

          clientInstance.set('/test/path/1', {test: 'data'}, {
            consistency:CONSISTENCY.DEFERRED,
            onPublished:function(e, results){
              if (e) return reject(e);

              resolve(results);
            }
          }, function(e){
            if (e) return reject(e);
          })
        });
      })
      .then(function (results) {

        expect(results.queued).to.be(2);
        expect(results.published).to.be(2);

        done();
      })
      .catch(done)

  });
});
