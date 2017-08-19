0.0.1 2016-11-03
----------------

 - based on 2.15.4
 - alpha release 
 
0.0.2 2016-11-04
----------------

 - passing publicKey back with login response on encrypted payloads
 
0.0.3 2016-11-07
----------------
 
 - security audits and modifiedBy
  
0.0.4 2016-11-15
----------------
  
 - modified login method to be simpler, check for secure - then set auth type to digest if no password


0.1.0 2016-11-15
----------------
  
 - have layered security more, not so many conditional statements, now have distinct login, and processLogin methods
 - fixed issue where onEvent in client was not pushing the actual event data, as the data was being pushed into the scope argument for a "call"
 - fixed bug in client, with incorrcetly spelled enum STATE.diconnected
  
0.2.0 2016-11-18
----------------

 - update to default policies, both now have no ttl
 - fix the session service disconnect to allow client reconnections (reconnect true if options.reconnect == null)
  
0.3.0 2016-11-21
----------------

 - inbound and outbound layer plugins
 
0.4.0 2016-11-21
----------------

 - services other than system services can now be loaded
 
0.4.2 2016-11-22
----------------

 - proper error returned when token from deleted user is used in an attempt to access a resource

0.4.3 2016-11-22
----------------

 - upgrade from node-uuid to uuid
 
0.5.0 2016-11-22
----------------

 - fix to pubsub, allow for noCluster option
 - added mergeObjects function to utils
 
0.6.0 2016-11-23
----------------
 
 - client connect timeout
 - made getConnection more logical
 - token login reuse
  
0.6.1 2016-11-25
----------------

 - fix to test c1
 - have correct management of connection timeout
 - upgrade to primus 6
 
0.6.2 2016-11-25
----------------

 - downgrade to primus 5.2.2 (support node 0.10)
 
0.6.3 2016-11-27
----------------

 - downgrade to primus 4.0.5 (last known good version)
 
0.6.5 2016-11-27
----------------
 
 - upgrade to primus 5.2.2 (didnt make a difference)
 
0.6.6 2016-11-27
----------------
  
 - update to __getConnection

0.6.7 2016-11-28
----------------

 - safeSession and updateSession returns null if session booted
 
0.7.0 2016-12-02
----------------

 - major updates to disconnect
 - fix to browser (Primus now attached to window)
 - happner-mocha-serial tests
 
0.7.1 2016-12-02
----------------

 - disabled benchmarket on all tests except benchmarket
 
0.8.0 2016-12-03
----------------

 - changed config on client to not have config.config
 - changed client.options.config to just client.options
 
0.9.0 2016-12-06
----------------

 - server shutdown, if connections are destroyed by primus, destroy not called in transport.stop
 - made call timeout configurable in client, defaults to 30 seconds
 
0.9.1 2016-12-12
----------------

 - updated README
 - added migration plan
 
1.0.0 2016-12-13
----------------

 - protocol update!: error in message now has separate name and message, ie: {error:{name:'AccessDenied', message:'unauthorised'}} previous {error:{name:'AccessDenied: unauthorised'}} 
 - updated __createResponse to include the message of the error (was previously looping through the properties - 'message' was non-iterable)
 
1.0.1 2016-12-13
----------------
 
 - fixed issue where outbound responses where not going through layers if custom outbound layers configured

1.0.2 2016-12-13
----------------

 - fixed persisted cache does not set __sync flag, when db is empty

1.0.3 2016-12-15
----------------

 - fixed outbound system messages to include logging and custom outbound layers
 - fixed issue with tags working regardless of whether the data to tag exists or not
 
1.0.4 2016-12-15
----------------

 - allow for event_type * as well as 'all' in client 'on' option
 
1.1.0 2016-12-21
----------------

 - protocol version update 1.2.0
 - happn protocol 0.1.1 in place
 - default protocol is 1.1.0 (oldest)
 
1.1.1 2016-12-22
----------------
 
 - error serialization enhancement
 
1.2.1 2017-01-21
----------------

 - targetClients enhancement
 - removed benchmarket
 - fixed bug with subscribe on keys without preceding '/'
 - client disconnect improvements and test
 
1.3.0 2017-02-08
------------------
 - added support for passing custom _meta into `set()` options
 
1.4.0 2017-02-08
----------------
  - dataprovider functionality
  - updates to tests
  
1.4.1 2017-02-08
----------------
  - fixed issue where the options where getting attached to request options in dataprovider
  - updates to tests
  
1.4.2 2017-02-21
----------------
  - refactored this.STATE to this.state in client
  
1.5.0 2017-02-27
----------------
  - publisher/subscription services
  - consistency ACKNOWLEDGED/TRANSACTIONAL/DEFERRED
  
1.6.0 2017-03-02
----------------
  - packager, with browser client caching
  - added homedir and fs-extra dependancies
  - updates to utilities

1.6.2 2017-03-07
----------------
  - client.disconnect() supports server offline

1.7.0 2017-03-08
----------------
  - forked primus
  
1.7.1 2017-03-09
----------------
  - bucket optimisations, trie segmentation
  
1.7.2 2017-03-09
----------------
  - happn-tcp-port-used
  
1.7.4 2017-03-10
----------------
  - fixed bucket to use the wildcardMatch on subscriptions, updated f7 test

1.7.5 2017-03-13
----------------
  - fixed collisions on multiple servers in same process deleting the cached-to-disk browserclient

1.7.6 2017-03-20
----------------
  - updated forked primus to only dodge missing options on destroy if configured to do so

1.7.7 2017-03-21
----------------
  - forked primus closing process.env, switched to global

1.8.0 2017-03-21
----------------
  - strict bucket
  - redundant connections
  
1.8.1 2017-03-23
----------------
  - updated README (subscription service)
  - socketCleanup method on client
  - socket connect timeout is 30 seconds
  - socket pool reconnect interval
  - getBuckets optimisation, also bucket fix * = ALL

1.8.2 2017-03-23
----------------
  - socket pool reconnect delay, 0 by default
  - socket pool secure service tests
  
1.8.3 2017-03-27
----------------
  - moved transform and transformAll to dataProvider
  - updated documentation
  
1.8.4 2017-03-28
----------------
  - happn-util-crypto 0.2.2
  
1.8.5 2017-03-28
----------------
  - happn-util-crypto 0.2.3
  
1.8.6 2017-03-29
----------------
  - __ensureCryptoLibrary only happens if encryptPayloads || loginType === 'digest'

1.8.7 2017-03-30
----------------
  - removed var Primus from lib/client because Primus is in window in browser client

1.9.0 2017-03-31
----------------
  - account lockout
  
1.10.0 2017-04-01
----------------
  - revoke session 
  - revoke-session backward compatible with happn 2 clients

1.10.1 2017-04-04
-----------------
  - fixed issue with services, where initializeServices was a global variable

1.11.0 2017-04-11
-----------------
  - updated with happn-2 changes
  
1.11.1 2017-04-14
-----------------
  - fix: event subscriptions don't resume with subscriptionId causing server-side .subscriptionData to be empty 
  - fix: resumed event subscriptions no longer contain meta
  - fix: .off(listenerIdNumber) failing for explicit (no wildcard) paths

1.12.0 2017-04-18
-----------------
  - fix: options passed into the client with a null or empty options, but a connection default to 127.0.0.1:55000
  - enhancement: login with a token is now possible
  - test: default profiles, client options, login using tokens

1.12.1 2017-04-21
-----------------
  - fix: issue #49 strict bucket events dont work

1.12.2 2017-05-30
-----------------
  - update to forked sillyname (removed objectionable words)

1.13.0 2017-06-08
-----------------
  - updated password-salt-and-hash to happn-password-salt-and-hash
  - updates to travis node 8
  - updates to .gitignore
  
1.13.1 2017-06-15
-----------------
  - fixed issue with protocol 1.1.0, protocol field missing
  
1.13.2 2017-06-15
-----------------
  - fixed issue with protocols, protocol field "harded coded in emit and response on all plugins"

1.13.3 2017-06-19
-----------------
  - updated g6 test, timeout
  
1.13.4 2017-07-07
-----------------
  - updated parseFields in dataprovider to not append data.data

2.0.1 2017-07-18
-----------------
  - fixed delegate.runCount issue
  - updated data.
  
2.1.0 2017-07-29
----------------
  - released changes _data.

3.0.0 2017-07-30
----------------
  - updated wildcard, fixed bug where db path was stripping / unintentionally
  - wildcard fix may break existing systems that are inadvertantly making use of the bugs permissiveness

3.1.0 2017-07-18
----------------
  - Bearer token authorization header
  - moved getting session from req to security service
  - added happn_session property to req, for repeated calls of the sessionFromRequest method in one request
