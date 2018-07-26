const assert = require('assert')
let _ = require('lodash')
let log = require('winston')

/**
 * The following table lists items can not be deleted during a stack change. 
 */
const forbiddenChangesTable = [
  {
    "ResourceChange": {
      "Action": "Remove",
      "ResourceType": "AWS::DynamoDB::Table"
    }
  },
  //AWS::S3::Bucket
  {
    "ResourceChange": {
      "Action": "Remove",
      "ResourceType": "AWS::S3::Bucket"
    }
  },

  //AWS::Cognito::UserPool
  {
    "ResourceChange": {
      "Action": "Remove",
      "ResourceType": "AWS::Cognito::UserPool"
    }
  },
]

class StackChangeSet {

  constructor(changeSetResultJSON) {
    assert.ok(changeSetResultJSON)
    this._changeSetResultJSON = changeSetResultJSON
  }

  get changeSetResultJSON() {
    return this._changeSetResultJSON
  }

  get name(){
    return this.changeSetResultJSON.ChangeSetName
  }

  get changes() {
    return this.changeSetResultJSON.Changes
  }

  /**
   * Get changes that are not allowed; otherwise return null
   */
  get forbiddenChanges () {
    let cantTouches = []
    const changes = this.changes
    for (let change of changes) {
      for (let forbiddenChange of forbiddenChangesTable) {
        let forbiddenMatch = _.isMatch(change, forbiddenChange)
        if (forbiddenMatch) {
          cantTouches.push(change)
        }
      }
    }
    return cantTouches
  }
}

StackChangeSet.FORBIDDEN_CHANGES = forbiddenChangesTable

exports.StackChangeSet = StackChangeSet