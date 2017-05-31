'use strict';
const expect = require('chai').expect;
const spawn = require('child_process').spawn;
const path = require('path');
const slsLambdaPath = path.join(__dirname, '../lambda-test-function');
const slsCommand = '../../node_modules/.bin/serverless';

module.exports.expectGetGatewayResult = (result) => {
  expect(result).to.be.an('Object');
  expect(result).to.haveOwnProperty('subscriberId');
  expect(result).to.haveOwnProperty('entitiesAndEventTypes');
  expect(result.entitiesAndEventTypes).to.be.an('Object');
  expect(result).to.haveOwnProperty('gatewayDestination');
  expect(result.gatewayDestination).to.be.an('Object');
  expect(result.gatewayDestination).to.haveOwnProperty('gatewayType');
  expect(result.gatewayDestination).to.haveOwnProperty('connectionString');
};

module.exports.expectCommonResult = (result) => {
  expect(result).to.be.an('Object');
  expect(result).to.haveOwnProperty('gatewayId');
};

module.exports.serverlessDeploy = () => {

  return runCommand(slsCommand, [ 'deploy' ], slsLambdaPath)
};

module.exports.serverlessRemove = () => {

  return runCommand(slsCommand, [ 'remove' ], slsLambdaPath)
};

module.exports.parseGatewayIdFromOutput = (output) => {
  const regex = /{"gatewayId":".*"}/gi;
  let matches = output.match(regex);
  if (matches) {
    const obj = JSON.parse(matches[0]);
    return obj.gatewayId;
  }
};

function runCommand(command, params, path) {

  console.log(`Run command: ${command}`);
  console.log(`params: ${ params.join(' ') }`);
  console.log(`path: ${path}`);
  console.log('');

  let memo = '';

  return new Promise((resolve, reject) => {

    const proc = spawn(command, params, { cwd: path });

    proc.stdout.on('data', (data) => {
      console.log(`${data}`);
      memo += data;
    });

    proc.stderr.on('data', (data) => {
      console.log(`stderr: ${data}`);
    });

    proc.on('close', (code) => {
      console.log(`Process exited with code: ${ code }`);
      if (code === 0) {
        resolve(memo);
      } else {
        reject(code);
      }
      memo = null;
    });
  });
}
