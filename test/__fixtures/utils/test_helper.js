const shortid = require('shortid'),
      fs = require('fs-extra'),
      request = require('request'),
      why = require('why-is-node-running'),
      delay = require('await-delay'),
      readline = require('readline');

function TestHelper() {
  this.__testFiles = [];
  this.package = require('../../../package.json');
  this.expect = require('expect.js');
  this.semver = require('semver');
  this.npm = require('npm-programmatic');
  this.path = require('path');
  this.utils = require('../../../lib/services/utils/shared');
  this.nodeUtils = require('util');
  this.server = require('./server-helper').create();
  this.security = require('./security-helper').create();
  this.sinon = require('sinon');
  this.fs = require('fs');
  this.async = require('async');
  this.findRecordInDataFileCallback = this.nodeUtils.callbackify(this.findRecordInDataFile);
  this.happn = require('../../../lib/index');
}

TestHelper.create = function(){
  return new TestHelper();
};

TestHelper.prototype.printOpenHandles = async function(delayMs){
  if (delayMs) await delay(delayMs);
  await why();
};

TestHelper.prototype.testName = function(testFilename, depth){
  if (!depth) depth = 2;
  var fileParts = testFilename.split(this.path.sep).reverse();
  var poParts = [];
  for (var i = 0; i < depth; i++)
    poParts.push(fileParts.shift());
  return poParts.reverse().join('/').replace('.js', '');
};

TestHelper.prototype.newTestFile = function (options) {
  if (!options) options = {};
  if (!options.dir) options.dir = 'test' + this.path.sep + 'tmp';
  if (!options.ext) options.ext = 'txt';
  if (!options.name) options.name = shortid.generate();
  var folderName = this.path.resolve(options.dir);
  fs.ensureDirSync(folderName);
  var fileName = folderName + this.path.sep + options.name + '.' + options.ext;
  fs.writeFileSync(fileName, '');
  this.__testFiles.push(fileName);
  return fileName;
};

TestHelper.prototype.log = function(msg){
  console.log(msg);
}

TestHelper.prototype.deleteFiles = function () {
  var errors = 0;
  var deleted = 0;
  var lastError;
  this.__testFiles.forEach( (filename) => {
    try {
      fs.unlinkSync(filename);
      deleted++;
    } catch (e) {
      lastError = e;
      errors++;
    }
  });
  var results = {deleted: deleted, errors: errors, lastError: lastError};
  return results;
};

TestHelper.prototype.randomInt = function(min, max){
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

TestHelper.prototype.delay = async function(delayMS){
  if (!delayMS) delayMS = 5000;
  const delay = require('await-delay');
  await delay(delayMS);
};

TestHelper.prototype.showOpenHandles = function(after, delayMS){
  const why = require('why-is-node-running');
  after('OPEN HANDLES:::', async () => {
    await this.delay(delayMS);
    why();
  });
};

//eslint-disable-next-line
TestHelper.prototype.doRequest = function(path, token) {
  return new Promise((resolve, reject) => {
    let options = {
      url: 'http://127.0.0.1:55000' + path
    };
    options.headers = {
      Cookie: ['happn_token=' + token]
    };
    request(options, function(error, response) {
      if (error) return reject(error);
      resolve(response);
    });
  });
};

TestHelper.prototype.lineCount = async function(filePath) {
  if (!fs.existsSync(filePath)) {
    return 0;
  }
  const reader = readline.createInterface({
    input: fs.createReadStream(filePath),
    crlfDelay: Infinity
  });
  let lineIndex = 0;
  for await (const line of reader) {
    lineIndex++;
  }
  return lineIndex;
}

TestHelper.prototype.shortid = function() {
  return require('shortid').generate();
}

TestHelper.prototype.findRecordInDataFile = function(path, filepath) {
  return new Promise((resolve, reject) => {
    let found = false;
    let stream;
    try {
      const byline = require('byline');
      stream = byline(this.fs.createReadStream(filepath, { encoding: 'utf8' }));
    } catch (e) {
      reject(e);
      return;
    }
    stream.on('data', function(line) {
      if (found) return;

      var record = JSON.parse(line);

      if (
        record.operation != null &&
        ['UPSERT', 'INSERT'].includes(record.operation.operationType) &&
        record.operation.arguments[0] === path
      ) {
        found = true;
        stream.end();
        return resolve(record);
      }
    });

    stream.on('error', function(e) {
      if (!found) reject(e);
    });

    stream.on('end', function() {
      if (!found) resolve(null);
    });
  });
};
TestHelper.prototype.createInstance = function(config = {}) {
  return new Promise((resolve, reject) => {
    this.happn.service.create(config, function(e, happnInst) {
      if (e) return reject(e);
      resolve(happnInst);
    });
  });
}

TestHelper.prototype.destroyInstance = function(instance) {
  return new Promise((resolve, reject) => {
    if (!instance) return resolve();
    instance.stop(function(e) {
      if (e) return reject(e);
      resolve();
    });
  });
}

TestHelper.prototype.createAdminSession = function(instance) {
  return new Promise((resolve, reject) => {
    instance.services.session.localAdminClient(function(e, session) {
      if (e) return reject(e);
      resolve(session);
    });
  });
}

module.exports = TestHelper;
