'use strict';

module.exports.eventHandler = (event, context, callback) => {

  console.log('Event:', event);

  callback(null, event);
};
