const sinon = require('sinon');
const PermissionsManager = require('../../../lib/services/security/permissions');
const test = require('../../__fixtures/utils/test_helper').create();

// module.exports = class Permissions {
//   constructor(config, type, happn, securityService) {
//     this.__config = this.defaults(config);
//     this.securityService = securityService;
//     this.cacheService = happn.services.cache;
//     this.dataService = happn.services.data;
//     this.type = type;
//     this.cache = this.cacheService.new(`cache_security_${this.type}_permissions`, {
//       type: 'LRU',
//       cache: this.__config.__cache_permissions
//     });
//     this.__userPrefix = this.__config.__userPermissionsPrefix;
//   }

//   static create(config, type, happn, securityService) {
//     return new Permissions(config, type, happn, securityService);
//   }



//   removePermission(name, path, action) {
//     return new Promise((resolve, reject) => {
//       if (!name) return reject(new Error(`please supply a ${this.type}Name`));
//       if (!action) action = '*';
//       if (!path) path = '*';

//       return this.__removePermission(name, path, action)
//         .then(result => {
//           if (result.data.removed)
//             return this.securityService.dataChanged(
//               CONSTANTS.SECURITY_DIRECTORY_EVENTS.PERMISSION_REMOVED,
//               {
//                 ...this.__getNameObj(name),
//                 path,
//                 action
//               },
//               null,
//               () => {
//                 resolve(result);
//               }
//             );

//           resolve(result);
//         })
//         .catch(reject);
//     });
//   }

//   __removePermission(name, path, action) {
//     return new Promise((resolve, reject) => {
//       this.dataService.remove(
//         [
//           '/_SYSTEM/_SECURITY/_PERMISSIONS',
//           this.__prepareName(name),
//           action,
//           this.__escapePermissionsPath(path)
//         ].join('/'),
//         (e, result) => {
//           if (e) return reject(e);
//           resolve(result);
//         }
//       );
//     });
//   }

//   upsertPermission(name, path, action, authorized) {
//     return new Promise((resolve, reject) => {
//       return this.__upsertPermission(name, path, action, authorized)
//         .then(result => {
//           this.securityService.dataChanged(
//             CONSTANTS.SECURITY_DIRECTORY_EVENTS.PERMISSION_UPSERTED,
//             {
//               ...this.__getNameObj(name),
//               path: path,
//               action: action,
//               authorized: authorized
//             },
//             () => {
//               resolve(result);
//             }
//           );
//         })
//         .catch(reject);
//     });
//   }

//   validatePermissions(permissions) {
//     var errors = [];

//     Object.keys(permissions).forEach(function(permissionPath) {
//       var permission = permissions[permissionPath];

//       if (!permission.actions && !permission.prohibit)
//         return errors.push('missing allowed actions or prohibit rules: ' + permissionPath);

//       if (permission.actions)
//         permission.actions.forEach(function(action) {
//           if (ALLOWED_PERMISSIONS.indexOf(action) === -1)
//             return errors.push('unknown action: ' + action + ' for path: ' + permissionPath);
//         });

//       if (permission.prohibit)
//         permission.prohibit.forEach(function(action) {
//           if (ALLOWED_PERMISSIONS.indexOf(action) === -1)
//             return errors.push(
//               'unknown prohibit action: ' + action + ' for path: ' + permissionPath
//             );
//         });
//     });

//     if (errors.length === 0) return true;
//     else return errors;
//   }

//   __upsertMultiplePermissions(name, permissions) {
//     return new Promise((resolve, reject) => {
//       var promises = [];

//       if (!name) return reject(new Error(`please supply a ${this.type}Name`));

//       var permissionsValidation = this.validatePermissions(permissions);

//       if (permissionsValidation !== true)
//         return reject(new Error('group permissions invalid: ' + permissionsValidation.join(',')));
//       Object.keys(permissions).forEach(permissionPath => {
//         var permission = permissions[permissionPath];

//         if (permission.actions)
//           permission.actions.forEach(action => {
//             promises.push(this.__upsertPermission(name, permissionPath, action));
//           });

//         if (permission.prohibit)
//           permission.prohibit.forEach(action => {
//             promises.push(this.__upsertPermission(name, permissionPath, action, false));
//           });
//       });

//       Promise.all(promises)
//         .then(responses => {
//           resolve(responses);
//         })
//         .catch(reject);
//     });
//   }

//   __upsertPermission(name, path, action, authorized) {
//     return new Promise((resolve, reject) => {
//       if (!name) return reject(new Error(`please supply a ${this.type}Name`));

//       var validPath = this.__validatePermissionsPath(path);
//       if (validPath !== true) return reject(new Error(validPath));

//       if (!action) action = '*';
//       if (authorized == null) authorized = true;

//       authorized = !!authorized; //must always be stored true or false

//       this.dataService.upsert(
//         [
//           '/_SYSTEM/_SECURITY/_PERMISSIONS',
//           this.__prepareName(name),
//           action,
//           this.__escapePermissionsPath(path)
//         ].join('/'),
//         {
//           action: action,
//           authorized: authorized,
//           path: path
//         },
//         (e, result) => {
//           if (e) return reject(e);
//           resolve(result);
//         }
//       );
//     });
//   }

//   __escapePermissionsPath(path) {
//     return path.replace(/\*/g, '{{w}}');
//   }

//   __unescapePermissionsPath(path) {
//     return path.replace(/\{\{w}}/g, '*');
//   }

//   __validatePermissionsPath(path) {
//     if (!path) return 'permission path is null';

//     if (path.indexOf('{{w}}') > -1)
//       return 'invalid permission path, cannot contain special string {{w}}';

//     return true;
//   }

//   __getNameObj(name) {
//     let nameObj = {};
//     let suffix = this.type === 'user' ? 'name' : 'Name';
//     nameObj[this.type + suffix] = name;
//     return nameObj;
//   }

//   __prepareName(name) {
//     return this.type === 'user' ? this.__userPrefix + name : name;
//   }
// };

describe(test.testName(__filename, 3), function() {
  this.timeout(10000);
  var async = require('async');
  var Logger = require('happn-logger');
  const util = require('util');
  var Services = {};
  const CONSTANTS = require('../../../lib/').constants;
  const SD_EVENTS = CONSTANTS.SECURITY_DIRECTORY_EVENTS;
  Services.SecurityService = require('../../../lib/services/security/service');
  Services.CacheService = require('../../../lib/services/cache/service');
  Services.DataService = require('../../../lib/services/data/service');
  Services.CryptoService = require('../../../lib/services/crypto/service');
  Services.ProtocolService = require('../../../lib/services/protocol/service');
  Services.SubscriptionService = require('../../../lib/services/subscription/service');
  Services.PublisherService = require('../../../lib/services/publisher/service');
  Services.UtilsService = require('../../../lib/services/utils/service');
  Services.SessionService = require('../../../lib/services/session/service');
  Services.SystemService = require('../../../lib/services/system/service');
  Services.ErrorService = require('../../../lib/services/error/service');
  Services.LogService = require('../../../lib/services/log/service');

  var mockService = util.promisify(function(happn, serviceName, config, callback) {
    if (typeof config === 'function') {
      callback = config;
      if (config !== false) config = {};
    }

    try {
      var serviceClass = Services[serviceName + 'Service'];

      var serviceInstance = new serviceClass({
        logger: Logger
      });

      serviceInstance.happn = happn;

      serviceInstance.config = config;

      happn.services[serviceName.toLowerCase()] = serviceInstance;

      if (typeof serviceInstance.initialize !== 'function' || config === false) return callback();

      serviceInstance.initialize(config, callback);
    } catch (e) {
      callback(e);
    }
  });

  var mockServices = function(callback) {
    var happn = {
      services: {},
      config: {}
    };

    mockService(happn, 'Crypto')
      .then(mockService(happn, 'Utils'))
      .then(mockService(happn, 'Log'))
      .then(mockService(happn, 'Error'))
      .then(mockService(happn, 'Session', false))
      .then(mockService(happn, 'Protocol'))
      .then(mockService(happn, 'Publisher'))
      .then(mockService(happn, 'Data'))
      .then(mockService(happn, 'Cache'))
      .then(mockService(happn, 'System'))
      .then(mockService(happn, 'Security'))
      .then(mockService(happn, 'Subscription'))
      .then(function() {
        happn.services.session.initializeCaches.bind(happn.services.session)(function(e) {
          if (e) return callback(e);
          callback(null, happn);
        });
      })
      .catch(callback);
  };
  it('tests creating a permission Manager (constructor)', function(done) {
    mockServices(function(e, happn) {
      if (e) return done(e);
      let pm = new PermissionsManager(null, 'test', happn);
      done();
    });
  });

  it('tests creating a permission Manager (create method)', function(done) {
    mockServices(function(e, happn) {
      if (e) return done(e);
      let pm = PermissionsManager.create(null, 'test', happn);
      done();
    });
  });

  it('tests the defaults method', function(done) {
    mockServices(function(e, happn) {
      if (e) return done(e);
      let pm = new PermissionsManager(null, 'test', happn);
      let config = pm.defaults();
      test.expect(config).to.eql({
        __cache_permissions: {
          max: 10000,
          maxAge: 0
        },
        __userPermissionsPrefix: '_USER/'
      });
      let newConfig = pm.defaults(config);
      test.expect(config).to.eql(newConfig);
      test.expect(config).not.to.be(newConfig);

      let config1 = {
        __cache_permissions: {
          max: 20,
          maxAge: 20
        }
      };
      test.expect(pm.defaults(config1)).to.eql({ ...config, ...config1 });

      let config2 = {
        __userPermissionsPrefix: 'RANDOM'
      };
      test.expect(pm.defaults(config2)).to.eql({ ...config, ...config2 });

      let config3 = {
        __cache_permissions: {
          max: 20,
          maxAge: 20
        },
        __userPermissionsPrefix: 'RANDOM',
        some: { other: 'stuff' }
      };
      test.expect(pm.defaults(config3)).to.eql(config3);
      test.expect(pm.defaults(config3)).not.to.be(config3);
      done();
    });
  });

  it('tests the listPermissions method', function(done) {
    mockServices(async (e, happn) => {
      try {
        if (e) return done(e);
        let pm = new PermissionsManager(null, 'test', happn);
        let permissionsObj = { some: 'data' };
        pm.cache.set('name', permissionsObj);
        let perms = await pm.listPermissions('name');
        test.expect(perms).to.eql(permissionsObj);
        test.expect(perms).not.to.be(permissionsObj);

        await happn.services.data.upsert(
          '/_SYSTEM/_SECURITY/_PERMISSIONS/testName/set//some/test/path',
          { action: 'set', authorized: true, path: '/some/test/path' }
        );
        await happn.services.data.upsert(
          '/_SYSTEM/_SECURITY/_PERMISSIONS/testName/get//another/test/path',
          { action: 'get', authorized: true, path: '/another/test/path' }
        );
        perms = await pm.listPermissions('testName');
        test.expect(perms).to.eql([
          { action: 'get', authorized: true, path: '/another/test/path' },
          { action: 'set', authorized: true, path: '/some/test/path' }
        ]);
        test.expect(await pm.cache.get('testName')).to.eql(perms);
        done();
      } catch (e) {
        done(e);
      }
    });
  });

  it('tests the attachPermissions method', function(done) {
    mockServices(async (e, happn) => {
      try {
        if (e) return done(e);
        let pm = new PermissionsManager(null, 'test', happn);
        let testEntity = {name:"testName"}

        let attached = await pm.attachPermissions(testEntity);
        test.expect(attached).to.eql({...testEntity, permissions: {}})
        
        await upsertTestPermissions(happn)

        pm.cache.remove('testName')
         attached = await pm.attachPermissions(testEntity);
        test.expect(attached).to.eql({
          name: "testName",
          permissions: {
            "/another/test/path": {
              actions: [
                "get"
              ]
            },
            "/some/test/path": {
              actions: [
                "on",
                "set"
              ]
            }
          }
        })
        await removeTestPermissions(happn)
        pm.cache.remove('testName')
        attached = await pm.attachPermissions(testEntity);        
        test.expect(attached).to.eql({...testEntity, permissions: {}})
        done();
      } catch (e) {
        done(e);
      }
    });
  });

  it('tests the __removePermission method', function(done) {
    mockServices(async (e, happn) => {
      try {
        if (e) return done(e);
        let pm = new PermissionsManager(null, 'test', happn);
        let testEntity = {name:"testName"}
        await upsertTestPermissions(happn);

        await pm.__removePermission('testName','/some/test/path', 'on')
        test.expect(await  happn.services.data.get( '/_SYSTEM/_SECURITY/_PERMISSIONS/testName/on//some/test/path')).to.be.undefined
        attached = await pm.attachPermissions(testEntity);
        test.expect(attached).to.eql({
          name: "testName",
          permissions: {
            "/another/test/path": {
              actions: [
                "get"
              ]
            },
            "/some/test/path": {
              actions: [
                "set"
              ]
            }
          }
        })
        done();
      } catch (e) {
        done(e);
      }
    });
  });

  it('tests the removePermission method', function(done) {
    mockServices(async (e, happn) => {
      try {
        if (e) return done(e);
        let securityService = {} 
        securityService.dataChanged = sinon.stub();          
        securityService.dataChanged.callsArgWith(3, null)
        let pm = new PermissionsManager(null, 'test', happn, securityService);
        let testEntity = {name:"testName"}
        await upsertTestPermissions(happn);
        await pm.removePermission('testName','/some/test/path', 'on')
        test.expect(await  happn.services.data.get( '/_SYSTEM/_SECURITY/_PERMISSIONS/testName/on//some/test/path')).to.be.undefined
        attached = await pm.attachPermissions(testEntity);
        test.expect(attached).to.eql({
          name: "testName",
          permissions: {
            "/another/test/path": {
              actions: [
                "get"
              ]
            },
            "/some/test/path": {
              actions: [
                "set"
              ]
            }
          }
        })
        
        sinon.assert.calledOnce(securityService.dataChanged) 
        sinon.assert.calledWith(securityService.dataChanged, 'permission-removed',  { testName: 'testName', path: '/some/test/path', action: 'on' }, null  ) 
        done();      
      } catch (e) {
        done(e);
      }
    });
  });

  it('tests the __upsertPermission method', function(done) {
    mockServices(async (e, happn) => {
      try {
        if (e) return done(e);
        let securityService = {} 
        let pm = new PermissionsManager(null, 'test', happn, securityService);
        let testEntity = {name:"testName"}
        
        await pm.__upsertPermission('testName','/some/test/path', 'on')
        let pathData = await happn.services.data.get( '/_SYSTEM/_SECURITY/_PERMISSIONS/testName/on//some/test/path')
        test.expect(pathData.data).to.eql({ action: 'on',
        authorized: true,
        path: '/some/test/path' })
        attached = await pm.attachPermissions(testEntity);
        test.expect(attached).to.eql({
          name: "testName",
          permissions: {            
            "/some/test/path": {
              actions: [
                "on"
              ]
            }
          }
        })
        done();      
      } catch (e) {
        done(e);
      }
    });
  });

  it('tests the upsertPermission method', function(done) {
    mockServices(async (e, happn) => {
      try {
        if (e) return done(e);
        let securityService = {} 
        securityService.dataChanged = sinon.stub();          
        securityService.dataChanged.callsArgWith(2, null)
        let pm = new PermissionsManager(null, 'test', happn, securityService);
        let testEntity = {name:"testName"}

        await pm.upsertPermission('testName','/some/test/path', 'on')
        let pathData = await happn.services.data.get( '/_SYSTEM/_SECURITY/_PERMISSIONS/testName/on//some/test/path')
        test.expect(pathData.data).to.eql({ action: 'on',
        authorized: true,
        path: '/some/test/path' })
        let attached = await pm.attachPermissions(testEntity);
        test.expect(attached).to.eql({
          name: "testName",
          permissions: {            
            '/some/test/path': {
              actions: [
                "on"
              ]
            }
          }
        })
        sinon.assert.calledOnce(securityService.dataChanged) 
        sinon.assert.calledWith(securityService.dataChanged, 'permission-upserted',  { testName: 'testName', path: '/some/test/path', action: 'on',  authorized: true } ) 
        done();      
      } catch (e) {
        done(e);
      }
    });
  });

  it('tests the validatePermissions method, valid permissions', function(done) {    
    mockServices(async (e, happn) => {
      try {
        if (e) return done(e);
        let pm = new PermissionsManager(null, 'test', happn);
        test.expect(pm.validatePermissions({})).to.be(true)
        let validPermissions = {
          "/path1": {actions: ["set","get","on"]},
          "/path2": {prohibit: ["delete", "post", "options"]},
          "/path3": {actions: ["set","get","on"],prohibit: ["delete", "post", "options"]}
        }
        test.expect(pm.validatePermissions(validPermissions)).to.be(true)
        done();      
      } catch (e) {
        done(e);
      }
    });
  });

  it('tests the validatePermissions method, invalid permissions', function(done) {    
    mockServices(async (e, happn) => {
      try {
        if (e) return done(e);
        let pm = new PermissionsManager(null, 'test', happn);
        let badPermissions1 = {"/path1" : {}}
        let error1 = 'missing allowed actions or prohibit rules: /path1'
        
        let badPermissions2 = {"/path2" : {actions: ["notAnAction"]}}
        let error2 = 'unknown action: notAnAction for path: /path2'
        
        let badPermissions3 = {"/path3" : {prohibit: ["alsoNotAnAction"]}}
        let error3 = 'unknown prohibit action: alsoNotAnAction for path: /path3'
        test.expect(pm.validatePermissions(badPermissions1)).to.eql([error1])
        test.expect(pm.validatePermissions(badPermissions2)).to.eql([error2])
        test.expect(pm.validatePermissions(badPermissions3)).to.eql([error3])

        let badPermissions4 = {...badPermissions1, ...badPermissions2, ...badPermissions3} 
        test.expect(pm.validatePermissions(badPermissions4)).to.eql([error1,error2,error3])
        done();      
      } catch (e) {
        done(e);
      }
    });
  });

  it('tests the upsertMultiplePermissions method', function(done) {
    mockServices(async (e, happn) => {
      try {
        if (e) return done(e);
        let pm = new PermissionsManager(null, 'test', happn);
        let testEntity = {name:"testName"}

        let validPermissions = {
          "/path1": {actions: ["set","get","on"]},
          "/path2": {prohibit: ["delete", "post", "options"]},
          "/path3": {actions: ["set","get","on"],prohibit: ["delete", "post", "options"]}
        }
        pm.upsertMultiplePermissions("testName", validPermissions)
        let permissionList = await pm.listPermissions("testName");
        test.expect(permissionList).to.eql([
          { action: 'delete', authorized: false, path: '/path2' },
          { action: 'delete', authorized: false, path: '/path3' },
          { action: 'get', authorized: true, path: '/path1' },
          { action: 'get', authorized: true, path: '/path3' },
          { action: 'on', authorized: true, path: '/path1' },
          { action: 'on', authorized: true, path: '/path3' },
          { action: 'options', authorized: false, path: '/path2' },
          { action: 'options', authorized: false, path: '/path3' },
          { action: 'post', authorized: false, path: '/path2' },
          { action: 'post', authorized: false, path: '/path3' },
          { action: 'set', authorized: true, path: '/path1' },
          { action: 'set', authorized: true, path: '/path3' }
        ])
        done();      
      } catch (e) {
        done(e);
      }
    });
  });

  async function upsertTestPermissions(happn) {
    await happn.services.data.upsert(
      '/_SYSTEM/_SECURITY/_PERMISSIONS/testName/set//some/test/path',
      { action: 'set', authorized: true, path: '/some/test/path' }
    );
    await happn.services.data.upsert(
      '/_SYSTEM/_SECURITY/_PERMISSIONS/testName/on//some/test/path',
      { action: 'on', authorized: true, path: '/some/test/path' }
    );
    await happn.services.data.upsert(
      '/_SYSTEM/_SECURITY/_PERMISSIONS/testName/get//another/test/path',
      { action: 'get', authorized: true, path: '/another/test/path' }
    );
  }

  async function removeTestPermissions(happn) {
    await happn.services.data.remove(
      '/_SYSTEM/_SECURITY/_PERMISSIONS/testName/set//some/test/path');
    await happn.services.data.remove(
      '/_SYSTEM/_SECURITY/_PERMISSIONS/testName/on//some/test/path',
      null
    );
    await happn.services.data.remove(
      '/_SYSTEM/_SECURITY/_PERMISSIONS/testName/get//another/test/path',
      null
    );
  }
});
