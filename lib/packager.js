var fs = require('fs-extra'),
  Utils = require('./services/utils/service'),
  utils = new Utils(),
  path = require('path'),
  package = require('../package.json'),
  md5 = require('md5'),
  minifyJS = require('uglify-js').minify;

module.exports = {
  package: package,

  protocol: package.protocol,

  version: package.version,

  __cachedBrowserClient: null,

  __createBrowserClient: function(options) {
    var package = require('../package.json');

    var protocol = package.protocol;

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
        .readFileSync(path.resolve(__dirname, './services/utils/shared.js'), 'utf8')
        .replace('module.exports = ', '') +
      '\r\n';

    var clientScript = buf
      .toString()
      .replace('{{protocol}}', protocol) //set the protocol here
      .replace('//{{constants}}', constantsbuf)
      .replace('//{{utils}}', utilsbuf);

    if (process.env.NODE_ENV && process.env.NODE_ENV.toLowerCase() == 'production') {
      this.__cachedBrowserClient =
        '//happn client v' +
        package.version +
        '\r\n' +
        '//protocol v' +
        protocol +
        '\r\n' +
        '//id ' +
        options.id +
        '\r\n' +
        clientScript;
    } else {
      this.__cachedBrowserClient =
        '//happn client v' +
        package.version +
        '\r\n' +
        '//protocol v' +
        protocol +
        '\r\n' +
        clientScript;
    }

    if (options.min) {
      const minified = minifyJS(this.__cachedBrowserClient);
      if (minified.error) throw minified.error;
      this.__cachedBrowserClient = minified.code;
    }
  },

  browserClient: function(options) {
    try {
      var fs = require('fs');

      if (!options) options = {};

      var clientDirPath;

      var clientFilePath;

      var dirPath = require('homedir')();

      if (process.env.NODE_ENV && process.env.NODE_ENV.toLowerCase() == 'production') {
        if (!options.id) options.id = Date.now().toString();
      }

      clientDirPath = utils.removeLast(dirPath, path.sep);

      clientFilePath = clientDirPath + path.sep + 'happn-3-browser-client-' + this.version + '.js';

      if (options.overwrite) {
        this.__cachedBrowserClient = null;
        try {
          fs.unlinkSync(clientFilePath);
        } catch (e) {}
      }

      //return a cached version if we are in production
      if (options.contentsOnly && this.__cachedBrowserClient) return this.__cachedBrowserClient;

      //we delete the file, so a new one is always generated
      //but only if it's not the same (md5)
      if (!process.env.NODE_ENV || process.env.NODE_ENV.toLowerCase() != 'production') {
        this.__createBrowserClient(options);

        if (utils.fileExists(clientFilePath)) {
          var oldMd5 = md5(fs.readFileSync(clientFilePath, 'utf8'));
          var newMd5 = md5(this.__cachedBrowserClient);

          if (oldMd5 !== newMd5) {
            try {
              fs.unlinkSync(clientFilePath);
            } catch (e) {}
          }
        }
      }

      if (utils.fileExists(clientFilePath)) {
        if (!options.contentsOnly) return clientFilePath;

        this.__cachedBrowserClient = fs.readFileSync(clientFilePath, 'utf8').toString();

        return this.__cachedBrowserClient;
      }

      if (!this.__cachedBrowserClient) this.__createBrowserClient(options);

      if (!dirPath) return this.__cachedBrowserClient;

      fs.writeFileSync(clientFilePath, this.__cachedBrowserClient, 'utf8');

      if (!options.contentsOnly) return clientFilePath;

      return this.__cachedBrowserClient;
    } catch (e) {
      throw e;
    }
  }
};
