var gulp = require("gulp");
var jshint = require("gulp-jshint");

var lintSrc = ["./lib/**/*.js", "./test/**/*.js"];

gulp.task("lint", function() {
  return gulp
    .src(lintSrc)
    .pipe(jshint({ esversion: 8 }))
    .pipe(jshint.reporter("default"));
});
