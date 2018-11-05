module.exports = SystemMiddleware;

SystemMiddleware.prototype.initialize = initialize;
SystemMiddleware.prototype.process = _process;

function SystemMiddleware() {}

function initialize(config, callback) {
  this.happn.log('system middleware loaded');
}

function _process(req, res, next) {
  if (req.url && req.url.toLowerCase() == '/version') {
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({
      'version': require('../../../../package.json').version
    }));
  }

  if (req.url && req.url.toLowerCase() == '/ping') {
    res.setHeader('Content-Type', 'text/plain');
    return res.end('pong');
  }

  return next();
}
