var gulp = require('gulp');
var Server = require('karma').Server;
var happn = require('../../lib/index');
var service = happn.service;
var fs = require('fs');
var path = require('path');
var happnInstance;

/**
 * Run test once and exit
 */
gulp.task('default', function (done) {

  var client_code = happn.packager.browserClient({contentsOnly:true, min:true, overwrite:true});

  fs.writeFileSync(__dirname + path.sep + 'browser_client.js', client_code, 'utf8');

  service.create({
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
    },
    function (e, happnInst) {

      if (e)
        return callback(e);

      happnInstance = happnInst;

      new Server({
        configFile: __dirname + path.sep + '01.karma.conf.js',
        singleRun: true
      }, done).start();

    });


});
