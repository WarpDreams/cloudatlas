const assert = require('assert')
const AWSComponent = require('./aws-component').AWSComponent
const CognitoUserPool = require('./cognito-user-pool').CognitoUserPool
const AWSObject = require('./aws-object').AWSObject
const Policy = require('./policy').Policy
const Role = require('./role').Role
const cst = require('./constants')
const _ = require('lodash')

class S3 extends AWSComponent {

  constructor(stackName, baseName) {
    super(stackName, baseName)
    this._cannedACL = S3.CANNED_ACL_PRIVATE
    this._bucketPolicyTemplate = null
    this._configurations = {}
  }
  
  /* S3 configurations to override */
  get configurations() {
    return this._configurations;
  }
  
  set configurations(configurations) {
    this._configurations = configurations;
  }
  
  setupAsStaticWebSite(indexDocument = 'index.html', errorDocument = null) {
    assert.ok(!_.isEmpty(indexDocument), 'indexDocument is mandatory');
    const websiteConfigs = {
      IndexDocument: indexDocument
    }
    if (errorDocument) {
      websiteConfigs.ErrorDocument = errorDocument;
    }
    this._configurations.WebsiteConfiguration = websiteConfigs;
  }

  get bucketName() {
    return this.fullName.toLowerCase()
  }

  get fullName() {
    //S3 bucket does not have cloud-formation namespace. Must be fully qualified
    return `${this.stackName}${super.fullName}`
  }

  set bucketPolicyTemplate(newBucketPolicyTemplate) {
    this._bucketPolicyTemplate = newBucketPolicyTemplate
  }

  get bucketPolicyTemplate() {
    return this._bucketPolicyTemplate
  }

  set cannedACL(newCannedACL) {
    this._cannedACL = newCannedACL
  }

  get cannedACL() {
    return this._cannedACL
  }

  /**
   * 
   * @param {*} accessLevels 
   * @param {String} pathPattern stuff after path, start with '/'
   */
  policyStatementForAccessImpl(accessLevels, pathPattern = S3.PATHPATTERN_ALL) {
    let actionsTable = {}
    actionsTable[AWSComponent.ACCESS_LEVEL_READ] = [
      's3:GetObject'
    ]
    
    actionsTable[AWSComponent.ACCESS_LEVEL_WRITE] = [
      's3:PutObject',
      's3:PutObjectAcl',
      'S3:PutObjectTagging'
    ]
    
    actionsTable[AWSComponent.ACCESS_LEVEL_ADMIN] = [
      //To be filled
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
        {
          "Fn::Join": [
            "",
            [
              this.getValue('ARN'),
              pathPattern
            ]
          ]
        }
      ]
    }
  }

  /*
   * Get a policy that allows public to read individual items,
   * if they have a link (can not list objects)
   */
  get publicIndividualReadBucketPolicyTemplate() {
    let template = {}
    template[`${this.fullName}BucketPolicy`] = {
      "Type" : "AWS::S3::BucketPolicy",
      "Properties" : {
        "Bucket" : {"Ref" : this.fullName},
        "PolicyDocument": {
          "Statement":[{
          "Action":["s3:GetObject"],
          "Effect":"Allow",
          "Resource": { "Fn::Join" : ["", ["arn:aws:s3:::", { "Ref" : this.fullName} , "/*" ]]},
          "Principal":"*",
          }]
        }
      }
    }
    return template
  }

  get template() {
    let template = {}
     template[this.fullName] = {
      "Type" : "AWS::S3::Bucket",
      "Properties" : {
        "AccessControl" : this.cannedACL,
        "BucketName" : this.bucketName,
        "CorsConfiguration" : {
            'CorsRules': [{
              AllowedHeaders: ['*'],
              AllowedMethods: [ 'GET', 'PUT', 'HEAD', 'POST', 'DELETE'],
              AllowedOrigins: ['*']
            }]
          }, //Cors rules
        //"LoggingConfiguration" : LoggingConfiguration,
        //"MetricsConfigurations" : [ MetricsConfiguration, ... ]
        //"NotificationConfiguration" : NotificationConfiguration,
        //"ReplicationConfiguration" : ReplicationConfiguration,
        //"Tags" : [ Resource Tag, ... ],
        //"VersioningConfiguration" : VersioningConfiguration,
        //"WebsiteConfiguration" : WebsiteConfiguration
      }
    }

    if (this.bucketPolicyTemplate) {
      template = _.merge(template, this.bucketPolicyTemplate)
    }
    
    template[this.fullName]['Properties'] = _.merge(template[this.fullName]['Properties'], this.configurations);

    return template
  }
}

S3.CANNED_ACL_PUBLIC_READ = 'PublicRead'
S3.CANNED_ACL_PRIVATE = 'Private'
S3.PATHPATTERN_ALL = '/*'
S3.PATHPATTERN_BUCKET_ITSELF = ''

exports.S3 = S3
