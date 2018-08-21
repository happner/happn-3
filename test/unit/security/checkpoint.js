describe(require('../../__fixtures/utils/test_helper').create().testName(__filename, 3), function () {

  this.timeout(5000);

  var expect = require('expect.js');
  var happn = require('../../../lib/index');
  var async = require('async');
  var Logger = require('happn-logger');
  var EventEmitter = require('events').EventEmitter;
  var Checkpoint = require('../../../lib/services/security/checkpoint');

  var initializeCheckpoint = function (callback, config) {

    if (!config) config = {};

    var checkpoint = new Checkpoint({
      logger: Logger
    });

    var CacheService = require('../../../lib/services/cache/service');
    var UtilsService = require('../../../lib/services/utils/service');

    var cacheServiceInst = new CacheService();
    var utilsServiceInst = new UtilsService();

    cacheServiceInst.initialize(function () {

      var happn = {
        services: {
          session: new EventEmitter(),
          utils: utilsServiceInst,
          security: {
            happn: {
              services: {
                utils: new UtilsService()
              }
            },
            users: {
              getUser: function (name, callback) {
                return callback(null, {
                  username: name,
                  groups: {}
                });
              }
            },
            groups: {
              getGroup: function (name, opts, callback) {

                var returnGroup = {
                  name: name,
                  permissions: {}
                };

                if (name == 'TEST_GROUP')
                  returnGroup = {
                    name:'TEST_GROUP',
                    permissions: {
                      '/test/group/explicit': {
                        action: ['set']
                      },
                      '/test/group/*': {
                        action: ['*']
                      }
                    }
                  };


                if (name == 'TEST_GROUP_1')
                  returnGroup = {
                    name:'TEST_GROUP_1',
                    permissions: {
                      '/test/group/*': {
                        action: ['*']
                      }
                    }
                  };


                if (name == 'TEST_GROUP_2')
                  returnGroup = {
                    name:'TEST_GROUP_2',
                    permissions: {
                      '/test/explicit': {
                        actions: ['set']
                      },
                      '/test/wild/*': {
                        actions: ['*']
                      }
                    }
                  };

                if (name == 'TEST_GROUP_3')
                  returnGroup = {
                    name:'TEST_GROUP_3',
                    permissions: {
                      '/test/wild/*': {
                        actions: ['*']
                      }
                    }
                  };

                return callback(null, returnGroup);
              }
            }
          },
          cache: cacheServiceInst
        }
      };

      Object.defineProperty(checkpoint, 'happn', {
        value: happn
      });

      Object.defineProperty(cacheServiceInst, 'happn', {
        value: happn
      });

      checkpoint.initialize(config, happn.services.security, function (e) {

        if (e) return callback(e);

        callback(null, checkpoint);
      });
    });
  };

  it("tests the security checkpoints __loadPermissionSet function", function (done) {

    var groups = {
      'TEST_GROUP': {
        permissions: {
          '/test/group/explicit': {
            action: ['set']
          },
          '/test/group/*': {
            action: ['*']
          }
        }
      },
      'TEST_GROUP_1': {
        permissions: {
          '/test/group/*': {
            action: ['*']
          }
        }
      }
    };

    var identity = {
      user: {
        groups: groups
      }
    };

    initializeCheckpoint(function (e, checkpoint) {

      if (e) return done(e);

      checkpoint.__loadPermissionSet(identity, function (e, permissionSet) {

        if (e) return done(e);

        expect(permissionSet.explicit['/test/group/explicit'].action[0]).to.be('set');
        expect(permissionSet.wildcard['/test/group/*'].action[0]).to.be('*');
        expect(Object.keys(permissionSet.wildcard).length).to.be(1);

        done();
      });
    });
  });

  it("tests the security checkpoints __createPermissionSet function", function (done) {

    var permissions = {
      '/test/group/explicit': {
        action: ['set']
      },
      '/test/group/*': {
        action: ['*']
      }
    };

    initializeCheckpoint(function (e, checkpoint) {

      if (e) return done(e);

      var permissionSet = checkpoint.__createPermissionSet(permissions);

      expect(permissionSet.explicit['/test/group/explicit'].action[0]).to.be('set');
      expect(permissionSet.wildcard['/test/group/*'].action[0]).to.be('*');
      expect(Object.keys(permissionSet.wildcard).length).to.be(1);

      done();

    });
  });

  it("tests the security checkpoints __authorized function", function (done) {

    var groups = {
      'TEST_GROUP_2': {
        permissions: {
          '/test/explicit': {
            actions: ['set']
          },
          '/test/wild/*': {
            actions: ['*']
          }
        }
      },
      'TEST_GROUP_3': {
        permissions: {
          '/test/wild/*': {
            actions: ['*']
          }
        }
      }
    };

    var identity = {
      user: {
        groups: groups
      }
    };

    initializeCheckpoint(function (e, checkpoint) {

      if (e) return done(e);

      checkpoint.__loadPermissionSet(identity, function (e, permissionSet) {

        if (e) return done(e);

        expect(permissionSet.explicit['/test/explicit'].actions[0]).to.be('set');
        expect(permissionSet.wildcard['/test/wild/*'].actions[0]).to.be('*');
        expect(Object.keys(permissionSet.wildcard).length).to.be(1);


        expect(checkpoint.__authorized(permissionSet, '/test/explicit', 'set')).to.be(true);
        expect(checkpoint.__authorized(permissionSet, '/test/wild/blah', 'on')).to.be(true);
        expect(checkpoint.__authorized(permissionSet, '/test/explicit/1', 'set')).to.be(false);
        expect(checkpoint.__authorized(permissionSet, '/test', 'get')).to.be(false);

        done();

      });
    });
  });

  it('tests caching in checkpoint, __permissionCache', function (done) {

    initializeCheckpoint(function (e, checkpoint) {

      if (e) return done(e);

      expect(checkpoint.__cache_checkpoint_authorization.getSync('TEST-SESSION-ID' + '/test/path' + 'set')).to.be(null);

      //session, path, action, callback
      checkpoint._authorizeUser({
        id: 'TEST-SESSION-ID',
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

        var cached = checkpoint.__cache_checkpoint_authorization.getSync('TEST-SESSION-ID' + '/test/path' + 'set');

        expect(cached === false).to.be(true);

        checkpoint.clearCaches();

        expect(checkpoint.__cache_checkpoint_authorization.getSync('TEST-SESSION-ID' + '/test/path' + 'set')).to.be(null);

        done();
      });
    });
  });

  it('tests caching in checkpoint, __permissionSets', function (done) {

    var testPermissionSetKey = require('crypto').createHash('sha1').update(['TEST1', 'TEST2'].join('/')).digest('base64');

    initializeCheckpoint(function (e, checkpoint) {

      if (e) return done(e);

      expect(checkpoint.__cache_checkpoint_permissionset.getSync(testPermissionSetKey)).to.be(null);

      //session, path, action, callback
      checkpoint._authorizeUser({
        permissionSetKey: require('crypto').createHash('sha1').update(['TEST1', 'TEST2'].join('/')).digest('base64'),
        id: 'TEST-SESSION-ID',
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

        var cached = checkpoint.__cache_checkpoint_permissionset.getSync(testPermissionSetKey);

        expect(cached).to.not.be(null);

        checkpoint.clearCaches();

        expect(checkpoint.__cache_checkpoint_permissionset.getSync(testPermissionSetKey)).to.be(null);

        done();
      });
    });
  });

  it('tests caching in checkpoint, cache size 5', function (done) {

    initializeCheckpoint(function (e, checkpoint) {

      if (e) return done(e);

      async.timesSeries(10, function (time, timeCB) {

        var testPermissionSetKey = require('crypto').createHash('sha1').update(['TEST1', 'TEST2', 'TEST_TIME' + time].join('/')).digest('base64');

        //session, path, action, callback
        checkpoint._authorizeUser({
          permissionSetKey: testPermissionSetKey,
          id: 'TEST-SESSION-ID' + time,
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

          var cached = checkpoint.__cache_checkpoint_permissionset.get(testPermissionSetKey);

          expect(cached).to.not.be(null);

          timeCB();
        });

      }, function (e) {

        if (e) return done(e);

        expect(checkpoint.__cache_checkpoint_permissionset.values().length).to.be(5);
        expect(checkpoint.__cache_checkpoint_authorization.values().length).to.be(5);

        done();
      });
    }, {
      __cache_checkpoint_permissionset: {
        max: 5
      },
      __cache_checkpoint_authorization: {
        max: 5
      }
    });
  });

  it('tests caching in checkpoint, cache size 10', function (done) {

    initializeCheckpoint(function (e, checkpoint) {

      if (e) return done(e);

      async.timesSeries(10, function (time, timeCB) {

        var testPermissionSetKey = require('crypto').createHash('sha1').update(['TEST1', 'TEST2', 'TEST_TIME' + time].join('/')).digest('base64');

        //session, path, action, callback
        checkpoint._authorizeUser({
          permissionSetKey: testPermissionSetKey,
          id: 'TEST-SESSION-ID' + time,
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

          var cached = checkpoint.__cache_checkpoint_permissionset.get(testPermissionSetKey);

          expect(cached).to.not.be(null);

          timeCB();
        });

      }, function (e) {

        if (e) return done(e);

        expect(checkpoint.__cache_checkpoint_permissionset.values().length).to.be(10);
        expect(checkpoint.__cache_checkpoint_authorization.values().length).to.be(10);

        done();
      });
    }, {
      __cache_checkpoint_permissionset: {
        max: 10
      },
      __cache_checkpoint_authorization: {
        max: 10
      }
    });
  });
});
