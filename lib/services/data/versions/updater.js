module.exports = Updater;

var path = require('path');
var fs = require('fs');
var async = require('async');

function Updater(dataService, systemService, options){

  if (!options) options = {};

  if (!options.updatesDirectory) options.updatesDirectory = path.resolve('./updates');

  this.dataService = dataService;
  this.systemService = systemService;
  this.options = options;
  this.__logs = [];
}

Updater.prototype.analyzeDB = analyzeDB;
Updater.prototype.writeVersionToDB = writeVersionToDB;
Updater.prototype.updateDB = updateDB;
Updater.prototype.log = log;
Updater.prototype.rollbackDB = rollbackDB;

function analyzeDB(callback){

  var _this = this;
  var analysis = {moduleDBVersion:_this.systemService.package.database || "0", isNew:false};

  //the secure or unsecure configurations always push a user in here
  _this.dataService.get('/_SYSTEM/_SECURITY/_USER/_ADMIN', function(e, user){

    if (e) return callback(e);

    if (!user) {

      analysis.isNew = true;
      analysis.currentDBVersion = _this.systemService.package.database;
      analysis.matchingVersion = true;
      return callback(null, analysis);
    }

    _this.dataService.get('/_SYSTEM/_DATABASE/_VERSION', function(e, version) {

      if (e) return callback(e);

      if (version == null) analysis.currentDBVersion = "0";
      else analysis.currentDBVersion = version.data.value;

      analysis.matchingVersion = analysis.currentDBVersion == analysis.moduleDBVersion;

      callback(null, analysis);
    });
  });
}

function writeVersionToDB(version, resolve, reject){

  var _this = this;

  _this.dataService.upsert('/_SYSTEM/_DATABASE/_VERSION', version, function(e) {

    if (e) return reject(e);
    resolve();
  });
}

function log(message, data, logType){

  if (!logType) logType = 'info';

  this.__logs.push({
    message:message,
    data:data,
    timestamp:Date.now(),
    logType:logType
  });
}

function rollbackDB(analysis, originalError, records, callback){

  var _this = this;

  var updates = fs.readdirSync(_this.options.updatesDirectory);

  updates = updates.slice(0, parseInt(analysis.moduleDBVersion));

  updates.sort(function(a, b) {
    return b - a;
  });

  console.log('rollback updates:::', updates);

  async.eachSeries(updates, function(updateFileName, updateComplete){

    var update = require(_this.options.updatesDirectory + '/' + updateFileName).create(_this, analysis);

    update.rollback(records).then(updateComplete).catch(updateComplete);

  }, function(e){

    if (e) return callback(originalError, _this.__logs, false);
    callback(originalError, _this.__logs, true);
  });
}

function updateDB(analysis, resolve, reject) {

  var _this = this;

  var updates = fs.readdirSync(_this.options.updatesDirectory);

  updates.sort(function(a, b) {
    return a - b;
  });

  updates = updates.slice(0, parseInt(analysis.moduleDBVersion));

  var updateRecords;

  async.eachSeries(updates, function(updateFileName, updateComplete){

    var update = require(_this.options.updatesDirectory + '/' + updateFileName).create(_this, analysis);

    update.getUpdateRecords()
      .then(function(records){
        updateRecords = records;
        return update.backup(records);
      })
      .then(function(records){
        return update.update(records);
      })
      .then(function(){
        updateComplete();
      })
      .catch(function(e){
        updateComplete(e);
      });

  }, function(e){
    //analysis, originalError, records, callback
    if (e) return _this.rollbackDB(analysis, e, updateRecords, reject);
    resolve(_this.__logs);
  });

  //we loop through the updates doing backup, update, and possibly rollback
}
