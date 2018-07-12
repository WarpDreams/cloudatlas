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

  test('Should create dynamDB table auto scalling correctly', () => {
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
    table.setAutoScaling(1, 100);

    const template = table.template;
    
    console.log('----- the template: ' + JSON.stringify(template, null, 2));

    //Read scaling item
    expect(template['unitTestDynamoDbTable_Read_ScalableTarget']).toEqual({});

    //Write scaling item
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
