const assert = require('assert');
const _ = require('lodash');
//const camelCase = require('camelcase');
const upperCamelCase = require('uppercamelcase');
const log = require('winston');

//Returns: { originalStackName, legalStackName }
const parseStackName = (originalNameOrObject) => {
  let originalStackName = null;
  let legalStackName = null;
  if (typeof originalNameOrObject === 'object') {
    const node_env = process.env.NODE_ENV;
    assert.ok(!_.isEmpty(node_env), 'Specified explicit stack name for cloutatlas but does not define NODE_ENV');
    originalStackName = originalNameOrObject[node_env];
    assert.ok(originalStackName, `Specified explicit stack name for cloutatlas but non available for NODE_ENV=${node_env}`);

    //WARNING: since it is explictly specified, we no longer convert the name. But we check if it is recommended.
    const testConversion = upperCamelCase(originalStackName);
    if (testConversion != originalStackName) {
      log.warn(`The provided stack name '${originalStackName}' for environment ${node_env} is not in PascalCase and could cause CloudFormation deployment failure. Recommand to use name '${testConversion}'`)
    }
    legalStackName = originalStackName;
  }
  else if (typeof originalNameOrObject === 'string') {
    originalStackName = originalNameOrObject;

    if (_.isEmpty(process.env.NODE_ENV)) {
      log.warn('NODE_ENV environment variable is not found.');
      legalStackName = upperCamelCase(originalStackName);
    }
    else {
      legalStackName = upperCamelCase(originalStackName + '-' + process.env.NODE_ENV);
    }
  }
  else {
    throw new Error(`Invalid item in package.json under cloudatlas: ${JSON.stringify(originalNameOrObject)}`);
  }

  return {
    originalStackName, 
    legalStackName
  };
}


module.exports = {
  parseStackName
}
