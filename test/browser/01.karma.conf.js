// Karma configuration
// Generated on Tue Dec 01 2015 11:18:30 GMT+0200 (SAST)
const fs = require('fs');
module.exports = function(config) {
  config.set({
    // base path that will be used to resolve all patterns (eg. files, exclude)
    basePath: '../../',

    // frameworks to use
    // available frameworks: https://npmjs.org/browse/keyword/karma-adapter
    frameworks: ['mocha', 'chai'],

    files: [
      'test/browser/browser-client-02.js',
      'test/browser/01_security_hsts_cookie.js',
      'test/browser/02_websockets_embedded_sanity_encryptedpayloads.js',
      'test/browser/03_heartbeats.js',
      'test/browser/04_https_cookie.js',
      'test/browser/05_https_cookieLogin.js',
      'test/browser/06_login_promise.js'
    ],

    // list of files / patterns to load in the browser
    // files: [
    //  'build/crypto-min.js',
    //   {pattern: 'test/crypto-test.js', included: false}
    // ],

    // list of files to exclude
    exclude: [],

    // test results reporter to use
    // possible values: 'dots', 'progress'
    // available reporters: https://npmjs.org/browse/keyword/karma-reporter
    reporters: ['mocha', 'coverage'],

    preprocessors: {
      'test/browser/browser-client-02.js': ['coverage']
    },

    // web server port
    port: 9876,

    // enable / disable colors in the output (reporters and logs)
    colors: true,

    // level of logging
    // possible values: config.LOG_DISABLE || config.LOG_ERROR || config.LOG_WARN || config.LOG_INFO || config.LOG_DEBUG
    logLevel: config.LOG_INFO,

    // enable / disable watching file and executing tests whenever any file changes
    autoWatch: false,

    // start these browsers
    // available browser launchers: https://npmjs.org/browse/keyword/karma-launcher
    browsers: ['Chrome_without_security'],
    customLaunchers: {
      Chrome_without_security: {
        base: 'ChromeHeadless',
        // base: 'Chrome', // to see output
        flags: ['--disable-web-security', '--ignore-certificate-errors']
      }
    },

    // Continuous Integration mode
    // if true, Karma captures browsers, runs the tests and exits
    singleRun: false,

    // Concurrency level
    // how many browser should be started simultanous
    concurrency: Infinity,
    browserNoActivityTimeout: 60000,
    protocol: 'https',
    httpsServerOptions: {
      key: fs.readFileSync(`${__dirname}/__fixtures/key.rsa`, 'utf8'),
      cert: fs.readFileSync(`${__dirname}/__fixtures/cert.pem`, 'utf8')
    },
    coverageReporter: {
      dir: './',
      reporters: [{ type: 'lcov', subdir: 'coverage-web' }, { type: 'text-summary' }]
    }
  });
};
