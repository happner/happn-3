var Happn = require('..')
  , expect = require('expect.js')
  , async = require('async')
  , shortid = require('shortid')
  ;

describe('f8_publisher_service', function () {

  var UtilsService = require('../lib/services/utils/service');

  var utilsService = new UtilsService();

  before('', function(){

  });

  after('', function(){

  });

  function mockQueueService(items, itemPushedHandler){

    return {
      itemPushedHandler:itemPushedHandler,
      pushOutbound:function(message, callback){

        this.items.push(message);

        callback();

        if (this.itemPushedHandler) this.itemPushedHandler(message);
      },
      items:items
    }
  }

  function mockPublisherService(config, testItems, callback){

    var PublisherService = require('../lib/services/publisher/service');

    var publisherService = new PublisherService({logger:{
      createLogger:function(key){
        return {
          warn:function(message){
            console.log(message);
          },
          info:function(message){
            console.log(message);
          },
          success:function(message){
            console.log(message);
          },
          error:function(message){
            console.log(message);
          },
          $$TRACE:function(message){
            console.log(message);
          }
        }
      }
    }});

    publisherService.happn = {
      services:{
        data:{
          get: function(path, criteria, callback){
            return callback(null, testItems);
          }
        },
        utils:utilsService,
        queue:mockQueueService()
      }
    };

    publisherService.initialize(config, function(e){

      if (e) return callback(e);

      return callback(null, subscriptionService);

    });
  }


  it('instantiates a publication, defaulted options', function (done) {

    var Publication = require('../lib/services/publisher/publication');

    var message = {
      request:{
        action:'set',
        eventId:10,
        path:'/set/some/data',
        data:{
          test:'data'
        },
        options:{
          other:'data'
        }
      },
      session:{
        id:'1'
      },
      protocol:'happn-1.0.0',
      recipients:[

      ],
      response:{
        "data": {
          "data": {
            "was": "set"
          }
        },
        "_meta": {
          "path": "/set/some/data",
          "action": "set",
          "type": "response"
        }
      }
    };

    var expectedMessage = {
      "data": {
        "data": {
          "was": "set"
        }
      },
      "_meta": {
        "path": "/set/some/data",
        "action": "/SET@/set/some/data",
        "type": "data"
      },
      "protocol":"happn-1.0.0"
    };

    var publication = new Publication(message);

    expect(publication.options.consistency).to.be(2);//transactional by default

    expect(publication.origin).to.be(message.session.id);

    expect(publication.id).to.be(message.session.id + '-' + message.request.eventId);//publications have a unique id built up from session and eventId

    expect(publication.payload).to.eql(JSON.stringify(expectedMessage));//not what gets queued exactly, just the data bit

    expect(publication.recipients.length).to.eql(message.recipients.length);

    done();

  });

  it('instantiates a publication, defined options', function (done) {

    var Publication = require('../lib/services/publisher/publication');

    // {
    //   "action": "set",
    //   "eventId": "{{number, matches handler in client}}",
    //   "path": "/set/some/data",
    //   "data": {
    //   "data": {
    //     "was": "set"
    //   }
    // },
    //   "sessionId": "{{guid}}",
    //   "options": {
    //   "timeout": 30000
    // }
    // }

    var message = {
      request:{
        action:'set',
        eventId:10,
        path:'/set/some/data',
        data:{
          test:'data'
        },
        options:{
          other:'data',
          consistency:1
        }
      },
      session:{
        id:'1'
      },
      protocol:'happn-1.0.0',
      recipients:[

      ],
      response:{
        "data": {
          "data": {
            "was": "set"
          }
        },
        "_meta": {
          "path": "/set/some/data",
          "action": "set",
          "type": "response"
        }
      }
    };

    var expectedMessage = {
      "data": {
        "data": {
          "was": "set"
        }
      },
      "_meta": {
        "path": "/set/some/data",
        "action": "/SET@/set/some/data",
        "type": "data"
      },
      "protocol":"happn-1.0.0"
    };

    var publication = new Publication(message);

    expect(publication.options.consistency).to.be(1);//this was defined

    expect(publication.origin).to.be(message.session.id);

    expect(publication.id).to.be(message.session.id + '-' + message.request.eventId);//publications have a unique id

    expect(publication.payload).to.eql(JSON.stringify(expectedMessage));

    expect(publication.recipients.length).to.eql(message.recipients.length);

    done();

  });

  it('tests the publication\'s publish method, no recipients', function (done) {

    var Publication = require('../lib/services/publisher/publication');

    var message = {
      request:{
        action:'set',
        eventId:10,
        path:'/set/some/data',
        data:{
          test:'data'
        },
        options:{
          other:'data',
          consistency:1
        }
      },
      session:{
        id:'1'
      },
      protocol:'happn-1.0.0',
      recipients:[],
      response:{
        "data": {
          "data": {
            "was": "set"
          }
        },
        "_meta": {
          "path": "/set/some/data",
          "action": "set",
          "type": "response"
        }
      }
    };

    var expectedMessage = {
      "data": {
        "data": {
          "was": "set"
        }
      },
      "_meta": {
        "path": "/set/some/data",
        "action": "/SET@/set/some/data",
        "type": "data"
      },
      "protocol":"happn-1.0.0"
    };

    var publication = new Publication(message);

    expect(publication.recipients.length).to.eql(0);

    var myArray = [];

    var mockQueue = mockQueueService(myArray);

    publication.publish(mockQueue, {}, function(e, results){

      if (e) return done(e);

      console.log('results:::', results);

      done();

    });

  });

  it('tests the publications publish method, with recipients, default consistency', function (done) {

    var Publication = require('../lib/services/publisher/publication');

    var message = {
      request:{
        action:'set',
        eventId:10,
        path:'/set/some/data',
        data:{
          test:'data'
        },
        options:{
          other:'data',
          consistency:2
        }
      },
      session:{
        id:'1'
      },
      protocol:'happn-1.0.0',
      recipients:[
        {
          session:{id:'1'}
        },{
          session:{id:'2'}
        }
      ],
      response:{
        "data": {
          "data": {
            "was": "set"
          }
        },
        "_meta": {
          "path": "/set/some/data",
          "action": "set",
          "type": "response"
        }
      }
    };

    var expectedMessage = {
      "data": {
        "data": {
          "was": "set"
        }
      },
      "_meta": {
        "path": "/set/some/data",
        "action": "/SET@/set/some/data",
        "type": "data"
      },
      "protocol":"happn-1.0.0"
    };

    var publication = new Publication(message);

    expect(publication.recipients.length).to.eql(2);

    var myArray = [];

    var mockQueue = mockQueueService(myArray);

    publication.publish(mockQueue, {}, function(e, results){

      if (e) return done(e);

      console.log('results:::', results);

      done();

    });

  });

  it('tests the publications publish method, with recipients, acknowledged consistency', function (done) {

    var Publication = require('../lib/services/publisher/publication');

    var message = {
      request:{
        action:'set',
        eventId:10,
        path:'/set/some/data',
        data:{
          test:'data'
        },
        options:{
          other:'data',
          consistency:3
        }
      },
      session:{
        id:'1'
      },
      protocol:'happn-1.0.0',
      recipients:[
        {
          session:{id:'1'}
        },{
          session:{id:'2'}
        }
      ],
      response:{
        "data": {
          "data": {
            "was": "set"
          }
        },
        "_meta": {
          "path": "/set/some/data",
          "action": "set",
          "type": "response"
        }
      }
    };

    var publication = new Publication(message);

    expect(publication.recipients.length).to.eql(2);

    var myArray = [];

    var mockQueue = mockQueueService(myArray, function(processedMessage){

      publication.acknowledge(processedMessage, function(e){
        console.log('DID ACK:::',publication.unacknowledged);
        if (e) return done(e);
      });
    });

    publication.publish(mockQueue, {}, function(e, results){

      if (e) return done(e);

      console.log('results:::', results);

      done();

    });

  });

  xit('tests the publications publish method, with recipients, queued consistency', function (done) {

  });

  xit('tests the publications publish method, with recipients, transactional consistency', function (done) {

  });



});
