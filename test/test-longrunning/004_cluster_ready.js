describe('longrunning/004_cluster_ready', function () {

  var expect = require('expect.js');
  var happn = require('../../lib/index');

  var service = happn.service;
  var happn_client = happn.client;

  var async = require('async');

  var INSTANCE_COUNT = 10;

  var INITIAL_PORT = 55100;

  var CLUSTER_OPERATION_TIME = 3000;

  var CLUSTER_TOTAL_CONNECTIONS = 0;

  var RANDOM_ACTIVITY_INTERVAL = 500;

  var random_activity = require("happn-random-activity-generator");

  var aggregatedLogs = [];

  function Cluster(){

    this.children = {};
    this.servers = {};

    this.logs = [];

    this.log = function(type, message){

      if (message == null) {
        message = type;
        type = null;
      }

      if (type == null) type = 'info';

      this.logs.push({timestamp:Date.now(), type:type, message:message});
    }
  }

  Cluster.prototype.addChild = function(instance, callback){

    var _this = this;

    var doCallback = function(e) {

      if (e) return callback(e);

      _this.children[instance.port] = instance;

      _this.servers[instance.port] = instance.server;//reference remains here

      return callback();
    };

    instance.parent = _this;

    var childPorts = Object.keys(_this.children);

    if (childPorts.length == 0) return doCallback();

    async.eachSeries(childPorts, function(childPort, childCB){

      var child = _this.children[childPort];

      child.connectTo(instance, function(e){

        if (e) return childCB(e);

        instance.connectTo(child, childCB);

      });

    }, doCallback);
  };

  Cluster.prototype.removeChild = function(port, callback){

    var _this = this;

    var childPorts = Object.keys(_this.children);

    if (childPorts.length == 0 || !_this.children[port]) return callback();

    async.eachSeries(childPorts, function(childPort, childCB){

      var child = _this.children[childPort];

      if (childPort === port.toString()) child.disconnectAll(childCB);

      else child.disconnectFrom(childPort, childCB);


    }, function(e){

      if (e) return callback(e);

      delete _this.children[port];

      callback();
    });
  };

  Cluster.prototype.stop = function(callback){

    var _this = this;

    //console.log('STOPPING CLUSTER:::');

    var serverPorts = Object.keys(_this.servers);

    if (serverPorts.length == 0) return callback();

    async.eachSeries(serverPorts, function(serverPort, serverCB){

      //console.log('STOPPING SERVER:::', serverPort);

      var server = _this.servers[serverPort];

      server.stop(function(e){

        if (e){
          //console.log('ERROR STOPPING SERVER:::', serverPort);
          return serverCB(e);
        }

        //console.log('STOPPED SERVER:::', serverPort);

        delete _this.servers[serverPort];

        return serverCB();
      });

    }, callback);
  };

  var CLUSTER = new Cluster();

  /*
   This test demonstrates starting up the happn service -
   the authentication service will use authTokenSecret to encrypt web tokens identifying
   the logon session. The utils setting will set the system to log non priority information
   */

  function ClusterChild(port, server){

    this.port = port;

    this.server = server;

    this.connections = {};//connections to other cluster nodes, keyed by port
  }

  ClusterChild.prototype.disconnectAll = function(callback){

    var _this = this;

    //console.log('DISCONNECT ALL:::' + _this.port);

    async.eachSeries(Object.keys(_this.connections), function(port, eachCB){

      _this.disconnectFrom(port, eachCB);

    }, callback);

  };

  ClusterChild.prototype.disconnectFrom = function(port, callback){

    var _this = this;

    if (_this.connections[port]){

      var connection = _this.connections[port];

      connection.randomActivity.generateActivityEnd(connection.code, function (aggregatedLog) {

        connection.activityLog = aggregatedLog;

        aggregatedLogs.push(aggregatedLog);

        connection.randomActivity.verify(function(e){

          if (e) console.warn('WARNING:::RANDOM_VERIFY' + e.toString());

          connection.client.disconnect(function(e){

            if (e) return callback(e);

            delete _this.connections[port];
            //console.log('DISCONNECTED:::' + connection.code);
            callback();

          });
        });
      });

    } else callback();
  };

  ClusterChild.prototype.connectTo = function(child, callback){

    var _this = this;

    var connectionCode = _this.port.toString() + '-' + child.port.toString();

    happn_client.create({port:child.port}, function(e, instance){

      if (e) return callback(e);

      var connection = {
        client:instance,
        code:connectionCode
      };

      connection.randomActivity = new random_activity(connection.client, {interval:RANDOM_ACTIVITY_INTERVAL, percentageOns:[0,1], percentageGets:[2,80], percentageSets:[81,95], percentageRemoves:[96,100], initialDataOnCount:1});

      connection.randomActivity.generateActivityStart(connection.code, function (e) {

        if (e) return callback(e);

        _this.connections[child.port] = connection;

        CLUSTER_TOTAL_CONNECTIONS++;

        callback();

      });
    });
  };

  it('starts ' + INSTANCE_COUNT + ' instances', function (callback) {

    this.timeout((INSTANCE_COUNT * 10000) + CLUSTER_OPERATION_TIME);

    var currentPort = INITIAL_PORT;

    async.timesSeries(INSTANCE_COUNT, function(counter, clientCB){

      //console.log('doing time:::', counter);

      service.create({port:currentPort}, function (e, instance) {

        if (e) return clientCB(e);

        var clusterChild = new ClusterChild(currentPort, instance);

        currentPort++;

        CLUSTER.addChild(clusterChild, clientCB);

      });

    }, function(e){

      if (e) return callback(e);

      setTimeout(callback, CLUSTER_OPERATION_TIME);

    });
  });

  it('stops ' + INSTANCE_COUNT + ' instances', function (callback) {

    this.timeout((INSTANCE_COUNT * 10000) + CLUSTER_OPERATION_TIME);

    var currentPort = INITIAL_PORT;

    async.timesSeries(INSTANCE_COUNT, function(counter, clientCB){

      //console.log('REMOVING CHILD:::', currentPort);

      CLUSTER.removeChild(currentPort, function(e){

        if (e) return clientCB(e);

        currentPort ++;

        clientCB();
      });

    }, function(e){

      if (e) return callback(e);

      expect(Object.keys(CLUSTER.children).length).to.be(0);
      expect(Object.keys(CLUSTER.servers).length).to.be(INSTANCE_COUNT);

      CLUSTER.stop(function(e){

        if (e) return callback(e);

        expect(Object.keys(CLUSTER.servers).length).to.be(0);

        console.log('RUN COMPLETE:::' + INSTANCE_COUNT + ' nodes generated ' + CLUSTER_TOTAL_CONNECTIONS + ' connections');
        console.log('-------AGGREGATED ACTIVITY-------');

        var aggregatedTotals = {on:0, get:0, remove:0, set:0};

        aggregatedLogs.forEach(function(log){

          aggregatedTotals.on += log.initial.on?log.initial.on:0;
          aggregatedTotals.get += log.initial.get?log.initial.get:0;
          aggregatedTotals.set += log.initial.set?log.initial.set:0;
          aggregatedTotals.remove += log.initial.remove?log.initial.remove:0;

          aggregatedTotals.get += log.get?log.get:0;
          aggregatedTotals.set += log.set?log.set:0;
          aggregatedTotals.remove += log.remove?log.remove:0;
          aggregatedTotals.on += log.on?log.on:0;

        });

        Object.keys(aggregatedTotals).forEach(function(activity){
          console.log(activity, aggregatedTotals[activity]);
        });

        callback();

      });
    })
  });
});
