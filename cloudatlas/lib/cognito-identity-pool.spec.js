
const assert = require('assert')

const CognitoIdentityPool = require('./cognito-identity-pool').CognitoIdentityPool
const { CloudFormation } = require('./cloud-formation');
const Lambda = require('./lambda').Lambda
const Policy = require('./policy').Policy
const APIGateway = require('./api-gateway').APIGateway


describe('test Cognito Identity Pool', () => {

  let identityPool = null
  let userPool = null
  let client = null
  let stack = null

  beforeEach(() => {
    stack = new CloudFormation('CloudAtlasTest')

    identityPool = stack.createCognitoIdentityPool('Users')
    userPool = stack.createCognitoUserPool('Users')
    client = stack.createCognitoUserPoolAppClient('Default', userPool)

    assert.ok(identityPool)
  })

  test('Test get identity identityPool template', () => {

    identityPool.setUserPoolAsIdentityProvider(userPool, client)
    identityPool.allowUnauthenticatedIdentities = true

    let template = identityPool.template
    
    let expectedTemplate =  {
      "UsersCognitoIdentityPool": {
        "Properties": {
          "AllowUnauthenticatedIdentities": true,
          "CognitoIdentityProviders": [{
            "ClientId": {
              "Ref": "DefaultCognitoUserPoolAppClient"
            },
            "ProviderName": {
              "Fn::GetAtt": ["UsersCognitoUserPool", "ProviderName"]
            },
            "ServerSideTokenCheck": false
          }],
          "IdentityPoolName": "CloudAtlasTest_UsersIdentities"
        },
        "Type": "AWS::Cognito::IdentityPool"
      }
    }
    expect(template).toEqual(expectedTemplate)
  })
})