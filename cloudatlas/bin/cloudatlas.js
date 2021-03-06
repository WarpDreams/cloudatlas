#!/usr/bin/env node

/**
 * Module dependencies.
 */

const program = require('commander');
const path = require('path');
const process = require('process');
const fs = require('fs');
const fsExtra = require('fs-extra');
const assert = require('assert');
const gulp = require('gulp');
let zip = require("gulp-zip");
const log = require('winston');
const _ = require('lodash');
const YAML = require('json2yaml');
const { parseStackName } = require('../utils');

const { StackManager, CloudFormation, Lambda } = require('../index');

const DEST_PATH = '.cloudatlas';
const { AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, AWS_DEFAULT_REGION } = process.env;

const s3 = require('gulp-s3-upload')({
  accessKeyId: AWS_ACCESS_KEY_ID,
  secretAccessKey: AWS_SECRET_ACCESS_KEY
});

program
  .version('0.1.0')
  .usage('[options] package|upload|deploy')
  .option('-v, --verbose', 'Print more info')
  .option('-s, --stack <name>', 'Specify the target stack. ')
  .option('-y --gen-serverless-yml', 'After upload, generate serverless.yaml file')
  .parse(process.argv);

if (program.verbose) {
  log.level = 'debug';
}
else {
  log.level = 'info';
}

let shouldGenServerlessYml = false;
if (program.genServerlessYml) {
  shouldGenServerlessYml = true;
  //console.log('------- specified to generate serverless yml');
}

const checkConfigurations = (package_json) => {
  assert.ok(package_json.cloudatlas, 'No cloudatlas item in package.json');
  return;
}

const makeGulpTasks = async (package_json, stacksInfo) => {

  if (_.isEmpty(process.env.NODE_ENV)) {
    log.warn('NODE_ENV environment variable is not found.');
  }

  const cloudatlasConfig = package_json.cloudatlas;

  const { source, stacks, bucket } = cloudatlasConfig;
  const stackManager = new StackManager();

  const fullScriptPath = path.join(process.cwd(), source);
  log.debug(`Running stack assembly scripts:  ${fullScriptPath}`);
  const { wireStack, afterStackDeploy } = require(fullScriptPath);

  const stacksByNames = {};
  for (let i = 0; i < stacks.length; i++) {
    const stack = stacks[i];
    const { originalStackName, legalStackName } = parseStackName(stack.name);

    const cloudFormationObj = new CloudFormation(legalStackName);
    stacksByNames[originalStackName] = cloudFormationObj; //This is the original name

    log.info(`Cloudatlas is now using name "${legalStackName}" for the deployment of ${originalStackName}`);
    wireStack(originalStackName, cloudFormationObj);

    try {
      const updatedCloudFormationObj = await stackManager.describeStack(cloudFormationObj);
      if (!updatedCloudFormationObj) {
        log.info(`Stack ${cloudFormationObj.stackName} does not exist in AWS.`);
      }
      else {
        log.info(`Stack ${cloudFormationObj.stackName} exists in AWS, cross-stack Outputs values retreived.`);
      }
    }
    catch (exception) {
      log.warn(`Cloudatlas can not find deployed stack info for ${cloudFormationObj.stackName} because: ${exception}`);
    }
  }

  for (let i = 0; i < stacks.length; i++) {

    const stack = stacks[i];
    const { originalStackName, legalStackName } = parseStackName(stack.name);

    const packageTaskName = `package_${originalStackName}`;
    const uploadTaskName = `upload_${originalStackName}`;
    const deployTaskName = `deploy_${originalStackName}`;

    stacksInfo[originalStackName] = {
      packageTaskName,
      uploadTaskName,
      deployTaskName
    };

    await fsExtra.ensureDir(DEST_PATH);
    //Local temp library
    const dateStr = (new Date()).getTime();
    const build_file_name = `${originalStackName}_${dateStr}.zip`;
    const writtenZipPath = path.join(process.cwd(), DEST_PATH, build_file_name);

    //Task: build the stack and zip up artifacts
    gulp.task(packageTaskName, () => {

      const fullScriptPath = path.join(process.cwd(), source);

      let cloudFormationObj = stacksByNames[originalStackName];

      log.info(`Generating AWS CloudFormation template file for ${originalStackName}...`);
      //Setup zip file and bucket location for all Lambdas
      for (let component of cloudFormationObj.components) {
        if (component instanceof Lambda) {
          if (!component.code) {
            const fileName = path.basename(writtenZipPath);
            log.debug(`Setting bucket=${bucket.name}, file=${fileName} for Lambda ${component.fullName} `);
            component.setSourcePackageInS3Bucket(bucket.name, fileName);
          }
        }
      }

      const template = cloudFormationObj.template;
      stackManager.writeTemplateFile(cloudFormationObj);

      _.merge(stacksInfo[originalStackName], {
        cloudFormationObj,
        template,
        fileZipPath: writtenZipPath
      });

      if (stack.lambdaSourceFiles) {
        log.info(`Zipping up files for stack ${originalStackName}: ${build_file_name}`);
        return gulp.src(stack.lambdaSourceFiles, { base: "." })
          .pipe(zip(build_file_name))
          .pipe(gulp.dest(DEST_PATH));
      }
      else {
        log.info(`no lambdaSourceFiles specified for stack ${originalStackName} and nothing to package`);
        return Promise.resolve(0);
      }
    });

    //Task: upload
    gulp.task(uploadTaskName, gulp.series(packageTaskName, () => {
      if (stack.lambdaSourceFiles) {
        const { fileZipPath } = stacksInfo[originalStackName];
        log.info(`Uploading file to S3 ${bucket.name}: ${fileZipPath}`);
        return gulp.src(fileZipPath)
          .pipe(
            s3({
              Bucket: bucket.name, //  Required
            }, {}))
          .on('error', function (error) {
            log.error('Upload encountered error: ', error);
            throw error;
          })
          .on('end', function () {
            if (shouldGenServerlessYml) {

              let yml_file_name = 'serverless.yml';

              if (stacks.length != 1) {
                //Multiple stacks. Need to name differently
                yml_file_name = `serverless-${originalStackName}.yml`;
              }

              const serverlessYML = {
                service: originalStackName,
                provider: {
                  name: 'aws',
                  stage: process.env.NODE_ENV,
                  region: AWS_REGION || AWS_DEFAULT_REGION,
                  deploymentBucket: bucket.name
                },
                resources: null  //To be field
              }

              let cloudFormationObj = stacksByNames[originalStackName];
              serverlessYML.resources = cloudFormationObj.template;

              //Gen and write serverless.yml file to .cloudatlas
              const yamlText = YAML.stringify(serverlessYML);
              const fullPath = path.join(DEST_PATH, yml_file_name);

              log.info('Writing serverless YAML file: ' + fullPath);
              fs.writeFileSync(fullPath, yamlText);
            }
          });
      }
      else {
        log.info(`no lambdaSourceFiles specified for stack ${originalStackName} and nothing to upload`);
        return Promise.resolve(0);
      }
    }))

    //Task: deploy
    gulp.task(deployTaskName, gulp.series(packageTaskName, uploadTaskName, async () => {
      const { cloudFormationObj } = stacksInfo[originalStackName];
      assert.ok(cloudFormationObj, `Internal inconsistency: requested to run deploy but did not find tacksInfo[${originalStackName}].cloudFormationObj`);

      log.info(`Deploying CloudFormation Stack:`, originalStackName, '...');

      try {
        const upsertData = await stackManager.startUpsertStack(cloudFormationObj);
        const finishedCloudFormation = await stackManager.waitUntilStackUpsertComplete(cloudFormationObj);
        stacksInfo[originalStackName].cloudFormationObj = finishedCloudFormation;
      }
      catch (exception) {
        log.error('CloudFormation Upsert error: ', exception.stack);

        if (afterStackDeploy) {
          await afterStackDeploy(originalStackName, cloudFormationObj, exception);
        }
        throw exception; //re-throw to allow gulp to fail
      }

      //Reaching here means that the deploy is successful.
      if (afterStackDeploy) {
        try {
          await afterStackDeploy(originalStackName, cloudFormationObj);
        }
        catch (exception) {
          log.error('Received error on calling afterStackDeploy: ' + exception.stack);
          throw exception;
        }
      }

    }))
  }; //end each stack

}

async function main(command) {

  command = command || 'package';

  const targetStackName = program.stack && program.stack.trim();

  //Let's read the package json file
  const packageJsonPath = path.resolve(process.cwd(), 'package.json');
  const package_json = require(packageJsonPath);
  assert.ok(package_json, `Failed to read package.json file at: ${packageJsonPath}`);
  checkConfigurations(package_json);

  const stackInfo = {};
  await makeGulpTasks(package_json, stackInfo);

  const tasksToRun = [];
  _.each(stackInfo, (stackInfoObj, stackName) => {

    //Is target stack name specified? 
    if (targetStackName) {
      if (stackName != targetStackName) {
        return; //Skip unmatched stack 
      }
    }

    switch (command) {
      case 'package':
        tasksToRun.push(stackInfoObj.packageTaskName);
        break;
      case 'upload':
        tasksToRun.push(stackInfoObj.uploadTaskName);
        break;
      case 'deploy':
        tasksToRun.push(stackInfoObj.deployTaskName);
        break;
    }
  })

  log.debug('Tasks to run: ', tasksToRun);

  if (command != 'upload' && shouldGenServerlessYml) {
    throw new Error('Inconsistent options: --gen-serverless-yml is only applicable for upload command');
  }

  for (let task of tasksToRun) {
    gulp.task(task)();
  }
}


main(program.args[0]).then(() => {
})
  .catch((exception) => {
    log.error('Cloudatlas encountered problem: ', exception.stack);
    process.exit(-1);
  });