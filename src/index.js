'use strict';
const util = require('util');
const request = require('request-promise-native');
const path = require('path');
const _ = require('lodash');
const Promise = require('bluebird');
require('bluebird-co');
const capitalizeFirstLetter = require('./utils').capitalizeFirstLetter;
const Logger = require('./utils').Logger;

class EventuateAWSGatewayPlugin {

  constructor(serverless, options) {
    const customOptions = this.getCustomOptions(serverless);

    this.logger = new Logger({ title: 'EventuateAWSGatewayPlugin', debug: customOptions.eventuateGatewayDebug });

    this.eventuateGatewayUrl = customOptions.eventuateGatewayUrl || 'https://api.eventuate.io/gateway';
    this.jwtToken = customOptions.eventuateGatewayJwtToken;

    this.serverless = serverless;
    this.options = options;
    this.provider = this.serverless.getProvider('aws');
    this.defaultSpace = 'default';
    this.slsCli = this.serverless.cli;


    this.hooks = {
      'after:deploy:deploy': this.onAfterDeploy.bind(this),
      'before:remove:remove': this.onBeforeRemove.bind(this),
      'after:remove:remove': this.onAfterRemove.bind(this),
      'eventuate-gateway:info:info': this.onEventuateGatewayInfo.bind(this),
      'eventuate-gateway:enable:enable': this.onEventuateGatewayEnable.bind(this),
      'eventuate-gateway:disable:disable': this.onEventuateGatewayDisable.bind(this),
      'eventuate-gateway:delete:delete': this.onEventuateGatewayDelete.bind(this)
    };

    const commonOptions = {
      gatewayId: {
        usage: 'The Eventuate AWS Gateway ID',
        required: false,
      },
      functionName: {
        usage: 'Function name',
        required: false,
        shortcut: 'f'
      },
      space: {
        usage: 'The Eventuate AWS Gateway Space',
        required: false
      }
    };

    this.commands = {
      'eventuate-gateway': {
        lifecycleEvents: [
          'resources',
          'functions'
        ],
        commands: {
          enable: {
            usage: 'Enable Eventuate AWS Gateway',
            lifecycleEvents: [
              'enable'
            ],
            options: commonOptions,
          },
          disable: {
            usage: 'Disable Eventuate AWS Gateway',
            lifecycleEvents: [
              'disable'
            ],
            options: commonOptions,
          },
          info: {
            usage: 'View Eventuate AWS Gateway configuration',
            lifecycleEvents: [
              'info'
            ],
            options: commonOptions,
          },
          delete: {
            usage: 'Delete Eventuate AWS Gateway',
            lifecycleEvents: [
              'delete'
            ],
            options: commonOptions,
          },
        }
      },
    };
  }

  onEventuateGatewayDelete() {

    Promise.coroutine(function *() {
      const args = this.getCommandArguments();

      let gatewayId = args.gatewayId;
      const space = args.space;
      const functionName = args.functionName;

      if (!gatewayId && !functionName) {
        this.slsCli.log('Provide "--gatewayId" or "--functionName" parameter');
        return;
      }

      if (functionName) {
        if (!this.functionsArn) {
          yield this.initFunctionsArn();
        }
        gatewayId = this.getGatewayIdForFunction(functionName);

        if (!gatewayId) {
          this.slsCli.log(`Can't find "gatewayId" for function "${functionName}"`);
          return;
        }
      }

      const result = yield this.removeEventuateGateway(gatewayId, space);

      this.slsCli.log(`Delete Eventuate Gateway result:\n${JSON.stringify(result)}`);
    })
      .call(this)
      .catch(this.errorHandler.bind(this));
  }

  onEventuateGatewayInfo() {

    Promise.coroutine(function *() {

      const args = this.getCommandArguments();

      let gatewayId = args.gatewayId;
      const space = args.space;
      const functionName = args.functionName;

      if (!gatewayId && !functionName) {
        this.showLambdasGatewayInfo();
        return;
      }

      if (functionName) {
        if (!this.functionsArn) {
          yield this.initFunctionsArn();
        }
        gatewayId = this.getGatewayIdForFunction(functionName);

        if (!gatewayId) {
          this.slsCli.log(`Can't find "gatewayId" for function "${functionName}"`);
          return;
        }
      }

      const gatewayConfig = yield this.getEventuateGatewayById(gatewayId, space);

      if (gatewayConfig) {
        this.printGatewayInfo(gatewayId, space, gatewayConfig);
      }
    })
      .call(this)
      .catch(this.errorHandler.bind(this));
  }

  onEventuateGatewayEnable() {

    Promise.coroutine(function *() {

      const args = this.getCommandArguments();

      let gatewayId = args.gatewayId;
      const space = args.space;
      const functionName = args.functionName;

      if (!gatewayId && !functionName) {
        this.slsCli.log('Provide "--gatewayId" or "--functionName" parameter');
        return;
      }

      if (functionName) {
        if (!this.functionsArn) {
          yield this.initFunctionsArn();
        }
        gatewayId = this.getGatewayIdForFunction(functionName);

        if (!gatewayId) {
          this.slsCli.log(`Can't find "gatewayId" for function "${functionName}"`);
          return;
        }
      }

      yield this.updateEventuateGatewayState(gatewayId, space, true);
    })
      .call(this)
      .catch(this.errorHandler.bind(this));
  }

  onEventuateGatewayDisable() {

    Promise.coroutine(function *() {

      const args = this.getCommandArguments();

      let gatewayId = args.gatewayId;
      const space = args.space;
      const functionName = args.functionName;

      if (!gatewayId && !functionName) {
        this.slsCli.log('Provide "--gatewayId" or "--functionName" parameter');
        return;
      }

      if (functionName) {
        if (!this.functionsArn) {
          yield this.initFunctionsArn();
        }
        gatewayId = this.getGatewayIdForFunction(functionName);

        if (!gatewayId) {
          this.slsCli.log(`Can't find "gatewayId" for function "${functionName}"`);
          return;
        }
      }

      yield this.updateEventuateGatewayState(gatewayId, space, false);
    })
      .call(this)
      .catch(this.errorHandler.bind(this));
  }

  showLambdasGatewayInfo() {
    Promise.coroutine(function *() {
      if (!this.functionsArn) {
        yield this.initFunctionsArn();
      }

      this.getFunctions().map((functionName) => {
          const eventuateConfig = this.getFunctionEventuateConfig(functionName);

          if (eventuateConfig) {
            const gatewayId = this.getGatewayIdForFunction(functionName);
            this.printLambdaInfo(functionName, gatewayId, eventuateConfig);
          }
      });
    })
      .call(this)
      .catch(this.errorHandler.bind(this));
  }

  updateEventuateGatewayState(gatewayId, space, state) {

    const uriPath = path.join(space, gatewayId, 'state');
    return this.eventuateGatewayRequest(uriPath, 'PUT', {enabled: state })
      .then(result => {
        this.slsCli.log(JSON.stringify(result));
        return result
      })
      .catch(this.errorHandler.bind(this));
  }

  errorHandler(error) {
    const statusCode = error.statusCode;

    switch (statusCode) {
      case 401:
        this.logger.error('401 Unauthorized');
        this.logger.error('Setup correct Eventuate credentials using evn variables: EVENTUATE_API_KEY_ID, EVENTUATE_API_KEY_SECRET');
        break;
      case 404:
        this.logger.error('Eventuate Gateway not found');
        break;
      default:
        this.logger.error(error.stack);
        break;
    }

    return Promise.reject(error);
  }

  printLambdaInfo(functionName, gatewayId, eventuateConfig) {
    this.slsCli.log(`Function: ${functionName}`);
    this.slsCli.log(`Gateway ID: ${gatewayId}`);
    this.slsCli.log(`Subscriber ID: ${eventuateConfig.subscriberId}`);
    this.slsCli.log(`Space: ${eventuateConfig.space}`);
    this.slsCli.log(`Entities and event types: ${JSON.stringify(eventuateConfig.entitiesAndEventTypes)}`);
    console.log('\n');
  }

  printGatewayInfo(gatewayId, space, gatewayConfig) {
    this.slsCli.log(`Gateway ID: ${gatewayId}`);
    this.slsCli.log(`Connection String: ${gatewayConfig.gatewayDestination.connectionString}`);
    this.slsCli.log(`Subscriber ID: ${gatewayConfig.subscriberId}`);
    this.slsCli.log(`Space: ${space}`);
    this.slsCli.log(`Entities and event types: ${JSON.stringify(gatewayConfig.entitiesAndEventTypes)}`);
    console.log('\n');
  }

  onAfterDeploy() {
    this.initFunctionsArn()
      .then(functionsArn => {

        const functionNames = this.getFunctions();

        const promises = functionNames.map((functionName) => {
          const eventuateConfig = this.getFunctionEventuateConfig(functionName);

          if (!eventuateConfig) {
            this.serverless.cli.log(`Eventuate configuration for "${functionName}" not found`);
            return;
          }

          eventuateConfig.gatewayDestination = this.makeGatewayDestinationConfigOption(functionName, eventuateConfig);

          return this.createEventuateGateway(functionName, eventuateConfig);
        });

        return Promise.all(promises);
      })
      .then((result) => {
        this.serverless.cli.log('Create Eventuate Gateway results:' + JSON.stringify(result));
      })
      .catch(this.errorHandler.bind(this));
  }

  onBeforeRemove() {
    this.logger.log('onBeforeRemove');

    this.initFunctionsArn()
      .then(functionsArn => {
        this.logger.log('functionsArn: ', functionsArn);
      })
      .catch(this.errorHandler.bind(this));
  }

  onAfterRemove() {

    const functionNames = this.getFunctions();

    const promises = functionNames.map(functionName => {
      const gatewayId = this.getGatewayIdForFunction(functionName);
      const eventuateConfig = this.getFunctionEventuateConfig(functionName);

      if (!eventuateConfig) {
        this.serverless.cli.log(`Eventuate configuration for "${functionName}" not found`);
        return;
      }

      const space = this.getSpaceFromEventuateConfig(eventuateConfig);

      return this.removeEventuateGateway(gatewayId, space);
    });

    Promise.all(promises)
      .then(result => {
        this.logger.log('result:', result);
      })
      .catch(this.errorHandler.bind(this));
  }

  makeGatewayDestinationConfigOption(functionName, eventuateConfig) {

    let credentials = {};

    if (typeof (eventuateConfig.awsCredentials) === 'object') {
      credentials = {
        accessKeyId: eventuateConfig.awsCredentials.accessKeyId,
        secretAccessKey: eventuateConfig.awsCredentials.secretAccessKey,
      }
    } else {
      credentials = this.provider.getCredentials().credentials;
    }

    if (!ensureAwsCredentials(credentials)) {
      throw new Error(`AWS Credentials not found for the function "${functionName}"`);
    }

    const options = {
      gatewayType: "AWS",
      connectionString: this.getFunctionArn(functionName),
      credentials:{
        accessKey: credentials.accessKeyId,
        secretKey: credentials.secretAccessKey
      }
    };

    if (eventuateConfig.dlq) {
      options.dlq = {
        url: eventuateConfig.dlq
      }
    }

    return options;
  }

  getFunctionArn(functionName) {
    return this.functionsArn[capitalizeFirstLetter(functionName)];
  }

  createEventuateGateway(functionName, eventuateConfig) {

    this.slsCli.log('Create eventuate gateway');

    const space = this.getSpaceFromEventuateConfig(eventuateConfig);
    const gatewayId = this.getGatewayIdForFunction(functionName);
    const uriPath = path.join(space, gatewayId);

    this.slsCli.log(`Function: ${functionName}`);
    this.slsCli.log(`Space: ${space}`);
    this.slsCli.log(`Gateway ID: ${gatewayId}`);

    return this.eventuateGatewayRequest(uriPath, 'POST', eventuateConfig)
      .then(body => {
        this.slsCli.log('Eventuate AWS Gateway created: ' + JSON.stringify(body));

        return { gatewayId: gatewayId };
      })
      .catch(err => {
        if (err.statusCode == 409) {

          this.slsCli.log(`Eventuate gateway already exists\ngatewayId: ${gatewayId}\nspace: ${space}`);

          return this.getEventuateGatewayById(gatewayId, space)
            .then((currentEventuateConfig) => {

              if (!gatewayConfigChanged(eventuateConfig, currentEventuateConfig)) {
                this.slsCli.log(`Eventuate gateway not changed\ngatewayId: ${gatewayId}\nspace: ${space}`);

                return { gatewayId: gatewayId };
              }

              this.slsCli.log(`Update eventuate gateway\ngatewayId: ${gatewayId}\nspace: ${space}`);

              return this.eventuateGatewayRequest(uriPath, 'PUT', eventuateConfig)
                .then(body => {
                  this.slsCli.log('Eventuate AWS Gateway updated: ' + JSON.stringify(body));

                  return { gatewayId: gatewayId };
                })
                .catch(err => {
                  return Promise.reject(err);
                });
            });
        }
        return Promise.reject(err);
      });
  }

  removeEventuateGateway(gatewayId, space) {

    const method = 'DELETE';

    return this.eventuateGatewayRequest(path.join(space, gatewayId), method, null)
      .then(body => {

        this.slsCli.log('Eventuate AWS Gateway removed:' + JSON.stringify(body));
        return { gatewayId: gatewayId };
      })
      .catch(err => {
        return Promise.reject(err);
      })
  }

  getEventuateGatewayById(gatewayId, space) {

    const urlPath = path.join(space, gatewayId);

    return this.eventuateGatewayRequest(urlPath, 'GET')
      .then(body => {
        this.logger.log('Eventuate AWS Gateway:' + body);

        if (typeof(body) == 'string') {
          try {
            body = JSON.parse(body);
          } catch (err) {
            return Promise.reject(err);
          }
        }

        return body;
      })
      .catch(err => {
        if (err.statusCode == 404) {
          this.slsCli.log(`Eventuate gateway not exists\ngatewayId: ${gatewayId}\nspace: ${space}`);
          return false;
        }

        return Promise.reject(err);
      })
  }

  getSpaceFromEventuateConfig(eventuateConfig) {
    return eventuateConfig.space || this.defaultSpace;
  }

  getFunctions() {
    return  Object.keys(this.serverless.service.functions)
  }

  getFunctionEventuateConfig(functionName) {

    const functions = this.serverless.service.functions;
    const functionConfig = functions[functionName];

    if (Array.isArray(functionConfig.events)) {

      const functionEventsObj = convertArrayToObject(functionConfig.events);

      if (functionEventsObj.hasOwnProperty('eventuate') && (typeof functionEventsObj['eventuate'] == 'object')) {

        return functionEventsObj['eventuate'];
      }
    }
  }

  eventuateGatewayRequest(uriPath, method, requestData) {

    const uri = (uriPath)?`${this.eventuateGatewayUrl}/${uriPath}`:this.eventuateGatewayUrl;

    const options = {
      uri,
      method,
    };

    if (!this.jwtToken) {
      const auth = `Basic ${new Buffer(`${process.env.EVENTUATE_API_KEY_ID}:${process.env.EVENTUATE_API_KEY_SECRET}`).toString('base64')}`;
      options.headers = {
        'Authorization' : auth
      };
    } else {
      options.headers = {
        'x-user-info-jwt': this.jwtToken
      };
    }

    if (requestData) {
      options.json = true;
      options.body = requestData
    }

    this.logger.log('Request options:', util.inspect(options, false, 10));
    return request(options)
  }

  getGatewayIdForFunction(functionName) {

    const functionArn = this.getFunctionArn(functionName);

    if (!functionArn) {
      this.logger.error(`No ARN for function ${functionName}, perhaps not deployed!`);
      return false;
    }

    return new Buffer(functionArn).toString('base64')
  }

  initFunctionsArn() {
    this.logger.log('initFunctionsArn');
    const stackName = { StackName: this.provider.naming.getStackName(this.options.stage) };

    // Get info from CloudFormation Outputs
    return this.provider.request('CloudFormation', 'describeStacks', stackName, this.options.stage, this.options.region)
      .then(result => {

        const functionsArn = {};

        if (result) {


          result.Stacks[0].Outputs.forEach(output => {

            const lambdaName = outputKeyToLambdaName(output.OutputKey);

            if (lambdaName) {
              functionsArn[lambdaName] = output.OutputValue.replace(/:\d+$/, '');
            }
          });
        }

        this.functionsArn = functionsArn;

        this.logger.log('this.functionsArn:', this.functionsArn);
        return functionsArn;
      })
      .catch(err => {
        return Promise.reject(err);
      });
  }

  getCommandArguments() {

    let space, gatewayId, functionName;

    if (this.options.hasOwnProperty('space')) {
      space = this.options.space.toString();
    }

    if (!space) {
      space = 'default';
    }

    if (this.options.hasOwnProperty('gatewayId')) {
      gatewayId = this.options.gatewayId.toString();
    }

    if (this.options.hasOwnProperty('functionName')) {
      functionName = this.options.functionName.toString();
    }

    return {
      gatewayId: gatewayId,
      space: space,
      functionName: functionName
    }
  }

  getCustomOptions(serverless) {
    return {
      eventuateGatewayUrl: serverless.service.custom.eventuateGatewayUrl,
      eventuateGatewayJwtToken: serverless.service.custom.eventuateGatewayJwtToken,
      eventuateGatewayDebug: serverless.service.custom.eventuateGatewayDebug
    }
  }
}


function convertArrayToObject(arrayOfObjects) {
  return arrayOfObjects.reduce((result, current ) => {
    const key = Object.keys(current)[0];
    result[key] = current[key];
    return result;
  }, {})
}

function gatewayConfigChanged(eventuateConfig, currentConfig) {

  const newConfig = {
    subscriberId: eventuateConfig.subscriberId,
    entitiesAndEventTypes: eventuateConfig.entitiesAndEventTypes,
    gatewayDestination: {
      gatewayType: eventuateConfig.gatewayDestination.gatewayType,
      connectionString: eventuateConfig.gatewayDestination.connectionString
    }
  };

  if (eventuateConfig.gatewayDestination.dlq) {
    newConfig.gatewayDestination.dlq = {
      url: eventuateConfig.gatewayDestination.dlq.url
    }
  }

  if (newConfig.subscriberId !== currentConfig.subscriberId) {
    return true;
  }

  const newGatewayDestination = newConfig.gatewayDestination;
  const currentGatewayDestination = currentConfig.gatewayDestination;

  if (newGatewayDestination.connectionString !== currentGatewayDestination.connectionString) {
    return true;
  }

  if (JSON.stringify(newGatewayDestination.dlq) !== JSON.stringify(currentGatewayDestination.dlq)) {
    return true;
  }

  const newConfigEntities = Object.keys(newConfig.entitiesAndEventTypes);
  const currentConfigEntities = Object.keys(currentConfig.entitiesAndEventTypes);

  if (newConfigEntities.length !== currentConfigEntities.length) {
    return true;
  }

  //Compare entities
  for(let entity of newConfigEntities) {

    if(!(currentConfigEntities.indexOf(entity) >= 0)) {
      return true;
    }

    //compare entity events
    let newConfigEvents = newConfig.entitiesAndEventTypes[entity];
    let currentConfigEvents = currentConfig.entitiesAndEventTypes[entity];

    const diff1 = _.difference(newConfigEvents, currentConfigEvents);
    const diff2 = _.difference(currentConfigEvents, newConfigEvents);

    if (diff1.length > 0 || diff2.length > 0) {
      return true;
    }
  }
}

function ensureAwsCredentials(credentials) {
  return credentials.accessKeyId && credentials.secretAccessKey;
}

function outputKeyToLambdaName(outputKey) {
  const regex = /LambdaFunctionQualifiedArn$/gi;

  if (outputKey.match(regex)) {
    return outputKey.replace(regex, '').replace(/Dash/g, '-')
  }
}
module.exports = EventuateAWSGatewayPlugin;
