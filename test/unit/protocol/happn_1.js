var path = require('path');
var expect = require('expect.js');

describe(require('../../__fixtures/utils/test_helper').create().testName(__filename, 3), function () {

  it('tests the __transformResponse method, array with one item', function () {

    var Protocol = require('../../../lib/services/protocol/happn_1');
    var protocol = new Protocol();

    var response = protocol.__transformResponse({
      request:{}
    }, [{
      _meta:{},
      data:{}
    }]);

    expect(response).to.eql([{
      _meta:{},
      data:{}
    }]);
  });
});
