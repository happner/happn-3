const test = require('../../__fixtures/utils/test_helper').create();

test.describe(__filename, 120000, function() {
  let happnInstance = null;
  let publisherclient;
  let listenerclient;

  ['websockets', 'eventemitter'].forEach(clientType => {
    context(`client type: ${clientType}`, () => {
      before('should initialize the service', async () => {
        happnInstance = await test.createInstance();
        if (clientType === 'eventemitter') {
          publisherclient = await test.createAdminSession(happnInstance);
          listenerclient = await test.createAdminSession(happnInstance);
        } else {
          publisherclient = await test.createAdminWSSession(happnInstance);
          listenerclient = await test.createAdminWSSession(happnInstance);
        }
      });

      after(async () => {
        await publisherclient.disconnect();
        await listenerclient.disconnect();
        await test.destroyInstance(happnInstance);
      });

      const testId = test.shortid();
      var test_path = `/test/meta/${testId}`;
      var test_path_remove = `/test/meta/remove/${testId}`;
      var test_path_all = `/test/meta/all/${testId}`;
      var test_path_created_modified = `/test/meta/created_modified/${testId}`;
      var test_path_created_modified_notmerge = `/test/meta/created_modified_notmerge/${testId}`;
      var test_path_created_modified_update = `/test/meta/test_path_created_modified_update/${testId}`;
      var test_path_created_modified_update_notmerge = `/test/meta/test_path_created_modified_update_notmerge/${testId}`;

      it('tests the set meta data', function(callback) {
        try {
          //first listen for the change
          listenerclient.on(
            test_path,
            {
              event_type: 'set',
              count: 1
            },
            function(data, meta) {
              test.expect(meta.path).to.be(test_path);
              callback();
            },
            function(e) {
              if (!e) {
                test.expect(listenerclient.state.events['/SET@' + test_path].length).to.be(1);

                //then make the change
                publisherclient.set(
                  test_path,
                  {
                    property1: 'property1',
                    property2: 'property2',
                    property3: 'property3'
                  },
                  null,
                  function(e, result) {
                    if (e) return callback(e);
                    test.expect(result._meta.path).to.be(test_path);
                  }
                );
              } else callback(e);
            }
          );
        } catch (e) {
          callback(e);
        }
      });

      it('tests the update meta data', function(callback) {
        publisherclient.set(
          test_path,
          {
            property1: 'property1',
            property2: 'property2',
            property3: 'property3'
          },
          {},
          function(e, result) {
            if (e) return callback(e);

            test.expect(result._meta.path).to.be(test_path);

            callback();
          }
        );
      });

      it('tests the delete meta data', function(callback) {
        publisherclient.set(
          test_path_remove,
          {
            property1: 'property1',
            property2: 'property2',
            property3: 'property3'
          },
          {},
          function(e, result) {
            if (e) return callback(e);

            test.expect(result._meta.path).to.be(test_path_remove);

            listenerclient.on(
              test_path_remove,
              {
                event_type: 'remove',
                count: 1
              },
              function(data, meta) {
                test.expect(meta.path).to.be(test_path_remove);
                callback();
              },
              function(e) {
                if (e) return callback(e);

                publisherclient.remove(test_path_remove, {}, function(e, result) {
                  if (e) return callback(e);
                  test.expect(result._meta.path).to.be(test_path_remove);
                });
              }
            );
          }
        );
      });

      it('tests created and modified dates, merge', function(callback) {
        publisherclient.set(
          test_path_created_modified,
          {
            property1: 'property1',
            property2: 'property2',
            property3: 'property3'
          },
          {},
          function(e, result) {
            if (e) return callback(e);

            test.expect(result._meta.created).to.not.be(null);
            test.expect(result._meta.created).to.not.be(undefined);

            test.expect(result._meta.modified).to.not.be(null);
            test.expect(result._meta.modified).to.not.be(undefined);

            test.expect(result._meta.modified.toString()).to.be(result._meta.created.toString());

            setTimeout(function() {
              publisherclient.set(
                test_path_created_modified,
                {
                  property4: 'property4'
                },
                {
                  merge: true
                },
                function(e /*, result*/) {
                  if (e) return callback(e);

                  publisherclient.get(test_path_created_modified, function(e, result) {
                    test.expect(result._meta.modified > result._meta.created).to.be(true);
                    callback();
                  });
                }
              );
            }, 1000);
          }
        );
      });

      it('tests created and modified dates, not merge', function(callback) {
        publisherclient.set(
          test_path_created_modified_notmerge,
          {
            property1: 'property1',
            property2: 'property2',
            property3: 'property3'
          },
          {},
          function(e, result) {
            if (e) return callback(e);

            test.expect(result._meta.created).to.not.be(null);
            test.expect(result._meta.created).to.not.be(undefined);

            test.expect(result._meta.modified).to.not.be(null);
            test.expect(result._meta.modified).to.not.be(undefined);

            test.expect(result._meta.modified.toString()).to.be(result._meta.created.toString());

            setTimeout(function() {
              publisherclient.set(
                test_path_created_modified_notmerge,
                {
                  property4: 'property4'
                },
                {},
                function(e /*, result*/) {
                  if (e) return callback(e);

                  publisherclient.get(test_path_created_modified_notmerge, function(e, result) {
                    test.expect(result._meta.modified > result._meta.created).to.be(true);
                    callback();
                  });
                }
              );
            }, 1000);
          }
        );
      });

      it('tests created and modified dates for an update, merge', function(callback) {
        publisherclient.set(
          test_path_created_modified_update,
          {
            property1: 'property1',
            property2: 'property2',
            property3: 'property3'
          },
          {},
          function(e, result) {
            if (e) return callback(e);

            test.expect(result._meta.created).to.not.be(null);
            test.expect(result._meta.created).to.not.be(undefined);

            test.expect(result._meta.modified).to.not.be(null);
            test.expect(result._meta.modified).to.not.be(undefined);

            test.expect(result._meta.path).to.not.be(null);
            test.expect(result._meta.path).to.not.be(undefined);

            test.expect(result._meta.modified.toString()).to.be(result._meta.created.toString());

            var firstCreated = result._meta.created;

            setTimeout(function() {
              publisherclient.set(
                test_path_created_modified_update,
                {
                  property4: 'property4'
                },
                {
                  merge: true
                },
                function(e, result) {
                  if (e) return callback(e);

                  test.expect(result._meta.created.toString()).to.be(firstCreated.toString());

                  test.expect(result._meta.created).to.not.be(null);
                  test.expect(result._meta.created).to.not.be(undefined);

                  test.expect(result._meta.modified).to.not.be(null);
                  test.expect(result._meta.modified).to.not.be(undefined);

                  test.expect(result._meta.path).to.not.be(null);
                  test.expect(result._meta.path).to.not.be(undefined);

                  publisherclient.get(test_path_created_modified_update, function(e, result) {
                    test.expect(result._meta.created).to.not.be(null);
                    test.expect(result._meta.created).to.not.be(undefined);

                    test.expect(result._meta.modified).to.not.be(null);
                    test.expect(result._meta.modified).to.not.be(undefined);

                    test.expect(result._meta.path).to.not.be(null);
                    test.expect(result._meta.path).to.not.be(undefined);

                    test.expect(result._meta.modified > result._meta.created).to.be(true);
                    callback();
                  });
                }
              );
            }, 1000);
          }
        );
      });

      it('tests created and modified dates for an update, not merge', function(callback) {
        publisherclient.set(
          test_path_created_modified_update_notmerge,
          {
            property1: 'property1',
            property2: 'property2',
            property3: 'property3'
          },
          {},
          function(e, result) {
            if (e) return callback(e);

            test.expect(result._meta.created).to.not.be(null);
            test.expect(result._meta.created).to.not.be(undefined);

            test.expect(result._meta.modified).to.not.be(null);
            test.expect(result._meta.modified).to.not.be(undefined);

            test.expect(result._meta.path).to.not.be(null);
            test.expect(result._meta.path).to.not.be(undefined);

            var firstCreated = result._meta.created;

            test.expect(result._meta.modified.toString()).to.be(result._meta.created.toString());

            setTimeout(function() {
              publisherclient.set(
                test_path_created_modified_update_notmerge,
                {
                  property4: 'property4'
                },
                {},
                function(e, updateResult) {
                  if (e) return callback(e);

                  test.expect(updateResult._meta.created).to.not.be(null);
                  test.expect(updateResult._meta.created).to.not.be(undefined);

                  test.expect(updateResult._meta.modified).to.not.be(null);
                  test.expect(updateResult._meta.modified).to.not.be(undefined);

                  test.expect(updateResult._meta.path).to.not.be(null);
                  test.expect(updateResult._meta.path).to.not.be(undefined);

                  test.expect(updateResult._meta.created.toString()).to.be(firstCreated.toString());

                  publisherclient.get(test_path_created_modified_update_notmerge, function(
                    e,
                    result
                  ) {
                    test.expect(result._meta.created).to.not.be(null);
                    test.expect(result._meta.created).to.not.be(undefined);

                    test.expect(result._meta.modified).to.not.be(null);
                    test.expect(result._meta.modified).to.not.be(undefined);

                    test.expect(result._meta.path).to.not.be(null);
                    test.expect(result._meta.path).to.not.be(undefined);

                    test.expect(result._meta.modified > result._meta.created).to.be(true);
                    callback();
                  });
                }
              );
            }, 1000);
          }
        );
      });

      it('searches by timestamps', async () => {
        this.timeout(5000);
        const itemIndexes = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
        const windowStart = Date.now();
        const testPath = test.shortid();

        const insertMultiple = new Promise((resolve, reject) => {
          test.async.eachSeries(
            itemIndexes,
            function(index, eachCallback) {
              publisherclient.set(
                `${testPath}/${index}`,
                {
                  property4: 'property4',
                  ind: index
                },
                () => {
                  setTimeout(eachCallback, 10);
                }
              );
            },
            function(e) {
              if (e) return reject(e);
              resolve();
            }
          );
        });

        await insertMultiple;
        const windowEnd = Date.now();
        await publisherclient.set(`${testPath}/10`, {
          property4: 'property4',
          ind: 10
        });

        let items = await publisherclient.get(`${testPath}/*`, {
          criteria: {
            $and: [
              {
                '_meta.created': {
                  $gte: windowStart
                }
              },
              {
                '_meta.created': {
                  $lt: windowEnd
                }
              }
            ]
          }
        });
        test.expect(items.length === 10).to.be(true);

        items = await publisherclient.get(`${testPath}/*`, {
          criteria: {
            '_meta.created': {
              $gte: windowEnd
            }
          }
        });

        test.expect(items.length === 1).to.be(true);
        test.expect(items[0].ind).to.be(10);
      });

      it('searches by timestamps - getCreatedBetween convenience method', async () => {
        this.timeout(5000);
        const itemIndexes = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
        const windowStart = Date.now();
        const testPath = test.shortid();

        const insertMultiple = new Promise((resolve, reject) => {
          test.async.eachSeries(
            itemIndexes,
            function(index, eachCallback) {
              publisherclient.set(
                `${testPath}/${index}`,
                {
                  property4: 'property4',
                  ind: index
                },
                () => {
                  setTimeout(eachCallback, 10);
                }
              );
            },
            function(e) {
              if (e) return reject(e);
              resolve();
            }
          );
        });

        await insertMultiple;
        const windowEnd = Date.now();
        await test.delay(10);
        await publisherclient.set(`${testPath}/10`, {
          property4: 'property4',
          ind: 10
        });

        let items = await publisherclient.getCreatedBetween(
          `${testPath}/*`,
          windowStart,
          windowEnd
        );
        test.expect(items.length).to.be(10);

        items = await publisherclient.get(`${testPath}/*`, {
          criteria: {
            '_meta.created': {
              $gte: windowEnd
            }
          }
        });

        test.expect(items.length === 1).to.be(true);
        test.expect(items[0].ind).to.be(10);

        let errorMessages = [];
        try {
          await publisherclient.getCreatedBetween(`${testPath}/*`, windowStart, 'blah');
        } catch (e) {
          errorMessages.push(e.message);
        }
        try {
          await publisherclient.getCreatedBetween(`${testPath}/*`, 'blah', windowEnd);
        } catch (e) {
          errorMessages.push(e.message);
        }
        try {
          await publisherclient.getCreatedBetween(`${testPath}/*`, windowStart, null);
        } catch (e) {
          errorMessages.push(e.message);
        }
        test
          .expect(errorMessages)
          .to.eql([
            'to is null or not a timestamp',
            'from is null or not a timestamp',
            'handler is null or not a function'
          ]);
      });

      it('tests the all meta data', function(callback) {
        try {
          //first listen for the change
          listenerclient.onAll(
            function(_data, meta) {
              test.expect(meta.path).to.be(test_path_all);
              test.expect(meta.channel).to.be('/ALL@*');
              listenerclient.offAll(callback);
            },
            function(e) {
              if (e) return callback(e);

              //then make the change
              publisherclient.set(
                test_path_all,
                {
                  property1: 'property1',
                  property2: 'property2',
                  property3: 'property3'
                },
                null,
                function(e, result) {
                  if (e) return callback(e);

                  test.expect(result._meta.path).to.be(test_path_all);
                }
              );
            }
          );
        } catch (e) {
          callback(e);
        }
      });
    });
  });
});
