var shortid = require('shortid'),
path = require('path'),
fs = require('fs-extra');

function TestHelper() {

  this.__testFiles = [];
}

TestHelper.create = function(){

  return new TestHelper();
};

TestHelper.prototype.testName = function(testFilename, depth){

  if (!depth) depth = 2;

  var fileParts = testFilename.split(path.sep).reverse();

  var poParts = [];

  for (var i = 0; i < depth; i++)
    poParts.push(fileParts.shift());

  return poParts.reverse().join('/').replace('.js', '');
};

TestHelper.prototype.newTestFile = function (options) {

  var _this = this;

  if (!options) options = {};

  if (!options.dir) options.dir = 'test' + path.sep + 'tmp';

  if (!options.ext) options.ext = 'nedb';

  if (!options.name) options.name = shortid.generate();

  var folderName = path.resolve(options.dir);

  fs.ensureDirSync(folderName);

  var fileName = folderName + path.sep + options.name + '.' + options.ext;

  fs.writeFileSync(fileName, '');

  _this.__testFiles.push(fileName);

  return fileName;
};

TestHelper.prototype.deleteFiles = function () {

  var _this = this;

  var errors = 0;

  var deleted = 0;

  var lastError;

  _this.__testFiles.forEach(function (filename) {
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

module.exports = TestHelper;
