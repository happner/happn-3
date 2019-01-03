var fs = require('fs-extra'),
  Utils = require('./services/utils/service'),
  utils = new Utils(),
  path = require('path'),
  packageJson = require('../package.json'),
  md5 = require('md5'),
  minifyJS = require('uglify-js').minify;

module.exports = {
  package: packageJson,

  protocol: packageJson.protocol,

  version: packageJson.version,

  __cachedBrowserClient: null,

  __createBrowserClient: function (options) {
    var _this = this;
    var packageJson = require('../package.json');
    var protocol = packageJson.protocol;

    var buf = fs.readFileSync(path.resolve(__dirname, './client.js'));

    var constantsbuf =
      '\r\n_this.constants = ' +
      fs
        .readFileSync(path.resolve(__dirname, './constants.js'), 'utf8')
        .replace('module.exports = ', '') +
      '\r\n';

    var utilsbuf =
      '\r\n_this.utils = ' +
      fs
        .readFileSync(
          path.resolve(__dirname, './services/utils/shared.js'),
          'utf8'
        )
        .replace('module.exports = ', '') +
      '\r\n';

    var clientScript = buf
      .toString()
      .replace('{{protocol}}', protocol) //set the protocol here
      .replace('//{{constants}}', constantsbuf)
      .replace('//{{utils}}', utilsbuf);

    if (
      process.env.NODE_ENV &&
      process.env.NODE_ENV.toLowerCase() == 'production'
    ) {
      _this.__cachedBrowserClient =
        '//happn client v' +
        packageJson.version +
        '\r\n' +
        '//protocol v' +
        protocol +
        '\r\n' +
        '//id ' +
        options.id +
        '\r\n' +
        clientScript;
    } else {
      _this.__cachedBrowserClient =
        '//happn client v' +
        packageJson.version +
        '\r\n' +
        '//protocol v' +
        protocol +
        '\r\n' +
        clientScript;
    }

    if (options.min) {
      //console.log(minifyJS(_this.__cachedBrowserClient).error);
      _this.__cachedBrowserClient = minifyJS(_this.__cachedBrowserClient).code;
    }
  },

  browserClient: function (options) {
    try {
      var _this = this;

      var fs = require('fs');

      if (!options) options = {};

      var clientDirPath;

      var clientFilePath;

      var dirPath = require('homedir')();

      if (
        process.env.NODE_ENV &&
        process.env.NODE_ENV.toLowerCase() == 'production'
      ) {
        if (!options.id) options.id = Date.now().toString();
      }

      clientDirPath = utils.removeLast(path.sep, dirPath);

      clientFilePath =
        clientDirPath +
        path.sep +
        'happn-3-browser-client-' +
        this.version +
        '.js';

      if (options.overwrite) {
        _this.__cachedBrowserClient = null;
        try {
          fs.unlinkSync(clientFilePath);
        } catch (e) { }
      }

      //return a cached version if we are in production
      if (options.contentsOnly && _this.__cachedBrowserClient)
        return _this.__cachedBrowserClient;

      //we delete the file, so a new one is always generated
      //but only if it's not the same (md5)
      if (
        !process.env.NODE_ENV ||
        process.env.NODE_ENV.toLowerCase() != 'production'
      ) {
        _this.__createBrowserClient(options);

        if (utils.fileExists(clientFilePath)) {
          var oldMd5 = md5(fs.readFileSync(clientFilePath, 'utf8'));
          var newMd5 = md5(_this.__cachedBrowserClient);

          if (oldMd5 !== newMd5) {
            try {
              fs.unlinkSync(clientFilePath);
            } catch (e) { }
          }
        }
      }

      if (utils.fileExists(clientFilePath)) {
        if (!options.contentsOnly) return clientFilePath;

        _this.__cachedBrowserClient = fs
          .readFileSync(clientFilePath, 'utf8')
          .toString();

        return _this.__cachedBrowserClient;
      }

      if (!_this.__cachedBrowserClient) {
        try {
          _this.__createBrowserClient(options);
        } catch (err) { }
      }

      if (!dirPath) return _this.__cachedBrowserClient;

      fs.writeFileSync(clientFilePath, _this.__cachedBrowserClient, 'utf8');

      if (!options.contentsOnly) return clientFilePath;

      return _this.__cachedBrowserClient;
    } catch (e) {
      throw e;
    }
  }
};
