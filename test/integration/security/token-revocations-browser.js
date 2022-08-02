describe(
  require('../../__fixtures/utils/test_helper')
    .create()
    .testName(__filename, 3),
  function() {
    this.timeout(30000);
    const delay = require('await-delay');
    const expect = require('expect.js');
    const happn = require('../../../lib/index');
    const service = happn.service;

    const serverConfig = {
      secure: true,
      services: {
        security: {
          config: {
            sessionTokenSecret: 'h1_test-secret',
            profiles: [
              {
                name: 'default-browser', // this is the default underlying profile for stateful sessions
                session: {
                  $and: [
                    {
                      info: {
                        _browser: {
                          $eq: true
                        }
                      }
                    }
                  ]
                },
                policy: {
                  ttl: '10 seconds', //a week
                  inactivity_threshold: '5 seconds'
                }
              }
            ]
          }
        }
      }
    };

    it('logs in with a _browser request, then does a series of logins with with the original token, we revoke the token and ensure all children sessions have been disconnected', async () => {
      const server = await getServer(serverConfig);
      await upsertUser(server, {
        username: 'user-short-session',
        password: 'user-short-session-password'
      });
      const client1 = await getClient({
        username: 'user-short-session',
        password: 'user-short-session-password',
        info: {
          _browser: true
        }
      });
      const clientsSessionEvents = {};
      client1.onEvent('session-ended', evt => {
        clientsSessionEvents['session-ended-1'] = evt;
      });
      const client2 = await getClient({
        username: 'user-short-session',
        token: client1.session.token,
        info: {
          _browser: true
        }
      });
      client2.onEvent('session-ended', evt => {
        clientsSessionEvents['session-ended-2'] = evt;
      });
      const client3 = await getClient({
        username: 'user-short-session',
        token: client1.session.token,
        info: {
          _browser: true
        }
      });
      client3.onEvent('session-ended', evt => {
        clientsSessionEvents['session-ended-3'] = evt;
      });
      const client4 = await getClient({
        username: 'user-short-session',
        token: client1.session.token,
        info: {
          _browser: true
        }
      });
      client4.onEvent('session-ended', evt => {
        clientsSessionEvents['session-ended-4'] = evt;
      });

      await revokeToken(server, client1.session.token);
      await delay(1000);

      expect(clientsSessionEvents).to.eql({
        'session-ended-1': {
          reason: 'token-revoked'
        },
        'session-ended-2': {
          reason: 'token-revoked'
        },
        'session-ended-3': {
          reason: 'token-revoked'
        },
        'session-ended-4': {
          reason: 'token-revoked'
        }
      });
      stopServer(server);
    });

    it('logs in with a _browser request, then does a series of logins with with the original token, we revoke the token via a client disconnect ensure all children sessions have been disconnected', async () => {
      const server = await getServer(serverConfig);
      await upsertUser(server, {
        username: 'user-short-session',
        password: 'user-short-session-password'
      });
      const client1 = await getClient({
        username: 'user-short-session',
        password: 'user-short-session-password',
        info: {
          _browser: true
        }
      });
      const clientsSessionEvents = {};
      client1.onEvent('session-ended', evt => {
        clientsSessionEvents['session-ended-1'] = evt;
      });
      const client2 = await getClient({
        username: 'user-short-session',
        token: client1.session.token,
        info: {
          _browser: true
        }
      });
      client2.onEvent('session-ended', evt => {
        clientsSessionEvents['session-ended-2'] = evt;
      });
      const client3 = await getClient({
        username: 'user-short-session',
        token: client1.session.token,
        info: {
          _browser: true
        }
      });
      client3.onEvent('session-ended', evt => {
        clientsSessionEvents['session-ended-3'] = evt;
      });
      const client4 = await getClient({
        username: 'user-short-session',
        token: client1.session.token,
        info: {
          _browser: true
        }
      });
      client4.onEvent('session-ended', evt => {
        clientsSessionEvents['session-ended-4'] = evt;
      });

      await client1.disconnect({ revokeToken: true });
      await delay(1000);

      expect(clientsSessionEvents).to.eql({
        'session-ended-1': {
          reason: 'token-revoked'
        },
        'session-ended-2': {
          reason: 'token-revoked'
        },
        'session-ended-3': {
          reason: 'token-revoked'
        },
        'session-ended-4': {
          reason: 'token-revoked'
        }
      });
      stopServer(server);
    });

    it('logs in with a _browser request, then does a series of logins with with the original token, we revoke the token via a client disconnect using revokeSession:true ensure all children sessions have been disconnected', async () => {
      const server = await getServer(serverConfig);
      await upsertUser(server, {
        username: 'user-short-session',
        password: 'user-short-session-password'
      });
      const client1 = await getClient({
        username: 'user-short-session',
        password: 'user-short-session-password',
        info: {
          _browser: true
        }
      });
      const clientsSessionEvents = {};
      client1.onEvent('session-ended', evt => {
        clientsSessionEvents['session-ended-1'] = evt;
      });
      const client2 = await getClient({
        username: 'user-short-session',
        token: client1.session.token,
        info: {
          _browser: true
        }
      });
      client2.onEvent('session-ended', evt => {
        clientsSessionEvents['session-ended-2'] = evt;
      });
      const client3 = await getClient({
        username: 'user-short-session',
        token: client1.session.token,
        info: {
          _browser: true
        }
      });
      client3.onEvent('session-ended', evt => {
        clientsSessionEvents['session-ended-3'] = evt;
      });
      const client4 = await getClient({
        username: 'user-short-session',
        token: client1.session.token,
        info: {
          _browser: true
        }
      });
      client4.onEvent('session-ended', evt => {
        clientsSessionEvents['session-ended-4'] = evt;
      });

      await client1.disconnect({ revokeSession: true });
      await delay(1000);

      expect(clientsSessionEvents).to.eql({
        'session-ended-1': {
          reason: 'token-revoked'
        },
        'session-ended-2': {
          reason: 'token-revoked'
        },
        'session-ended-3': {
          reason: 'token-revoked'
        },
        'session-ended-4': {
          reason: 'token-revoked'
        }
      });
      stopServer(server);
    });

    it('logs in with a _browser request, then does a series of logins with with the original token, we revoke the token via a client child disconnect ensure all children and parent sessions have been disconnected', async () => {
      const server = await getServer(serverConfig);
      await upsertUser(server, {
        username: 'user-short-session',
        password: 'user-short-session-password'
      });
      const client1 = await getClient({
        username: 'user-short-session',
        password: 'user-short-session-password',
        info: {
          _browser: true
        }
      });
      const clientsSessionEvents = {};
      client1.onEvent('session-ended', evt => {
        clientsSessionEvents['session-ended-1'] = evt;
      });
      const client2 = await getClient({
        username: 'user-short-session',
        token: client1.session.token,
        info: {
          _browser: true
        }
      });
      client2.onEvent('session-ended', evt => {
        clientsSessionEvents['session-ended-2'] = evt;
      });
      const client3 = await getClient({
        username: 'user-short-session',
        token: client1.session.token,
        info: {
          _browser: true
        }
      });
      client3.onEvent('session-ended', evt => {
        clientsSessionEvents['session-ended-3'] = evt;
      });
      const client4 = await getClient({
        username: 'user-short-session',
        token: client1.session.token,
        info: {
          _browser: true
        }
      });
      client4.onEvent('session-ended', evt => {
        clientsSessionEvents['session-ended-4'] = evt;
      });

      await client4.disconnect({ revokeToken: true });
      await delay(1000);

      expect(clientsSessionEvents).to.eql({
        'session-ended-4': { reason: 'token-revoked' },
        'session-ended-1': {
          reason: 'token-revoked'
        },
        'session-ended-2': {
          reason: 'token-revoked'
        },
        'session-ended-3': {
          reason: 'token-revoked'
        }
      });
      stopServer(server);
    });

    function upsertUser(server, user) {
      return new Promise((resolve, reject) => {
        server.services.security.users.upsertUser(user, (e, upserted) => {
          if (e) return reject(e);
          resolve(upserted);
        });
      });
    }

    function getServer(config) {
      return new Promise((resolve, reject) => {
        service.create(config, function(e, instance) {
          if (e) return reject(e);
          resolve(instance);
        });
      });
    }

    function stopServer(server) {
      return new Promise((resolve, reject) => {
        server.stop(e => {
          if (e) return reject(e);
          resolve();
        });
      });
    }

    function getClient(config) {
      return new Promise((resolve, reject) => {
        happn.client.create(config, (e, instance) => {
          if (e) return reject(e);
          resolve(instance);
        });
      });
    }

    function revokeToken(server, token) {
      return new Promise((resolve, reject) => {
        server.services.security.revokeToken(token, 'test reason', e => {
          if (e) return reject(e);
          resolve();
        });
      });
    }
  }
);
