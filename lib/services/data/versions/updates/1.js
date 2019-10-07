var Promise = require('bluebird');
var async = require('async');

module.exports = Update1;

function Update1(updater) {
  this.updater = updater;
}

Update1.create = function(updater) {
  return new Update1(updater);
};

Update1.prototype.getUpdateRecords = function() {
  var _this = this;

  _this.updater.log('Update 1 about to start fetching update records');

  return new Promise(function(resolve, reject) {
    _this.updater.dataService.get('/_SYSTEM/_SECURITY/_GROUP/*', function(e, groups) {
      if (e) return reject(e);

      _this.updater.log('Update 1 have update records', { count: groups.length });

      resolve(groups);
    });
  });
};

Update1.prototype.backup = function(records) {
  var _this = this;

  _this.updater.log('Update 1 about to run backup');

  var report = { all: records.length, started: 0, completed: 0 };

  return new Promise(function(resolve, reject) {
    async.eachSeries(
      records,
      function(group, groupCB) {
        report.started++;

        _this.updater.dataService.upsert(
          '/_SYSTEM/DATABASE/BACKUPS/1/GROUP/' + group.data.name,
          group.data,
          function(e) {
            if (e) return groupCB(e);
            report.completed++;
            groupCB();
          }
        );
      },
      function(e) {
        _this.updater.log('Update 1 backup ran', report);

        if (e) return reject(e);

        resolve(records);
      }
    );
  });
};

function __escapePermissionsPath(path) {
  return path.replace(/\*/g, '{{w}}');
}

Update1.prototype.update = function(records) {
  var _this = this;

  _this.updater.log('Update 1 about to run update');

  var report = { all: 0, started: 0, completed: 0 };

  return new Promise(function(resolve, reject) {
    var permissions = [];

    records.forEach(function(group) {
      Object.keys(group.data.permissions).forEach(function(permissionPath) {
        if (group.data.permissions[permissionPath].actions) {
          group.data.permissions[permissionPath].actions.forEach(function(action) {
            permissions.push({
              permissionPath: permissionPath,
              action: action,
              groupName: group.data.name
            });
          });
        }
      });
    });

    report.all = permissions.length;

    async.eachSeries(
      permissions,
      function(permission, permissionCB) {
        report.started++;

        _this.updater.dataService.upsert(
          [
            '/_SYSTEM/_SECURITY/_PERMISSIONS',
            permission.groupName,
            permission.action,
            __escapePermissionsPath(permission.permissionPath)
          ].join('/'),
          {
            action: permission.action,
            authorized: true,
            path: permission.permissionPath
          },
          function(e) {
            if (e) return permissionCB(e);
            report.completed++;
            permissionCB();
          }
        );
      },
      function(e) {
        _this.updater.log('Update 1 update ran', report);
        if (e) return reject(e);
        resolve(records);
      }
    );
  });
};

Update1.prototype.rollback = function() {
  var _this = this;

  return new Promise(function(resolve) {
    _this.updater.log('Update1 rollback ran ok, unecessary');
    resolve();
  });
};
