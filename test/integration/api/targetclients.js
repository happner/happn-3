describe(
  require('../../__fixtures/utils/test_helper')
    .create()
    .testName(__filename, 3),
  function() {
    var happn = require('../../../lib/index');
    var service = happn.service;
    var happn_client = happn.client;
    var happnInstanceSecure = null;
    var happnInstance = null;
    this.timeout(5000);
    before('should initialize the services', function(callback) {
      try {
        service.create(
          {
            port: 55002
          },
          function(e, happnInst) {
            if (e) return callback(e);
            happnInstance = happnInst;
            service.create(
              {
                secure: true,
                port: 55003
              },
              function(e, happnInst) {
                if (e) return callback(e);
                happnInstanceSecure = happnInst;
                callback();
              }
            );
          }
        );
      } catch (e) {
        callback(e);
      }
    });

    var secureClient;
    var secureMiddleman;
    var client;
    var middleman;

    after(function(done) {
      this.timeout(20000);

      secureClient.disconnect(
        {
          timeout: 2000
        },
        function(e) {
          if (e) console.warn('issue disconnecting secureClient');

          secureMiddleman.disconnect(
            {
              timeout: 2000
            },
            function(e) {
              if (e) console.warn('issue disconnecting secureMiddleman');

              client.disconnect(
                {
                  timeout: 2000
                },
                function(e) {
                  if (e) console.warn('issue disconnecting client');

                  middleman.disconnect(
                    {
                      timeout: 2000
                    },
                    function(e) {
                      if (e) console.warn('issue disconnecting middleman');

                      happnInstance.stop(function(e) {
                        if (e) console.warn('issue stopping unsecure instance');

                        happnInstanceSecure.stop(function(e) {
                          if (e) console.warn('issue stopping secure instance');
                          done();
                        });
                      });
                    }
                  );
                }
              );
            }
          );
        }
      );
    });
    before('should initialize the clients', function(callback) {
      happn_client.create(
        {
          port: 55002
        },
        function(e, instance) {
          if (e) return callback(e);
          client = instance;
          happn_client.create(
            {
              port: 55002
            },
            function(e, instance) {
              if (e) return callback(e);
              middleman = instance;
              happn_client.create(
                {
                  port: 55003,
                  username: '_ADMIN',
                  password: 'happn'
                },
                function(e, instance) {
                  if (e) return callback(e);
                  secureClient = instance;
                  happn_client.create(
                    {
                      port: 55003,
                      username: '_ADMIN',
                      password: 'happn'
                    },
                    function(e, instance) {
                      if (e) return callback(e);
                      secureMiddleman = instance;
                      callback();
                    }
                  );
                }
              );
            }
          );
        }
      );
    });

    it('should ensure a targeted publish does not go to an unsecured middle man', function(callback) {
      this.timeout(10000);

      var middlemanGotMessage = false;

      middleman.on(
        '/targeted/*',
        function() {
          middlemanGotMessage = true;
        },
        function(e) {
          if (e) return callback(e);
          client.on(
            '/targeted/*',
            function() {
              setTimeout(function() {
                if (middlemanGotMessage) return callback(new Error('middleman got message!!'));
                callback();
              }, 2000);
            },
            function(e) {
              if (e) return callback(e);
              client.set(
                '/targeted/test',
                {
                  test: 'value'
                },
                {
                  targetClients: [client.session.id]
                },
                function(e) {
                  if (e) return callback(e);
                }
              );
            }
          );
        }
      );
    });

    it('ensure an targeted publish gets to both unsecured clients', function(callback) {
      this.timeout(10000);

      var middlemanGotMessage = false;

      middleman.on(
        '/grouptargeted/*',
        function() {
          middlemanGotMessage = true;
        },
        function(e) {
          if (e) return callback(e);
          client.on(
            '/grouptargeted/*',
            function() {
              setTimeout(function() {
                if (!middlemanGotMessage) return callback(new Error('middleman got no message!!'));
                callback();
              }, 2000);
            },
            function(e) {
              if (e) return callback(e);
              client.set(
                '/grouptargeted/test',
                {
                  test: 'value'
                },
                {
                  targetClients: [client.session.id, middleman.session.id]
                },
                function(e) {
                  if (e) return callback(e);
                }
              );
            }
          );
        }
      );
    });

    it('ensures an un-targeted publish gets to both unsecured clients', function(callback) {
      this.timeout(10000);

      var middlemanGotMessage = false;

      middleman.on(
        '/untargeted/*',
        function() {
          middlemanGotMessage = true;
        },
        function(e) {
          if (e) return callback(e);
          client.on(
            '/untargeted/*',
            function() {
              setTimeout(function() {
                if (!middlemanGotMessage) return callback(new Error('middleman got no message!!'));
                callback();
              }, 2000);
            },
            function(e) {
              if (e) return callback(e);
              client.set(
                '/untargeted/test',
                {
                  test: 'value'
                },
                function(e) {
                  if (e) return callback(e);
                }
              );
            }
          );
        }
      );
    });

    it('should ensure a targeted publish does not go to an secured middle man', function(callback) {
      this.timeout(10000);

      var secureMiddlemanGotMessage = false;

      secureMiddleman.on(
        '/targeted/*',
        function() {
          secureMiddlemanGotMessage = true;
        },
        function(e) {
          if (e) return callback(e);
          secureClient.on(
            '/targeted/*',
            function() {
              setTimeout(function() {
                if (secureMiddlemanGotMessage)
                  return callback(new Error('secureMiddleman got message!!'));
                callback();
              }, 2000);
            },
            function(e) {
              if (e) return callback(e);
              secureClient.set(
                '/targeted/test',
                {
                  test: 'value'
                },
                {
                  targetClients: [secureClient.session.id]
                },
                function(e) {
                  if (e) return callback(e);
                }
              );
            }
          );
        }
      );
    });

    it('ensure an targeted publish gets to both secured secureClients', function(callback) {
      this.timeout(10000);
      var secureMiddlemanGotMessage = false;
      secureMiddleman.on(
        '/grouptargeted/*',
        function() {
          secureMiddlemanGotMessage = true;
        },
        function(e) {
          if (e) return callback(e);
          secureClient.on(
            '/grouptargeted/*',
            function() {
              setTimeout(function() {
                if (!secureMiddlemanGotMessage)
                  return callback(new Error('secureMiddleman got no message!!'));
                callback();
              }, 2000);
            },
            function(e) {
              if (e) return callback(e);
              secureClient.set(
                '/grouptargeted/test',
                {
                  test: 'value'
                },
                {
                  targetClients: [secureClient.session.id, secureMiddleman.session.id]
                },
                function(e) {
                  if (e) return callback(e);
                }
              );
            }
          );
        }
      );
    });

    it('ensures an un-targeted publish gets to both secured secureClients', function(callback) {
      this.timeout(10000);

      var secureMiddlemanGotMessage = false;

      secureMiddleman.on(
        '/untargeted/*',
        function() {
          secureMiddlemanGotMessage = true;
        },
        function(e) {
          if (e) return callback(e);
          secureClient.on(
            '/untargeted/*',
            function() {
              setTimeout(function() {
                if (!secureMiddlemanGotMessage)
                  return callback(new Error('secureMiddleman got no message!!'));
                callback();
              }, 2000);
            },
            function(e) {
              if (e) return callback(e);
              secureClient.set(
                '/untargeted/test',
                {
                  test: 'value'
                },
                function(e) {
                  if (e) return callback(e);
                }
              );
            }
          );
        }
      );
    });
  }
);
