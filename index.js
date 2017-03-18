'use strict';

const mkdirp = require('mkdirp-promise');
const gcs = require('@google-cloud/storage')();
const exec = require('child-process-promise').exec;

exports.convert2grayscale = function convert2grayscale (event) {
  return convertWithImageMagick(event.data, 'grayscale_image', '-colorspace gray');
};

exports.convert2negate = function convert2negate (event) {
  return convertWithImageMagick(event.data, 'negate_image', '-negate');
};

exports.convert2sepia = function convert2sepia (event) {
  return convertWithImageMagick(event.data, 'sepia_image', '-sepia-tone 80%');
};

function convertWithImageMagick (object, outBucketName, params) {
  if (!object.contentType.startsWith('image/')) {
    console.log('This is not an image.');
    return;
  }

  if (object.resourceState === 'not_exists') {
    console.log('This is a deletion event.');
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

  return mkdirp(tempLocalDir).then(() => {
    return gcs.bucket(object.bucket).file(filePath).download({
      destination: tempOriginalFile
    }).then(() => {
      console.log('The file has been downloaded to', tempOriginalFile);
      return exec(`convert "${tempOriginalFile}" ${params} "${tempConvertedFile}"`).then(() => {
        console.log('Image created at', tempOriginalFile);
        return gcs.bucket(outBucketName).upload(tempConvertedFile, {
          destination: convertedImageFile
        }).then(() => {
          console.log('Image uploaded to Storage at', filePath);
        });
      });
    });
  });
};
