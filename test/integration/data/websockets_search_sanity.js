describe(
  require('../../__fixtures/utils/test_helper')
    .create()
    .testName(__filename, 3),
  function() {
    var happn = require('../../../lib/index');
    var serviceInstance;
    var searchClient;
    var expect = require('expect.js');
    var async = require('async');

    var getService = function(config, callback) {
      happn.service.create(config, callback);
    };

    before('it starts completely defaulted service', function(done) {
      getService({}, function(e, service) {
        if (e) return done(e);

        serviceInstance = service;
        done();
      });
    });

    after('should delete the temp data file', function(callback) {
      if (searchClient)
        searchClient.disconnect({
          reconnect: false
        });

      serviceInstance.stop(callback);
    });

    before('authenticates with the _ADMIN user, using the default password', function(done) {
      happn.client
        .create()

        .then(function(clientInstance) {
          searchClient = clientInstance;
          done();
        })

        .catch(function(e) {
          done(e);
        });
    });

    it('can get using criteria', function(done) {
      searchClient.set(
        'movie/war',
        {
          name: 'crimson tide',
          genre: 'war'
        },
        function(e, result) {
          if (e) return done(e);

          var options = {
            sort: {
              name: 1
            }
          };

          var criteria = {
            name: 'crimson tide'
          };

          searchClient.get(
            'movie/*',
            {
              criteria: criteria,
              options: options
            },
            function(e, result) {
              if (e) return done(e);

              expect(result.length).to.be(1);
              done();
            }
          );
        }
      );
    });

    it('can get using criteria, limit to fields', function(done) {
      searchClient.set(
        'movie/war/ww2',
        {
          name: 'crimson tide',
          genre: 'ww2'
        },
        function(e, result) {
          if (e) return done(e);

          var options = {
            fields: {
              name: 1
            }
          };

          var criteria = {
            genre: 'ww2'
          };

          searchClient.get(
            'movie/*',
            {
              criteria: criteria,
              options: options
            },
            function(e, result) {
              if (e) return done(e);

              expect(result[0].genre).to.be(undefined);
              expect(result[0].name).to.be('crimson tide');
              expect(result.length).to.be(1);

              done();
            }
          );
        }
      );
    });

    it('can get using criteria, $regex with params in array', function(done) {
      searchClient.set(
        '/regex/test/1',
        {
          name: 'Loadtest_123',
          anotherProp: 'anotherPropValue'
        },
        function(e, result) {
          if (e) return done(e);

          var options = {
            fields: {
              name: 1
            }
          };

          var criteria = {
            name: {
              $regex: ['.*loadtest.*', 'i']
            }
          };

          searchClient.get(
            '/regex/test/*',
            {
              criteria: criteria,
              options: options
            },
            function(e, result) {
              if (e) return done(e);
              expect(result[0].anotherProp).to.be(undefined);
              expect(result[0].name).to.be('Loadtest_123');
              expect(result.length).to.be(1);
              done();
            }
          );
        }
      );
    });

    it('can get using criteria, $regex as string', function(done) {
      searchClient.set(
        '/regex/test/1',
        {
          name: 'Loadtest_123',
          anotherProp: 'anotherPropValue'
        },
        function(e, result) {
          if (e) return done(e);

          var options = {
            fields: {
              name: 1
            }
          };

          var criteria = {
            name: {
              $regex: '.*Loadtest.*'
            }
          };

          searchClient.get(
            '/regex/test/*',
            {
              criteria: criteria,
              options: options
            },
            function(e, result) {
              if (e) return done(e);
              expect(result[0].anotherProp).to.be(undefined);
              expect(result[0].name).to.be('Loadtest_123');
              expect(result.length).to.be(1);
              done();
            }
          );
        }
      );
    });

    it('can get using criteria, bad $regex as boolean', function(done) {
      searchClient.set(
        '/regex/test/1',
        {
          name: 'Loadtest_123',
          anotherProp: 'anotherPropValue'
        },
        function(e, result) {
          if (e) return done(e);

          var options = {
            fields: {
              name: 1
            }
          };

          var criteria = {
            name: {
              $regex: false
            }
          };

          searchClient.get(
            '/regex/test/*',
            {
              criteria: criteria,
              options: options
            },
            function(e, result) {
              expect(e.toString()).to.be(
                'SystemError: $regex parameter value must be an Array or a string'
              );
              done();
            }
          );
        }
      );
    });

    it('can get the latest record, without _meta', function(done) {
      this.timeout(5000);

      var indexes = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

      async.eachSeries(
        indexes,
        function(index, eachCallback) {
          searchClient.set(
            'movie/family/' + index,
            {
              name: 'the black stallion',
              genre: 'family'
            },
            eachCallback
          );
        },
        function(e) {
          if (e) return callback(e);

          var options = {
            sort: {
              '_meta.created': -1
            },
            limit: 1
          };

          var criteria = {
            genre: 'family'
          };

          var latestResult;

          searchClient.get(
            'movie/*',
            {
              criteria: criteria,
              options: options
            },
            function(e, result) {
              if (e) return done(e);

              expect(result.length).to.be(1);

              latestResult = result[0];

              expect(latestResult._meta.created).to.not.be(null);
              expect(latestResult._meta.created).to.not.be(undefined);

              searchClient.get('movie/family/*', function(e, result) {
                if (e) return callback(e);

                for (var resultItemIndex in result) {
                  //if (resultItemIndex == '_meta') continue;

                  var resultItem = result[resultItemIndex];

                  expect(resultItem._meta.created).to.not.be(null);
                  expect(resultItem._meta.created).to.not.be(undefined);

                  if (
                    resultItem._meta.path != latestResult._meta.path &&
                    resultItem._meta.created > latestResult._meta.created
                  )
                    return done(new Error('the latest result is not the latest result...'));
                }
                done();
              });
            }
          );
        }
      );
    });

    it('can get the latest record', function(done) {
      this.timeout(5000);

      var indexes = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

      async.eachSeries(
        indexes,
        function(index, eachCallback) {
          searchClient.set(
            'movie/family/' + index,
            {
              name: 'the black stallion',
              genre: 'family'
            },
            eachCallback
          );
        },
        function(e) {
          if (e) return callback(e);

          var options = {
            sort: {
              '_meta.created': -1
            },
            limit: 1
          };

          var criteria = {
            genre: 'family'
          };

          var latestResult;

          searchClient.get(
            'movie/*',
            {
              criteria: criteria,
              options: options
            },
            function(e, result) {
              if (e) return done(e);

              expect(result.length).to.be(1);

              latestResult = result[0];

              expect(latestResult._meta.created).to.not.be(null);
              expect(latestResult._meta.created).to.not.be(undefined);

              searchClient.get('movie/family/*', function(e, result) {
                if (e) return callback(e);

                for (var resultItemIndex in result) {
                  if (resultItemIndex == '_meta') continue;

                  var resultItem = result[resultItemIndex];

                  expect(resultItem._meta.created).to.not.be(null);
                  expect(resultItem._meta.created).to.not.be(undefined);

                  if (
                    resultItem._meta.path != latestResult._meta.path &&
                    resultItem._meta.created > latestResult._meta.created
                  )
                    return done(new Error('the latest result is not the latest result...'));
                }

                done();
              });
            }
          );
        }
      );
    });

    it('can page using skip and limit', async () => {
      this.timeout(5000);

      var totalRecords = 100;
      var pageSize = 10;
      var expectedPages = totalRecords / pageSize;
      var indexes = [];

      for (let i = 0; i < totalRecords; i++) indexes.push(i);

      for (let index of indexes) {
        await searchClient.set('series/horror/' + index, {
          name: 'nightmare on elm street',
          genre: 'horror',
          episode: index
        });
        await searchClient.set('series/fantasy/' + index, {
          name: 'game of thrones',
          genre: 'fantasy',
          episode: index
        });
      }

      var options = {
        sort: {
          '_meta.created': -1
        },
        limit: pageSize
      };

      var criteria = {
        genre: 'horror'
      };

      var foundPages = [];

      for (let i = 0; i < expectedPages; i++) {
        options.skip = foundPages.length;
        let results = await searchClient.get('series/*', {
          criteria: criteria,
          options: options
        });
        foundPages = foundPages.concat(results);
      }

      let allResults = await searchClient.get('series/*', {
        criteria: criteria,
        options: {
          sort: {
            '_meta.created': -1
          }
        }
      });

      expect(allResults.length).to.eql(foundPages.length);
      expect(allResults).to.eql(foundPages);
    });
  }
);
