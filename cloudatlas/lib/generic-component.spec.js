const { CloudFormation } = require('./cloud-formation');
const { GenericComponent } = require('./generic-component');
const { Lambda } = require('./lambda');
const assert = require('assert');

/* global expect */

describe('Test Generic Component', () => {
  test('A generic component as a Lambda', () => {
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

    const template = lambda.template;
    //console.log('-------- generated GC template: ' + JSON.stringify(template, null, 2));

    expect(template['LambdaGenericComponent']['Properties']).toEqual(expect.objectContaining(theProperties));
    expect(template['LambdaGenericComponent']['Properties']['Role']).toEqual({
      "Fn::GetAtt": [
        "LambdaGenericComponentRole",
        "Arn"
      ]
    });
    //expect(template['unitTestGenericComponent']).toEqual(lambda.template['unitTestLambda']);
  })
})
