class BaseHappnProtocol {
  constructor(opts) {
    if (!opts) opts = {};
    this.opts = opts;
  }

  initialize() {}

  validate(message) {
    if (message.request && ['on', 'set', 'remove'].indexOf(message.request.action) > -1)
      this.happn.services.utils.checkPath(message.request.path, message.request.action);

    return message;
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

    if (message.eventKey === 'security-data-changed') {
      message.request = {};
      message.request.publication = {
        _meta: {
          type: 'system'
        },
        eventKey: message.eventKey,
        data: message.data
      };
    }

    return message;
  }

  transformOut(message) {
    return message;
  }

  emit(message, session) {
    var client = this.happn.services.session.getClient(session.id);

    if (!client) return;

    message.request.publication.protocol = this.protocolVersion;

    message.request.publication.__outbound = true;
    client.write(message.request.publication);
  }

  fail(message) {
    //we need to use the raw incoming message here - as we dont know whether request has been populated yet
    message.response = this.__createResponse(
      message.error,
      message.raw || message.request,
      message.response,
      message.opts
    );

    return message;
  }

  __formatReturnItem(item) {
    if (!item) return null;
    if (!item.data) item.data = {};
    var returnItem = item.data;
    returnItem._meta = item._meta;

    return returnItem;
  }

  __formatReturnItems(items, local) {
    if (items == null) items = [];
    if (!Array.isArray(items)) items = [items];
    var returnItems = [];
    items.forEach(item => {
      returnItems.push(this.__formatReturnItem(item, local));
    });
    return returnItems;
  }
}

module.exports = BaseHappnProtocol;
