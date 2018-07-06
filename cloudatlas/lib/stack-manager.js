const assert = require('assert')
let _ = require('lodash')
let log = require('winston');
let AWS = require("aws-sdk");
const path = require('path');

const Role = require('./role').Role
const CloudFormation = require('./cloud-formation').CloudFormation
const Lambda = require('./lambda').Lambda
const ApiGateway = require('./api-gateway').ApiGateway
const DynamoDbTable = require('./dynamodb-table').DynamoDbTable
const Policy = require('./policy').Policy
const CognitoUserPool = require('./cognito-user-pool').CognitoUserPool
const CognitoIdentityPool = require('./cognito-identity-pool').CognitoIdentityPool
const StackChangeSet = require('./stack-change-set').StackChangeSet


//Private functions 
function isComplete(StackStatus) {

  //log.debug('StackStatus: ', StackStatus)

  switch (StackStatus) {
    case 'CREATE_COMPLETE':
    case 'DELETE_COMPLETE':
    case 'ROLLBACK_COMPLETE':
    case 'UPDATE_COMPLETE':
    case 'UPDATE_ROLLBACK_COMPLETE':
      return true

    case 'CREATE_FAILED':
    case 'DELETE_FAILED':
    case 'ROLLBACK_FAILED':
    case 'UPDATE_ROLLBACK_FAILED':
    case 'FAILED':
      throw new Error(`Stack or ChangeSet failed, status=${StackStatus}`)

    case 'CREATE_IN_PROGRESS':
    case 'DELETE_IN_PROGRESS':
    case 'ROLLBACK_IN_PROGRESS':
    case 'UPDATE_COMPLETE_CLEANUP_IN_PROGRESS':
    case 'UPDATE_IN_PROGRESS':
    case 'UPDATE_ROLLBACK_COMPLETE_CLEANUP_IN_PROGRESS':
    case 'UPDATE_ROLLBACK_IN_PROGRESS':
    default:
      return false
  }
}

//Old fasioned callback
function waitForChangeSetCompleteStatus(cloudFormationObj, changeSetName, callback) {
  let cloudformation = new AWS.CloudFormation()
  cloudformation.describeChangeSet(
    {
      ChangeSetName: changeSetName,
      StackName: cloudFormationObj.stackName
    }, (error, data) => {
      if (error) {
        callback(error, null)
      }
      else {
        const setInfo = data
        const status = setInfo.Status
        const statusReason = setInfo.StatusReason
        let completed = false
        //"StatusReason": "The submitted information didn't contain changes. Submit different information to create a change set."
        log.silly('Received change set info: ' + JSON.stringify(setInfo, null, 2))

        if (statusReason == "The submitted information didn't contain changes. Submit different information to create a change set.") {
          log.info('Change set creation failed because there is no changes. ')
          completed = true          
        }
        else {
          completed = isComplete(status)
        }

        if (completed) {
          //All OK
          callback(null, setInfo)
        }
        else {
          //Not completed
          log.debug(`Continue to wait for stack ${changeSetName} because current status is: ${status}`)
          setTimeout(() => {
            waitForChangeSetCompleteStatus(cloudFormationObj, changeSetName, callback)
          }, 2000)
        }
      }
    })
}

//Old fashioned callback based 
function waitForStackCompleteStatus(cloudFormationObj, callback) {
  let cloudformation = new AWS.CloudFormation()
  cloudformation.describeStacks({ StackName: cloudFormationObj.stackName }, (error, data) => {
    if (error) {
      callback(null, error)
    }
    else {
      const existingStackInfo = data.Stacks[0]
      const status = existingStackInfo.StackStatus
      const completed = isComplete(status)

      cloudFormationObj.status = status

      if (completed) {
        cloudFormationObj.outputs = existingStackInfo.Outputs
        //All OK
        callback(null, cloudFormationObj)
      }
      else {
        //Not completed
        log.info(`Continue to wait for stack ${cloudFormationObj.stackName} because current status is: ${cloudFormationObj.status}`)
        setTimeout(() => {
          waitForStackCompleteStatus(cloudFormationObj, callback)
        }, 2000)
      }
    }
  })
}

class StackManager {

  constructor() { }
  
  set awsOptions(options) {
    assert.ok(options.region, 'region not found in AWS options')
    AWS.config.update(options)
  }

  set temporaryFolder(temporaryFolder) {
    this._temporaryFolder = temporaryFolder;
  }

  get temporaryFolder() {
    return this._temporaryFolder;
  }

  writeTemplateFile(cloudFormationObj) {
    let template = cloudFormationObj.template
    const stringTemplate = JSON.stringify(template, null, 2);

    const fileName = cloudFormationObj.stackName + '.template.json';
    const fullPath = path.join(this.temporaryFolder || '.cloudatlas', fileName);
    //Write to file, for debug purpose
    require('fs').writeFileSync(fullPath, stringTemplate)
    const minified = JSON.stringify(template); //Compress to minimum to avoid AWS stack file size limit error
    const bytes = Buffer.byteLength(minified, 'utf8');
    log.info('Generated cloud formation template JSON, size = ' + bytes + ' bytes');
    return minified;
  }

  /**
   * A promise to get the stack info and put into cloudFormationObj.
   * Will resolve with updated cloudFormationObj if stack is there.
   * Otherwise will resolve with null if the stack does not exist. 
   * @param {*} cloudFormationObj 
   */
  describeStack(cloudFormationObj) {
    let cloudformation = new AWS.CloudFormation()
    return cloudformation.describeStacks({}).promise().then((data) => {

      let existingStackInfo = null

      existingStackInfo = _.find(data.Stacks, (s) => {
        return s.StackName == cloudFormationObj.stackName
      })

      if (!existingStackInfo) {
        return Promise.resolve(null)
      }
      else {
        assert.ok(existingStackInfo, 'Inconsistency: detected no updates but does not get existing stack information')
        cloudFormationObj.status = existingStackInfo.StackStatus
        cloudFormationObj.outputs = existingStackInfo.Outputs
        return Promise.resolve(cloudFormationObj)
      }
    })
  }

  /**
   * Determines if cloud formation has any changes
   * @param {*} cloudFormationObj 
   */
  // hasChanges(cloudFormationObj) {
  //   let cloudformation = new AWS.CloudFormation()
  //   const params = {
  //     //StackName: cloudFormationObj.stackName,
  //     TemplateBody: JSON.stringify(cloudFormationObj.template)
  //   }
  //   return cloudformation.validateTemplate(params).promise().then((summary)=>{
  //     log.info('Template summary -------> ' + JSON.stringify(summary, null, 2))
  //     return Promise.resolve(false)
  //   })
  // }

  startUpsertStack(cloudFormationObj) {
    assert.ok(cloudFormationObj instanceof CloudFormation)

    let cloudformation = new AWS.CloudFormation();

    return this.describeStack(cloudFormationObj).then((describeResult) => {
      let stringTemplate = this.writeTemplateFile(cloudFormationObj)
      const options = {
        Capabilities: ['CAPABILITY_IAM'], //needed if deploying IAM Roles
        StackName: cloudFormationObj.stackName,
        TemplateBody: stringTemplate
      }
      if (!describeResult) {
        log.info(`Stack named ${cloudFormationObj.stackName} is not found, will create new`)
        return cloudformation.createStack(options).promise()
      }
      else {
        return this.makeSureContainsNoForbiddenChanges(cloudFormationObj).then(()=>{
          return cloudformation.updateStack(options).promise()
        })
      }
    })
      .then((data) => {
        //log.debug('Got stack update/creation info: ' + JSON.stringify(data, null, 2))
        return Promise.resolve(data)
      })
      .catch((exception) => {
        if (exception.message == 'No updates are to be performed.') {
          //this is an OK case.
          log.info(`Not changes found in stack ${cloudFormationObj.stackName}`)
          return Promise.resolve(cloudFormationObj)
        }
        else {
          return Promise.reject(exception)
        }
      })
  }

  createChangeSet(cloudFormationObj, changeSetName) {
    assert.ok(cloudFormationObj instanceof CloudFormation)
    let cloudformation = new AWS.CloudFormation()
    let stringTemplate = this.writeTemplateFile(cloudFormationObj)
    const options = {
      StackName: cloudFormationObj.stackName,
      ChangeSetName: changeSetName,
      TemplateBody: stringTemplate,
      Capabilities: ['CAPABILITY_IAM']
    }
    let promise = cloudformation.createChangeSet(options).promise()
    return promise.then((submitResult) => {
      log.debug(`Submitted create change set ${changeSetName}` + JSON.stringify(submitResult, null, 2))
      let waitParams = {
        ChangeSetName: changeSetName
      }
      log.info(`Waiting for change set ${changeSetName} complete...`)

      let promise = new Promise((resolve, reject) => {
        waitForChangeSetCompleteStatus(cloudFormationObj, changeSetName, (error, data) => {
          if (error) {
            reject(error)
          }
          else {
            resolve(new StackChangeSet(data))
          }
        })
      })

      return promise
    })
  }

  /**
   * A convienient method to check if the purposed changes are not forbidden. 
   * Will Promise reject with Error reason if can not.
   * Will Promise resolve with the change set object, or null if there is no changes at all
   */
  makeSureContainsNoForbiddenChanges(cloudFormationObj) {

    if (!cloudFormationObj.persistComponentProtection) {
      //requires no protection
      return Promise.resolve(0);
    }

    const theName = `${cloudFormationObj.stackName}ChangeSet`
    
    let forbiddenChanges = []
    
    let daStackChangeSet = null;

    return this.createChangeSet(cloudFormationObj, theName).then((stackChangeSet) => {
      log.silly('Change set is: ' + JSON.stringify(stackChangeSet.changeSetResultJSON, null, 2))
      daStackChangeSet = stackChangeSet;
      forbiddenChanges = stackChangeSet.forbiddenChanges
      return Promise.resolve(stackChangeSet)
    }).then((stackChangeSet)=>{
      //On any case, delete the stack change set because we don't need it 
      let cloudformation = new AWS.CloudFormation()
      return cloudformation.deleteChangeSet({ChangeSetName: theName, StackName: cloudFormationObj.stackName}).promise()
    }).then((deleteResult)=>{
      log.debug('ChangeSet deletion result: ' + JSON.stringify(deleteResult, null, 2))
      if (forbiddenChanges.length) {
        return Promise.reject(new Error(`Can not change stack because the change contains forbidden items: `
          + JSON.stringify(daStackChangeSet.forbiddenChanges, null, 2)))
      }
      else {
        return Promise.resolve(forbiddenChanges)
      }
    })
  }

  //real version
  waitUntilStackUpsertComplete(cloudFormationObj) {
    return new Promise((resolve, reject) => {
      waitForStackCompleteStatus(cloudFormationObj, (error, finishedCloudFormationObj) => {
        if (error) {
          reject(error)
        }
        else {
          resolve(finishedCloudFormationObj)
        }
      })
    })
  }
}

exports.StackManager = StackManager