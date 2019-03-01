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
      };

      protocolMock.processInboundStack = function(message, protocol, callback){
        expect(message.session.protocol).to.be('happn_1.3.0');
        callback(null, message);
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
      };

      protocolMock.processInboundStack = function(message, protocol, callback){
        expect(message.session.protocol).to.be('happn_2');
        callback(null, message);
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

      protocolMock.processMessageIn({
        session:{
          protocol:'bad'
        }
      });
    });
  });

  it('tests the processMessageInLayers method, happn_1.3.0 protocol', function(done){

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
      };

      protocolMock.processInboundStack = function(message, protocol, callback){
        expect(message.session.protocol).to.be('happn_1.3.0');
        callback(null, message);
      };

      protocolMock.processMessageInLayers({
        session:{
          protocol:'happn_1.3.0'
        }
      }, function(e){

      });
    });
  });

  it('tests the processMessageOutLayers method, happn_1.3.0 protocol', function(done){

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
        transformOut: function(message){
          return message;
        },
        emit: function(transformedPublication, session){
          expect(session.protocol).to.be('happn_1.3.0');
          done();
        }
      };

      protocolMock.processLayers = function(message, layers, callback){
        callback(null, message);
      };

      protocolMock.processMessageOutLayers({
        session:{
          protocol:'happn_1.3.0'
        }
      }, function(e){

      });
    });
  });

  it('tests the processMessageInLayers method, bad protocol', function(done){

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

    protocolMock.processInboundStack = function(message, protocol, callback){
      expect(message.session.protocol).to.be('bad');
      callback(null, message);
    };

    protocolMock.initialize({
    }, function(e){
      protocolMock.processMessageInLayers({
        session:{
          protocol:'bad'
        }
      });
    });
  });

  it('tests the processSystem method, bad protocol', function(done){

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
            expect(message).to.be('unknown system protocol: bad');
            done();
          }
        }
      }
    };

    protocolMock.initialize({
    }, function(e){
      protocolMock.processSystem({
        session:{
          protocol:'bad'
        }
      }, function(e){
        expect(e).to.be(undefined);
      });
    });
  });

  it('tests the processSystem method', function(done){

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
            done(new Error('was not meant to happn'));
          }
        }
      }
    };

    protocolMock.initialize({
    }, function(e){
      protocolMock.processSystem({
        session:{
          protocol:'happn_4'
        }
      }, function(e, message){
        expect(e).to.be(null);
        expect(message).to.eql({
          "session": {
            "protocol": "happn_4"
          }
        });
        done();
      });
    });
  });
});
