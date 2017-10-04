var path = require('path');

var filename = path.basename(__filename);

var Promise = require('bluebird');

var expect = require('expect.js');

var Happn = require('../');

var shortid = require('shortid');

var Promise = require('bluebird');

describe(filename, function () {

  var remote;

  var webSocketsClient;

  var path = require('path');

  var spawn = require('child_process').spawn;

  var libFolder = path.join(__dirname, 'test-resources', 'g6');

  var events = [];

  this.timeout(15000);

  var clientEventHandler = function (data, meta) {
    events.push({
      data: data,
      meta: meta
    });
  };

  var testEvent = function (callback) {

    var eventId = shortid.generate();

    webSocketsClient.set('test/event/' + eventId, {
      id: eventId
    }, function (e) {

      if (e) return callback(e);

      setTimeout(function () {

        var eventData = events[events.length - 1];

        if (eventData.data.id != eventId) return callback(new Error('no event data found for id: ' + eventId));

        callback();

      }, 300);
    });
  };

  var startServer = function (callback) {

    remote = spawn('node', [path.join(libFolder, 'service.js')]);

    remote.stdout.on('data', function (data) {

      // console.log(data.toString());

      if (data.toString().match(/READY/)) {

        callback();
      }

      if (data.toString().match(/ERROR/)) return callback(new Error('failed to start server'));
    });
  };

  var buildUp = function (callback) {

    startServer(function (e) {

      if (e) return callback(e);
      connectClients(callback);

    });
  };

  var connectClients = function (callback) {

    console.log('CONNECTING CLIENTS:::');

    Happn.client.create({
      config: {
        port: 55005
      }
    }, function (e, instance) {

      if (e) return callback(e);

      console.log('CONNECTED CLIENTS:::');

      webSocketsClient = instance;

      webSocketsClient.on('test/event/*', clientEventHandler, function (e) {

        if (e) return callback(e);

        console.log('SUBSCRIBED:::');

        testEvent(function (e) {

          if (e) return callback(e);

          console.log('TESTED:::');

          callback();
        });
      });
    });
  };

  var killServer = function () {
    remote.kill();
  };

  var tearDown = function (callback) {

    try {

      if (webSocketsClient) webSocketsClient.disconnect(function () {
        killServer();
        callback();
      });
      else {
        killServer();
        callback();
      }
    } catch (e) {
      console.warn('teardown g6 failed:::', e);
    }
  };

  before('start server and connect client', buildUp);

  after('disconnect client and stop server', tearDown);

  it('kills the server, then restarts it, then tests the subscriptions still exist and work', function (done) {

    webSocketsClient.onEvent('reconnect-successful', function (data) {

      console.log('RECONNECT HAPPENED');
      testEvent(done);
    });

    killServer();

    startServer(function (e) {
      if (e) return done(e);
    });
  });
});
