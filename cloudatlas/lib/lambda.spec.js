const c = require('./lambda')
const { CloudFormation } = require('./cloud-formation');
const assert = require('assert')

describe('test lambda', () => {
  let lambda = null
  beforeEach(() => {
    let stack = new CloudFormation('CloudAtlasTest')

    lambda = stack.createLambda('unitTest')
    lambda.setSourcePackageInS3Bucket('TestBucket', 'Test.zip')
    lambda.setHandlerPath('src/hander.js')

    assert.ok(lambda)
  })

  test('Basic function should work', () => {
    expect(lambda.fullName).toEqual('unitTestLambda')
  })

  test('Should create CloudFormation spec correctly - Lambda', () => {

    lambda.setTimeoutSecs(15)
    lambda.setMemorySizeMB(256)

    const template = lambda.template

    //console.log('Received template IS: \n' + JSON.stringify(template, null, '\t'))
    
    expect(template['unitTestLambda']).toEqual(
    {
      "Type": "AWS::Lambda::Function",
      "Properties": {
        "Code": {
          "S3Bucket": 'TestBucket',
          "S3Key": 'Test.zip'
        },
        "Handler": 'src/hander.js',
        "Timeout": 15,
        "MemorySize": 256,

        "Role": {
          "Fn::GetAtt": ['unitTestLambdaRole', "Arn"]
        },

        "Description": "lambda function for stack CloudAtlasTest, baseName=unitTest",
        "Environment": {
          "Variables": {
            //"GIT_HASH": git.short()
          }
        },
      }
    })
  })

  test('Should create CloudFormation spec correctly - Role', () => {
    const template = lambda.template
    expect(template['unitTestLambdaRole']).toEqual(
      {
        "Type": "AWS::IAM::Role",
        "Properties": {
          //Copied from AWS generated Role for Lambda 
          "AssumeRolePolicyDocument": {
            "Version": "2012-10-17",
            "Statement": [
              {
                "Effect": "Allow",
                "Principal": {
                  "Service": "lambda.amazonaws.com"
                },
                "Action": "sts:AssumeRole"
              }
            ]
          },
          "Policies": [
            ////Copied and modified from AWS generated Role for Lambda 
            {
              "PolicyName": `unitTestLambdaRolePolicy`,
              "PolicyDocument": {
                "Version": "2012-10-17",
                "Statement": [
                  {
                    "Effect": "Allow",
                    "Action": "logs:CreateLogGroup",
                    "Resource": {"Fn::Join": [
                      "",
                      ['arn:aws:logs:', {"Ref": "AWS::Region"}, ":", {"Ref": "AWS::AccountId"}, ":*"]
                    ]}
                    //"Resource": `arn:aws:logs:ap-southeast-2:111:*`
                  },
                  {
                    "Effect": "Allow",
                    "Action": [
                      "logs:CreateLogStream",
                      "logs:PutLogEvents"
                    ],
                    "Resource": {"Fn::Join": [
                      "",
                      ['arn:aws:logs:', {"Ref": "AWS::Region"}, ":", {"Ref": "AWS::AccountId"}, ":log-group:*"]
                    ]}
                    // "Resource": [
                    //   `arn:aws:logs:ap-southeast-2:111:log-group:/aws/lambda/unitTestLambda:*`
                    // ]
                  }
                ]
              }
            }
          ],
          "Path": "/"
        }
      } //End role
    )
  })
})