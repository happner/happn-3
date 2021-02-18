describe(
  require('../../__fixtures/utils/test_helper')
    .create()
    .testName(__filename, 3),
  function() {
    var expect = require('expect.js');
    var Logger = require('happn-logger');
    var EventEmitter = require('events').EventEmitter;
    var Checkpoint = require('../../../lib/services/security/checkpoint');

    var initializeCheckpoint = function(callback, config) {
      if (!config) config = {};

      var checkpoint = new Checkpoint({
        logger: Logger
      });

      var CacheService = require('../../../lib/services/cache/service');
      var UtilsService = require('../../../lib/services/utils/service');

      var cacheServiceInst = new CacheService();
      var utilsServiceInst = new UtilsService();

      cacheServiceInst.initialize(function() {
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
                getUser: function(name, callback) {
                  return callback(null, {
                    username: name,
                    groups: {}
                  });
                },
                attachPermissions: function(user) {
                  return new Promise(resolve => {
                    return resolve(user);
                  });
                }
              },
              groups: {
                getGroup: function(name, opts, callback) {
                  var returnGroup = {
                    name: name,
                    permissions: {}
                  };

                  if (name === 'test_group_1')
                    returnGroup = {
                      name: 'test_group_1',
                      permissions: {
                        'test/path/1': { actions: ['get'] },
                        '/gauge/{{user.username}}/*': { actions: ['on', 'set'] },
                        '/custom/{{user.custom_data.custom_field}}/*': { actions: ['on', 'set'] }
                      }
                    };

                  if (name === 'test_group_2')
                    returnGroup = {
                      name: 'test_group_2',
                      permissions: {
                        'test/path/2': { actions: ['get'] },
                        '/custom/{{user.custom_data.custom_field1}}': { actions: ['*'] }
                      }
                    };

                  if (name === 'test_group_3')
                    returnGroup = {
                      name: 'test_group_3',
                      custom_data: {
                        existent_property: 'existent_property'
                      },
                      permissions: {
                        'test/path/3': { actions: ['get'] },
                        '/custom/{{user.nonexistent_property}}': { actions: ['*'] }
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

        checkpoint.initialize(config, happn.services.security, function(e) {
          if (e) return callback(e);

          callback(null, checkpoint);
        });
      });
    };

    // took this out, cannot see how listening on a template path is a hole to security
    xit('should ensure replacement permissions fail the utility checkPath', function(done) {
      var utils = require('../../../lib/services/utils/shared.js');

      try {
        utils.checkPath('/gauge/{{username}}/*');
      } catch (e) {
        expect(e.toString()).to.be(
          'Error: Bad path, can only contain characters a-z A-Z 0-9 / & + = : @ % * ( ) _ -, ie: factory1@I&J(western-cape)/plant1:conveyer_2/stats=true/capacity=10%/*'
        );
        return done();
      }
      done(new Error('unexpected success...'));
    });

    it('tests the __createPermissionSet method does permissions replacements, using a mocked identity with templated permissions', function(done) {
      initializeCheckpoint(function(e, checkpoint) {
        if (e) return done(e);
        var mockedIdentity = {
          user: {
            username: 'test_user',
            custom_data: {
              custom_field: 'test_custom_field',
              custom_field1: 'test_custom_field1'
            },
            groups: {
              test_group_1: {},
              test_group_2: {}
            }
          }
        };

        var templated = checkpoint.__createPermissionSet(
          {
            'test/path/1': { actions: ['get'] },
            'test/path/2': { actions: ['get'] },
            '/gauge/{{user.username}}/*': { actions: ['on', 'set'] },
            '/custom/{{user.custom_data.custom_field}}/*': { actions: ['on', 'set'] },
            '/custom/{{user.custom_data.custom_field1}}': { actions: ['*'] }
          },
          mockedIdentity
        );
        expect(templated.tree).to.eql({
          test: {
            path: {
              '1': {
                $leaf: 'test/path/1',
                actions: ['get']
              },
              '2': {
                $leaf: 'test/path/2',
                actions: ['get']
              }
            }
          },
          gauge: {
            test_user: {
              '*': {
                $leaf: '/gauge/test_user/*',
                actions: ['on', 'set']
              }
            }
          },
          custom: {
            test_custom_field: {
              '*': {
                $leaf: '/custom/test_custom_field/*',
                actions: ['on', 'set']
              }
            },
            test_custom_field1: {
              $leaf: '/custom/test_custom_field1',
              actions: ['*']
            }
          }
        });
        done();
      });
    });

    it('tests the __createPermissionSet method does permissions replacements, using a mocked identity, ensures template elements that dont match the context (identity / session) are skipped', function(done) {
      initializeCheckpoint(function(e, checkpoint) {
        if (e) return done(e);
        var mockedIdentity = {
          user: {
            username: 'test_user',
            custom_data: {
              custom_field: 'test_custom_field',
              custom_field1: 'test_custom_field1'
            },
            groups: {
              test_group_1: {},
              test_group_2: {}
            }
          }
        };

        var templated = checkpoint.__createPermissionSet(
          {
            'test/path/1': { actions: ['get'] },
            'test/path/2': { actions: ['get'] },
            '/gauge/{{user.username}}/*': { actions: ['on', 'set'] },
            '/gauge/{{user.nonexistent_property}}/*': { actions: ['on', 'set'] },
            '/custom/{{user.custom_data.custom_field}}/*': { actions: ['on', 'set'] },
            '/custom/{{user.custom_data.custom_field1}}': { actions: ['*'] }
          },
          mockedIdentity
        );

        expect(templated.tree).to.eql({
          test: {
            path: {
              '1': {
                $leaf: 'test/path/1',
                actions: ['get']
              },
              '2': {
                $leaf: 'test/path/2',
                actions: ['get']
              }
            }
          },
          gauge: {
            test_user: {
              '*': {
                $leaf: '/gauge/test_user/*',
                actions: ['on', 'set']
              }
            }
          },
          custom: {
            test_custom_field: {
              '*': {
                $leaf: '/custom/test_custom_field/*',
                actions: ['on', 'set']
              }
            },
            test_custom_field1: {
              $leaf: '/custom/test_custom_field1',
              actions: ['*']
            }
          }
        });
        done();
      });
    });

    it('tests the __loadPermissionSet method does permissions replacements, using a mocked identity with templated permissions', function(done) {
      initializeCheckpoint(function(e, checkpoint) {
        if (e) return done(e);
        var mockedIdentity = {
          user: {
            username: 'test_user',
            custom_data: {
              custom_field: 'test_custom_field',
              custom_field1: 'test_custom_field1'
            },
            groups: {
              test_group_1: {},
              test_group_2: {}
            }
          }
        };

        checkpoint.__loadPermissionSet(mockedIdentity, function(e, permissionSet) {
          if (e) return done(e);
          expect(permissionSet.tree).to.eql({
            test: {
              path: {
                '1': {
                  $leaf: 'test/path/1',
                  actions: ['get']
                },
                '2': {
                  $leaf: 'test/path/2',
                  actions: ['get']
                }
              }
            },
            gauge: {
              test_user: {
                '*': {
                  $leaf: '/gauge/test_user/*',
                  actions: ['on', 'set']
                }
              }
            },
            custom: {
              test_custom_field: {
                '*': {
                  $leaf: '/custom/test_custom_field/*',
                  actions: ['on', 'set']
                }
              },
              test_custom_field1: {
                $leaf: '/custom/test_custom_field1',
                actions: ['*']
              }
            }
          });
          done();
        });
      });
    });

    it('tests the __loadPermissionSet method does permissions replacements, using a mocked identity with templated permissions, ensures template elements that dont match the context (identity / session) are skipped', function(done) {
      initializeCheckpoint(function(e, checkpoint) {
        if (e) return done(e);
        var mockedIdentity = {
          user: {
            username: 'test_user',
            custom_data: {
              custom_field: 'test_custom_field',
              custom_field1: 'test_custom_field1'
            },
            groups: {
              test_group_1: {},
              test_group_2: {},
              test_group_3: {}
            }
          }
        };

        checkpoint.__loadPermissionSet(mockedIdentity, function(e, permissionSet) {
          if (e) return done(e);
          expect(permissionSet.tree).to.eql({
            test: {
              path: {
                '1': {
                  $leaf: 'test/path/1',
                  actions: ['get']
                },
                '2': {
                  $leaf: 'test/path/2',
                  actions: ['get']
                },
                '3': {
                  $leaf: 'test/path/3',
                  actions: ['get']
                }
              }
            },
            gauge: {
              test_user: {
                '*': {
                  $leaf: '/gauge/test_user/*',
                  actions: ['on', 'set']
                }
              }
            },
            custom: {
              test_custom_field: {
                '*': {
                  $leaf: '/custom/test_custom_field/*',
                  actions: ['on', 'set']
                }
              },
              test_custom_field1: {
                $leaf: '/custom/test_custom_field1',
                actions: ['*']
              }
            }
          });
          done();
        });
      });
    });
  }
);
