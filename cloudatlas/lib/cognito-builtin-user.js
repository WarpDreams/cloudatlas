const assert = require('assert')
const AWSComponent = require('./aws-component').AWSComponent
const AWSObject = require('./aws-object').AWSObject

const _ = require('lodash')

class CognitoBuiltinUser extends AWSComponent {
  constructor(
    stackName,
    baseName,
    userPool) {
    super(stackName, baseName)
    this.userName = baseName
    this.email = ''
    this.userPool = userPool
  }

  get outputSpecs() {
    //Default: get ARN and ID
    let specs = {}
    specs[`${this.stackName}${this.fullName}ID`] = {
      "Description": `The ID for resource ${this.fullName} of stack ${this.stackName}`,
      "Value": {"Ref": this.fullName},
      "Export": {
        "Name": `${this.stackName}${this.fullName}ID`
      }
    }

    //Override user does not support ARN

    return specs
  }

  get template() {
    let template = {}
    template[this.fullName] = {
      "Type": "AWS::Cognito::UserPoolUser",
      "Properties": {
        "ForceAliasCreation": false,
        "UserAttributes": [{
          Name: 'email',
          Value: this.email
        }],
        "Username": this.userName,
        "UserPoolId": this.userPool.getValue('ID')
      }
    }
    return template
  }
}

exports.CognitoBuiltinUser = CognitoBuiltinUser

