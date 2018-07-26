const assert = require('assert')
const _ = require('lodash')

class AWSObject {
  constructor(stackName, baseName) {
    assert.ok(stackName)
    assert.ok(baseName)

    this.stackName = stackName
    this.baseName = baseName
  }

  getValue(key) {
    let result = null;
    switch (key) {
      case 'ARN':
        result = {
          "Fn::GetAtt": [
            this.fullName,
            "Arn"
          ]
        };
        break;
      case 'ID':
        result = { "Ref": this.fullName };
      default:
        throw new Error(`getValue with key=${key} is not supported`);
    }
    return result;
  }

  get fullName() {
    return `${this.baseName}${this.posfix()}`
  }

  get template() {
    throw new Error(`${this.constructor.name}: This function must be overriden in sub classes`)
  }

  posfix() {
    return this.constructor.name
  }
}

exports.AWSObject = AWSObject
