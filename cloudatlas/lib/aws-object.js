const assert = require('assert')
const _ = require('lodash')

class AWSObject {
  constructor(stackName, baseName) {
      assert.ok(stackName)
      assert.ok(baseName)
      
      this.stackName = stackName
      this.baseName = baseName
  }

  /*
  get template() {
    return getTemplate()
  }
  */

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
