
const assert = require('assert')

const CloudFormation = require('./cloud-formation').CloudFormation
const Lambda = require('./lambda').Lambda
const Policy = require('./policy').Policy
const APIGateway = require('./api-gateway').APIGateway
const testSwagger = require('./unit-test-swagger-api.json')


describe('test cloud-formation', () => {
  
  let cf = null
  let stack = null
  beforeEach(() => {
    stack = new CloudFormation('CloudAtlasTest')

    cf = stack;
    assert.ok(cf)
    assert.ok(stack);
  })

  test('Test get simple APIGateway-Lambda stack', () => {

    let lambda = stack.createLambda('unitTest')
    //An inline test code 
    const lambdaCode = {
      "ZipFile": { "Fn::Join": ["\n", [
        "'use strict';",
        "",
        "// Greeter Lambda",
        "exports.handler = (event, context, callback) => {",
        "  console.log('Event:', JSON.stringify(event));",
        "  const name = event.name || 'World';",
        "  const response = {greeting: `Hello, ${name}!`};",
        "  callback(null, response);",
        "};"
      ]]}
    }

    //lambda.setSourcePackageInS3Bucket('TestBucket', 'Test.zip')
    lambda.setCode(lambdaCode)
    lambda.setHandlerPath('index.handler')
    
    let gateway = stack.createApiGateway('unitTest')
    gateway.setSwagger(testSwagger)
    gateway.attachLambda(lambda, '/hello', ['GET', 'POST'])
    
    //expect(lambda.fullName).toEqual('unitTestLambda')
    let template = cf.template
    //console.log(JSON.stringify(template, null, '  '))
  })
})