const { 
  CloudFormation,
  Stack,
  Lambda,
  Policy,
  ApiGateway,
  DynamoDbTable,
  CognitoUserPool,
  CognitoUserPoolAppClient,
  CognitoUserGroup,
  S3
 }
  = require('cloudatlas');

const swagger = require('./sample-stack-swagger-api.json');

const buildStack = (context, stack, sampleStackPersistCF) => {

  //sampleStackPersistCF.persistComponentProtection = false;

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
  })
  
  sampleStackPersistCF.addComponent(sampleStackPersistTable)

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

  sampleStackPersistCF.addComponent(sampleStackPersistUserPool)
  sampleStackPersistCF.addComponent(sampleStackPersistUserPoolClient)

  sampleStackPersistUser = stack.createCognitoBuiltinUser('jian', sampleStackPersistUserPool)
  sampleStackPersistUser.userName = 'jian'
  sampleStackPersistUser.email = 'jian@warpdreams.com'
  sampleStackPersistCF.addComponent(sampleStackPersistUser)

  //S3 bucket
  sampleStackPersistBucket = stack.createS3Bucket('Website')
  sampleStackPersistBucket.setupAsStaticWebSite('index.html');
  sampleStackPersistBucket.bucketPolicyTemplate = sampleStackPersistBucket.publicIndividualReadBucketPolicyTemplate
  sampleStackPersistCF.addComponent(sampleStackPersistBucket);


  return;


  ///////// NOTICE: we worry about second part of the stack later. 
  
  //Lambdas
  const sampleStackLambda = stack.createLambda('checkDeployment');
  sampleStackLambda.setHandlerPath('sample-stack-lambda.handler');

  sampleStackPersistCF.addComponent(sampleStackLambda);

  const sampleStackGateway = stack.createApiGateway('checkDeployment');
  sampleStackGateway.setSwagger(swagger);
  sampleStackGateway.attachLambda(sampleStackLambda, '/checkDeployment', ['GET', 'POST', 'PUT'], {
    '.*Invalid parameters.*': {
      statusCode: 400
    }
  });

  sampleStackGateway.setIAM('/checkDeployment', ['POST', 'PUT']);
  sampleStackGateway.setDeploymentStages(['alpha', 'beta']);
  sampleStackGateway.binaryMediaTypes = ['image/png', 'application/octet'];

  sampleStackPersistCF.addComponent(sampleStackGateway);

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

  sampleStackIdentityPool = stack.createCognitoIdentityPool('Users')
  sampleStackIdentityPool.setUserPoolAsIdentityProvider(sampleStackPersistUserPool, sampleStackPersistUserPoolClient)

  sampleStackPersistCF.addComponent(sampleStackIdentityPool)

  /*
   * Statements for basic access, which is authenticated user.
   * This role should be assigned to Cognito Identity Pool authenticated role.
   * A user in Cognito user pool which isn't assigned to any user groups will default to 
   * Cognito identity pool authenticated role. 
   */
  const basicAccessStatements = 
    [sampleStackGateway.policyStatementForAccess([ApiGateway.ACCESS_LEVEL_READ], 
      { methods: ['get', 'post'], 
      path: '/checkDeployment' }
    )];

  /*
   * Statements for advanced user, which is assigned to Cognito User Pool User Group. 
   */
  const advancedAccessStatements = 
    [sampleStackGateway.policyStatementForAccess([ApiGateway.ACCESS_LEVEL_READ], 
      { methods: ['get', 'post', 'put'], 
      path: '/checkDeployment' }
    )];

  // let unauthstatements = [
  //   sampleStackGateway.policyStatementForAccess([ ApiGateway.ACCESS_LEVEL_READ ], 
  //     {methods: ['get'], path:'/access_to_nothing'})
  // ]

  sampleStackIdentityPool.attachStatementsToAuthenticatedRole(basicAccessStatements)

  //Setup userGroups
  sampleStackTestUserGroup = stack.createCognitoUserGroup('Testers', sampleStackPersistUserPool);
  sampleStackTestUserGroup.assumeRolePolicyStatement = 
    sampleStackIdentityPool.assumeRolePolicyDocumentForCognitoIdentityPool(true);
  sampleStackTestUserGroup.policyStatements = advancedAccessStatements;

  sampleStackPersistCF.addComponent(sampleStackTestUserGroup);
}

exports.buildStack = buildStack;
