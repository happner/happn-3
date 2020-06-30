describe(
  require('../../__fixtures/utils/test_helper')
    .create()
    .testName(__filename, 3),
  function() {
    var happn = require('../../../lib/index');
    var serviceInstance;
    var async = require('async');
    var Promisify = require('util').promisify;

    var getService = function(config, callback) {
      happn.service.create(config, callback);
    };

    before('it starts completely defaulted service', function(done) {
      getService(
        {
          secure: true
        },
        function(e, service) {
          if (e) return done(e);
          serviceInstance = service;
          done();
        }
      );
    });

    after('should stop the services', function(callback) {
      serviceInstance.stop(function() {
        callback();
      });
    });

    const USERNAME = 'abcdefghijklmnopqrstuvwxyz';

    before('creates 20 users with substring usernames', function(done) {
      async.times(
        20,
        function(time, timeCB) {
          serviceInstance.services.security.users.upsertUser(
            {
              username: USERNAME.substring(0, time + 3),
              password: 'TEST PWD'
            },
            {
              overwrite: false
            },
            timeCB
          );
        },
        done
      );
    });

    it('checks to see that only the correct user is fetched', function(done) {
      async.times(
        20,
        function(time, timeCB) {
          var username = USERNAME.substring(0, time + 3);

          serviceInstance.services.security.users.getUser(
            username,
            {
              overwrite: false
            },
            function(e, user) {
              if (e) return timeCB(e);
              if (user.username !== username)
                return timeCB(
                  new Error('usernames do not match:' + user.username + ' ' + username)
                );
              timeCB();
            }
          );
        },
        done
      );
    });

    it('checks to see that only the correct user is fetched, negative test', function(done) {
      //NB NB - if ths test fails it is probably because the getUser function relies on a heavily changes user service
      // just skip it in futire

      serviceInstance.services.security.users.__oldGetUser =
        serviceInstance.services.security.users.getUser;

      serviceInstance.services.security.users.getUser = Promisify(
        function(userName, options, callback) {
          if (typeof options === 'function') {
            callback = options;
            options = {};
          }

          if (options.includeGroups === false) return this.getUserNoGroups(userName, callback);

          userName = userName.replace(/[*]/g, '');

          var userPath = '/_SYSTEM/_SECURITY/_USER/' + userName;

          var searchPath = userPath + '*';

          //TAKEN OUT TO PROVE TEST
          // var cachedUser = this.__cache_users.getSync(userName);
          //
          // if (cachedUser) return callback(null, cachedUser);

          this.dataService.get(
            searchPath,
            {
              sort: {
                path: 1
              }
            },
            (e, results) => {
              if (e) return callback(e);

              if (results.length === 0) return callback(null, null);

              var user = null;
              var password = null;
              var groups = {};

              results.forEach((userItem, userItemIndex) => {
                if (userItem.data && userItem.data.username) {
                  //if (userItem.data.username != userName) return;//ignore similar usernames due to wildcard TAKEN OUT TO PROVE TEST
                  password = userItem.data.password;
                  user = this.securityService.serialize('user', userItem, options);
                  return;
                }

                //we have found a group, add the group, by its name to the groups object
                if (results[userItemIndex]._meta.path.indexOf(userPath + '/') === 0) {
                  var groupName = results[userItemIndex]._meta.path.replace(
                    userPath + '/_USER_GROUP/',
                    ''
                  );
                  delete results[userItemIndex]._meta; //remove the _meta
                  groups[groupName] = results[userItemIndex];
                }
              });

              if (!user)
                return callback(new Error('group links exist for non-existing user: ' + userName));

              user.groups = groups;

              this.__cache_users.setSync(userName, user);
              this.__cache_passwords.setSync(userName, password);

              callback(null, user);
            }
          );
        }.bind(serviceInstance.services.security.users)
      );

      var badMatchFound = false;

      async.times(
        20,
        function(time, timeCB) {
          var username = USERNAME.substring(0, time + 3);

          serviceInstance.services.security.users.getUser(
            username,
            {
              overwrite: false
            },
            function(e, user) {
              if (e) return timeCB(e);
              if (user.username !== username) badMatchFound = true;
              timeCB();
            }
          );
        },
        function(e) {
          serviceInstance.services.security.users.getUser =
            serviceInstance.services.security.users.__oldGetUser;

          if (e) return done(e);
          if (!badMatchFound) return done(new Error('could not prove negative test'));
          done();
        }
      );
    });
  }
);
