describe(require('../../__fixtures/utils/test_helper').create().testName(__filename, 3), function () {

  var path = require('path');
  var expect = require('expect.js');
  var happn = require('../../../lib/index');
  var async = require('async');
  var fs = require('fs-extra');
  var Promise = require('bluebird');

  var testId = Date.now();

  this.timeout(20000);

  function copyVersion0File() {

    var filePath = path.resolve(__dirname, '..', '..', '__fixtures', 'test', 'integration', 'data', 'updater', testId + '.nedb');

    try{
      fs.unlinkSync(filePath);
    }catch(e){
      //do nothing
    }

    fs.copySync(path.resolve(__dirname, '..', '..', '__fixtures', 'test', 'integration', 'data', 'updater', 'version_0.nedb'), filePath);

    return filePath;
  }

  function copyVersion1File() {

    var filePath = path.resolve(__dirname, '..', '..', '__fixtures', 'test', 'integration', 'data', 'updater', testId + '_1.nedb');

    try{
      fs.unlinkSync(filePath);
    }catch(e){
      //do nothing
    }

    fs.copySync(path.resolve(__dirname, '..', '..', '__fixtures', 'test', 'integration', 'data', 'updater', 'version_1.nedb'), filePath);

    return filePath;
  }

  it('starts up a secure db off an old file, we check the resulting db has the correct permissions', function (done) {

    var config = {
      secure: true,
      services: {
        data: {
          config: {
            filename: copyVersion0File(),
            autoUpdateDBVersion:true
          }
        }
      }
    };

    happn.service.create(config,
      function(e, serviceInstance){

        if (e) return done(e);

        var clientInstance;

        serviceInstance.services.session.localClient({
            username: 'TEST',
            password: 'password'
          })

          .then(function (client) {

            clientInstance = client;
            return clientInstance.get('/mesh/schema/*');

          })

          .then(function () {

            return new Promise(function(resolve, reject){
              clientInstance.on('/mesh/schema/*', function(data){
                //do nothing
              }, function(e){
                if (e) return reject(e);
                resolve();
              });
            });
          })

          .then(function () {

            clientInstance.set('/mesh/schema/test', {test:'data'}, function(e){
              expect(e).to.not.be(null);
              fs.unlinkSync(config.services.data.config.filename);
              serviceInstance.stop({reconnect:false}, done);
            });
          })

          .catch(function (e) {
            done(e);
          });
      }
    );

  });

  it('starts up a non-secure db off an old file, we check the resulting db has the correct permissions', function (done) {

    var config = {
      services: {
        data: {
          config: {
            filename: copyVersion0File(),
            autoUpdateDBVersion:true
          }
        }
      }
    };

    happn.service.create(config,
      function(e, serviceInstance){

        if (e) return done(e);

        var clientInstance;

        serviceInstance.services.session.localClient({
            username: 'TEST',
            password: 'password'
          })

          .then(function (client) {

            clientInstance = client;
            return clientInstance.get('/mesh/schema/*');

          })

          .then(function () {

            return new Promise(function(resolve, reject){
              clientInstance.on('/mesh/schema/*', function(data){
                //do nothing
              }, function(e){
                if (e) return reject(e);
                resolve();
              });
            });
          })

          .then(function () {

            clientInstance.set('/mesh/schema/test', {test:'data'}, function(e){
              expect(e).to.be(null);
              fs.unlinkSync(config.services.data.config.filename);
              serviceInstance.stop({reconnect:false}, done);
            });
          })

          .catch(function (e) {
            done(e);
          });
      }
    );
  });

  it('starts up a secure db off an old file, we check the startup fails if autoUpdateDBVersion undefined', function (done) {

    var config = {
      services: {
        data: {
          config: {
            filename: copyVersion0File()
          }
        }
      }
    };

    happn.service.create(config,
      function(e){
        expect(e.toString().indexOf('Error: current database version') == 0).to.be(true);
        fs.unlinkSync(config.services.data.config.filename);
        done();
      });
  });

  it('starts up a secure db off an old file, we check the startup fails if autoUpdateDBVersion undefined', function (done) {

    var config = {
      services: {
        data: {
          config: {
            filename: copyVersion0File()
          }
        }
      }
    };

    happn.service.create(config,
      function(e){
        expect(e.toString().indexOf('Error: current database version') == 0).to.be(true);
        fs.unlinkSync(config.services.data.config.filename);
        done();
      });
  });

  it('starts up a non-secure db off an old file, we check the startup fails if autoUpdateDBVersion false', function (done) {

    var config = {
      services: {
        data: {
          config: {
            filename: copyVersion0File(),
            autoUpdateDBVersion:false
          }
        }
      }
    };

    happn.service.create(config,
      function(e, serviceInstance){
        expect(e.toString().indexOf('Error: current database version') == 0).to.be(true);
        fs.unlinkSync(config.services.data.config.filename);
        done();
      });
  });

  it('starts up a non-secure db off a version 1 file, we check the startup succeeds', function (done) {

    var config = {
      services: {
        data: {
          config: {
            filename: copyVersion1File(),
            autoUpdateDBVersion:false
          }
        }
      }
    };

    happn.service.create(config,
      function(e, serviceInstance){

        if (e) return done(e);

        expect(serviceInstance.services.data.dbVersionAnalysis.matchingVersion).to.be(true);

        fs.unlinkSync(config.services.data.config.filename);
        serviceInstance.stop({reconnect:false}, done);
      });
  });

});
