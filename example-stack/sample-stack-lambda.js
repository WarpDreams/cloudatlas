//Lambda should always has this
let AWS = require('aws-sdk')
let assert = require('assert')

let dynamodb = new AWS.DynamoDB();
let docClient = new AWS.DynamoDB.DocumentClient();

function importSampleItem() {
  let params = {
    TableName: process.env.DYNAMODB_TABLE_NAME,
    Item: {
      year: 2017,
      title: 'sample-title'
    }
  }

  //console.log('Will update data: ' + JSON.stringify(params, null, '\t'))
  return docClient.put(params).promise()
}

function verifySampleItem() {
  return Promise.resolve('OK')
}

function testDynamoDBConnection() {
  return Promise.resolve().then(importSampleItem).then(verifySampleItem)
}

function testS3PutObjects() {
  let params = {
    Body: 'If you see this, test lambda is executed successfully to putObject into S3', 
    Bucket: process.env.BUCKET_NAME, 
    Key: "exampleobject.txt", 
    ServerSideEncryption: "AES256", 
    Tagging: "source=testLambda"
  }

  let s3 = new AWS.S3();

  return s3.putObject(params).promise()
}

// Greeter Lambda"
exports.handler = (event, context, callback) => {

  assert.ok(process.env.DYNAMODB_TABLE_NAME, 'missing environment variable: DYNAMODB_TABLE_NAME')
  let tasks = [testDynamoDBConnection(), testS3PutObjects()]
  let taskNames = ['testDynamoDBConnection', 'testS3PutObjects']

  Promise.all(tasks).then((results) => {
    let report = {}
    for (let i = 0; i < results.length; i++) {
      let taskName = taskNames[i]
      let result = results[i]
      report[taskName] = result
    }

    report.echoEvent = event;

    callback(null, report)
  }).catch((reason) => {
    callback('lambda failed because of reason: ' + reason, null)
  })
}
