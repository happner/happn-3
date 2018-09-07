module.exports = {
  checkMask: function (combo, mask) {

    if (!mask) return true;

    for (var i = 0; i < combo.length; i++)
      if (mask[i] + combo[i] == 2) return true;

    return false;
  },
  binaryCombinations: function (n) {

    var result = [];
    for (y = 0; y < Math.pow(2, n); y++) {
      var combo = [];
      for (x = 0; x < n; x++) combo.push((y >> x) & 1);
      //shift bit and AND it with 1

      result.push(combo);
    }
    return result;
  },
  getWildcardPermutations: function (topic, mask) {

    var _this = this;

    var possible = [];

    var segments = topic.split('/').slice(1);

    var combinations = this.binaryCombinations(segments.length);

    combinations.forEach(function (combo) {

      if (mask != null && (eval(mask.join('+')) > 0) && !_this.checkMask(combo, mask)) return;

      var possibility = [];

      segments.forEach(function (segment, segmentIndex) {

        if (combo[segmentIndex] == 1) return possibility.push('*');
        possibility.push(segment);
      });

      possible.push('/' + possibility.join('/'));
    });

    return possible;
  },
  integer: function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  },
  string: function (options) {

    if (options == null) options = {};

    if (options.length == null) options.length = 20;

    var loopCount = options.length / 10 + 2;

    var createString = function () {
      var str = "";

      for (var i = 0; i < loopCount; i++) {
        str += require('shortid').generate();
      }

      return str.substring(0, options.length);
    };

    if (options.count) {

      var stringArr = [];

      for (var i = 0; i < options.count; i++)
        stringArr.push(createString());

      return stringArr;

    } else return createString();
  },
  randomPaths: function (options) {

    if (options == null) options = {};

    if (options.count == null) options.count = 10;

    if (options.maxSegments == null) options.maxSegments = 5;

    if (options.segmentDelimiter == null) options.segmentDelimiter = "/";

    var paths = [];

    for (var itemCount = 0; itemCount < options.count; itemCount++) {

      var maxSegments = this.integer(1, options.maxSegments);
      var segments = [];

      if (options.prefix) segments.push(options.prefix);

      for (var segmentCount = 0; segmentCount < maxSegments; segmentCount++) {
        segments.push(this.string());
      }

      if (options.suffix) segments.push(options.suffix);

      var subscription = segments.join(options.segmentDelimiter);

      if (options.duplicate) {
        for (var duplicateCount = 0; duplicateCount < options.duplicate; duplicateCount++)
          paths.push('/' + subscription);
      } else paths.push('/' + subscription);
    }

    return paths;
  }
};
