const assert = require('assert')
const AWSComponent = require('./aws-component').AWSComponent
const AWSObject = require('./aws-object').AWSObject
const Policy = require('./policy').Policy
const Role = require('./role').Role
const cst = require('./constants')
const _ = require('lodash')


/* all:

[
                "cognito-idp:AddCustomAttributes",
                "cognito-idp:AdminAddUserToGroup",
                "cognito-idp:AdminConfirmSignUp",
                "cognito-idp:AdminCreateUser",
                "cognito-idp:AdminDeleteUser",
                "cognito-idp:AdminDeleteUserAttributes",
                "cognito-idp:AdminDisableUser",
                "cognito-idp:AdminEnableUser",
                "cognito-idp:AdminForgetDevice",
                "cognito-idp:AdminGetDevice",
                "cognito-idp:AdminGetUser",
                "cognito-idp:AdminInitiateAuth",
                "cognito-idp:AdminListDevices",
                "cognito-idp:AdminListGroupsForUser",
                "cognito-idp:AdminRemoveUserFromGroup",
                "cognito-idp:AdminResetUserPassword",
                "cognito-idp:AdminRespondToAuthChallenge",
                "cognito-idp:AdminSetUserSettings",
                "cognito-idp:AdminUpdateDeviceStatus",
                "cognito-idp:AdminUpdateUserAttributes",
                "cognito-idp:AdminUserGlobalSignOut",
                "cognito-idp:CreateGroup",
                "cognito-idp:CreateUserImportJob",
                "cognito-idp:CreateUserPool",
                "cognito-idp:CreateUserPoolClient",
                "cognito-idp:DeleteGroup",
                "cognito-idp:DeleteUserPool",
                "cognito-idp:DeleteUserPoolClient",
                "cognito-idp:DescribeUserImportJob",
                "cognito-idp:DescribeUserPool",
                "cognito-idp:DescribeUserPoolClient",
                "cognito-idp:GetCSVHeader",
                "cognito-idp:GetGroup",
                "cognito-idp:ListGroups",
                "cognito-idp:ListUserImportJobs",
                "cognito-idp:ListUserPoolClients",
                "cognito-idp:ListUserPools",
                "cognito-idp:ListUsers",
                "cognito-idp:ListUsersInGroup",
                "cognito-idp:StartUserImportJob",
                "cognito-idp:StopUserImportJob",
                "cognito-idp:UpdateGroup",
                "cognito-idp:UpdateUserPool",
                "cognito-idp:UpdateUserPoolClient"
            ],

*/


class CognitoUserPool extends AWSComponent {

  constructor(
    stackName,
    baseName) {
    super(stackName, baseName)
    this.properties = {
      "UserPoolName": this.userPoolName()
    }
  }

  get sameStackValues() {
    let superVals = super.sameStackValues
    superVals['PROVIDERNAME'] = {
      "Fn::GetAtt": [
        this.fullName,
        "ProviderName"
      ]
    }
    return superVals
  }

  userPoolName() {
    return `${this.stackName}_${this.baseName}`
  }

  /*
   * Notice: TableName is fixed, anything provided outside will be overwritten
   */
  setProperties(properties) {
    let copied = _.clone(properties)
    copied['UserPoolName'] = this.userPoolName()
    this.properties = copied
  }

  policyStatementForAccessImpl(accessLevels, item) {
    //Item is ignored, because there is only one thing to offer 

    let actionsTable = {}
    actionsTable[AWSComponent.ACCESS_LEVEL_READ] = [
      "cognito-idp:AdminGetUser",
    ]
    
    actionsTable[AWSComponent.ACCESS_LEVEL_WRITE] = [
      "cognito-idp:AddCustomAttributes",
      "cognito-idp:AdminAddUserToGroup",
      "cognito-idp:AdminConfirmSignUp",
      "cognito-idp:AdminCreateUser",

      "cognito-idp:AdminDisableUser",
      "cognito-idp:AdminEnableUser",
      "cognito-idp:AdminForgetDevice",
      "cognito-idp:AdminGetDevice",
    ]
    
    actionsTable[AWSComponent.ACCESS_LEVEL_ADMIN] = [

      "cognito-idp:AdminDeleteUser",
      "cognito-idp:AdminDeleteUserAttributes",

      "cognito-idp:AdminInitiateAuth",
      "cognito-idp:AdminListDevices",
      "cognito-idp:AdminListGroupsForUser",
      "cognito-idp:AdminRemoveUserFromGroup",
      "cognito-idp:AdminResetUserPassword",
      "cognito-idp:AdminRespondToAuthChallenge",
      "cognito-idp:AdminSetUserSettings",
      "cognito-idp:AdminUpdateDeviceStatus",
      "cognito-idp:AdminUpdateUserAttributes",
      "cognito-idp:AdminUserGlobalSignOut",

      "cognito-idp:CreateGroup",
      "cognito-idp:CreateUserImportJob",
      "cognito-idp:CreateUserPool",
      "cognito-idp:CreateUserPoolClient",
      "cognito-idp:DeleteGroup",
      "cognito-idp:DeleteUserPool",
      "cognito-idp:DeleteUserPoolClient",
      "cognito-idp:DescribeUserImportJob",
      "cognito-idp:DescribeUserPool",
      "cognito-idp:DescribeUserPoolClient",

      "cognito-idp:GetCSVHeader",
      "cognito-idp:GetGroup",
      "cognito-idp:ListGroups",
      "cognito-idp:ListUserImportJobs",
      "cognito-idp:ListUserPoolClients",
      "cognito-idp:ListUserPools",
      "cognito-idp:ListUsers",
      "cognito-idp:ListUsersInGroup",
      "cognito-idp:StartUserImportJob",
      "cognito-idp:StopUserImportJob",
      "cognito-idp:UpdateGroup",
      "cognito-idp:UpdateUserPool",
      "cognito-idp:UpdateUserPoolClient"
    ]

    let allowedActions = []
    accessLevels.forEach((level)=>{
      let actions = actionsTable[level]
      allowedActions = allowedActions.concat(actions)
    })

    return {
      "Effect": "Allow",
      "Action": allowedActions.sort(),
      "Resource": [
        this.getValue('ARN')
      ]
    }
  }

  get outputSpecs() {
    let specs = super.outputSpecs

    specs[`${this.stackName}${this.fullName}PROVIDERNAME`] = {
      "Description": `The ProviderName for resource ${this.fullName} of stack ${this.stackName}`,
      "Value": {      
        "Fn::GetAtt": [
        this.fullName,
        "ProviderName"
      ]},
      "Export": {
        "Name": `${this.stackName}${this.fullName}PROVIDERNAME`
      }
    }

    return specs
  }

  get template() {
    let template = {}
    template[this.fullName] =  {
      "Type" : "AWS::Cognito::UserPool",
      "Properties" : this.properties
    }

    return template
  }
}

CognitoUserPool.DEFAULT_GROUP_NAME = 'Default'
CognitoUserPool.ADMIN_GROUP_NAME = 'Admin'
CognitoUserPool.ASSUME_ROLE_SERVICE_NAME = 'cognito-idp.amazonaws.com'

CognitoUserPool.STANDARD_ATTRIBUTES = [
  'address',
  'birthdate',
  'email',
  'family_name',
  'gender',
  'given_name',
  'locale',
  'middle_name',
  'name',
  'nickname',
  'phone_number',
  'picture',
  'preferred_username',
  'profile',
  'timezone',
  'updated_at',
  'website'
]

exports.CognitoUserPool = CognitoUserPool