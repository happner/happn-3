##services layer
*services are loaded by folder in ./lib/services by the service manager, services listed:*

cache:- 3 types, LRU (Least recently used), persist (pushes to a datastore), static (in memory) - the caches are instantiated via the service. Caches mean both something that is fetched for performance sakes, and also a place where a list of concurrency-sensitive data can exist.

connect:- important service, where incoming web requests are routed for security authorization. Also the dispatcher of the browser-side client code, which is built by the packager module.

crypto:- system cryptographic functions live here.

data:- this service holds and instantiates the data-providers.

error:- where system errors are declared and where special system errors are routed. This is the the handleSystem method - which logs the error, and calls the system services logError method.

layer:- layers are bindings to service methods, these become steps in the protocol pipeline

log:- where system logs are written to, all services log through this service.

protocol:- the protocol service builds protocol stacks or pipelines, keyed by the message action, and the stringified message options. In the protocol folder, are protocol plugins, named according to the convention happn_\[protocol version\].js
message lifecycle:
1. message arrives via the transport layer and message queue
2. appropriate protocol plugin is pulled out from the session information
3. plugin transforms message into a happn-3 message
4. protocol stack executes on the message
5. plugin success or fail method is invoked and the response is sent back to the client.

publisher:- receives a message with the recipients for a publication of a remove or set event, and will push the publication to a publication queue, if the consistency option is QUEUED or DEFERRED - then the callback and reponse happens immediately after the publication is on the publication queue. See [constants](https://github.com/happner/happn-3/blob/master/constants.jshttps://github.com/happner/happn-3/blob/master/lib/constants.js) for the meanings of the consistency settings.

queue:- system has 4 queues:
1. the inbound queue - raw incoming messages land here, the protocol service matches a plugin with the raw message, where it is transformed and pushed down the protocol stack
2. the publication queue - unpublished publications, which are essentially a lits of recipients and a single message that each recipient will receive go on to this queue, they are picked up and transformed and pushed to the outbound queue for dissemination to the relevant client subscribers.
3. the outbound queue - raw outgoing messages are pushed here, again the protocol engine finds a matching plugin and the responses/messages go back to the clients
4. the system queue - system messages, such as 'disconnect'. At the moment only one messages landing up here

security:- this service manages user and group CRUD, via the users module and refers to the checkpoint module which manages real-time authorisation. On a secure instance, the security services processAuthorize is added to the protocol pipeline.

session:- this is where sessions are managed, when a primus connection is established, a session is generated and lives here, with its attendant connection. Incoming messages are fielded here, this could be confused with the transport layer, which deal only with the creation of the primus and http server instance, 

stats:- this pulls together all the systems stats into a snapshot. 
  FUTURE:
  - possible statsProvider
  - have 2 methods for now gauge and increment 
  - stats broken down by happn instance name

subscription:- this services manages adding a subscription, pick up 'on' messages and add subscriptions to buckets. Buckets are simply optimised lists of subscribers taht are segmented by the action and possible configuration of wildcard paths.
We have 2 buckets:
1. default bucket.js - this is the slower but backward compatible bucket
2. bucket-strict.js - which uses the subscription-tree.js module, this uses the ** paradigm and requires that teh correct amount of /'s are introduced with the search string in cases where the ** is not used.
[see docs](https://github.com/happner/happn-3/blob/master/README.md#buckets-and-subscriptions-optimisation)


system:- the system service does system-level operations like coming up with a unique system name and containing the overall system health snapshot, the logError method is called by the error service and will update the HEALTH snapshot accordingly.

transport:- the setup and control of the primus instance and http(s) server. Https certs are managed here, and the system can be configured to get things ready, but defer listening.

utils:- the utils service proivides service access to utility methods, the shared.js module contains utilities that become available to the browser client via the _this.utils property.

##packager
*the happn browser client is packaged by this module, the shared utils are appended to the client by the packager.*



concerns:
- queuing, 4 queues - is it possible that one very busy one could hog the event loop.
- systemQueue - only 1 message on this queue, 'disconnect'
- stats - currently very snapshot style stats method on services, ability to push stats via statsd etc.
