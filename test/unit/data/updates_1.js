describe(
  require('../../__fixtures/utils/test_helper')
    .create()
    .testName(__filename, 3),
  function() {
    this.timeout(5000);

    var path = require('path');

    function mockDataService(newDB, dbVersion) {
      var dataService = {};

      dataService.get = function(path, callback) {
        if (path === '/_SYSTEM/_SECURITY/_USER/_ADMIN') {
          if (!newDB) return callback(null, { data: { username: '_ADMIN' } });

          return callback(null, null);
        }

        if (path === '/_SYSTEM/_DATABASE/_VERSION') {
          if (dbVersion == null) return callback(null, null);

          return callback(null, { data: { value: dbVersion } });
        }

        if (path === '/_SYSTEM/_SECURITY/_GROUP/*') {
          return callback(null, [
            {
              _id: '/_SYSTEM/_SECURITY/_GROUP/_ADMIN',
              data: {
                custom_data: { description: 'the default administration group for happn' },
                name: '_ADMIN',
                permissions: { '*': { actions: ['*'] } }
              },
              path: '/_SYSTEM/_SECURITY/_GROUP/_ADMIN',
              created: 1494494642563,
              modified: 1494494642563
            },
            {
              _id: '/_SYSTEM/_SECURITY/_GROUP/TEST',
              data: {
                custom_data: { description: 'the default administration group for happn' },
                name: 'TEST',
                permissions: { '*': { actions: ['get,on'] } }
              },
              path: '/_SYSTEM/_SECURITY/_GROUP/TEST',
              created: 1494494642563,
              modified: 1494494642563
            },
            {
              _id: '/_SYSTEM/_SECURITY/_GROUP/_MESH_ADM',
              data: {
                name: '_MESH_ADM',
                permissions: {
                  '/mesh/*': { actions: ['*'], description: 'mesh system permission' },
                  '/_exchange/*': { actions: ['*'], description: 'mesh system permission' },
                  '/_events/*': { actions: ['*'], description: 'mesh system permission' }
                }
              },
              path: '/_SYSTEM/_SECURITY/_GROUP/_MESH_ADM',
              created: 1494494643004,
              modified: 1494501004186
            },
            {
              _id: '/_SYSTEM/_SECURITY/_GROUP/_MESH_GST',
              data: {
                name: '_MESH_GST',
                permissions: {
                  '/mesh/schema/*': {
                    actions: ['get', 'on'],
                    description: 'mesh system guest permission'
                  },
                  '/_exchange/requests/*/security/updateOwnUser': {
                    actions: ['*'],
                    description: 'mesh system permission'
                  },
                  '/_exchange/responses/*/security/updateOwnUser': {
                    actions: ['*'],
                    description: 'mesh system quest permission'
                  }
                }
              },
              path: '/_SYSTEM/_SECURITY/_GROUP/_MESH_GST',
              created: 1494494643008,
              modified: 1494501004191
            }
          ]);
        }

        callback(new Error('unknown test get path: ' + path));
      };

      dataService.upsert = function(path, data, callback) {
        if (path === '/_SYSTEM/_DATABASE/_VERSION') {
          return callback(null, { data: { value: data } });
        }

        if (path.indexOf('/_SYSTEM/DATABASE/BACKUPS/1/GROUP/') === 0) {
          return callback(null);
        }

        if (path.indexOf('/_SYSTEM/_SECURITY/_PERMISSIONS') === 0) {
          return callback(null);
        }

        callback(new Error('unknown test upsert path: ' + path));
      };

      return dataService;
    }

    function mockSystemService(dbVersion) {
      var systemService = {};

      if (!dbVersion) return systemService;

      systemService.package = {};

      systemService.package.database = dbVersion;

      return systemService;
    }

    it('tests updating an old db', function(done) {
      var Updater = require('../../../lib/services/data/versions/updater');

      var updater = new Updater(mockDataService(false, null), mockSystemService('1'), {
        updatesDirectory: path.resolve(__dirname, '../../../lib/services/data/versions/updates')
      });

      updater.analyzeDB(function(e, analysis) {
        if (e) return done(e);

        updater.updateDB(
          analysis,
          function() {
            done();
          },
          done
        );
      });
    });

    it('tests updating an old with a rollback', function(done) {
      var Updater = require('../../../lib/services/data/versions/updater');

      var updater = new Updater(mockDataService(false, null), mockSystemService('1'), {});

      updater.updateModules['1.js'].update = function() {
        return new Promise(function(resolve, reject) {
          reject(new Error('test error'));
        });
      };

      updater.analyzeDB(function(e, analysis) {
        if (e) return done(e);

        updater.updateDB(
          analysis,
          function() {
            done(new Error('this was not meant to be...'));
          },
          function() {
            done();
          }
        );
      });
    });
  }
);
