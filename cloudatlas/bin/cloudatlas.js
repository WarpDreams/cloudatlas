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
const { parseStackName } = require('../utils');

const { StackManager, CloudFormation, Lambda } = require('../index');

const DEST_PATH = '.cloudatlas';
const { AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION } = process.env;

const s3 = require('gulp-s3-upload')({
  accessKeyId: AWS_ACCESS_KEY_ID,
  secretAccessKey: AWS_SECRET_ACCESS_KEY
});

program
  .version('0.1.0')
  .usage('[options] package|upload|deploy')
  .option('-v, --verbose', 'Print more info')
  .option('-s, --stack <name>', 'Specify the target stack. ')
  .parse(process.argv);

if (program.verbose) {
  log.level = 'debug';
}
else {
  log.level = 'info';
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
  const { wireStack } = require(fullScriptPath);

  stacksByNames = {};
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
      log.warn(`Cloudatlas can not find deployed stack info for ${cloudFormationObj.stackName} because: ${error}`);
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
    const build_file_name = `${name}_${dateStr}.zip`;
    const writtenZipPath = path.join(process.cwd(), DEST_PATH, build_file_name);

    //Task: build the stack and zip up artifacts
    gulp.task(packageTaskName, () => {

      const fullScriptPath = path.join(process.cwd(), source);
      const { wireStacks } = require(fullScriptPath);

      let cloudFormationObj = stacksByNames[originalStackName];

      log.info(`Generating AWS CloudFormation template file for ${originalStackName}...`);
      //Setup zip file and bucket location for all Lambdas
      for (component of cloudFormationObj.components) {
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
        log.info(`Zipping up files for stack ${name}: ${build_file_name}`);
        return gulp.src(stack.lambdaSourceFiles, { base: "." })
          .pipe(zip(build_file_name))
          .pipe(gulp.dest(DEST_PATH));
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
          });
      }
    }))

    //Task: deploy
    gulp.task(deployTaskName, gulp.series(packageTaskName, uploadTaskName, async () => {
      const { cloudFormationObj } = stacksInfo[originalStackName];
      assert.ok(cloudFormationObj, `Internal inconsistency: requested to run deploy but did not find tacksInfo[${name}].cloudFormationObj`);

      log.info(`Deploying CloudFormation Stack: `, name, '...');

      try {
        const upsertData = await stackManager.startUpsertStack(cloudFormationObj);
        const finishedCloudFormation = await stackManager.waitUntilStackUpsertComplete(cloudFormationObj);
        stacksInfo[originalStackName].cloudFormationObj = finishedCloudFormation;
      }
      catch (exception) {
        log.error('CloudFormation Upsert error: ', exception.stack);
        throw exception; //re-throw to allow gulp to fail
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

  for (task of tasksToRun) {
    gulp.task(task)();
  }
}


main(program.args[0]).then(() => {
})
  .catch((exception) => {
    log.error('Cloudatlas encountered problem: ', exception.stack);
    process.exit(-1);
  });