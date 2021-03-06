const assert = require('assert');
const log = require('winston');

const {
  Lambda,
  ApiGateway
}
  = require('@warpdreams/cloudatlas');

//The swagger JSON file for API Gateway
const swagger = require('./hello-stack-api-swagger.json');

//persist stack components
let helloLambda = null;
let helloAPIGateway = null;

const wireStack = (name, stack) => {
  helloLambda = stack.createLambda('hello');
  helloLambda.setHandlerPath('hello-lambda.handler');
  helloAPIGateway = stack.createApiGateway('hello');
  helloAPIGateway.setSwagger(swagger);

  //Connect API Gateway to Lambda.
  //Specify the method via which the Lambda is invoked. 
  //Also provides automatic HTTP status code mapping via text pattern
  helloAPIGateway.attachLambda(helloLambda, '/hello', ['GET'], {
    '.*Invalid parameters.*': {
      statusCode: 400
    }
  });

  helloAPIGateway.setDeploymentStages(['alpha', 'beta']);
}

exports.wireStack = wireStack;

const afterStackDeploy = async (name, stack, error) => {
  if (!error) {
    log.info('This is callback from hello-stack after stack is deployed successfully for stack name: ' + stack.stackName);
  }
}

exports.afterStackDeploy = afterStackDeploy;