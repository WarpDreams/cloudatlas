const assert = require('assert');
const { AWSComponent } = require('./aws-component');
const { AWSObject } = require('./aws-object');
const { Policy } = require('./policy');
const { Role } = require('./role');

const _ = require('lodash')


class DynamoDbScalingRole extends Role {
  constructor(
    stackName,
    baseName) {
    super(stackName, baseName);

    this.policyStatements = [{
      "Effect": "Allow",
      "Action": ["dynamodb:DescribeTable",
        "dynamodb:UpdateTable",
        "cloudwatch:PutMetricAlarm",
        "cloudwatch:DescribeAlarms",
        "cloudwatch:GetMetricStatistics",
        "cloudwatch:SetAlarmState",
        "cloudwatch:DeleteAlarms"
      ],
      "Resource": {
        "Fn::Join": [
          "", ['arn:aws:logs:', { "Ref": "AWS::Region" }, ":", { "Ref": "AWS::AccountId" }, ":*"]
        ]
      }
    }];
  }
}

module.exports = {
  DynamoDbScalingRole
}
