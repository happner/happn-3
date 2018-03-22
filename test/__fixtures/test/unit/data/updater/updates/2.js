var Promise = require('bluebird');

module.exports = Update2;

function Update2(updater, analysis){

  this.updater = updater;
  this.analysis = analysis;
}

Update2.create = function(updater, analysis){

  return new Update2(updater, analysis);
};

Update2.prototype.getUpdateRecords = function(){

  var _this = this;

  return new Promise(function(resolve, reject){

    _this.updater.log('Update2 getUpdateRecords ran ok');
    resolve([]);
  });
};

Update2.prototype.backup = function(records){

  var _this = this;

  return new Promise(function(resolve, reject){

    _this.updater.log('Update2 backup ran ok');
    resolve(records);
  });
};

Update2.prototype.update = function(records){

  var _this = this;

  return new Promise(function(resolve, reject){

    _this.updater.log('Update2 update ran ok');
    resolve();
  });
};

Update2.prototype.rollback = function(records){

  var _this = this;

  return new Promise(function(resolve, reject){

    _this.updater.log('Update2 rollback ran ok');
    resolve();
  });
};
