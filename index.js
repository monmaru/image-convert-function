'use strict';

const gcs = require('@google-cloud/storage')();
const mkdirp = require('mkdirp-promise');
const exec = require('child-process-promise').exec;

exports.convert2grayscale = (event) => convertWithImageMagick(event.data, 'converted_image', '-colorspace gray');
exports.convert2negate = (event) => convertWithImageMagick(event.data, 'converted_image', '-negate');
exports.convert2sepia = (event) => convertWithImageMagick(event.data, 'converted_image', '-sepia-tone 80%');

function convertWithImageMagick (object, bucketName, params) {
  if (object.resourceState === 'not_exists') {
    console.log('This is a deletion event.');
    return;
  }

  if (!object.contentType.startsWith('image/')) {
    console.log('This is not an image.');
    return;
  }

  const filePath = object.name;
  const filePathSplit = filePath.split('/');
  const fileName = filePathSplit.pop();
  const fileNameSplit = fileName.split('.');
  const extension = fileNameSplit.pop();
  const baseFileName = fileNameSplit.join('.');
  const fileDir = filePathSplit.join('/') + (filePathSplit.length > 0 ? '/' : '');
  const convertedImageFile = `${fileDir}${baseFileName}_conv.${extension}`;
  const tempFolder = '/tmp/';
  const tempLocalDir = `${tempFolder}${fileDir}`;
  const tempOriginalFile = `${tempLocalDir}${fileName}`;
  const tempConvertedFile = `${tempFolder}${convertedImageFile}`;

  return Promise.resolve()
    .then(() => gcs.bucket(object.bucket).file(filePath).download({destination: tempOriginalFile}))
    .then(() => {
      console.log('The file has been downloaded to', tempOriginalFile);
      return exec(`convert "${tempOriginalFile}" ${params} "${tempConvertedFile}"`);
    })
    .then(() => {
      console.log('Image created at', tempOriginalFile);
      return gcs.bucket(bucketName).upload(tempConvertedFile, {destination: convertedImageFile});
    })
    .then(() => console.log('Image uploaded to Storage at', filePath))
    .catch((err) => {
      console.error(err);
      return err;
    });
};
