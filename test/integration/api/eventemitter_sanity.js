let test = require('../../__fixtures/utils/test_helper').create();
describe(test.testName(__filename, 3), function() {
  var happn = require('../../../lib/index');
  var service = happn.service;
  var async = require('async');
  var mode = 'embedded';
  var happnInstance = null;
  var test_id;

  this.timeout(120000);
  var config = {};

  before('should initialize the service', function(callback) {
    test_id = Date.now() + '_' + require('shortid').generate();
    service.create(config, function(e, happnInst) {
      if (e) return callback(e);

      happnInstance = happnInst;
      callback();
    });
  });

  after(function(done) {
    happnInstance.stop({}, done);
  });

  var publisherclient;
  var listenerclient;

  /*
   We are initializing 2 clients to test saving data against the database, one client will push data into the
   database whilst another listens for changes.
   */
  before('should initialize the clients', function(callback) {
    try {
      happnInstance.services.session.localClient(function(e, instance) {
        if (e) return callback(e);
        publisherclient = instance;

        happnInstance.services.session.localClient(function(e, instance) {
          if (e) return callback(e);
          listenerclient = instance;

          callback();
        });
      });
    } catch (e) {
      callback(e);
    }
  });

  it('the publisher should set new data', async () => {
    const path = `1_eventemitter_embedded_sanity/${test_id}/testsubscribe/data/${test.shortid()}`;
    const result = await publisherclient.set(
      path,
      {
        property1: 'property1',
        property2: 'property2',
        property3: 'property3'
      },
      {
        noPublish: true
      }
    );
    const retrieved = await publisherclient.get(path);
    test.expect(retrieved.property1 === 'property1').to.be(true);
    test.expect(retrieved._meta.created).to.be.greaterThan(0);
    test.expect(retrieved._meta.created === result._meta.modified).to.be(true);
  });

  it('the listener should pick up a single wildcard event', async () => {
    const setPath = `1_eventemitter_embedded_sanity/${test_id}/testsubscribe/data/event/${test.shortid()}`;
    const onPath = `1_eventemitter_embedded_sanity/${test_id}/testsubscribe/data/event/*`;
    const eventData = [];
    await listenerclient.on(
      onPath,
      {
        event_type: 'set',
        count: 1
      },
      (data, meta) => {
        eventData.push({ data, meta });
      }
    );
    await publisherclient.set(setPath, {
      property1: 'property1',
      property2: 'property2',
      property3: 'property3'
    });
    await test.delay(2000);
    test.expect(eventData[0].data.property1).to.be('property1');
    test.expect(eventData[0].meta.path).to.be(setPath);
  });

  it('the listener should pick up a single wildcard event, event type not specified', async () => {
    const setPath = `1_eventemitter_embedded_sanity/${test_id}/testsubscribe/data/event/${test.shortid()}`;
    const onPath = `1_eventemitter_embedded_sanity/${test_id}/testsubscribe/data/event/*`;
    const eventData = [];
    await listenerclient.on(onPath, (data, meta) => {
      eventData.push({ data, meta });
    });
    await publisherclient.set(setPath, {
      property1: 'property1',
      property2: 'property2',
      property3: 'property3'
    });
    await test.delay(2000);
    test.expect(eventData[0].data.property1).to.be('property1');
    test.expect(eventData[0].meta.path).to.be(setPath);
  });

  it('the uses the onPublished event handler', function(callback) {
    let basePath = `/1_eventemitter_embedded_sanity/${test_id}/testsubscribe/data/onPublished`;
    let onPath = `${basePath}/*`;
    let setPath = `${basePath}/${test.shortid()}`;
    listenerclient
      .on(onPath, {
        onPublished: function(message, meta) {
          test.expect(message.property1).to.be('property1');
          test.expect(meta.created <= Date.now()).to.be(true);
          callback();
        }
      })
      .then(function(eventId) {
        test.expect(eventId >= 0).to.be(true);
        test.expect(listenerclient.state.events[`/ALL@${onPath}`].length).to.be(1);
        publisherclient.set(
          setPath,
          {
            property1: 'property1',
            property2: 'property2',
            property3: 'property3'
          },
          null,
          function(e) {
            if (e) return callback(e);
          }
        );
      })
      .catch(callback);
  });

  it('the publisher should get null for unfound data, exact path', function(callback) {
    publisherclient.get(`${test.shortid()}`, null, function(e, results) {
      test.expect(e).to.be(null);
      test.expect(results).to.be(null);
      callback(e);
    });
  });

  it('the publisher should get [] for unfound data, wildcard path', async () => {
    const results = await publisherclient.get(`${test.shortid()}.generate()/*`);
    test.expect(results.length).to.be(0);
  });

  it('set_multiple, the publisher should set multiple data items, then do a wildcard get to return them', function(callback) {
    const timesCount = 10;
    const testBasePath = `/1_eventemitter_embedded_sanity/${test.shortid()}/set_multiple`;
    async.times(
      timesCount,
      function(count, timesCallback) {
        publisherclient.set(
          `${testBasePath}/${test.shortid()}`,
          {
            property1: 'property1',
            property2: 'property2',
            property3: 'property3',
            count
          },
          {
            noPublish: true
          },
          timesCallback
        );
      },
      function(e) {
        if (e) return callback(e);
        listenerclient.get(testBasePath + '/' + '*', null, function(e, results) {
          if (e) return callback(e);
          test.expect(results.length).to.be(timesCount);
          results.every(function(result) {
            test.expect(result.property1).to.be('property1');
            test.expect(result._meta.path.indexOf(testBasePath) === 0).to.be(true);
            return true;
          });
          callback();
        });
      }
    );
  });

  it('should set data, and then merge a new document into the data without overwriting old fields', function(callback) {
    const testPath = `/1_eventemitter_embedded_sanity/${test_id}/testsubscribe/data/merge/${test.shortid()}`;

    publisherclient.set(
      testPath,
      {
        property1: 'property1',
        property2: 'property2',
        property3: 'property3',
        property5: 'property5'
      },
      null,
      function(e) {
        if (e) return callback(e);

        publisherclient.set(
          testPath,
          {
            property4: 'property4',
            property5: 'property5-new'
          },
          {
            merge: true
          },
          function(e) {
            if (e) return callback(e);

            publisherclient.get(testPath, null, function(e, results) {
              if (e) return callback(e);

              test.expect(results.property4).to.be('property4');
              test.expect(results.property5).to.be('property5-new');
              test.expect(results.property1).to.be('property1');

              callback();
            });
          }
        );
      }
    );
  });

  it('should set data, and then merge a new document into the data without mutating the input object', function(callback) {
    try {
      const testPath = `/1_eventemitter_embedded_sanity/${test_id}/testsubscribe/data/merge/${test.shortid()}`;
      publisherclient.set(
        testPath,
        {
          property1: 'property1',
          property2: 'property2',
          property3: 'property3'
        },
        null,
        function(e) {
          if (e) return callback(e);
          var mergeObject = { data: { property4: 'property4' } };
          publisherclient.set(
            testPath,
            mergeObject.data,
            {
              merge: true
            },
            function(e) {
              if (e) return callback(e);
              test.expect(mergeObject.data).to.eql({ property4: 'property4' });
              callback();
            }
          );
        }
      );
    } catch (e) {
      callback(e);
    }
  });

  it('should contain the same payload between 2 non-merging consecutive stores', function(done) {
    var object = {
      param1: 10,
      param2: 20
    };
    var firstTimeNonMergeConsecutive;

    listenerclient.on(
      'setTest/nonMergeConsecutive',
      {
        event_type: 'set',
        count: 2
      },
      function(message) {
        if (firstTimeNonMergeConsecutive === undefined) {
          firstTimeNonMergeConsecutive = message;
        } else {
          test.expect(message).to.eql(firstTimeNonMergeConsecutive);
          done();
        }
      },
      function(err) {
        if (err) return done(err);
        publisherclient.set('setTest/nonMergeConsecutive', object, {}, function(err) {
          test.expect(err).to.not.be.ok();
          publisherclient.set('setTest/nonMergeConsecutive', object, {}, function(err) {
            test.expect(err).to.not.be.ok();
          });
        });
      }
    );
  });

  it('should contain the same payload between a merge and a normal store for first store', function(done) {
    this.timeout(5000);

    var object = {
      param1: 10,
      param2: 20
    };

    var firstTime = true;

    listenerclient.on(
      'mergeTest/object',
      {
        event_type: 'set',
        count: 2
      },
      function(message) {
        if (firstTime) {
          firstTime = false;
          return;
        }

        setTimeout(() => {
          test.expect(message).to.eql(object);
          done();
        }, 2000);
      },
      function(err) {
        test.expect(err).to.not.be.ok();
        publisherclient.set(
          'mergeTest/object',
          object,
          {
            merge: true
          },
          function(err) {
            test.expect(err).to.not.be.ok();
            publisherclient.set(
              'mergeTest/object',
              object,
              {
                merge: true
              },
              function(err) {
                test.expect(err).to.not.be.ok();
              }
            );
          }
        );
      }
    );
  });

  it('should search for a complex object', async () => {
    var complex_obj = {
      regions: ['North', 'South'],
      towns: ['North.Cape Town'],
      categories: ['Action', 'History'],
      subcategories: ['Action.angling', 'History.art'],
      keywords: ['bass', 'Penny Siopis'],
      field1: 'field1'
    };

    var criteria1 = {
      $or: [
        {
          regions: {
            $containsAny: ['North', 'South', 'East', 'West']
          }
        },
        {
          towns: {
            $containsAny: ['North.Cape Town', 'South.East London']
          }
        },
        {
          categories: {
            $containsAny: ['Action', 'History']
          }
        }
      ],
      keywords: {
        $containsAny: ['bass', 'Penny Siopis']
      },
      field1: { $in: ['field1'] }
    };

    var options1 = {
      sort: {
        field1: 1
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
        field1: 1
      },
      limit: 2
    };

    const basePath = `complex/search`;
    const testPath1 = `${basePath}/${test.shortid()}`;
    const testPath2 = `${basePath}/${test.shortid()}`;

    await publisherclient.set(testPath1, complex_obj);
    await publisherclient.set(testPath2, complex_obj);

    const result1 = await publisherclient.get('complex/search/*', {
      criteria: criteria1,
      options: options1
    });

    const result2 = await publisherclient.get('complex/search/*', {
      criteria: criteria2,
      options: options2
    });

    test.expect(result1.length === 1).to.be(true);
    test.expect(result2.length === 2).to.be(true);
  });

  it('should search for a complex object - $or in more detail', function(callback) {
    const count = 100;

    async.timesSeries(
      count,
      (time, timeCb) => {
        let path = `/1_eventemitter_embedded_sanity/${test_id}/testsubscribe/data/detail-or/${time}/${Date.now()}`;
        publisherclient.set(
          path,
          {
            time: time
          },
          null,
          timeCb
        );
      },
      e => {
        if (e) return callback(e);

        const criteria = {
          $or: [
            {
              '_meta.path': {
                $regex: '.*detail-or/10/.*'
              }
            },
            {
              '_meta.path': {
                $regex: '.*detail-or/20/.*'
              }
            },
            {
              '_meta.path': {
                $regex: '.*detail-or/30/.*'
              }
            },
            {
              '_meta.path': {
                $regex: '.*detail-or/40/.*'
              }
            }
          ]
        };

        const options = {
          sort: {
            field1: 1
          },
          limit: 10
        };

        listenerclient.get(
          `/1_eventemitter_embedded_sanity/${test_id}/testsubscribe/data/detail-or/*`,
          {
            criteria,
            options
          },
          function(e, search_result) {
            if (e) return callback(e);
            test.expect(search_result.length).to.be(4);
            callback(e);
          }
        );
      }
    );
  });

  it('should search for a complex object - $or in more detail - not $regex', function(callback) {
    const count = 100;

    async.timesSeries(
      count,
      (time, timeCb) => {
        let path = `/1_eventemitter_embedded_sanity/${test_id}/testsubscribe/data/detail-or-no-regex/${time}/${Date.now()}`;
        publisherclient.set(
          path,
          {
            time: time
          },
          null,
          timeCb
        );
      },
      e => {
        if (e) return callback(e);

        const criteria = {
          $or: [
            {
              time: 10
            },
            {
              time: 20
            },
            {
              time: 30
            },
            {
              time: 40
            }
          ]
        };

        const options = {
          sort: {
            field1: 1
          },
          limit: 10
        };

        listenerclient.get(
          `/1_eventemitter_embedded_sanity/${test_id}/testsubscribe/data/detail-or-no-regex/*`,
          {
            criteria,
            options
          },
          function(e, search_result) {
            if (e) return callback(e);
            test.expect(search_result.length).to.be(4);
            callback(e);
          }
        );
      }
    );
  });

  it('should search for a complex object by dates', function(callback) {
    var test_path_end = require('shortid').generate();

    var complex_obj = {
      regions: ['North', 'South'],
      towns: ['North.Cape Town'],
      categories: ['Action', 'History'],
      subcategories: ['Action.angling', 'History.art'],
      keywords: ['bass', 'Penny Siopis'],
      field1: 'field1'
    };

    var from = Date.now();
    var to;

    publisherclient.set(
      '/1_eventemitter_embedded_sanity/' + test_id + '/testsubscribe/data/complex/' + test_path_end,
      complex_obj,
      null,
      function(e) {
        test.expect(e == null).to.be(true);

        setTimeout(function() {
          to = Date.now();

          var criteria = {
            '_meta.created': {
              $gte: from,
              $lte: to
            }
          };

          var options = {
            fields: null,
            sort: {
              field1: 1
            },
            limit: 2
          };

          ////////////console.log('searching');
          publisherclient.get(
            '/1_eventemitter_embedded_sanity/' + test_id + '/testsubscribe/data/complex*',
            {
              criteria: criteria,
              options: options
            },
            function(e, search_result) {
              test.expect(e == null).to.be(true);

              if (search_result.length === 0) {
                publisherclient.get(
                  '/1_eventemitter_embedded_sanity/' +
                    test_id +
                    '/testsubscribe/data/complex/' +
                    test_path_end,
                  function() {
                    callback(new Error('no items found in the date range'));
                  }
                );
              } else {
                publisherclient.get(
                  '/1_eventemitter_embedded_sanity/' +
                    test_id +
                    '/testsubscribe/data/complex/' +
                    test_path_end,
                  function() {
                    callback();
                  }
                );
              }
            }
          );
        }, 300);
      }
    );
  });

  it('should remove a single item', async () => {
    const basePath = `/1_eventemitter_embedded_sanity/${test_id}/remove/single`;
    const findPath = `${basePath}/*`;
    const removePath = `${basePath}/1`;
    await publisherclient.set(
      removePath,
      {
        please: 'remove me'
      },
      {
        noPublish: true
      }
    );

    test.expect((await listenerclient.get(findPath)).length).to.be(1);

    const result = await publisherclient.remove(removePath, {
      noPublish: true
    });

    test.expect(result._meta.status).to.be('ok');
    test.expect(result.removed).to.be(1);
    test.expect((await listenerclient.get(findPath)).length).to.be(0);
  });

  it('should remove multiple items', async () => {
    const basePath = `/1_eventemitter_embedded_sanity/${test_id}/remove/multiple`;
    const removePath = `${basePath}/*`;
    await publisherclient.set(
      `${basePath}/1`,
      {
        please: 'remove me'
      },
      {
        noPublish: true
      }
    );
    await publisherclient.set(
      `${basePath}/2`,
      {
        please: 'remove me too'
      },
      {
        noPublish: true
      }
    );

    test.expect((await listenerclient.get(removePath)).length).to.be(2);

    const result = await publisherclient.remove(removePath, {
      noPublish: true
    });

    test.expect(result._meta.status).to.be('ok');
    test.expect(result.removed).to.be(2);
    test.expect((await listenerclient.get(removePath)).length).to.be(0);
  });

  it('the publisher should set new data then update the data', function(callback) {
    try {
      var test_path_end = require('shortid').generate();

      publisherclient.set(
        '1_eventemitter_embedded_sanity/' + test_id + '/testsubscribe/data/' + test_path_end,
        {
          property1: 'property1',
          property2: 'property2',
          property3: 'property3'
        },
        {
          noPublish: true
        },
        function(e, insertResult) {
          test.expect(e).to.be(null);

          publisherclient.set(
            '1_eventemitter_embedded_sanity/' + test_id + '/testsubscribe/data/' + test_path_end,
            {
              property1: 'property1',
              property2: 'property2',
              property3: 'property3',
              property4: 'property4'
            },
            {
              noPublish: true
            },
            function(e, updateResult) {
              test.expect(e).to.be(null);
              test.expect(updateResult._meta.id === insertResult._meta.id).to.be(true);
              callback();
            }
          );
        }
      );
    } catch (e) {
      callback(e);
    }
  });

  it('the listener should pick up a single published event', function(callback) {
    try {
      listenerclient.on(
        '/1_eventemitter_embedded_sanity/' + test_id + '/testsubscribe/data/event',
        {
          event_type: 'set',
          count: 1
        },
        function() {
          setTimeout(function() {
            test
              .expect(
                listenerclient.state.events[
                  '/SET@/1_eventemitter_embedded_sanity/' + test_id + '/testsubscribe/data/event'
                ]
              )
              .to.be(undefined);
            callback();
          }, 2000);
        },
        function(e) {
          if (!e) {
            test
              .expect(
                listenerclient.state.events[
                  '/SET@/1_eventemitter_embedded_sanity/' + test_id + '/testsubscribe/data/event'
                ].length
              )
              .to.be(1);
            publisherclient.set(
              '/1_eventemitter_embedded_sanity/' + test_id + '/testsubscribe/data/event',
              {
                property1: 'property1',
                property2: 'property2',
                property3: 'property3'
              },
              null,
              function() {
                // do nothing
              }
            );
          } else callback(e);
        }
      );
    } catch (e) {
      callback(e);
    }
  });

  it('the publisher should set new data ', function(callback) {
    try {
      var test_path_end = require('shortid').generate();

      publisherclient.set(
        '1_eventemitter_embedded_sanity/' + test_id + '/testsubscribe/data/' + test_path_end,
        {
          property1: 'property1',
          property2: 'property2',
          property3: 'property3'
        },
        null,
        function(e) {
          if (!e) {
            publisherclient.get(
              '1_eventemitter_embedded_sanity/' + test_id + '/testsubscribe/data/' + test_path_end,
              null,
              function(e, results) {
                test.expect(results.property1 === 'property1').to.be(true);

                if (mode !== 'embedded')
                  test
                    .expect(results.payload[0].created === results.payload[0].modified)
                    .to.be(true);

                callback(e);
              }
            );
          } else callback(e);
        }
      );
    } catch (e) {
      callback(e);
    }
  });

  it('the publisher should set new data then update the data', function(callback) {
    try {
      var test_path_end = require('shortid').generate();

      publisherclient.set(
        '1_eventemitter_embedded_sanity/' + test_id + '/testsubscribe/data/' + test_path_end,
        {
          property1: 'property1',
          property2: 'property2',
          property3: 'property3'
        },
        null,
        function(e, insertResult) {
          test.expect(e == null).to.be(true);

          publisherclient.set(
            '1_eventemitter_embedded_sanity/' + test_id + '/testsubscribe/data/' + test_path_end,
            {
              property1: 'property1',
              property2: 'property2',
              property3: 'property3',
              property4: 'property4'
            },
            null,
            function(e, updateResult) {
              test.expect(e == null).to.be(true);
              test.expect(updateResult._meta._id === insertResult._meta._id).to.be(true);
              callback();
            }
          );
        }
      );
    } catch (e) {
      callback(e);
    }
  });

  it('the listener should pick up a single published event', function(callback) {
    try {
      //first listen for the change
      listenerclient.on(
        '/1_eventemitter_embedded_sanity/' + test_id + '/testsubscribe/data/event',
        {
          event_type: 'set',
          count: 1
        },
        function() {
          setTimeout(function() {
            test
              .expect(
                listenerclient.state.events[
                  '/SET@/1_eventemitter_embedded_sanity/' + test_id + '/testsubscribe/data/event'
                ]
              )
              .to.be(undefined);
            callback();
          }, 2000);
        },
        function(e) {
          if (!e) {
            test
              .expect(
                listenerclient.state.events[
                  '/SET@/1_eventemitter_embedded_sanity/' + test_id + '/testsubscribe/data/event'
                ].length
              )
              .to.be(1);
            //then make the change
            publisherclient.set(
              '/1_eventemitter_embedded_sanity/' + test_id + '/testsubscribe/data/event',
              {
                property1: 'property1',
                property2: 'property2',
                property3: 'property3'
              },
              null,
              function() {
                // do nothing
              }
            );
          } else callback(e);
        }
      );
    } catch (e) {
      callback(e);
    }
  });

  it('should get using a wildcard', function(callback) {
    var test_path_end = require('shortid').generate();

    publisherclient.set(
      '1_eventemitter_embedded_sanity/' + test_id + '/testwildcard/' + test_path_end,
      {
        property1: 'property1',
        property2: 'property2',
        property3: 'property3'
      },
      null,
      function(e) {
        test.expect(e == null).to.be(true);
        publisherclient.set(
          '1_eventemitter_embedded_sanity/' + test_id + '/testwildcard/' + test_path_end + '/1',
          {
            property1: 'property1',
            property2: 'property2',
            property3: 'property3'
          },
          null,
          function(e) {
            test.expect(e == null).to.be(true);
            publisherclient.get(
              '1_eventemitter_embedded_sanity/' + test_id + '/testwildcard/' + test_path_end + '*',
              null,
              function(e, results) {
                if (e) return callback();
                test.expect(results.length === 2).to.be(true);
                callback(e);
              }
            );
          }
        );
      }
    );
  });

  it('should get paths', function(callback) {
    var test_path_end = require('shortid').generate();

    publisherclient.set(
      '1_eventemitter_embedded_sanity/' + test_id + '/testwildcard/' + test_path_end,
      {
        property1: 'property1',
        property2: 'property2',
        property3: 'property3'
      },
      null,
      function(e) {
        test.expect(e == null).to.be(true);
        publisherclient.set(
          '1_eventemitter_embedded_sanity/' + test_id + '/testwildcard/' + test_path_end + '/1',
          {
            property1: 'property1',
            property2: 'property2',
            property3: 'property3'
          },
          null,
          function(e) {
            test.expect(e == null).to.be(true);

            publisherclient.getPaths(
              '1_eventemitter_embedded_sanity/' + test_id + '/testwildcard/' + test_path_end + '*',
              function(e, results) {
                test.expect(results.length === 2).to.be(true);
                callback(e);
              }
            );
          }
        );
      }
    );
  });

  it('the listener should pick up a single delete event', function(callback) {
    publisherclient.set(
      '/1_eventemitter_embedded_sanity/' + test_id + '/testsubscribe/data/delete_me',
      {
        property1: 'property1',
        property2: 'property2',
        property3: 'property3'
      },
      null,
      function() {
        listenerclient.on(
          '/1_eventemitter_embedded_sanity/' + test_id + '/testsubscribe/data/delete_me',
          {
            event_type: 'remove',
            count: 1
          },
          function(eventData) {
            test
              .expect(
                listenerclient.state.events[
                  '/REMOVE@/1_eventemitter_embedded_sanity/' +
                    test_id +
                    '/testsubscribe/data/delete_me'
                ]
              )
              .to.be(undefined);
            test.expect(eventData.payload.removed).to.be(1);
            callback();
          },
          function(e) {
            if (!e) return callback(e);

            test
              .expect(
                listenerclient.state.events[
                  '/REMOVE@/1_eventemitter_embedded_sanity/' +
                    test_id +
                    '/testsubscribe/data/delete_me'
                ].length
              )
              .to.be(1);

            //We perform the actual delete
            publisherclient.remove(
              '/1_eventemitter_embedded_sanity/' + test_id + '/testsubscribe/data/delete_me',
              null,
              function() {
                //do nothing
              }
            );
          }
        );
      }
    );
  });

  it('should unsubscribe from an event', function(callback) {
    var currentListenerId;

    listenerclient.on(
      '/1_eventemitter_embedded_sanity/' + test_id + '/testsubscribe/data/on_off_test',
      {
        event_type: 'set',
        count: 0
      },
      function() {
        listenerclient.offPath(
          '/1_eventemitter_embedded_sanity/' + test_id + '/testsubscribe/data/on_off_test',
          function(e) {
            if (e) return callback(new Error(e));

            listenerclient.on(
              '/1_eventemitter_embedded_sanity/' + test_id + '/testsubscribe/data/on_off_test',
              {
                event_type: 'set',
                count: 0
              },
              function() {
                listenerclient.off(currentListenerId, function(e) {
                  if (e) return callback(new Error(e));
                  else return callback();
                });
              },
              function(e, listenerId) {
                if (e) return callback(new Error(e));

                currentListenerId = listenerId;

                publisherclient.set(
                  '/1_eventemitter_embedded_sanity/' + test_id + '/testsubscribe/data/on_off_test',
                  {
                    property1: 'property1',
                    property2: 'property2',
                    property3: 'property3'
                  },
                  {},
                  function(e) {
                    if (e) return callback(new Error(e));
                  }
                );
              }
            );
          }
        );
      },
      function(e, listenerId) {
        if (e) return callback(new Error(e));

        currentListenerId = listenerId;

        publisherclient.set(
          '/1_eventemitter_embedded_sanity/' + test_id + '/testsubscribe/data/on_off_test',
          {
            property1: 'property1',
            property2: 'property2',
            property3: 'property3'
          },
          {},
          function(e) {
            if (e) return callback(new Error(e));
          }
        );
      }
    );
  });

  it('should subscribe to the catch all notification', async () => {
    this.timeout(10000);
    let caughtCount = 0;
    const testPath = `/${test.shortid()}/catch_all`;
    await listenerclient.onAll(function(_eventData, meta) {
      if (meta.action === `/REMOVE@${testPath}` || meta.action === `/SET@${testPath}`) {
        caughtCount++;
      }
    });
    await publisherclient.set(testPath, {
      please: 'remove me'
    });
    test.expect(await listenerclient.get(testPath)).to.not.be(null);
    await publisherclient.remove(testPath);
    await test.delay(2000);
    test.expect(caughtCount).to.be(2);
  });

  it('should unsubscribe from all events', function(callback) {
    this.timeout(10000);

    var onHappened = false;

    listenerclient.onAll(
      function() {
        onHappened = true;
        callback(new Error('this wasnt meant to happen'));
      },
      function(e) {
        if (e) return callback(e);

        listenerclient.on(
          '/1_eventemitter_embedded_sanity/' + test_id + '/testsubscribe/data/off_all_test',
          {
            event_type: 'set',
            count: 0
          },
          function() {
            onHappened = true;
            callback(new Error('this wasnt meant to happen'));
          },
          function(e) {
            if (e) return callback(e);

            listenerclient.offAll(function(e) {
              if (e) return callback(e);

              publisherclient.set(
                '/1_eventemitter_embedded_sanity/' + test_id + '/testsubscribe/data/off_all_test',
                {
                  property1: 'property1',
                  property2: 'property2',
                  property3: 'property3'
                },
                null,
                function(e) {
                  if (e) return callback(e);

                  setTimeout(function() {
                    if (!onHappened) callback();
                  }, 3000);
                }
              );
            });
          }
        );
      }
    );
  });

  it('should not publish with noPublish set', function(done) {
    var timeout;
    //first listen for the change
    listenerclient.on(
      '/1_eventemitter_embedded_sanity/' + test_id + '/testNoPublish',
      {
        event_type: 'set',
        count: 1
      },
      function(message) {
        clearTimeout(timeout);
        setImmediate(function() {
          test.expect(message).to.not.be.ok();
        });
      },
      function(e) {
        test.expect(e).to.not.be.ok();

        timeout = setTimeout(function() {
          listenerclient.offPath(
            '/1_eventemitter_embedded_sanity/' + test_id + '/testNoPublish',
            function() {
              done();
            }
          );
        }, 1000);
        publisherclient.set(
          '/1_eventemitter_embedded_sanity/' + test_id + '/testNoPublish',
          {
            property1: 'property1',
            property2: 'property2',
            property3: 'property3'
          },
          {
            noPublish: true
          },
          function(e) {
            test.expect(e).to.not.be.ok();
          }
        );
      }
    );
  });

  it('will do events in the order they are passed', function(done) {
    publisherclient.set(
      '/test_event_order',
      {
        property1: 'property1Value'
      },
      {},
      function() {
        publisherclient.log.info('Done setting');
      }
    );
    publisherclient.remove('/test_event_order', function() {
      publisherclient.log.info('Done removing');
      setTimeout(function() {
        publisherclient.get('/test_event_order', null, function(e, result) {
          test.expect(result).to.be(null);
          done();
        });
      }, 1000);
    });
  });

  it('should search for a complex object with a data property', async () => {
    this.timeout(10000);
    let basePath = `${test.shortid()}/complex/with/data`;
    let path = `${basePath}/1`;
    let searchPath = `${basePath}/*`;

    const complex_obj = {
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

    let from = Date.now() - 1000;
    let to;

    await publisherclient.set(path, complex_obj);

    to = Date.now() + 1000;

    let criteria = {
      'data.data.timestamp': {
        $gte: from,
        $lte: to
      }
    };

    let options = {
      fields: null,
      sort: {
        'data.data.field1': 1
      },
      limit: 2
    };
    let results = await publisherclient.get(searchPath, {
      criteria: criteria,
      options: options
    });
    test.expect(results.length).to.be(1);
  });

  it('should search for a complex object with a data property, using _data', function(callback) {
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

    publisherclient.set(
      '/1_eventemitter_embedded_sanity/' + test_id + '/testsubscribe/data/complex/' + test_path_end,
      complex_obj,
      null,
      function(e) {
        test.expect(e == null).to.be(true);

        setTimeout(function() {
          to = Date.now() + 1000;

          var criteria = {
            '_data.data.timestamp': {
              $gte: from,
              $lte: to
            }
          };

          var options = {
            fields: null,
            sort: {
              '_data.data.field1': 1
            },
            limit: 2
          };
          publisherclient.get(
            '/1_eventemitter_embedded_sanity/' + test_id + '/testsubscribe/data/complex*',
            {
              criteria: criteria,
              options: options
            },
            function(e, search_result) {
              if (e) return callback(e);

              if (search_result.length === 0) {
                callback(new Error('no items found in the date range'));
              } else callback();
            }
          );
        }, 500);
      }
    );
  });

  it('subscribes with a count - we ensure the event only gets kicked off for the correct amounts', function(callback) {
    var hits = 0;
    listenerclient.on(
      '/1_eventemitter_embedded_sanity/' + test_id + '/count/2/*',
      {
        event_type: 'set',
        count: 2
      },
      function() {
        hits++;
      },
      function(e) {
        if (e) return callback(e);

        publisherclient.set('/1_eventemitter_embedded_sanity/' + test_id + '/count/2/1', {
          property1: 'property1',
          property2: 'property2',
          property3: 'property3'
        });

        publisherclient.set('/1_eventemitter_embedded_sanity/' + test_id + '/count/2/2', {
          property1: 'property1',
          property2: 'property2',
          property3: 'property3'
        });

        publisherclient.set('/1_eventemitter_embedded_sanity/' + test_id + '/count/2/2', {
          property1: 'property1',
          property2: 'property2',
          property3: 'property3'
        });

        setTimeout(function() {
          if (hits !== 2) return callback(new Error('hits were over the agreed on 2'));
          callback();
        }, 1500);
      }
    );
  });

  it('should unsubscribe from a specific event', function(done) {
    var emitted = {};

    var reference1;
    var reference2;

    var path =
      '/2_websockets_embedded_sanity/' + test_id + '/testsubscribe/data/on_off_specific_test';

    listenerclient.on(
      path,
      {
        event_type: 'set',
        count: 0
      },
      function(message) {
        if (!emitted[reference1]) emitted[reference1] = [];
        emitted[reference1].push(message);
      },
      function(e, eventReference) {
        reference1 = eventReference;

        return listenerclient.on(
          path,
          {
            event_type: 'set',
            count: 0
          },
          function(message) {
            if (!emitted[reference2]) emitted[reference2] = [];
            emitted[reference2].push(message);
          },
          function(e, eventReference) {
            reference2 = eventReference;

            listenerclient
              .set(path, {
                test: 'data1'
              })
              .then(function() {
                return listenerclient.set(path, {
                  test: 'data2'
                });
              })
              .then(function() {
                return listenerclient.off(reference2);
              })
              .then(function() {
                return listenerclient.set(path, {
                  test: 'data3'
                });
              })
              .then(function() {
                test.expect(emitted[reference1].length).to.be(3);
                test.expect(emitted[reference2].length).to.be(2);
                done();
              })
              .catch(done);
          }
        );
      }
    );
  });

  it('subscribes with a count - we ensure the event only gets kicked off for the correct amounts - negative test', function(callback) {
    var hits = 0;
    //first listen for the change
    listenerclient.on(
      '/1_eventemitter_embedded_sanity/' + test_id + '/count/2/*',
      {
        event_type: 'set',
        count: 3
      },
      function() {
        hits++;
      },
      function(e) {
        if (e) return callback(e);

        publisherclient.set('/1_eventemitter_embedded_sanity/' + test_id + '/count/2/1', {
          property1: 'property1',
          property2: 'property2',
          property3: 'property3'
        });

        publisherclient.set('/1_eventemitter_embedded_sanity/' + test_id + '/count/2/2', {
          property1: 'property1',
          property2: 'property2',
          property3: 'property3'
        });

        publisherclient.set('/1_eventemitter_embedded_sanity/' + test_id + '/count/2/2', {
          property1: 'property1',
          property2: 'property2',
          property3: 'property3'
        });

        setTimeout(function() {
          if (hits < 3) return callback(new Error('hits were under the agreed on 3'));
          if (hits > 3) return callback(new Error('hits were under the agreed on 3'));

          callback();
        }, 1500);
      }
    );
  });

  it('subscribe, then does an off with a bad handle', function(done) {
    var currentEventId;
    listenerclient.on(
      '/1_eventemitter_embedded_sanity/' + test_id + '/off-handle/2/*',
      {
        event_type: 'set'
      },
      function() {
        //do nothing
      },
      function(e, eventId) {
        if (e) return done(e);

        currentEventId = eventId;

        publisherclient.set('/1_eventemitter_embedded_sanity/' + test_id + '/off-handle/2/1', {
          property1: 'property1',
          property2: 'property2',
          property3: 'property3'
        });

        publisherclient.set('/1_eventemitter_embedded_sanity/' + test_id + '/off-handle/2/2', {
          property1: 'property1',
          property2: 'property2',
          property3: 'property3'
        });

        publisherclient.set('/1_eventemitter_embedded_sanity/' + test_id + '/off-handle/2/2', {
          property1: 'property1',
          property2: 'property2',
          property3: 'property3'
        });

        setTimeout(function() {
          publisherclient.off('/1_eventemitter_embedded_sanity/*', function(e) {
            test.expect(e.toString()).to.be('Error: handle must be a number');
            publisherclient.off(null, function(e) {
              test.expect(e.toString()).to.be('Error: handle cannot be null');
              publisherclient.off(currentEventId, done);
            });
          });
        }, 1500);
      }
    );
  });

  it('fails to set data with a wildcard', function(done) {
    publisherclient.set(
      '/1_eventemitter_embedded_sanity/' + test_id + '/off-handle/2/*',
      {
        property1: 'property1',
        property2: 'property2',
        property3: 'property3'
      },
      function(e) {
        test
          .expect(e.toString())
          .to.be(
            "Error: Bad path, if the action is 'set' the path cannot contain the * wildcard character"
          );
        done();
      }
    );
  });

  it('fails to set data with a wildcard, fails on server', function(done) {
    publisherclient.__oldUtils = publisherclient.utils;

    publisherclient.utils = {
      checkPath: function() {}
    };

    publisherclient.set(
      '/1_eventemitter_embedded_sanity/' + test_id + '/off-handle/2/*',
      {
        property1: 'property1',
        property2: 'property2',
        property3: 'property3'
      },
      function(e) {
        test
          .expect(e.toString())
          .to.be(
            "Error: Bad path, if the action is 'set' the path cannot contain the * wildcard character"
          );

        //set back in case there are follow on tests
        publisherclient.utils = publisherclient.__oldUtils;

        done();
      }
    );
  });

  it('fails to set data with a wildcard, again - check utils reset worked', function(done) {
    publisherclient.set(
      '/1_eventemitter_embedded_sanity/' + test_id + '/off-handle/2/*',
      {
        property1: 'property1',
        property2: 'property2',
        property3: 'property3'
      },
      function(e) {
        test
          .expect(e.toString())
          .to.be(
            "Error: Bad path, if the action is 'set' the path cannot contain the * wildcard character"
          );

        done();
      }
    );
  });

  it('increments a value on a path', function(done) {
    var async = require('async');

    var test_string = require('shortid').generate();
    var test_base_url = '/increment/' + test_id + '/' + test_string;

    async.timesSeries(
      10,
      function(time, timeCB) {
        publisherclient.set(
          test_base_url,
          'counter',
          {
            increment: 1,
            noPublish: true
          },
          function(e) {
            timeCB(e);
          }
        );
      },
      function(e) {
        if (e) return done(e);
        listenerclient.get(test_base_url, function(e, result) {
          if (e) return done(e);
          test.expect(result.counter.value).to.be(10);
          done();
        });
      }
    );
  });

  it('increments a value on a path, multiple gauges', function(done) {
    var async = require('async');

    var test_string = require('shortid').generate();
    var test_base_url = '/increment/' + test_id + '/' + test_string;

    async.timesSeries(
      10,
      function(time, timeCB) {
        publisherclient.set(
          test_base_url,
          'counter-' + time,
          {
            increment: 1,
            noPublish: true
          },
          function(e) {
            timeCB(e);
          }
        );
      },
      function(e) {
        if (e) return done(e);

        listenerclient.get(test_base_url, function(e, result) {
          if (e) return done(e);

          test.expect(result['counter-0'].value).to.be(1);
          test.expect(result['counter-1'].value).to.be(1);
          test.expect(result['counter-2'].value).to.be(1);
          test.expect(result['counter-3'].value).to.be(1);
          test.expect(result['counter-4'].value).to.be(1);
          test.expect(result['counter-5'].value).to.be(1);
          test.expect(result['counter-6'].value).to.be(1);
          test.expect(result['counter-7'].value).to.be(1);
          test.expect(result['counter-8'].value).to.be(1);
          test.expect(result['counter-9'].value).to.be(1);

          done();
        });
      }
    );
  });

  it('increments a value on a path, convenience method, multiple gauges', function(done) {
    var async = require('async');

    var test_string = require('shortid').generate();
    var test_base_url = '/increment/' + test_id + '/' + test_string;

    async.timesSeries(
      10,
      function(time, timeCB) {
        publisherclient.increment(test_base_url, 'counter-' + time, 1, function(e) {
          timeCB(e);
        });
      },
      function(e) {
        if (e) return done(e);

        listenerclient.get(test_base_url, function(e, result) {
          if (e) return done(e);

          test.expect(result['counter-0'].value).to.be(1);
          test.expect(result['counter-1'].value).to.be(1);
          test.expect(result['counter-2'].value).to.be(1);
          test.expect(result['counter-3'].value).to.be(1);
          test.expect(result['counter-4'].value).to.be(1);
          test.expect(result['counter-5'].value).to.be(1);
          test.expect(result['counter-6'].value).to.be(1);
          test.expect(result['counter-7'].value).to.be(1);
          test.expect(result['counter-8'].value).to.be(1);
          test.expect(result['counter-9'].value).to.be(1);

          done();
        });
      }
    );
  });

  it('increments a value on a path, convenience method, listens on path receives event', function(done) {
    var test_string = require('shortid').generate();
    var test_base_url = '/increment/convenience/' + test_id + '/' + test_string;

    listenerclient.on(
      test_base_url,
      function(data) {
        test.expect(data.value).to.be(1);
        test.expect(data.gauge).to.be('counter');

        done();
      },
      function(e) {
        if (e) return done(e);

        publisherclient.increment(test_base_url, 1, function(e, incResult) {
          test.expect(incResult.value).to.be(1);
          test.expect(incResult.gauge).to.be('counter');

          if (e) return done(e);
        });
      }
    );
  });

  it('increments a value on a path, convenience method with custom gauge and increment, listens on path receives event', function(done) {
    var test_string = require('shortid').generate();
    var test_base_url = '/increment/convenience/' + test_id + '/' + test_string;

    listenerclient.on(
      test_base_url,
      function(data) {
        test.expect(data.value).to.be(3);
        test.expect(data.gauge).to.be('custom');

        done();
      },
      function(e) {
        if (e) return done(e);

        publisherclient.increment(test_base_url, 'custom', 3, function(e) {
          if (e) return done(e);
        });
      }
    );
  });

  it('increments and decrements a value on a path, convenience method with custom gauge and increment and decrement, listens on path receives event', function(done) {
    var test_string = require('shortid').generate();
    var test_base_url = '/increment/convenience/' + test_id + '/' + test_string;

    var incrementCount = 0;

    listenerclient.on(
      test_base_url,
      function(data) {
        incrementCount++;

        if (incrementCount === 1) {
          test.expect(data.value).to.be(3);
          test.expect(data.gauge).to.be('custom');
        }

        if (incrementCount === 2) {
          test.expect(data.value).to.be(1);
          test.expect(data.gauge).to.be('custom');
          done();
        }
      },
      function(e) {
        if (e) return done(e);

        publisherclient.increment(test_base_url, 'custom', 3, function(e) {
          if (e) return done(e);

          publisherclient.increment(test_base_url, 'custom', -2, function(e) {
            if (e) return done(e);
          });
        });
      }
    );
  });

  it('increments a value on a path, convenience method, no counter so defaults to 1, listens on path receives event', function(done) {
    var test_string = require('shortid').generate();
    var test_base_url = '/increment/convenience/' + test_id + '/' + test_string;

    listenerclient.on(
      test_base_url,
      function(data) {
        test.expect(data.value).to.be(1);
        test.expect(data.gauge).to.be('counter');

        done();
      },
      function(e) {
        if (e) return done(e);

        publisherclient.increment(test_base_url, function(e) {
          if (e) return done(e);
        });
      }
    );
  });

  it('tests an aggregated search fails, due to unimplemented error', function(callback) {
    listenerclient.get(
      '/searches-and-aggregation/*',
      {
        criteria: {
          'data.group': {
            $eq: 'odd'
          }
        },
        aggregate: [
          {
            $group: {
              _id: '$data.custom',
              total: {
                $sum: '$data.id'
              }
            }
          }
        ]
      },
      function(e) {
        test
          .expect(e.toString())
          .to.be(
            'SystemError: aggregate feature not available for provider on path: /searches-and-aggregation/*'
          );
        callback();
      }
    );
  });

  it('tests a search with a case-insensitive collation fails, due to unimplemented error', function(callback) {
    listenerclient.get(
      '/searches-and-aggregation/*',
      {
        criteria: {
          'data.group': {
            $eq: 'odd'
          }
        },
        options: {
          collation: {
            locale: 'en_US',
            strength: 1
          }
        }
      },
      function(e) {
        test
          .expect(e.toString())
          .to.be(
            'SystemError: collation feature not available for provider on path: /searches-and-aggregation/*'
          );
        callback();
      }
    );
  });

  it('should publish and receive the published data, the publish response should be lean', function(callback) {
    listenerclient.on(
      '/2_websockets_embedded_sanity/' + test_id + '/testpublish/data/event/*',
      {
        event_type: 'set',
        count: 1
      },
      function(data) {
        test.expect(data).to.eql({
          property1: 'property1',
          property2: 'property2',
          property3: 'property3'
        });
        callback();
      },
      function(e) {
        if (e) return callback(e);
        publisherclient.publish(
          '/2_websockets_embedded_sanity/' + test_id + '/testpublish/data/event/1',
          {
            property1: 'property1',
            property2: 'property2',
            property3: 'property3'
          },
          function(e, result) {
            if (e) return callback(e);
            delete result._meta.eventId;
            delete result._meta.sessionId;
            test.expect(result).to.eql({
              _meta: {
                path: '/2_websockets_embedded_sanity/' + test_id + '/testpublish/data/event/1',
                type: 'response',
                status: 'ok',
                published: true
              }
            });
          }
        );
      }
    );
  });
});
