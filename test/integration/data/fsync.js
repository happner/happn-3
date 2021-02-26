const tester = require('../../__fixtures/utils/test_helper').create();

describe.only(tester.testName(__filename, 3), function() {
  var expect = require('expect.js');
  var happn = require('../../../lib/index');
  var service = happn.service;
  var default_timeout = 10000;
  var happnInstance = null;
  var test_id;
  var path = require('path');
  var fs = require('fs');

  var test_file_path = path.resolve(__dirname, '..', '..', 'test-temp', 'test-file.js');

  before('should initialize the service', async function() {
    this.timeout(20000);

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
    happnInstance.stop(done);
    fs.unlinkSync(test_file_path);
  });

  var publisherclient;

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

    var test_string = require('shortid').generate();
    var test_base_url =
      '/a1_eventemitter_embedded_datatypes/' + test_id + '/set/string/' + test_string;

    const setResult = await publisherclient.set(test_base_url, test_string, {
      noPublish: true
    });

    expect(setResult.value).to.be(test_string);

    const getResult = await publisherclient.get(test_base_url, null);

    expect(getResult.value).to.be(test_string);
    expect(fs.existsSync(test_file_path)).to.be(true);
  });
});
