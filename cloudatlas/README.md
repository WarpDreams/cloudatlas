# Cloudatlas

[![npm version](https://www.npmjs.com/package/@warpdreams/cloudatlas)](https://badge.fury.io/js/%40warpdreams%2Fcloudatlas)

## Overview

Cloudatlas is a CLI tool to produce, deploy and update AWS CloudFormation stacks.

The idea is to construct a comprehensive AWS CloudFormation stack with minimum scripting via Javascript, while shielding the user from boilerplate details and providing out-of-the-box best practises. 

## Install and Use Cloudatlas

You can find the complete source code for the example of this section at [here](https://github.com/WarpDreams/cloudatlas/tree/master/hello-stack)

### 0. Requirements

To run the Cloudatlas CLI, you need to have node V8.0 or above. 

### 1. Install Cloudatlas:

`npm install --save-dev @warpdreams/cloudatlas`

### 2. Update your `package.json` file

In your `package.json`, add section `cloudatlas`:

```json

//file package.json

{   
  "cloudatlas": {
    "source": "hello-stack-cloudatlas",
    "stacks": [
      {
        "name": "hello-stack",
        "lambdaSourceFiles": [
          "hello-lambda.js",
          "node_modules/**/*"
        ]
      }
    ],

    "bucket": {
      "region": "ap-southeast-2",
      "name": "your-s3-bucket"
    }
  }
}
  
```

It's convienient to add a shortcut to the cloudatlas cli in your package.json file, under `scripts`

```json
  "scripts": {
    "cloudatlas": "node ./node_modules/@warpdreams/cloudatlas/bin/cloudatlas.js"
  }
```


[hello-stack-cloudatlas](https://github.com/WarpDreams/cloudatlas/tree/master/hello-stack/hello-stack-cloudatlas.js) is the Cloudatlas stack assembly script you need to write (described in the below section).

`bucket` declares a utility AWS S3 bucket which you should have write access to. Cloudatlas will use this bucket to do bookkeepings. 

### 3. Write The Cloudformation Stack Script

The script is where you assemble your stack. The following code shows a simple Cloudformation stack that has a Lambda and an API Gateway component:


```javascript

//File: hello-stack-cloudatlas.js

const assert = require('assert');

const {
  Lambda,
  ApiGateway
}
  = require('@warpdreams/cloudatlas');

//The swagger JSON file for API Gateway
const swagger = require('./hello-stack-api-swagger.json');

//Stack components
let helloLambda = null;
let helloAPIGateway = null;

//
//This is the callback function to implement for Cloudatlas
//
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

The complete example including the swagger file can be found here: [hello-stack-cloudatlas](https://github.com/WarpDreams/cloudatlas/tree/master/hello-stack)

### 4. Deploying the Stack

Please make sure your AWS credential is defined as environment variables:

```bash
export AWS_REGION="ap-southeast-2"
export AWS_ACCESS_KEY_ID="YOUR_ AWS_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="YOUR_ AWS_SECRET_ACCESS_KEY"
```

Also make sure the above credential has write access to the utility S3 bucket `your-s3-bucket`.

Set the environment for the stack by doing:

```bash
export NODE_ENV=dev
```

If you added `cloudatlas` into `scripts` section of your `package.json` as shown previously, you can just do: 

```bash
npm run cloudatlas -- --verbose deploy
```

### Currently Supported AWS Components

- API Gateway
- Lambda
- Cognito User Pool
- Coginito Identity Pool connecting to User Pool
- DynamoDB
- S3

### To Use Other AWS Components

If the components you want to use are not listed above, you can always use a generic component provided by Cloudatlas instead...

TODO: explain in detail 


### Comparison to Alternative Options

#### Cloudatlas vs Writing CloudFormation JSON/YML Template File Directly
Needless to say, you need to manage every inch of details for CloudFormation.

#### Cloudatlas vs Serverless with AWS Plugins
You need to find plugins for different AWS components if you need more than the most basic usage of Lambda and API Gateway. Different plugins may not be compatible with each other and may not provide all the configuration options you need. Then you resort to writing `resources` section in `serverless.yml` which is essentially writing the CloudFormation template file. 


## A More Practical Example

It'd be benifical to look at an example more practical than "hello world". Let's consider a stack that:

- Uses AWS Cognito User Pool for user registration;
- Uses AWS Coginito Identity Pool and IAM for access control;
- Uses DynamoDB for data;
- Uses S3 for static web site hosting;
- Uses Lambda for server logic and API Gateway for endpoints;
- API Gatway access is regulated via IAM;
- DynamoDB access via Lambda is regulated via IAM;
- S3 write access via Lambda is regulated via IAM

You can check the this example [here](https://github.com/WarpDreams/cloudatlas/tree/master/example-stack)


(more examples to follow)
