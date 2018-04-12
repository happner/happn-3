describe(require('../../__fixtures/utils/test_helper').create().testName(__filename, 3), function () {

  this.timeout(5000);

  var expect = require('expect.js');
  var happn = require('../../../lib/index');
  var async = require('async');
  var Logger = require('happn-logger');


  it('tests caching in checkpoint, __permissionCache', function (done) {

    var Checkpoint = require('../../../lib/services/security/checkpoint');

    var checkpoint = new Checkpoint({
      logger: Logger
    });

    var UtilsService = require('../../../lib/services/utils/service');

    var happn = {
      services:{
        security:{
          happn:{
            services:{
              utils:new UtilsService()
            }
          },
          users:{
            getUser:function(name, callback){
              return callback(null, {
                username:name,
                groups:{

                }
              });
            }
          },
          groups:{
            getGroup:function(name, opts, callback){
              return callback(null, {
                name:name,
                permissions:{

                }
              });
            }
          }
        }
      }
    };

    checkpoint.initialize({}, happn.services.security, function () {

      expect(checkpoint.__permissionCache.get('TEST-SESSION-ID' + '/test/path' + 'set')).to.be(undefined);

      //session, path, action, callback
      checkpoint._authorizeUser({
        id:'TEST-SESSION-ID',
        username: 'TEST',
        user: {
          groups: {
            'TEST1': {
              permissions: {}
            },
            'TEST2': {
              permissions: {}
            }
          }
        }
      }, '/test/path', 'set', function (e, authorized) {

        if (e) return done(e);

        expect(authorized).to.be(false);

        var cached = checkpoint.__permissionCache.get('TEST-SESSION-ID' + '/test/path' + 'set');

        expect(cached === false).to.be(true);

        checkpoint.clearCaches();

        expect(checkpoint.__permissionCache.get('TEST-SESSION-ID' + '/test/path' + 'set')).to.be(undefined);

        done();
      });
    });
  });

  it('tests caching in checkpoint, __permissionSets', function (done) {

    var testPermissionSetKey = require('crypto').createHash('sha1').update(['TEST1','TEST2'].join('/')).digest('base64');

    var Checkpoint = require('../../../lib/services/security/checkpoint');

    var checkpoint = new Checkpoint({
      logger: Logger
    });

    expect(checkpoint.__permissionSets.get(testPermissionSetKey)).to.be(undefined);

    var UtilsService = require('../../../lib/services/utils/service');

    var happn = {
      services:{
        security:{
          happn:{
            services:{
              utils:new UtilsService()
            }
          },
          users:{
            getUser:function(name, callback){
              return callback(null, {
                username:name,
                groups:{

                }
              });
            }
          },
          groups:{
            getGroup:function(name, opts, callback){
              return callback(null, {
                name:name,
                permissions:{

                }
              });
            }
          }
        }
      }
    };

    checkpoint.initialize({}, happn.services.security, function () {

      //session, path, action, callback
      checkpoint._authorizeUser({
        permissionSetKey: require('crypto').createHash('sha1').update(['TEST1','TEST2'].join('/')).digest('base64'),
        id:'TEST-SESSION-ID',
        username: 'TEST',
        user: {
          groups: {
            'TEST1': {
              permissions: {}
            },
            'TEST2': {
              permissions: {}
            }
          }
        }
      }, '/test/path', 'set', function (e, authorized) {

        if (e) return done(e);

        expect(authorized).to.be(false);

        var cached = checkpoint.__permissionSets.get(testPermissionSetKey);

        expect(cached).to.not.be(null);

        checkpoint.clearCaches();

        expect(checkpoint.__permissionSets.get(testPermissionSetKey)).to.be(undefined);

        done();
      });
    });
  });

  it('tests caching in checkpoint, cache size 5', function (done) {

    var Checkpoint = require('../../../lib/services/security/checkpoint');

    var checkpoint = new Checkpoint({
      logger: Logger,
      permissionCache: {
        max: 5,
        maxAge: 0
      }
    });

    var UtilsService = require('../../../lib/services/utils/service');

    var happn = {
      services:{
        security:{
          happn:{
            services:{
              utils:new UtilsService()
            }
          },
          users:{
            getUser:function(name, callback){
              return callback(null, {
                username:name,
                groups:{

                }
              });
            }
          },
          groups:{
            getGroup:function(name, opts, callback){
              return callback(null, {
                name:name,
                permissions:{

                }
              });
            }
          }
        }
      }
    };

    checkpoint.initialize({}, happn.services.security, function () {

      async.timesSeries(10, function(time, timeCB){

        var testPermissionSetKey = require('crypto').createHash('sha1').update(['TEST1','TEST2', 'TEST_TIME' + time].join('/')).digest('base64');

        //session, path, action, callback
        checkpoint._authorizeUser({
          permissionSetKey: testPermissionSetKey,
          id:'TEST-SESSION-ID' + time,
          username: 'TEST' + time,
          user: {
            groups: {
              'TEST1': {
                permissions: {}
              },
              'TEST2': {
                permissions: {}
              }
            }
          }
        }, '/test/path', 'set', function (e, authorized) {

          if (e) return done(e);

          expect(authorized).to.be(false);

          var cached = checkpoint.__permissionSets.get(testPermissionSetKey);

          expect(cached).to.not.be(null);

          timeCB();
        });

      }, function(e){

        if (e) return done(e);

        expect(checkpoint.__permissionSets.values().length).to.be(5);
        expect(checkpoint.__permissionCache.values().length).to.be(5);

        done();

      });
    });
  });

  it('tests caching in checkpoint, cache size 10', function (done) {

    var Checkpoint = require('../../../lib/services/security/checkpoint');

    var checkpoint = new Checkpoint({
      logger: Logger,
      permissionCache: {
        max: 10,
        maxAge: 0
      }
    });

    var UtilsService = require('../../../lib/services/utils/service');

    var happn = {
      services:{
        security:{
          happn:{
            services:{
              utils:new UtilsService()
            }
          },
          users:{
            getUser:function(name, callback){
              return callback(null, {
                username:name,
                groups:{

                }
              });
            }
          },
          groups:{
            getGroup:function(name, opts, callback){
              return callback(null, {
                name:name,
                permissions:{

                }
              });
            }
          }
        }
      }
    };

    checkpoint.initialize({}, happn.services.security, function () {

      async.timesSeries(20, function(time, timeCB){

        var testPermissionSetKey = require('crypto').createHash('sha1').update(['TEST1','TEST2', 'TEST_TIME' + time].join('/')).digest('base64');

        //session, path, action, callback
        checkpoint._authorizeUser({
          permissionSetKey: testPermissionSetKey,
          id:'TEST-SESSION-ID' + time,
          username: 'TEST' + time,
          user: {
            groups: {
              'TEST1': {
                permissions: {}
              },
              'TEST2': {
                permissions: {}
              }
            }
          }
        }, '/test/path', 'set', function (e, authorized) {

          if (e) return done(e);

          expect(authorized).to.be(false);

          var cached = checkpoint.__permissionSets.get(testPermissionSetKey);

          expect(cached).to.not.be(null);

          timeCB();
        });

      }, function(e){

        if (e) return done(e);

        expect(checkpoint.__permissionSets.values().length).to.be(10);
        expect(checkpoint.__permissionCache.values().length).to.be(10);

        done();

      });
    });
  });
});
