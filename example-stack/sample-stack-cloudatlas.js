const assert = require('assert');

const {
  CloudFormation,
  Lambda,
  Policy,
  ApiGateway,
  DynamoDbTable,
  CognitoUserPool,
  CognitoUserPoolAppClient,
  CognitoUserGroup,
  S3
}
  = require('@warpdreams/cloudatlas');

const swagger = require('./sample-stack-swagger-api.json');

//persist stack components
let sampleStackPersistTable = null;
let sampleStackPersistUserPool = null;
let sampleStackPersistUserPoolClient = null;
let sampleStackPersistUser = null;
let sampleStackPersistBucket = null;

const wireStack = (name, stack) => {
  switch(name) {
    case 'sample-stack-persist-cloudatlas':
      wirePersistStack(stack);
      break;
    case 'sample-stack-functions-cloudatlas':
      wireFunctionStack(stack);
      break;
    default:
      throw new Error(`Unknown stack: ${name}`); 
  }
}

exports.wireStack = wireStack;

const wirePersistStack = (stack) => {
  //stack.persistComponentProtection = false;

  //The first stack: DynamoDB tables, S3, Cognito Pool 
  //Everything that has something to do with persistence

  //Output: ID and ARN of generated resources
  //Two DynamoDB tables
  sampleStackPersistTable = stack.createDynamoDbTable('Storage')
  sampleStackPersistTable.setProperties({
    ProvisionedThroughput: {
      ReadCapacityUnits: 1,
      WriteCapacityUnits: 1
    },
    KeySchema: [
      { AttributeName: "year", KeyType: "HASH" }, //Partition key
      { AttributeName: "title", KeyType: "RANGE" } //Sort key
    ],
    AttributeDefinitions: [
      { AttributeName: "year", AttributeType: "N" },
      { AttributeName: "title", AttributeType: "S" }
    ]
  });

  //Create sampleStackPersistUser pool
  sampleStackPersistUserPool = stack.createCognitoUserPool('Users')
  sampleStackPersistUserPool.setProperties({

    //AutoVerifiedAttributes: ['email'],
    AliasAttributes: ['email'],

    Policies: {
      "PasswordPolicy": {
        "MinimumLength": "8",
        "RequireUppercase": "true",
        "RequireLowercase": "true"
      }
    },

    Schema: [{
      AttributeDataType: "String",
      Name: "email",
      Required: true
    }]
  })

  sampleStackPersistUserPoolClient = stack.createCognitoUserPoolAppClient('ForIdentityPool', sampleStackPersistUserPool)
  sampleStackPersistUserPoolClient.writeAttributes = ['phone_number', 'address']; //email by default is included

  sampleStackPersistUser = stack.createCognitoBuiltinUser('jian', sampleStackPersistUserPool)
  sampleStackPersistUser.userName = 'jian'
  sampleStackPersistUser.email = 'jian@warpdreams.com';

  //S3 bucket
  sampleStackPersistBucket = stack.createS3Bucket('Website')
  sampleStackPersistBucket.setupAsStaticWebSite('index.html');
  sampleStackPersistBucket.bucketPolicyTemplate = sampleStackPersistBucket.publicIndividualReadBucketPolicyTemplate;
}

const wireFunctionStack = (stack2) => {

  /////
  // The second stack
  /////
  const sampleStackLambda = stack2.createLambda('checkDeployment');
  sampleStackLambda.setHandlerPath('sample-stack-lambda.handler');

  const sampleStackGateway = stack2.createApiGateway('checkDeployment');
  sampleStackGateway.setSwagger(swagger);
  sampleStackGateway.attachLambda(sampleStackLambda, '/checkDeployment', ['GET', 'POST', 'PUT'], {
    '.*Invalid parameters.*': {
      statusCode: 400
    }
  });

  sampleStackGateway.setIAM('/checkDeployment', ['POST', 'PUT']);
  sampleStackGateway.setDeploymentStages(['alpha', 'beta']);
  sampleStackGateway.binaryMediaTypes = ['image/png', 'application/octet'];

  //Allow lambda to read/write table1: cross-stack reference is here
  sampleStackLambda.policyStatements.push(sampleStackPersistTable.policyStatementForAccess([
    DynamoDbTable.ACCESS_LEVEL_READ,
    DynamoDbTable.ACCESS_LEVEL_WRITE
  ]))

  sampleStackLambda.policyStatements.push(sampleStackPersistBucket.policyStatementForAccess([
    S3.ACCESS_LEVEL_READ,
    S3.ACCESS_LEVEL_WRITE
  ]))

  sampleStackLambda.setEnvVariables({
    'DYNAMODB_TABLE_NAME': sampleStackPersistTable.tableName(),
    'BUCKET_NAME': sampleStackPersistBucket.bucketName
  })

  sampleStackIdentityPool = stack2.createCognitoIdentityPool('Users')
  sampleStackIdentityPool.setUserPoolAsIdentityProvider(sampleStackPersistUserPool, sampleStackPersistUserPoolClient)

  /*
   * Statements for basic access, which is authenticated user.
   * This role should be assigned to Cognito Identity Pool authenticated role.
   * A user in Cognito user pool which isn't assigned to any user groups will default to 
   * Cognito identity pool authenticated role. 
   */
  const basicAccessStatements =
    [sampleStackGateway.policyStatementForAccess([ApiGateway.ACCESS_LEVEL_READ],
      {
        methods: ['get', 'post'],
        path: '/checkDeployment'
      }
    )];

  /*
   * Statements for advanced user, which is assigned to Cognito User Pool User Group. 
   */
  const advancedAccessStatements =
    [sampleStackGateway.policyStatementForAccess([ApiGateway.ACCESS_LEVEL_READ],
      {
        methods: ['get', 'post', 'put'],
        path: '/checkDeployment'
      }
    )];

  // let unauthstatements = [
  //   sampleStackGateway.policyStatementForAccess([ ApiGateway.ACCESS_LEVEL_READ ], 
  //     {methods: ['get'], path:'/access_to_nothing'})
  // ]

  sampleStackIdentityPool.attachStatementsToAuthenticatedRole(basicAccessStatements)

  //Setup userGroups
  sampleStackTestUserGroup = stack2.createCognitoUserGroup('Testers', sampleStackPersistUserPool);
  sampleStackTestUserGroup.assumeRolePolicyStatement =
    sampleStackIdentityPool.assumeRolePolicyDocumentForCognitoIdentityPool(true);
  sampleStackTestUserGroup.policyStatements = advancedAccessStatements;
}

