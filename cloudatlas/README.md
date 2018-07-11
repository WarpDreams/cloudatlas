# Cloudatlas

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

Additionally, you would like to do some code deployments after the stack is ready, i.e uploading your static HTML files to the S3 bucket for web hosting.

It is also benifical to use two stacks instead of one. We put data persistant component such as user pool and DynamoDB tables in one stack, and volatile components such as Lambda and API Gateway in a second stack.

With `Cloudatlas` you can do all above in one single script!

Refer to [example-stack](https://github.com/WarpDreams/cloudatlas/tree/master/hello-stack) for the complete example.

### Deploying Multiple Stacks

Declare the two stacks we are going to deploy in [package.json](https://github.com/WarpDreams/cloudatlas/tree/master/example-stack/package.json)

```json
{
  "cloudatlas": {
    "source": "sample-stack-cloudatlas",
    "stacks": [
      {
        "name": "sample-stack-persist-cloudatlas"
      },
      {
        "name": "sample-stack-functions-cloudatlas",
        "lambdaSourceFiles": [
          "sample-stack-lambda.js",
          "node_modules/**/*"
        ]
      }
    ],

    "bucket": {
      "region": "ap-southeast-2",
      "name": "wd-build-products"
    }
  }
}
```

The plan is to put data persistant components such as S3, DynamoDB and Cognito User Pool in the first stack "sample-stack-persist-cloudatlas", and more volatile components such as Lambda in the second stack "sample-stack-functions-cloudatlas" which depends on the first stack. The second stack would be updated more frequently during deployment because of Lambda code updates. 

You can declare multiple stacks in in `package.json`, and the deployment will happen sequentially in the order they appear in JSON array. 

### Setting up IAM Roles Among AWS Components

Cloudatlas handles many of the IAM roles automatically. For example, if you attach Lambda to API Gateway:

```javascript
  sampleStackGateway.attachLambda(sampleStackLambda, '/checkDeployment', ['GET', 'POST', 'PUT'], {
    '.*Invalid parameters.*': {
      statusCode: 400
    }
  });
```

The IAM role for the API Gateway will have the Lambda invokation role added. 

For the manually cases, the pattern is grabbing a policy statements object from the componment that needs to be accessed, and add it to the component that needs access. Assume you have a DynamoDB table that needs to be accessed by a Lambda:


```javascript
const lambda = stack.createLambda('accessTable');
const table = stack.createDynamoDbTable('Storage')

lambda.policyStatements.push(table.policyStatementForAccess([
    DynamoDbTable.ACCESS_LEVEL_READ,
    DynamoDbTable.ACCESS_LEVEL_WRITE
  ]))
```

### Handling Cross-stack References

Cloudatlas will handle the cross-stack references automatically via CloudFormation `Outputs` as long as the stacks are deployed successfully in dependency order. In our example, `sample-stack-persist-cloudatlas` should be deployed first and must appear first in `package.json`. 

The AWS `AWS::Cognito::IdentityPoolRoleAttachment` component can not be deployed to the same stack as `AWS::Cognito::UserPool`. This is because the former must have literal ARN value (not `Ref` calls) of the latter, which means the user pool component must be done-deployed first. Some discussions can be found [here](https://forums.aws.amazon.com/thread.jspa?messageID=793299). One of the solution to this is to deploy them into two stacks respectively.


### Post Deployment Operations



(more details to follow)
