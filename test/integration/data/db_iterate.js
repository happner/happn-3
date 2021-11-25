require('../../__fixtures/utils/test_helper').describe(__filename, 20000, test => {
  const test_id = test.shortid();
  const test_file1 = test.newTestFile();
  const test_file2 = test.newTestFile();
  const test_file2a = test.newTestFile();

  const serviceConfig1 = {
    secure: true,
    port: 4444,
    services: {
      data: {
        config: {
          filename: test_file1
        }
      }
    }
  };

  const serviceConfig2 = {
    secure: true,
    port: 4447,
    services: {
      data: {
        config: {
          datastores: [
            {
              name: 'file2',
              settings: {
                filename: test_file2
              },
              patterns: ['/c7_ds_iterate/' + test_id + '/2/*']
            },
            {
              name: 'file2a',
              settings: {
                filename: test_file2a
              },
              patterns: ['/c7_ds_iterate/' + test_id + '/2a/*']
            }
          ]
        }
      }
    }
  };

  let serviceInstance1;
  let serviceInstance2;

  before('it creates 2 test dss', async () => {
    serviceInstance1 = await test.createInstance(serviceConfig1);
    serviceInstance2 = await test.createInstance(serviceConfig2);
  });

  after('it shuts down the test dss, and unlinks their file', async () => {
    await serviceInstance1.stop();
    await serviceInstance2.stop();
    test.deleteFiles();
  });

  it('iterates over a single default ds instance', function(callback) {
    serviceInstance1.services.data.__iterateDataStores(function(key, ds, next) {
      test.expect(key).to.be('default');
      test.expect(ds.provider.persistence).to.not.be(null);
      next();
    }, callback);
  });

  it('iterates over multiple ds instances', function(callback) {
    var keyCount = 0;

    serviceInstance2.services.data.__iterateDataStores(
      function(key, ds, next) {
        test.expect(['file2', 'file2a'].indexOf(key) > -1).to.be(true);
        test.expect(ds.provider.persistence).to.not.be(null);

        keyCount++;
        next();
      },
      function() {
        test.expect(keyCount).to.be(2);
        callback();
      }
    );
  });

  it('iterates a specific ds instance amongst multiple ds instances', function(callback) {
    var keyCount = 0;

    serviceInstance2.services.data.__iterateDataStores(
      'file2a',
      function(key, ds, next) {
        test.expect(key).to.be('file2a');
        test.expect(ds.provider.persistence).to.not.be(null);
        keyCount++;
        next();
      },
      function() {
        test.expect(keyCount).to.be(1);
        callback();
      }
    );
  });

  it('iterates another specific ds instance amongst multiple ds instances', function(callback) {
    var keyCount = 0;

    serviceInstance2.services.data.__iterateDataStores(
      'file2',
      function(key, ds, next) {
        test.expect(key).to.be('file2');
        test.expect(ds.provider.persistence).to.not.be(null);
        keyCount++;
        next();
      },
      function() {
        test.expect(keyCount).to.be(1);
        callback();
      }
    );
  });

  it('fails to find an instance on a single', function(callback) {
    serviceInstance1.services.data.__iterateDataStores(
      'badkey',
      function(key, ds, next) {
        next(new Error('this should not have happened'));
      },
      function(e) {
        test.expect(e).to.not.be(null);
        test.expect(e.toString()).to.be('Error: datastore with key badkey, does not exist');
        callback();
      }
    );
  });

  it('fails to find an instance on a multiple', function(callback) {
    serviceInstance2.services.data.__iterateDataStores(
      'badkey',
      function(key, ds, next) {
        next(new Error('this should not have happened'));
      },
      function(e) {
        test.expect(e).to.not.be(null);
        test.expect(e.toString()).to.be('Error: datastore with key badkey, does not exist');
        callback();
      }
    );
  });
});
