const assert = require('assert')
const log = require('winston')

const { CloudFormation } = require('./cloud-formation');
const Lambda = require('./lambda').Lambda
const Policy = require('./policy').Policy
const APIGateway = require('./api-gateway').APIGateway
const S3 = require('./s3').S3

describe('test S3', () => {
  let stack = null
  let s3 = null
  beforeEach(() => {
    stack = new CloudFormation('CloudAtlasTest')
    s3 = stack.createS3Bucket('TestBucket')
    assert.ok(s3)
  })

  test('Should create S3 spec correctly', () => {
    s3.cannedACL = S3.CANNED_ACL_PUBLIC_READ
    const template = s3.template
    //log.info(JSON.stringify(template, null, 2))
    expect(template).toEqual(
      {
        "CloudAtlasTestTestBucketS3": {
          "Type": "AWS::S3::Bucket",
          "Properties": {
            "AccessControl": "PublicRead",
            "BucketName": "cloudatlastesttestbuckets3",
            "CorsConfiguration": {
              "CorsRules": [
                {
                  "AllowedHeaders": [
                    "*"
                  ],
                  "AllowedMethods": [
                    "GET",
                    "PUT",
                    "HEAD",
                    "POST",
                    "DELETE"
                  ],
                  "AllowedOrigins": [
                    "*"
                  ]
                }
              ]
            }
          }
        }
      }
    )
  })

  test('Should create S3 spec as website correctly', () => {
    s3.setupAsStaticWebSite('index.html');
    const template = s3.template;
    //expect(template).toEqual({});
    expect(template).toEqual(expect.objectContaining(s3.publicIndividualReadBucketPolicyTemplate));
  })
})
