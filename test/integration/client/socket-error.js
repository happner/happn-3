var path = require('path');
var Promise = require('bluebird');
var expect = require('expect.js');
var Happn = require('../../../');
var why = require('why-is-node-running');

describe(
  require('../../__fixtures/utils/test_helper')
    .create()
    .testName(__filename, 3),
  function() {
    var server;

    var startServer = function(callback) {
      Happn.service
        .create()
        .then(function(_server) {
          server = _server;
        })
        .then(callback)
        .catch(callback);
    };

    var stopServerDisconnect = function(callback) {
      if (!server) return callback();
      server.stop(
        {
          reconnect: false
        },
        function(e) {
          if (e) return callback(e);
          server = undefined; // ?? perhaps also on e, messy
          callback();
        }
      );
    };

    var stopServerReconnect = function(callback) {
      if (!server) return callback();
      server.stop(
        {
          reconnect: true
        },
        function(e) {
          if (e) return callback(e);
          server = undefined;
          callback();
        }
      );
    };

    before('start server', startServer);

    after('stop server', stopServerDisconnect);

    // after('why is node up', function(){
    //   why();
    // });

    it('fails to login', function(done) {
      var client;
      var reconnectScheduledFired = false;

      Promise.resolve()

        .then(function() {
          // other tests may have left the server stopped.
          if (server) return;
          return Promise.promisify(startServer)();
        })

        .then(function() {
          return Happn.client.create({ port: 55001 });
        })

        .catch(function(e) {
          expect(e.stack).to.not.be(null);
          expect(e.stack).to.not.be(undefined);
          expect(e.message).to.be('connect ECONNREFUSED 127.0.0.1:55001');
          expect(e.code).to.be('ECONNREFUSED');
          expect(e.errno).to.be('ECONNREFUSED');
          expect(e.syscall).to.be('connect');
          expect(e.address).to.be('127.0.0.1');
          expect(e.port).to.be(55001);
          done();
        });
    });
  }
);
