var Promise = require('bluebird');

module.exports = Update1;

function Update1(updater, analysis){

  this.updater = updater;
  this.analysis = analysis;
}

Update1.create = function(updater, analysis){

  return new Update1(updater, analysis);
};

Update1.prototype.getUpdateRecords = function(){

  var _this = this;

  return new Promise(function(resolve, reject){

    _this.updater.log('Update1 getUpdateRecords ran ok', {count:4});
    resolve([]);
  });
};

Update1.prototype.backup = function(records){

  var _this = this;

  return new Promise(function(resolve, reject){

    _this.updater.log('Update1 backup ran ok', {count:4});
    resolve(records);
  });
};

Update1.prototype.update = function(records){

  var _this = this;

  return new Promise(function(resolve, reject){

    _this.updater.log('Update1 update ran ok', {count:4});
    resolve();
  });
};

Update1.prototype.rollback = function(records){

  var _this = this;

  return new Promise(function(resolve, reject){

    _this.updater.log('Update1 rollback ran ok', {count:4});
    resolve();
  });
};
