'use strict';

var app = require('../../server/server');
var settingConstants = require('../setting_constants');
var s3Constants = require('../s3_constants');

module.exports = function (Container) {
  /**
   * After remote hook: converts images
   * @param ctx current context of the request
   * @param modelInstance contains data of uploaded files
   * @param next callback to move to the next middleware
   */

  Container.beforeRemote('upload', async (ctx, modelInstance, next) => {
    var accesstokenModel = app.models.AccessToken;
    try {

      // //  Split the name with . sign
      // var attach_split = ctx.req.name.split('.');
      // // replace name with _ sign
      // var replaced = attach_split[0].split(' ').join('_');
      // // Get extension of image
      // var extension = attach_split[1];

      if (ctx.req.headers.authorization) {
        var accessTokenDetails = await accesstokenModel.findOne({
          where: {
            id: ctx.req.headers.authorization
          }
        });
        ctx.req.headers.masterdetailid = accessTokenDetails.masterdetailId;
      }

      if (ctx.req.headers.masterdetailid !== null || ctx.req.headers.masterdetailid !== 'null') {
        var getFileUploadSetting =
          await settingConstants.getTenantSettingValueBasedOnKey(settingConstants.FILE_UPLOAD_KEY, ctx.req.headers.masterdetailid);
        if (getFileUploadSetting === settingConstants.FILE_UPLOAD_TO_S3) {
          // Attach Instance Code & Folder Name into Request
          var splitContainerName = ctx.args.container.split('-');
          ctx.args.req.folder = splitContainerName[0];
          ctx.args.req.codename = splitContainerName[1];
          ctx.args.container = s3Constants.S3_BUCKET;
        }
      }
      if (ctx.req.headers.masterdetailid === 'null' || ctx.req.headers.masterdetailid === null) {
        ctx.args.req.folder = 'tempmedia'
        ctx.args.container = s3Constants.S3_BUCKET;
      }
      next();
    } catch (error) {
      throw error;
    }
  });

  Container.afterRemote('upload', async (ctx, modelInstance, next) => {
    try {

      console.log(modelInstance);

      if (ctx.req.headers.masterdetailid !== null || ctx.req.headers.masterdetailid !== 'null') {
        var getFileUploadSetting =
          await settingConstants.getTenantSettingValueBasedOnKey(settingConstants.FILE_UPLOAD_KEY, ctx.req.headers.masterdetailid);
        if (getFileUploadSetting === settingConstants.FILE_UPLOAD_TO_S3) {
          if (modelInstance.result.files.fileKey && modelInstance.result.files.fileKey.length > 0) {
            for (let i = 0; i < modelInstance.result.files.fileKey.length; i++) {
              const element = modelInstance.result.files.fileKey[i];
              element.name = element.originalFilename;
            }
          }
          if (modelInstance.result.files.profilepic) {
            modelInstance.result.files.profilepic[0].name = modelInstance.result.files.profilepic[0].originalFilename;
          }
          if (modelInstance.result.files.productmedia && modelInstance.result.files.productmedia.length > 0) {
            for (let i = 0; i < modelInstance.result.files.productmedia.length; i++) {
              const element = modelInstance.result.files.productmedia[i];
              element.name = element.originalFilename;
            }
            console.log(modelInstance.result.files.productmedia);
          }
          if (modelInstance.result.files.requestproduct && modelInstance.result.files.requestproduct.length > 0) {
            for (let i = 0; i < modelInstance.result.files.requestproduct.length; i++) {
              const element = modelInstance.result.files.requestproduct[i];
              element.name = element.originalFilename;
            }
            console.log(modelInstance.result.files.requestproduct);
          }
          if (modelInstance.result.files.tempmedia) {
            modelInstance.result.files.tempmedia[0].name = modelInstance.result.files.tempmedia[0].originalFilename;
          }
        }
      }

      if (ctx.req.headers.masterdetailid === null || ctx.req.headers.masterdetailid === 'null') {
        if (modelInstance.result.files.tempmedia) {
          modelInstance.result.files.tempmedia[0].name = modelInstance.result.files.tempmedia[0].originalFilename;
        }
      }

      next();
    } catch (error) {
      throw error;
    }
  });

  Container.beforeRemote('download', async (ctx, modelInstance, next) => {
    var accesstokenModel = app.models.AccessToken;
    try {

      // When accesstoken in request set masterdetailId
      if (ctx.req.headers.authorization) {
        var accessTokenDetails = await accesstokenModel.findOne({
          where: {
            id: ctx.req.headers.authorization
          }
        });
        ctx.req.headers.masterdetailid = accessTokenDetails.masterdetailId;
      }

      var getFileUploadSetting = await settingConstants.getTenantSettingValueBasedOnKey(settingConstants.FILE_UPLOAD_KEY, ctx.req.headers.masterdetailid);
      console.log('getFileUploadSetting', getFileUploadSetting);

      // var getFileUploadSetting = 'FileSystem'
      if (getFileUploadSetting === settingConstants.FILE_UPLOAD_TO_S3) {
        // Attach S3 bucket into Request
        ctx.args.container = s3Constants.S3_BUCKET;
        // Manage environment of server
        var environment;
        if (app.get('isProduction')) {
          environment = 'prod/';
        } else {
          environment = 'dev/';
        }
        ctx.args.file = environment + ctx.args.req.params.container + '/' + ctx.args.file;
        // // default image/files List
        // const defaultImages = ['default_category.png', 'noimagefound.png', 'defaultuser.jpeg', 'user.xlsx', 'category.xlsx', 'pincode.xlsx', 'product.xlsx', 'subcategory.xlsx'];
        // // create file name as per s3 requirement
        // if (defaultImages.includes(ctx.args.file)) {
        //   ctx.args.file = environment + ctx.args.req.params.container + '/' + ctx.args.file;
        // } else {
        //   // split ther file name and get container
        //   var getFolderName = ctx.args.file.split('_');
        //   // Attach Instance Code into Request
        //   var getMasterDetails = await app.models.masterdetail.findOne({
        //     where: {
        //       id: ctx.req.headers.masterdetailid
        //     }
        //   });
        //   ctx.args.file = environment + getFolderName[0] + '-' + getMasterDetails.codename + '/' + ctx.args.file;
        // }
        console.log('Location Of File ---- ', ctx.args.file);
      }
      next();
    } catch (error) {
      throw error;
    }
  });

};
