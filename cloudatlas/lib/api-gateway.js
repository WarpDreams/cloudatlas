const assert = require('assert')
const _ = require('lodash')

const AWSComponent = require('./aws-component').AWSComponent

const Policy = require('./policy').Policy
const Lambda = require('./lambda').Lambda
const fs = require('fs')
const log = require('winston')

/**
 * This class represents an API Gateway component. 
 */
class ApiGateway extends AWSComponent {

  constructor(stackName, baseName) {
    super(stackName, baseName)

    this.lambdaConnections = {}
    this.swaggerJSON = {}
    this.deploymentStages = ['V1']
    this.policyStatements = [{
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
    }]

    this.assumeRolePolicyDocument = {
      "Version": "2012-10-17",
      "Statement": [{
        "Effect": "Allow",
        "Principal": {
          "Service": "apigateway.amazonaws.com"
        },
        "Action": "sts:AssumeRole"
      }]
    }
  }

  get binaryMediaTypes() {
    return this.swaggerJSON["x-amazon-apigateway-binary-media-types"];
  }

  set binaryMediaTypes(mediaTypesArray) {
    if (_.isEmpty(mediaTypesArray)) {
      delete this.swaggerJSON["x-amazon-apigateway-binary-media-types"];
    }
    else {
      this.swaggerJSON["x-amazon-apigateway-binary-media-types"] = mediaTypesArray;
    }
  }

  /*
  API gate-way all items
  */


  /*
   * Item object is an object:
   * {
   *  methods: [get, post, etc], 
   *   path: String, path allowed, must start with '/' could be '/*'
   * }
   */
  policyStatementForAccessImpl(accessLevels, item) {

    assert.ok(accessLevels[0])
    assert.ok(item)

    const { methods, path } = item

    assert.ok(methods.length)
    assert.ok(path)

    const accessLevel = accessLevels[0]

    let statement = null;

    switch (accessLevel) {
      case ApiGateway.ACCESS_LEVEL_READ:
      case ApiGateway.ACCESS_LEVEL_WRITE:

        //Notice: currently allow access to all stages
        let resourceArray = _.map(methods, (m) => {
          return {
            "Fn::Join": ["", ["arn:aws:execute-api:", { "Ref": "AWS::Region" }, ":", { "Ref": "AWS::AccountId" }, ":", this.getValue('ID'), "/*/" + m.toUpperCase() + path]]
          }
        })

        statement = {
          "Effect": "Allow",
          "Action": [
            "execute-api:Invoke"
          ],
          "Resource": resourceArray
        }

        break;
      default:
        throw new Error(`${accessLevel} is not supported for APIGateway class`)
        break;
    }

    return statement
  }
  
  /**
   * 
   */
  setDeploymentStages(stages) {
    assert.equal(stages.constructor, Array)
    assert.ok(stages.length)

    this.deploymentStages = _.uniq(stages)
  }

  setIAM(path, methods) {

    const lowercaseMethods = _.map(methods, (m) => {
      return m.toLowerCase()
    })

    /*
    Ref: 
    https://forums.aws.amazon.com/thread.jspa?threadID=236945
    http://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-swagger-extensions-authorizer.html

    */
    assert.ok(this.swaggerJSON)

    this.swaggerJSON.securityDefinitions = {
      "sigv4": {
        "type": "apiKey",
        "name": "Authorization",
        "in": "header",
        "x-amazon-apigateway-authtype": "awsSigv4"
      }
    }

    //Attach integration object to the announced methods
    let methodsDict = this.swaggerJSON.paths[path]
    _.each(methodsDict, (body, existingMethod) => {
      //console.log(`Checking: ${existingMethod} against: ${lowercaseMethods}`)
      if (lowercaseMethods.indexOf(existingMethod.toLowerCase()) >= 0) {
        //console.log(`Attaching to ${path} for ${existingMethod}`)
        body.security = [{
          sigv4: []
        }]
      }
    })
  }


  setIntegrationRequestResponseMappingOptions(options) {

  }

  ///API gateway needs to following resources:

  //AWS::ApiGateway::RestApi
  //AWS::Lambda::Permission (invoke Lambda)
  //AWS::IAM::Role Role, must be allowed to visit Logs Policy
  //AWS::ApiGateway::Account
  //AWS::ApiGateway::Stage  //Declaration of stage
  //AWS::ApiGateway::Deployment //Deployment of state
  //Check SWAG definition for ApiGateway?

  //attach lambda function to this gateway

  //NOTICE: APIGateway always allow CORS

   /**
    * Attach a Lambda to this API Gateway.
    * @example 

    apiGateway.attachLambda(lambda, '/hello', ['GET'], {
        '.*Invalid parameters.*': {
        statusCode: 400
      }
    });

    * 
    * @param {Lambda} lambda the Lambda object
    * @param {string} path the path of which the Lambda should process. This path must already declared in the Swagger file. 
    * @param {array} methods an array of methods the Lambda should process. ie ['GET', 'POST']
    * @param {object} responseConfigOptions Exact format please check https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-swagger-extensions-integration-responses.html
    */
  attachLambda(lambda, path, methods, responseConfigOptions) {

    const defaultOption = {
      "statusCode": 200,
      "responseParameters": {
        "method.response.header.Access-Control-Allow-Origin": "'*'"
      }
    };

    if (!responseConfigOptions) {
      responseConfigOptions = {
        "default": defaultOption
      }
    }

    //Check responseConfigOptions
    const defaultResponseOptions_check_size = _.filter(responseConfigOptions, (op, key) => {
      return key == 'default';
    })

    assert.ok(defaultResponseOptions_check_size.length <= 1,
      `Expect responseConfigOptions to have one default response status code (usually 200, but could be else), found ${defaultResponseOptions_check_size.length}`);
      
    if (defaultResponseOptions_check_size.length == 0) {
      //Doesnt have a default. We add in
      responseConfigOptions['default'] = defaultOption;
    }

    _.each(responseConfigOptions, (respOption, key) => {
      assert.ok(parseInt(respOption.statusCode) > 0, 'invalid statusCode value in responseConfigOptions: ' + respOption.statusCode);
      if (!respOption.responseParameters) {
        respOption.responseParameters = {
          "method.response.header.Access-Control-Allow-Origin": "'*'"
        }
      }
    })

    const lowercaseMethods = _.map(methods, (m) => {
      return m.toLowerCase()
    })

    assert.ok(lambda instanceof Lambda)
    assert.equal(methods.constructor, Array)
    const key = lambda.fullName + path + methods.join('-');
    this.lambdaConnections[key] = { lambda, path, methods }

    assert.ok(!(_.isEmpty(this.swaggerJSON)), `Invalid SWAGGER JSON: ${JSON.stringify(this.swaggerJSON, null, '  ')}`)
    assert.ok(this.swaggerJSON.paths[path], `${path} does not exist for the specified SWAGGER JSON`)

    //Attach integration object to the announced methods
    let methodsDict = this.swaggerJSON.paths[path]
    _.each(methodsDict, (body, existingMethod) => {
      log.silly(`Checking: ${existingMethod} against: ${lowercaseMethods}`)
      if (lowercaseMethods.indexOf(existingMethod.toLowerCase()) >= 0) {
        //console.log(`Attaching to ${path} for ${existingMethod}`)

        //Modify method.responses table. Add headers spec.
        assert.ok(!_.isEmpty(body.responses), `Method ${existingMethod} for path ${path} has empty responses field, this is invalid.`);

        //For all codes, we add header spec for Access-Control-Allow-Origin
        _.each(body.responses, (responseSpec, code) => {
          responseSpec.headers = responseSpec.headers || {};
          responseSpec.headers['Access-Control-Allow-Origin'] = { type: 'string' };
        })

        const requestTransformTemplateString = fs.readFileSync(__dirname + '/request-transform-passthrough.template').toString();

        body['x-amazon-apigateway-integration'] = {

          ////// This request template will provide all info for AWS_IAM authentication went through Cognito Idendity. 
          ////// Info will be added to event.context.
          "requestTemplates": {
            ////// The value is copied from "Method Request Template" of AWS web console -> API Gateway -> Body Mapping Templates
            "application/json": requestTransformTemplateString
          },

          "passthroughBehavior": "when_no_match",
          "httpMethod": 'POST',
          "type": "aws",

          "uri": {
            "Fn::Join": [
              "", [
                "arn:aws:apigateway:",
                {
                  "Ref": "AWS::Region"
                },
                ":lambda:path/2015-03-31/functions/",
                lambda.getValue('ARN'),
                "/invocations"
              ]
            ]
          },
          
          "responses": responseConfigOptions
        }
      }
    })

    //Write CORS as Options 
    methodsDict.options = {
      "responses": {
        "200": {
          "description": "200 response",
          "headers": {
            "Access-Control-Allow-Origin": {
              "type": "string"
            },
            "Access-Control-Allow-Methods": {
              "type": "string"
            },
            "Access-Control-Allow-Headers": {
              "type": "string"
            }
          }
        }
      },

      "x-amazon-apigateway-integration": {
        "responses": {
          "default": {
            "statusCode": "200",
            "responseParameters": {
              "method.response.header.Access-Control-Allow-Methods": `'${methods.join(',')}'`,
              //Specifies accept, origin, content-type additionally for early version of iOS. Although with * they don't matter
              "method.response.header.Access-Control-Allow-Headers": "'*,accept, origin, content-type'",
              "method.response.header.Access-Control-Allow-Origin": "'*'"
            }
          }
        },
        "requestTemplates": {
          "application/json": "{\"statusCode\": 200}"
        },
        "passthroughBehavior": "when_no_match",
        "type": "mock"
      }
    }
  }

  /**
   * Set the swagger JSON specification for the API Gateway. 
   * swaggerJSON must be set before you can attach any Lambdas to this API Gateway.
   * @param {object} swaggerJSON 
   */
  setSwagger(swaggerJSON) {

    function removeUnsupportedKeys(swagger) {
      const unsupportedKeys = 'example';
      for (const prop in swagger) {
        if (unsupportedKeys.indexOf(prop) >= 0) {
          delete swagger[prop];
        }
        else if (typeof swagger[prop] === 'object') {
          removeUnsupportedKeys(swagger[prop]);
        }
      }
    }
    //Clean up: certain fields in SWAGGER are not supported by API gateway. Need to cull them out
    const copy = _.clone(swaggerJSON)
    removeUnsupportedKeys(copy);
    this.swaggerJSON = copy
    return copy;
    //console.log('Setting swagger JSON: ' + JSON.stringify(this.swaggerJSON, null, '  '))
  }

  get outputSpecs() {
    //Default: get ARN and ID
    let specs = {}
    const id_spec = `${this.APIName}ID`;
    specs[id_spec] = {
      "Description": `The ID for resource ${this.fullName} of stack ${this.stackName}`,
      "Value": { "Ref": this.APIName },
      "Export": {
        "Name": id_spec
      }
    }

    /*
     * MORE: also get stages
     */

    return specs
  }

  /**
   * The full name of this API Gateway.
   */
  get APIName() {
    return this.fullName;
  }

  get fullName() {
    return this.stackName + '' + super.fullName;
  }

  get template() {

    let template = {}

    const restApiDependsOn = _.map(this.lambdaConnections, (connection, key) => {
      return connection.lambda.fullName
    })

    template[this.APIName] = {
      "Type": "AWS::ApiGateway::RestApi",
      "DependsOn": restApiDependsOn, //Reference attached Lambda, if any
      "Properties": {
        "Name": `${this.APIName}`,
        "Description": "",
        "FailOnWarnings": true
      }
    }

    //Standard Swagger JSON declaration
    //No extension. 
    if (this.swaggerJSON) {
      template[this.APIName].Properties.Body = this.swaggerJSON
    }

    //Default role
    template = _.merge(template, this.defaultRole.template)

    //Lambda permissions(s). setup Lambda permission for each lambda attachmen

    _.each(this.lambdaConnections, (connection, key) => {
      const { lambda, path, methods } = connection
      const permissionName = `${lambda.fullName}Permission`
      const permissionTemplate = {
        "Type": "AWS::Lambda::Permission",
        "Properties": {
          "Action": "lambda:invokeFunction",
          "FunctionName": lambda.getValue('ARN'),
          "Principal": "apigateway.amazonaws.com",

          //Points to this API Gateway
          "SourceArn": {
            "Fn::Join": ["", ["arn:aws:execute-api:", { "Ref": "AWS::Region" }, ":", { "Ref": "AWS::AccountId" }, ":", { "Ref": this.APIName }, "/*/*" + path]]
          }
        }
      }

      template[permissionName] = permissionTemplate
    })

    //Account
    template[`${this.APIName}Account`] = {
      "Type": "AWS::ApiGateway::Account",
      "Properties": {
        //Referencing this role name
        "CloudWatchRoleArn": { "Fn::GetAtt": [this.roleName(), "Arn"] }
      }
    }

    //Deployment stage(s)
    _.each(this.deploymentStages, (stageName) => {
      template[`${this.fullName}${stageName}Stage`] = {
        "Type": "AWS::ApiGateway::Deployment",
        "DependsOn": [this.APIName], ////TODO: fix actual method declaration 
        "Properties": {
          "RestApiId": { "Ref": this.APIName },
          "StageName": stageName
        }
      }
    })

    return template
  }
}

exports.ApiGateway = ApiGateway
