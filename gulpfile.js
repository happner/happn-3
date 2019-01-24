var gulp = require('gulp');
var jshint = require('gulp-jshint');

var lintSrc = [
  './lib/**/*.js',
  './test/**/*.js'
];

gulp.task('lint', function () {
  return gulp.src(lintSrc)
    .pipe(jshint({esnext:true}))
    .pipe(jshint.reporter('default'));
});
