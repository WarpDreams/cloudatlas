const assert = require('assert')
const AWSComponent = require('./aws-component').AWSComponent
const CognitoUserPool = require('./cognito-user-pool').CognitoUserPool
const AWSObject = require('./aws-object').AWSObject
const Policy = require('./policy').Policy
const Role = require('./role').Role

const _ = require('lodash')

class CognitoUserPoolAppClient extends AWSComponent {

  constructor(stackName, baseName, userPool) {
    super(stackName, baseName)
    this._userPool = userPool
    this._tokenValidDays = 30
    this._writeAttributes = ['email']
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

  set userPool(newUserPool) {
    this._userPool = newUserPool
  }

  get userPool() {
    return this._userPool
  }

  set tokenValidDays(newTokenValidDays) {
    this._tokenValidDays = newTokenValidDays
  }

  get tokenValidDays() {
    return this._tokenValidDays
  }

  get appClientID() {
    return {Ref: this.fullName}
  }
  
  get writeAttributes() {
    return this._writeAttributes
  }
  
  set writeAttributes(newWriteAttributes) {
    this._writeAttributes = _.clone(newWriteAttributes);
    if (this._writeAttributes.indexOf('email') < 0) {
      this._writeAttributes.push('email');
    }
  }

  get template() {
    let template = {}
     template[this.fullName] = {
      "Type" : "AWS::Cognito::UserPoolClient",
      "Properties" : {
        'UserPoolId': {Ref: this.userPool.fullName},
        'ClientName': this.fullName,
        'GenerateSecret': false,
        'RefreshTokenValidity': this.tokenValidDays,
        'WriteAttributes': this.writeAttributes
      }
    }
    return template
  }
}

CognitoUserPoolAppClient.DEFAULT_APP_CLIENT_NAME = 'DefaultClient'
exports.CognitoUserPoolAppClient = CognitoUserPoolAppClient