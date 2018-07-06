const assert = require('assert')
const _ = require('lodash')

const AWSObject = require('./aws-object').AWSObject
const Policy = require('./policy').Policy;

class AWSComponent extends AWSObject {
  
  constructor(stackName, baseName) {
      super(stackName, baseName)
      this.policyStatements = []
      this.assumeRolePolicyStatement = null

      this._crossStackValues = {}
  }

  get crossStackValues() {
    return _.clone(this._crossStackValues)
  }

  setCrossStackValue(name, value) {
    this._crossStackValues[name] = value
  }

  get sameStackValues() {
    return {
      'ID': {"Ref": this.fullName},
      'ARN': {
        "Fn::GetAtt": [
          this.fullName,
          "Arn"
        ]
      }
    }
  }

  /**
   * Get value of this component, variables can be: 
   * ARN, ID, PROVIDERNAME, etc
   * If this component is deployed and checked, the actual value will be provided.
   * Otherwise, AWS CloudFormation intrinsic specs will be returned, such as {"Ref": <logicName>}
   * 
   * @param {String} key 
   */
  getValue(key) {
    return this.crossStackValues[key] || this.sameStackValues[key]
  }

  get outputVariableKeys() {
    return _.keys(this.outputSpecs)
  }

  get outputSpecs() {
    //Default: get ARN and ID
    let specs = {}
    const id_spec = `${this.stackName}${this.fullName}ID`;
    specs[id_spec] = {
      "Description": `The ID for resource ${this.fullName} of stack ${this.stackName}`,
      "Value": {"Ref": this.fullName},
      "Export": {
        "Name": id_spec
      }
    }
  
    const arn_spec = `${this.stackName}${this.fullName}ARN`;
    specs[arn_spec] = {
      "Description": `The ARN for resource ${this.fullName} of stack ${this.stackName}`,
      "Value": {
        "Fn::GetAtt": [
          this.fullName,
          "Arn"
        ]
      },
      "Export": {
        "Name": arn_spec
      }
    }

    return specs
  }

  roleName() {
    return this.getDefaultRole().fullName
  }

  getDefaultRole() {
    const Role = require('./role').Role;
    let role = new Role(this.stackName, this.fullName)
    role.policyStatements = this.policyStatements
    if (this.assumeRolePolicyStatement) {
      role.assumeRolePolicyDocument = this.assumeRolePolicyStatement
    }
    return role
  }

  policyStatementForAccess(accessLevels, item) {
    accessLevels.forEach((accessLevel)=>{
      assert.ok([AWSComponent.ACCESS_LEVEL_READ, 
        AWSComponent.ACCESS_LEVEL_WRITE, 
        AWSComponent.ACCESS_LEVEL_ADMIN].indexOf(accessLevel) >= 0, `Invalid access level: ${accessLevel}`)
    })

    return this.policyStatementForAccessImpl(accessLevels, item)
  }

  policyStatementForAccessImpl(accessLevels, item){
    throw new Error('This function must be overriden in sub classes')
  }
}

//Static fields
AWSComponent.ACCESS_LEVEL_READ = 'ACCESS_LEVEL_READ'
AWSComponent.ACCESS_LEVEL_WRITE = 'ACCESS_LEVEL_WRITE'
AWSComponent.ACCESS_LEVEL_ADMIN = 'ACCESS_LEVEL_ADMIN'

exports.AWSComponent = AWSComponent