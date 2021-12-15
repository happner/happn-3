[![npm](https://img.shields.io/npm/v/happn-3.svg)](https://www.npmjs.com/package/happn-3)
[![Build Status](https://travis-ci.org/happner/happn-3.svg?branch=master)](https://travis-ci.org/happner/happn-3)
[![Coverage Status](https://coveralls.io/repos/happner/happn-3/badge.svg?branch=master&service=github)](https://coveralls.io/github/happner/happn-3?branch=master)
[![David](https://img.shields.io/david/happner/happn-3.svg)](https://img.shields.io/david/happner/happn-3.svg)

<img src="https://raw.githubusercontent.com/happner/happner-website/master/images/HAPPN%20Logo%20B.png" width="300"></img>

VERSION 3
---------

Introduction
-------------------------

Happn is a mini database combined with pub/sub, the system stores json objects on paths. Paths can be queried using wildcard syntax. The happn client can run in the browser or in a node process. Happn clients can subscribe to events on paths, events happn when data is changed by a client on a path, either by a set or a remove operation.

Happn stores its data in a collection called 'happn' by default on your mongodb/nedb. The happn system is actually built to be a module, this is because the idea is that you will be able to initialize a server in your own code, and possibly attach your own plugins to various system events.

A paid for alternative to happn would be [firebase](https://www.firebase.com)

Key technologies used:
Happn uses [Primus](https://github.com/primus/primus) to power websockets for its pub/sub framework and mongo or nedb depending on the mode it is running in as its data store, the API uses [connect](https://github.com/senchalabs/connect).
[nedb](https://github.com/louischatriot/nedb) as the embedded database, although we have forked it happn's purposes [here](https://github.com/happner/happn-nedb)

VERSION 2 and what has changed
------------------------------

Happn v2 can be found [here](https://github.com/happner/happn)

changes are:

1. more modular layout, services are broken up into logical modules
2. introduction of a queue service
3. introduction of a protocol service, this allows for the creation of protocol plugins that take messages of the inbound and outbound queues and convert them into happn messages, essentially means we are able to use different protocols to talk to happn (ie. MQTT)
4. simplified intra process client instantiation
5. intra process client shares the same code as the websockets client, using a special intra-proc socket, instead of a primus spark
6. database is now versioned and must be in sync with package.json

[Migration plan from happn 2 to happn-3](https://github.com/happner/happn-3/blob/master/docs/migration-plan.md)
--------------------------------------

Getting started
---------------------------

```bash
npm install happn-3
```

You need NodeJS and NPM of course, you also need to know how node works (as my setup instructions are pretty minimal)
To run the tests, clone the repo, npm install then npm test:

```bash
git clone https://github.com/happner/happn-3.git
npm install
npm test
```

But if you want to run your own service do the following:
Create a directory you want to run your happn in, create a node application in it - with some kind of main.js and a package.json

*In node_modules/happn/test in your folder, the 1_eventemitter_embedded_sanity.js and 2_websockets_embedded_sanity.js scripts demonstrate the server and client interactions shown in the following code snippets*

[configuration](https://github.com/happner/happn-3/blob/master/docs/config.md)
--------------------------------------
*for full service and client configuration options*

starting service:
-------------------------------------------------------

The service runs on port 55000 by default - the following code snippet demonstrates how to instantiate a server.

```javascript
var happn = require('happn-3')
var happnInstance; //this will be your server instance

//we are using a compact default config here, port defaults to 55000

 happn.service.create({
  utils: {
    logLevel: 'error',
    // see happn-logger module for more config options
  }
},
function (e, happn) {
  if (e)
    return callback(e);

  happnInstance = happn; //here it is, your server instance
  happnInstance.log.info('server up');

});

```
In your console, go to your application folder and run*node main*your server should start up and be listening on your port of choice.

THE HAPPN CLIENT
-------------------------

Using node:

```javascript
var happn = require('happn-3');
var my_client_instance; //this will be your client instance

/**
example options are :
{
    host: "127.0.0.1", //(default)
    port: 55000, //(default)
    username: 'username', //only necessary if server is secure
    password: 'password', //only necessary if server is secure
    socket: {
      pingTimeout: 45e3 // 45 seconds by default, if set to false the client
                        // will not detect connection failures and emit the
                        // 'reconnect scheduled event'
    }
}
**/

happn.client.create([options], function(e, instance) {

	//instance is now connected to the server listening on port 55000
	my_client_instance = instance;
});

```

To use the browser client, make sure the server is running, and reference the client javascript with the url pointing to the running server instances port and ip address like so:

```html
<script type="text/javascript" src="http://localhost:55000/browser_client"></script>
<script>

var my_client_instance;

HappnClient.create([options], function(e, instance) {

	//instance is now connected to the server listening on port 55000
	my_client_instance = instance;

});

</script>
```
Intra-process / local client:
-----------------------------
*although we have direct access to the services (security included) - this method still requires a username and password if the happn instance is secure*
```javascript

service.create(function (e, happnInst) {

    if (e) throw e;

    happnInstance = happnInst;

    happnInstance.services.session.localClient(/*credentials argument only necessary if secure*/{username:'test', password:'test'}, function(e, instance){

      var myLocalClient = instance;

      //myLocalClient.set(...)

    });

  });

```

Intra-process / local admin client:
-----------------------------------------------------
*will pass back a client with admin rights no username or password necessary, this is because we have direct access to the services, security included*
```javascript

service.create(function (e, happnInst) {

    if (e) throw e;

    happnInstance = happnInst;

    happnInstance.services.session.localAdminClient(function(e, instance){

      var myLocalAdminClient = instance;

      //myLocalClient.set(...)

    });

  });

```

##NB: NODE_ENV environment variable
*Set your NODE_ENV variable to "production" when running happn in a production environment, otherwise your browser client file will be regenerated every time the happn server is restarted.*

SET
-------------------------

*Puts the json in the branch e2e_test1/testsubscribe/data, creates the branch if it does not exist*

```javascript

//the noPublish parameter means this data change wont be published to other subscribers, it is false by default
//there are a bunch other parameters - like noStore (the json isnt persisted, but the message is published)

my_client_instance.set('e2e_test1/testsubscribe/data/', {property1:'property1',property2:'property2',property3:'property3'}, {noPublish:true}, function(e, result){

	//your result object has a special _meta property that contains its actual _id, path, created and modified dates
	//so you get back {property1:'property1',property2:'property2',property3:'property3', _meta:{path:'e2e_test1/testsubscribe/data/', created:20151011893020}}


});

```

*NB - by setting the option merge:true, the data at the end of the path is not overwritten by your json, it is rather merged with the data in your json, overwriting the fields you specify in your set data, but leaving the fields that are already at that branch.*

PUBLISH
-------------------------

*publishes the json to all topic subscribers that match e2e_test1/testsubscribe/data, the data is not stored or returned in the response, only the _meta is returned*

```javascript

my_client_instance.publish('e2e_test1/testsubscribe/data/', {property1:'property1',property2:'property2',property3:'property3'}, function(e, result){

	//your result does not contain the changed data, but it still has the _meta property:
  result = {
    _meta:{
      published: true,
      type: 'response',
      status: 'ok',
      eventId: 4, //eventId matching event handler on client
      sessionId: '[guid: your current session id]'
    }
  }
});

```

SET SIBLING
-------------------------

*sets your data to a unique path starting with the path you passed in as a parameter, suffixed with a random short id*

```javascript
	my_client_instance.setSibling('e2e_test1/siblings', {property1:'sib_post_property1',property2:'sib_post_property2'}, function(e, results){
		//you get back {property1:'sib_post_property1',property2:'sib_post_property2', _meta:{path:'e2e_test1/siblings/yCZ678__'}}
		//you would get all siblings by querying the path e2e_test1/siblings*
```

INCREMENT
-------------------------

*allows a counter to be incremented by an increment value*

*single guage - causing on event:*
```javascript

  //listen on a path
  myclient.on('my/increment/guage', function(data){

    //NB; the data on the event will look like this
    //{guage:'counter', value:1}

    myclient.get('my/increment/guage', function(e, gotIncrementedData){

      expect(gotIncrementedData[data.value].value).to.be(1);
    });

  }, function(e){

    if (e) throw e;

    //increment convenience method
    myclient.increment('my/increment/guage', 1, function(e){

      if (e) throw e;
    });
  });
```

*increment multiple times, guage defaults to counter and increment value is 1:*
```javascript
  var async = require('async');

  async.timesSeries(10, function (time, timeCB) {

    myclient.increment('my/guage', function (e) {

      timeCB(e);
    });

  }, function (e) {

    myclient.get('my/guage', function (e, result) {

      expect(result['counter-0'].value).to.be(10);

    });
  });
```

*multiple guages on the same path:*
```javascript
  var async = require('async');

  async.timesSeries(10, function (time, timeCB) {

    myclient.increment('my/dashboard', 'counter-' + time, 1, function (e) {

      timeCB(e);
    });

  }, function (e) {

    myclient.get('my/dashboard', function (e, result) {

      expect(result['counter-0'].value).to.be(1);
      expect(result['counter-1'].value).to.be(1);
      expect(result['counter-2'].value).to.be(1);
      expect(result['counter-3'].value).to.be(1);
      expect(result['counter-4'].value).to.be(1);
      expect(result['counter-5'].value).to.be(1);
      expect(result['counter-6'].value).to.be(1);
      expect(result['counter-7'].value).to.be(1);
      expect(result['counter-8'].value).to.be(1);
      expect(result['counter-9'].value).to.be(1);

    });
  });
```

*decrement a guage with a minus value:*
```javascript

  var incrementCount = 0;

  //listening on the event
  myclient.on('my/test/guage', function (data) {

    incrementCount++;

    if (incrementCount == 1){
      expect(data.value).to.be(3);
      expect(data.guage).to.be('custom');
    }

    if (incrementCount == 2){
      expect(data.value).to.be(1);
      expect(data.guage).to.be('custom');
    }

  }, function (e) {

    myclient.increment('my/test/guage', 'custom', 3, function (e) {

      myclient.get('my/test/guage', function (e, result) {

          expect(result['custom'].value).to.be(1);

          myclient.increment('my/test/guage', 'custom', -2, function (e) {

             myclient.get('my/dashboard', function (e, result) {

                  expect(result['custom'].value).to.be(1);
             });
          });
      });
    });
  });
```

GET
---------------------------

*Gets the data living at the specified branch*

```javascript
my_client_instance.get('e2e_test1/testsubscribe/data',
	null, //options
	function(e, results){
	//results is your data, if you used a wildcard in your path, you get back an array
	//if you used an explicit path, you get back your data as the object on that path

```

*You can also use wildcards, gets all items with the path starting e2e_test1/testsubscribe/data*

```javascript
my_client_instance.get('e2e_test1/testsubscribe/data*',
	null,
	function(e, results){
	//results is your data
	results.map(function(item){

	});
```

*You can also just get paths, without data*

```javascript
my_client_instance.getPaths('e2e_test1/testwildcard/*', function(e, results){
```

SEARCH
---------------------------

*You can pass mongo style search parameters to look for data sets within specific key ranges, using limit and skip*

```javascript

	var options = {
      fields: {"name": 1},
      sort: {"name": 1},
      limit: 10,
      skip:5
    }

    var criteria = {
      $or: [{"region": {$in: ['North', 'South', 'East', 'West']}},
        	{"town": {$in: ['North.Cape Town', 'South.East London']}}],
      "surname": {$in: ["Bishop", "Emslie"]}
    }

    publisherclient.get('/users/*', {
	    criteria: criteria,
	    options: options
	  },
	  function (e, search_results) {
	  	//and your results are here
	  	search_results.map(function(user){
	  		if (user.name == 'simon')
	  			throw new Error('stay away from this chap, he is dodgy');
	  	});
	  }
	);

```

*Using $regex is a bit different, you can pass in a regex string representation or an array with regex string as the first element and modifiers such as i as the second element depending on whether you want to pass in regex arguments such as case insensitive (i)*

```javascript

	var options = {
      fields: {"name": 1},
      sort: {"name": 1},
      limit: 1
    }

    var criteria = {
      "name": {
        "$regex": [".*simon.*", "i"]//array with regex first, then "i" argument, does Regex.apply(null, [your array]) in backend
      }
    };

    //alternatively - for a case sensitive simpler search:
    var criteriaSimple = {
      "name": {
        "$regex": ".*simon.*"//array with regex first, then "i" argument, does Regex.apply(null, [your array]) in backend
      }
    };

    publisherclient.get('/users/*', {
	    criteria: criteria,//(or criteriaSimple)
	    options: options
	  },
	  function (e, search_results) {
	  	//and your results are here
	  	search_results.map(function(user){
	  		if (user.name == 'simon')
	  			throw new Error('stay away from this chap, he is dodgy');
	  	});
	  }
	);

```

*You can also use skip and limit for paging:*

```javascript

var totalRecords = 100;
var pageSize = 10;
var expectedPages = totalRecords / pageSize;
var indexes = [];

for (let i = 0; i < totalRecords; i++) indexes.push(i);

for (let index of indexes){
  await searchClient.set('series/horror/' + index, {
      name: 'nightmare on elm street',
      genre: 'horror',
      episode:index
    });
  await searchClient.set('series/fantasy/' + index, {
      name: 'game of thrones',
      genre: 'fantasy',
      episode:index
    });
}

var options = {
  sort: {
    "_meta.created": -1
  },
  limit: pageSize
};

var criteria = {
  "genre": "horror"
};

var foundPages = [];

for (let i = 0; i < expectedPages; i++){
  options.skip = foundPages.length;
  let results = await searchClient.get('series/*', {
      criteria: criteria,
      options: options
    });
  foundPages = foundPages.concat(results);
}

let allResults = await searchClient.get('series/*', {
    criteria: criteria,
    options: {
      sort: {
        "_meta.created": -1
      }
    }
  });

expect(allResults.length).to.eql(foundPages.length);
expect(allResults).to.eql(foundPages);
```

DELETE / REMOVE
---------------------------

*deletes the data living at the specified branch*

```javascript
	my_client_instance.remove('/e2e_test1/testsubscribe/data/delete_me', null, function(e, result){
	if (!e)
		//your item was deleted, result.payload is an object that lists the amount of objects deleted
```

EVENTS
----------------------------

*you can listen to any SET & REMOVE events happening in your data - you can specify a path you want to listen on or you can listen to all SET and DELETE events using a catch-all listener, the * character denotes a wildcard*

NB about wildcards:
-------------------

As of version 8.0.0 the wildcard is a whole word, and the / is used to denote path segments - ie: to get all events for a set or remove with path /my/test/event you need to subscribe to /my/\*/\*, /my/\* and /my\* or /my/te\*/event will no longer work. One deviation from this limitation is in the usage of variable depth subscriptions (as documented below).

Specific listener:
```javascript
my_client_instance.on('/e2e_test1/testsubscribe/data/delete_me', //the path you are listening on
					{event_type:'remove', // either set, remove or all - defaults to all
					 count:0},// how many times you want your handler to handle for before it is removed - default is 0 (infinity)
					function(//your listener event handler
						message, //the actual object data being set or removed
						meta){ //the meta data - path, modified,created _id etc.


					},
					function(e){
						//passes in an error if you were unable to register your listener
          });
//this is now promise based as of v11.5.0
const handle = await my_client_instance.on('/e2e_test1/testsubscribe/data/delete_me', //the path you are listening on
					{event_type:'remove', // either set, remove or all - defaults to all
					 count:0},// how many times you want your handler to handle for before it is removed - default is 0 (infinity)
					function(//your listener event handler
						message, //the actual object data being set or removed
            meta){ //the meta data - path, modified,created _id etc.
            //event happened
          });
await my_client_instance.off(handle); //unsubscribe
```

Catch all listener:
```javascript
my_client_instance.onAll(function(//your listener event handler
						message, //the actual object data being set or removed
						meta){ 
              //the meta data - path, modified,created _id, also tells you what type of operation happened - ie. GET, SET etc.
					},
					function(e){
						//passes in an error if you were unable to register your listener
          });
//this is now promise based as of v11.5.0
const handle = await my_client_instance.onAll(function(//your listener event handler
  message, //the actual object data being set or removed
  meta){ //the meta data - path, modified,created _id, also tells you what type of operation happened - ie. GET, SET etc.
});
```

Once listener:
```javascript
const handle = await my_client_instance.once('/e2e_test1/testsubscribe/data/delete_me', //the path you are listening on
					{ event_type:'*' }, // either set, remove or all - defaults to all
					function(//your listener event handler
						message, //the actual object data being set or removed
            meta){ //the meta data - path, modified,created _id etc.
            //event happened
          });
await my_client_instance.off(handle); //unsubscribe, these will auto-expire after they have received a single message
```

EVENT DATA
----------------------------

*you can grab the data you are listening for immediately either by causing the events to be emitted immediately on successful subscription or you can have the data returned as part of the subscription callback using the initialCallback and initialEmit options respectively*

```javascript
//get the data back as part of the subscription callback
listenerclient.on('/e2e_test1/testsubscribe/data/values_on_callback_test/*',
  {"event_type": "set",
  "initialCallback":true //set to true, causes data to be passed back
  }, function (message) {

          expect(message.updated).to.be(true);
          callback();

        }, function(e, reference, response){
          if (e) return callback(e);
          try{

            //the response is your data, ordered by modified - will always be in an array even if only one or none is found

            expect(response.length).to.be(2);
            expect(response[0].test).to.be('data');
            expect(response[1].test).to.be('data1');

            listenerclient.set('/e2e_test1/testsubscribe/data/values_on_callback_test/1', {"test":"data", "updated":true}, function(e){
              if (e) return callback(e);
            });

          }catch(e){
            return callback(e);
          }
        });

```

```javascript
//get the data emitted back immediately

listenerclient.on('/e2e_test1/testsubscribe/data/values_emitted_test/*',
  {"event_type": "set",
  "initialEmit":true //set to true causes emit to happen on successful subscription
  }, function (message, meta) {
          //this emit handler runs immediately
          caughtEmitted++;

          if (caughtEmitted == 2){
            expect(message.test).to.be("data1");
            callback();
          }


        }, function(e){
          if (e) return callback(e);
        });

```

UNSUBSCRIBING FROM EVENTS
----------------------------

//use the .off method to unsubscribe from a specific event (the handle is returned by the .on callback) or the .offPath method to unsubscribe from all listeners on a path:

```javascript

var currentListenerId;
var onRan = false;
var pathOnRan = false;

listenerclient.on('/e2e_test1/testsubscribe/data/on_off_test', {event_type: 'set', count: 0}, function (message) {

  if (pathOnRan) return callback(new Error('subscription was not removed by path'));
  else pathOnRan = true;

  //NB - unsubscribing by path
  listenerclient.offPath('/e2e_test1/testsubscribe/data/on_off_test', function (e) {

    if (e)
      return callback(new Error(e));

    listenerclient.on('/e2e_test1/testsubscribe/data/on_off_test', {event_type: 'set', count: 0},
      function (message) {
        if (onRan) return callback(new Error('subscription was not removed'));
        else {
          onRan = true;
          //NB - unsubscribing by listener handle
          listenerclient.off(currentListenerId, function (e) {
            if (e)
              return callback(new Error(e));

            publisherclient.set('/e2e_test1/testsubscribe/data/on_off_test', {"test":"data"}, function (e, setresult) {
              if (e) return callback(new Error(e));
              setTimeout(callback, 2000);
            });
          });
        }
      },
      function (e, listenerId) {

        //NB - listener id is passed in on the .on callback

        if (e) return callback(new Error(e));

        currentListenerId = listenerId;

        publisherclient.set('/e2e_test1/testsubscribe/data/on_off_test', {"test":"data"}, function (e, setresult) {
          if (e) return callback(new Error(e));
        });
      });
  });

}, function (e, listenerId) {
  if (e) return callback(new Error(e));

  currentListenerId = listenerId;

  publisherclient.set('/e2e_test1/testsubscribe/data/on_off_test', {"test":"data"}, function (e) {
    if (e) return callback(new Error(e));
  });

});

```

TARGETING EVENTS
----------------

*sets and removes can be targeted for a specific client session, if you have access to a client session id, or need to do a return-ticket post, you can add the session id's you want your event data to go to to the targetClients option*

```
var mySessionId = my_client_instance.sesson.id;

//only publish to myself:

other_client_instance.on('for/my/eyes/only', function(data){
//should NOT receive this
});

my_client_instance.on('for/my/eyes/only', function(data){
//should receive this
});

my_client_instance.set('for/my/eyes/only', {property1:'property1'}, {targetClients:[mySessionId]}, function(e, result){
  ...
});

```

EVENTS WITH CUSTOM META
-----------------------

*sets and removes can declare custom metadata that will be sent to subscribers*

```javascript
client.set('/some/topic', {DATA: 1}, {meta: {custom: 1}}, function(e) {})

// elsewhere
client.on('/some/topic', function(data, meta) {
  meta.custom == 1;
});
```

Reserved meta key names will have no effect. ('created','modified','path','action','type','published','status','eventId','sessionId')

MERGE SUBSCRIPTIONS
-----------------------

*you can subscribe to data changes on set/remove and specify only to recieve the merge data as posted in the set operation with the merge:true option, NB: this is not a true delta, as you may receive some duplicate input fields*

```javascript

 my_client_instance.on('/merge/only/path', {
        event_type: 'set',
        merge: true
      }, function (message) {
        console.log('emit happened - message is {some:"data"}');
      }, function (e) {
        console.log('subscription happened');
      });

my_client_instance.set('/merge/only/path',
                      {some:"data"},
                      {merge:true},
                      function (e) {
                        console.log('set happened');
                      });

```

VARIABLE DEPTH SUBSCRIPTIONS
-----------------------
*A special subscription, with a trailing /\*\* on the path, allows for subscriptions to multiple wildcard paths, up to a specific depth*

```javascript

var happn = require('../../../lib/index');
var happn_client = happn.client;

//NB the default variable depth is 5, you can set it when initialising the client like so:
myclient = await happn_client.create({config:{username:'_ADMIN', password:'happn', defaultVariableDepth:10}});

var handler = function(data){

};

myclient.on('/test/path/**', { depth:4 }, handler, function(e, variableDepthHandle){

  //you can unsubscribe as per normal
  // ie: myclient.off(variableDepthHandle)
});

//is the same as
myclient.on('/test/path/*', handler, function(e){

});
myclient.on('/test/path/*/*', handler, function(e){

});
myclient.on('/test/path/*/*/*', handler, function(e){

});
myclient.on('/test/path/*/*/*/*', handler, function(e){

});

//NB: up to a depth of 4, so the event will not fire for a larger depth, ie: /test/path/1/2/3/4/5
//NB: this functionality also works with initialCallback and initialEmit

myclient.on('/test/path/**', {
  "event_type": "set",
  "initialEmit": true
}, function (message, meta) {
  //items will be immediately emitted up to the depth specified
});

myclient.on('/test/path/**', {
  "event_type": "set",
  "initialCallback": true
}, function (message) {

  expect(message.updated).to.be(true);
  callback();

}, function (e, reference, response) {
  //response will be an array of items that exist to the specified depth
});

```

TAGGING
----------------------------

*You can do a set command and specify that you want to tag the data at the end of the path (or the data that is created as a result of the command), tagging will take a snapshot of the data as it currently stands, and will save the snapshot to a path that starts with the path you specify, and a '/' with the tag you specify at the end*

```javascript

var randomTag = require('shortid').generate();

my_client_instance.set('e2e_test1/test/tag', {property1:'property1',property2:'property2',property3:'property3'}, {tag:randomTag}, function(e, result){

```

MERGING
----------------------------

*you can do a set command and specify that you want to merge the json you are pushing with the existing dataset, this means any existing values that are not in the set json but exist in the database are persisted*

```javascript

my_client_instance.set('e2e_test1/testsubscribe/data/', {property1:'property1',property2:'property2',property3:'property3'}, {merge:true}, function(e, result){

});

```

SESSION AND CONNECTION EVENTS:
------------------------------

*these events are emitted if the client connection state or session state changes*

```javascript

// session-ended event is emitted if the session is disconnected from the server side
my_client_instance.onEvent('session-ended', (evt) => {
  //evt.reason could be:
  //inactivity-threshold - the client has been inactive for a period exceeding what the session is profiled for (see profiles)
  //session-revoked - the client session has been revoked on the server side
  //security directory update: user deleted - the user that the session is associated with has been deleted on the server
});

// reconnect-scheduled event is emitted if the connection with the server has been interrupted
my_client_instance.onEvent('reconnect-scheduled', (evt) => {

});

// reconnect-successful event is emitted if the connection with the server has been restored
my_client_instance.onEvent('reconnect-successful', (evt) => {

});

```

After version 11.6.0, by default some basic session info is logged whenever a client attached or detaches in the format, as stringified JSON:

```json
{
    "event", //session attached / session detatched
    "username", //user name or 'anonymous (unsecure connection)',
    "sourceAddress", //session source address,
    "sourcePort", //client side port
    "upgradeUrl",// primus upgrade url for establishing the connection socket
    "happnVersion", // for new clients, package version
    "happnProtocolVersion" // happn_4, happn (old connections)
  }
```

This can be switched off by updating the session service config:
```javascript
const Happn = require('happn-3');
let myService = await Happn.service.create({
  name: 'TEST-NAME',
  secure: true,
  services: {
    session: {
      config: {
        disableSessionEventLogging:true
      }
    }
  }
});
```

SECURITY SERVER
---------------

*happn server instances can be secured with user and group authentication and authorisation, a default user and group called _ADMIN is created per happn instance, the admin password is 'happn' but is configurable (MAKE SURE PRODUCTION INSTANCES DO NOT RUN OFF THE DEFAULT PASSWORD)*

```javascript

var happn = require('happn-3');
var happnInstance; //this will be your server instance

happn.service.create({secure:true, adminUser:{password:'testPWD'}},
function (e, instance) {

  if (e)
    return callback(e);

  happnInstance = instance; //here it is, your server instance

});


```

*at the moment, adding users, groups and permissions can only be done by directly accessing the security service, to see how this is done - please look at the [functional test for security](https://github.com/happner/happn-3/blob/master/test/integration/security/access_sanity.js)*

SECURITY CLIENT
----------------

*the client needs to be instantiated with user credentials and with the secure option set to true to connect to a secure server*

```javascript

//logging in with the _ADMIN user

var happn = require('happn-3');
happn.client.create({username:'_ADMIN', password:'testPWD', secure:true},function(e, instance) {


```

SECURITY USERS AND GROUPS
-------------------------

*to modify users and groups, a direct code based connection to the happn-3 security service is required, thus users and groups should not be modified in any way over the wire*

### add a group

```javascript

var happn = require('happn-3')
var happnInstance; //this will be your server instance

happn.service.create({secure:true, adminUser:{password:'testPWD'}},
function (e, myHappn3Instance) {

  var myGroup = {
    name:'TEST',
    permissions:{
      '/test/path/*':{actions:['get', 'set']}, //allow only gets and sets to this path
      '/test/allow/all':{actions:['*']} //allow all actions to this path
    },
    custom_data:{//any custom data you want
      test:'data'
    }
  };

  //NB! permissions are stored separately to the group, so when upserting the group and it allready exists
  //with other permissions the current upserts permissions are merged with the existing ones, down to action level

  myHappn3Instance.services.security.groups.upsertGroup(myGroup)
  .then(function(upserted){
    //group added
  })

});
```

### list groups

```javascript

var happn = require('happn-3')
var happnInstance; //this will be your server instance

happn.service.create({secure:true, adminUser:{password:'testPWD'}},
function (e, myHappn3Instance) {

  var myGroup = {
    name:'TEST',
    permissions:{
      '/test/path/*':{actions:['get', 'set']}, //allow only gets and sets to this path
      '/test/allow/all':{actions:['*']} //allow all actions to this path
    },
    custom_data:{//any custom data you want
      test:'data'
    }
  };

  //NB! permissions are stored separately to the group, so when upserting the group and it allready exists
  //with other permissions the current upserts permissions are merged with the existing ones, down to action level

  myHappn3Instance.services.security.groups.upsertGroup(myGroup)
  .then(function(upserted){
    //group added
    return myHappn3Instance.services.security.groups.listGroups('TES*', {
      criteria:{
        name:{$eq:'TEST'}
      },
      /* optional
      skip:2,
      limit:5,
      count:true //will only return the groups count
      */
    });
  })
  .then(function(group){
    //group just added would be returned
  });
});
```

#### if we are using mongodb, we are able to specify collation for listing users see the [mongo tests](https://github.com/happner/happn-3/blob/master/test/integration/security/groups_users_permissions_sanity-mongo.js).

#### NB! permissions are separate to the group, so when upserting the group and it already exists with other permissions the current upserts permissions are merged with the existing ones, down to action level

### add a user

```javascript

var happn = require('happn-3')
var happnInstance; //this will be your server instance

happn.service.create({secure:true, adminUser:{password:'testPWD'}},
function (e, myHappn3Instance) {

  var myUser = {
        username: 'TEST',
        password: 'TEST PWD',
        custom_data: {
          something: 'usefull'
        }
      };

  myHappn3Instance.services.security.users.upsertUser(myUser)
  .then(function(upserted){
    //user added, with no permissions yet - permissions must be assigned to the user by linking the user to a group
  })

});
```

### link a fetched user to a fetched group
*demonstrates getUser, getGroup and linkGroup*
```javascript

var happn = require('happn-3')
var happnInstance; //this will be your server instance

happn.service.create({secure:true, adminUser:{password:'testPWD'}},
function (e, myHappn3Instance) {

  var myUser, myGroup;

  myHappn3Instance.services.security.users.getUser('TEST')
  .then(function(user){
    myUser = user;
    return myHappn3Instance.services.security.groups.getGroup('TEST');
  })
  .then(function(group){
    myGroup = group;
    return myHappn3Instance.services.security.groups.linkGroup(myGroup, myUser);
  })
  .then(function(){
    //your TEST user now has the permissions assigned by your TEST group
  });

});


```

### list users
*user can be listed by group name (exact match) or by a username (partial match with wildcard - with optional additional criteria)*
```javascript

var happn = require('happn-3')
var happnInstance; //this will be your server instance

happn.service.create({secure:true, adminUser:{password:'testPWD'}},
function (e, myHappn3Instance) {

  //by username, with more specific criteria (mongo style)
  myHappn3Instance.services.security.users.listUsers('TEST*', {
    criteria:{username:{$eq:'TESTUSER1'}},
    /* optional
    skip:2,
    limit:5,
    count:true //will only return the users count
    */
  })
  .then(function(users){

    //returns:
    // [
    //   {username:'test1', custom_data:{test:1}},
    //   {username:'test2', custom_data:{test:1}},
    //   {username:'test3', custom_data:{test:1}}
    // ]

    //by group name, note optional criteria
    return myHappn3Instance.services.security.users.listUsersByGroup('TEST', {criteria:{custom_data:1}})
  })
  .then(function(users){

    //returns:
    // [
    //   {username:'test1', custom_data:{test:1}}
    // ]

    //much faster - just get the usernames by the group name
    return myHappn3Instance.services.security.users.listUserNamesByGroup('TEST');
  })
  .then(function(usernames){

    //returns:
    // [
    //   'test1'
    // ]

  });
});
```

### upsert a permission

*permissions can be merged by saving a group, or permissions can be added to a group piecemeal in the following way:*

```javascript

var happn = require('happn-3')
var happnInstance; //this will be your server instance

happn.service.create({secure:true, adminUser:{password:'testPWD'}},
  function (e, myHappn3Instance) {

    myHappn3Instance.services.security.groups.upsertPermission('TEST'/* group name*/, '/test/path/*' /* permission path */, 'on' /* action */, true /* allow (default) - if false the permission is removed */)
     .then(function () {

        //users belonging to the TEST group can now do "set", "get" AND "on" operations as opposed to only set and get (check above addGroup example to double check the pre-existing permissions)

     });
  });

```


### remove a permission

*permissions can be removed piecemeal as follows:*

```javascript

var happn = require('happn-3')
var happnInstance; //this will be your server instance

happn.service.create({secure:true, adminUser:{password:'testPWD'}},
function (e, myHappn3Instance) {

  myHappn3Instance.services.security.groups.removePermission('TEST'/* group name*/, '/test/path/*' /* permission path */, 'on' /* action */)
    .then(function () {

      //users belonging to the TEST group can now only do "set" and "get" operations, the right to do "on" has been revoked

    })
    .catch(done);
});

```

### remove a permission by upserting a group

* a group can be upserted with a set of permissions which are merged into the permissions tree, permissions that have "prohibit" actions are removed *

```javascript

var happn = require('happn-3')
var happnInstance; //this will be your server instance

happn.service.create({secure:true, adminUser:{password:'testPWD'}},
function (e, myHappn3Instance) {

  var myGroup = {
    name:'TEST',
    permissions:{
      '/test/path/*':{actions:['get', 'set']}, //allow only gets and sets to this path
      '/test/allow/all':{actions:['*']} //allow all actions to this path
      '/test/do/not/subscribe':{prohibit:['on']} //prohibit "on" requests to this path
    },
    custom_data:{//any custom data you want
      test:'data'
    }
  };

  myHappn3Instance.services.security.groups.upsertGroup(myGroup)
  .then(function(upserted){
    //group updated, "on" permissions to "/test/do/not/subscribe" have been deleted if they existed previously
  });
 });

```

ANONYMOUS USER
--------------
*The anonymous user can be enabled using the following configuration:*

```javascript
var happn = require('happn-3')
var happnInstance = await happn.service.create({
  secure: true,
  services: {
    security: {
      config: {
        allowAnonymousAccess: true //allow creation of anonymous user
      }
    }
  }
});

const anonymousClient = await happn.client.create({
        username: '_ANONYMOUS'
      });
```
- the anonymous user can log in without a password, the username must just be _ANONYMOUS
- the anonymous user can be given permissions to allow for actions in the system that dont require authentication

USER PERMISSIONS
----------------
*It is not necessary to use groups as the containers for permissions - permissions can also be added directly to users:*

```javascript
const myUser = {
  username: 'test_username',
  password: 'test_pwd',
  permissions: {}
};
myUser.permissions['/test/path/*'] = {
  actions: ['on', 'set']
};

await myHappn3Instance.services.security.users.upsertUser(testUser2, {});

//this user specifically can set and listen on /test/path/*

//you can now remove the 'on' permission:
await myHappn3Instance.services.security.users.removePermission(
  addedTestuser2.username,
  '/test/path/*',
  'on'
)

//you can now remove the 'set' permission:
await myHappn3Instance.services.security.users.removePermission(
  addedTestuser2.username,
  '/test/path/*',
  'set'
)

//you can now remove the 'all' permissions:
await myHappn3Instance.services.security.users.removePermission(
  addedTestuser2.username,
  '/test/path/*'
)

//you can re-add a permission
await myHappn3Instance.services.security.users.upsertPermission(
  addedTestuser2.username,
  '/test/path/*',
  'set'
)

//you can list permissions for a user
const permissions = await myHappn3Instance.services.security.users.listPermissions(
  addedTestuser2.username
)

//list looks like this:
[
  { action: 'set', authorized: true, path: '/test/path/*' }
]
```
NESTED PERMISSIONS FOR GET AND SET
--------------------
*by default, nested permissions are not switched on, hence a call to get or listen on 'test/path/\*\*' will be unauthroized unless you explicitly have permissions on 'test/path/\*'* 

### Switching on nested permissions:
In the happn config, add an 'allowNestedPermissions' flag, set to true:

```javascript
const Happn = require('happn-3');
let myService = await Happn.service.create({
  name: 'TEST-NAME',
  secure: true,
  allowNestedPermissions: true,
  services: {
    ...
  }
});
```
### Nested permissions behaviour:
If you attempt to get or listen on a path ending in '/\*\*', your permissions on that path, and its subpaths, will be evaluated, and you will get, or listen on, all subpaths which you have access to, and only those subpaths. Note that if you do not have permissions on any subpaths, you will still get an 'unauthorized' response.
In the case of events, if you have subscribed on a nested path (ending in '/**'), your subscriptions will change if your permissions change on subpaths of that path.
### Nested listener behaviour example: 
```javascript
  var myGroup = {
    name:'TEST',
    permissions:{
      '/test/path/1':{actions:['get', 'on']}, 
      '/test/path/2/3':{actions:['get', 'on']}, 
      '/test/path/4/5/6':{actions:['get', 'on']}
    }
  };
```
A user who is a member of 'myGroup' and subscribes on 'test/path/\*\*' will get events on exactly '/test/path/1', '/test/path/2/3' and  '/test/path/4/5/6', and they will fire the handler for 'test/path/\*\*'
If the group subsequently loses permissions on 'test/path/1', events on that path will no longer fire the handler, and similarly if the group gains permissions on 'test/path/xyz', events on that path will fire the handler.



VOLATILE PERMISSIONS
--------------------

*by default, permissions are persisted via the default data provider, this is typically to a file (when using nedb) - or to a mongo database. In situations where you do not want to persist permissions between restarts, you can by adjusting the persistPermissions security config setting to false:*

```javascript
const Happn = require('happn-3');
let myService = await Happn.service.create({
  name: 'TEST-NAME',
  secure: true,
  services: {
    security: {
      config: {
        persistPermissions:false
      }
    },
    data: {
      config: {
        filename: filename
      }
    }
  }
});
```

*NB: *

SECURITY PROFILES
-----------------

*profiles can be configured to fit different session types, profiles are ordered sets of rules that match incoming sessions with specific policies, the first matching rule in the set is selected when a session is profiled, so the order they are configured in the array is important*

```javascript

//there are 2 default profiles that exist in secure systems - here is an example configuration
//showing how profiles can be configured for a service:

 var serviceConfig = {
    services:{
      security: {
        config: {
          sessionTokenSecret:"TESTTOKENSECRET",
          keyPair: {
            privateKey: 'Kd9FQzddR7G6S9nJ/BK8vLF83AzOphW2lqDOQ/LjU4M=',
            publicKey: 'AlHCtJlFthb359xOxR5kiBLJpfoC2ZLPLWYHN3+hdzf2'
          },
          profiles:[ //profiles are in an array, in descending order of priority, so if you fit more than one profile, the top profile is chosen
            {
              name:"web-session",
              session:{
                $and:[{
                  user:{username:{$eq:'WEB_SESSION'}},
                  type:{$eq:0}
                }]
              },
              policy:{
                ttl: "4 seconds",//4 seconds = 4000ms, 4 days = 1000 * 60 * 60 * 24 * 4, allow for hours/minutes
                inactivity_threshold:2000//this is costly, as we need to store state on the server side
              }
            }, {
              name:"rest-device",
              session:{
                $and:[{ //filter by the security properties of the session - check if this session user belongs to a specific group
                user:{groups:{
                  "REST_DEVICES" : { $exists: true }
                }},
                type:{$eq:0} //token stateless
              }]},
              policy: {
                ttl: 2000//stale after 2 seconds
              }
            },{
              name:"trusted-device",
              session:{
                $and:[{ //filter by the security properties of the session, so user, groups and permissions
                user:{groups:{
                  "TRUSTED_DEVICES" : { $exists: true }
                }},
                type:{$eq:1} //stateful connected device
              }]},
              policy: {
                ttl: 2000,//stale after 2 seconds
                permissions:{//permissions that the holder of this token is limited, regardless of the underlying user
                  '/TRUSTED_DEVICES/*':{actions: ['*']}
                }
              }
            },{
              name:"specific-device",
              session:{$and:[{ //instance based mapping, so what kind of session is this?
                type:{$in:[0,1]}, //any type of session
                ip_address:{$eq:'127.0.0.1'}
              }]},
              policy: {
                ttl: Infinity,//this device has this access no matter what
                inactivity_threshold:Infinity,
                permissions:{//this device has read-only access to a specific item
                  '/SPECIFIC_DEVICE/*':{actions: ['get','on']}
                }
              }
            },
            {
              name:"non-reusable",
              session:{$and:[{ //instance based mapping, so what kind of session is this?
                user:{groups:{
                  "LIMITED_REUSE" : { $exists: true }
                }},
                type:{$in:[0,1]} //stateless or stateful
              }]},
              policy: {
                usage_limit:2//you can only use this session call twice
              }
            }, {
              name:"default-stateful",// this is the default underlying profile for stateful sessions
              session:{
                $and:[{type:{$eq:1}}]
              },
              policy: {
                ttl: Infinity,
                inactivity_threshold:Infinity
              }
            }, {
              name:"default-stateless",// this is the default underlying profile for ws sessions
              session:{
                $and:[{type:{$eq:0}}]
              },
              policy: {
                ttl: 60000 * 10,//session goes stale after 10 minutes
                inactivity_threshold:Infinity
              }
            }, {
              name:"ip address whitelist",// this ensures the _ADMIN user can only login from a whitelisted set of IP addresses (in this case locally)
              session:{
                $and:[{
                  user:{username:{$eq:'WEB_SESSION'}}
                }]
              },
              policy: {
                sourceIPWhitelist: [
                  '127.0.0.1', 
                  '::ffff:127.0.0.1' //NOTE: if proxied be sure to also allow for IPV6 prefixed addresses
                ]
              }
            }
          ]
        }
      }
    }
  };

```

*the test that clearly demonstrates profiles can be found [here](https://github.com/happner/happn-3/blob/master/test/integration/security/default_profiles.js)*

*the default policies look like this:*

```javascript
//stateful - so ws sessions:
{
    name:"default-stateful",// this is the default underlying profile for stateful sessions
    session:{
      $and:[{type:{$eq:1}}]
    },
    policy: {
      ttl: 0, //never goes stale
      inactivity_threshold:Infinity
    }
  }


//stateless - so token based http requests (REST)
{
    name:"default-stateless",// this is the default underlying profile for stateless sessions (REST)
    session:{
      $and:[{type:{$eq:0}}]
    },
    policy: {
      ttl: 0, //never goes stale
      inactivity_threshold:Infinity
    }
  }

```

*NB NB - if no matching profile is found for an incoming session, one of the above is selected based on whether the session is stateful or stateless, there is no ttl or inactivity timeout on both policies - this means that tokens can be reused forever (unless the user in the token is deleted) rather push to default policies to your policy list which would sit above these less secure ones, with a ttl and possibly inactivity timeout*

TEMPLATED PERMISSIONS
---------------------

*permissions can be templated to the current session using {{handlebars}} syntax, the template context is the current session and its sub-objects*

code snippets have been taken from the [this test](https://github.com/happner/happn-3/blob/master/test/integration/security/templated_permissions.js)

average session object looks like this:

```javascript
var sessionObj = {
  "id": "ec5d673b-cf28-4a0a-8a12-396f20aaaf57",//session unique id, transient
  "username": "TEST USER@blah.com1528278832638_V1DWIA5xxB",//session username
  "isToken": false,//whether the session was accessed via a token or not
  "permissionSetKey": "uJgq//rc4saoc1MSjqyB3KvJEUs=",//hash of user permissions for quick access lookup
  "user": {
    "username": "TEST USER@blah.com1528278832638_V1DWIA5xxB",
    "custom_data": {//any custom user info
      "custom_field2": "custom_field2_changed",
      "custom_field3": "custom_field3_changed",
      "custom_field4": "custom_field4_value",
      "custom_field5": "custom_field5_value",
      "custom_field_forbidden": "*"
    },
    "groups": {//groups the user belongs to
      "TEST GROUP1528278832638_V1DWIA5xxB": {
        "data": {}//any data that may have been added to the group
      }
    }
  }
}
```

we can save a group with templated permissions that give the user access to paths containing its username like so:

```javascript

var testGroup = {
  name: 'TEST GROUP' + test_id,
  custom_data: {
    customString: 'custom1',
    customNumber: 0
  }
};

testGroup.permissions = {
  '/gauges/{{user.username}}': {
    actions: ['*']
  },
  '/gauges/{{user.username}}/*': {//NB: note here how the path relates to the above session object's user.username
    actions: ['*']
  },
  '/custom/{{user.custom_data.custom_field1}}': {//NB: note here how the path relates to the above session object
    actions: ['get', 'set']
  }
};

var testUser = {
  username: 'TEST USER@blah.com' + test_id,
  password: 'TEST PWD',
  custom_data: {
    custom_field1: 'custom_field1_value'//NB: note here how the value will match the below requests
  }
};

var addedTestGroup, addedTestUser, testClient;

//assuming we have created a happn instance and assigned it to myHappnService
myHappnService.services.security.groups.upsertGroup(testGroup)
  .then(function(result){

    addedTestGroup = result;
    return myHappnService.services.security.users.upsertUser(testUser);
  })
  .then(function(result){

    addedTestUser = result;
    return myHappnService.services.security.users.linkGroup(addedTestGroup, addedTestuser);
  })
  .then(function(result){

    return myHappnService.services.session.localClient({
        username: testUser.username,
        password: 'TEST PWD'
      });
  })
  .then(function(clientInstance){
    testClient = clientInstance;
    done();
  })
  .catch(done);

```

then from the testClient access the path the template resolves to like so:

```javascript

var username = 'TEST USER@blah.com' + test_id;

testClient.on('/gauges/' + username, function(data) {
  expect(data.value).to.be(1);
  expect(data.gauge).to.be('logins');
  done();
}, function(e) {
  if (e) return done(e);
  testClient.increment('/gauges/' + username, 'logins', 1, function(e) {
    if (e) return done(e);
  });
});

```

NB: permissions that resolve to context properties with * in them are ignored lest there be the chance for unauthorized promotion of the users privileges, ie:

```javascript
//for the given user object with a custom_data property with a * fields
var exampleUser = {
  username:'test',
  password:'blah',
  custom_data:{
    test:'*'
  }
}

//this permission will not work:
var exampleGroup = {
  name:'test',
  permissions:{
    'users/{{user.custom_data.test}}/gauges/*':{actions:['on', 'set']}
  }
}

//because the template would resolve to users/*/gauges/*, which may leak other users data

```

WEB PATH LEVEL SECURITY
-----------------------

*the http/s server that happn uses can also have custom routes associated with it, when the service is run in secure mode - only people who belong to groups that are granted @HTTP permissions that match wildcard patterns for the request path can access resources on the paths, here is how we grant permissions to paths:*


```javascript

var happn = require('happn-3')
var happnInstance; //this will be your server instance

happn.service.create({secure:true, adminUser:{password:'testPWD'}},
function (e, instance) {

  if (e)
    return callback(e);

  	happnInstance = instance; //here it is, your server instance

  	var testGroup = {
	  name:'TEST GROUP',
	  custom_data:{
	    customString:'custom1',
	    customNumber:0
	  }
	}

	testGroup.permissions = {
		'/@HTTP/secure/route/*':{actions:['get']},//NB - we can wildcard the path
		'/@HTTP/secure/another/route/test':{actions:['put','post']}//NB - actions confirm to http verbs
	};

	happnInstance.services.security.upsertGroup(testGroup, {}, function(e, group){

		//our group has been upserted with the right permissions

		//this is how we add custom routes to the service, these routes are both available to users who belong to the 'TEST GROUP' group or the _ADMIN user (who has permissions to all routes)

		happnInstance.connect.use('/secure/route/test', function(req, res, next){

		    res.setHeader('Content-Type', 'application/json');
		    res.end(JSON.stringify({"secure":"value"}));

		});

		happnInstance.connect.use('/secure/another/route/test', function(req, res, next){

		    res.setHeader('Content-Type', 'application/json');
		    res.end(JSON.stringify({"secure":"value"}));

		});
	});
});

```

*logging in with a secure client gives us access to a token that can be used, either by embedding the token in a cookie called happn_token or a query string parameter called happn_token, if the login has happened on the browser, the happn_token is automatically set by default*


```javascript

//logging in with the _ADMIN user, who has permission to all web routes

var happn = require('happn-3');
happn.client.create({username:'_ADMIN', password:'testPWD'},function(e, instance) {

	//the token can be derived from instance.session.token now

	//here is an example of an http request using the token:

	var http = require('http');

	var options = {
		host: '127.0.0.1',
      	port:55000,
      	path:'/secure/route/test'
	}

	if (use_query_string) options.path += '?happn_token=' + instance.session.token;
  else options.headers = {'Cookie': ['happn_token=' + instance.session.token]}

  http.request(options, function(response){
  	//response.statusCode should be 200;
  }).end();
});


```

USING A BEARER TOKEN AUTHORIZATION HEADER
-----------------------------------------

*A Bearer authorization token can also be used to do http requests with, as follows: *

```javascript

var happn = require('happn-3');
happn.client.create({username:'_ADMIN', password:'testPWD'},function(e, instance) {

  var request = require('request');

  var options = {
    url: 'http://127.0.0.1:55000/my/special/middleware',
  };

  options.headers = {'Authorization': ['Bearer ' + instance.session.token]};

  request(options, function (error, response, body) {

    //response happens all should be ok if the token is correct and the account is able to access the middleware resource
  });
});

```

SECURITY OPTIONS
----------------

__disableDefaultAdminNetworkConnections__ - this config setting prevents any logins of the default _ADMIN user via the network, thus only local (intra process) _ADMIN connections are allowed:

```javascript

var happn = require('happn-3');

happn.service.create({
  secure: true,
  port:55002,
  disableDefaultAdminNetworkConnections:true //here is our switch
}, function(e, service){

  happn_client.create({
    config: {
      username: '_ADMIN',
      password: 'happn',
      port:55002
    }
  }, function (e, instance) {
    //we will have an error here
    expect(e.toString()).to.be('AccessDenied: use of _ADMIN credentials over the network is disabled');
  });
});

//only clients peeled off the local process will work:

serviceInstanceLocked.services.session.localAdminClient(function(e, adminClient){
  if (e) return done(e);
  adminClient.get('/_SYSTEM/*', function(e, items){

    expect(items.length > 0).to.be(true);//fetched system level data
  });
});

//or

serviceInstanceLocked.services.session.localClient({
  username:'_ADMIN',
  password:'happn'
}, function(e, adminClient){

  adminClient.get('/_SYSTEM/*', function(e, items){

    expect(items.length > 0).to.be(true);//fetched system level data
  });
});

```
AUTHENTICATION PROVIDER(S)
--------------------------
Happn-3 can now be configured with multiple, and/or custom authentication providers. By default, happn-3 will launch using the "happn" authentication provider, 
and work as it has always done. In order to use a different authentication provider, you must pass in either an absolute path, or an installed module name, 
in the security service config. Note that the standard happn provider is always available unless you specify the fal
Example: Happn-3 and 2 other providers, otherAuthProvider default
```javascript
const serviceConfig = {
  secure: true,
  services: {
    security: {
      config: {
        authProviders:{          
          otherAuthProvider: '/path/to/other/provider.js',
          moduleProvider: 'moduleName'       
        },
        defaultAuthProvider: 'otherAuthProvider'
    }
  }
};

var happn = require('../lib/index')
var service = happn.service;
service.create(serviceConfig, function(e, happnInst) {
  //server created with three auth providers, one at /path/to/other/provider.js, one in module 'moduleName', and the standard happn provider
});
```
 Note that the standard happn provider is always available unless you specify the flag happn: false in authProviders 

 ```javascript
const serviceConfig = {
  secure: true,
  services: {
    security: {
      config: {
        authProviders:{          
          otherAuthProvider: '/path/to/other/provider.js',          
          happn:false      
        },
        defaultAuthProvider: 'otherAuthProvider'
    }
  }
};

var happn = require('../lib/index')
var service = happn.service;
service.create(serviceConfig, function(e, happnInst) {
  //server created with only one auth provider,  at /path/to/other/provider.js, and NO  standard happn provider
});
```
In order to specify which authentication provider to use, requests should add a flag, `authType: 'auth-provider-name'`, to the credentials object used at login, where name is the providers name (as it appears as a key in config.authProviders). For example to authenticate with moduleProvider:
```
happn.client.create({username: "user", password: "pass", authType: "moduleProvider"}, ...)
\\or
happpnInstance.services.security.login( {username: "user", password: "pass", authType: "moduleProvider"}, ...)
```
Also note, that when using non default authprovider settings, the happn-3 auth provider must be included explicitly in security.config.

CREATING CUSTOM AUTH PROVIDERS (AND TEMPLATE)
---------------------------------------------
The file or module which contains the custom auth provider should be structured as a function which returns a class that extends the functions argument.
The custom auth provider should implement at least one of the functions, __providerCredsLogin and __providerTokenLogin and will have access to the __loginOK and __loginFailed methods,
as well as the other methods of the base auth provider class which can be examined at ./lib/services/security/authentication/provider-base.js
Example/template auth module:
```
module.exports = function(BaseClass) {  
  return class AuthProvider extends BaseClass {
    coonstructor(happn,config) {
      super(happn,config)
    }
    static create(happn,config) {
      return new AuthProvider(happn,config)
    }

    __providerCredsLogin(credentials, sessionId, callback) {
      // Examine credentials.username and credentials.password
      //Login OK
      if (ok)  return this.__loginOK(credentials, user, sessionId, callback) //User can be fetched from this.users.getUser();      
      if (!ok)  return this.__loginFailed(credentials.userName, 'ErrorMessage', new Error("failed"), callback )
    }

    __providerTokenLogin(credentials, previousSession, sessionId, callback) {
      // Examine credentials.username and credentials.token
      //Login OK
      if (ok)  return this.__loginOK(credentials, user, sessionId, callback) //User can be fetched from this.users.getUser();      
      if (!ok)  return this.__loginFailed(credentials.userName, 'ErrorMessage', new Error("failed"), callback )
    }
  } 
}
```

UNCONFIGURED SESSION CLEANUP
-----------------------------------------

*because we do not use client certificates to manage connections to a happn instance as part of the framework, sockets can be created that are not necessarily logged in, although they would be unable to do anything data-wise, these sockets could clog up allowed upgrade requests in a rate limited setup. The server, if secure, can be setup to disconnect sockets that have not logged in and have no user data attached to them within a specific period*

```javascript
const serviceConfig = {
  secure: true,
  services: {
    session: {
      config: {
        unconfiguredSessionCleanup: {
          interval: 5e3, //check every N milliseconds for unconfigured sockets, default is every 5 seconds
          threshold: 30e3, //sessions are cleaned up if they remain unconfigured for this period since they were created, default is 30 seconds
          verbose: false //cleanup activitiies logged, default is false
        }
      }
    }
  }
};

var happn = require('../lib/index')
var service = happn.service;
service.create(serviceConfig, function(e, happnInst) {
  //server created with unconfigured socket cleanup running
});
```

NB: unconfigured socket removal can only be set up for secure servers

HTTPS SERVER
-----------------------------

*happn can also run in https mode, the config has a section called transport*

```javascript

//cert and key defined in config

var config = {
  services: {
    transport:{
      config:{
        mode: 'https',
        cert: '-----BEGIN CERTIFICATE-----\nMIICpDCCAYwCCQDlN4Axwf2TVzANBgkqhkiG9w0BAQsFADAUMRIwEAYDVQQDEwls\nb2NhbGhvc3QwHhcNMTYwMTAzMTE1NTIyWhcNMTcwMTAyMTE1NTIyWjAUMRIwEAYD\nVQQDEwlsb2NhbGhvc3QwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQDc\nSceGloyefFtWgy8vC7o8w6BTaoXMc2jsvMOxT1pUHPX3jJn2bUOUC8wf3vTM8o4a\n0HY+w7cEZm/BuyTAV0dmS5SU43x9XlCF877jj5L6+ycZDncgyqW3WUWztYyqpQEz\nsMu76XvNEHW+jMMv2EGtze6k1zIcv4FiehVZR9doNOm+SilmmfVpmTmQk+E5z0Bl\n8CSnBECfvtkaYb4YqsV9dZXZcAm5xWdid7BUbqBh5w5XHz9L4aC9WiUEyMMUtwcm\n4lXDnlMkei4ixyz8oGSeOfpAP6Lp4mBjXaMFT6FalwCDAKh9rH2T3Eo9fUm18Dof\nFg4q7KcLPwd6mttP+dqvAgMBAAEwDQYJKoZIhvcNAQELBQADggEBABf8DZ+zv1P7\n8NnDZzuhif+4PveSfAMQrGR+4BS+0eisciif1idyjlxsPF28i82eJOBya4xotRlW\netAqSIjw8Osqxy4boQw3aa+RBtEAZR6Y/h3dvb8eI/jmFqJzmFjdGZzEMO7YlE1B\nxZIbA86dGled9kI1uuxUbWOZkXEdMgoUzM3W4M1ZkWH5WNyzIROvOGSSD73c1fAq\nkeC9MkofvTh3TO5UXFkLCaaPLiETZGI9BpF34Xm3NHS90Y7SUVdiawCVCz9wSuki\nD98bUTZYXu8dZxG6AdgAUEFnMuuwfznpdWQTUpp0k7jbsX/QTbFIjbI9lCZpP9k7\np07A5npzFVo=\n-----END CERTIFICATE-----',
        key: '-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA3EnHhpaMnnxbVoMvLwu6PMOgU2qFzHNo7LzDsU9aVBz194yZ\n9m1DlAvMH970zPKOGtB2PsO3BGZvwbskwFdHZkuUlON8fV5QhfO+44+S+vsnGQ53\nIMqlt1lFs7WMqqUBM7DLu+l7zRB1vozDL9hBrc3upNcyHL+BYnoVWUfXaDTpvkop\nZpn1aZk5kJPhOc9AZfAkpwRAn77ZGmG+GKrFfXWV2XAJucVnYnewVG6gYecOVx8/\nS+GgvVolBMjDFLcHJuJVw55TJHouIscs/KBknjn6QD+i6eJgY12jBU+hWpcAgwCo\nfax9k9xKPX1JtfA6HxYOKuynCz8HeprbT/narwIDAQABAoIBADoWFk+t6PxtbCQ+\nyTVNkVkueFsmjotfrz4ldDCP7RCa5lzVLU/mddhW2AdbYg+csc3uRA++ycaWQEfE\nUieJnCEkMtSju5LPSMpZgG8+z5Hwodmgj9cMuG/FUXTWnXXttohryP0Ozv8+pN2O\n/nTiQEdVMuUyfVtJQBO4f2KgZ/No6uuSGhYEGFRTRUgdM1E1f2yTu82HIfETAbnW\nMHpdhQORQKmHr7cE9/sr7E+BhJPSQxGZKmgi+/8tiHXAW5MoZ4K88EO9V/BnVHcL\n/1uVUJOvcyf2mEtsQ22WCeelPChoE8TH1lf0HHadqse5+eu9l3LQWb4Z96fZRK7G\nesk+WAkCgYEA/ZueKDbiyT2i9pS1VDop9BLDaxC3GWwYAEU8At/KzXAfuKdzcduj\nZuMBecS5SgU3wW/1hqBJ2lQF8ifUzQUuyh1tydSnolafurvHDqkWzgbo6EbjjFro\nAyyHHtYRxo/f1TWWs6RpNjJ3hDCc3OpghkwkZkN9v9wd4RMCW2kdA2MCgYEA3l20\nhxpSTJffbKKQTAxURW9v+YUxNQFb74892AMlCnMiCppvS0it8wt0gJwnlNPV92no\nUVLZ+gVXdo8E+kKca4GW/TDgceDPqw2EbkTF1ZCxxy/kwgPWR471ku3Zyg6xel3Z\nMU67EriKz1zJaMjm7JmSjoz3+u8PbLYIf+fpm0UCgYAnkU0GtzGA9lXjpOX5oy2C\ngB7vKGd41u2TtTmctS/eB51bYPzZCcyfs9E6H2BNVS0SyBYFkCKVpsBavK4t4p4f\nOKI1eDFDWcKIDt4KwoTlVhymiNDdyB0kyaC3Rez2DuJ8UGUX2BH2O797513B9etj\naKPRNLx836nlwOKAQpEdQwKBgQCvV7io6CqJVyDI6w9ZyEcTUaI8YbjBkUbLimo7\n0Y79xHfNYKXt+WuhQSEm4PudMcWBCTQ2HFzh+CBVzsUgCjKJ23ASSt5RLfLTcR9C\nTFyr4SMubCe4jYoEd0hSCdg4qolscmB3rxt40agzh3kSdYkSfK7CVYqdhrDlCk19\nfoQI+QKBgQD9PIEvhEnQO0R1k3EzchRo67IkWLyR4uX4hXa7IOXppde9dAwhbZqP\nUkw8tqj7Cg02hfXq+KdRn+xfh6pc708RMqqdqNqSfL2PYedAR65hDKV4rL8PVmL9\n0P4j3FT1nwa/sHW5jLuO5TcevPrlhEQ9xVbKw7I7IJivKMamukskUA==\n-----END RSA PRIVATE KEY-----'
      }
    }
  }
}

// or cert and key file paths defined in config
// IF BOTH OF THESE FILES DONT EXIST, THEY ARE AUTOMATICALLY CREATED AS SELF SIGNED

var config = {
  services:{
    transport:{
      config:{
        mode: 'https',
        certPath: __dirname + path.sep + 'b7_cert.pem',
        keyPath: __dirname + path.sep + 'b7_key.rsa'
      }
    }
  }
}

// or have the system create a cert and key for you, in the home directory of the user that started the happn process - called .happn-https-cert and .happn-https-key

var config = {
	services:{
    transport:{
      config:{
        mode: 'https'
      }
    }
  }
}

var happn = require('../lib/index')
var service = happn.service;
var happnInstance; //this will be your server instance

//create the service here - now in https mode - running over the default port 55000

service.create(config ...

```

HTTPS CLIENT
------------

*NB - the client must now be initialized with a protocol of https, and if it is the node based client and the cert and key file was self signed, the allowSelfSignedCerts option must be set to true*


```javascript

var happn = require('happn-3');

happn.client.create({protocol:'https', allowSelfSignedCerts:true},function(e, instance) {
...

```

BROWSER CLIENT AND COOKIES
--------------------------

HTTPS COOKIE, AND COOKIE NAME
-----------------------------

*On the browser, by default the the token established in a successful authentication is put into a cookie, the cookie name is by default happn_token, but is configurable in the security service config. If the httpsCookie option is switched on, the browser will store the cookie name with _https appended to it if it is connecting to the server via https, and the server will know to check incoming https requests for the correct name. This is so that the client can switch between http and https and re-login in http mode without causing a failure when it tries to save over the Secure cookie it created in a previous https session.*

```javascript
const serviceConfig = {
  secure:true,
  services: {}
};
//this is an https server
serviceConfig.services.transport = {
  config:{
    mode: 'https'
  }
}

//we append _https to Secure cookies over https, and also use a custom cookieName myCookie
serviceConfig.services.security = {
  config:{
    cookieName: 'myCookie',//default is happn_token, but now the browser will store the cookie as myCookie_https
                           //the server will know to look for myCookie_https in incoming requests
    httpsCookie: true
  }
}

var happn = require('happn');
var service = happn.service;
service.create(serviceConfig, function(e, happnInst) {
  //server created with httpsCookie switched on
});

```

LOGGING IN WITH THE COOKIE
--------------------------
*in an environment where there are multiple browser clients, and a primary client has logged in and the cookie has been written to storage, it is possible to create a client and log in with the existing cookie*

```javascript
let client = await HappnClient.create({
  port: 55003,
  protocol: 'https',
  useCookie: true, //useCookie flag means the client will log in with watever session cookie is available
});
```

COOKIE LIFECYCLE EVENTS
-----------------------
*a cookie event handler can be attached via the client options - this handler will field the following cookie lifecycle events:*
  - cookie-created: when there was no cookie and a new one has appeared (broadcasted to any client in the current window)
  - cookie-deleted: happens when there was a cookie and it has been expired by a client (broadcasted to any client in the current window)

```javascript
let client = await HappnClient.create({
      port: 55003,
      protocol: 'https',
      useCookie: true,
      cookieEventHandler: (event, cookie) => {
        if (event === 'cookie-created') console.log(`Someone (maybe me) created a new cookie: ${cookie}`);
        if (event === 'cookie-deleted') console.log(`Someone (maybe me) deleted this cookie on disconnect: ${cookie}`);
      }
    });
```

HTTP/S KEEPALIVES
-----------------------------
*socket keepalives are set to 2 minutes by default, but this can be configured as follows:*
```javascript
const serviceConfig = {
  services: {
    transport: {
        config: {
          keepAliveTimeout:180000 //3 minutes
        }
      }
    } 
  };

var happn = require('../lib/index')
var service = happn.service;
service.create(serviceConfig, function(e, happnInst) {
  //server created with 3 minute http/s socket keepalive
});
```

WEBSOCKET COMPRESSION
---------------------
*primusOpts in the configuration can be adjusted to allow for per-message deflate compression for messages larger than 1024 bytes, clients will automatically compress messages when they reconnect*

```javascript
const serviceConfig = {
  services: {
    session: {
      config: {
        primusOpts:{
          compression: true
        }
      }
    }
  }
};

var happn = require('../lib/index')
var service = happn.service;
service.create(serviceConfig, function(e, happnInst) {
  //server created with compression switched on
});
```

PAYLOAD ENCRYPTION
------------------

*if the server is running in secure mode, it can also be configured to encrypt payloads between it and socket clients, this means that the client must include a keypair as part of its credentials on logging in, to see payload encryption in action plase go to the [following test](https://github.com/happner/happn-3/blob/master/test/integration/security/encryptedpayloads_sanity.js)*

INBOUND AND OUTBOUND LAYERS (MIDDLEWARE)
-----------------------------------------

*incoming and outgoing packets delivery can be intercepted on the server side, as demonstrated below:*

```javascript


var layerLog1 = [];
var layerLog2 = [];
var layerLog3 = [];
var layerLog4 = [];

var inboundLayers = [
  function(message, cb){
    layerLog3.push(message);
    return cb(null, message);
  },
  function(message, cb){
    layerLog4.push(message);
    return cb(null, message);
  }
];

var outboundLayers = [
  function(message, cb){
    layerLog1.push(message);
    return cb(null, message);
  },
  function(message, cb){
    layerLog2.push(message);
    return cb(null, message);
  }
];

var serviceConfig = {
  secure: true,
  services:{
    protocol:{
      config:{
        outboundLayers:outboundLayers,
        inboundLayers:inboundLayers
      }
    }
  }
};

service.create(serviceConfig,

  function (e, happnInst) {

    if (e) return callback(e);
    var serviceInstance = happnInst;

    happn_client.create(
    {
        username: '_ADMIN',
        password: 'happn'
      info:{
        from:'startup'
      }
    }, function (e, instance) {

      if (e) return callback(e);

      var clientInstance = instance;

      clientInstance.on('/did/both',  function(data){

        expect(layerLog1.length > 0).to.be(true);
        expect(layerLog2.length > 0).to.be(true);
        expect(layerLog3.length > 0).to.be(true);
        expect(layerLog4.length > 0).to.be(true);

        clientInstance.disconnect(function(){

          serviceInstance.stop({reconnect:false}, callback);
        });
      }, function(e){
        if (e) return callback(e);
        clientInstance.set('/did/both', {'test':'data'}, function(e){

          if (e) return callback(e);
        });
      });
    });
  }
);

```

CONSISTENCY (Quality of service)
--------------------------------
*set and remove operations can be done with an optional parameter called consistency, which changes the behaviour of the resulting publish, consistency values are numeric and follow:*

0 - QUEUED (spray and pray) - the publication is queued and the callback happens, when you are optimistic about the publish happening

1 - DEFERRED (asynchronous notification) - the publication is queued and the callback happens, but you are required to pass in the onPublish handler and will thus get a notification on how the publish went later

2 - TRANSACTIONAL (default) - the set callback only happens once all subscribers have been notified of the data change

3 - ACKNOWLEDGED - the publication is queued and the set/remove callback happens, each subscriber will receive the publication message and will answer with an ack message, the publication results come back with a new metric 'acknowledged'

*an optional handler in the set/remove options, called onPublished will return with a log of how the resulting publication went*

```javascript

var CONSISTENCY = {
  DEFERRED: 1, //queues the publication, then calls back
  TRANSACTIONAL: 2, //waits until all recipients have been written to, then calls back
  ACKNOWLEDGED: 3 //waits until all recipients have acknowledged they have received the message
}

clientInstance1.set('/test/path/acknowledged/1', {test: 'data'}, {

  consistency: CONSISTENCY.ACKNOWLEDGED,

  onPublished: function (e, results) {

    //results look like this:
    expect(results).to.eql(
      {
        successful: 1,
        acknowledged:1,
        failed: 0,
        skipped: 0,
        queued:1
      }
    )
  }
}, function (e) {

  //handle error here
})

```

STANDARDS COMPLIANCE
--------------------
- password hashes - pkdbf2, SHA512 (SHA1 previously or on node v0.*)
- asynchronous encryption (session secret teleportation) - ECIES (bitcore)
- synchronous encryption - AES-256
- signing and verifying - ECDSA (bitcore)

####*NB: the strict bucket is not backwards compatible with happn-1*

TESTING WITH KARMA
------------------

testing payload encryption on the browser:
gulp --gulpfile test/browser/gulp-01.js


OTHER PLACES WHERE HAPPN-3 IS USED:
----------------------------------
HAPPNER - an experimental application engine that uses happn for its nervous system, see: www.github.com/happner/happner-2 - happner is now on version 2 so relatively mature.
