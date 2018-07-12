# Cloudatlas - Two Stacks Example

## Overview

This is a more practical and complex example of AWS CloudFormation stack using Cloudatlas.

Let's consider a stack that:

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
