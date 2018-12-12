var path = require('path');

var Happn = require(path.join('..', '..', '..', '..', '..', '..'));

var server;

var config = {
  port: 55005
};

Happn.service
  .create(config)
  .then(function(_server) {
    server = _server;
  })
  .then(function() {
    console.log('READY');
  })
  .catch(function(e) {
    console.warn('service failed to start:::', e.toString());
    console.log('ERROR');
  });
