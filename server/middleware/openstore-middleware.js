var app = require('../server');
var constants = require('../../common/const');

module.exports = function (options) {

  return async function (req, res, next) {
    var userModel = app.models.user;
    var accesstokenModel = app.models.AccessToken;
    var commonCounterModel = app.models.commoncounter;
    var usermetaauthModel = app.models.usermetaauth;
    var notifyModel = app.models.notify;
    var settingModel = app.models.setting;
    var masterdetailModel = app.models.masterdetail;

    try {

      // Check request is from valid store or not      
      // if (req.originalUrl.includes('masterdetails/getMasterDetailsFromURL' && req.method == 'GET')) {
      //   next();
      // }

      if (
        req && req.headers && req.headers.instancedomain && req.headers.instanceurl &&
        req.headers.instancedomain !== 'null' && req.headers.instanceurl !== 'null' && req.headers.masterdetailid !== 'null') {

        /**
         * Step 1 - get header (instance name) 
         * Step 2 - get masterdetailId of particular instance name
         * Step 3 - Compare MID
         * Step 4 - If match go ahead
         * Step 5 - if not match throw error (Access Forbidden)
         */

        // if (req.headers.authorization) {
        //   var accessTokenDetails = await accesstokenModel.findOne({
        //     where: {
        //       id: req.headers.authorization
        //     }
        //   });
        //   req.headers.masterdetailid = accessTokenDetails.masterdetailId;
        // }

        //  Check masterdetailid valid or not
        if (!req.headers.masterdetailid && req.headers.masterdetailid === 'null' && req.headers.masterdetailid == null) {
          next(constants.createError(404, 'Masterdetail Id not found.'));
        }

        var descriptionData = await app.models.masterdetail.findOne({
          where: {
            id: req.headers.masterdetailid
          }
        });

        if (descriptionData) {
          descriptionData = JSON.parse(descriptionData.description);
        } else {
          // When no masterdetailId exist
          next(constants.createError(406, 'Access forbidden.'));
        }

        // Match With domainURL
        var getDomainDetails = await getDescriptionKeyData(descriptionData, 'domainURL');
        if (getDomainDetails) {
          if (getDomainDetails && getDomainDetails.value !== req.headers.instancedomain) {
            // Match With webstoreURL
            var getURLDetails = await getDescriptionKeyData(descriptionData, 'webstoreURL');
            if (getURLDetails && getURLDetails.value !== req.headers.instanceurl) {
              next(constants.createError(406, 'Access forbidden.'));
            }
          }
        }
        if (!getDomainDetails) {
          // Match With domainURL
          var getURLDetails = await getDescriptionKeyData(descriptionData, 'webstoreURL');
          if (getURLDetails && getURLDetails.value !== req.headers.instanceurl) {
            next(constants.createError(406, 'Access forbidden.'));
          }
        }

      }

      // Open store middleware
      if (req.headers.openstoreid && req.headers.masterdetailid !== 'null') {

        //  Check masterdetailid valid or not
        if (!req.headers.masterdetailid && req.headers.masterdetailid == null) {
          next(constants.createError(404, 'Masterdetail Id not found.'));
        }

        var getOpenStoreSetting = await getSetting({
          registerallow: constants.SETTING_OPEN_STORE,
          masterdetailId: req.headers.masterdetailid
        });

        if (getOpenStoreSetting && getOpenStoreSetting.status === 1 && req.headers.openstoreid) {
          //  Check openstoreid
          if (!req.headers.openstoreid) {
            next(constants.createError(404, 'Store not found.'));
          }

          //  Check uuid is valid or not
          if (req.headers.openstoreid.length != 36) {
            next(constants.createError(400, 'Open Store Id is not valid.'));
          }

          var getMasterdetailIData = await constants.commonFindOneFunction({
            model: app.models.masterdetail,
            whereObj: {
              id: req.headers.masterdetailid
            }
          });

          // When session in request check user exist with provided openstoreid 
          var getUser = await constants.commonFindOneFunction({
            model: userModel,
            whereObj: {
              id: req.headers.openstoreid
            }
          });

          var getGroupId = await getDefaultGroupId({
            masterdetailId: getMasterdetailIData.id
          });

          // When user exist find accesstoken
          if (!getUser) {
            // Create user
            getUser = await userModel.patchOrCreate({
              id: req.headers.openstoreid,
              roleId: constants.GUEST_ROLEID,
              groupId: getGroupId.id,
              isregistered: true,
              password: 'b2buser@123',
              userstatus: 'Active',
              registervia: 'ADMIN',
              created: new Date(),
              modified: new Date(),
              masterdetailId: getMasterdetailIData.id,
              cellVerified: 1,
              admincreated: 1,
              emailVerified: 1
            });

          }

          // Check Accesstoken
          var getAccesstoken = await app.models.AccessToken.findOne({
            where: {
              masterdetailId: req.headers.masterdetailid,
              userId: getUser.id
            }
          });


          if (getAccesstoken) {
            // set to unlimited time to accesstoken
            await accesstokenModel.updateAll({
              id: getAccesstoken.id,
              userId: getAccesstoken.userId,
              masterdetailId: getMasterdetailIData.id
            }, {
              ttl: -1
            });
          } else {
            // create accessToken lifetime
            getAccesstoken = await accesstokenModel.create({
              ttl: -1,
              userId: getUser.id,
              masterdetailId: getMasterdetailIData.id
            });
          }

          // Attach accesstoken manually to request
          req.headers.authorization = getAccesstoken.id;

          // Check CommonCounter
          var getCommonCounter = await constants.commonFindOneFunction({
            model: commonCounterModel,
            whereObj: {
              userId: req.headers.openstoreid,
              masterdetailId: getMasterdetailIData.id
            }
          });
          if (getCommonCounter) {
            // set to cart & notification 0
            await commonCounterModel.updateAll({
              id: getCommonCounter,
              masterdetailId: getMasterdetailIData.id
            }, {
              cart: 0,
              notifications: 0
            });
          } else {
            // Entry in commoncounterModel
            await commonCounterModel.create({
              userId: getUser.id,
              notifications: 0,
              cart: 0,
              masterdetailId: getMasterdetailIData.id
            });
          }

          // Check group
          if (!getUser.groupId || (getUser.groupId !== getGroupId)) {
            await userModel.updateAll({
              id: getUser.id
            }, {
              groupId: getGroupId
            });
          }

          // Check CommonCounter
          var getUsermetaAuthDetails = await constants.commonFindOneFunction({
            model: usermetaauthModel,
            whereObj: {
              userId: req.headers.openstoreid,
              masterdetailId: getMasterdetailIData.id
            }
          });
          if (!getUsermetaAuthDetails) {
            // Entry in usermetaauthModel
            await usermetaauthModel.create({
              userId: getUser.id,
              pushnotification: 1,
              masterdetailId: getMasterdetailIData.id
            });
          }

          // Rople Mapping
          var getRoleMapping = await constants.commonFindOneFunction({
            model: app.models.rolemapping,
            whereObj: {
              principalId: req.headers.openstoreid,
              roleId: constants.USER_ROLEID,
              masterdetailId: getMasterdetailIData.id
            }
          });
          if (!getRoleMapping) {
            // Entry in RoleMapping
            await createRoleMapping({
              principalType: "USER",
              principalId: getUser.id,
              roleId: constants.USER_ROLEID,
              masterdetailId: getUser.masterdetailId
            });
          }
        } else {
          next(constants.createError(400, 'Oper Store Not Available Currently.'));
        }

      }

      next();
    } catch (error) {

      next(error);
    }
  };

  async function getDefaultGroupId(options) {
    var getGroup = await constants.commonFindOneFunction({
      model: app.models.group,
      whereObj: {
        name: constants.DEFAULT,
        masterdetailId: options.masterdetailId
      }
    });
    return getGroup.id;
  };

  async function createRoleMapping(params) {
    await app.models.rolemapping.create({
      principalType: params.principalType,
      principalId: params.principalId,
      roleId: params.roleId,
      masterdetailId: params.masterdetailId
    });
  }

  async function getSetting(params) {
    return await app.models.setting.findOne({
      where: {
        registerallow: params.registerallow,
        masterdetailId: params.masterdetailId
      }
    });
  }

  async function getDescriptionKeyData(descriptionData, key) {
    return descriptionData = descriptionData.find(e => e.key === key);
  }

};
