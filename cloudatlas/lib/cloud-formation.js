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
const { GenericComponent } = require('./generic-component');

const S3 = require('./s3').S3

const _ = require('lodash')


const AWSComponent = require('./aws-component').AWSComponent
const log = require('winston')

/**
 * This class represents an AWS CloudFormation stack.
 * All AWS components are created from the instance of this class.
 */
class CloudFormation extends AWSComponent {

  /**
   * Create a new CloudFormation stack
   * @param stackName {string} the basic name of the stack. The name should be sinple PascalCase string, without environment variations such as "dev"
   */
  constructor(stackName) {
      super(stackName, 'NA')
      this.components = []
      this._status = 'UNSULLIED'
      this._outputs = null
      this._persistComponentProtection = true
  }

  /**
   * Create a Role object (AWS::IAM::Role)
   * @param {string} roleName 
   * @returns {Role}
   */
  createRole(roleName) {
    let role = new Role(this.stackName, roleName)
    return this.addComponent(role);
  }

  /**
   * Create a Lambda object (AWS::Lambda::Function)
   * @param {string} lambdaName 
   * @returns {Lambda}
   */
  createLambda(lambdaName) {
    let lambda = new Lambda(this.stackName, lambdaName)
    return this.addComponent(lambda);
  }

  /**
   * Create a Policy object (AWS::IAM::Policy)
   * @param {string} baseName 
   * @returns {Policy}
   */
  createPolicy(baseName) {
    let policy = new Policy(this.stackName, baseName)
    return this.addComponent(policy);
  }

  /**
   * Create a API Gateway object
   * @param {string} baseName 
   * @returns {ApiGateway}
   */
  createApiGateway(baseName) {
    let gateway = new ApiGateway(this.stackName, baseName)
    return this.addComponent(gateway);
  }

  /**
   * Create a DynamoDB table
   * @param {string} baseName 
   * @returns {DynamoDbTable}
   */
  createDynamoDbTable(baseName) {
    let table = new DynamoDbTable(this.stackName, baseName)
    return this.addComponent(table);
  }

  /**
   * Create Cognito User Pool
   * @param {string} baseName
   * @returns {CognitioUserPool} 
   */
  createCognitoUserPool(baseName) {
    let pool = new CognitoUserPool(this.stackName, baseName)
    return this.addComponent(pool);
  }

  /**
   * Create a Coginito User Pool app client. Must have a CognitoUserPool instance.
   * @param {string} baseName 
   * @param {CognitoUserPool} userPool 
   * @returns {CognitoUserPoolAppClient}
   */
  createCognitoUserPoolAppClient(baseName, userPool) {
    assert.ok(userPool instanceof CognitoUserPool)
    let client = new CognitoUserPoolAppClient(this.stackName, baseName, userPool)
    return this.addComponent(client);
  }

  /**
   * Create a Cognito Identity pool object
   * @param {string} baseName 
   * @returns {CognitoIdentityPool}
   */
  createCognitoIdentityPool(baseName) {
    let pool = new CognitoIdentityPool(this.stackName, baseName)
    return this.addComponent(pool);
  }

  /**
   * Create a new user in the user pool. 
   * @param {string} baseName 
   * @param {CognitoUserPool} userPool 
   * @returns {CognitoBuiltinUser}
   */
  createCognitoBuiltinUser(baseName, userPool) {
    assert.ok(userPool instanceof CognitoUserPool)
    let user = new CognitoBuiltinUser(this.stackName, baseName, userPool)
    return this.addComponent(user);
  }

  /**
   * Create a Cognito user group.
   * @param {string} baseName 
   * @param {CognitioUserPool} userPool 
   * @returns {CognitoUserGroup}
   */
  createCognitoUserGroup(baseName, userPool) {
    assert.ok(userPool instanceof CognitoUserPool)
    let userGroup = new CognitoUserGroup(this.stackName, baseName, userPool)
    return this.addComponent(userGroup);
  }

  /**
   * Create a S3 bucket
   * @param {string} baseName 
   * @returns {S3}
   */
  createS3Bucket(baseName) {
    let bucket = new S3(this.stackName,baseName)
    return this.addComponent(bucket);
  }
  
  /**
   * Create a generic AWS component. Use this if the AWS component you want to use 
   * is not yet directly supported by Cloudatlas.
   * @param {string} baseName 
   * @returns {GenericComponent}
   */
  createGenericComponent(baseName) {
    let gc = new GenericComponent(this.stackName, baseName);
    return this.addComponent(gc);
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

  /**
   * Switch on/off persist component protection. If on and if there are data-lose changes on 
   * data-persist components such as S3, Cognito user pool, DynamoDB, an error will be thrown. 
   * @param {bool} protection true or false to switch component protection on/off
   */
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
      'AWSTemplateFormatVersion': '2010-09-09',
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