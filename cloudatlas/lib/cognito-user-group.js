const assert = require('assert')
const AWSComponent = require('./aws-component').AWSComponent
const CognitoUserPool = require('./cognito-user-pool').CognitoUserPool
const AWSObject = require('./aws-object').AWSObject
const Policy = require('./policy').Policy
const Role = require('./role').Role

const _ = require('lodash')

class CognitoUserGroup extends AWSComponent {

  constructor(stackName, baseName, userPool) {
    super(stackName, baseName)
    this._userPool = userPool
    this._precedence = 0
  }

  get groupName() {
    return `${this.stackName}_${this.fullName}`;
  }

  get outputSpecs() {
    let specs = {}
    const id_spec = `${this.stackName}${this.fullName}ID`;
    specs[id_spec] = {
      "Description": `The ID for resource ${this.fullName} of stack ${this.stackName}`,
      "Value": {"Ref": this.fullName},
      "Export": {
        "Name": id_spec
      }
    }
    
    return specs
  }

  set precidence(newPrecidence) {
    this._precedence = newPrecidence
  }

  get precidence() {
    return this._precedence
  }

  set userPool(newUserPool) {
    this._userPool = newUserPool
  }
  
  /**
   * @deprecated. This property was named incorrectly. Use assumeRolePolicyDocument
   * */
  set assumeRolePolicyStatement(doc) {
    console.warn('assumeRolePolicyStatement is deprecated. Use .assumeRolePolicyDocument instead');
    this.assumeRolePolicyDocument = doc;
  }

  get userPool() {
    return this._userPool
  }

  get template() {
    let role = this.defaultRole
    let template = {}

    template = _.merge(template, role.template)
    template[this.fullName] = 
    {
      "Type" : "AWS::Cognito::UserPoolGroup",
      "Properties" : {
        "Description" : `Group ${this.baseName}`,
        "GroupName" : this.groupName,
        "Precedence" : this.precidence,
        "UserPoolId" : this.userPool.getValue('ID'),
        "RoleArn": {
          "Fn::GetAtt": [
            role.fullName,
            "Arn"
          ]
        }
      }
    }

    return template
  }
}

exports.CognitoUserGroup = CognitoUserGroup