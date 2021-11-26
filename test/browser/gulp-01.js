var gulp = require('gulp');
var Server = require('karma').Server;
var happn = require('../../lib/index');
var fs = require('fs');
var path = require('path');
var ServerHelper = require('./__fixtures/serverHelper');
var serverHelper = new ServerHelper();

/**
 * Run test once and exit
 */
gulp.task('default', async () => {
  var client_code = happn.packager.browserClient({
    contentsOnly: true,
    overwrite: true
  });

  fs.writeFileSync(__dirname + path.sep + 'browser-client-02.js', client_code, 'utf8');

  await serverHelper.createServer({
    secure: true,
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

  await serverHelper.createServer({
    secure: true,
    port: 55001,
    services: {
      transport: {
        config: {
          mode: 'https'
        }
      }
    }
  });

  await serverHelper.createServer({
    secure: true,
    port: 55002,
    services: {
      session: {
        config: {
          primusOpts: {
            pingInterval: 2000
          }
        }
      }
    }
  });

  (
    await serverHelper.createServer({
      secure: true,
      port: 55003,
      services: {
        transport: {
          config: {
            mode: 'https'
          }
        },
        security: {
          config: {
            httpsCookie: true
          }
        }
      }
    })
  ).connect.use('/test/web/route', function(req, res) {
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        received: 1
      })
    );
  });

  await serverHelper.createServer({
    secure: true,
    port: 55004,
    services: {
      security: {
        config: {
          cookieName: 'test-cookie'
        }
      }
    }
  });

  var karmaServer = new Server({
    configFile: __dirname + path.sep + '01.karma.conf.js',
    singleRun: true
  });

  return new Promise(function(resolve, reject) {
    karmaServer.on('run_complete', async (browsers, results) => {
      await serverHelper.killServers();
      if (results.error || results.failed) return reject(new Error('There are test failures'));
      resolve();
    });
    karmaServer.start();
  });
});
