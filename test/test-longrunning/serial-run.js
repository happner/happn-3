var sm = require("happner-serial-mocha")
  , path = require("path")
  , fs = require("fs")
  ;

var testDir = __dirname;

var files = [];

fs.readdirSync(testDir).forEach(function (filename) {

  var filePath = testDir + path.sep + filename;

  var file = fs.statSync(filePath);

  if (!file.isDirectory() && filename.indexOf('.js') > -1 && filename.indexOf('serial-run') == -1) files.push(filePath);
});

var reportDir = testDir + path.sep + 'reports';

console.log('about to run:::', reportDir);

sm.runTasks(files, null, reportDir)

  .then(function(results){
    console.log('tests completed, check the latest report file in ' + reportDir);
  })

  .catch(function(e){
    console.log('broke:::', e);
  });
