describe(
  require('../../__fixtures/utils/test_helper')
    .create()
    .testName(__filename, 3),
  function() {
    this.timeout(5000);

    var expect = require('expect.js');
    var path = require('path');

    function mockDataService(newDB, dbVersion) {
      var dataService = {};

      dataService.get = function(path, callback) {
        if (path == '/_SYSTEM/_SECURITY/_USER/_ADMIN') {
          if (!newDB) return callback(null, { data: { username: '_ADMIN' } });

          return callback(null, null);
        }

        if (path == '/_SYSTEM/_DATABASE/_VERSION') {
          if (dbVersion == null) return callback(null, null);

          return callback(null, { data: { value: dbVersion } });
        }

        callback(new Error('unknown test get path: ' + path));
      };

      dataService.upsert = function(path, dbVersion, callback) {
        if (path == '/_SYSTEM/_DATABASE/_VERSION') {
          return callback(null, { data: { value: dbVersion } });
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

    it('tests analyzing an old db', function(done) {
      var Updater = require('../../../lib/services/data/versions/updater');

      var updater = new Updater(mockDataService(false, null), mockSystemService('1'));

      updater.analyzeDB(function(e, analysis) {
        if (e) return done(e);

        expect(analysis.isNew).to.be(false);
        expect(analysis.moduleDBVersion).to.be('1');
        expect(analysis.currentDBVersion).to.be('0');
        expect(analysis.matchingVersion).to.be(false);

        done();
      });
    });

    it('tests analyzing a version 1 db', function(done) {
      var Updater = require('../../../lib/services/data/versions/updater');

      var updater = new Updater(mockDataService(false, '1'), mockSystemService('1'));

      updater.analyzeDB(function(e, analysis) {
        if (e) return done(e);

        expect(analysis.isNew).to.be(false);
        expect(analysis.moduleDBVersion).to.be('1');
        expect(analysis.currentDBVersion).to.be('1');
        expect(analysis.matchingVersion).to.be(true);

        done();
      });
    });

    it('tests analyzing a new db', function(done) {
      var Updater = require('../../../lib/services/data/versions/updater');

      var updater = new Updater(mockDataService(true, '1'), mockSystemService('1'));

      updater.analyzeDB(function(e, analysis) {
        if (e) return done(e);

        expect(analysis.isNew).to.be(true);
        expect(analysis.moduleDBVersion).to.be('1');
        expect(analysis.currentDBVersion).to.be('1');
        expect(analysis.matchingVersion).to.be(true);

        done();
      });
    });

    it('tests updating a new db', function(done) {
      var Updater = require('../../../lib/services/data/versions/updater');

      var updater = new Updater(mockDataService(true, '1'), mockSystemService('1'));

      updater.analyzeDB(function(e, analysis) {
        if (e) return done(e);

        expect(analysis.isNew).to.be(true);
        expect(analysis.moduleDBVersion).to.be('1');
        expect(analysis.currentDBVersion).to.be('1');
        expect(analysis.matchingVersion).to.be(true);

        updater.writeVersionToDB(analysis.moduleDBVersion, done, done);
      });
    });

    it('tests updating an old db', function(done) {
      var Updater = require('../../../lib/services/data/versions/updater');

      var updater = new Updater(mockDataService(false, null), mockSystemService('3'), {
        updatesDirectory: path.resolve(__dirname, '../../__fixtures/test/unit/data/updater/updates')
      });

      updater.analyzeDB(function(e, analysis) {
        if (e) return done(e);

        updater.updateDB(
          analysis,
          function(log) {
            expect(log[0].message).to.be('Update1 getUpdateRecords ran ok');
            expect(log[1].message).to.be('Update1 backup ran ok');
            expect(log[2].message).to.be('Update1 update ran ok');
            expect(log[0].logType).to.be('info');
            expect(log[1].logType).to.be('info');
            expect(log[2].logType).to.be('info');
            expect(log[0].data.count).to.be(4);
            expect(log[1].data.count).to.be(4);
            expect(log[2].data.count).to.be(4);
            expect(log[3].message).to.be('Update2 getUpdateRecords ran ok');
            expect(log[4].message).to.be('Update2 backup ran ok');
            expect(log[5].message).to.be('Update2 update ran ok');
            expect(log[6].message).to.be('Update3 getUpdateRecords ran ok');
            expect(log[7].message).to.be('Update3 backup ran ok');
            expect(log[8].message).to.be('Update3 update ran ok');

            done();
          },
          done
        );
      });
    });

    it('tests updating an old with a rollback', function(done) {
      var Updater = require('../../../lib/services/data/versions/updater');

      var updater = new Updater(mockDataService(false, null), mockSystemService('4'), {
        updatesDirectory: path.resolve(__dirname, '../../__fixtures/test/unit/data/updater/updates')
      });

      updater.analyzeDB(function(e, analysis) {
        if (e) return done(e);

        updater.updateDB(
          analysis,
          function() {
            done(new Error('this was not meant to be...'));
          },
          function(e, log, rollBackSuccessful) {
            expect(e.toString()).to.be('Error: test error');
            expect(rollBackSuccessful).to.be(true);

            expect(log[0].message).to.be('Update1 getUpdateRecords ran ok');
            expect(log[1].message).to.be('Update1 backup ran ok');
            expect(log[2].message).to.be('Update1 update ran ok');
            expect(log[0].logType).to.be('info');
            expect(log[1].logType).to.be('info');
            expect(log[2].logType).to.be('info');
            expect(log[0].data.count).to.be(4);
            expect(log[1].data.count).to.be(4);
            expect(log[2].data.count).to.be(4);
            expect(log[3].message).to.be('Update2 getUpdateRecords ran ok');
            expect(log[4].message).to.be('Update2 backup ran ok');
            expect(log[5].message).to.be('Update2 update ran ok');
            expect(log[6].message).to.be('Update3 getUpdateRecords ran ok');
            expect(log[7].message).to.be('Update3 backup ran ok');
            expect(log[8].message).to.be('Update3 update ran ok');

            expect(log[9].message).to.be('Update4 getUpdateRecords ran ok');
            expect(log[10].message).to.be('Update4 backup ran ok');
            expect(log[11].message).to.be('Update4 rollback ran ok');
            expect(log[12].message).to.be('Update3 rollback ran ok');
            expect(log[13].message).to.be('Update2 rollback ran ok');
            expect(log[14].message).to.be('Update1 rollback ran ok');

            done();
          }
        );
      });
    });
  }
);
