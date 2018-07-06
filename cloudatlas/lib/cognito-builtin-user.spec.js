
const assert = require('assert')

const CognitoIdentityPool = require('./cognito-identity-pool').CognitoIdentityPool
const CognitoUserPool = require('./cognito-user-pool').CognitoUserPool
const { CloudFormation } = require('./cloud-formation');
const Lambda = require('./lambda').Lambda
const Policy = require('./policy').Policy
const APIGateway = require('./api-gateway').APIGateway
const CognitoBuiltinUser = require('./cognito-builtin-user').CognitoBuiltinUser


describe('test CognitoUserPoolAppClient', () => {
  let stack = null
  let user = null
  let pool = null
  beforeEach(() => {
    stack = new CloudFormation('CloudAtlasTest')
    
    pool = stack.createCognitoUserPool('Users')
    user = stack.createCognitoBuiltinUser('alienbat', pool)
    assert.ok(user)
  })

  test('Should create CognitoBuiltinUser spec correctly', () => {
    user.email = 'alienbat@gmail.com'
    const template = user.template
    expect(template).toEqual({
      'alienbatCognitoBuiltinUser': {
        "Type": "AWS::Cognito::UserPoolUser",
        "Properties": {
          "ForceAliasCreation": false,
          "UserAttributes": [{
            Name: 'email',
            Value: 'alienbat@gmail.com'
          }],
          "Username": 'alienbat',
          "UserPoolId": pool.getValue('ID')
        }
      }
    })
  })
})
