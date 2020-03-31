module.exports = SecurityMiddleware;

const fs = require('fs');
const CONSTANTS = require('../../..').constants;

SecurityMiddleware.prototype.initialize = initialize;
SecurityMiddleware.prototype.excluded = excluded;
SecurityMiddleware.prototype.process = _process;
SecurityMiddleware.prototype.__respondForbidden = __respondForbidden;
SecurityMiddleware.prototype.__respondUnauthorized = __respondUnauthorized;
SecurityMiddleware.prototype.__respond = __respond;

function SecurityMiddleware() {}

function initialize(config) {
  if (!config) config = {};
  this.config = config;

  if (!this.config.exclusions) this.config.exclusions = [];
}

function excluded(req, next) {
  if (this.config.exclusions.length > 0) {
    var url = req.url.split('?')[0];

    for (var patternIndex in this.config.exclusions) {
      var pattern = this.config.exclusions[patternIndex];

      if (pattern === '/') {
        if (url === pattern) {
          next();
          return true;
        }
        continue; // don't allow '/' exclusion into wildcardMatch (it always matches)
      }

      if (this.happn.services.utils.wildcardMatch(pattern, url)) {
        next();
        return true;
      }
    }
    return false;
  }
  return false;
}

function _process(req, res, next) {
  var _this = this;

  if (_this.happn.config.secure) {
    try {
      if (_this.excluded(req, next)) return;

      if (req.url.substring(0, 1) !== '/') req.url = '/' + req.url;

      var parsedUrl = require('url').parse(req.url, true);
      var query = parsedUrl.query;
      var path = parsedUrl.pathname;
      var params = {};

      if (path === '/auth/request-nonce') {
        params.publicKey = _this.happn.services.utils.getFirstMatchingProperty(
          ['publicKey', 'public_key', 'public', 'key', 'public-key'],
          query
        );

        return _this.happn.services.security.createAuthenticationNonce(params, function(e, nonce) {
          if (e) return next(e);

          //message, data, error, res, code
          _this.__respond('nonce generated', nonce, null, res);
        });
      }

      if (path === '/auth/login') {
        params.username = _this.happn.services.utils.getFirstMatchingProperty(
          ['user', 'username', 'u'],
          query
        );
        params.password = _this.happn.services.utils.getFirstMatchingProperty(
          ['password', 'pwd', 'pass', 'p'],
          query
        );
        params.publicKey = _this.happn.services.utils.getFirstMatchingProperty(
          ['publicKey', 'public_key', 'public', 'key', 'public-key', 'pk'],
          query
        );
        params.digest = _this.happn.services.utils.getFirstMatchingProperty(['digest'], query);
        //login type is stateless
        params.type = 0;

        return _this.happn.services.security.login(
          params,
          null,
          { data: { info: { _local: false } } },
          function(e, session) {
            if (e) {
              if (e.toString() === 'Error: Invalid credentials')
                return _this.__respond('login failed', null, e, res, 401);
              return _this.__respond('login failed', null, e, res, 500);
            }

            _this.__respond('login successful', session.token, null, res);
          }
        );
      }

      var session = _this.happn.services.security.sessionFromRequest(req);
      if (!session) return _this.__respondUnauthorized(res, 'invalid token format or null token');
      var url = require('url');
      path = '/@HTTP' + url.parse(req.url).pathname;
      session.type = 0; //stateless session

      _this.happn.services.security.checkTokenUserId(session, (e, ok) => {
        if (e) return next(e);
        if (!ok)
          return _this.__respondUnauthorized(
            res,
            `token userid does not match userid for username: ${session.username}`
          );

        _this.happn.services.security.authorize(session, path, req.method.toLowerCase(), function(
          e,
          authorized,
          reason
        ) {
          if (e) {
            if (e.toString().indexOf('AccessDenied') === 0)
              return _this.__respondForbidden(res, 'unauthorized access to path ' + path);
            return next(e);
          }

          if (!authorized) {
            if (CONSTANTS.UNAUTHORISED_REASONS_COLLECTION.indexOf(reason) > -1)
              return _this.__respondUnauthorized(
                res,
                `authorization failed for ${session.username}: ${reason}`
              );
            return _this.__respondForbidden(res, 'unauthorized access to path ' + path);
          }
          req.happn_session = session; //used later if we are rechecking in security
          next();
        });
      });
    } catch (e) {
      next(e);
    }
  } else next();
}

function __respondForbidden(res, message) {
  var _this = this;

  if (!_this.config.forbiddenResponsePath) {
    res.writeHead(403, 'unauthorized access', {
      'content-type': 'text/plain'
    });
    return res.end(message);
  }

  fs.readFile(_this.config.forbiddenResponsePath, function(err, html) {
    if (err) {
      res.writeHead(500);
      return res.end(_this.happn.services.utils.stringifyError(err));
    }

    res.writeHead(403, 'unauthorized access', {
      'Content-Type': 'text/html'
    });
    res.end(html);
  });
}

function __respondUnauthorized(res, message) {
  var _this = this;

  if (!_this.config.unauthorizedResponsePath) {
    res.writeHead(401, 'unauthorized access', {
      'Content-Type': 'text/plain',
      'WWW-Authenticate': 'happn-auth'
    });
    return res.end(message);
  }

  fs.readFile(_this.config.unauthorizedResponsePath, function(err, html) {
    if (err) {
      res.writeHead(500);
      return res.end(_this.happn.services.utils.stringifyError(err));
    }

    res.writeHead(401, 'unauthorized access', {
      'Content-Type': 'text/html',
      'WWW-Authenticate': 'happn-auth'
    });
    res.end(html);
  });
}

function __respond(message, data, error, res, code) {
  var responseString = '{"message":"' + message + '", "data":{{DATA}}, "error":{{ERROR}}}';

  var header = {
    'Content-Type': 'application/json'
  };

  if (error) {
    if (!code) code = 500;
    responseString = responseString.replace(
      '{{ERROR}}',
      this.happn.services.utils.stringifyError(error)
    );
  } else {
    if (!code) code = 200;
    responseString = responseString.replace('{{ERROR}}', 'null');
  }

  res.writeHead(code, header);

  if (data) responseString = responseString.replace('{{DATA}}', JSON.stringify(data));
  else responseString = responseString.replace('{{DATA}}', 'null');

  res.end(responseString);
}
