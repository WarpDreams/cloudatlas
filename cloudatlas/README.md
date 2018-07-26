# Cloudatlas

[![npm version](https://badge.fury.io/js/%40warpdreams%2Fcloudatlas.svg)](https://www.npmjs.com/package/@warpdreams/cloudatlas)

## Overview

Cloudatlas is a CLI tool to produce, deploy and update AWS CloudFormation stacks.

The idea is to construct a comprehensive AWS CloudFormation stack with minimum scripting via Javascript, while shielding the user from boilerplate details and providing out-of-the-box best practises. 

## Install and Use Cloudatlas

You can find the complete source code for the example of this section at [here](https://github.com/WarpDreams/cloudatlas/tree/master/hello-stack)

### 1. Requirements

To run the Cloudatlas CLI, you need to have node V8.0 or above. 

### 2. Install Cloudatlas:

`npm install --save-dev @warpdreams/cloudatlas`

### 3. Update your `package.json` file

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

### 4. Writing The Cloudformation Stack Script

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

### 5. Setting the Environment Variables

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

Cloudatlas will deploy different copies of the stack depends on the value of `NODE_ENV`, thus it is recommended to always set `NODE_ENV` before deployment.


### 6. Deploying the Stack

If you added `cloudatlas` into `scripts` section of your `package.json` as shown previously, you can just do: 

```bash
npm run cloudatlas -- deploy
```

The `deploy` command will do all the followings in one go:

- Zip up the source codes for Lambda (if any) and save files locally at `.cloudatlas` of your project
- Upload the package to the utility S3 bucket
- Deploy the stack to Cloudformation

If you'd like to double check things before deployment, you can also run the following

```bash
# Zips up source codes and write CloudFormation template file to .cloudatlas
npm run cloudatlas -- package

# Upload the package to S3
npm run cloudatlas -- upload
```

For more debugging information, add flag `-v` or `--verbose`

## Currently Supported AWS Components

- API Gateway
- Lambda
- Cognito User Pool
- Coginito Identity Pool connecting to User Pool
- DynamoDB
- S3
- GenericComponent for all other AWS components not listed above

Import them with the following clause: 

```javascript
const {
  CloudFormation,
  Lambda,
  Policy,
  ApiGateway,
  DynamoDbTable,
  CognitoUserPool,
  CognitoUserPoolAppClient,
  CognitoUserGroup,
  S3,
  GenericComponent
} = require('@warpdreams/cloudatlas');

```

### To Use Other AWS Components

If the component you want to use is not listed above, you can always use a generic component provided by Cloudatlas:

```javascript
const {
  GenericComponent
} = require('@warpdreams/cloudatlas');
```

Here is some sample code to write a Lambda with `GenericComponent` (Lambda is directly supported by `Lambda` class, but we pretend it isn't for the demoing purpose)

```javascript

const stack = new CloudFormation('TheStack');
const lambda = stack.createGenericComponent('Lambda');

//This is the "Type" field of CloudFormation
lambda.type = "AWS::Lambda::Function";

const theProperties = {
  "Code": {
    "S3Bucket": "TestBucket",
    "S3Key": "Test.zip"
  },
  "Handler": "src/hander.js",
  "Runtime": "nodejs8.10",
  "Timeout": 10,
  "MemorySize": 128,


  // The role field will be automatically replaced 
  // if policyStatements and assumeRolePolicyDocument is set
  // "Role": null,
  "Description": "",
  "Environment": {
    "Variables": {}
  }
};
//This is the "Properties" field of CloudFormation
lambda.properties = theProperties;

lambda.assumeRolePolicyDocument = {
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {
      "Service": "lambda.amazonaws.com"
    },
    "Action": "sts:AssumeRole"
  }]
}

lambda.policyStatements = [{
    "Effect": "Allow",
    "Action": "logs:CreateLogGroup",
    "Resource": {
      "Fn::Join": [
        "", [
          "arn:aws:logs:",
          {
            "Ref": "AWS::Region"
          },
          ":",
          {
            "Ref": "AWS::AccountId"
          },
          ":*"
        ]
      ]
    }
  },
  {
    "Effect": "Allow",
    "Action": [
      "logs:CreateLogStream",
      "logs:PutLogEvents"
    ],
    "Resource": {
      "Fn::Join": [
        "", [
          "arn:aws:logs:",
          {
            "Ref": "AWS::Region"
          },
          ":",
          {
            "Ref": "AWS::AccountId"
          },
          ":log-group:*"
        ]
      ]
    }
  }
]

```

## [API Docs](https://warpdreams.github.io/cloudatlas-docs/)

Find it [here](https://warpdreams.github.io/cloudatlas-docs)

## Using Cloudatlas With Serverless

Cloudatlas can generate a `serverless.yml` file for your stack. Just run:

```
npm run cloudatlas -- upload --gen-serverless-yml
```

You can then find `serverless.yml` under `.cloudatlas` with which you can use Serverless to manage. 

## Comparison to Alternative Options

### Cloudatlas vs Writing CloudFormation JSON/YML Template File Directly
Needless to say, you need to manage every inch of details for CloudFormation.

### Cloudatlas vs Serverless with AWS Plugins
You need to find plugins for different AWS components if you need more than the most basic usage of Lambda and API Gateway. Different plugins may not be compatible with each other and may not provide all the configuration options you need. Then you resort to writing `resources` section in `serverless.yml` which is essentially writing the CloudFormation template file. 

## Practical Examples

Here is a list of example projects that are more realistic than "Hello World".

### Two Stacks

This project contains usage of following:

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
