var CONSISTENCY = require('../../../').constants.CONSISTENCY;
var async = require('async');
const constants = require('../../../').constants;

const BaseHappnProtocol = require('./happn_base');

class ProtocolHappn1 extends BaseHappnProtocol {
  constructor(opts) {
    super(opts);
    this.__subscriptionMappingsReferenceId = {};
    this.__subscriptionMappingsListenerId = {};
  }

  static create(opts) {
    return new ProtocolHappn1(opts);
  }

  initialize() {
    this.happn.services.session.on('client-disconnect', sessionId => {
      //clear our reference cache
      delete this.__subscriptionMappingsReferenceId[sessionId];
      delete this.__subscriptionMappingsListenerId[sessionId];
    });
  }

  transformIn(message) {
    if (message.raw.encrypted || (message.raw.data && message.raw.data.encrypted)) {
      if (message.raw.action === 'login') {
        message.request = {
          action: message.raw.action
        };

        if (message.raw.data.encrypted.type === 'Buffer')
          message.raw.data.encrypted = message.raw.data.encrypted.data;

        message.request.data = JSON.parse(
          this.happn.services.crypto
            .asymmetricDecrypt(
              message.raw.data.publicKey,
              this.happn.services.security._keyPair.privateKey,
              message.raw.data.encrypted
            )
            .toString()
        );
        message.request.publicKey = message.raw.data.publicKey;
        message.request.eventId = message.raw.eventId;

        message.request.data.isEncrypted = true; //letting the security service know by adding this to the credentials
        message.session.isEncrypted = true; //for this call down as well

        delete message.raw;
        return this.validate(message);
      }
      message.request = this.happn.services.crypto.symmetricDecryptObject(
        message.raw.encrypted,
        message.session.secret
      );
    } else message.request = message.raw; //no transform necessary

    delete message.raw;

    if (message.request) {
      if (
        message.request.action === 'off' &&
        message.request.options &&
        message.request.options.refCount != null
      ) {
        if (this.__subscriptionMappingsReferenceId[message.request.sessionId])
          //may be a full disconnect
          message.request.options.referenceId = this.__subscriptionMappingsReferenceId[
            message.request.sessionId
          ][message.request.options.refCount];
      }
      if (
        message.request.action === 'set' &&
        message.request.options &&
        message.request.options.nullValue
      )
        message.request.data = null; //null values dont get passed across the wire
    }

    return this.validate(message);
  }

  transformSystem(message) {
    if (message.action === 'disconnect') {
      var options = message.options ? message.options : {};

      if (options.reconnect == null) options.reconnect = true;
      if (options.reason == null) options.reason = 'server side disconnect';

      message.response = {
        _meta: {
          type: 'system'
        },
        eventKey: 'server-side-disconnect',
        data: options.reason,
        reconnect: options.reconnect
      };
    }

    if (message.eventKey === 'security-data-changed') message.__suppress = true;

    return message;
  }

  __initialEmit(message, data, callback) {
    var session = message.session;
    var request = message.request;

    async.eachSeries(
      data,
      (itemData, itemDataCallback) => {
        var requestParts = request.path.split('@');

        var publication = {
          _meta: {},
          data: itemData
        };

        var initialMessage = {
          request: request,
          session: session,
          response: publication,
          recipients: [
            {
              data: {
                sessionId: session.id,
                action: requestParts[0].replace('/', ''),
                session: {
                  protocol: this.protocolVersion,
                  id: session.id
                },
                path: requestParts[1]
              }
            }
          ],
          options: {
            consistency: CONSISTENCY.TRANSACTIONAL
          }
        };

        this.happn.services.publisher.processPublish(initialMessage, itemDataCallback);
      },
      e => {
        if (e)
          return this.happn.services.error.handleSystem(
            new Error('processInitialEmit failed', e),
            'PublisherService',
            constants.ERROR_SEVERITY.MEDIUM,
            function(e) {
              callback(e, message);
            }
          );

        callback(null, message);
      }
    );
  }

  __pruneSubscriptionMappings(sessionId, references) {
    var _this = this;

    if (!references.forEach) return;

    if (_this.__subscriptionMappingsListenerId[sessionId]) {
      //dont do anything if we are off * or path

      references.forEach(function(reference) {
        var refCount = _this.__subscriptionMappingsListenerId[sessionId][reference.id];

        delete _this.__subscriptionMappingsListenerId[sessionId][reference.id];

        if (refCount) delete _this.__subscriptionMappingsReferenceId[sessionId][refCount];

        if (Object.keys(_this.__subscriptionMappingsListenerId[sessionId]).length === 0)
          delete _this.__subscriptionMappingsListenerId[sessionId];
        if (Object.keys(_this.__subscriptionMappingsReferenceId[sessionId]).length === 0)
          delete _this.__subscriptionMappingsReferenceId[sessionId];
      });
    }
  }

  __transformResponse(message, response) {
    //PROTOCOL 2.0.0 adjustments:

    var request = message.request;

    var transformedMeta = response._meta;
    var transformedData = response.data;

    if (!request.options) request.options = {};

    if (Array.isArray(response)) {
      if (response.length < 2) return response;

      transformedMeta = response[response.length - 1];
      transformedData = response.slice(0, response.length - 2);
    }

    if (transformedMeta.action === 'on' && transformedMeta.status === 'ok') {
      if (this.__subscriptionMappingsReferenceId[transformedMeta.sessionId] == null)
        this.__subscriptionMappingsReferenceId[transformedMeta.sessionId] = {};
      if (this.__subscriptionMappingsListenerId[transformedMeta.sessionId] == null)
        this.__subscriptionMappingsListenerId[transformedMeta.sessionId] = {};

      this.__subscriptionMappingsReferenceId[transformedMeta.sessionId][request.options.refCount] =
        transformedData.id;
      this.__subscriptionMappingsListenerId[transformedMeta.sessionId][transformedData.id] =
        request.options.refCount;

      if (request.options.initialEmit && transformedData.length > 0) {
        this.__initialEmit(message, transformedData, e => {
          if (e)
            return this.happn.services.error.handleSystem(
              new Error('initialEmit failed', e),
              'ProtocolHappn1',
              constants.ERROR_SEVERITY.MEDIUM
            );
        });
      }
    }

    if (transformedMeta.action === 'off' && transformedMeta.status === 'ok')
      this.__pruneSubscriptionMappings(transformedMeta.sessionId, transformedData.removed);

    return response;
  }

  __createResponse(e, message, response, opts) {
    var _meta = {};

    var local = opts ? opts.local : false;

    if (response == null)
      response = {
        data: null
      };
    else {
      if (response._meta) _meta = response._meta;
      if (response.paths) response = response.paths;
    }

    _meta.type = 'response';
    _meta.status = 'ok';

    if (_meta.published == null) _meta.published = false;
    delete _meta._id;

    if (message) {
      _meta.eventId = message.eventId;
      //we need these passed in case we are encrypting the resulting payload
      if (['login', 'describe'].indexOf(message.action) === -1) _meta.sessionId = message.sessionId;
      _meta.action = message.action;
    }

    response._meta = _meta;
    response.protocol = this.protocolVersion;

    if (e) {
      response._meta.status = 'error';

      response._meta.error = {};

      if (e.name == null) response._meta.error.name = e.toString();
      else response._meta.error.name = e.name;

      if (typeof e === 'object') {
        Object.keys(e).forEach(function(key) {
          response._meta.error[key] = e[key];
        });

        if (response._meta.error.message == null && e.message)
          response._meta.error.message = e.message; //this is a non-iterable property
      }
      return response;
    }

    if (
      message.action === 'on' &&
      message.options &&
      (message.options.initialCallback || message.options.initialEmit)
    )
      response.data = this.__formatReturnItems(response.initialValues, local);

    if (Array.isArray(response)) {
      response = this.__formatReturnItems(response, local);
      if (!local) response.push(_meta);
      //we encapsulate the meta data in the array, so we can pop it on the other side
      else response._meta = _meta; // the _meta is preserved as an external property because we arent having to serialize
    }

    return response;
  }

  success(message) {
    var response = this.__createResponse(null, message.request, message.response, message.opts);

    message.response = this.__transformResponse(message, response);

    if (message.session.isEncrypted && message.session.secret) {
      if (message.request.action !== 'login') {
        message.response = {
          encrypted: this.__encryptMessage(message.response, message.session.secret)
        };
      } else {
        message.response = {
          encrypted: this.__encryptLogin(message.request, message.response, message.session.secret),
          _meta: {
            type: 'login'
          }
        };
        //backward compatibility happn v2
        message.response.publicKey = this.happn.services.security._keyPair.publicKey;
      }
    }

    return message;
  }
}

module.exports = ProtocolHappn1;
