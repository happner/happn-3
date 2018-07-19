var path = require('path'),
  util = require('util'),
  EventEmitter = require('events').EventEmitter,
  async = require('async'),
  constants = require('../../constants'),
  Wildpare = require('wild-pare'),
  Promise = require('bluebird');

module.exports = SubscriptionService;

function SubscriptionService(opts) {

  this.log = opts.logger.createLogger('Subscription');

  this.log.$$TRACE('construct(%j)', opts);

}

// Enable subscription to key lifecycle events
util.inherits(SubscriptionService, EventEmitter);

SubscriptionService.prototype.initialize = function (config, callback) {

  var _this = this;

  try {

    if (!config) config = {};

    if (!config.mode) config.mode = 'wildstring';

    if (config.timeout) config.timeout = false;

    _this.dataService = _this.happn.services.data;
    _this.securityService = _this.happn.services.security;

    _this.subscriptions = {
      'set': Wildpare.create({mode: config.mode}),
      'remove': Wildpare.create({mode: config.mode}),
      'all': Wildpare.create({mode: config.mode})
    };

    _this.config = config;

    if (typeof _this.config.filter == 'function') {

      Object.defineProperty(_this, 'originalGetRecipients', {
        value: _this.getRecipients
      });

      _this.getRecipients = function (message, getRecipientsCallback) {

        _this.originalGetRecipients(message, function (e, recipients) {

          if (e) return getRecipientsCallback(e);

          try {
            _this.config.filter(message, recipients, function (e, filtered) {

              if (e) return getRecipientsCallback(e);

              getRecipientsCallback(null, filtered);
            });
          } catch (e) {
            getRecipientsCallback(e);
          }
        });
      };
    }

    callback();

  } catch (e) {

    callback(e);
  }
};

SubscriptionService.prototype.stats = function (opts) {

  var stats = {};

  return stats;
};

SubscriptionService.prototype.prepareSubscribeMessage = function (message, callback) {

  try {

    message.request.pathData = {
      parts: message.request.path.split('@')
    };

    message.request.pathData.action = message.request.pathData.parts[0].replace('/', '');

    if (message.request.pathData.parts.length > 2)
      message.request.key = message.request.pathData.parts.slice(1, message.request.pathData.parts.length).join('@');
    else if (message.request.pathData.parts.length == 1)
      message.request.key = message.request.pathData.parts[0];
    else message.request.key = message.request.pathData.parts[1];

    callback(null, message);

  } catch (e) {
    callback(e);
  }
};

SubscriptionService.prototype.processSubscribe = function (message, callback) {

  try {

    var _this = this;

    _this.addListener(message.request.pathData.action, message.request.key, message.session.id, {
      options: message.request.options,
      session: {id: message.session.id, protocol: message.session.protocol, info: message.session.info}
    }, function (e, reference) {

      if (e) return _this.happn.services.error.handleSystem(new Error('subscribe failed', e), 'SubscriptionService', constants.ERROR_SEVERITY.MEDIUM, function (e) {
        callback(e, message);
      });

      return _this.__doSubscriptionCallback(message, reference, callback);
    });

  } catch (e) {

    if (e) return this.happn.services.error.handleSystem(new Error('subscribe failed', e), 'SubscriptionService', constants.ERROR_SEVERITY.MEDIUM, function (e) {
      callback(e, message);
    });
  }
};

SubscriptionService.prototype.processUnsubscribe = function (message, callback) {

  try {

    var _this = this;

    var referenceId = false;

    if (message.request.options && message.request.options.referenceId) referenceId = message.request.options.referenceId;

    _this.removeListener(referenceId, message.session.id, message.request.pathData.action, message.request.key, function (e, references) {

      if (e) return _this.happn.services.error.handleSystem(new Error('unsubscribe failed', e), 'SubscriptionService', constants.ERROR_SEVERITY.HIGH, function (e) {
        callback(e, message);
      });

      message.response = {
        data: {id: referenceId, removed: references},
        _meta: {
          status: 'ok',
          type: 'response'
        }
      };

      return callback(null, message);

    });
  } catch (e) {

    this.happn.services.error.handleSystem(new Error('unsubscribe failed', e), 'SubscriptionService', constants.ERROR_SEVERITY.HIGH, function (e) {
      callback(e, message);
    });
  }
};

SubscriptionService.prototype.processGetRecipients = function (message, callback) {

  try {

    var _this = this;

    _this.getRecipients(message, function (e, recipients) {

      if (e) return _this.happn.services.error.handleSystem(new Error('get recipients failed', e), 'SubscriptionService', constants.ERROR_SEVERITY.MEDIUM, function (e) {
        callback(e, message);
      });

      message.recipients = recipients;

      return callback(null, message);
    });

  } catch (e) {

    this.happn.services.error.handleSystem(new Error('get recipients failed', e), 'SubscriptionService', constants.ERROR_SEVERITY.MEDIUM, function (e) {
      callback(e, message);
    });
  }
};

SubscriptionService.prototype.__filterTargetRecipients = function (targetClients, recipients, callback) {

  try {
    callback(null, recipients.filter(function (recipient) {
      return targetClients.indexOf(recipient.key) > -1;
    }));
  } catch (e) {
    callback(e);
  }
};

SubscriptionService.prototype.getRecipients = function (message, callback) {

  var _this = this;

  var recipients;

  _this.subscriptions[message.request.action.toLowerCase()]
    .searchAsync(message.request.path)
    .then(function (actionRecipients) {
      //set or remove
      recipients = actionRecipients;
      return _this.subscriptions.all.searchAsync(message.request.path);
    })
    .then(function (allActionsRecipients) {

      var combined = recipients.concat(allActionsRecipients);

      if (message.request.options && message.request.options.targetClients) return _this.__filterTargetRecipients(message.request.options.targetClients, combined, callback);
      callback(null, combined);
    })
    .catch(callback);
};

SubscriptionService.prototype.__doSubscriptionCallback = function (message, reference, callback) {

  var _this = this;

  var data = {
    data: {
      id: reference.id
    },
    _meta: {
      status: 'ok'
    }
  };

  var doCallback = function () {

    message.response = data;
    callback(null, message);
  };

  var dataPath = message.request.path.split('@')[1];

  if (message.request.options && (message.request.options.initialCallback || message.request.options.initialEmit)) {

    _this.dataService.get(dataPath, {
      sort: {
        'modified': 1
      }
    }, function (e, initialItems) {

      if (e) {
        data._meta.status = 'error';
        data.data = e.toString();
        return doCallback();
      }

      if (!initialItems) initialItems = [];

      if (initialItems && !Array.isArray(initialItems)) initialItems = [initialItems];

      data.initialValues = initialItems;

      doCallback();
    });

  } else doCallback();
};

SubscriptionService.prototype.addListener = function (action, path, sessionId, parameters, callback) {

  var _this = this;

  parameters.action = action;
  parameters.path = path;

  _this.subscriptions[action.toLowerCase()].addAsync(path, {key: sessionId, data: parameters})
    .then(function (reference) {
      callback(null, reference);
    })
    .catch(callback);
};

SubscriptionService.prototype.removeListener = function (referenceId, sessionId, action, path, callback) {

  if (action == '*' && path == '*') return this.clearSessionSubscriptions(sessionId, callback);

  this.subscriptions[action.toLowerCase()].removeAsync({path: path, key: sessionId, id: referenceId})
    .then(function (references) {
      callback(null, references);
    })
    .catch(callback);
};

SubscriptionService.prototype.clearSessionSubscriptions = function (sessionId, callback) {

  var _this = this;

  var removedReferences = [];

  _this.subscriptions.all.removeAsync({key: sessionId})
    .then(function (references) {
      removedReferences = removedReferences.concat(references);
      return _this.subscriptions.set.removeAsync({key: sessionId});
    })
    .then(function (references) {
      removedReferences = removedReferences.concat(references);
      return _this.subscriptions.remove.removeAsync({key: sessionId});
    })
    .then(function (references) {
      removedReferences = removedReferences.concat(references);
      callback(null, removedReferences);
      _this.emit('session-subscriptions-cleared', {sessionId: sessionId, references: references});
    })
    .catch(callback);

};

SubscriptionService.prototype.allListeners = function (sessionId) {

  var _this = this;
  var allListeners = [];

  return new Promise(function (resolve, reject) {

    _this.subscriptions.all.searchAsync({path: '*', filter: {key: sessionId}})
      .then(function (references) {
        references.forEach(function (reference) {
          reference.action = 'all';
          allListeners.push(reference);
        });
        return _this.subscriptions.set.searchAsync({path: '*', filter: {key: sessionId}});
      })
      .then(function (references) {
        references.forEach(function (reference) {
          reference.action = 'set';
          allListeners.push(reference);
        });
        return _this.subscriptions.remove.searchAsync({path: '*', filter: {key: sessionId}});
      })
      .then(function (references) {
        references.forEach(function (reference) {
          reference.action = 'remove';
          allListeners.push(reference);
        });
        resolve(allListeners);
      })
      .catch(reject);
  });
};

SubscriptionService.prototype.securityDirectoryChanged = function (whatHappnd, changedData, effectedSessions) {

  var _this = this;

  return new Promise(function (resolve, reject) {

    if (effectedSessions == null || effectedSessions.length == 0 || ['permission-removed', 'permission-upserted', 'unlink-group', 'delete-group', 'upsert-group', 'upsert-user'].indexOf(whatHappnd) == -1) return resolve(effectedSessions);

    async.each(effectedSessions, function (effectedSession, sessionCB) {

      _this.allListeners(effectedSession.id)

        .then(function (references) {

          async.eachSeries(references, function (reference, referenceCallback) {

            _this.securityService.checkpoint._authorizeUser(effectedSession, reference.path, 'on', function (e, authorized) {

              if (e) return referenceCallback(e);

              if (authorized) return referenceCallback();

              _this.removeListener(reference.id, effectedSession.id, reference.action, reference.path, referenceCallback);
            });
          }, sessionCB);
        })
        .catch(sessionCB);

    }, function (e) {
      if (e) return reject(e);
      resolve(effectedSessions);
    });

  });
};
