var Happn = require('..')
  ;

describe('g2_browser_client', function () {

  it('builds the happn browser client ', function (done) {

    var clientCode = Happn.getBrowserClient();

    //console.log('clientCode:::', clientCode);

    done();

  });

});
