const assert = require('assert')
const AWSComponent = require('./aws-component').AWSComponent
const AWSObject = require('./aws-object').AWSObject
const Policy = require('./policy').Policy
const cst = require('./constants')
const _ = require('lodash')


/* all:

dynamodb:BatchGetItem
dynamodb:BatchWriteItem
dynamodb:CreateTable
dynamodb:DeleteItem
dynamodb:DeleteTable
dynamodb:DescribeLimits
dynamodb:DescribeReservedCapacity
dynamodb:DescribeReservedCapacityOfferings
dynamodb:DescribeStream
dynamodb:DescribeTable
dynamodb:GetItem
dynamodb:GetRecords
dynamodb:GetShardIterator
dynamodb:ListStreams
dynamodb:ListTables
dynamodb:ListTagsOfResource
dynamodb:PurchaseReservedCapacityOfferings
dynamodb:PutItem
dynamodb:Query
dynamodb:Scan
dynamodb:TagResource
dynamodb:UpdateItem
dynamodb:UpdateTable
dynamodb:UntagResource

*/


class DynamoDbTable extends AWSComponent {

  constructor(
    stackName,
    baseName) {
    super(stackName, baseName)
    this.properties = {
      "TableName": this.tableName()
    }
  }

  tableName() {
    return `${this.stackName}_${this.baseName}`
  }

  /*
   * Notice: TableName is fixed, anything provided outside will be overwritten
   */
  setProperties(properties) {
    let copied = _.clone(properties)
    copied['TableName'] = this.tableName()


    //Default throughput values
    copied['ProvisionedThroughput'] = copied['ProvisionedThroughput'] || {
      ReadCapacityUnits: 2,
      WriteCapacityUnits: 2
    }

    this.properties = copied
  }

  policyStatementForAccessImpl(accessLevels, item) {
    //Item is ignored, because there is only one thing to offer 

    let actionsTable = {}
    actionsTable[AWSComponent.ACCESS_LEVEL_READ] = [
      'dynamodb:BatchGetItem',
      'dynamodb:DescribeLimits',
      'dynamodb:DescribeReservedCapacity',
      'dynamodb:DescribeReservedCapacityOfferings',
      "dynamodb:DescribeStream",
      "dynamodb:DescribeTable",
      "dynamodb:GetItem",
      "dynamodb:GetRecords",
      "dynamodb:GetShardIterator",
      "dynamodb:ListStreams",
      "dynamodb:ListTables",
      "dynamodb:ListTagsOfResource",
      "dynamodb:Query",
      "dynamodb:Scan",
    ]
    
    actionsTable[AWSComponent.ACCESS_LEVEL_WRITE] = [
      'dynamodb:BatchWriteItem',
      'dynamodb:DeleteItem',
      "dynamodb:PutItem",
      "dynamodb:TagResource",
      "dynamodb:UpdateItem",
      "dynamodb:UpdateTable",
      "dynamodb:UntagResource"
    ]
    
    actionsTable[AWSComponent.ACCESS_LEVEL_ADMIN] = [
      'dynamodb:CreateTable',
      'dynamodb:DeleteTable',
      "dynamodb:PurchaseReservedCapacityOfferings",
    ]

    let allowedActions = []
    accessLevels.forEach((level)=>{
      let actions = actionsTable[level]
      allowedActions = allowedActions.concat(actions)
    })

    return {
      "Effect": "Allow",
      "Action": allowedActions.sort(),
      "Resource": [
        this.getValue('ARN'),
        {
          "Fn::Join": ["", 
          [this.getValue('ARN'), "/index/*"]] 
        } //Also allow all indexes 
      ]
    }
  }

  get template() {
    let template = {}
    template[this.fullName] =  {
      "Type" : "AWS::DynamoDB::Table",
      "Properties" : this.properties
    }
    return template
  }
}

exports.DynamoDbTable = DynamoDbTable