const assert = require('assert')

const CognitoIdentityPool = require('./cognito-identity-pool').CognitoIdentityPool
const CognitoUserPool = require('./cognito-user-pool').CognitoUserPool
const CognitoUserGroup = require('./cognito-user-group').CognitoUserGroup
const { CloudFormation } = require('./cloud-formation');
const Lambda = require('./lambda').Lambda
const Policy = require('./policy').Policy

const log = require('winston')


describe('test CognitoUserGroup', () => {
  let stack = null
  let pool = null
  let userGroup = null
  beforeEach(() => {
    stack = new CloudFormation('CloudAtlasTest')
    pool = stack.createCognitoUserPool('Users')
    userGroup = stack.createCognitoUserGroup('Default', pool)
    assert.ok(userGroup)
  })

  test('Should create CognitoUserGroup spec correctly', () => {

    //This is not valid for CloudFormation, but good enough for unit test
    userGroup.assumeRolePolicyStatement = {} 
    userGroup.policyStatements.push(pool.policyStatementForAccess([CognitoUserPool.ACCESS_LEVEL_READ]))

    const template = userGroup.template
    //log.info(JSON.stringify(template, null, 2))
    expect(template).toEqual({
      "DefaultCognitoUserGroupRole": {
        "Type": "AWS::IAM::Role",
        "Properties": {
          "AssumeRolePolicyDocument": {},
          "Policies": [
            {
              "PolicyName": "DefaultCognitoUserGroupRolePolicy",
              "PolicyDocument": {
                "Version": "2012-10-17",
                "Statement": [
                  {
                    "Effect": "Allow",
                    "Action": [
                      "cognito-idp:AdminGetUser"
                    ],
                    "Resource": [
                      {
                        "Fn::GetAtt": [
                          "UsersCognitoUserPool",
                          "Arn"
                        ]
                      }
                    ]
                  }
                ]
              }
            }
          ],
          "Path": "/"
        }
      },
      "DefaultCognitoUserGroup": {
        "Type": "AWS::Cognito::UserPoolGroup",
        "Properties": {
          "Description": "Group Default",
          "GroupName": `${stack.stackName}_DefaultCognitoUserGroup`,
          "Precedence": 0,
          "UserPoolId": {
            "Ref": "UsersCognitoUserPool"
          },
          "RoleArn": {
            "Fn::GetAtt": [
              "DefaultCognitoUserGroupRole",
              "Arn"
            ]
          }
        }
      }
    })
  })
})
