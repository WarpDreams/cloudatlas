const ApiGateway = require('./api-gateway').ApiGateway
const Lambda = require('./lambda').Lambda
const { CloudFormation } = require('./cloud-formation');
const assert = require('assert')

const testSwagger = require('./unit-test-swagger-api.json')

describe('test api-gateway', () => {
  let gateway = null
  let stack = null
  beforeEach(() => {
    stack = new CloudFormation('CloudAtlasTest')

    gateway = stack.createApiGateway('unitTest')
    assert.ok(gateway)
  })

  test('Basic function should work', () => {
    expect(gateway.fullName).toEqual('CloudAtlasTestunitTestApiGateway')
  })

  test('Connection to lambda', ()=>{

    gateway.setSwagger(testSwagger)

    let lambda = stack.createLambda('unitTest')
    //console.log(JSON.stringify(gateway.swaggerJSON, null, '  '))
    gateway.attachLambda(lambda, '/hello', ['POST', 'GET'])

    const template = gateway.template
    //console.log(JSON.stringify(template, null, '\t'))

    const expectedPolicies = 
    [
      {
        "PolicyName": "CloudAtlasTestunitTestApiGatewayRolePolicy",
        "PolicyDocument": {
          "Version": "2012-10-17",
          "Statement": [
            {
              "Effect": "Allow",
              "Action": [
                "logs:CreateLogGroup",
                "logs:CreateLogStream",
                "logs:DescribeLogGroups",
                "logs:DescribeLogStreams",
                "logs:PutLogEvents",
                "logs:GetLogEvents",
                "logs:FilterLogEvents"
              ],
              "Resource": "*"
            }
          ]
        }
      }
    ]

    expect(template.CloudAtlasTestunitTestApiGatewayRole.Properties.Policies).toEqual(expectedPolicies)

  })

  test('Invokation spec', ()=>{
    const statement = 
    gateway.policyStatementForAccess([ApiGateway.ACCESS_LEVEL_READ], 
      {methods: ['post','get'], path:'/hello'})
    expect(statement).toEqual(
      {
        "Effect": "Allow",
        "Action": [
          "execute-api:Invoke"           
        ],
        "Resource": [
          {
            "Fn::Join": ["", 
            ["arn:aws:execute-api:", {"Ref": "AWS::Region"}, ":", {"Ref": "AWS::AccountId"}, ":", {"Ref": "CloudAtlasTestunitTestApiGateway"}, "/*/POST/hello"]]
          },
          {
            "Fn::Join": ["", 
            ["arn:aws:execute-api:", {"Ref": "AWS::Region"}, ":", {"Ref": "AWS::AccountId"}, ":", {"Ref": "CloudAtlasTestunitTestApiGateway"}, "/*/GET/hello"]]
          }
        ]
      }
    )
  })
})