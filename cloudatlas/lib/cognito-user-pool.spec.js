const CognitoUserPool = require('./cognito-user-pool').CognitoUserPool
const AWSComponent = require('./aws-component').AWSComponent

const Lambda = require('./lambda').Lambda

const _ = require('lodash')

const { CloudFormation } = require('./cloud-formation');
const assert = require('assert')

describe('test CognitoUserPool', () => {
  let pool = null
  let stack = null;

  beforeEach(() => {
    stack = new CloudFormation('CloudAtlasTest')
    pool = stack.createCognitoUserPool('unitTestUsers')
    assert.ok(pool)
  })

  test('Should get access statement correctly', ()=>{
    const statement = pool.policyStatementForAccess([AWSComponent.ACCESS_LEVEL_READ])
    expect(statement).toEqual({
      "Effect": "Allow",
      "Action": [
        "cognito-idp:AdminGetUser"
      ].sort(),
      "Resource": [
        {
          "Fn::GetAtt": [pool.fullName, "Arn"]
        }
      ]
    })
  })

  test('Should create Cognito pool spec correctly', () => {
    const poolProperties = {
      AdminCreateUserConfig: {
        "AllowAdminCreateUserOnly" : false,
        "InviteMessageTemplate" : {
          "EmailMessage" : 'Welcome',
          "EmailSubject" : 'Welcome',
          "SMSMessage" : 'Welcome'
        },
        UnusedAccountValidityDays : 60
      },
      AliasAttributes: null,
      AutoVerifiedAttributes: ['email'],
      EmailConfiguration: null,
      EmailVerificationMessage: null,
      EmailVerificationSubject: null,
      LambdaConfig: null,
      MfaConfiguration: null,
      ///This is the policy for Cognito users that are not ground
      Policies: null,
      UserPoolName: null, //This will be managed by the class!
      Schema: null,
      SmsAuthenticationMessage: null,
      SmsConfiguration: null,
      SmsVerificationMessage: null
    }

    pool.setProperties(poolProperties)

    const template = pool.template

    //console.log('Received template IS: \n' + JSON.stringify(template, null, '\t'))

    expect(template['unitTestUsersCognitoUserPool']).toEqual(
      {
        "Type": "AWS::Cognito::UserPool",
        "Properties": {
          UserPoolName: "CloudAtlasTest_unitTestUsers",
          AdminCreateUserConfig: {
            "AllowAdminCreateUserOnly" : false,
            "InviteMessageTemplate" : {
              "EmailMessage" : 'Welcome',
              "EmailSubject" : 'Welcome',
              "SMSMessage" : 'Welcome'
            },
            UnusedAccountValidityDays : 60
          },
          AliasAttributes: null,
          AutoVerifiedAttributes: ['email'],
          EmailConfiguration: null,
          EmailVerificationMessage: null,
          EmailVerificationSubject: null,
          LambdaConfig: null,
          MfaConfiguration: null,
          ///This is the policy for Cognito users that are not ground
          Policies: null,
          Schema: null,
          SmsAuthenticationMessage: null,
          SmsConfiguration: null,
          SmsVerificationMessage: null
        }
      })

    // expect(template['unitTestUsersCognitoUserPoolDefaultUserGroup']).toEqual(
    //   {
    //     "Type": "AWS::Cognito::UserPoolGroup",
    //     "Properties": {
    //       "Description": "Default group",
    //       "GroupName": "Default",
    //       "Precedence": 1,
    //       "RoleArn": {
    //         "Fn::GetAtt": [
    //           "testLambdaLambdaRole",
    //           "Arn",
    //         ],
    //       },
    //       "UserPoolId": {
    //         "Ref": "unitTestUsersCognitoUserPool"
    //       }
    //     }
    //   }
    // )

  })
})