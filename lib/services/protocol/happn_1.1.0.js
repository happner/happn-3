var Promise = require('bluebird')
  ;

module.exports = ProtocolHappn;

function ProtocolHappn(opts) {
  if (!opts) opts = {};
  this.opts = opts;
}

ProtocolHappn.prototype.transformIn = Promise.promisify(function(message, callback){

  if (message.raw.encrypted || (message.raw.data && message.raw.data.encrypted)){

    if (message.raw.action  === 'login'){

      message.request = {action: message.raw.action};

      if (message.raw.data.encrypted.type == 'Buffer') message.raw.data.encrypted = message.raw.data.encrypted.data;

      message.request.data = JSON.parse(this.happn.services.crypto.asymmetricDecrypt(message.raw.data.publicKey, this.happn.services.security._keyPair.privateKey, message.raw.data.encrypted).toString());
      message.request.publicKey = message.raw.data.publicKey;
      message.request.eventId = message.raw.eventId;

      message.request.data.isEncrypted = true;//letting the security service know by adding this to the credentials
      message.session.isEncrypted = true;//for this call down as well

      delete message.raw.data.encrypted;

      return callback(null, message);
    }

    message.request = this.happn.services.crypto.symmetricDecryptObject(message.raw.encrypted, message.session.secret);
    delete message.raw.encrypted;
  }

  else message.request = message.raw;//no transform necessary

  if (message.request.action === 'set' && message.request.options && message.request.options.nullValue)
    message.request.data = null;//null values dont get passed across the wire

  return callback(null, message);

});

ProtocolHappn.prototype.transformSystem = Promise.promisify(function(message, callback){

  if (message.action === 'disconnect'){

    var options = message.options?message.options:{};

    if (options.reconnect == null) options.reconnect = true;
    if (options.reason == null) options.reason = 'server side disconnect';

    message.response = {_meta:{type:'system'}, eventKey:'server-side-disconnect', data:options.reason}, {reconnect:options.reconnect};
  }

  return callback(null, message);
});

ProtocolHappn.prototype.transformOut = Promise.promisify(function(message, callback){

  try{

      message.request = message.raw;
      return callback(null, message);

  }catch(e){
    callback(e);
  }

});

ProtocolHappn.prototype.__formatReturnItem = function (item) {

  if (!item) return null;

  if (!item.data) item.data = {};

  var returnItem = item.data;

  returnItem._meta = item._meta;

  return returnItem;
};

ProtocolHappn.prototype.__formatReturnItems = function (items, local) {

  if (items == null) items = [];

  if (!Array.isArray(items)) items = [items];

  var returnItems = [];

  items.forEach(function (item) {
    returnItems.push(this.__formatReturnItem(item, local));
  }.bind(this));

  return returnItems;
};

ProtocolHappn.prototype.__createResponse = function (e, message, response, opts) {

  var _meta = {};

  var local = opts?opts.local:false;

  if (response == null) response = {data: null};

  else{

    if (response._meta) _meta = response._meta;
    if (response.paths) response = response.paths;
  }

  _meta.type = 'response';
  _meta.status = 'ok';
  _meta.published = false;
  _meta.eventId = message.eventId;

  delete _meta._id;

  //we need these passed in case we are encrypting the resulting payload
  if (['login', 'describe'].indexOf(message.action) == -1) _meta.sessionId = message.sessionId;

  _meta.action = message.action;

  response._meta = _meta;

  if (e) {

    response._meta.status = 'error';
    response._meta.error = {name: e.toString()};

    if (typeof e === 'object') {
      Object.keys(e).forEach(function (key) {
        response._meta.error[key] = e[key];
      });
    }

    return response;
  }

  if (message.action === 'on' && (message.options.initialCallback || message.options.initialEmit)) response.data = this.__formatReturnItems(response.initialValues, local);

  if (Array.isArray(response)) {

    response = this.__formatReturnItems(response, local);

    if (!local) response.push(_meta);//we encapsulate the meta data in the array, so we can pop it on the other side
    else response._meta = _meta;// the _meta is preserved as an external property because we arent having to serialize
  }

  return response;
};

ProtocolHappn.prototype.emit = Promise.promisify(function(message, session, callback){

  try{

    message.request.publication.protocol = this.happn.services.protocol.current();

    if (session.isEncrypted) message.request.publication = {encrypted:this.__encryptMessage(message.request.publication, session.secret)};

    message.request.publication.__outbound = true;
    this.happn.services.session.getClient(session.id).write(message.request.publication);

    callback(null, message);

  }catch(e){
    callback(e);
  }
});

ProtocolHappn.prototype.__encryptMessage = function(response, secret){
  return this.happn.services.crypto.symmetricEncryptObject(response, secret);
};

ProtocolHappn.prototype.__encryptLogin = function(request, response){
  return this.happn.services.crypto.asymmetricEncrypt(request.publicKey, this.happn.services.security._keyPair.privateKey, JSON.stringify(response));
};

ProtocolHappn.prototype.success = function(message, callback){

  var _this = this;

  message.response = _this.__createResponse(null, message.request, message.response, message.opts);

  if (message.session.isEncrypted){

    if (message.request.action != 'login') {
      message.response.encrypted = _this.__encryptMessage(message.response, message.session.secret);
      delete message.response._meta;
    }
    else {
      message.response._meta.type = 'login';
      message.response.encrypted = _this.__encryptLogin(message.request, message.response, message.session.secret);
    }
    delete message.response.data;
  }

  callback(null, message);
};

ProtocolHappn.prototype.fail = function(e, message, callback){

  var _this = this;

  //we need to use the raw incoming message here - as we dont know whether request has been populated yet
  message.response = _this.__createResponse(e, message.raw, message.response, message.opts);

  if (message.request.action != 'login')//there is no session secret if the login failed
    if (message.session.isEncrypted) message.response = _this.__encryptMessage(message.response, message.session.secret);

  callback(null, message);
};

