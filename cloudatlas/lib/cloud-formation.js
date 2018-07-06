const assert = require('assert');
const { Role } = require('./role');
const { Lambda } = require('./lambda');
const { ApiGateway } = require('./api-gateway');
const { DynamoDbTable } = require('./dynamodb-table');
const { Policy } = require('./policy');
const { CognitoUserPool } = require('./cognito-user-pool');
const { CognitoUserGroup } = require('./cognito-user-group');
const { CognitoBuiltinUser } = require('./cognito-builtin-user');
const { CognitoIdentityPool } = require('./cognito-identity-pool');
const { CognitoUserPoolAppClient } = require('./cognito-user-pool-app-client');

const S3 = require('./s3').S3

const _ = require('lodash')
const cst = require('./constants')

const AWSComponent = require('./aws-component').AWSComponent
const log = require('winston')

class CloudFormation extends AWSComponent {

  constructor(stackName) {
      super(stackName, 'NA')
      this.components = []
      this._status = 'UNSULLIED'
      this._outputs = null
      this._persistComponentProtection = true
  }

  //Bunch of creation functions
  createRole(roleName) {
    let role = new Role(this.stackName, roleName)
    return this.addComponent(role);
  }

  createLambda(lambdaName) {
    let lambda = new Lambda(this.stackName, lambdaName)
    return this.addComponent(lambda);
  }

  createPolicy(baseName) {
    let policy = new Policy(this.stackName, baseName)
    return this.addComponent(policy);
  }

  createApiGateway(baseName) {
    let gateway = new ApiGateway(this.stackName, baseName)
    return this.addComponent(gateway);
  }

  createDynamoDbTable(baseName) {
    let table = new DynamoDbTable(this.stackName, baseName)
    return this.addComponent(table);
  }

  createCognitoUserPool(baseName) {
    let pool = new CognitoUserPool(this.stackName, baseName)
    return this.addComponent(pool);
  }

  createCognitoUserPoolAppClient(baseName, userPool) {
    assert.ok(userPool instanceof CognitoUserPool)
    let client = new CognitoUserPoolAppClient(this.stackName, baseName, userPool)
    return this.addComponent(client);
  }

  createCognitoIdentityPool(baseName) {
    let pool = new CognitoIdentityPool(this.stackName, baseName)
    return this.addComponent(pool);
  }

  createCognitoBuiltinUser(baseName, userPool) {
    assert.ok(userPool instanceof CognitoUserPool)
    let user = new CognitoBuiltinUser(this.stackName, baseName, userPool)
    return this.addComponent(user);
  }

  createCognitoUserGroup(baseName, userPool) {
    assert.ok(userPool instanceof CognitoUserPool)
    let userGroup = new CognitoUserGroup(this.stackName, baseName, userPool)
    return this.addComponent(userGroup);
  }

  createS3Bucket(basename) {
    let bucket = new S3(this.stackName,basename)
    return this.addComponent(bucket);
  }

  ////// end creation fuctions.

  addComponent(component) {
    assert.equal(component.stackName, this.stackName);
    //Check if this component already exists
    const sameNameComponent = _.find(this.components, (c)=>{
      return c.fullName == component.fullName;
    });

    if (sameNameComponent) {
      throw new Error(`Can not create/add component: the AWS component with the same name '${sameNameComponent.baseName}' already exists`);
    }

    this.components.push(component);
    return component;
  }

  get persistComponentProtection() {
    return this._persistComponentProtection;
  }

  set persistComponentProtection(protection) {
    this._persistComponentProtection = protection;
  }

  get outputs() {
    return this._outputs
  }

  set outputs(cloudFormationOutputData) {

    this._outputs = cloudFormationOutputData

    log.debug('Received cross stack output data: ', JSON.stringify(cloudFormationOutputData, null, 2));

    //Do some key/Value matching
    _.each(this.components, (component) => {
      const outputKeys = component.outputVariableKeys

      _.each(outputKeys, (key)=>{
        let matchingItem = _.find(cloudFormationOutputData, (data)=>{
          return data['OutputKey'] == key
        })
        if (matchingItem) {
          const matchingValue = matchingItem['OutputValue']
          const cleanKey = key.replace(`${component.stackName}${component.fullName}`, '')

          component.setCrossStackValue(cleanKey, matchingValue)
          component[cleanKey] = matchingValue
        }
      })

      log.debug(`Setting ${component.fullName}, crossStackValues = ${JSON.stringify(component.crossStackValues, null, 2)}`)

    })

    //Update values
    _.each(cloudFormationOutputData, (valueItem)=>{
      let key = valueItem['OutputKey']
      let value = valueItem['OutputValue']
    })
  }

  set status(newStatus) {
    this._status = newStatus
  }

  get status() {
    return this._status
  }

  get template() {

    let resources = {}
    let outputs = {}
    
    _.each(this.components, (c)=>{
      let template = c.template

      _.each(template, (item, name)=>{
        assert.ok(item['Type'], `Invalid template for item ${name}, 'Type' is missing`)
      })

      let output = c.outputSpecs

      //log.debug('OutputSpecs: ' + JSON.stringify(output, null, 2))

      resources = _.extend(resources, template)
      outputs = _.extend(outputs, output)
    })

    const finalTemplate = {
      'AWSTemplateFormatVersion': cst.AWSTemplateFormatVersion,
      'Resources': resources,
      'Outputs': outputs
    }

    return finalTemplate
  }

  /**
   * Get the component with specified class and base name
   */
  getComponent(klass, baseName) {
    const component = _.find(this.components, (c) => {
      return (c instanceof klass) && c.baseName == baseName;
    })
    return component;
  }
}

exports.CloudFormation = CloudFormation