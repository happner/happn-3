var path = require('path');

var Happn = require(path.join('..', '..', '..', '..', '..', '..'));

var server;

var config = {
  port: 55005,
  secure:true,
  encryptPayloads:true
};

Happn.service.create(config)
  .then(function (_server) {
    server = _server;
    server.services.session.__oldHandleMessage = server.services.session.handleMessage;
    server.services.session.handleMessage = function (message, client) {
      if (['login', 'describe', 'configure-session'].indexOf(message.action) >= 0)
        return setTimeout(() => {
          server.services.session.__oldHandleMessage(message, client);
        }, 1000);
        server.services.session.__oldHandleMessage(message, client);
    };
  })
  .then(function () {
    //eslint-disable-next-line
    console.log("READY");
    setInterval(() => {
      //eslint-disable-next-line
      console.log("OPEN_SOCKETS" + Object.keys(server.services.session.__sessions).length);
    }, 1000);
  })
  .catch(function (e) {
    //eslint-disable-next-line
    console.warn('service failed to start:::', e.toString());
    //eslint-disable-next-line
    console.log("ERROR");
  });
