var path = require('path');
var filename = path.basename(__filename);
var expect = require('expect.js');
var Promise = require('bluebird');
var happn = require('../lib/index');
var service = happn.service;
var client = happn.client;
var statsServer;
var happnServer;
var happnClient;
var lastMetrics;
var lastFragment;
var StatsServer = require('happn-stats').StatsServer;

describe(filename, function () {

  before('start the stats server', function (done) {
    statsServer = new StatsServer({
      reportInterval: 500,
      fragmentsPerReport: 2
    });
    statsServer.start()
      .then(function () { done() })
      .catch(done);

    statsServer.on('report', function (timestamp, metrics) {
      // console.log('METRICS', metrics);
      lastMetrics = metrics;
    });

    statsServer.on('fragment', function (fragment) {
      lastFragment = fragment;
    });
  });

  before('start happn server', function (done) {
    service.create({
        name: 'server_name',
        services: {
          stats: {
            config: {
              debug: true,
              statsServer: '127.0.0.1',
              statsPort: 49494,
              interval: 500
            }
          }
        }
      })
      .then(function (server) {
        happnServer = server;
        done();
      })
      .catch(done);
  });

  before('start happn client', function (done) {
    client.create({})
      .then(function (client) {
        happnClient = client;
        happnClient.onAsync = Promise.promisify(happnClient.on);
        happnClient.setAsync = Promise.promisify(happnClient.set);
      })
      .then(function () {
        done();
      })
      .catch(done);
  });

  after('stop happn client', function (done) {
    if (!happnClient) return done();
    happnClient.disconnect(done);
  });

  after('stop happn server', function (done) {
    if (!happnServer) return done();
    happnServer.stop(done);
  });

  after('stop the stats server', function (done) {
    if (!statsServer) return done();
    statsServer.stop()
      .then(function () { done() })
      .catch(done);
  });

  it('runs stats after the server has started', function (done) {

    var stats = happnServer.services.stats.fetch();

    //console.log(JSON.stringify(stats, null, 2));

    done();

  });

  it('has accumulated metrics', function (done) {

    setTimeout(function () {

      expect(lastMetrics.gauges['happn.system.memory.rss']).to.not.be(undefined);
      expect(lastMetrics.gauges['happn.system.memory.heapTotal']).to.not.be(undefined);
      expect(lastMetrics.gauges['happn.system.memory.heapUsed']).to.not.be(undefined);
      expect(lastMetrics.gauges['happn.system.memory.external']).to.not.be(undefined);

      expect(lastMetrics.gauges['happn.session.sessions']).to.be(1);

      expect(lastMetrics.gauges['happn.queue.publication.length']).to.not.be(undefined);
      expect(lastMetrics.gauges['happn.queue.inbound.length']).to.not.be(undefined);
      expect(lastMetrics.gauges['happn.queue.outbound.length']).to.not.be(undefined);
      expect(lastMetrics.gauges['happn.queue.failures']).to.not.be(undefined);

      done();
    }, 1020);

  });

  it('has name in fragment', function (done) {

    setTimeout(function () {
      expect(lastFragment.name).to.be('server_name');
      done();
    }, 1020);

  });

  it('gets queue times', function (done) {

    Promise.all([
      happnClient.onAsync('/some/path', function () {}),
      happnClient.setAsync('/some/path', {})
    ])
      .then(function () {

        setTimeout(function () {
          expect(lastMetrics.gauges['happn.queue.inbound.time']).to.be.greaterThan(0);
          expect(lastMetrics.gauges['happn.queue.outbound.time']).to.be.greaterThan(0);
          expect(lastMetrics.gauges['happn.queue.publication.time']).to.be.greaterThan(0);
          done();
        }, 1020);

      })
      .catch(done);

  });

  it('gets queue speeds', function (done) {

    this.timeout(10000);

    var interval = setInterval(function () {

      happnClient.setAsync('/some/path', {}).catch(function (e) {
        console.log(e);
      });

    }, 1000 / 100);

    setTimeout(function () {

      expect(lastMetrics.gauges['happn.queue.publication.rate']).to.be.greaterThan(50);
      expect(lastMetrics.gauges['happn.queue.inbound.rate']).to.be.greaterThan(50);

      clearInterval(interval);
      done();

    }, 1020);


  });

});
