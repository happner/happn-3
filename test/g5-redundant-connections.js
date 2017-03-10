describe('g5-redundant-connections', function () {

  var happn = require('../lib/index');
  var service = happn.service;
  var happn_client = happn.client;

  var _this = this;

  var service1Config = {
    port:55001
  };

  var service2Config = {
    port:55002
  };

  var service3Config = {
    port:55003
  };

  before('should initialize the services', function (done) {

    this.timeout(10000);

    service.create(service1Config, function (e, happnInst) {

      if (e) return done(e);

      _this.service1 = happnInst;

      service.create(service2Config, function (e, happnInst) {

        if (e) return done(e);

        _this.service2 = happnInst;

        service.create(service3Config, function (e, happnInst) {

          if (e) return done(e);

          _this.service3 = happnInst;

          done();
        });
      });
    });
  });

  before('it creates the test clients - adds test data', function(done){

    _this.service1.services.session.localClient(function(e, instance) {

      if (e) return done(e);

      _this.service1Client = instance;
      _this.service2.services.session.localClient(function(e, instance) {

        if (e) return done(e);

        _this.service2Client = instance;
        _this.service3.services.session.localClient(function(e, instance) {

          if (e) return done(e);

          _this.service3Client = instance;

          _this.service1Client.set('/test/path', {service:1})

            .then(function(){
              return _this.service2Client.set('/test/path', {service:2});
            })

            .then(function(){
              return _this.service3Client.set('/test/path', {service:3});
            })

            .then(done)
            .catch(done)

        });
      });
    });
  });

  xit ('initializes a client with multiple connections', function(done){

    var connections = [
      {info: {service: 1}, config: {port: 55001}},
      {info: {service: 2}, config: {port: 55002}},
      {info: {service: 3}, config: {port: 55003}}
    ];

    var info = {
      shared:'data'
    };

    var notConnectedTo = [
      1,2,3
    ];

    happn_client.create(connections, info, function(e, client){

      client.on('reconnect-successful', function(){

        client.get('/test/path', function(e, response){

          expect(notConnectedTo.indexOf(response.service) > -1).to.be(true);

          expect(notConnectedTo.indexOf(client.session.info.service) > -1).to.be(true);

          expect(client.session.info.shared).to.be('data');

          done();
        });
      });

      client.get('/test/path', function(e, response){

        var connectedTo = response.service;

        notConnectedTo.splice(connectedTo - 1, 1);

        expect(client.session.info.service).to.be(connectedTo);

        expect(client.session.info.shared).to.be('data');

        _this['service' + connectedTo].stop(function(e){

          if (e) return done(e);
        })
      });
    });
  })
});
