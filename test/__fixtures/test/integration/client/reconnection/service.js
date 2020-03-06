var path = require('path');

var Happn = require(path.join('..', '..', '..', '..', '..', '..'));

var server;

var config = {
  port: 55005,
  secure:true
};

Happn.service.create(config)
  .then(function (_server) {
    server = _server;
  })
  .then(function () {
    console.log("READY");
    setInterval(() => {
      console.log("OPEN_SOCKETS" + Object.keys(server.services.session.__sessions).length);
    }, 1000);
  })
  .catch(function (e) {
    console.warn('service failed to start:::', e.toString());
    console.log("ERROR");
  });
