'use strict';
module.exports.capitalizeFirstLetter = (str) => {
  return str.charAt(0).toUpperCase() + str.slice(1);
};

class Logger {

  constructor(options) {
    const title = options.title || '';
    this.logTitle = `[${options.title} DEBUG]`;
    this.errorTitle = `[${options.title} ERROR]`;
    this.debug = options.debug;
  }

  log() {
    if (this.debug) {
      const args = objectToArray(arguments);
      args.unshift(this.logTitle);
      console.log.apply(this, args);
    }
  }

  error() {
    const args = objectToArray(arguments);
    args.unshift(this.errorTitle);
    console.error.apply(this, args);
  }
}

function objectToArray(obj) {
  return Object.keys(obj).map((key) => {
    return obj[key]
  })
}

module.exports.Logger = Logger;
