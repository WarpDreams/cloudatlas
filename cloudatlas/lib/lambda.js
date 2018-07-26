const assert = require('assert')
const AWSComponent = require('./aws-component').AWSComponent
const Policy = require('./policy').Policy

const _ = require('lodash')

const LAMBDA_DEFAULT_TIMEOUT_SECS = 10
const LAMBDA_DEFAULT_MEMORY_SIZE_MB = 128

/**
 * This class represents a Lambda component. 
 * @inheritdoc
 */
class Lambda extends AWSComponent {
  /**
   * Don't call this manually. Use creator function in {@link CloudFormation}
   * @param {string} stackName 
   * @param {string} baseName 
   */
  constructor(
    stackName,
    baseName) {
    super(stackName, baseName)
    this.envVariables = {}
    this.timeoutSecs = LAMBDA_DEFAULT_TIMEOUT_SECS
    this.memorySizeMB = LAMBDA_DEFAULT_MEMORY_SIZE_MB

    //Default policyStatements for Lambda
    this.policyStatements = [{
        "Effect": "Allow",
        "Action": "logs:CreateLogGroup",
        "Resource": {
          "Fn::Join": [
            "", ['arn:aws:logs:', { "Ref": "AWS::Region" }, ":", { "Ref": "AWS::AccountId" }, ":*"]
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
            "", ['arn:aws:logs:', { "Ref": "AWS::Region" }, ":", { "Ref": "AWS::AccountId" }, ":log-group:*"]
          ]
        }
      }
    ]

    this.assumeRolePolicyDocument = {
      "Version": "2012-10-17",
      "Statement": [{
        "Effect": "Allow",
        "Principal": {
          "Service": "lambda.amazonaws.com"
        },
        "Action": "sts:AssumeRole"
      }]
    }
  }

  policyStatementForAccessImpl(accessLevels, item) {
    //Item is ignored, because there is only one thing to offer 

    let actionsTable = {}
    actionsTable[AWSComponent.ACCESS_LEVEL_READ] = [
      'lambda:InvokeFunction'
    ]

    actionsTable[AWSComponent.ACCESS_LEVEL_WRITE] = [
      //TODO
    ]

    actionsTable[AWSComponent.ACCESS_LEVEL_ADMIN] = [
      //TODO
    ]

    let allowedActions = []
    accessLevels.forEach((level) => {
      let actions = actionsTable[level]
      allowedActions = allowedActions.concat(actions)
    })

    return {
      "Effect": "Allow",
      "Action": allowedActions.sort(),
      "Resource": [
        this.getValue('ARN')
      ]
    }
  }

  /**
   * Set the timeout value of this Lambda in seconds.
   * @param {float} timeoutSecs 
   */
  setTimeoutSecs(timeoutSecs) {
    this.timeoutSecs = timeoutSecs
  }

  /**
   * Set the memory limit of this Lambda in MB.
   * @param {float} memorySizeMB 
   */
  setMemorySizeMB(memorySizeMB) {
    this.memorySizeMB = memorySizeMB
  }

  /**
   * Set the source code of this Lambda in the form of array of text strings.
   * @param {array} code 
   */
  setCode(code) {
    assert.ok(!_.isEmpty(code))
    this.code = code
  }

  /**
   * Set teh source code zip in S3. You don't need to call this manually if "lambdaSourceFiles" is declared in package.json.
   *  
   * @param {string} bucketName 
   * @param {string} sourcePackageName 
   */
  setSourcePackageInS3Bucket(bucketName, sourcePackageName) {

    assert.ok(bucketName)
    assert.ok(sourcePackageName)

    this.bucketName = bucketName
    this.sourcePackageName = sourcePackageName
  }

  /**
   * Set the handler function path
   * @param {string} handlerPath 
   */
  setHandlerPath(handlerPath) {
    assert.ok(handlerPath)
    this.handlerPath = handlerPath
  }

  /**
   * Set the environment variables of this Lambda in the form of key-value pairs
   * @param {object} envVariables 
   */
  setEnvVariables(envVariables) {
    this.envVariables = envVariables
  }

  get template() {

    if (!this.code) {
      assert.ok(this.bucketName)
      assert.ok(this.sourcePackageName)
    }

    let template = {}

    //This is the role that's used by Lambda
    //console.log('DEFAULT ROLE: ' + JSON.stringify(this.defaultRole.template, null, 2))

    template = _.merge(template, this.defaultRole.template)

    /*
    template[this.roleName()] = {
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
        "Policies": this.getAllPoliciesTemplate(),
        "Path": "/"
      }
    } //End role
    */


    template[this.fullName] = {
      "Type": "AWS::Lambda::Function",
      "Properties": {
        "Code": this.code || {
          "S3Bucket": this.bucketName,
          "S3Key": this.sourcePackageName
        },
        "Handler": this.handlerPath,
        "Runtime": 'nodejs8.10',
        "Timeout": this.timeoutSecs,
        "MemorySize": this.memorySizeMB,

        "Role": {
          "Fn::GetAtt": [this.roleName(), "Arn"]
        },

        "Description": `lambda function for stack ${this.stackName}, baseName=${this.baseName}`,
        "Environment": {
          "Variables": this.envVariables
        },
      }
    } //End lambda declaration 

    return template
  }
}

exports.Lambda = Lambda
