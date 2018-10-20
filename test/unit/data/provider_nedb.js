var testName = require('../../__fixtures/utils/test_helper').create().testName(__filename, 3);

describe(testName, function() {

  this.timeout(60000);

  var expect = require('expect.js');
  var path = require('path');
  var async = require('async');

  var dbFiles = [];

  function getNedbProvider(withCloning, callback) {

    var NedbProvider = require('../../../lib/services/data/providers/nedb');
    var fileName = path.resolve(__dirname, '../../__fixtures/test/unit/data/' + testName.split('/')[2] + Date.now() + '.nedb');

    dbFiles.push(fileName);

    var newProvider = new NedbProvider({
      filename:fileName,
      //compactInterval:5000 //enable to see the classic field names cannot contain . error
    });

    if (!withCloning) newProvider.utils = {
      clone: function(obj) {
        console.log('skipping clone...');
        return obj;
      }
    }

    newProvider.initialize(function(e) {
      if (e) return callback(e);
      return callback(null, newProvider);
    });
  };

  after('it deletes the db files', function(){
    dbFiles.forEach(function(fileName){
      try{
        require('fs').unlinkSync(fileName);
      }catch(e){
        console.log('error unlining file: ' + filename);
      }
    });
  });

  it('tests data being saved by the provider is decoupled', function(done) {

    getNedbProvider(true, function(e, provider) {

      if (e) return done(e);
      var foundExternalData = false;

      async.timesSeries(5, function(time, timeCB){

        var setData = {
          data: {
            test: 1,
            testObject:{
              "test/1":1,
              "test/2":2
            }
          }
        };

        var decoupled = JSON.parse(JSON.stringify(setData.data.testObject));
        delete setData.data.testObject;

        console.log('upsert attempt ' + time);
        provider.upsert('/path/test', setData, {}, false, function(e, result, created, upserted) {
          if (e) return timeCB(e);
          setData.data.testObject = decoupled;
          provider.findOne({
            path: '/path/test'
          }, {}, function(e, found) {
            if (e) return timeCB(e);
            if (found.data.testObject != null) {
              foundExternalData = true;
            }
            setTimeout(timeCB, 2000);
          });
        });
      }, function(e){
        if (e) return done(e);
        expect(foundExternalData).to.be(false);
        done();
      });
    });
  });

  it('tests data being saved by the provider is decoupled, negative test', function(done) {

    getNedbProvider(false, function(e, provider) {

      if (e) return done(e);
      var foundExternalData = false;

      async.timesSeries(5, function(time, timeCB){

        var setData = {
          data: {
            test: 1,
            testObject:{
              "test/1":1,
              "test/2":2,
              "test.1":3
            }
          }
        };

        var decoupled = JSON.parse(JSON.stringify(setData.data.testObject));
        delete setData.data.testObject;

        console.log('upsert attempt ' + time);
        provider.upsert('/path/test', setData, {}, false, function(e, result, created, upserted) {
          if (e) return timeCB(e);
          setData.data.testObject = decoupled;
          provider.findOne({
            path: '/path/test'
          }, {}, function(e, found) {
            if (e) return timeCB(e);
            if (found.data.testObject != null) {
              console.log('found testObject in cached db!');
              foundExternalData = true;
            }
            setTimeout(timeCB, 2000);
          });
        });
      }, function(e){
        if (e) return done(e);
        expect(foundExternalData).to.be(true);
        done();
      });
    });
  });
});
