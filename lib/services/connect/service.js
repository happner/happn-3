module.exports = MiddlewareService;

var Crypto = require('happn-util-crypto'),
  crypto = new Crypto(),
  connect = require('connect'),
  cookies = require('connect-cookies'),
  serveStatic = require('serve-static'),
  bodyParser = require('body-parser');

MiddlewareService.prototype.initialize = initialize;

function MiddlewareService(opts) {
  this.log = opts.logger.createLogger('Connect');
  this.log.$$TRACE('construct(%j)', opts);
  this.middleware = {};
}

function initialize(config, callback) {
  var _this = this;
  var app = connect();

  app.use(serveStatic(__dirname + '/public'));
  app.use(bodyParser.json());
  app.use(cookies());

  if (_this.happn.config.services.transport.config.mode == 'https') {
    const hsts = require('hsts');
    app.use(hsts({
      maxAge: 15552000,  // 180 days in seconds
      includeSubDomains: true
    }));
  }

  var loadMiddleware = function (middleware_name) {

    _this.log.$$TRACE('loadMiddleware( ' + middleware_name);
    var Middleware = require('./middleware/' + middleware_name);
    var middleware = new Middleware();
    middleware.happn = _this.happn;
    app.use(middleware.process.bind(middleware));

    if (middleware.process_error) app.use(middleware.process_error.bind(middleware));

    if (middleware.initialize) {
      if (config.middleware) middleware.initialize(config.middleware[middleware_name]);
      else middleware.initialize();
    }

    _this.middleware[middleware_name] = middleware;
  };

  crypto.attacheMiddleware(app, '/browser_crypto.js');

  loadMiddleware('system');
  loadMiddleware('client');
  loadMiddleware('security');

  this.happn.connect = app;

  callback();
}
