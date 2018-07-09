const assert = require('assert')
const AWSComponent = require('./aws-component').AWSComponent
const AWSObject = require('./aws-object').AWSObject
const Policy = require('./policy').Policy


/*

Role object structure:

    "unitTestLambdaRole": {
      "Type": "AWS::IAM::Role",
      "Properties": {
        "AssumeRolePolicyDocument": ...,
        "Policies": [
          {
            "PolicyName": "unitTestLambdaRolePolicy",
            "PolicyDocument": {
              "Version": "2012-10-17",
              "Statement": [Array of statements]
            }
          }
        "Path": "/"
      }
    }

*/
class Role extends AWSObject {

  constructor(
    stackName,
    baseName) {
    super(stackName, baseName)

    this.assumeRolePolicyDocument = null
    this.policyStatements = []
  }

  roleName() {
    return this.fullName
  }

  getDefaultPolicy() {
    let policy = new Policy(this.stackName, this.fullName)
    policy.setStatements(this.policyStatements)
    return policy
  }

  get template() {

    let template = {}

    let defaultPolicy = this.getDefaultPolicy()

    template[this.fullName] = {
      "Type": "AWS::IAM::Role",
      "Properties": {
        "AssumeRolePolicyDocument": this.assumeRolePolicyDocument,
        "Policies": [
          defaultPolicy.template
        ],
        "Path": "/"
      }
    }
    
    return template
  }
}

exports.Role = Role
