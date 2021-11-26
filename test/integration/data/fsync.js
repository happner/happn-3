require('../../__fixtures/utils/test_helper').describe(__filename, 20000, test => {
  const happn = require('../../../lib/index');
  const service = happn.service;
  const default_timeout = 10000;
  let happnInstance = null;
  let test_id;

  const testDbFile = test.newTestFile();

  /** @type {test.sinon.SinonSpy} */
  let fsyncSpy;

  before('should initialize the service', async function() {
    this.timeout(20000);

    fsyncSpy = test.sinon.spy(test.fs, 'fsync');

    test_id = Date.now() + '_' + require('shortid').generate();

    happnInstance = await service.create({
      services: {
        data: {
          config: {
            filename: testDbFile,
            fsync: true
          }
        }
      }
    });
  });

  after(async () => {
    fsyncSpy.restore();
    test.cleanup([], [happnInstance]);
  });

  let publisherclient;

  before('should initialize the clients', function(callback) {
    this.timeout(default_timeout);

    try {
      happnInstance.services.session.localClient(function(e, instance) {
        if (e) return callback(e);
        publisherclient = instance;
        callback();
      });
    } catch (e) {
      callback(e);
    }
  });

  it('the publisher should set string data', async () => {
    const test_string = require('shortid').generate();
    const test_base_url =
      '/a1_eventemitter_embedded_datatypes/' + test_id + '/set/string/' + test_string;

    const setResult = await publisherclient.set(test_base_url, test_string, {
      noPublish: true
    });

    test.chai.expect(fsyncSpy).to.have.been.called;

    test.chai.expect(setResult.value).to.equal(test_string);

    const getResult = await publisherclient.get(test_base_url, null);

    test.chai.expect(getResult.value).to.equal(test_string);
    test.chai.expect(test.fs.existsSync(testDbFile)).to.be.true;
  });
});
