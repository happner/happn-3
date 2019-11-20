describe(
  require('../../__fixtures/utils/test_helper')
    .create()
    .testName(__filename, 3),
  function() {
    this.timeout(30000);
    const request = require('request');
    const expect = require('expect.js');
    const happn = require('../../../lib/index');
    const service = happn.service;

    const serverConfig = {
      secure: true,
      services: {
        security: {
          config: {
            lockTokenToLoginType: true,
            sessionTokenSecret: 'h1_test-secret',
            profiles:[
              {
                name: 'short-session',
                session: {
                  $and: [
                    {
                      user: {
                        username: {
                          $eq: 'user-short-session'
                        }
                      }
                    }
                  ]
                },
                policy: {
                  ttl: '5 seconds'
                }
              }
            ]
          }
        }
      }
    };

    it('we log in with a stateless (web based) request, we revoke the token and ensure the revocation expires with the token ttl', async() => {
      const server = await getServer(serverConfig);

      await upsertUser(server, {
        username:'user-short-session',
        password:'user-short-session-password'
      });

      const result = await doRequest('/auth/login?username=user-short-session&password=user-short-session-password', null, true);
      const token = JSON.parse(result.body).data;
      expect(token != null).to.be(true);

      

      stopServer(server);
    });

    function upsertUser(server, user){
      return new Promise((resolve, reject) => {
        server.services.security.users.upsertUser(user, (e, upserted) => {
          if (e) return reject(e);
          resolve(upserted);
        });
      });
    }

    function getServer(config){
      return new Promise((resolve, reject) => {
        service.create(config, function(e, instance) {
          if (e) return reject(e);
          resolve(instance);
        });
      });
    }

    function stopServer(server){
      return new Promise((resolve, reject) => {
        server.stop((e) => {
          if (e) return reject(e);
          resolve();
        });
      });
    }

    function getClient(config) {
      return happn.client.create(config);
    }

    function doRequest(path, body, token) {

      var options = {
        url: 'http://127.0.0.1:55000' + path
      };

      if (!token)
        options.url += '?happn_token=' + token;

      return new Promise((resolve, reject) => {
        request(options, function(error, response, body) {
          if (error) return reject(error);
          resolve({response, body});
        });
      });
    }
});
