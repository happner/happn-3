describe(require('../../__fixtures/utils/test_helper').create().testName(__filename, 3), function () {

  var path = require('path');
  var shortid = require('shortid');
  var expect = require('expect.js');
  var Protocol = require('../../../lib/services/protocol/service');

  it('tests the processMessageIn method, happn_1.3.0 protocol', function(done){

    var protocolMock = new Protocol({logger:{
      createLogger:function(){
        return {
          $$TRACE:function(){}
        };
      }
    }});

    protocolMock.happn = {
      connect:{},
      log:{
        warn:function(){}
      },
      services:{
        session:{
          on:function(){}
        },
        error:{
          handleSystem:function(){},
          SystemError:function(message){
            done(new Error(message));
          }
        }
      }

    };

    protocolMock.initialize({
    }, function(e){

      protocolMock.config.protocols['happn_1'] = {
        success:function(){
          done();
        }
      }

      protocolMock.processInboundStack = function(message, protocol){
        expect(message.session.protocol).to.be('happn_1.3.0');
        return new Promise(function(resolve, reject){
          return resolve();
        });
      };

      protocolMock.processMessageIn({
        session:{
          protocol:'happn_1.3.0'
        }
      }, function(e){

      });
    });
  });

  it('tests the processMessageIn method, happn_2 protocol', function(done){

    var protocolMock = new Protocol({logger:{
      createLogger:function(){
        return {
          $$TRACE:function(){}
        };
      }
    }});

    protocolMock.happn = {
      connect:{},
      log:{
        warn:function(){}
      },
      services:{
        session:{
          on:function(){}
        },
        error:{
          handleSystem:function(){},
          SystemError:function(message){
            done(new Error(message));
          }
        }
      }

    };

    protocolMock.initialize({
    }, function(e){

      protocolMock.config.protocols['happn_2'] = {
        success:function(){
          done();
        }
      }

      protocolMock.processInboundStack = function(message, protocol){
        expect(message.session.protocol).to.be('happn_2');
        return new Promise(function(resolve, reject){
          return resolve();
        });
      };

      protocolMock.processMessageIn({
        session:{
          protocol:'happn_2'
        }
      }, function(e){

      });
    });
  });

  it('tests the processMessageIn method, negative test', function(done){

    var protocolMock = new Protocol({logger:{
      createLogger:function(){
        return {
          $$TRACE:function(){}
        };
      }
    }});

    protocolMock.happn = {
      connect:{},
      log:{
        warn:function(){}
      },
      services:{
        session:{
          on:function(){}
        },
        error:{
          SystemError:function(message){
            expect(message).to.be('unknown inbound protocol: happn_1.3.0');
            done();
          }
        }
      }

    };

    protocolMock.initialize({
    }, function(e){

      protocolMock.processMessageIn = function processMessageIn (message, callback) {

        var _this = this;

        var protocol = _this.config.protocols[message.session.protocol];
        if (!protocol) return callback(_this.happn.services.error.SystemError('unknown inbound protocol: ' + message.session.protocol, 'protocol'));

        _this.processInboundStack(message, protocol)
        .then(function (processed) {
          callback(null, protocol.success(processed));
        })
        .catch(function(e){
          _this.__handleProtocolError(protocol, message, e, callback);
        });
      }.bind(protocolMock);

      protocolMock.processMessageIn({
        session:{
          protocol:'happn_1.3.0'
        }
      });
    });
  });

  it('tests the processMessageIn method, bad protocol', function(done){

    var protocolMock = new Protocol({logger:{
      createLogger:function(){
        return {
          $$TRACE:function(){}
        };
      }
    }});

    protocolMock.happn = {
      connect:{},
      log:{
        warn:function(){}
      },
      services:{
        session:{
          on:function(){}
        },
        error:{
          SystemError:function(message){
            expect(message).to.be('unknown inbound protocol: bad');
            done();
          }
        }
      }

    };

    protocolMock.initialize({
    }, function(e){

      protocolMock.processMessageIn = function processMessageIn (message, callback) {

        var _this = this;

        var protocol = _this.config.protocols[message.session.protocol];
        if (!protocol) return callback(_this.happn.services.error.SystemError('unknown inbound protocol: ' + message.session.protocol, 'protocol'));

        _this.processInboundStack(message, protocol)
        .then(function (processed) {
          callback(null, protocol.success(processed));
        })
        .catch(function(e){
          _this.__handleProtocolError(protocol, message, e, callback);
        });
      }.bind(protocolMock);

      protocolMock.processMessageIn({
        session:{
          protocol:'bad'
        }
      });
    });
  });
});
