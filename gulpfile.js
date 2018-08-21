var gulp = require('gulp');
var jshint = require('gulp-jshint');

var lintSrc = [
  './lib/**/*.js',
  './test/**/*.js',
  './index.js'
];

gulp.task('lint', function () {
  return gulp.src(lintSrc)
    .pipe(jshint())
    .pipe(jshint.reporter('default'));
});
