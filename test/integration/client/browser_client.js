var Happn = require('../../..'),
  homedir = require('homedir'),
  expect = require('expect.js'),
  path = require('path'),
  fs = require('fs-extra');

describe(
  require('../../__fixtures/utils/test_helper')
    .create()
    .testName(__filename, 3),
  function() {
    it('builds the happn browser client, returns the filepath', function(done) {
      var clientCode = Happn.packager.browserClient();

      expect(clientCode).to.be(
        homedir() + path.sep + 'happn-3-browser-client-' + Happn.version + '.js'
      );

      done();
    });

    it('builds the happn browser client, returns the contents', function(done) {
      var clientCode = Happn.packager.browserClient({
        contentsOnly: true
      });

      expect(
        clientCode.length >
          (
            homedir() +
            path.sep +
            'happn-3-browser-client-' +
            Happn.version +
            '.js'
          ).length
      ).to.be(true);

      done();
    });

    it('builds the happn browser client, in production mode - ensures we are using the cached file contents', function(done) {
      process.env.NODE_ENV = 'production';

      Happn.packager.__cachedBrowserClient = null;

      try {
        fs.unlinkSync(
          homedir() +
            path.sep +
            'happn-3-browser-client-' +
            Happn.version +
            '.js'
        );
      } catch (e) {}

      var clientCode = Happn.packager.browserClient({
        contentsOnly: true,
        id: 'TEST_UNIQUE_ID'
      });

      expect(clientCode.indexOf('id TEST_UNIQUE_ID') > -1).to.be(true);

      var clientCodeAgain = Happn.packager.browserClient({
        contentsOnly: true
      });

      expect(clientCodeAgain.indexOf('id TEST_UNIQUE_ID') > -1).to.be(true);

      process.env.NODE_ENV = 'test';

      done();
    });

    it('tests the client middleware is able to fetch the contents', function(done) {
      var Middleware = require('../../../lib/services/connect/middleware/client');
      var middleware = new Middleware();
      var req = {
        url: '/browser_client'
      };

      var res = {
        setHeader: function(key, val) {},
        end: function(content) {
          expect(
            content.length >
              (
                homedir() +
                path.sep +
                'happn-3-browser-client-' +
                Happn.version +
                '.js'
              ).length
          ).to.be(true);
          done();
        }
      };

      middleware.process(req, res);
    });

    it('tests the client middleware is able to fetch the cached contents', function(done) {
      process.env.NODE_ENV = 'production';

      Happn.packager.__cachedBrowserClient = null;

      try {
        fs.unlinkSync(
          homedir() +
            path.sep +
            'happn-3-browser-client-' +
            Happn.version +
            '.js'
        );
      } catch (e) {}

      var clientCode = Happn.packager.browserClient({
        contentsOnly: true,
        id: 'TEST_UNIQUE_ID'
      });

      expect(clientCode.indexOf('id TEST_UNIQUE_ID') > -1).to.be(true);

      var Middleware = require('../../../lib/services/connect/middleware/client');
      var middleware = new Middleware();

      var req = {
        url: '/browser_client'
      };

      var res = {
        setHeader: function(key, val) {},
        end: function(content) {
          expect(
            content.length >
              (
                homedir() +
                path.sep +
                'happn-3-browser-client-' +
                Happn.version +
                '.js'
              ).length
          ).to.be(true);
          expect(content.indexOf('id TEST_UNIQUE_ID') > -1).to.be(true);

          process.env.NODE_ENV = 'test';
          done();
        }
      };

      middleware.process(req, res);
    });

    it('tests the minify option', function(done) {
      process.env.NODE_ENV = 'production';

      Happn.packager.__cachedBrowserClient = null;

      try {
        fs.unlinkSync(
          homedir() +
            path.sep +
            'happn-3-browser-client-' +
            Happn.version +
            '.js'
        );
      } catch (e) {}

      var clientCode = Happn.packager.browserClient({
        contentsOnly: true,
        id: 'TEST_UNIQUE_ID'
      });

      expect(clientCode.indexOf('id TEST_UNIQUE_ID') > -1).to.be(true);

      var clientCodeAgain = Happn.packager.browserClient({
        contentsOnly: true
      });

      expect(clientCodeAgain.indexOf('id TEST_UNIQUE_ID') > -1).to.be(true);

      //process.env.NODE_ENV = 'test';

      Happn.packager.__cachedBrowserClient = null;

      try {
        fs.unlinkSync(
          homedir() +
            path.sep +
            'happn-3-browser-client-' +
            Happn.version +
            '.js'
        );
      } catch (e) {}

      clientCode = Happn.packager.browserClient({
        contentsOnly: true,
        min: true
      });

      //console.log('1', clientCodeAgain);

      //console.log('2', clientCode);

      expect(clientCodeAgain.length > clientCode.length).to.be(true);

      done();
    });

    it('tests the client middleware is able to fetch the minified contents', function(done) {
      Happn.packager.__cachedBrowserClient = null;

      try {
        fs.unlinkSync(
          homedir() +
            path.sep +
            'happn-3-browser-client-' +
            Happn.version +
            '.js'
        );
      } catch (e) {}

      process.env.NODE_ENV = 'test';

      var clientCode = Happn.packager.browserClient({
        contentsOnly: true,
        overwrite: true
      });

      process.env.NODE_ENV = 'production';

      Happn.packager.__cachedBrowserClient = null;

      try {
        fs.unlinkSync(
          homedir() +
            path.sep +
            'happn-3-browser-client-' +
            Happn.version +
            '.js'
        );
      } catch (e) {}

      var Middleware = require('../../../lib/services/connect/middleware/client');
      var middleware = new Middleware();

      var req = {
        url: '/browser_client'
      };

      var res = {
        setHeader: function(key, val) {},
        end: function(content) {
          expect(clientCode.length > content.length).to.be(true);
          done();
        }
      };

      middleware.process(req, res, function(e) {
        if (e) return done(e);
      });
    });
  }
);
