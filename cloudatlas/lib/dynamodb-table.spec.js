const DynamoDbTable = require('./dynamodb-table').DynamoDbTable
const AWSComponent = require('./aws-component').AWSComponent
const { CloudFormation } = require('./cloud-formation');

const _ = require('lodash')
const assert = require('assert')

/* global expect */

describe('test dynamoDB', () => {
  let table = null
  beforeEach(() => {
    let stack = new CloudFormation('CloudAtlasTest')

    table = stack.createDynamoDbTable('unitTest')
    assert.ok(table)
  })

  test('Should get access statement correctly', () => {
    const statement = table.policyStatementForAccess([AWSComponent.ACCESS_LEVEL_ADMIN, AWSComponent.ACCESS_LEVEL_WRITE])
    expect(statement).toEqual({
      "Effect": "Allow",
      "Action": [
        'dynamodb:BatchWriteItem',
        'dynamodb:DeleteItem',
        "dynamodb:PutItem",
        "dynamodb:TagResource",
        "dynamodb:UpdateItem",
        "dynamodb:UpdateTable",
        "dynamodb:UntagResource",
        'dynamodb:CreateTable',
        'dynamodb:DeleteTable',
        "dynamodb:PurchaseReservedCapacityOfferings"
      ].sort(),
      "Resource": [{
          "Fn::GetAtt": [table.fullName, "Arn"]
        },
        //Also allow updates to the indecies
        {
          'Fn::Join': [
            '', [{
                'Fn::GetAtt': [
                  table.fullName,
                  'Arn'
                ]
              },
              '/index/*'
            ]
          ]
        }
      ]
    })
  })

  test('Should create dynamDB table auto scaling correctly for table', () => {
    const tableProperties = {
      TableName: "Scale", //This property is useless! 
      KeySchema: [
        { AttributeName: "year", KeyType: "HASH" }, //Partition key
        { AttributeName: "title", KeyType: "RANGE" } //Sort key
      ],
      AttributeDefinitions: [
        { AttributeName: "year", AttributeType: "N" },
        { AttributeName: "title", AttributeType: "S" }
      ],
      ProvisionedThroughput: {
        ReadCapacityUnits: 12,
        WriteCapacityUnits: 12
      }
    }

    table.setProperties(tableProperties)
    table.setAutoScaling(1, 911);

    table.autoScaleInSecs = 15;
    table.autoScaleOutSecs = 14;

    const template = table.template;

    //console.log('----- the template: ' + JSON.stringify(template, null, 2));

    //Read scaling item
    expect(template['unitTestDynamoDbTableReadScalableTarget']).toEqual({
      "Properties": {
        "MaxCapacity": 911,
        "MinCapacity": 1,
        "ResourceId": "table/CloudAtlasTest_unitTest",
        "RoleARN": {
          "Fn::GetAtt": [
            "unitTestAutoScalingRole",
            "Arn",
          ],
        },
        "ScalableDimension": "dynamodb:table:ReadCapacityUnits",
        "ServiceNamespace": "dynamodb",
      },
      "Type": "AWS::ApplicationAutoScaling::ScalableTarget",
    });

    //Write scaling item
    expect(template['unitTestDynamoDbTableWriteScalableTarget']).toEqual({
      "Properties": {
        "MaxCapacity": 911,
        "MinCapacity": 1,
        "ResourceId": "table/CloudAtlasTest_unitTest",
        "RoleARN": {
          "Fn::GetAtt": [
            "unitTestAutoScalingRole",
            "Arn",
          ],
        },
        "ScalableDimension": "dynamodb:table:WriteCapacityUnits",
        "ServiceNamespace": "dynamodb",
      },
      "Type": "AWS::ApplicationAutoScaling::ScalableTarget",
    });

    //Verity auto scaling role:
    expect(template['unitTestAutoScalingRole']).toEqual({
      "Type": "AWS::IAM::Role",
      "Properties": {
        "AssumeRolePolicyDocument": {
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
        },
        "Policies": [{
          "PolicyName": "unitTestAutoScalingRolePolicy",
          "PolicyDocument": {
            "Version": "2012-10-17",
            "Statement": [{
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
              "Resource": [{
                  "Fn::GetAtt": [
                    "unitTestDynamoDbTable",
                    "Arn"
                  ]
                },
                {
                  "Fn::Join": [
                    "", [{
                        "Fn::GetAtt": [
                          "unitTestDynamoDbTable",
                          "Arn"
                        ]
                      },
                      "/index/*"
                    ]
                  ]
                }
              ]
            }]
          }
        }],
        "Path": "/"
      }
    });

    expect(template['unitTestDynamoDbTableWriteScalingPolicy']).toEqual({
      "Type": "AWS::ApplicationAutoScaling::ScalingPolicy",
      "Properties": {
        "PolicyName": "unitTestDynamoDbTableWriteScalingPolicy",
        "PolicyType": "TargetTrackingScaling",
        "ScalingTargetId": {
          "Ref": "unitTestDynamoDbTableWriteScalableTarget"
        },
        "TargetTrackingScalingPolicyConfiguration": {
          "TargetValue": 70,
          "ScaleInCooldown": 15,
          "ScaleOutCooldown": 14,
          "PredefinedMetricSpecification": {
            "PredefinedMetricType": "DynamoDBWriteCapacityUtilization"
          }
        }
      }
    });
  })

  test('Should create dynamDB table auto scaling correctly for index', () => {
    const tableProperties = {
      TableName: "Scale", //This property is useless! 
      KeySchema: [
        { AttributeName: "year", KeyType: "HASH" }, //Partition key
        { AttributeName: "title", KeyType: "RANGE" } //Sort key
      ],
      AttributeDefinitions: [
        { AttributeName: "year", AttributeType: "N" },
        { AttributeName: "title", AttributeType: "S" },
        { AttributeName: "itemForGSI", AttributeType: "S" }
      ],
      ProvisionedThroughput: {
        ReadCapacityUnits: 12,
        WriteCapacityUnits: 12
      },

      GlobalSecondaryIndexes: [
        //Group index by groups
        {
          IndexName: 'ScaleIndex',
          KeySchema: [
            { AttributeName: "itemForGSI", KeyType: "HASH" }
          ],

          Projection: {
            ProjectionType: "ALL"
          },

          ProvisionedThroughput: {
            ReadCapacityUnits: 1,
            WriteCapacityUnits: 1
          }
        }
      ]
    }

    table.setProperties(tableProperties)
    table.setAutoScaling(1, 911);

    table.autoScaleInSecs = 15;
    table.autoScaleOutSecs = 14;

    const template = table.template;

    //console.log('----- the template: ' + JSON.stringify(template, null, 2));

    //Read scaling item
    expect(template['ScaleIndexReadScalableTarget']).toEqual({
      "Properties": {
        "MaxCapacity": 911,
        "MinCapacity": 1,
        "ResourceId": "table/CloudAtlasTest_unitTest/index/ScaleIndex",
        "RoleARN": {
          "Fn::GetAtt": [
            "unitTestAutoScalingRole",
            "Arn",
          ],
        },
        "ScalableDimension": "dynamodb:index:ReadCapacityUnits",
        "ServiceNamespace": "dynamodb",
      },
      "Type": "AWS::ApplicationAutoScaling::ScalableTarget",
    });

    //Write scaling item
    expect(template['ScaleIndexWriteScalableTarget']).toEqual({
      "Properties": {
        "MaxCapacity": 911,
        "MinCapacity": 1,
        "ResourceId": "table/CloudAtlasTest_unitTest/index/ScaleIndex",
        "RoleARN": {
          "Fn::GetAtt": [
            "unitTestAutoScalingRole",
            "Arn",
          ],
        },
        "ScalableDimension": "dynamodb:index:WriteCapacityUnits",
        "ServiceNamespace": "dynamodb",
      },
      "Type": "AWS::ApplicationAutoScaling::ScalableTarget",
    });

    expect(template['ScaleIndexWriteScalingPolicy']).toEqual({
      "Type": "AWS::ApplicationAutoScaling::ScalingPolicy",
      "Properties": {
        "PolicyName": "ScaleIndexWriteScalingPolicy",
        "PolicyType": "TargetTrackingScaling",
        "ScalingTargetId": {
          "Ref": "ScaleIndexWriteScalableTarget"
        },
        "TargetTrackingScalingPolicyConfiguration": {
          "TargetValue": 70,
          "ScaleInCooldown": 15,
          "ScaleOutCooldown": 14,
          "PredefinedMetricSpecification": {
            "PredefinedMetricType": "DynamoDBWriteCapacityUtilization"
          }
        }
      }
    });
  })

  test('Should create dynamoDB table spec correctly', () => {
    const tableProperties = {
      TableName: "XXXX", //This property is useless! 
      KeySchema: [
        { AttributeName: "year", KeyType: "HASH" }, //Partition key
        { AttributeName: "title", KeyType: "RANGE" } //Sort key
      ],
      AttributeDefinitions: [
        { AttributeName: "year", AttributeType: "N" },
        { AttributeName: "title", AttributeType: "S" }
      ],
      ProvisionedThroughput: {
        ReadCapacityUnits: 12,
        WriteCapacityUnits: 12
      }
    }

    table.setProperties(tableProperties)

    const template = table.template

    //console.log('Received template IS: \n' + JSON.stringify(template, null, '\t'))

    expect(template['unitTestDynamoDbTable']).toEqual({
      "Type": "AWS::DynamoDB::Table",
      "Properties": {
        TableName: "CloudAtlasTest_unitTest", //This property is useless! 
        KeySchema: [
          { AttributeName: "year", KeyType: "HASH" }, //Partition key
          { AttributeName: "title", KeyType: "RANGE" } //Sort key
        ],
        AttributeDefinitions: [
          { AttributeName: "year", AttributeType: "N" },
          { AttributeName: "title", AttributeType: "S" }
        ],
        ProvisionedThroughput: {
          ReadCapacityUnits: 12,
          WriteCapacityUnits: 12
        }
      }
    })
  })
})
