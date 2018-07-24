describe(require('../../__fixtures/utils/test_helper').create().testName(__filename, 3), function () {

  var expect = require('expect.js');
  var happn = require('../../../lib/index');
  var service = happn.service;
  var happn_client = happn.client;
  var async = require('async');

  var test_secret = 'test_secret';
  var mode = "embedded";
  var happnInstance = null;
  var test_id;

  this.timeout(5000);

  /*
   This test demonstrates starting up the happn service -
   the authentication service will use authTokenSecret to encrypt web tokens identifying
   the logon session. The utils setting will set the system to log non priority information
   */

  before('should initialize the service', function (callback) {


    test_id = Date.now() + '_' + require('shortid').generate();

    try {
      service.create(function (e, happnInst) {
        if (e)
          return callback(e);

        happnInstance = happnInst;
        callback();
      });
    } catch (e) {
      callback(e);
    }
  });

  after(function (done) {

    this.timeout(20000);

    publisherclient.disconnect({
      timeout: 2000
    }, function (e) {
      if (e) console.warn('failed disconnecting publisher client');
      listenerclient.disconnect({
        timeout: 2000
      }, function (e) {
        if (e) console.warn('failed disconnecting listener client');
        happnInstance.stop(done);
      });
    });
  });

  var publisherclient;
  var listenerclient;
  var disconnectclient;

  /*
   We are initializing 2 clients to test saving data against the database, one client will push data into the
   database whilst another listens for changes.
   */
  before('should initialize the clients', function (callback) {


    try {
      happn_client.create(function (e, instance) {

        if (e) return callback(e);
        publisherclient = instance;

        happn_client.create(function (e, instance) {

          if (e) return callback(e);
          listenerclient = instance;

          happn_client.create(function (e, instance) {

            if (e) return callback(e);
            disconnectclient = instance;
            callback();

          });
        });
      });

    } catch (e) {
      callback(e);
    }
  });

  it('should disconnect the disconnect client', function (callback) {

    disconnectclient.disconnect().then(callback);

  });

  it('the listener should pick up a single wildcard event', function (callback) {

    try {

      //first listen for the change
      listenerclient.on('/2_websockets_embedded_sanity/' + test_id + '/testsubscribe/data/event/*', {
        event_type: 'set',
        count: 1
      }, function (message) {

        expect(listenerclient.events['/SET@/2_websockets_embedded_sanity/' + test_id + '/testsubscribe/data/event/*'].length).to.be(0);
        callback();

      }, function (e) {

        if (!e) {

          expect(listenerclient.events['/SET@/2_websockets_embedded_sanity/' + test_id + '/testsubscribe/data/event/*'].length).to.be(1);

          //then make the change
          publisherclient.set('/2_websockets_embedded_sanity/' + test_id + '/testsubscribe/data/event/blah', {
            property1: 'property1',
            property2: 'property2',
            property3: 'property3'
          }, null, function (e, result) {

            if (e) return callback(e);
          });
        } else callback(e);
      });

    } catch (e) {
      callback(e);
    }
  });

  it('the uses the onPublished event handler', function (callback) {

    listenerclient.on('/2_websockets_embedded_sanity/' + test_id + '/testsubscribe/data/onPublished/*', {
      onPublished: function (message, meta) {

        expect(message.property1).to.be('property1');

        expect(meta.created <= Date.now()).to.be(true);

        callback();
      }
    }).then(function (eventId) {

      expect(eventId >= 0).to.be(true);

      expect(listenerclient.events['/ALL@/2_websockets_embedded_sanity/' + test_id + '/testsubscribe/data/onPublished/*'].length).to.be(1);

      publisherclient.set('/2_websockets_embedded_sanity/' + test_id + '/testsubscribe/data/onPublished/blah', {
        property1: 'property1',
        property2: 'property2',
        property3: 'property3'
      }, null, function (e) {
        if (e) return callback(e);
      });

    }).catch(callback);
  });

  it('the listener should pick up a wildcard event, no parameters', function (callback) {

    try {

      //first listen for the change
      listenerclient.on('/2_websockets_embedded_sanity/' + test_id + '/testsubscribe/data/anyevent/*', function (message) {

        expect(listenerclient.events['/ALL@/2_websockets_embedded_sanity/' + test_id + '/testsubscribe/data/anyevent/*'].length).to.be(1);
        callback();

      }, function (e) {

        if (!e) {

          expect(listenerclient.events['/ALL@/2_websockets_embedded_sanity/' + test_id + '/testsubscribe/data/anyevent/*'].length).to.be(1);

          //then make the change
          publisherclient.set('/2_websockets_embedded_sanity/' + test_id + '/testsubscribe/data/anyevent/blah', {
            property1: 'property1',
            property2: 'property2',
            property3: 'property3'
          }, null, function (e, result) {

            if (e) return callback(e);
          });
        } else callback(e);
      });

    } catch (e) {
      callback(e);
    }
  });

  it('the listener should pick up a wildcard event, key without preceding /', function (callback) {

    try {

      //first listen for the change
      listenerclient.on('2_websockets_embedded_sanity/anyevent/*', function (message) {

        expect(listenerclient.events['/ALL@2_websockets_embedded_sanity/anyevent/*'].length).to.be(1);
        callback();

      }, function (e) {

        if (!e) {

          expect(listenerclient.events['/ALL@2_websockets_embedded_sanity/anyevent/*'].length).to.be(1);

          //then make the change
          publisherclient.set('2_websockets_embedded_sanity/anyevent/blah', {
            property1: 'property1',
            property2: 'property2',
            property3: 'property3'
          }, null, function (e, result) {

            if (e) return callback(e);
          });
        } else callback(e);
      });

    } catch (e) {
      callback(e);
    }
  });

  it('the listener should pick up a wildcard event, key without preceding / once', function (callback) {

    try {

      //first listen for the change
      listenerclient.on('2_websockets_embedded_sanity/anyeventonce/*', {
        count: 1
      }, function (message) {

        expect(listenerclient.events['/ALL@2_websockets_embedded_sanity/anyeventonce/*'].length).to.be(0);
        callback();

      }, function (e) {

        if (!e) {

          expect(listenerclient.events['/ALL@2_websockets_embedded_sanity/anyeventonce/*'].length).to.be(1);

          //then make the change
          publisherclient.set('2_websockets_embedded_sanity/anyeventonce/blah', {
            property1: 'property1',
            property2: 'property2',
            property3: 'property3'
          }, {}, function (e, result) {

            if (e) return callback(e);
          });
        } else callback(e);
      });

    } catch (e) {
      callback(e);
    }
  });

  it('the publisher should get null for unfound data, exact path', function (callback) {


    var test_path_end = require('shortid').generate();
    publisherclient.get('2_websockets_embedded_sanity/' + test_id + '/unfound/exact/' + test_path_end, null, function (e, results) {
      ////////////console.log('new data results');

      expect(e).to.be(null);
      expect(results).to.be(null);

      callback(e);

    });
  });

  it('the publisher should get [] for unfound data, wildcard path', function (callback) {


    var test_path_end = require('shortid').generate();

    publisherclient.get('2_websockets_embedded_sanity/' + test_id + '/unfound/wild/*' + test_path_end + '/*', null, function (e, results) {
      ////////////console.log('new data results');

      expect(e).to.be(null);
      expect(results.length).to.be(0);

      callback(e);

    });
  });



  it('the publisher should set new data', function (callback) {

    try {
      var test_path_end = require('shortid').generate();

      publisherclient.set('2_websockets_embedded_sanity/' + test_id + '/testsubscribe/data/' + test_path_end, {
        property1: 'property1',
        property2: 'property2',
        property3: 'property3'
      }, {
        noPublish: true
      }, function (e, result) {

        if (e) return callback(e);

        publisherclient.get('2_websockets_embedded_sanity/' + test_id + '/testsubscribe/data/' + test_path_end, null, function (e, results) {

          expect(results.property1 == 'property1').to.be(true);
          callback(e);
        });

      });

    } catch (e) {
      callback(e);
    }
  });

  it('set_multiple, the publisher should set multiple data items, then do a wildcard get to return them', function (callback) {


    var timesCount = 10;

    try {

      async.times(timesCount,
        function (n, timesCallback) {

          var test_random_path2 = require('shortid').generate();

          publisherclient.set('/2_websockets_embedded_sanity/' + test_id + '/set_multiple/' + test_random_path2, {
            property1: 'property1',
            property2: 'property2',
            property3: 'property3'
          }, {
            noPublish: true
          }, timesCallback);

        },
        function (e) {

          if (e) return callback(e);

          listenerclient.get('/2_websockets_embedded_sanity/' + test_id + '/set_multiple/*', null, function (e, results) {

            if (e) return callback(e);

            expect(results.length).to.be(timesCount);
            callback();

          });

        });


    } catch (e) {
      callback(e);
    }
  });


  it('should set data, and then merge a new document into the data without overwriting old fields', function (callback) {


    try {

      var test_path_end = require('shortid').generate();

      publisherclient.set('/2_websockets_embedded_sanity/' + test_id + '/testsubscribe/data/merge/' + test_path_end, {
        property1: 'property1',
        property2: 'property2',
        property3: 'property3'
      }, null, function (e, result) {

        if (e)
          return callback(e);

        publisherclient.set('/2_websockets_embedded_sanity/' + test_id + '/testsubscribe/data/merge/' + test_path_end, {
          property4: 'property4'
        }, {
          merge: true
        }, function (e, result) {

          if (e)
            return callback(e);

          publisherclient.get('/2_websockets_embedded_sanity/' + test_id + '/testsubscribe/data/merge/' + test_path_end, null, function (e, results) {

            if (e)
              return callback(e);

            expect(results.property4).to.be('property4');
            expect(results.property1).to.be('property1');

            callback();

          });

        });

      });

    } catch (e) {
      callback(e);
    }
  });

  it('should contain the same payload between 2 non-merging consecutive stores', function (done) {
    var object = {
      param1: 10,
      param2: 20
    };
    var firstTime;

    listenerclient.on('setTest/object', {
      event_type: 'set',
      count: 2
    }, function (message) {
      if (firstTime === undefined) {
        firstTime = message;
        return;
      } else {
        expect(message).to.eql(firstTime);
        done();
      }
    }, function (err) {
      expect(err).to.not.be.ok();
      publisherclient.set('setTest/object', object, {}, function (err) {
        expect(err).to.not.be.ok();
        publisherclient.set('setTest/object', object, {}, function (err) {
          expect(err).to.not.be.ok();
        });
      });
    });
  });

  it('should contain the same payload between a merge and a normal store for first store', function (done) {
    var object = {
      param1: 10,
      param2: 20
    };
    var firstTime = true;

    listenerclient.on('mergeTest/object', {
      event_type: 'set',
      count: 2
    }, function (message, meta) {

      expect(message).to.eql(object);
      if (firstTime) {
        firstTime = false;
        return;
      }
      done();
    }, function (err) {
      expect(err).to.not.be.ok();
      publisherclient.set('mergeTest/object', object, {
        merge: true
      }, function (err) {
        expect(err).to.not.be.ok();
        publisherclient.set('mergeTest/object', object, {
          merge: true
        }, function (err) {
          expect(err).to.not.be.ok();
        });
      });
    });
  });


  it('should search for a complex object', function (callback) {

    var test_path_end = require('shortid').generate();

    var complex_obj = {
      regions: ['North', 'South'],
      towns: ['North.Cape Town'],
      categories: ['Action', 'History'],
      subcategories: ['Action.angling', 'History.art'],
      keywords: ['bass', 'Penny Siopis'],
      field1: 'field1'
    };

    var criteria1 = {
      $or: [{
        "regions": {
          $in: ['North', 'South', 'East', 'West']
        }
      }, {
        "towns": {
          $in: ['North.Cape Town', 'South.East London']
        }
      }, {
        "categories": {
          $in: ["Action", "History"]
        }
      }],
      "keywords": {
        $in: ["bass", "Penny Siopis"]
      }
    };

    var options1 = {
      sort: {
        "field1": 1
      },
      limit: 1
    };

    var criteria2 = null;

    var options2 = {
      fields: {
        towns: 1,
        keywords: 1
      },
      sort: {
        "field1": 1
      },
      limit: 2
    };

    publisherclient.set('/2_websockets_embedded_sanity/' + test_id + '/testsubscribe/data/complex/' + test_path_end, complex_obj, null, function (e, put_result) {

      if (e) return callback(e);

      publisherclient.set('/2_websockets_embedded_sanity/' + test_id + '/testsubscribe/data/complex/' + test_path_end + '/1', complex_obj, null, function (e, put_result) {

        if (e) return callback(e);

        ////////////console.log('searching');
        publisherclient.get('/2_websockets_embedded_sanity/' + test_id + '/testsubscribe/data/complex*', {
          criteria: criteria1,
          options: options1
        }, function (e, search_result) {

          if (e) return callback(e);

          expect(search_result.length == 1).to.be(true);

          publisherclient.get('/2_websockets_embedded_sanity/' + test_id + '/testsubscribe/data/complex*', {
            criteria: criteria2,
            options: options2
          }, function (e, search_result) {

            if (e) return callback(e);

            expect(search_result.length == 2).to.be(true);
            callback(e);
          });

        });
      });
    });

  });


  it('should delete some test data', function (callback) {


    try {

      //We put the data we want to delete into the database
      publisherclient.set('/2_websockets_embedded_sanity/' + test_id + '/testsubscribe/data/delete_me', {
        property1: 'property1',
        property2: 'property2',
        property3: 'property3'
      }, {
        noPublish: true
      }, function (e, result) {

        //We perform the actual delete
        publisherclient.remove('/2_websockets_embedded_sanity/' + test_id + '/testsubscribe/data/delete_me', {
          noPublish: true
        }, function (e, result) {

          expect(e).to.be(null);
          expect(result._meta.status).to.be('ok');

          ////////////////////console.log('DELETE RESULT');
          ////////////////////console.log(result);

          callback();
        });

      });

    } catch (e) {
      callback(e);
    }

  });

  it('should delete multiple items', function (callback) {

    try {

      //We put the data we want to delete into the database
      publisherclient.set('/2_websockets_embedded_sanity/' + test_id + '/testsubscribe/data/delete_us/1', {
        property1: 'property1',
        property2: 'property2',
        property3: 'property3'
      }, {
        noPublish: true
      }, function (e, result) {

        if (e) return callback(e);

        //We put the data we want to delete into the database
        publisherclient.set('/2_websockets_embedded_sanity/' + test_id + '/testsubscribe/data/delete_us/2', {
          property1: 'property1',
          property2: 'property2',
          property3: 'property3'
        }, {
          noPublish: true
        }, function (e, result) {

          if (e) return callback(e);

          //We perform the actual delete
          publisherclient.remove('/2_websockets_embedded_sanity/' + test_id + '/testsubscribe/data/delete_us/*', {
            noPublish: true
          }, function (e, result) {

            expect(e).to.be(null);

            expect(result._meta.status).to.be('ok');

            expect(result.removed).to.be(2);

            callback();
          });
        });

      });

    } catch (e) {
      callback(e);
    }
  });

  it('the publisher should set new data then update the data', function (callback) {


    try {
      var test_path_end = require('shortid').generate();

      publisherclient.set('2_websockets_embedded_sanity/' + test_id + '/testsubscribe/data/' + test_path_end, {
        property1: 'property1',
        property2: 'property2',
        property3: 'property3'
      }, {
        noPublish: true
      }, function (e, insertResult) {

        expect(e).to.be(null);

        publisherclient.set('2_websockets_embedded_sanity/' + test_id + '/testsubscribe/data/' + test_path_end, {
          property1: 'property1',
          property2: 'property2',
          property3: 'property3',
          property4: 'property4'
        }, {
          noPublish: true
        }, function (e, updateResult) {

          expect(e).to.be(null);
          expect(updateResult._meta.id == insertResult._meta.id).to.be(true);
          callback();

        });

      });

    } catch (e) {
      callback(e);
    }
  });

  it('should unsubscribe from a specific event', function (done) {

    var emitted = {};

    var reference1;
    var reference2;

    var response1;
    var response2;

    var path = '/2_websockets_embedded_sanity/' + test_id + '/testsubscribe/data/on_off_specific_test';

    listenerclient.on(path, {
      event_type: 'set',
      count: 0
    }, function (message) {

      if (!emitted[reference1]) emitted[reference1] = [];
      emitted[reference1].push(message);

    }, function (e, eventReference) {

      reference1 = eventReference;

      return listenerclient.on(path, {
        event_type: 'set',
        count: 0
      }, function (message) {

        if (!emitted[reference2]) emitted[reference2] = [];
        emitted[reference2].push(message);

      }, function (e, eventReference) {

        reference2 = eventReference;

        listenerclient.set(path, {test: 'data1'})
          .then(function (response) {
            response1 = response;
            return listenerclient.set(path, {test: 'data2'});
          }).then(function (response) {
          response2 = response;
          return listenerclient.off(reference2);
        }).then(function () {
          return listenerclient.set(path, {test: 'data3'});
        }).then(function () {

          expect(emitted[reference1].length).to.be(3);
          expect(emitted[reference2].length).to.be(2);

          done();
        }).catch(done);

      });
    });
  });


  it('should tag some test data', function (callback) {

    var randomTag = require('shortid').generate();

    publisherclient.set('/2_websockets_embedded_sanity/' + test_id + '/test/tag', {
      property1: 'property1',
      property2: 'property2',
      property3: 'property3'
    }, {
      noPublish: true
    }, function (e, result) {

      ////////////////////console.log('did set');
      ////////////////////console.log([e, result]);

      if (e) return callback(e);

      publisherclient.set('/2_websockets_embedded_sanity/' + test_id + '/test/tag', null, {
        tag: randomTag,
        merge: true,
        noPublish: true
      }, function (e, result) {

        //console.log(e);

        if (e) return callback(e);

        ////////////////////console.log('merge tag results');
        ////////////////////console.log(e);
        ////////////////////console.log(result);

        expect(result.data.property1).to.be('property1');
        expect(result.data.property2).to.be('property2');
        expect(result.data.property3).to.be('property3');

        publisherclient.get('/_TAGS/2_websockets_embedded_sanity/' + test_id + '/test/tag/*', null, function (e, results) {

          expect(e).to.be(null);

          expect(results.length > 0).to.be(true);

          var found = false;

          results.map(function (tagged) {

            if (found) return;

            if (tagged._meta.tag == randomTag) {

              expect(tagged.data.property1).to.be('property1');
              expect(tagged.data.property2).to.be('property2');
              expect(tagged.data.property3).to.be('property3');
              found = true;
            }

          });

          if (!found)
            callback('couldn\'t find the tag snapshot');
          else
            callback();

        });
      });
    });
  });


  //	We set the listener client to listen for a PUT event according to a path, then we set a value with the publisher client.

  it('the listener should pick up a single published event', function (callback) {

    try {

      //first listen for the change
      listenerclient.on('/2_websockets_embedded_sanity/' + test_id + '/testsubscribe/data/event', {
        event_type: 'set',
        count: 1
      }, function (message) {

        expect(listenerclient.events['/SET@/2_websockets_embedded_sanity/' + test_id + '/testsubscribe/data/event'].length).to.be(0);
        callback();

      }, function (e) {

        if (!e) {

          expect(listenerclient.events['/SET@/2_websockets_embedded_sanity/' + test_id + '/testsubscribe/data/event'].length).to.be(1);
          //////////////////console.log('on subscribed, about to publish');

          //then make the change
          publisherclient.set('/2_websockets_embedded_sanity/' + test_id + '/testsubscribe/data/event', {
            property1: 'property1',
            property2: 'property2',
            property3: 'property3'
          }, null, function (e, result) {
            ////////////////////////////console.log('put happened - listening for result');
          });
        } else
          callback(e);
      });

    } catch (e) {
      callback(e);
    }
  });


  //We are testing setting data at a specific path

  it('the publisher should set new data ', function (callback) {


    try {
      var test_path_end = require('shortid').generate();

      publisherclient.set('2_websockets_embedded_sanity/' + test_id + '/testsubscribe/data/' + test_path_end, {
        property1: 'property1',
        property2: 'property2',
        property3: 'property3'
      }, null, function (e, result) {

        if (!e) {
          publisherclient.get('2_websockets_embedded_sanity/' + test_id + '/testsubscribe/data/' + test_path_end, null, function (e, results) {
            ////////////////////////console.log('new data results');
            ////////////////////////console.log(results);
            expect(results.property1 == 'property1').to.be(true);

            if (mode != 'embedded')
              expect(results.payload[0].created == results.payload[0].modified).to.be(true);

            callback(e);
          });
        } else
          callback(e);
      });

    } catch (e) {
      callback(e);
    }
  });


  it('the publisher should set new data then update the data', function (callback) {


    try {
      var test_path_end = require('shortid').generate();

      publisherclient.set('2_websockets_embedded_sanity/' + test_id + '/testsubscribe/data/' + test_path_end, {
        property1: 'property1',
        property2: 'property2',
        property3: 'property3'
      }, null, function (e, insertResult) {

        expect(e == null).to.be(true);

        publisherclient.set('2_websockets_embedded_sanity/' + test_id + '/testsubscribe/data/' + test_path_end, {
          property1: 'property1',
          property2: 'property2',
          property3: 'property3',
          property4: 'property4'
        }, null, function (e, updateResult) {

          expect(e == null).to.be(true);
          expect(updateResult._meta._id == insertResult._meta._id).to.be(true);
          callback();

        });

      });

    } catch (e) {
      callback(e);
    }
  });


  //We are testing pushing a specific value to a path which will actually become an array in the database

  it('the publisher should push a sibling and get all siblings', function (callback) {


    try {

      var test_path_end = require('shortid').generate();

      publisherclient.setSibling('2_websockets_embedded_sanity/' + test_id + '/siblings/' + test_path_end, {
        property1: 'sib_post_property1',
        property2: 'sib_post_property2'
      }, function (e, results) {

        expect(e == null).to.be(true);

        publisherclient.setSibling('2_websockets_embedded_sanity/' + test_id + '/siblings/' + test_path_end, {
          property1: 'sib_post_property1',
          property2: 'sib_post_property2'
        }, function (e, results) {

          expect(e == null).to.be(true);

          //the child method returns a child in the collection with a specified id
          publisherclient.get('2_websockets_embedded_sanity/' + test_id + '/siblings/' + test_path_end + '/*', null, function (e, getresults) {
            expect(e == null).to.be(true);
            expect(getresults.length == 2).to.be(true);
            callback(e);
          });
        });
      });

    } catch (e) {
      callback(e);
    }
  });


  //	We set the listener client to listen for a PUT event according to a path, then we set a value with the publisher client.

  it('the listener should pick up a single published event', function (callback) {


    try {

      //first listen for the change
      listenerclient.on('/2_websockets_embedded_sanity/' + test_id + '/testsubscribe/data/event', {
        event_type: 'set',
        count: 1
      }, function (message) {

        expect(listenerclient.events['/SET@/2_websockets_embedded_sanity/' + test_id + '/testsubscribe/data/event'].length).to.be(0);
        callback();

      }, function (e) {

        if (!e) {

          expect(listenerclient.events['/SET@/2_websockets_embedded_sanity/' + test_id + '/testsubscribe/data/event'].length).to.be(1);

          ////////////////////////////console.log('on subscribed, about to publish');

          //then make the change
          publisherclient.set('/2_websockets_embedded_sanity/' + test_id + '/testsubscribe/data/event', {
            property1: 'property1',
            property2: 'property2',
            property3: 'property3'
          }, null, function (e, result) {
            ////////////////////////////console.log('put happened - listening for result');
          });
        } else
          callback(e);
      });

    } catch (e) {
      callback(e);
    }
  });


  it('should get using a wildcard', function (callback) {

    var test_path_end = require('shortid').generate();

    publisherclient.set('2_websockets_embedded_sanity/' + test_id + '/testwildcard/' + test_path_end, {
      property1: 'property1',
      property2: 'property2',
      property3: 'property3'
    }, null, function (e, insertResult) {
      expect(e == null).to.be(true);
      publisherclient.set('2_websockets_embedded_sanity/' + test_id + '/testwildcard/' + test_path_end + '/1', {
        property1: 'property1',
        property2: 'property2',
        property3: 'property3'
      }, null, function (e, insertResult) {
        expect(e == null).to.be(true);

        publisherclient.get('2_websockets_embedded_sanity/' + test_id + '/testwildcard/' + test_path_end + '*', null, function (e, results) {

          if (e) return callback();

          expect(results.length == 2).to.be(true);
          callback(e);

        });
      });
    });
  });

  it('should get paths', function (callback) {

    var test_path_end = require('shortid').generate();

    publisherclient.set('2_websockets_embedded_sanity/' + test_id + '/testwildcard/' + test_path_end, {
      property1: 'property1',
      property2: 'property2',
      property3: 'property3'
    }, null, function (e, insertResult) {
      expect(e == null).to.be(true);
      publisherclient.set('2_websockets_embedded_sanity/' + test_id + '/testwildcard/' + test_path_end + '/1', {
        property1: 'property1',
        property2: 'property2',
        property3: 'property3'
      }, null, function (e, insertResult) {
        expect(e == null).to.be(true);

        publisherclient.getPaths('2_websockets_embedded_sanity/' + test_id + '/testwildcard/' + test_path_end + '*', function (e, results) {

          expect(results.length == 2).to.be(true);
          callback(e);

        });

      });
    });
  });

  it('the listener should pick up a single delete event', function (callback) {



    //We put the data we want to delete into the database
    publisherclient.set('/2_websockets_embedded_sanity/' + test_id + '/testsubscribe/data/delete_me', {
      property1: 'property1',
      property2: 'property2',
      property3: 'property3'
    }, null, function (e, result) {

      //////////////////console.log('did delete set');
      //path, event_type, count, handler, done
      //We listen for the DELETE event
      listenerclient.on('/2_websockets_embedded_sanity/' + test_id + '/testsubscribe/data/delete_me', {
        event_type: 'remove',
        count: 1
      }, function (eventData) {

        ////console.log('on count 1 delete ');
        //////////////////console.log(message);

        //we are looking at the event internals on the listener to ensure our event management is working - because we are only listening for 1
        //instance of this event - the event listener should have been removed
        ////console.log('listenerclient.events');
        ////console.log(listenerclient.events);
        expect(listenerclient.events['/REMOVE@/2_websockets_embedded_sanity/' + test_id + '/testsubscribe/data/delete_me'].length).to.be(0);

        ////console.log(eventData);

        //we needed to have removed a single item
        expect(eventData.payload.removed).to.be(1);

        ////////////////////////////console.log(message);

        callback();

      }, function (e) {

        //console.log(e);

        ////////////console.log('ON HAS HAPPENED: ' + e);

        if (!e) return callback(e);

        ////console.log('listenerclient.events, pre');
        ////console.log(listenerclient.events);
        expect(listenerclient.events['/REMOVE@/2_websockets_embedded_sanity/' + test_id + '/testsubscribe/data/delete_me'].length).to.be(1);

        //////////////////console.log('subscribed, about to delete');

        //We perform the actual delete
        publisherclient.remove('/2_websockets_embedded_sanity/' + test_id + '/testsubscribe/data/delete_me', null, function (e, result) {


          //////////////////console.log('REMOVE HAPPENED!!!');
          //////////////////console.log(e);
          //////////////////console.log(result);


          ////////////////////////////console.log('put happened - listening for result');
        });


      });
    });

  });

  it('should unsubscribe from an event', function (callback) {

    var currentListenerId;

    listenerclient.on('/2_websockets_embedded_sanity/' + test_id + '/testsubscribe/data/on_off_test', {
      event_type: 'set',
      count: 0
    }, function (message) {

      //we detach all listeners from the path here
      ////console.log('ABOUT OFF PATH');
      listenerclient.offPath('/2_websockets_embedded_sanity/' + test_id + '/testsubscribe/data/on_off_test', function (e) {

        if (e)
          return callback(new Error(e));

        listenerclient.on('/2_websockets_embedded_sanity/' + test_id + '/testsubscribe/data/on_off_test', {
            event_type: 'set',
            count: 0
          },
          function (message) {

            ////console.log('ON RAN');
            ////console.log(message);

            listenerclient.off(currentListenerId, function (e) {

              if (e)
                return callback(new Error(e));
              else
                return callback();

            });

          },
          function (e, listenerId) {
            if (e) return callback(new Error(e));

            currentListenerId = listenerId;

            publisherclient.set('/2_websockets_embedded_sanity/' + test_id + '/testsubscribe/data/on_off_test', {
              property1: 'property1',
              property2: 'property2',
              property3: 'property3'
            }, {}, function (e, setresult) {
              if (e) return callback(new Error(e));

              ////console.log('DID ON SET');
              ////console.log(setresult);
            });

          });

      });

    }, function (e, listenerId) {
      if (e) return callback(new Error(e));

      currentListenerId = listenerId;

      publisherclient.set('/2_websockets_embedded_sanity/' + test_id + '/testsubscribe/data/on_off_test', {
        property1: 'property1',
        property2: 'property2',
        property3: 'property3'
      }, {}, function (e, setresult) {
        if (e) return callback(new Error(e));
      });
    });
  });

  it('should subscribe to the catch all notification', function (callback) {

    var caught = {};

    this.timeout(10000);
    var caughtCount = 0;

    listenerclient.onAll(function (eventData, meta) {

      if (meta.action == '/REMOVE@/2_websockets_embedded_sanity/' + test_id + '/testsubscribe/data/catch_all' ||
        meta.action == '/SET@/2_websockets_embedded_sanity/' + test_id + '/testsubscribe/data/catch_all')
        caughtCount++;

      if (caughtCount == 2)
        callback();

    }, function (e) {

      if (e) return callback(e);

      publisherclient.set('/2_websockets_embedded_sanity/' + test_id + '/testsubscribe/data/catch_all', {
        property1: 'property1',
        property2: 'property2',
        property3: 'property3'
      }, null, function (e, put_result) {

        publisherclient.remove('/2_websockets_embedded_sanity/' + test_id + '/testsubscribe/data/catch_all', null, function (e, del_result) {


        });

      });

    });

  });

  it('should unsubscribe from all events', function (callback) {
    this.timeout(10000);

    var onHappened = false;

    listenerclient.onAll(function (message) {

      onHappened = true;
      callback(new Error('this wasnt meant to happen'));

    }, function (e) {

      if (e) return callback(e);

      listenerclient.on('/2_websockets_embedded_sanity/' + test_id + '/testsubscribe/data/off_all_test', {
          event_type: 'set',
          count: 0
        },
        function (message) {
          onHappened = true;
          callback(new Error('this wasnt meant to happen'));
        },
        function (e) {
          if (e) return callback(e);

          listenerclient.offAll(function (e) {
            if (e) return callback(e);

            publisherclient.set('/2_websockets_embedded_sanity/' + test_id + '/testsubscribe/data/off_all_test', {
              property1: 'property1',
              property2: 'property2',
              property3: 'property3'
            }, null, function (e, put_result) {
              if (e) return callback(e);

              setTimeout(function () {

                if (!onHappened)
                  callback();

              }, 3000);
            });
          });
        }
      );
    });
  });

  it('will do events in the order they are passed', function (done) {
    publisherclient.set('/test_event_order', {
      property1: 'property1Value'
    }, {}, function () {
      publisherclient.log.info('Done setting');
    });
    publisherclient.remove('/test_event_order', function (err) {
      publisherclient.log.info('Done removing');
      setTimeout(function () {
        publisherclient.get('/test_event_order', null, function (e, result) {
          expect(result).to.be(null);
          done();
        });
      }, 1000);
    });
  });

  it('should search for a complex object with a data property', function (callback) {

    this.timeout(10000);

    var test_path_end = require('shortid').generate();

    var complex_obj = {
      data: {
        regions: ['North', 'South'],
        towns: ['North.Cape Town'],
        categories: ['Action', 'History'],
        subcategories: ['Action.angling', 'History.art'],
        keywords: ['bass', 'Penny Siopis'],
        field1: 'field1',
        timestamp: Date.now()
      }
    };

    var from = Date.now() - 1000;
    var to;

    publisherclient.set('/2_websockets_embedded_sanity/' + test_id + '/testsubscribe/data/complex/' + test_path_end, complex_obj, null, function (e, put_result) {

      expect(e == null).to.be(true);

      setTimeout(function () {

        to = Date.now() + 1000;

        var criteria = {
          "data.data.timestamp": {
            $gte: from,
            $lte: to
          }
        };

        var options = {
          fields: null,
          sort: {
            "data.data.field1": 1
          },
          limit: 2
        };

        ////////////console.log('searching');
        publisherclient.get('/2_websockets_embedded_sanity/' + test_id + '/testsubscribe/data/complex*', {
          criteria: criteria,
          options: options
        }, function (e, search_result) {

          if (e) return callback(e);

          if (search_result.length == 0) {

            callback(new Error('no items found in the date range'));

          } else callback();

        });
      }, 500);
    });
  });

  it('should search for a complex object with a data property, using _data', function (callback) {

    this.timeout(10000);

    var test_path_end = require('shortid').generate();

    var complex_obj = {
      data: {
        regions: ['North', 'South'],
        towns: ['North.Cape Town'],
        categories: ['Action', 'History'],
        subcategories: ['Action.angling', 'History.art'],
        keywords: ['bass', 'Penny Siopis'],
        field1: 'field1',
        timestamp: Date.now()
      }
    };

    var from = Date.now() - 1000;
    var to;

    publisherclient.set('/2_websockets_embedded_sanity/' + test_id + '/testsubscribe/data/complex/' + test_path_end, complex_obj, null, function (e, put_result) {

      expect(e == null).to.be(true);

      setTimeout(function () {

        to = Date.now() + 1000;

        var criteria = {
          "_data.data.timestamp": {
            $gte: from,
            $lte: to
          }
        };

        var options = {
          fields: null,
          sort: {
            "_data.data.field1": 1
          },
          limit: 2
        };

        ////////////console.log('searching');
        publisherclient.get('/2_websockets_embedded_sanity/' + test_id + '/testsubscribe/data/complex*', {
          criteria: criteria,
          options: options
        }, function (e, search_result) {

          if (e) return callback(e);

          if (search_result.length == 0) {

            callback(new Error('no items found in the date range'));

          } else callback();

        });
      }, 500);
    });
  });

  it('subscribes with a count - we ensure the event only gets kicked off for the correct amounts - negative test', function (callback) {

    var hits = 0;
    //first listen for the change
    listenerclient.on('/2_websockets_embedded_sanity/' + test_id + '/count/2/*', {
      event_type: 'set',
      count: 3
    }, function (message) {
      hits++;
    }, function (e) {

      if (e) return callback(e);

      publisherclient.set('/2_websockets_embedded_sanity/' + test_id + '/count/2/1', {
        property1: 'property1',
        property2: 'property2',
        property3: 'property3'
      });

      publisherclient.set('/2_websockets_embedded_sanity/' + test_id + '/count/2/2', {
        property1: 'property1',
        property2: 'property2',
        property3: 'property3'
      });

      publisherclient.set('/2_websockets_embedded_sanity/' + test_id + '/count/2/2', {
        property1: 'property1',
        property2: 'property2',
        property3: 'property3'
      });

      setTimeout(function () {

        if (hits != 3) return callback(new Error('hits were over the agreed on 2'));

        callback();

      }, 1500);
    });
  });

  it('subscribe, then does an off with a bad handle', function (done) {

    var hits = 0;
    var currentEventId;
    //first listen for the change
    listenerclient.on('/2_websockets_embedded_sanity/' + test_id + '/off-handle/2/*', {
      event_type: 'set'
    }, function (message) {
      hits++;
    }, function (e, eventId) {

      if (e) return callback(e);

      currentEventId = eventId;

      publisherclient.set('/2_websockets_embedded_sanity/' + test_id + '/off-handle/2/1', {
        property1: 'property1',
        property2: 'property2',
        property3: 'property3'
      });

      publisherclient.set('/2_websockets_embedded_sanity/' + test_id + '/off-handle/2/2', {
        property1: 'property1',
        property2: 'property2',
        property3: 'property3'
      });

      publisherclient.set('/2_websockets_embedded_sanity/' + test_id + '/off-handle/2/2', {
        property1: 'property1',
        property2: 'property2',
        property3: 'property3'
      });

      setTimeout(function () {

        publisherclient.off('/2_websockets_embedded_sanity/*', function(e){

          expect(e.toString()).to.be('Error: handle must be a number');

          publisherclient.off(null, function(e){

            expect(e.toString()).to.be('Error: handle cannot be null');

            publisherclient.off(currentEventId, done);

          });
        });
      }, 1500);
    });
  });

  it('increments a value on a path', function (done) {

    var async = require('async');

    var test_string = require('shortid').generate();
    var test_base_url = '/increment/' + test_id + '/' + test_string;

    async.timesSeries(10, function (time, timeCB) {

      publisherclient.set(test_base_url, 'counter', {increment: 1, noPublish: true}, function (e, result) {

        timeCB(e);
      });

    }, function (e) {

      if (e) return done(e);

      listenerclient.get(test_base_url, function (e, result) {

        if (e) return done(e);

        expect(result.counter.value).to.be(10);

        done();
      });
    });
  });

  it('increments a value on a path, convenience method, listens on path receives event', function (done) {

    var test_string = require('shortid').generate();
    var test_base_url = '/increment/convenience/' + test_id + '/' + test_string;

    listenerclient.on(test_base_url, function (data) {

      expect(data.value).to.be(1);
      expect(data.gauge).to.be('counter');

      done();

    }, function (e) {

      if (e) return done(e);

      publisherclient.increment(test_base_url, 1, function (e) {

        if (e) return done(e);
      });
    });
  });
});
