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
    this._autoScalingRole = null;
    this._scalingItems = null;

    this.autoScaleInSecs = 30;
    this.autoScaleOutSecs = 30;

    this._scalingMinCapacity = 0;
    this._scalingMaxCapacity = 0;

  }

  get tableName() {
    return `${this.stackName}_${this.baseName}`;
  }

  _updateAutoScalingItems() {

    // For detailed CloudFormation document: 
    // https://aws.amazon.com/blogs/database/how-to-use-aws-cloudformation-to-configure-auto-scaling-for-amazon-dynamodb-tables-and-indexes/

    if (this._scalingMaxCapacity <= 0 || this._scalingMinCapacity <= 0) {
      this._autoScalingRole = null;
      this._scalingItems = null;
    }
    else {
      this._autoScalingRole = new Role(this.stackName, this.baseName + 'AutoScaling');
      this._autoScalingRole.policyStatements = [{
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

      this._autoScalingRole.assumeRolePolicyDocument = {
        "Version": "2012-10-17",
        "Statement": [{
          "Effect": "Allow",
          "Principal": {
            "Service": [
              "application-autoscaling.amazonaws.com"
            ]
          },
          "Action": [
            "sts:AssumeRole"
          ]
        }]
      }

      //Setup ScalableTarget object for this table and all GSI
      this._scalingItems = {};
      //For the table itself
      const readAndWrite = ['Read', 'Write'];
      for (let rw of readAndWrite) {
        const tableScalableTarget = `${this.fullName}${rw}ScalableTarget`;
        const autoScaleRoleARN = {
          "Fn::GetAtt": [
            this._autoScalingRole.fullName,
            "Arn"
          ]
        };
        this._scalingItems[tableScalableTarget] = {
          "Type": "AWS::ApplicationAutoScaling::ScalableTarget",
          "Properties": {
            "MaxCapacity": this._scalingMaxCapacity,
            "MinCapacity": this._scalingMinCapacity,
            "ResourceId": `table/${this.tableName}`,
            "RoleARN": autoScaleRoleARN,
            "ScalableDimension": `dynamodb:table:${rw}CapacityUnits`,
            "ServiceNamespace": "dynamodb"
          }
        }

        const tableScalingPolicy = `${this.fullName}${rw}ScalingPolicy`;

        this._scalingItems[tableScalingPolicy] = {
          "Type": "AWS::ApplicationAutoScaling::ScalingPolicy",
          "Properties": {
            "PolicyName": tableScalingPolicy,
            "PolicyType": "TargetTrackingScaling",
            "ScalingTargetId": {
              "Ref": tableScalableTarget
            },
            "TargetTrackingScalingPolicyConfiguration": {
              "TargetValue": 70,
              "ScaleInCooldown": this.autoScaleInSecs,
              "ScaleOutCooldown": this.autoScaleOutSecs,
              "PredefinedMetricSpecification": {
                "PredefinedMetricType": `DynamoDB${rw}CapacityUtilization`
              }
            }
          }
        }

        if (this.properties['GlobalSecondaryIndexes']) {
          for (let gsi of this.properties['GlobalSecondaryIndexes']) {
            const indexName = gsi['IndexName'];
            const indexScalableTarget = `${indexName}${rw}ScalableTarget`;
            this._scalingItems[indexScalableTarget] = {
              "Type": "AWS::ApplicationAutoScaling::ScalableTarget",
              "Properties": {
                "MaxCapacity": this._scalingMaxCapacity,
                "MinCapacity": this._scalingMinCapacity,
                "ResourceId": `table/${this.tableName}/index/${indexName}`,
                "RoleARN": autoScaleRoleARN,
                "ScalableDimension": `dynamodb:table:${rw}CapacityUnits`,
                "ServiceNamespace": "dynamodb"
              }
            }
          } // for gsi of
        } //if
      }
    }
  }

  /**
   * Set the auto scaling for the table or its index. 
   * If max <= 0, it means switching the auto scaling off. 
   * 
   * @params target optional, to set which one (table or GSI) the auto scaling applies. Notice: does not support this parameter for now.
   */
  setAutoScaling(minCapacity, maxCapacity, target) {

    // For detailed CloudFormation document: 
    // https://aws.amazon.com/blogs/database/how-to-use-aws-cloudformation-to-configure-auto-scaling-for-amazon-dynamodb-tables-and-indexes/
    assert.ok(!target, `Specified auto scaling target '${target}' which is not supported at the moment. auto scaling capacity will apply on the table and all GSIs`);
    assert.ok(minCapacity <= maxCapacity);
    assert.ok(minCapacity > 0);
    assert.ok(maxCapacity > 0);

    this._scalingMinCapacity = minCapacity;
    this._scalingMaxCapacity = maxCapacity;
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
    
    this._updateAutoScalingItems();

    if (this._autoScalingRole && this._scalingItems) {
      template = _.merge(template, this._scalingItems);
      template = _.merge(template, this._autoScalingRole.template);
    }
    return template
  }
}

exports.DynamoDbTable = DynamoDbTable
