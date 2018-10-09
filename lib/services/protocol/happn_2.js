var Promise = require('bluebird');

module.exports = ProtocolHappn;

function ProtocolHappn(opts) {
  if (!opts) opts = {};
  this.opts = opts;
}

ProtocolHappn.create = function(opts) {
  return new ProtocolHappn(opts);
};

//protocol interface
ProtocolHappn.prototype.initialize = initialize;
ProtocolHappn.prototype.validate = validate;
ProtocolHappn.prototype.transformIn = transformIn;
ProtocolHappn.prototype.transformSystem = transformSystem;
ProtocolHappn.prototype.transformOut = transformOut;
ProtocolHappn.prototype.emit = emit;
ProtocolHappn.prototype.success = success;
ProtocolHappn.prototype.fail = fail;

//internal methods
ProtocolHappn.prototype.__formatReturnItem = __formatReturnItem;
ProtocolHappn.prototype.__formatReturnItems = __formatReturnItems;
ProtocolHappn.prototype.__createResponse = __createResponse;
ProtocolHappn.prototype.__encryptMessage = __encryptMessage;
ProtocolHappn.prototype.__encryptLogin = __encryptLogin;

function initialize() {

}

function validate(message){

    if (message.request && ['on', 'set', 'remove'].indexOf(message.request.action) > -1)
      this.happn.services.utils.checkPath(message.request.path, message.request.action);
    return message;
}

function transformIn(message) {

  if (message.raw.encrypted || (message.raw.data && message.raw.data.encrypted)) {

    if (message.raw.action === 'login') {

      message.request = {
        action: message.raw.action
      };

      if (message.raw.data.encrypted.type == 'Buffer') message.raw.data.encrypted = message.raw.data.encrypted.data;

      message.request.data = JSON.parse(this.happn.services.crypto.asymmetricDecrypt(message.raw.data.publicKey, this.happn.services.security._keyPair.privateKey, message.raw.data.encrypted).toString());
      message.request.publicKey = message.raw.data.publicKey;
      message.request.eventId = message.raw.eventId;

      message.request.data.isEncrypted = true; //letting the security service know by adding this to the credentials
      message.session.isEncrypted = true; //for this call down as well

      delete message.raw;
      return this.validate(message);
    }
    message.request = this.happn.services.crypto.symmetricDecryptObject(message.raw.encrypted, message.session.secret);
  } else message.request = message.raw; //no transform necessary

  delete message.raw;

  if (message.request.action === 'set' && message.request.options && message.request.options.nullValue)
    message.request.data = null; //null values dont get passed across the wire

  return this.validate(message);
}

function transformSystem(message) {

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

  if (message.eventKey == 'security-data-changed')
    message.__suppress = true;

  return message;
}

function transformOut(message) {
  return message;
}

function __formatReturnItem(item) {

  if (!item) return null;
  if (!item.data) item.data = {};
  var returnItem = item.data;
  returnItem._meta = item._meta;

  return returnItem;
}

function __formatReturnItems(items, local) {

  if (items == null) items = [];
  if (!Array.isArray(items)) items = [items];
  var _this = this,
    returnItems = [];
  items.forEach(function(item) {
    returnItems.push(_this.__formatReturnItem(item, local));
  });

  return returnItems;
}

function __createResponse(e, message, response, opts) {

  var _meta = {};

  var local = opts ? opts.local : false;

  if (response == null) response = {
    data: null
  };

  else {

    if (response._meta) _meta = response._meta;
    if (response.paths) response = response.paths;
  }

  _meta.type = 'response';
  _meta.status = 'ok';

  if (_meta.published == null) _meta.published = false;

  _meta.eventId = message.eventId;

  delete _meta._id;

  //we need these passed in case we are encrypting the resulting payload
  if (['login', 'describe'].indexOf(message.action) == -1) _meta.sessionId = message.sessionId;

  _meta.action = message.action;

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

  if (message.action === 'on' && message.options && (message.options.initialCallback || message.options.initialEmit)) response.data = this.__formatReturnItems(response.initialValues, local);

  if (Array.isArray(response)) {

    response = this.__formatReturnItems(response, local);

    if (!local) response.push(_meta); //we encapsulate the meta data in the array, so we can pop it on the other side
    else response._meta = _meta; // the _meta is preserved as an external property because we arent having to serialize
  }

  return response;
}

function emit(message, session) {

  var client = this.happn.services.session.getClient(session.id);

  if (client) {

    message.request.publication.protocol = this.protocolVersion;

    if (session.isEncrypted) message.request.publication = {
      encrypted: this.__encryptMessage(message.request.publication, session.secret)
    };

    message.request.publication.__outbound = true;

    client.write(message.request.publication);
  }
}

function __encryptMessage(response, secret) {
  return this.happn.services.crypto.symmetricEncryptObject(response, secret);
}

function __encryptLogin(request, response) {
  return this.happn.services.crypto.asymmetricEncrypt(request.publicKey, this.happn.services.security._keyPair.privateKey, JSON.stringify(response));
}

function success(message) {

  message.response = this.__createResponse(null, message.request, message.response, message.opts);

  if (message.session.isEncrypted && message.session.secret) {

    if (message.request.action != 'login') {

      message.response.encrypted = this.__encryptMessage(message.response, message.session.secret);
      delete message.response._meta;
    } else {

      message.response._meta.type = 'login';
      message.response.encrypted = this.__encryptLogin(message.request, message.response, message.session.secret);
      //backward compatibility happn v2
      message.response.publicKey = this.happn.services.security._keyPair.publicKey;
    }
    delete message.response.data;
  }
  return message;
}

function fail(message) {

  var _this = this;

  //we need to use the raw incoming message here - as we dont know whether request has been populated yet
  message.response = _this.__createResponse(message.error, message.raw || message.request, message.response, message.opts);
  if (message.request.action != 'login') //there is no session secret if the login failed
    if (message.session.isEncrypted) message.response = _this.__encryptMessage(message.response, message.session.secret);

  return message;
}
