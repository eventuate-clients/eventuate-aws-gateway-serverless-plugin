'use strict';
const expect = require('chai').expect;
const Serverless = require('serverless');
const readYaml = require('read-yaml');
const path = require('path');
const helpers = require('./lib/helpers');
const EventuateAWSGatewayPlugin = require('../src/index');
const capitalizeFirstLetter = require('../src/utils').capitalizeFirstLetter;

const serverless = new Serverless();
//CLI log function mock
serverless.cli = {
  log: console.log
};

const options = {
  region: 'us-west-1',
  stage: 'dev'
};
const service = 'lambda-test-function';
const awsAccountId = '0123456789';
const functionName = `moneyTransferEventHandler-test-${new Date().getTime()}`;
const lambdaArn = `arn:aws:lambda:${options.region}:${awsAccountId}:function:${service}-${options.stage}-${functionName}`;

const plugin = new EventuateAWSGatewayPlugin(serverless, options);

plugin.functionsArn = { [capitalizeFirstLetter(functionName)]: lambdaArn };

const eventuateConfig = {
  subscriberId: 'moneytransfergateway',
  space: 'test',
  entitiesAndEventTypes: {
    'net.chrisrichardson.eventstore.TestEntity': [
      'net.chrisrichardson.eventstore.TestEntityCreated',
    ]
  },
  gatewayDestination: {
    gatewayType: 'AWS',
    connectionString: lambdaArn,
    credentials: {
      accessKey: process.env.AWS_ACCESS_KEY_ID,
      secretKey: process.env.AWS_SECRET_ACCESS_KEY
    }
  }
};

let serverlessEventuateConfig;
const serverlessConfigFile = './lambda-test-function/serverless.yml';
before((done) => {
  readYaml(path.join(__dirname, serverlessConfigFile), (err, data) => {
    if (err) {
      return done(err);
    }

    serverlessEventuateConfig = data.functions['eventHandlerLambda'].events.pop()['eventuate'];
    console.log(serverlessEventuateConfig);
    done();
  });
});

describe('EventuateAWSGatewayPlugin', () => {

  it('registers the appropriate hook', () => {
    expect(plugin.hooks['after:deploy:deploy']).to.be.a('function');
    expect(plugin.hooks['before:remove:remove']).to.be.a('function');
    expect(plugin.hooks['after:remove:remove']).to.be.a('function');
    expect(plugin.hooks['eventuate-gateway:info:info']).to.be.a('function');
    expect(plugin.hooks['eventuate-gateway:enable:enable']).to.be.a('function');
    expect(plugin.hooks['eventuate-gateway:disable:disable']).to.be.a('function');
    expect(plugin.hooks['eventuate-gateway:delete:delete']).to.be.a('function');
  });

  describe('Using Serverless', () => {
    // let gatewayId;
    let gatewayId = 'YXJuOmF3czpsYW1iZGE6dXMtZWFzdC0xOjkwMTE3MzQ5MzcwMTpmdW5jdGlvbjpsYW1iZGEtdGVzdC1mdW5jdGlvbi1kZXYtZXZlbnRIYW5kbGVyTGFtYmRh';

    it('should deploy service and create a gateway', (done) => {
      helpers.serverlessDeployCmd()
        .then(output => {
          gatewayId = helpers.parseGatewayIdFromOutput(output);
          expect(gatewayId).to.be.ok;
          done();
        })
        .catch(done);
    });

    it('should load gateway by ID', (done) => {

      expect(gatewayId).to.be.ok;

      plugin.getEventuateGatewayById(gatewayId, eventuateConfig.space)
        .then(result => {
          console.log('result:', result);
          helpers.expectGetGatewayResult(result);
          done();
        })
        .catch(done)
    });

    it('should fetch gateway configuration by ID', done => {

      helpers.eventuateGatewayInfoCmd(gatewayId)
        .then(result => {
          // helpers.expectGetGatewayResult(result);
          console.log('result:', result);
          const parsedGatewayId = helpers.parseGatewayIdFromOutput(result);
          expect(parsedGatewayId).to.equal(gatewayId);
          done();
        })
        .catch(done);
    });

    it('should disable gateway', done => {
      helpers.eventuateGatewayDisableCmd(gatewayId)
        .then(result => {
          console.log('result:', result);
          const parsedGatewayId = helpers.parseGatewayIdFromOutput(result);
          expect(parsedGatewayId).to.equal(gatewayId);
          done();
        })
        .catch(done);
    });

    it('should enable gateway', done => {
      helpers.eventuateGatewayEnableCmd(gatewayId)
        .then(result => {
          console.log('result:', result);
          const parsedGatewayId = helpers.parseGatewayIdFromOutput(result);
          expect(parsedGatewayId).to.equal(gatewayId);
          done();
        })
        .catch(done);
    });

    it('should delete gateway', done => {

      plugin.onEventuateGatewayDelete()
        .then(result => {
          console.log('result:', result);
          done();
        })
        .catch(done);
    });

    it('should remove', (done) => {
      helpers.serverlessRemoveCmd()
        .then(() => {
          done();
        })
        .catch(done);
    });

    it('should try to get removed gateway by ID and receive 404', (done) => {

      expect(gatewayId).to.be.ok;

      plugin.getEventuateGatewayById(gatewayId, eventuateConfig.space)
        .then(result => {
          console.log('result:', result);
          expect(result).to.equal(false);
          done();
        })
        .catch(done);
    });
  });
});