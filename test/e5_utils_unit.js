var path = require('path');
var filename = path.basename(__filename);
var expect = require('expect.js');
var Utils = require('../lib/services/utils/service')
var utils = new Utils();

describe(filename, function () {

  // require('benchmarket').start();
  // after(require('benchmarket').store({timeout:10000}));

  it('tests mergeObjects', function (done) {

    var test1 = utils.mergeObjects({'test1':1}, {'test2':2});

    expect(test1.test1).to.be(1);
    expect(test1.test2).to.be(2);

    var test2 = utils.mergeObjects({'test1':1}, {'test1':2}, {overwrite:true});

    expect(test2.test1).to.be(2);

    var obj1 = {test:1};
    var obj2 = {test:2, test1:{hello:1}};

    var test3 = utils.mergeObjects(obj1, obj2, {overwrite:false, clone:true});

    expect(test3.test).to.be(1);
    expect(test3.test1.hello).to.be(1);

    test3.test1.hello = 4;
    expect(obj2.test1.hello).to.be(1);

    var obj1 = {test:1};
    var obj2 = {test:2, test1:{hello:1}};

    var test3 = utils.mergeObjects(obj1, obj2, {overwrite:false, clone:false});

    expect(test3.test).to.be(1);
    expect(test3.test1.hello).to.be(1);

    test3.test1.hello = 4;
    expect(obj2.test1.hello).to.be(4);

    done();

  });

  //require('benchmarket').stop();

});
