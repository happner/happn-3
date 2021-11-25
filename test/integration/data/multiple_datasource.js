require('../../__fixtures/utils/test_helper').describe(__filename, 20000, test => {
  const happn = require('../../../lib/index');
  const tempFile1 = test.newTestFile();
  const test_id = Date.now() + '_' + require('shortid').generate();

  let services = [];
  let singleClient;
  let multipleClient;

  const getService = function(config, callback) {
    happn.service.create(config, callback);
  };

  const getClient = function(service, callback) {
    service.services.session.localClient(function(e, instance) {
      if (e) return callback(e);
      callback(null, instance);
    });
  };

  before('should initialize the services', function(callback) {
    this.timeout(60000); //travis sometiems takes ages...

    let serviceConfigs = [
      {
        port: 55001
      },
      {
        services: {
          data: {
            config: {
              datastores: [
                {
                  name: 'memory',
                  isDefault: true,
                  patterns: [
                    '/a3_eventemitter_multiple_datasource/' + test_id + '/memorytest/*',
                    '/a3_eventemitter_multiple_datasource/' + test_id + '/memorynonwildcard'
                  ]
                },
                {
                  name: 'persisted',
                  settings: {
                    filename: tempFile1
                  },
                  patterns: [
                    '/a3_eventemitter_multiple_datasource/' + test_id + '/persistedtest/*',
                    '/a3_eventemitter_multiple_datasource/' + test_id + '/persistednonwildcard'
                  ]
                }
              ]
            }
          }
        }
      }
    ];

    test.async.eachSeries(
      serviceConfigs,
      function(serviceConfig, serviceConfigCallback) {
        getService(serviceConfig, function(e, happnService) {
          if (e) return serviceConfigCallback(e);

          services.push(happnService);
          serviceConfigCallback();
        });
      },
      function(e) {
        if (e) return callback(e);

        getClient(services[0], function(e, client) {
          if (e) return callback(e);

          singleClient = client;

          getClient(services[1], function(e, client) {
            if (e) return callback(e);

            multipleClient = client;

            callback();
          });
        });
      }
    );
  });

  after('should delete the temp data files', async () => {
    await test.cleanup([], services);
  });

  it('should push some data into the single datastore service', function(callback) {
    this.timeout(4000);

    try {
      let test_path_end = require('shortid').generate();
      let test_path = '/a3_eventemitter_multiple_datasource/' + test_id + '/set/' + test_path_end;

      singleClient.set(
        test_path,
        {
          property1: 'property1',
          property2: 'property2',
          property3: 'property3'
        },
        {},
        function(e) {
          if (!e) {
            singleClient.get(test_path, null, function(e, results) {
              test.expect(results.property1 === 'property1').to.be(true);
              callback(e);
            });
          } else callback(e);
        }
      );
    } catch (e) {
      callback(e);
    }
  });

  it('should push some data into the multiple datastore', function(callback) {
    this.timeout(4000);

    try {
      let test_path_end = require('shortid').generate();
      let test_path = '/a3_eventemitter_multiple_datasource/' + test_id + '/set/' + test_path_end;

      multipleClient.set(
        test_path,
        {
          property1: 'property1',
          property2: 'property2',
          property3: 'property3'
        },
        {},
        function(e) {
          if (!e) {
            multipleClient.get(test_path, null, function(e, results) {
              test.expect(results.property1 === 'property1').to.be(true);
              callback(e);
            });
          } else callback(e);
        }
      );
    } catch (e) {
      callback(e);
    }
  });

  it('should push some data into the multiple datastore, memory datastore, wildcard pattern', function(callback) {
    this.timeout(4000);

    try {
      let test_path_end = require('shortid').generate();
      let test_path =
        '/a3_eventemitter_multiple_datasource/' + test_id + '/memorytest/' + test_path_end;

      multipleClient.set(
        test_path,
        {
          property1: 'property1',
          property2: 'property2',
          property3: 'property3'
        },
        {},
        function(e) {
          if (!e) {
            multipleClient.get(test_path, null, function(e, results) {
              test.expect(results.property1 === 'property1').to.be(true);

              test.findRecordInDataFileCallback(test_path, tempFile1, function(e, record) {
                if (e) return callback(e);

                if (record)
                  callback(new Error('record found in persisted file, meant to be in memory'));
                else callback();
              });
            });
          } else callback(e);
        }
      );
    } catch (e) {
      callback(e);
    }
  });

  it('should push some data into the multiple datastore, persisted datastore, wildcard pattern', function(callback) {
    this.timeout(4000);

    try {
      let test_path_end = require('shortid').generate();
      let test_path =
        '/a3_eventemitter_multiple_datasource/' + test_id + '/persistedtest/' + test_path_end;

      multipleClient.set(
        test_path,
        {
          property1: 'property1',
          property2: 'property2',
          property3: 'property3'
        },
        {},
        function(e) {
          if (!e) {
            multipleClient.get(test_path, null, function(e, results) {
              test.expect(results.property1 === 'property1').to.be(true);

              test.findRecordInDataFileCallback(test_path, tempFile1, function(e, record) {
                if (e) return callback(e);

                if (record) callback();
                else callback(new Error('record not found in persisted file'));
              });
            });
          } else callback(e);
        }
      );
    } catch (e) {
      callback(e);
    }
  });

  it('should push some data into the multiple datastore, memory datastore, exact pattern', function(callback) {
    this.timeout(4000);

    try {
      let test_path = '/a3_eventemitter_multiple_datasource/' + test_id + '/memorynonwildcard';

      multipleClient.set(
        test_path,
        {
          property1: 'property1',
          property2: 'property2',
          property3: 'property3'
        },
        {},
        function(e) {
          if (!e) {
            multipleClient.get(test_path, null, function(e, results) {
              test.expect(results.property1 === 'property1').to.be(true);

              test.findRecordInDataFileCallback(test_path, tempFile1, function(e, record) {
                if (e) return callback(e);

                if (record)
                  callback(new Error('record found in persisted file, meant to be in memory'));
                else callback();
              });
            });
          } else callback(e);
        }
      );
    } catch (e) {
      callback(e);
    }
  });

  it('should push some data into the multiple datastore, persisted datastore, exact pattern', function(callback) {
    this.timeout(4000);

    try {
      let test_path = '/a3_eventemitter_multiple_datasource/' + test_id + '/persistednonwildcard';

      multipleClient.set(
        test_path,
        {
          property1: 'property1',
          property2: 'property2',
          property3: 'property3'
        },
        {},
        function(e) {
          if (!e) {
            multipleClient.get(test_path, null, function(e, results) {
              test.expect(results.property1 === 'property1').to.be(true);

              test.findRecordInDataFileCallback(test_path, tempFile1, function(e, record) {
                if (e) return callback(e);

                //console.log('rec: ', record);

                if (record) callback();
                else callback(new Error('record not found in persisted file'));
              });
            });
          } else callback(e);
        }
      );
    } catch (e) {
      callback(e);
    }
  });

  it('should push some data into the multiple datastore, default pattern', function(callback) {
    this.timeout(4000);

    try {
      let test_path = '/a3_eventemitter_multiple_datasource/' + test_id + '/default';

      multipleClient.set(
        test_path,
        {
          property1: 'property1',
          property2: 'property2',
          property3: 'property3'
        },
        {},
        function(e) {
          if (!e) {
            multipleClient.get(test_path, null, function(e, results) {
              test.expect(results.property1 === 'property1').to.be(true);

              test.findRecordInDataFileCallback(test_path, tempFile1, function(e, record) {
                if (e) return callback(e);

                if (record)
                  callback(new Error('record found in persisted file, meant to be in memory'));
                else callback();
              });
            });
          } else callback(e);
        }
      );
    } catch (e) {
      callback(e);
    }
  });

  it('check the same event should be raised, regardless of what data source we are pushing to', function(callback) {
    this.timeout(10000);
    let caughtCount = 0;

    let memoryTestPath = '/a3_eventemitter_multiple_datasource/' + test_id + '/memorytest/event';
    let persistedTestPath =
      '/a3_eventemitter_multiple_datasource/' + test_id + '/persistedtest/event';

    multipleClient.onAll(
      function(eventData, meta) {
        if (
          meta.action === '/SET@' + memoryTestPath ||
          meta.action === '/SET@' + persistedTestPath
        ) {
          caughtCount++;
          if (caughtCount === 2) {
            test.findRecordInDataFileCallback(persistedTestPath, tempFile1, function(e, record) {
              if (e) return callback(e);

              if (record) callback();
              else callback(new Error('record not found in persisted file'));
            });
          }
        }
      },
      function(e) {
        if (e) return callback(e);

        multipleClient.set(
          memoryTestPath,
          {
            property1: 'property1',
            property2: 'property2',
            property3: 'property3'
          },
          null,
          function(e) {
            if (e) return callback(e);

            multipleClient.set(
              persistedTestPath,
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
          }
        );
      }
    );
  });

  it('should not find the pattern to be added in the persisted datastore', function(callback) {
    this.timeout(4000);

    try {
      let test_path = '/a3_eventemitter_multiple_datasource/' + test_id + '/persistedaddedpattern';

      multipleClient.set(
        test_path,
        {
          property1: 'property1',
          property2: 'property2',
          property3: 'property3'
        },
        {},
        function(e) {
          if (!e) {
            multipleClient.get(test_path, null, function(e, results) {
              test.expect(results.property1 === 'property1').to.be(true);

              test.findRecordInDataFileCallback(test_path, tempFile1, function(e, record) {
                if (e) return callback(e);

                if (record)
                  callback(new Error('record found in persisted file, meant to be in memory'));
                else callback();
              });
            });
          } else callback(e);
        }
      );
    } catch (e) {
      callback(e);
    }
  });

  it('should add a pattern to the persisted datastore, and check it works', function(callback) {
    this.timeout(4000);

    try {
      let test_path = '/a3_eventemitter_multiple_datasource/' + test_id + '/persistedaddedpattern';

      services[1].services.data.addDataStoreFilter(test_path, 'persisted');

      multipleClient.set(
        test_path,
        {
          property1: 'property1',
          property2: 'property2',
          property3: 'property3'
        },
        {},
        function(e) {
          if (!e) {
            multipleClient.get(test_path, null, function(e, results) {
              test.expect(results.property1 === 'property1').to.be(true);
              test.findRecordInDataFileCallback(test_path, tempFile1, function(e, record) {
                if (e) return callback(e);
                if (record) callback();
                else callback(new Error('record not found in persisted file'));
              });
            });
          } else callback(e);
        }
      );
    } catch (e) {
      callback(e);
    }
  });

  it('should remove a pattern from the persisted datastore', function(callback) {
    this.timeout(4000);

    try {
      let test_path = '/a3_eventemitter_multiple_datasource/' + test_id + '/persistedaddedpattern';
      let patternExists = false;

      for (let pattern1 in services[1].services.data.dataroutes) {
        if (pattern1 === test_path) {
          patternExists = true;
          break;
        }
      }

      test.expect(patternExists).to.be(true);

      patternExists = false;

      services[1].services.data.removeDataStoreFilter(test_path);

      for (let pattern2 in services[1].services.data.dataroutes) {
        if (pattern2 === test_path) {
          patternExists = true;
          break;
        }
      }

      test.expect(patternExists).to.be(false);

      callback();
    } catch (e) {
      callback(e);
    }
  });
});
