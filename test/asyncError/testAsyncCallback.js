describe(
  require('../__fixtures/utils/test_helper')
    .create()
    .testName(__filename, 3),
  function() {
    this.timeout(20000);
    var async = require('async');
    var fs = require('fs');
    var expect = require('expect.js');
    var path = require('path');
    var HappnClient = require('../../lib/client');
    var Constants = require('../../lib/constants');

    function mockHappnClient(log, state, session, serverInfo, socket, clientOptions) {
      var happnClient = new HappnClient();

      happnClient.__initializeEvents();
      happnClient.__initializeState();
      happnClient.log = log || {
        error: function() {}
      };

      happnClient.status = state != null ? state : Constants.CLIENT_STATE.ACTIVE;
      happnClient.session = session || {
        id: 'test'
      };
      happnClient.serverInfo = serverInfo || {};

      happnClient.socket = socket || {
        removeAllListeners: function() {},
        write: function(message) {},
        on: function(eventName) {}
      };

      happnClient.options = clientOptions || {
        callTimeout: 60000
      };

      return happnClient;
    }

    it('tests the __performDataRequest function with __asyncErrorCallback overRidden. Supposed to Produce error', function(done) {
      this.timeout(200000);
      var happnClient = mockHappnClient();
      happnClient.status = 0;
      happnClient.__asyncErrorCallback = function(error, callback) {
        callback(error);
      };
      var count = 0;
      var arr = [];
      for (let i = 0; i < 1000000; i++) {
        arr.push(i);
      }
      async.each(
        arr,
        (item, itemCB) => {
          setTimeout(
            () =>
              happnClient.__performDataRequest(
                '/test/path',
                'set',
                {
                  test: 'data'
                },
                null,
                function(e, response) {
                  count++;
                  if (count % 1000 == 0) console.log(count / 1000);
                  itemCB(e);
                }
              ),
            Math.random * 1000
          );
        },
        (e, result) => {
          console.log(e);
          done();
        }
      );
    });
  }
);
