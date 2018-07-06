# Cloudatlas

## Overview

Cloudatlas is a CLI tool to produce, deploy and update AWS CloudFormation stacks.

The idea is to construct a comprehensive AWS CloudFormation stack with minimum scripting via Javascript, while shielding the user from boilerplate details and providing out-of-the-box best practises. 

### Differences to Alternative Options

#### Cloudatlas vs Writing CloudFormation JSON/YML Template File Directly
Needless to say, you need to manage every inch of details for CloudFormation.

#### Cloudatlas vs Serverless with AWS Plugins
You need to find plugins for different AWS components if you need more than the most basic usage of Lambda and API Gateway. Different plugins may not be compatible with each other and may not provide all the configuration options you need. Then you resort to writing `resources` section in `serverless.yml` which is essentially writing the CloudFormation template file. 

## A Quick Example

With Cloudatlas, you write a NodeJS script that assembles an AWS CloudFormation stack programmingly.