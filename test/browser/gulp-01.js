var gulp = require('gulp');
var Server = require('karma').Server;
var happn = require('../../lib/index');
var service = happn.service;
var fs = require('fs');
var path = require('path');
var happnInstance;
var happnInstance1;
var ServerHelper = require('./__fixtures/serverHelper');
var serverHelper = new ServerHelper();

/**
 * Run test once and exit
 */
gulp.task('default',  async () => {

  var client_code = happn.packager.browserClient({
    contentsOnly: true,
    min: true,
    overwrite: true
  });

  fs.writeFileSync(__dirname + path.sep + 'browser_client.js', client_code, 'utf8');

  happnInstance = await serverHelper.createServer({
      secure: true,
      encryptPayloads: true,
      services: {
        security: {
          config: {
            keyPair: {
              privateKey: 'Kd9FQzddR7G6S9nJ/BK8vLF83AzOphW2lqDOQ/LjU4M=',
              publicKey: 'AlHCtJlFthb359xOxR5kiBLJpfoC2ZLPLWYHN3+hdzf2'
            }
          }
        }
      }
    });

  happnInstance1 = await serverHelper.createServer({
      secure: true,
      port:55001
    });

  var karmaServer = new Server({
    configFile: __dirname + path.sep + '01.karma.conf.js',
    singleRun: true
  });

  return new Promise(function(resolve, reject){

    karmaServer.on('run_complete', async (browsers, results) => {

        await serverHelper.killServers();
        if (results.error || results.failed)
            return reject(new Error('There are test failures'));
        resolve();
    });
    karmaServer.start();
  });
});
