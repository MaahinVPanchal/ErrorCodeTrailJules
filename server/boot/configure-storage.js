var app = require('../../server/server');

module.exports = function (app) {
  if (app.dataSources.uploadfiles) {
    app.dataSources.uploadfiles.connector.getFilename = uploadFile;
  }
  if (app.dataSources.uploadfilesAws) {
    app.dataSources.uploadfilesAws.connector.getFilename = uploadFileAWS;
  }
};

function uploadFileAWS(uploadingFile, req, res) {
  // Set the Environment
  var environment;
  if (app.get('isProduction')) {
    environment = 'prod/';
  } else {
    environment = 'dev/';
  }
  // Manage Name Of File
  var newFilename;
  // default image/files List
  const defaultImages = ['default_category.png', 'noimagefound.png', 'defaultuser.jpeg'];
  // when trying to upload defaultImages  do not attach timestmp
  if (uploadingFile && uploadingFile.container && defaultImages.includes(uploadingFile.name)) {
    // Create New File name
    if (req.codename) {
      newFilename = environment + req.folder + '-' + req.codename + '/' + uploadingFile.name;
    } else {
      newFilename = environment + req.folder + '/' + uploadingFile.name;
    }
  } else {
    //  Split the name with . sign
    var attach_split = uploadingFile.name.split('.');
    // replace name with _ sign
    var replaced = attach_split[0].split(' ').join('_');
    // Get extension of image
    // var extension = attach_split[1];
    var extension = attach_split[attach_split.length - 1];

    // Create New File name
    if (req.codename) {
      newFilename = environment + req.folder + '-' + req.codename + '/' + req.folder + '_' + (new Date()).getTime('YYYY-MM-DD HH:MM:SS') + '_' + replaced + '.' + extension;
    } else {
      newFilename = environment + req.folder + '/' + uploadingFile.name;
    }
    uploadingFile.originalFilename = req.folder + '_' + (new Date()).getTime('YYYY-MM-DD HH:MM:SS') + '_' + replaced + '.' + extension;
  }
  console.log('updated newFilename ---- ', newFilename);
  uploadingFile.field = req.folder;
  return newFilename;
};

function uploadFile(uploadingFile, req, res) {
  // Manage Name Of File
  var newFilename;
  if (uploadingFile.container === 'profilepic') {
    var name = uploadingFile.name;
    name = 'companylogo.png';
    newFilename = name;
  } else {

    var extension = uploadingFile.name.split('.').pop();
    var attach_split = uploadingFile.name.split('.');
    var replaced = attach_split[0].split(' ').join('_');

    newFilename = (new Date()).getTime('YYYY-MM-DD HH:MM:SS') + '_' + replaced + '.' + extension;
  }
  return newFilename;
};
