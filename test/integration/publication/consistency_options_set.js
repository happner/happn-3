var Happn = require('../../..'),
  service = Happn.service,
  expect = require('expect.js'),
  async = require('async'),
  shortid = require('shortid'),
  Promise = require('bluebird');

describe(require('../../__fixtures/utils/test_helper').create().testName(__filename, 3),  function () {

  var serviceInstance;
  var clientInstance1;
  var clientInstance2;

  var CONSISTENCY = Happn.constants.CONSISTENCY;

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

  it('does a set with a publish, deferred consistency, picks up publication log from the onPublished event handler', function (done) {

    var clientConfig = {};

    var config = {
      services: {
        subscription: {
          config: {}
        }
      }
    };

    var ran1 = false,
      ran2 = false;

    var subscription1, subscription2;

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

        return clientInstance1.on('/test/path/*', {
          meta: {
            publish: true
          },
          onPublished: function (data) {
            ran1 = true;
          }
        });
      })
      .then(function (subscription) {

        subscription1 = subscription;

        return clientInstance2.on('/test/path/*', {
          meta: {
            publish: true
          },
          onPublished: function (data) {
            ran2 = true;
          }
        });
      })
      .then(function (subscription) {

        subscription2 = subscription;

        return new Promise(function (resolve, reject) {

          clientInstance1.set('/test/path/1', {
            test: 'data'
          }, {
            consistency: CONSISTENCY.DEFERRED,
            onPublished: function (e, results) {

              expect(Object.keys(clientInstance2.__ackHandlers).length == 0).to.be(true);

              if (e) return reject(e);
              resolve(results);
            }
          }, function (e) {
            if (e) return reject(e);
          });
        });
      })
      .then(function (results) {

        expect(results.queued).to.be(2);
        expect(results.successful).to.be(2);

        //TODO: test unsubscribe

        done();
      })
      .catch(done);

  });

  it('does a set with a publish, transactional (default) consistency publishResults:true, picks up publication log the set results meta', function (done) {

    var clientConfig = {};

    var config = {
      services: {
        subscription: {
          config: {}
        }
      }
    };

    var ran1 = false,
      ran2 = false;

    var subscription1, subscription2;

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

        return clientInstance1.on('/test/path/transactional/*', {
          meta: {
            publish: true
          },
          onPublished: function (data) {
            ran1 = true;
          }
        });
      })
      .then(function (subscription) {

        subscription1 = subscription;

        return clientInstance2.on('/test/path/transactional/*', {
          meta: {
            publish: true
          },
          onPublished: function (data) {
            ran2 = true;
          }
        });
      })
      .then(function (subscription) {

        subscription2 = subscription;

        return new Promise(function (resolve, reject) {

          clientInstance1.set('/test/path/transactional/1', {
            test: 'data'
          }, {
            consistency: CONSISTENCY.TRANSACTIONAL,
            publishResults: true
          }, function (e, response) {
            if (e) return reject(e);
            else resolve(response);
          });
        });
      })
      .then(function (results) {

        expect(results._meta.publishResults.queued).to.be(2);
        expect(results._meta.publishResults.successful).to.be(2);

        //TODO: test unsubscribe

        done();
      })
      .catch(done);

  });

  it('does a set with a publish, queued consistency publishResults:true, should be no publication log', function (done) {

    var clientConfig = {};

    var config = {
      services: {
        subscription: {
          config: {}
        }
      }
    };

    var ran1 = false,
      ran2 = false;

    var subscription1, subscription2;

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

        return clientInstance1.on('/test/path/queued/*', {
          meta: {
            publish: true
          },
          onPublished: function (data) {
            ran1 = true;
          }
        });
      })
      .then(function (subscription) {

        subscription1 = subscription;

        return clientInstance2.on('/test/path/queued/*', {
          meta: {
            publish: true
          },
          onPublished: function (data) {
            ran2 = true;
          }
        });
      })
      .then(function (subscription) {

        subscription2 = subscription;

        return new Promise(function (resolve, reject) {

          clientInstance1.set('/test/path/queued/1', {
            test: 'data'
          }, {
            consistency: CONSISTENCY.QUEUED,
            publishResults: true
          }, function (e, response) {
            if (e) return reject(e);
            else resolve(response);
          });
        });
      })
      .then(function (results) {

        expect(results._meta.publishResults).to.be(undefined);

        done();
      })
      .catch(done);

  });

  it('does a set with a publish, deferred consistency, times the publication out', function (done) {

    this.timeout(10000);

    var clientConfig = {};

    var config = {
      services: {
        subscription: {
          config: {}
        }
      }
    };

    var ran1 = false,
      ran2 = false;

    var subscription1, subscription2;

    var oldPerformPublication;

    service.create(config)

      .then(function (instance) {

        serviceInstance = instance;

        //we overwrite this function - so publish never happens
        serviceInstance.services.publisher.performPublication = function (publication, callback) {

          return callback(null, publication.message);
        };

        serviceInstance.services.queue.__publicationQueue = async.queue(serviceInstance.services.publisher.performPublication.bind(serviceInstance.services.publisher), 10);

        return Happn.client.create(clientConfig);
      })
      .then(function (client) {

        clientInstance1 = client;
        return Happn.client.create(clientConfig);
      })
      .then(function (client) {

        clientInstance2 = client;

        return clientInstance1.on('/test/path/*', {
          meta: {
            publish: true
          },
          onPublished: function (data) {
            ran1 = true;
          }
        });
      })
      .then(function (subscription) {

        subscription1 = subscription;

        return clientInstance2.on('/test/path/*', {
          meta: {
            publish: true
          },
          onPublished: function (data) {
            ran2 = true;
          }
        });
      })
      .then(function (subscription) {

        subscription2 = subscription;
        setHappened = false;

        clientInstance1.set('/test/path/1', {
          test: 'data'
        }, {

          consistency: CONSISTENCY.DEFERRED,

          onPublishedTimeout: 5000,

          onPublished: function (e, results) {

            if (!e) return done(new Error('should have failed'));

            expect(e.toString()).to.be('Error: publish timed out');

            expect(setHappened).to.be(true);

            done();
          }
        }, function (e) {

          if (e) return done(e);
          setHappened = true;
        });

      })
      .catch(done);

  });

  it('does a set with a publish, acknowledged consistency, picks up publication log in the onPublished event handler', function (done) {

    this.timeout(10000);

    var clientConfig = {};

    var config = {
      services: {
        subscription: {
          config: {}
        }
      }
    };

    var ran1 = false,
      ran2 = false;

    var subscription1, subscription2;

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

        return clientInstance1.on('/test/path/acknowledged/*', {
          meta: {
            publish: true
          },
          onPublished: function (data) {
            ran1 = true;
          }
        });
      })

      .then(function (subscription) {

        subscription1 = subscription;

        return clientInstance2.on('/test/path/acknowledged/*', {
          meta: {
            publish: true
          },
          onPublished: function (data) {
            ran2 = true;
          }
        });
      })

      .then(function (subscription) {

        subscription2 = subscription;

        return new Promise(function (resolve, reject) {

          clientInstance1.set('/test/path/acknowledged/1', {
            test: 'data'
          }, {

            consistency: CONSISTENCY.ACKNOWLEDGED,

            onPublished: function (e, results) {

              if (e) return reject(e);

              resolve(results);
            }
          }, function (e) {

            if (e) return reject(e);
          });
        });
      })

      .then(function (results) {

        expect(results.queued).to.be(2);
        expect(results.successful).to.be(2);
        expect(results.acknowledged).to.be(2);

        //TODO: test unsubscribe

        done();
      })
      .catch(done);

  });

  it('does a set with a publish, acknowledged consistency, times one of the acknowledgements out', function (done) {

    this.timeout(10000);

    var clientConfig = {};

    var config = {
      services: {
        subscription: {
          config: {}
        },
        publisher: {
          config: {
            publicationOptions: {
              acknowledgeTimeout: 2000
            }
          }
        }
      }
    };

    var ran1 = false,
      ran2 = false;

    var subscription1, subscription2;

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

        clientInstance2.__acknowledge = function (message, callback) {
          //so no ack reached the server
          callback(message);
        };

        return clientInstance1.on('/test/path/acknowledged_timed_out/*', {
          meta: {
            publish: true
          },
          onPublished: function (data) {
            ran1 = true;
          }
        });
      })
      .then(function (subscription) {

        subscription1 = subscription;

        return clientInstance2.on('/test/path/acknowledged_timed_out/*', {
          meta: {
            publish: true
          },
          onPublished: function (data) {
            ran2 = true;
          }
        });
      })
      .then(function (subscription) {

        subscription2 = subscription;

        clientInstance1.set('/test/path/acknowledged_timed_out/1', {
          test: 'data'
        }, {

          consistency: CONSISTENCY.ACKNOWLEDGED,

          onPublishedTimeout: 5000,

          onPublished: function (e, results) {

            if (!e) return done(new Error('should have failed'));

            expect(e.toString()).to.be('Error: unacknowledged publication');

            done();
          }
        }, function (e) {
          if (e) return done(e);
        });

      })
      .catch(done);

  });

});
