//Lambda should always has this
let AWS = require('aws-sdk');

exports.handler = (event, context, callback) => {
    callback(null, {
      message: 'Welcome to your first Cloudatlas stack! '
    });
}
