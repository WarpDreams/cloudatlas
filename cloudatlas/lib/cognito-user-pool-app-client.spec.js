
const assert = require('assert')

const CognitoIdentityPool = require('./cognito-identity-pool').CognitoIdentityPool
const CognitoUserPool = require('./cognito-user-pool').CognitoUserPool
const { CloudFormation } = require('./cloud-formation')
const Lambda = require('./lambda').Lambda
const Policy = require('./policy').Policy
const APIGateway = require('./api-gateway').APIGateway
const CognitoUserPoolAppClient = require('./cognito-user-pool-app-client').CognitoUserPoolAppClient


describe('test CognitoUserPoolAppClient', () => {
  let stack = null
  let client = null
  beforeEach(() => {
    stack = new CloudFormation('CloudAtlasTest')
    let pool = stack.createCognitoUserPool('Users')
    client = stack.createCognitoUserPoolAppClient('Default', pool)
    assert.ok(client)
  })

  test('Should create CognitoUserPoolAppClient spec correctly', () => {
    client.tokenValidDays = 10
    const template = client.template
    expect(template).toEqual(
      {
        'DefaultCognitoUserPoolAppClient': {
          "Properties":
            {
              "ClientName": "DefaultCognitoUserPoolAppClient",
              "GenerateSecret": false, "RefreshTokenValidity": 10,
              "UserPoolId": { "Ref": "UsersCognitoUserPool" },
              "WriteAttributes": [
                "email"
              ]
            },
          "Type": "AWS::Cognito::UserPoolClient"
        }
      }
    )
  })
})
