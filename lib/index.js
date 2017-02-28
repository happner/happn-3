module.exports = {
  client: require('./client'),
  constants: require('./constants'),
  service: require('./service'),
  __cachedBrowserClient:null,
  getBrowserClient:function(){

    try{

      var _this = this;

      var fs = require('fs');

      if (_this.__cachedBrowserClient) return _this.__cachedBrowserClient;

      var package = require('../package.json');

      var path = require('path');

      var protocol = package.protocol;

      var buf = fs.readFileSync(path.resolve(__dirname, './client.js'));

      var constantsbuf = '\r\n_this.constants = ' + fs.readFileSync(path.resolve(__dirname, './constants.js'), 'utf8').replace('module.exports = ','') + '\r\n';

      var utilsbuf = '\r\n_this.utils = ' + fs.readFileSync(path.resolve(__dirname, './services/utils/utils.js'), 'utf8').replace('module.exports = ','') + '\r\n';

      var clientScript = buf.toString()
        .replace('{{protocol}}', protocol)//set the protocol here
        .replace('//{{constants}}', constantsbuf)
        .replace('//{{utils}}', utilsbuf);

      _this.__cachedBrowserClient = '\/\/happn client v' + package.version + '\r\n' +
          '\/\/protocol v' + protocol + '\r\n' +
          clientScript;

      return _this.__cachedBrowserClient;

    }catch(e){

      throw e;
    }
  }
};
