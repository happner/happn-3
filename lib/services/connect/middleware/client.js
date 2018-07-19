module.exports = new ClientMiddleware();

ClientMiddleware.prototype.initialize = initialize;
ClientMiddleware.prototype.process = _process;
ClientMiddleware.prototype.cached = null;

function ClientMiddleware() {}

function initialize(config, callback) {
  this.happn.log('Client middleware loaded');
}

function _process(req, res, next) {
  try {
    var Happn = require('../../..');

    if (req.url != '/browser_client') return next();

    res.setHeader('Content-Type', 'application/javascript');

    var browserOptions = {
      contentsOnly: true
    };

    if (process.env.NODE_ENV && process.env.NODE_ENV.toLowerCase() == 'production') {
      browserOptions.min = true;
    }

    res.end(Happn.packager.browserClient(browserOptions));

  } catch (e) {
    next(e);
  }
}
