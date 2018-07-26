const assert = require('assert')
const _ = require('lodash');

const AWSObject = require('./aws-object').AWSObject
const Policy = require('./policy').Policy;

/**
 * A super class to represent an AWS component. 
 * Some functions are to be implemented by sub classes.
 * @abstract
 */
class AWSComponent extends AWSObject {

  /**
   * Don't call this manually. Use creator function in {@link CloudFormation}
   * @param {string} stackName 
   * @param {string} baseName 
   */
  constructor(stackName, baseName) {
    super(stackName, baseName)
    this.policyStatements = []
    this.assumeRolePolicyDocument = null

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
      'ID': { "Ref": this.fullName },
      'ARN': {
        "Fn::GetAtt": [
          this.fullName,
          "Arn"
        ]
      }
    }
  }

  /**
   * Get stack value of this component, variables can be: 
   * ARN, ID, PROVIDERNAME, etc
   * If this component is deployed and checked, the actual value will be provided.
   * Otherwise, AWS CloudFormation intrinsic specs will be returned, such as {"Ref": <logicName>}
   * 
   * @param {String} key ARN | ID | PROVIDERNAME
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
      "Value": { "Ref": this.fullName },
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
    const theRole = this.defaultRole;
    return theRole ? theRole.fullName : null;
  }

  getDefaultRole() {
    console.warn('Deprecated. Use .defaultRole() instead');
    return this.defaultRole;
  }

  get defaultRole() {
    if (!_.isEmpty(this.policyStatements) && this.assumeRolePolicyDocument) {
      const Role = require('./role').Role;
      let role = new Role(this.stackName, this.fullName)
      role.policyStatements = this.policyStatements
      if (this.assumeRolePolicyDocument) {
        role.assumeRolePolicyDocument = this.assumeRolePolicyDocument
      }
      return role
    }
    else {
      return null;
    }
  }

  /**
   * Get the policy statement object for the given access levels
   * @returns {object} policy statement JSON
   * @param {array} accessLevels array with string element which possible values are: ACCESS_LEVEL_READ | ACCESS_LEVEL_WRITE | ACCESS_LEVEL_ADMIN
   * @param {string} item optional
   */
  policyStatementForAccess(accessLevels, item) {
    accessLevels.forEach((accessLevel) => {
      assert.ok([AWSComponent.ACCESS_LEVEL_READ,
        AWSComponent.ACCESS_LEVEL_WRITE,
        AWSComponent.ACCESS_LEVEL_ADMIN
      ].indexOf(accessLevel) >= 0, `Invalid access level: ${accessLevel}`)
    })

    return this.policyStatementForAccessImpl(accessLevels, item)
  }

  /**
   * Get the policy statement object for the given access levels. Should be implemented by sub classes.
   * @abstract
   * @param {array} accessLevels array with string element which possible values are: ACCESS_LEVEL_READ | ACCESS_LEVEL_WRITE | ACCESS_LEVEL_ADMIN
   * @param {string} item optional
   */
  policyStatementForAccessImpl(accessLevels, item) {
    throw new Error('This function must be overriden in sub classes')
  }
}

//Static fields
AWSComponent.ACCESS_LEVEL_READ = 'ACCESS_LEVEL_READ'
AWSComponent.ACCESS_LEVEL_WRITE = 'ACCESS_LEVEL_WRITE'
AWSComponent.ACCESS_LEVEL_ADMIN = 'ACCESS_LEVEL_ADMIN'

exports.AWSComponent = AWSComponent
