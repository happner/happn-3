xdescribe(require('path').basename(__filename), function () {

  this.timeout(40000);

  var expect = require('expect.js');

  var httpProxy = require('http-proxy');
  var http = require('http');

  var happn = require('..');
  var service = happn.service;
  var happn_client = happn.client;

  var happnInstance;
  var clientInstance;

  var latency = 10;

  var events = {
    "skipped":[],
    "flatline":[],
    "reconnect-scheduled":[]
  };

  var heartBeatSkippedHandler = function(data){

    console.log('skipped:::', data);

    events["skipped"].push(data);
  };

  var flatLineHandler = function(data){

    console.log('flatline:::', data);

    events["flatline"].push(data);

    //bring down latency so our reconnect scheduled/successful events fire
    latency = 10;
  };

  before('starts up servers and proxy', function(callback){

    service.create({
      services:{
        session:{
          config:{
            primusOpts:{
              timeout:4000,
              allowSkippedHeartBeats:1
            },
            primusEvents:{
              "heartbeat-skipped":heartBeatSkippedHandler,
              "flatline":flatLineHandler
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

        callback();
    });
  });

  it('connects a client up - client eventually times out - we check to see the right events fired', function(callback){

    console.log('testing client:::');

    var eventsPassed = false;

    happn_client.create({port:55001, ping:2000}, function (e, instance) {

      if (e) return console.log('client create broke:::', e);

      //up the latency - heartbeats slower
      latency = 10000;

      console.log('client connected and proxied:::');

      clientInstance = instance;

      clientInstance.onEvent('reconnect-scheduled', function(){

        events["reconnect-scheduled"].push(Date.now());

        console.log('RECONNECT SCHEDULED:::');

        expect(events["skipped"].length).to.be(1);
        expect(events["flatline"].length).to.be(1);
        expect(events["reconnect-scheduled"].length).to.be(1);

        expect(events["skipped"][0] < events["flatline"][0]).to.be(true);
        expect(events["flatline"][0] < events["reconnect-scheduled"][0]).to.be(true);

        eventsPassed = true;

      });

      clientInstance.onEvent('reconnect-successful', function(){

        if (!eventsPassed) return callback(new Error('events did not pass'));

        callback();
      });
    });
  });
});
