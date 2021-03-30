const tester = require('../../__fixtures/utils/test_helper').create();

describe(tester.testName(__filename, 3), function() {
  const fs = require('fs');
  const path = require('path');

  const sinon = require('sinon');
  const chai = require('chai');
  chai.use(require('sinon-chai'));
  const expect = require('chai').expect;

  const happn = require('../../../lib/index');
  const service = happn.service;
  const default_timeout = 10000;
  let happnInstance = null;
  let test_id;

  const test_file_path = path.resolve(__dirname, '..', '..', 'test-temp', 'test-file.js');

  /** @type {sinon.SinonSpy} */
  let fsyncSpy;

  before('should initialize the service', async function() {
    this.timeout(20000);

    fsyncSpy = sinon.spy(fs, 'fsync');

    test_id = Date.now() + '_' + require('shortid').generate();

    happnInstance = await service.create({
      services: {
        data: {
          config: {
            filename: test_file_path,
            fsync: true
          }
        }
      }
    });
  });

  after(function(done) {
    this.timeout(10000);
    fsyncSpy.restore();
    happnInstance.stop(done);
    fs.unlinkSync(test_file_path);
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
    this.timeout(default_timeout);

    const test_string = require('shortid').generate();
    const test_base_url =
      '/a1_eventemitter_embedded_datatypes/' + test_id + '/set/string/' + test_string;

    const setResult = await publisherclient.set(test_base_url, test_string, {
      noPublish: true
    });

    expect(fsyncSpy).to.have.been.called;

    expect(setResult.value).to.equal(test_string);

    const getResult = await publisherclient.get(test_base_url, null);

    expect(getResult.value).to.equal(test_string);
    expect(fs.existsSync(test_file_path)).to.be.true;
  });
});
