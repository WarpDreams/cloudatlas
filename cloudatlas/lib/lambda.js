const assert = require('assert')
const AWSComponent = require('./aws-component').AWSComponent
const Policy = require('./policy').Policy

const _ = require('lodash')

const LAMBDA_DEFAULT_TIMEOUT_SECS = 10
const LAMBDA_DEFAULT_MEMORY_SIZE_MB = 128

class Lambda extends AWSComponent {
  constructor(zone,
    accountNumberString,
    stackName,
    baseName) {
    super(zone, accountNumberString, stackName, baseName)
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

    this.assumeRolePolicyStatement = {
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

  setTimeoutSecs(timeoutSecs) {
    this.timeoutSecs = timeoutSecs
  }

  setMemorySizeMB(memorySizeMB) {
    this.memorySizeMB = memorySizeMB
  }

  //Specify code directly
  setCode(code) {
    assert.ok(!_.isEmpty(code))
    this.code = code
  }

  setSourcePackageInS3Bucket(bucketName, sourcePackageName) {

    assert.ok(bucketName)
    assert.ok(sourcePackageName)

    this.bucketName = bucketName
    this.sourcePackageName = sourcePackageName
  }

  setHandlerPath(handlerPath) {
    assert.ok(handlerPath)
    this.handlerPath = handlerPath
  }

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
    //console.log('DEFAULT ROLE: ' + JSON.stringify(this.getDefaultRole().template, null, 2))

    template = _.merge(template, this.getDefaultRole().template)

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
