const _ = require('lodash');
const assert = require('assert');
const { parseStackName } = require('./utils');
const process = require('process');

describe('test cloudatlas', () => {
  test('Should convert stack names correctly case', () => {

    process.env.NODE_ENV = 'unittest';

    {
      const { originalStackName, legalStackName } = parseStackName({
        "unittest": 'hardwired-name'
      });

      expect(originalStackName).toEqual('hardwired-name');
      expect(legalStackName).toEqual('hardwired-name');
    }


    {
      const { originalStackName, legalStackName } = parseStackName({
        "unittest": 'ABSOUTE'
      });

      expect(originalStackName).toEqual('ABSOUTE');
      expect(legalStackName).toEqual('ABSOUTE');
    }

    {
      const { originalStackName, legalStackName } = parseStackName('the-stack');

      expect(originalStackName).toEqual('the-stack');
      expect(legalStackName).toEqual('TheStackUnittest');
    }

    {
      const { originalStackName, legalStackName } = parseStackName('theStack');

      expect(originalStackName).toEqual('theStack');
      expect(legalStackName).toEqual('TheStackUnittest');
    }

  })
})