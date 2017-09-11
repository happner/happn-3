var sm = require("happner-serial-mocha"),
  path = require("path"),
  fs = require("fs");

var testDir = path.resolve(__dirname, '../');

var files = [];

fs.readdirSync(testDir).forEach(function (filename) {

  var filePath = testDir + path.sep + filename;
  var file = fs.statSync(filePath);

  if (!file.isDirectory() && filename.indexOf('.js') > -1) files.push(filePath);
});

var reportDir = path.resolve(__dirname, '../reports');

sm.runTasks(files, null, reportDir)

  //sm.runTasks(files, 'lib/serialReporter.js', true)

  .then(function (results) {
    console.log('tests completed, check the latest report file in ' + reportDir);
  })

  .catch(function (e) {
    console.log('broke:::', e);
  });
