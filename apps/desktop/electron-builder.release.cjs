const { releaseSigning } = require('./signing-policy.cjs');
const config = require('./package.json').build;
module.exports = {
  ...config,
  forceCodeSigning: true,
  directories: { ...config.directories, output: 'dist-signed' },
  win: { ...config.win, signExecutable: true, signtoolOptions: releaseSigning(process.env) }
};
