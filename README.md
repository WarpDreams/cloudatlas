# Cloudatlas

## Overview

Cloudatlas is a CLI tool to produce, deploy and update AWS CloudFormation stacks.

The idea is to construct a comprehensive AWS CloudFormation stack with minimum scripting via Javascript, while shielding the user from boilerplate details and providing out-of-the-box best practises. 

## Install and Use Cloudatlas



### Differences to Alternative Options

#### Cloudatlas vs Writing CloudFormation JSON/YML Template File Directly
Needless to say, you need to manage every inch of details for CloudFormation.

#### Cloudatlas vs Serverless with AWS Plugins
You need to find plugins for different AWS components if you need more than the most basic usage of Lambda and API Gateway. Different plugins may not be compatible with each other and may not provide all the configuration options you need. Then you resort to writing `resources` section in `serverless.yml` which is essentially writing the CloudFormation template file. 

## A Quick Showcase

With Cloudatlas, you write a NodeJS script that assembles an AWS CloudFormation stack programmingly. Here is a bare minimum stack that has one Lambda and an API Gateway endpoint constructed with Cloudatlas:

```javascript

const assert = require('assert');

const {
  Lambda,
  ApiGateway
}
  = require('cloudatlas');

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

```


## Build and Deploy Hello World Stack Example

This section will guide you through the steps of building and deploying your first stack. 

### 1. Setup AWS credentials and Utility S3 Bucket

Please make sure your AWS credential is defined as environment variables.

```bash
export AWS_REGION="ap-southeast-2"
export AWS_ACCESS_KEY_ID="YOUR_ AWS_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="YOUR_ AWS_SECRET_ACCESS_KEY"
```

You also need an existing S3 bucket which Cloudatlas will use to store temporary file. 


### 2. Checkout this project and setup

```bash
git clone git@github.com:WarpDreams/cloudatlas.git cloudatlas
cd cloudatlas
npm run bootstrap
```

### 3. Deployment

```
export NODE_ENV=dev
cd hello-stack
npm run cloudatlas -- --verbose deploy
```