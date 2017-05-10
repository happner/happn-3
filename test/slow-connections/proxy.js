var httpProxy = require('http-proxy');
var http = require('http');

console.log('proxy listening on 55001');

var happn = require('../../lib/index');
var service = happn.service;
var happn_client = happn.client;

var happnInstance;
var clientInstance;

var latency = 10;

service.create({
  services:{
    session:{
      config:{
        primusOpts:{
          timeout:4000
        }
      }
    }
  }
}, function (e, happnInst) {

  if (e) return callback(e);

  happnInstance = happnInst;

  //
// Setup our server to proxy standard HTTP requests
//
  var proxy = new httpProxy.createProxyServer({
    target: {
      host: 'localhost',
      port: 55000
    }
  });

  var proxyServer = http.createServer(function (req, res) {
    proxy.web(req, res);
  });

  //
  // Listen to the `upgrade` event and proxy the
  // WebSocket requests as well.
  //
  proxyServer.on('upgrade', function (req, socket, head) {

    socket.__oldWrite = socket.write;

    socket.write = function(chunk, encoding, cb){
      var started = Date.now();
      setTimeout(function(){
        console.log('delay ms: ' + (Date.now() - started).toString());
        socket.__oldWrite(chunk, encoding, cb);
      }, latency);
    };

    proxy.ws(req, socket, head);
  });

  proxyServer.listen(55001);

  // // var proxyServer = httpProxy.createServer(function(req, res, proxy){
  // //   console.log('REQUEST::');
  // //   proxy.proxyRequest(req, res);
  // // }, {
  // //       target: 'ws://localhost:55000',
  // //       ws: true
  // //     });
  //
  // var httpProxy = require('http-proxy');
  //
  // var proxy = httpProxy.createProxyServer({
  //   target: 'ws://localhost:55000',
  //   ws: true
  // });
  //
  //
  //
  // var proxyServer = httpProxy.createServer(
  //   {
  //     target: 'ws://localhost:55000',
  //     ws: true
  //   }, function(req, socket, options, head){
  //
  //     console.log('ok and...');
  //   });
  //
  // proxyServer.listen(55001);

  happn_client.create({port:55001, ping:2000}, function (e, instance) {

    if (e) return console.log('set data broke:::', e);

    console.log('client connected and proxied:::');

    clientInstance = instance;

    latency = 5000;

    clientInstance.onEvent('reconnect-scheduled', function(){
      console.log('reconnect scheduled:::');
    });
  });
});
