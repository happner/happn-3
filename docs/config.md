#happn-3 configuration options:
*what follows is the full configuartion options for a happn server and client, whowing what the defaults are when the config is omitted:*

##server
```javascript
var serverConfig = {

  port:55000, //happn-3 port
  secure: true, //false by default
  encryptPayloads: true,//false by default
  
  services:{
  
    security: {
    
      config: {
      
        sessionTokenSecret:"TESTTOKENSECRET",//how our session tokens are encrypted
      
        keyPair: {//ECDSA keypair
          privateKey: 'Kd9FQzddR7G6S9nJ/BK8vLF83AzOphW2lqDOQ/LjU4M=',
          publicKey: 'AlHCtJlFthb359xOxR5kiBLJpfoC2ZLPLWYHN3+hdzf2'
        },
        
        adminUser: {
          password: 'happn', //happn by default, console logs a warning if secure:true and no admin password specified - breaks if ENV is production
          publicKey: 'AlHCtJlFthb359xOxR5kiBLJpfoC2ZLPLWYHN3+hdzf2'
        },
        
        profiles:[ //profiles are in an array, in descending order of priority, so if you fit more than one profile, the top profile is chosen
        {
          name:"web-session",
          session:{//how we match this profile to a session, mongo-like filter
            $and:[{
              user:{username:{$eq:'WEB_SESSION'}},
              type:{$eq:0}
            }]
          },
          policy:{
            ttl: '4 seconds',
            inactivity_threshold:'2 seconds'//this is costly, as we need to store state on the server side
          }
        }
      }
    },
    
    data:{
      config:{
        compactInterval: 5000,//compact every 5 seconds
        filename:filename,//where you want your data persisted to
        datastores: [//you can choose where you want the data persisted depending on the key
          {
            name: 'memory',
            isDefault: true,
            patterns: [
              '/a3_eventemitter_multiple_datasource/' + test_id + '/memorytest/*',
              '/a3_eventemitter_multiple_datasource/' + test_id + '/memorynonwildcard'
            ]
          },
          {
            name: 'persisted',
            settings: {
              filename: tempFile1
            },
            patterns: [
              '/a3_eventemitter_multiple_datasource/' + test_id + '/persistedtest/*',
              '/a3_eventemitter_multiple_datasource/' + test_id + '/persistednonwildcard'
            ]
          }
        ]
      }
    },

    transport:{
      config:{
        mode: 'https'//'http' by default
      }
    },
    
    connect:{
     config:{
       middleware:{
         security: {
           exclusions: [//http paths to exclude from security checks
             '/test/excluded/specific',
             '/test/excluded/wildcard/*',
           ]
         }
       }
     }
   },
   
   protocol:{
     config:{
       inboundLayers:'[inbound plugin]',
       outboundLayers:'[outbound plugin]',
       protocols:{'happn':require('happn-protocol')}//array of protocols, ie: MQTT
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
