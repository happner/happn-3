const shortid = require('shortid'),
      fs = require('fs-extra'),
      request = require('request'),
      why = require('why-is-node-running'),
      delay = require('await-delay');

function TestHelper() {
  this.__testFiles = [];
  this.expect = require('expect.js');
  this.semver = require('semver');
  this.npm = require('npm-programmatic');
  this.path = require('path');
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
  if (!options.ext) options.ext = 'nedb';
  if (!options.name) options.name = shortid.generate();
  var folderName = this.path.resolve(options.dir);
  fs.ensureDirSync(folderName);
  var fileName = folderName + this.path.sep + options.name + '.' + options.ext;
  fs.writeFileSync(fileName, '');
  this.__testFiles.push(fileName);
  return fileName;
};

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

module.exports = TestHelper;
