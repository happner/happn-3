var Happn = require('..')
  expect = require('expect.js')
  ;

describe('g3_error_service', function () {

  it('tests the various error types', function (done) {

    var ErrorService = require('../lib/services/error/service.js');

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
      "name": "SystemError"
    });

    var resourceNotFound = errorService.ResourceNotFoundError('test resource not found');

    expect(resourceNotFound).to.eql({
      "code": 404,
      "message": "test resource not found",
      "name": "ResourceNotFound"
    });

    var accessDenied = errorService.ValidationError('test validation');

    expect(accessDenied).to.eql({
      "code": 500,
      "message": "test validation",
      "name": "ValidationError"
    });

    done();

  });

});
