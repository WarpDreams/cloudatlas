const assert = require('assert');

const { AWSComponent } = require('./aws-component');
const { Policy } = require('./policy');
const { Role } = require('./role');

const _ = require('lodash')

/**
 * This represents a generic AWS component. 
 * Use this one if you can't find fine-tailored version ({@link Lambda}, etc) in Cloudatlas library.
 * */
class GenericComponent extends AWSComponent {
  constructor(stackName, baseName) {
    super(stackName, baseName)
    this._properties = {};
    this._type = {}; 
  }

  /**
   * Set the "Type" field in AWS CloudFormation component spec
   * @param {string} typeString the Type ie "WS::ApiGateway::RestApi"
   */
  set type(typeString) {
    assert.equal(typeof typeString, 'string');
    this._type = typeString;
  }

  get type() {
    return this._type;
  }
  /**
   * Set the "Properties" field in AWS CloudFormation component spec
   * @param {object} p 
   */
  set properties(p) {
    assert.equal((typeof p), 'object');
    this._properties = p;
  }

  get properties() {
    return this._properties;
  }

  get template() {
    let template = {};
    
    template[this.fullName] = {
      "Type": this.type,
      "Properties": this.properties
    }
    
    const role = this.defaultRole; 
    if (role) {
      template = _.merge(template, role.template);
      template[this.fullName]['Properties']['Role'] = role.getValue('ARN');
    }
    
    return template;
  }
}


module.exports = {
  GenericComponent
}
