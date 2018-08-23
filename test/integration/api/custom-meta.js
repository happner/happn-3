Happn = require('../../..');
var expect = require('expect.js');

describe(require('../../__fixtures/utils/test_helper').create().testName(__filename, 3), function () {

  var server, client;

  before('start server', function (done) {
    Happn.service.create()
      .then(function (_server) {
        server = _server;
      })
      .then(done)
      .catch(done);
  });

  before('start client', function (done) {
    Happn.client.create()
      .then(function (_client) {
        client = _client;
      })
      .then(done)
      .catch(done);
  });

  after('stop client', function (done) {
    if (!client) return done();
    client.disconnect(done);
  });

  after('stop server', function (done) {
    if (!server) return done();
    server.stop({
      reconnect: false
    }, done);
  });

  it('can pass custom meta via set to subscribers', function (done) {

    client.on('/some/path1', function (data, meta) {
      try {
        expect(meta.custom).to.be('value');
        done();
      } catch (e) {
        done(e);
      }
    }, function (e) {
      if (e) return done(e);

      client.set('/some/path1', {
        DATA: 1
      }, {
        meta: {
          custom: 'value'
        }
      }, function (e) {
        if (e) return done(e);
      });
    });

  });

  it('cannot add reserved meta key', function (done) {

    client.on('/some/path2', function (data, meta) {
      try {
        expect(meta.sessionId).to.not.be('value');
        done();
      } catch (e) {
        done(e);
      }
    }, function (e) {
      if (e) return done(e);

      client.set('/some/path2', {
        DATA: 1
      }, {
        meta: {
          sessionId: 'value'
        }
      }, function (e) {
        if (e) return done(e);
      });
    });

  });
});
