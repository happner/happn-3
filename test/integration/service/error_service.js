expect = require('expect.js');

describe(require('../../__fixtures/utils/test_helper').create().testName(__filename, 3), function () {

  it('tests the various error types', function (done) {

    var ErrorService = require('../../../lib/services/error/service.js');

    var errorService = new ErrorService();

    var accessDenied = errorService.AccessDeniedError('test access denied');

    expect(accessDenied).to.eql({
      "code": 403,
      "message": "test access denied",
      "name": "AccessDenied"
    });

    var system = errorService.SystemError('test system');

    expect(system).to.eql({
      "code": 500,
      "message": "test system",
      "name": "SystemError",
      "severity": 0
    });

    var resourceNotFound = errorService.ResourceNotFoundError('test resource not found');

    expect(resourceNotFound).to.eql({
      "code": 404,
      "message": "test resource not found",
      "name": "ResourceNotFound"
    });

    accessDenied = errorService.ValidationError('test validation');

    expect(accessDenied).to.eql({
      "code": 500,
      "message": "test validation",
      "name": "ValidationError"
    });

    done();

  });

});
