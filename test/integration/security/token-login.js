const helper = require('../../__fixtures/utils/test_helper').create();
const tokenTests = require('./token-login-tests');

const serviceConfig1 = {
  port: 10000,
  secure: true,
  services: {
    security: {
      config: {
        sessionTokenSecret: 'h1_test-secret',
        keyPair: {
          privateKey: 'Kd9FQzddR7G6S9nJ/BK8vLF83AzOphW2lqDOQ/LjU4M=',
          publicKey: 'AlHCtJlFthb359xOxR5kiBLJpfoC2ZLPLWYHN3+hdzf2'
        },
        profiles: [
          //profiles are in an array, in descending order of priority, so if you fit more than one profile, the top profile is chosen
          {
            name: 'token-not-allowed',
            session: {
              $and: [
                {
                  user: {
                    username: {
                      $eq: '_ADMIN'
                    }
                  },
                  info: {
                    tokenNotAllowedForLogin: {
                      $eq: true
                    }
                  }
                }
              ]
            },
            policy: {
              disallowTokenLogins: true
            }
          },
          {
            name: 'short-session',
            session: {
              $and: [
                {
                  user: {
                    username: {
                      $eq: '_ADMIN'
                    }
                  },
                  info: {
                    shortSession: {
                      $eq: true
                    }
                  }
                }
              ]
            },
            policy: {
              ttl: '2 seconds'
            }
          },
          {
            name: 'browser-session',
            session: {
              $and: [
                {
                  user: {
                    username: {
                      $eq: '_ADMIN'
                    }
                  },
                  info: {
                    _browser: {
                      $eq: true
                    }
                  }
                }
              ]
            },
            policy: {
              ttl: '7 days'
            }
          },
          {
            name: 'locked-session',
            session: {
              $and: [
                {
                  user: {
                    username: {
                      $eq: '_ADMIN'
                    }
                  },
                  info: {
                    tokenOriginLocked: {
                      $eq: true
                    }
                  }
                }
              ]
            },
            policy: {
              ttl: 0, // no ttl
              lockTokenToOrigin: true
            }
          },
          {
            name: 'node-session',
            session: {
              $and: [
                {
                  user: {
                    username: {
                      $eq: '_ADMIN'
                    }
                  },
                  _browser: false
                }
              ]
            },
            policy: {
              ttl: 0 // no ttl
            }
          }
        ]
      }
    }
  }
};

const serviceConfig2 = {
  port: 10001,
  secure: true,
  services: {
    security: {
      config: {
        sessionTokenSecret: 'h1_test-secret',
        keyPair: {
          privateKey: 'Kd9FQzddR7G6S9nJ/BK8vLF83AzOphW2lqDOQ/LjU4M=',
          publicKey: 'AlHCtJlFthb359xOxR5kiBLJpfoC2ZLPLWYHN3+hdzf2'
        },
        profiles: [
          //profiles are in an array, in descending order of priority, so if you fit more than one profile, the top profile is chosen
          {
            name: 'token-not-allowed',
            session: {
              $and: [
                {
                  user: {
                    username: {
                      $eq: '_ADMIN'
                    }
                  },
                  info: {
                    tokenNotAllowedForLogin: {
                      $eq: true
                    }
                  }
                }
              ]
            },
            policy: {
              disallowTokenLogins: true
            }
          },
          {
            name: 'short-session',
            session: {
              $and: [
                {
                  user: {
                    username: {
                      $eq: '_ADMIN'
                    }
                  },
                  info: {
                    shortSession: {
                      $eq: true
                    }
                  }
                }
              ]
            },
            policy: {
              ttl: '2 seconds'
            }
          },
          {
            name: 'browser-session',
            session: {
              $and: [
                {
                  user: {
                    username: {
                      $eq: '_ADMIN'
                    }
                  },
                  _browser: true
                }
              ]
            },
            policy: {
              ttl: '7 days'
            }
          },
          {
            name: 'locked-session',
            session: {
              $and: [
                {
                  user: {
                    username: {
                      $eq: '_ADMIN'
                    }
                  },
                  info: {
                    tokenOriginLocked: {
                      $eq: true
                    }
                  }
                }
              ]
            },
            policy: {
              ttl: 0, // no ttl
              lockTokenToOrigin: true
            }
          },
          {
            name: 'node-session',
            session: {
              $and: [
                {
                  user: {
                    username: {
                      $eq: '_ADMIN'
                    }
                  },
                  _browser: false
                }
              ]
            },
            policy: {
              ttl: 0 // no ttl
            }
          }
        ]
      }
    }
  }
};

describe(helper.testName(__filename, 3), tokenTests(serviceConfig1, serviceConfig2));
