#happn-3 configuration options:
*What follows is the full configuration options for a happn server and client, showing what the defaults are when the config is omitted:*

##server
```javascript
var serverConfig = {

  port: 55000, //happn-3 port
  secure: true, //false by default
  encryptPayloads: true,//false by default

  services: {

    security: {

      config: {

        sessionTokenSecret: "TESTTOKENSECRET",//how our session tokens are encrypted

        keyPair: {//ECDSA keypair
          privateKey: 'Kd9FQzddR7G6S9nJ/BK8vLF83AzOphW2lqDOQ/LjU4M=',
          publicKey: 'AlHCtJlFthb359xOxR5kiBLJpfoC2ZLPLWYHN3+hdzf2'
        },

        adminUser: {
          password: 'happn', //happn by default, console logs a warning if secure:true and no admin password specified - breaks if ENV is production
          publicKey: 'AlHCtJlFthb359xOxR5kiBLJpfoC2ZLPLWYHN3+hdzf2'
        },

        profiles: [ //profiles are in an array, in descending order of priority, so if you fit more than one profile, the top profile is chosen
          {
            name: "web-session",
            session: {//how we match this profile to a session, mongo-like filter
              $and: [{
                user: {username: {$eq: 'WEB_SESSION'}},
                type: {$eq: 0}
              }]
            },
            policy: {
              ttl: '4 seconds',
              inactivity_threshold: '2 seconds'//this is costly, as we need to store state on the server side
            }
          }
      }
    },

    data: {
      config: {
        fsync: true, //if this is true - any nedb datastore with a file configured will immediately write-sync to it's file
        autoUpdateDBVersion:false, //if your db version is 0 and the db version in package.json is 1 the db will automatically be updated
        datastores: [//you can choose where you want the data persisted depending on the key
          {
            name: 'memory',
            isDefault: true,// if a datastore with a matching pattern cannot be found - this one will be used
            patterns: [
              '/any/*'
            ]
          },
          {
            name: 'persisted',
            settings: {
               compactInterval: 5000,//compact every 5 seconds
               filename: [testfilePath],//where you want your data persisted to
            },
            patterns: [
              '/save_to_file/*'
            ]
          }
        ]
      }
    },

    transport: {
      config: {
        mode: 'https'//'http' by default,
        certPath: __dirname + '/cert.pem', // optional, defaults creates in home dir
        keyPath: __dirname + '/key.pem'
      }
    },

    connect: {
      config: {
        middleware: {
          security: {
            cookieName: 'happn_token', // default shown
            cookieDomain: '.example.com', // optional, allows for cookie domain control in browser
            exclusions: [//http paths to exclude from security checks
              '/test/excluded/specific',
              '/test/excluded/wildcard/*',
            ],
            unauthorizedResponsePath: path.join(__dirname, 'files/unauthorized.html'), // 401 unauthorized response page (not logged in - token invalid)
            forbiddenResponsePath: path.join(__dirname, 'files/forbidden.html') // 403 forbidden response page (don't have permissions - token valid)
          }
        }
      }
    },

    protocol: {
      config: {
        inboundLayers: '[inbound plugin]',
        outboundLayers: '[outbound plugin]',
        protocols: {'happn': require('happn-protocol')}//array of protocols, ie: MQTT
      }
    }
  }
}
          
```

##websockets client
```javascript

var clientConfig = {
  port:55000,
  username:'_ADMIN',
  password:'happn',
  keyPair: { //ECDSA client keypair
    privateKey: 'Kd9FQzddR7G6S9nJ/BK8vLF83AzOphW2lqDOQ/LjU4M=',
    publicKey: 'AlHCtJlFthb359xOxR5kiBLJpfoC2ZLPLWYHN3+hdzf2'
  },
  info: {"KEY": "VALUE"}//anything you want to attach to your session
  loginType:'digest'// you want to use your keypair to login
}
```
