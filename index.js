'use strict';

const path = require('path');
const gcs = require('@google-cloud/storage')();
const exec = require('child-process-promise').exec;
const outputBucketName = 'converted_image';

exports.convert2grayscale = (event) => convert(event.data, outputBucketName, '-colorspace gray');
exports.convert2negate = (event) => convert(event.data, outputBucketName, '-negate');
exports.convert2sepia = (event) => convert(event.data, outputBucketName, '-sepia-tone 80%');
exports.convert2thumbnail = (event) => convert(event.data, outputBucketName, '-thumbnail 200x200');
exports.convert2bordercolor = (event) => convert(event.data, outputBucketName, '-bordercolor "#0C00CC" -border 10x10');

function convert (object, bucketName, params) {
  if (object.resourceState === 'not_exists') {
    console.log('This is a deletion event.');
    return;
  }

  if (!object.contentType.startsWith('image/')) {
    console.log('This is not an image.');
    return;
  }

  const filePath = object.name;
  const extension = path.extname(filePath);
  const baseName = path.basename(filePath, extension);
  const convImageFile = path.join(path.dirname(filePath), `${baseName}_conv${extension}`);
  const tempFolder = '/tmp';
  const tempSrcFile = path.join(tempFolder, filePath);
  const tempDestFile = path.join(tempFolder, convImageFile);

  return Promise.resolve()
    .then(() => gcs.bucket(object.bucket).file(filePath).download({destination: tempSrcFile}))
    .then(() => {
      console.log('The file has been downloaded to', tempSrcFile);
      return exec(`convert "${tempSrcFile}" ${params} "${tempDestFile}"`);
    })
    .then(() => {
      console.log('Image created at', tempSrcFile);
      return gcs.bucket(bucketName).upload(tempDestFile, {destination: convImageFile});
    })
    .then(() => console.log('Image uploaded to Storage at', filePath));
};
