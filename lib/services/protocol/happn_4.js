const BaseHappnProtocol = require('./happn_base');

class ProtocolHappn4 extends BaseHappnProtocol {
  constructor(opts) {
    super(opts);
  }

  static create(opts) {
    return new ProtocolHappn4(opts);
  }

  transformIn(message) {
    if (message.raw.encrypted || (message.raw.data && message.raw.data.encrypted))
      throw new Error('Encrypted payloads are no longer supported');

    message.request = message.raw; //no transform necessary

    delete message.raw;

    if (
      message.request.action === 'set' &&
      message.request.options &&
      message.request.options.nullValue
    )
      message.request.data = null; //null values dont get passed across the wire

    return this.validate(message);
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
      delete _meta._id;
    }

    _meta.type = 'response';
    _meta.status = 'ok';
    if (_meta.published == null) _meta.published = false;
    _meta.eventId = message.eventId;
    _meta.sessionId = message.sessionId; //we need the sessionId passed in case we are encrypting the resulting payload
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

    if (
      message.action === 'on' &&
      message.options &&
      (message.options.initialCallback || message.options.initialEmit)
    )
      response.data = this.__formatReturnItems(response.initialValues, local);

    if (message.action === 'set' && message.options && message.options.noDataResponse)
      response = {
        _meta: {
          path: response._meta.path,
          eventId: response._meta.eventId,
          type: 'response',
          status: response._meta.status,
          published: response._meta.published
        }
      };

    if (Array.isArray(response)) {
      response = this.__formatReturnItems(response, local);

      if (!local) response.push(_meta);
      //we encapsulate the meta data in the array, so we can pop it on the other side
      else response._meta = _meta; // the _meta is preserved as an external property because we arent having to serialize
    }

    return response;
  }

  success(message) {
    message.response = this.__createResponse(null, message.request, message.response, message.opts);
    return message;
  }
}

module.exports = ProtocolHappn4;
