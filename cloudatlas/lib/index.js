const { ApiGateway } = require('./api-gateway');
const { Lambda } = require('./lambda');
const { CloudFormation } = require('./cloud-formation');
const { Policy } = require('./policy');
const { S3 } = require('./s3');
const { DynamoDbTable } = require('./dynamodb-table');
const { CognitoUserPool } = require('./cognito-user-pool');
const { CognitoUserGroup } = require('./cognito-user-group');
const { CognitoBuiltinUser } = require('./cognito-builtin-user');
const { CognitoIdentityPool } = require('./cognito-identity-pool');
const { CognitoUserPoolAppClient } = require('./cognito-user-pool-app-client');
const { StackManager } = require('./stack-manager');

module.exports = {
  ApiGateway,
  Lambda,
  CloudFormation,
  Policy,
  S3,
  DynamoDbTable,
  CognitoUserPool,
  CognitoUserGroup,
  CognitoBuiltinUser,
  CognitoIdentityPool,
  CognitoUserPoolAppClient,
  StackManager
}
