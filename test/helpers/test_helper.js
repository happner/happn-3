var Promise = require('bluebird')
  , async = require('async')
  , Happn = require('../..')
  , HappnService = Happn.service
  , HappnClient = Happn.client
  , sillyname = require('happn-sillyname')
  , uuid = require('uuid')
  , path = require('path')
  , fs = require('fs-extra')
  ;

  function TestHelper(){

  this.__activeServices = {};

  this.__testFiles = [];
}

TestHelper.prototype.newTestFile = function(options){

  var _this = this;

  if (!options) options = {};

  if (!options.dir) options.dir = 'test' + path.sep + 'tmp';

  if (!options.ext) options.ext = 'nedb';

  if (!options.name) options.name =  uuid.v4();

  var folderName = path.resolve(options.dir);

  fs.ensureDirSync(folderName);

  var fileName = folderName + path.sep + options.name + '.' + options.ext;

  var testRow = {"_id":"/_TEST_HELPER/TESTWRITE","data":{},"path":"/_TEST_HELPER/TESTWRITE","created":Date.now(),"modified":Date.now()};

  fs.writeFileSync(fileName, JSON.stringify(testRow));

  _this.__testFiles.push(fileName);

  return fileName;
};

TestHelper.prototype.deleteFiles = function(){

  var _this = this;

  var errors = 0;

  var deleted = 0;

  var lastError;

  _this.__testFiles.forEach(function(filename){
    try{
      fs.unlinkSync(filename);
      deleted++;
    }catch(e){
      lastError = e;
      errors++;
    }
  });

  var results = {deleted:deleted, errors:errors, lastError:lastError};

  return results;
};

TestHelper.prototype.startUp = Promise.promisify(function(configs, callback){

  if (typeof configs == 'function'){
    callback = configs;
    configs = null;
  }

  if (configs == null) return callback();

  if (!Array.isArray(configs)) return callback(new Error('configs not an Array, please pass in Array'));

  var _this = this;

  async.eachSeries(configs, function(config, configCB){
    _this.getService(config, configCB);
  }, callback);
});

TestHelper.prototype.__serviceExists = function(config){

  var nameExists = false;

  if (config.__isRemote) nameExists = this.__activeServices[config.name] != null;

  else nameExists = this.__activeServices[config.name] != null;

  if (nameExists) return true;

  for (var serviceName in this.__activeServices){
    var service = this.__activeServices[serviceName];
    if (service.config.port == config.port) return true;
  }

  return false;
};

TestHelper.prototype.findClient = function(options){

  if (options.id){

    var serviceId = options.id.split('@')[1];

    for (var serviceName in this.__activeServices){

      if (serviceName == serviceId){

        var service = this.__activeServices[serviceName];

        if (service.clients && service.clients.length > 0){

          for (var clientIndex in service.clients){

            var client = service.clients[clientIndex];

            if (client.id == options.id)  return client;
          }
        }

        return null;
      }
    }
  }

  return null;
};

TestHelper.prototype.getClient = Promise.promisify(function(config, callback){

  if (typeof config != 'object') return callback('cannot get a client without a config');

  if (!config.name) return callback('cannot get a client for unknown service name');

  if (!config.__testOptions) config.__testOptions = {};

  config.__testOptions.clientKey = uuid.v4() + '@' + config.name;//[client id]@[server key]

  var _this = this;

  if (config.__testOptions.clientType == 'local') {

    if (config.__testOptions.isRemote) return new Error('you cannot have a local client with a remote service');

    var serviceInstance = _this.__activeServices[config.name].instance;

    return serviceInstance.services.session.localClient(function(e, instance){

      if (e) return callback(e);

      if (_this.__activeServices[config.name].clients == null) _this.__activeServices[config.name].clients = [];

      var client = {instance:instance, id:config.__testOptions.clientKey};

      _this.__activeServices[config.name].clients.push(client);

      callback(null, client);
    });
  }

  var clientConfig = {port:_this.__activeServices[config.name].config.port};

  if (_this.__activeServices[config.name].config.secure){

    clientConfig.username = config.username || config.__testOptions.username || '_ADMIN';

    clientConfig.password = config.password || config.__testOptions.password || 'happn';

    if (clientConfig.password == 'happn' && _this.__activeServices[config.name].config.services &&
      _this.__activeServices[config.name].config.services.security &&
      _this.__activeServices[config.name].config.services.security.config &&
      _this.__activeServices[config.name].config.services.security.config.adminUser &&
      _this.__activeServices[config.name].config.services.security.config.adminUser.password
    ) clientConfig.password = _this.__activeServices[config.name].config.services.security.config.adminUser.password;

  }

  HappnClient.create(clientConfig, function (e, instance) {

    if (e) return callback(e);

    if (_this.__activeServices[config.name].clients == null) _this.__activeServices[config.name].clients = [];

    var client = {instance:instance, id:config.__testOptions.clientKey, config:clientConfig};

    _this.__activeServices[config.name].clients.push(client);

    callback(null, client);
  });
});

TestHelper.prototype.findService = function(options){

  if (options.id){

    if (this.__activeServices[options.id]) return this.__activeServices[options.id];
  }

  if (options.port){

    for (var serviceName in this.__activeServices){
      var service = this.__activeServices[serviceName];
      if (service.config && service.config.port == options.port)
          return service;
    }
  }

  return null;
};

TestHelper.prototype.restartService = function(options, callback){

  var _this = this;

  var service = _this.findService(options);

  if (service != null){

    var config = service.config;

    return _this.stopService(options, function(e){

      if (e) return callback(e);

      _this.getService(config, callback);
    });
  }

  callback(new Error('could not find service'));
};

TestHelper.prototype.getService = Promise.promisify(function(config, callback){

  var _this = this;

  if (typeof config == 'function'){
    callback = config;
    config = {};
  }

  if (!config.name) config.name = sillyname();

  if (!config.port) config.port = 55000;

  if (config.__testOptions == null) config.__testOptions = {};

  if (_this.__serviceExists(config)) return callback(new Error('service by the name ' + config.name + ' or port ' + config.port + ' already exists'));

  //console.log('getService:::', config.__testOptions);

  if (config.__testOptions.isRemote) return _this.startRemoteService(config, function(e, process){

    if (e) return callback(e);

    _this.__activeServices[config.name] = {instance:process, config:config};

    if (config.__testOptions.getClient) return _this.getClient(config, function(e, client){

      if (e) {
        return callback(new Error('started service ok but failed to get client: ' + e.toString()));
      }

      callback(null, {config:config, instance:process, client:client});
    });

    callback(null, {config:config, instance:process});
  });

  HappnService.create(config, function(e, instance){

    if (e) return callback(e);

    _this.__activeServices[config.name] = {instance:instance, config:config};

    if (config.__testOptions.getClient) return _this.getClient(config, function(e, client){

      if (e){
        return callback(new Error('started service ok but failed to get client: ' + e.toString()));
      }

      callback(null, {config:config, instance:instance, client:client});
    });

    callback(null, {config:config, instance:instance});
  });
});

TestHelper.prototype.disconnectClient = Promise.promisify(function(id, callback){

  var _this = this;

  var removed = false;

  var client = _this.findClient({id:id});

  if (!client) return callback(new Error('client with id: ' + id + ' not found'));

  client.instance.disconnect(function(e){

    if (e) return callback(e);

    var serviceId = id.split('@')[1];

    var service = _this.findService({id:serviceId});

    //remove the client from the services clients collection
    service.clients.every(function(serviceClient, serviceClientIndex){

      if (serviceClient.id == id){
        service.clients.splice(serviceClientIndex, 1);
        removed = true;
        return false;
      }
      return true;
    });

    return callback(null, removed);
  });
});

TestHelper.prototype.stopService = Promise.promisify(function(id, callback){

  var port = null;

  if (typeof id == 'object'){
    if (id.id) id = id.id;

    if (id.port) port = id.port;
  }

  if (typeof id == 'function') return id(new Error('id is necessary to stop a service.'));

  if (typeof id != 'string' && typeof id != 'number') return callback(new Error('id must be a string or number.'));

  var _this = this;

  for (var serviceId in _this.__activeServices){

    var activeService = _this.__activeServices[serviceId];

    if (serviceId == id || port != null && activeService.config.port == port){

      var completeStopService = function(){

        delete _this.__activeServices[serviceId];

        if (activeService.config.__testOptions.isRemote) {

          activeService.instance.kill();

          return callback();
        }

        return activeService.instance.stop(callback);
      };

      if (activeService.clients && activeService.clients.length > 0){

        return async.eachSeries(activeService.clients, function(activeServiceClient, activeServiceClientCB){
          //console.log('disconnecting client:::', activeServiceClient.id);
          _this.disconnectClient(activeServiceClient.id, activeServiceClientCB);
        }, function(e){

          if (e) {
            console.warn('unable to disconnect clients for service: ' + activeService.config.name);
          }

          completeStopService();
        });
      }

      return completeStopService();
    }
  }

  return callback(new Error('service with id ' + id + ' not found.'));
});

TestHelper.prototype.testClient = function(clientInstance, callback){

  var _this = this;

  var calledBack = false;

  var timeout = setTimeout(function(){
    raiseError('operations timed out');
  }, 2000);

  var raiseError = function(message){
    if (!calledBack){
      calledBack = true;
      return callback(new Error(message));
    }
  };

  var operations = '';

  clientInstance.on('/test/operations',

    function(data, meta){

      operations += meta.action.toUpperCase().split('@')[0].replace(/\//g, '');

      if (operations === 'SETREMOVE'){

        clearTimeout(timeout);

        callback();
      }

    }, function(e){

      if (e) return raiseError(e.toString());

      clientInstance.set('/test/operations', {test:'data'}, function(e){

        if (e) return raiseError(e.toString());

        clientInstance.remove('/test/operations', function(e){

          if (e) return raiseError(e.toString());
        });
      });
    });
};

TestHelper.prototype.testService = Promise.promisify(function(id, callback){

  var _this = this;

  if (!callback) throw new Error('callback cannot be null');

  if (typeof id != 'string' && typeof id != 'number'){
    return callback(new Error('id is necessary to test a service.'));
  }

  var service = _this.__activeServices[id];

  if (!service) return callback(new Error('unable to find service with id: ' + id));

  var localClientConfig = JSON.parse(JSON.stringify(service.config));

  localClientConfig.__testOptions.isLocal = true;

  var clientConfig = JSON.parse(JSON.stringify(service.config));

  clientConfig.__testOptions.isLocal = false;

  _this.getClient(localClientConfig, function(e, localClient){

    if (e) return callback(e);

    _this.testClient(localClient.instance, function(e){

      if (e) return callback(e);

      _this.disconnectClient(localClient.id, function(e){

        if (e) return callback(e);

        _this.getClient(clientConfig, function(e, client){

          if (e) return callback(e);

          _this.testClient(client.instance, function(e){

            if (e) return callback(e);

            _this.disconnectClient(client.id, callback);
          });
        });
      });
    });
  });
});

TestHelper.prototype.tearDown = Promise.promisify(function(options, callback){

  if (typeof options == 'function'){
    callback = options;
    options = {};
  }

  var timeout = Object.keys(this.__activeServices).length * 10000;

  var timedOut = false;

  if (options.ttl) {
    if (typeof options.ttl != 'number')
    timeout = options.ttl;
  }

  var timeoutHandle = setTimeout(function(){
    timedOut = true;
    return callback(new Error('tearDown timed out'));
  }, timeout);

  var _this = this;

  async.eachSeries(Object.keys(_this.__activeServices), function(activeServiceId, activeServiceCB){

    if (timedOut) return activeServiceCB(new Error('timed out'));

    //console.log('stopping service:::', activeServiceId);

    _this.stopService(activeServiceId, activeServiceCB);

  }, function(e){

    _this.deleteFiles();

    //console.log('stopped services:::', e);

    if (!timedOut) clearTimeout(timeoutHandle);

    callback(e);
  });
});

module.exports = TestHelper;
