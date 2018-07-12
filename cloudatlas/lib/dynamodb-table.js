const assert = require('assert');

const { AWSComponent } = require('./aws-component');
const { AWSObject } = require('./aws-object');
const { Policy } = require('./policy');
const { Role } = require('./role');

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
      "TableName": this.tableName
    }
    this.autoScalingRole = null;
    this.scalingTargets = null;
  }

  get tableName() {
    return `${this.stackName}_${this.baseName}`;
  }

  /**
   * Set the auto scaling for the table or its index. 
   * If max <= 0, it means switching the auto scaling off
   * @params target optional, to set which one (table or GSI) the auto scaling applies. Notice: does not support this parameter for now.
   */
  setAutoScaling(minCapacity, maxCapacity, target) {

    assert.ok(!target, `Specified auto scaling target '${target}' which is not supported at the moment. auto scaling capacity will apply on the table and all GSIs`);

    assert.ok(minCapacity <= maxCapacity);
    if (maxCapacity <= 0) {
      this.autoScalingRole = null;
      this.scalingTargets = null;
    }
    else {
      this.autoScalingRole = new Role(this.stackName, this.baseName + 'AutoScaling');
      this.autoScalingRole.policyStatements = [{
        "Effect": "Allow",
        "Action": [
          "dynamodb:DescribeTable",
          "dynamodb:UpdateTable",
          "cloudwatch:PutMetricAlarm",
          "cloudwatch:DescribeAlarms",
          "cloudwatch:GetMetricStatistics",
          "cloudwatch:SetAlarmState",
          "cloudwatch:DeleteAlarms"
        ],
        "Resource": [
          this.getValue('ARN'),
          {
            "Fn::Join": ["", [this.getValue('ARN'), "/index/*"]]
          } //Also allow all indexes 
        ]
      }]

      //Setup ScalableTarget object for this table 
      this.scalingTargets = {};
      //For the table itself
      const readAndWrite = ['Read', 'Write'];
      for (let rw of readAndWrite) {
        const tableScalableTargetRead = `${this.fullName}_${rw}_ScalableTarget`;
        this.scalingTargets[tableScalableTargetRead] = {
          "Type": "AWS::ApplicationAutoScaling::ScalableTarget",
          "Properties": {
            "MaxCapacity": maxCapacity,
            "MinCapacity": minCapacity,
            "ResourceId": `table/${this.tableName}`,
            "RoleARN": {
              "Fn::GetAtt": [
                this.autoScalingRole.fullName,
                "Arn"
              ]
            },
            "ScalableDimension": `dynamodb:table:${rw}CapacityUnits`,
            "ServiceNamespace": "dynamodb"
          }
        }
      }

      //TODO: Do it for GSI as well.
    }
  }

  /*
   * Notice: TableName is fixed, anything provided outside will be overwritten
   */
  setProperties(properties) {
    let copied = _.clone(properties)
    copied['TableName'] = this.tableName


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
    accessLevels.forEach((level) => {
      let actions = actionsTable[level]
      allowedActions = allowedActions.concat(actions)
    })

    return {
      "Effect": "Allow",
      "Action": allowedActions.sort(),
      "Resource": [
        this.getValue('ARN'),
        {
          "Fn::Join": ["", [this.getValue('ARN'), "/index/*"]]
        } //Also allow all indexes 
      ]
    }
  }

  get template() {
    let template = {}
    template[this.fullName] = {
      "Type": "AWS::DynamoDB::Table",
      "Properties": this.properties
    }

    if (this.autoScalingRole && this.scalingTargets) {
      template = _.merge(template, this.autoScalingRole.template);
      template = _.merge(template, this.scalingTargets);
    }

    return template
  }
}

exports.DynamoDbTable = DynamoDbTable
