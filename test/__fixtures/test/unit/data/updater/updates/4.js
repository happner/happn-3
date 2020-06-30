module.exports = Update4;

function Update4(updater, analysis){

  this.updater = updater;
  this.analysis = analysis;
}

Update4.create = function(updater, analysis){

  return new Update4(updater, analysis);
};

Update4.prototype.getUpdateRecords = function(){

  var _this = this;

  return new Promise(function(resolve, reject){

    _this.updater.log('Update4 getUpdateRecords ran ok');
    resolve([]);
  });
};

Update4.prototype.backup = function(records){

  var _this = this;

  return new Promise(function(resolve, reject){

    _this.updater.log('Update4 backup ran ok');
    resolve(records);
  });
};

Update4.prototype.update = function(records){

  return new Promise(function(resolve, reject){

    reject(new Error('test error'));
  });
};

Update4.prototype.rollback = function(records){

  var _this = this;

  return new Promise(function(resolve, reject){

    _this.updater.log('Update4 rollback ran ok');
    resolve();
  });
};
