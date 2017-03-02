[![npm](https://img.shields.io/npm/v/happn-3.svg)](https://www.npmjs.com/package/happn-3) [![Build Status](https://travis-ci.org/happner/happn-3.svg?branch=master)](https://travis-ci.org/happner/happn-3) [![Coverage Status](https://coveralls.io/repos/happner/happn-3/badge.svg?branch=master&service=github)](https://coveralls.io/github/happner/happn-3?branch=master) [![David](https://img.shields.io/david/happner/happn-3.svg)](https://img.shields.io/david/happner/happn-3.svg)

<img src="https://raw.githubusercontent.com/happner/happner-website/master/images/HAPPN%20Logo%20B.png" width="300"></img>

VERSION 3
---------

Introduction
-------------------------

Happn is a mini database combined with pub/sub, the system stores json objects on paths. Paths can be queried using wildcard syntax. The happn client can run in the browser or in a node process. Happn clients can subscribe to events on paths, events happn when data is changed by a client on a path, either by a set or a remove operation.

Happn stores its data in a collection called 'happn' by default on your mongodb/nedb. The happn system is actually built to be a module, this is because the idea is that you will be able to initialize a server in your own code, and possibly attach your own plugins to various system events.

A paid for alternative to happn would be [firebase](https://www.firebase.com)

Technologies used:
Happn uses [Primus](https://github.com/primus/primus) to power websockets for its pub/sub framework and mongo or nedb depending on the mode it is running in as its data store, the API uses [connect](https://github.com/senchalabs/connect).
[nedb](https://github.com/louischatriot/nedb) as the embedded database, although we have forked it happn's purposes [here](https://github.com/happner/happn-nedb)

VERSION 2 and what has changed
------------------------------

Happn v2 can be found [here](https://github.com/happner/happn)

changes are:

(1) more modular layout, services are broken up into logical modules
(2) introduction of a queue service
(3) introduction of a protocol service, this allows for the creation of protocol plugins that take messages of the inbound and outbound queues and convert them into happn messages, essentially means we are able to use different protocols to talk to happn (ie. MQTT)
(4) simplified intra process client instantiation
(5) intra process client shares the same code as the websockets client, using a special intra-proc socket, instead of a primus spark

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
var happn = require('happn')
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

Connecting to Happn
-------------------------

Using node:

```javascript
var happn = require('happn');
var my_client_instance; //this will be your client instance

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
Intra-process client:
---------------------

```javascript

service.create(function (e, happnInst) {

    if (e) return callback(e);

    happnInstance = happnInst;
    
    happnInstance.services.session.localClient(function(e, instance){
    
      var myLocalClient = instance;
      
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

	//your result object has a special _meta property (not enumerable) that contains its actual _id, path, created and modified dates
	//so you get back {property1:'property1',property2:'property2',property3:'property3', _meta:{path:'e2e_test1/testsubscribe/data/', created:20151011893020}}


});

```

*NB - by setting the option merge:true, the data at the end of the path is not overwritten by your json, it is rather merged with the data in your json, overwriting the fields you specify in your set data, but leaving the fields that are already at that branch.*

SET SIBLING
-------------------------

*sets your data to a unique path starting with the path you passed in as a parameter, suffixed with a random short id*

```javascript
	my_client_instance.setSibling('e2e_test1/siblings', {property1:'sib_post_property1',property2:'sib_post_property2'}, function(e, results){
		//you get back {property1:'sib_post_property1',property2:'sib_post_property2', _meta:{path:'e2e_test1/siblings/yCZ678__'}}
		//you would get all siblings by querying the path e2e_test1/siblings*
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

*You can pass mongo style search parameters to look for data sets within specific key ranges*

```javascript

	var options = {
      fields: {"name": 1},
      sort: {"name": 1},
      limit: 1
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

DELETE
---------------------------

*deletes the data living at the specified branch*

```javascript
	my_client_instance.remove('/e2e_test1/testsubscribe/data/delete_me', null, function(e, result){
	if (!e)
		//your item was deleted, result.payload is an object that lists the amount of objects deleted
```

EVENTS
----------------------------

*you can listen to any SET & REMOVE events happening in your data - you can specifiy a path you want to listen on or you can listen to all SET and DELETE events using a catch-all listener*

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
```

Catch all listener:
```javascript
my_client_instance.onAll(function(//your listener event handler
						message, //the actual object data being set or removed
						meta){ //the meta data - path, modified,created _id, also tells you what type of operation happened - ie. GET, SET etc.
					},
					function(e){
						//passes in an error if you were unable to register your listener
					});

```

EVENT DATA
----------------------------

* you can grab the data you are listening for immediately either by causing the events to be emitted immediately on successful subscription or you can have the data returned as part of the subscription callback using the initialCallback and initialEmit options respectively*

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

SECURITY SERVER
---------------

*happn server instances can be secured with user and group authentication, a default user and group called _ADMIN is created per happn instance, the admin password is 'happn' but is configurable (MAKE SURE PRODUCTION INSTANCES DO NOT RUN OFF THE DEFAULT PASSWORD)*

```javascript

var happn = require('happn')
var happnInstance; //this will be your server instance

happn.service.create({secure:true, adminUser:{password:'testPWD'}},
function (e, instance) {

  if (e)
    return callback(e);

  happnInstance = instance; //here it is, your server instance

});


```

*at the moment, adding users, groups and permissions can only be done by directly accessing the security service, to see how this is done - please look at the [functional test for security](https://github.com/happner/happn-3/blob/master/test/a7_eventemitter_security_access.js)*

SECURITY CLIENT
----------------

*the client needs to be instantiated with user credentials and with the secure option set to true to connect to a secure server*

```javascript

//logging in with the _ADMIN user

var happn = require('happn');
happn.client.create({config:{username:'_ADMIN', password:'testPWD'}, secure:true},function(e, instance) {


```

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
            }
          ]
        }
      }
    }
  };

```

*the test that clearly demonstrates profiles can be found [here](https://github.com/happner/happn-3/blob/master/test/d3-security-tokens)*

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

*NB NB - if no matching profile is found for an incoming session, one of the above is selected based on whether the session is stateful or stateless, there is no ttl or inactivity timeout on both policies - this means that tokens can be reused forever (unless the user in the token is deleted) rather push to default polcies to your policy list which would sit above these less secure ones, with a ttl and possibly inactivity timeout*

WEB PATH LEVEL SECURITY
-----------------------

*the http/s server that happn uses can also have custom routes associated with it, when the service is run in secure mode - only people who belong to groups that are granted @HTTP permissions that match wildcard patterns for the request path can access resources on the paths, here is how we grant permissions to paths:*


```javascript

var happn = require('happn')
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

*logging in with a secure client gives us access to a token that can be used, either by embedding the token in a cookie called happn_token or a query string parameter called happn_token, if the login has happened on the browser, the happn_token is autmatically set by default*


```javascript

//logging in with the _ADMIN user, who has permission to all web routes

var happn = require('happn');
happn.client.create({username:'_ADMIN', password:'testPWD'},function(e, instance) {

	//the token can be derived from instance.session.token now

	//here is an example of an http request using the token:

	var http = require('http');

	var options = {
		host: '127.0.0.1',
      	port:55000,
      	path:'/secure/route/test'
	}

	if (use_query_string)
      	options.path += '?happn_token=' + instance.session.token;
    else
    	options.headers = {'Cookie': ['happn_token=' + instance.session.token]}

    http.request(options, function(response){

    	//response.statusCode should be 200;

    }).end();


});


```


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

var happn = require('happn');

happn.client.create({protocol:'https', allowSelfSignedCerts:true},function(e, instance) {
...

```

PAYLOAD ENCRYPTION
------------------

*if the server is running in secure mode, it can also be configured to encrypt payloads between it and socket clients, this means that the client must include a keypair as part of its credentials on logging in, to see payload encryption in action plase go to the [following test](https://github.com/happner/happn-3/blob/master/test/c2_websockets_embedded_sanity_encryptedpayloads.js)*

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
  0:QUEUED,
  1:DEFERRED,
  2:TRANSACTIONAL,
  3:ACKNOWLEDGED
}

clientInstance1.set('/test/path/acknowledged/1', {test: 'data'}, {

  consistency: CONSISTENCY.ACKNOWLEDGED,

  onPublished: function (e, results) {

    if (e) return reject(e);

    resolve(results);
  }
}, function (e) {

  if (e) return reject(e);
})

```

TESTING WITH KARMA
------------------

testing payload encryption on the browser:
gulp --gulpfile test/test-browser/gulp-01.js


OTHER PLACES WHERE HAPPN-3 IS USED:
----------------------------------
HAPPNER - an experimental application engine that uses happn for its nervous system, see: www.github.com/happner/happner-2 - happner is now on version 2 so relatively mature.

