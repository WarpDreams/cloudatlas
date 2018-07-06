const assert = require('assert')
const AWSComponent = require('./aws-component').AWSComponent
const AWSObject = require('./aws-object').AWSObject
const Policy = require('./policy').Policy
const Role = require('./role').Role
const CognitoUserPool = require('./cognito-user-pool').CognitoUserPool
const CognitoUserPoolAppAgent = require('./cognito-user-pool-app-client').CognitoUserPoolAppClient

const cst = require('./constants')
const _ = require('lodash')
const log = require('winston')
/*
 * Notice: IdentityPool will include settings for user pool. 
 */
class CognitoIdentityPool extends AWSComponent {


  /*
  
  {
    "Type" : "AWS::Cognito::IdentityPool",
    "Properties" : {
      "IdentityPoolName" : String,
      "AllowUnauthenticatedIdentities" : Boolean, 
      "DeveloperProviderName" : String,
      "SupportedLoginProviders" : { String:String, ... },
      "CognitoIdentityProviders" : [ CognitoIdentityProvider, ... ], 
      "SamlProviderARNs" : [ String, ... ],
      "OpenIdConnectProviderARNs" : [ String, ... ],
      "CognitoStreams" : CognitoStreams, 
      "PushSync" : PushSync,
      "CognitoEvents" : { String:String, ... }
    }
  }
  
  */

  constructor(
    stackName,
    baseName) {
    super(stackName, baseName)

    this._userPool = null
    this._poolAppAgent = null

    this._allowUnauthenticatedIdentities = false
  }

  set allowUnauthenticatedIdentities(allow) {
    this._allowUnauthenticatedIdentities = allow
  }

  get allowUnauthenticatedIdentities() {
    return this._allowUnauthenticatedIdentities
  }

  get outputSpecs() {
    let specs = {}
    const id_spec = `${this.stackName}${this.fullName}ID`;
    specs[id_spec] = {
      "Description": `The ID for resource ${this.fullName} of stack ${this.stackName}`,
      "Value": {"Ref": this.fullName},
      "Export": {
        "Name": id_spec
      }
    }

    return specs
  }

  setUserPoolAsIdentityProvider(pool, poolAppAgent) {
    assert.ok(pool instanceof CognitoUserPool)
    assert.ok(poolAppAgent instanceof CognitoUserPoolAppAgent)

    this._userPool = pool
    this._poolAppAgent = poolAppAgent
  }

  get userPool() {
    return this._userPool
  }

  get poolAppAgent() {
    return this._poolAppAgent
  }

  get identityPoolName() {
    return `${this.stackName}_${this.baseName}Identities`
  }

  attachStatementsToUnauthenticatedRole(statements) {
    this.unauthStatements = statements
  }

  attachStatementsToAuthenticatedRole(statements) {
    this.authStatements = statements
  }

  /*
  @param cognitoPoolProviderName could be:
  {
          "Fn::GetAtt": [
            <userPool logic name>, //Only works in the same stack
            "ProviderName"
          ]
        }
  
  or a literal string;

  @param clientId 
  could be userPool.getAppClientID() or a string

  */
  /*
  setCognitoUserPoolAsIdentityProvider(clientId, cognitoPoolProviderName) {
    this.properties['CognitoIdentityProviders'] = [
      {
        'ClientId': clientId,
        //ARN of the pool
        'ProviderName': cognitoPoolProviderName,
        'ServerSideTokenCheck': false 
      }
    ]
  }
  */

  /*
   * Notice: TableName is fixed, anything provided outside will be overwritten
   */

  // set properties(properties) {
  //   let copied = _.clone(properties)
  //   copied['IdentityPoolName'] = this.identityPoolName()

  //   copied['CognitoIdentityProviders'] = [
  //     {
  //       'ClientId': this.userPool.getAppClientID(CognitoUserPool.DEFAULT_APP_CLIENT_NAME),
  //       //ARN of the pool
  //       'ProviderName': {
  //         "Fn::GetAtt": [
  //           this.userPool.fullName,
  //           "ProviderName"
  //         ]
  //       },
  //       'ServerSideTokenCheck': false 
  //     }
  //   ]
  //   this._properties = copied
  // }

  policyStatementForAccessImpl(accessLevels, item) {
    //Item is ignored, because there is only one thing to offer 

    let actionsTable = {}
    actionsTable[AWSComponent.ACCESS_LEVEL_READ] = [
    ]

    actionsTable[AWSComponent.ACCESS_LEVEL_WRITE] = [
    ]

    actionsTable[AWSComponent.ACCESS_LEVEL_ADMIN] = [
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
        {
          "Fn::GetAtt": [this.fullName, "Arn"]
        }
      ]
    }
  }

  get template() {
    let template = {}

    let properties = {
      IdentityPoolName: this.identityPoolName,
      AllowUnauthenticatedIdentities: this.allowUnauthenticatedIdentities
    }

    //log.debug(`user pool and pool app agent:  ${Boolean(this.userPool)}  ${Boolean(this.poolAppAgent)} `)

    if (this.userPool && this.poolAppAgent) {
      properties['CognitoIdentityProviders'] = [
        {
          'ClientId': this.poolAppAgent.getValue('ID'),
          //ARN of the pool
          'ProviderName': this.userPool.getValue('PROVIDERNAME'),
          'ServerSideTokenCheck': false
        }
      ]
    }

    template[this.fullName] = {
      "Type": "AWS::Cognito::IdentityPool",
      "Properties": properties
    }

    const setupRoleAndRoleAttachment = (authenticatedOrNot, statements) => {

      let roleName = this.fullName

      if (authenticatedOrNot == 'authenticated') {
        roleName += 'Auth'
      }
      else if (authenticatedOrNot = 'unauthenticated') {
        roleName += 'Unauth'
      }
      else {
        throw new Error(`Invalid authentication value: ${authenticatedOrNot}`)
      }

      //Setup role
      let theRole = new Role(this.stackName, roleName)
      theRole.policyStatements = statements
      theRole.assumeRolePolicyDocument = this.assumeRolePolicyDocumentForCognitoIdentityPool(authenticatedOrNot)

      template = _.merge(template, theRole.template)

      //Setup attachment
      const key = `${this.fullName}RoleAttachment`

      template[key]['Properties']['Roles'][authenticatedOrNot] = {
        "Fn::GetAtt": [
          theRole.fullName,
          "Arn"
        ]
      }
    }

    if (this.unauthStatements || this.authStatements) {

      const key = `${this.fullName}RoleAttachment`
      template[key] = template[key] || {
        "Type": "AWS::Cognito::IdentityPoolRoleAttachment",
        "Properties": {
          "IdentityPoolId": { Ref: this.fullName },
          "RoleMappings": {}, //to be filled
          "Roles": {} //to be filled next
        }
      }

      if (this.authStatements) {
        setupRoleAndRoleAttachment('authenticated', this.authStatements)
      }

      if (this.unauthStatements) {
        setupRoleAndRoleAttachment('unauthenticated', this.unauthStatements)
      }

      if (this.userPool && this.poolAppAgent) {
        const providerName = this.userPool.crossStackValues['PROVIDERNAME'];
        assert.ok(providerName, 'Does not have string literal of ProviderName from associated Cognito User Pool. Since it must be a string literal, The user pool must be deployed beforehand (cross-stack)');

        const clientID = this.poolAppAgent.crossStackValues['ID'];
        assert.ok(clientID, 'Does not have string literal of clientID from associated Cognito User Pool Client. Since it must be a string literal, The user pool client must be deployed beforehand (cross-stack)')

        const provider = `${providerName}:${clientID}`

        template[key]['Properties']['RoleMappings'][provider] =  {
          //Always go back to basic authenticated role
          "AmbiguousRoleResolution": "AuthenticatedRole",
          "Type": "Token"
        }
      }
    }
    //Check Statements. Is new role needed? 
    if (this.authStatements && this.authStatements.length) {
      setupRoleAndRoleAttachment('authenticated', this.authStatements)
    }

    if (this.unauthStatements && this.unauthStatements.length) {
      setupRoleAndRoleAttachment('unauthenticated', this.unauthStatements)
    }

    return template
  }

  assumeRolePolicyDocumentForCognitoIdentityPool(authenticated) {
    return {
      "Version": "2012-10-17",
      "Statement": [
        {
          "Effect": "Allow",
          "Principal": {
            "Service": ['cognito-idp.amazonaws.com']
          },
          "Action": ["sts:AssumeRoleWithWebIdentity"]
        },

        {
          "Effect": "Allow",
          "Principal": {
            "Federated": "cognito-identity.amazonaws.com"
          },
          "Action": "sts:AssumeRoleWithWebIdentity",
          "Condition": {
            "StringEquals": {
              "cognito-identity.amazonaws.com:aud": { "Ref": this.fullName }
            },
            "ForAnyValue:StringLike": {
              "cognito-identity.amazonaws.com:amr": authenticated ? "authenticated" : "unauthenticated"
            }
          }
        }
      ]
    }
  }
}

CognitoIdentityPool.ASSUME_ROLE_SERVICE_NAME = 'cognito-identity.amazonaws.com'

//Static method
//Get an assume role policy document for identities in the cognito identity pool
//


exports.CognitoIdentityPool = CognitoIdentityPool