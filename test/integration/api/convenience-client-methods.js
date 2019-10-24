describe(
  require('../../__fixtures/utils/test_helper')
    .create()
    .testName(__filename, 3),
  function() {
    var expect = require('expect.js');
    var happn = require('../../../lib/index');
    var service = happn.service;
    var happn_client = happn.client;
    var default_timeout = 4000;
    var happnInstance = null;

    var test_id = Date.now() + '_' + require('shortid').generate();

    before('should initialize the service', function(callback) {
      this.timeout(20000);

      try {
        service.create(function(e, happnInst) {
          if (e) return callback(e);
          happnInstance = happnInst;
          callback();
        });
      } catch (e) {
        callback(e);
      }
    });

    after(function(done) {
      websocketsclient.disconnect(
        {
          timeout: 2000
        },
        function(e) {
          if (e) console.warn('failed disconnecting test client');

          eventemitterclient.disconnect(
            {
              timeout: 2000
            },
            function(e) {
              if (e) console.warn('failed disconnecting test client');

              happnInstance.stop(done);
            }
          );
        }
      );
    });

    var websocketsclient;
    var eventemitterclient;

    /*
   We are initializing 2 clients to test saving data against the database, one client will push data into the
   database whilst another listens for changes.
   */
    before('should initialize the clients', function(callback) {
      this.timeout(default_timeout);

      try {
        happn_client.create(function(e, instance) {
          if (e) return callback(e);

          websocketsclient = instance;

          happnInstance.services.session.localClient(function(e, instance) {
            if (e) return callback(e);
            eventemitterclient = instance;

            callback();
          });
        });
      } catch (e) {
        callback(e);
      }
    });

    it('increments a value on a path, convenience method, listens on path receives event: websockets', function(done) {
      var test_string = require('shortid').generate();
      var test_base_url = '/increment/convenience/' + test_id + '/' + test_string;

      eventemitterclient.on(
        test_base_url,
        function(data) {
          expect(data.value).to.be(1);
          expect(data.gauge).to.be('counter');

          done();
        },
        function(e) {
          if (e) return done(e);

          websocketsclient.increment(test_base_url, 'counter', 1, {}, function(e) {
            if (e) return done(e);
          });
        }
      );
    });

    it('tests get paths: websockets', function(callback) {
      var test_path_end = require('shortid').generate();
      websocketsclient.set(
        'e2e_test1/testwildcard/' + test_path_end,
        {
          property1: 'property1',
          property2: 'property2',
          property3: 'property3'
        },
        null,
        function(e) {
          expect(e == null).to.be(true);
          websocketsclient.set(
            'e2e_test1/testwildcard/' + test_path_end + '/1',
            {
              property1: 'property1',
              property2: 'property2',
              property3: 'property3'
            },
            null,
            function(e) {
              expect(e == null).to.be(true);
              websocketsclient.get('e2e_test1/testwildcard/' + test_path_end + '*', null, function(
                e,
                results
              ) {
                expect(results.length === 2).to.be(true);
                expect(results[0].property1).to.be('property1');
                websocketsclient.getPaths(
                  'e2e_test1/testwildcard/' + test_path_end + '*',
                  {},
                  function(e, results) {
                    expect(results.length === 2).to.be(true);
                    expect(results[0].property1).to.be(undefined);
                    callback(e);
                  }
                );
              });
            }
          );
        }
      );
    });

    it('the publisher should push a sibling and get all siblings', function(callback) {
      this.timeout(default_timeout);

      try {
        var test_path_end = require('shortid').generate();

        websocketsclient.setSibling(
          'e2e_test1/siblings/' + test_path_end,
          {
            property1: 'sib_post_property1',
            property2: 'sib_post_property2'
          },
          {},
          function(e) {
            expect(e == null).to.be(true);

            websocketsclient.setSibling(
              'e2e_test1/siblings/' + test_path_end,
              {
                property1: 'sib_post_property1',
                property2: 'sib_post_property2'
              },
              {},
              function(e) {
                expect(e == null).to.be(true);

                //the child method returns a child in the collection with a specified id
                websocketsclient.get('e2e_test1/siblings/' + test_path_end + '/*', null, function(
                  e,
                  getresults
                ) {
                  expect(e == null).to.be(true);
                  expect(getresults.length === 2).to.be(true);
                  callback(e);
                });
              }
            );
          }
        );
      } catch (e) {
        callback(e);
      }
    });
  }
);
