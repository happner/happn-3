function ClientMiddleware(){

}

ClientMiddleware.prototype.initialize = function (config, callback) {
  this.happn.log('Client middleware loaded');
};

ClientMiddleware.prototype.cached = null;

ClientMiddleware.prototype.process = function (req, res, next) {

  try{

    var Happn = require('../../..');

    if (req.url != '/browser_client') return next();

    res.setHeader('Content-Type', 'application/javascript');

    res.end(Happn.getBrowserClient());

  }catch(e){
    next(e);
  }
};

module.exports = new ClientMiddleware();
