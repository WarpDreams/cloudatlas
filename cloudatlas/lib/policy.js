const assert = require('assert')
const AWSComponent = require('./aws-component').AWSComponent
const AWSObject = require('./aws-object').AWSObject


class Policy extends AWSObject {

  constructor(
    stackName,
    baseName) {
    super(stackName, baseName)
    this.statements = []
  }

  setStatements(statements) {
    assert.equal(statements.constructor, Array)
    this.statements = statements
  }

  get template() {
    return {
      "PolicyName": `${this.fullName}`,
      "PolicyDocument": {
        "Version": "2012-10-17",
        "Statement": this.statements
      }
    }
  }
}

exports.Policy = Policy