var Promise = require('bluebird');

module.exports = Update3;

function Update3(updater, analysis){

  this.updater = updater;
  this.analysis = analysis;
}

Update3.create = function(updater, analysis){

  return new Update3(updater, analysis);
};

Update3.prototype.getUpdateRecords = function(){

  var _this = this;

  return new Promise(function(resolve, reject){

    _this.updater.log('Update3 getUpdateRecords ran ok');
    resolve([]);
  });
};

Update3.prototype.backup = function(records){

  var _this = this;

  return new Promise(function(resolve, reject){

    _this.updater.log('Update3 backup ran ok');
    resolve(records);
  });
};

Update3.prototype.update = function(records){

  var _this = this;

  return new Promise(function(resolve, reject){

    _this.updater.log('Update3 update ran ok');
    resolve();
  });
};

Update3.prototype.rollback = function(records){

  var _this = this;

  return new Promise(function(resolve, reject){

    _this.updater.log('Update3 rollback ran ok');
    resolve();
  });
};
