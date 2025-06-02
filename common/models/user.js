"use strict";
const app = require("../../server/server");
const titlecase = require("title-case");
const constants = require("../../common/const");
const randomString = require("random-base64-string");
const settingConstants = require("../setting_constants");

module.exports = function (User) {
  const allow = "ALLOW";
  const admin = "ADMIN";
  const adminapprove = "ADMINAPPROVE";
  const activestatus = "Active";
  const deactivestatus = "Deactive";
  const pendingstatus = "Pending";

  User.beforeRemote("create", async (ctx, modelInstance) => {
    var settingModel = app.models.setting;
    var userModel = app.models.user;
    var stateModel = app.models.state;
    var cityModel = app.models.city;

    try {
      if (ctx.args.data.roleId === constants.SALESMAN_ROLEID) {
        // Check Number Of Salesman Account Limit
        var result = await constants.getCurrentMarchantPlan(
          constants.CURRENT_MERCHANT_PLAN_LABEL,
          1,
          ctx.args.data.masterdetailId
        );
        var totalSalesmanLimit =
          await constants.commonCheckPlanCriteriaFeatures(
            result,
            ctx.args.data.masterdetailId,
            constants.NUMBER_OF_STAFF_ACCOUNT_KEY
          );
        // Check Product Limit
        var lengthQuery =
          "SELECT COUNT(id) as count FROM `user` WHERE deletedAt IS NULL AND roleId = 3 AND masterdetailId = '" +
          ctx.args.data.masterdetailId +
          "'";
        var salesmanLength = await new Promise((resolve, reject) => {
          app.datasources.mysql.connector.execute(
            lengthQuery,
            null,
            (err, result) => {
              if (err) reject(err);
              resolve(result);
            }
          );
        });

        if (salesmanLength[0].count >= totalSalesmanLimit) {
          throw constants.createError(
            404,
            "You have rich maximum limit of salesman!"
          );
        }

        if (!ctx.args.data.reportingto) {
          // Get Admin Id for reportingto bydefault
          var getAdminId = await User.findOne({
            where: {
              masterdetailId: ctx.args.data.masterdetailId,
              roleId: constants.ADMIN_ROLEID,
            },
          });
          ctx.args.data.reportingto = getAdminId.id;
        }
      }

      if (ctx.args.data.roleId === constants.DEALER_ROLEID) {
        if (ctx.args.data.cityId) {
          // check whether city exists or not
          var isCityExist = await app.models.city.findOne({
            where: {
              id: ctx.args.data.cityId,
              masterdetailId: ctx.args.data.masterdetailId,
            },
          });
          if (!isCityExist) {
            throw constants.createError(404, "City not found");
          }
        }
      }

      var getTenantConfig = await settingModel.findOne({
        where: {
          registerallow: constants.SETTING_TENANT_CONFIG,
          masterdetailId: ctx.args.data.masterdetailId,
        },
      });

      if (getTenantConfig) {
        getTenantConfig = constants.parseJson(getTenantConfig.text);
        if (
          ctx.args.data.discount &&
          (ctx.args.data.roleId === constants.DEALER_ROLEID ||
            ctx.args.data.roleId === constants.SALESMAN_ROLEID)
        ) {
          if (ctx.args.data.discount > getTenantConfig.maxDiscountPercentage) {
            throw constants.createError(
              400,
              "Maximum discount limit is " +
                getTenantConfig.maxDiscountPercentage +
                ", So apply less than that."
            );
          }
        }
        if (
          !ctx.args.data.discount &&
          (ctx.args.data.roleId === constants.DEALER_ROLEID ||
            ctx.args.data.roleId === constants.SALESMAN_ROLEID)
        ) {
          ctx.args.data.discount = getTenantConfig.maxDiscountPercentage;
        }
      }

      // verify email
      if (ctx.args.data.email && ctx.args.data.email.length == 0) {
        ctx.args.data.email = null;
      }
      if (ctx.args.data.email) {
        var isvalid = validateEmail(ctx.args.data.email);
        if (!isvalid) {
          throw constants.createError(400, "Please enter valid email address.");
        }
        var isEmailExist = await User.find({
          where: {
            masterdetailId: ctx.args.data.masterdetailId,
            email: ctx.args.data.email,
          },
        });

        if (isEmailExist.length > 0) {
          var getUser = isEmailExist.find(
            (item) => item.email === ctx.args.data.email
          );
          if (getUser && getUser.roleId === constants.SALESMAN_ROLEID) {
            throw constants.createError(
              403,
              "Already registered as a salesman, Try with another email address"
            );
          } else if (getUser && getUser.roleId === constants.ADMIN_ROLEID) {
            throw constants.createError(
              403,
              "Already registered as a marchant, Try with another email address"
            );
          } else if (getUser && getUser.roleId === constants.USER_ROLEID) {
            throw constants.createError(
              403,
              "Already registered as a customer, Try with another email address"
            );
          } else if (getUser && getUser.roleId === constants.DEALER_ROLEID) {
            throw constants.createError(
              403,
              "Already registered as a dealer, Try with another email address"
            );
          }
        }
      }
      // verify gstin
      if (ctx.args.data.gstin) {
        var isvalid = validGSTIN(ctx.args.data.gstin);
        if (!isvalid) {
          throw constants.createError(400, "Please enter valid gst number.");
        }
      }
      //Captalizing companyname
      if (ctx.args.data.companyname) {
        ctx.args.data.companyname = titlecase.titleCase(
          ctx.args.data.companyname
        );
      }
      //Captalizing name
      if (ctx.args.data.firstname) {
        ctx.args.data.firstname = titlecase.titleCase(ctx.args.data.firstname);
      }
      if (ctx.args.data.lastname) {
        ctx.args.data.lastname = titlecase.titleCase(ctx.args.data.lastname);
      }
      if (ctx.args.data.username) {
        ctx.args.data.username = titlecase.titleCase(ctx.args.data.username);
      }

      if (ctx.args.data.cityId && ctx.args.data.cityId.length == 0) {
        ctx.args.data.cityId = null;
      }

      // stringify Billing & Shipping & Transport Object before insert
      if (ctx.args.data.billingaddress) {
        /**
         * Attach Below Keys In Billing as well as shipping
         * 1. name : FN && LN ? FN && LN : username
         * 2. mobile : cellnumber of user
         * 3. companyname :
         * 4. gstin :
         * 5. email :
         */
        // Set Country name
        var setCountryName = await stateModel.findOne({
          where: {
            id: ctx.args.data.billingaddress.countryId,
            masterdetailId: ctx.args.data.masterdetailId,
          },
        });
        ctx.args.data.billingaddress.countryname = setCountryName.name;
        // Set State name
        var setStateName = await stateModel.findOne({
          where: {
            id: ctx.args.data.billingaddress.stateId,
            masterdetailId: ctx.args.data.masterdetailId,
          },
        });
        ctx.args.data.billingaddress.statename = setStateName.name;
        // Set City Name
        var setCityName = await cityModel.findOne({
          where: {
            id: ctx.args.data.billingaddress.cityId,
            masterdetailId: ctx.args.data.masterdetailId,
          },
        });
        ctx.args.data.billingaddress.cityname = setCityName.name;
        // set mobile
        ctx.args.data.billingaddress.mobile = ctx.args.data.cellnumber;
        // set name
        ctx.args.data.firstname && ctx.args.data.lastname
          ? (ctx.args.data.billingaddress.name = ctx.args.data.firstname.concat(
              ctx.args.data.lastname
            ))
          : (ctx.args.data.billingaddress.name = ctx.args.data.username);

        // set companyname
        ctx.args.data.companyname
          ? (ctx.args.data.billingaddress.companyname =
              ctx.args.data.companyname)
          : (ctx.args.data.billingaddress.companyname = "");
        // set gstin
        ctx.args.data.gstin
          ? (ctx.args.data.billingaddress.gstin = ctx.args.data.gstin)
          : (ctx.args.data.billingaddress.gstin = "");
        // set email
        ctx.args.data.email
          ? (ctx.args.data.billingaddress.email = ctx.args.data.email)
          : (ctx.args.data.billingaddress.email = "");
        // stringify billingaddress
        ctx.args.data.billingaddress = JSON.stringify(
          ctx.args.data.billingaddress
        );
      }
      if (ctx.args.data.shippingaddress) {
        // Set Country name
        var setCountryName = await stateModel.findOne({
          where: {
            id: ctx.args.data.shippingaddress.countryId,
            masterdetailId: ctx.args.data.masterdetailId,
          },
        });
        ctx.args.data.shippingaddress.countryname = setCountryName.name;
        // Set State name
        var setStateName = await stateModel.findOne({
          where: {
            id: ctx.args.data.shippingaddress.stateId,
            masterdetailId: ctx.args.data.masterdetailId,
          },
        });
        ctx.args.data.shippingaddress.statename = setStateName.name;
        // Set City Name
        var setCityName = await cityModel.findOne({
          where: {
            id: ctx.args.data.shippingaddress.cityId,
            masterdetailId: ctx.args.data.masterdetailId,
          },
        });
        ctx.args.data.shippingaddress.cityname = setCityName.name;
        // set mobile
        ctx.args.data.shippingaddress.mobile = ctx.args.data.cellnumber;
        // set name
        ctx.args.data.firstname && ctx.args.data.lastname
          ? (ctx.args.data.shippingaddress.name =
              ctx.args.data.firstname.concat(ctx.args.data.lastname))
          : (ctx.args.data.shippingaddress.name = ctx.args.data.username);

        // set companyname
        ctx.args.data.companyname
          ? (ctx.args.data.shippingaddress.companyname =
              ctx.args.data.companyname)
          : (ctx.args.data.shippingaddress.companyname = "");
        // set gstin
        ctx.args.data.gstin
          ? (ctx.args.data.shippingaddress.gstin = ctx.args.data.gstin)
          : (ctx.args.data.shippingaddress.gstin = "");
        // set email
        ctx.args.data.email
          ? (ctx.args.data.shippingaddress.email = ctx.args.data.email)
          : (ctx.args.data.shippingaddress.email = "");
        // stringify shippingaddress
        ctx.args.data.shippingaddress = JSON.stringify(
          ctx.args.data.shippingaddress
        );
      }

      if (ctx.args.data.transport) {
        ctx.args.data.transport = JSON.stringify(ctx.args.data.transport);
      }

      // Default group id if not selected
      if (
        ctx.args.data.groupId === null ||
        ctx.args.data.groupId === "" ||
        ctx.args.data.groupId === undefined
      ) {
        ctx.args.data.groupId = await constants.default_groupId(
          ctx.args.data.masterdetailId
        );
      }

      // check the registe via status
      var setting = await settingModel.findOne({
        where: {
          status: true,
          masterdetailId: ctx.args.data.masterdetailId,
        },
      });

      var user = await User.findOne({
        where: {
          and: [
            {
              or: [
                {
                  cellnumber: ctx.args.data.cellnumber,
                },
                {
                  email: ctx.args.data.email,
                },
              ],
            },
            {
              masterdetailId: ctx.args.data.masterdetailId,
            },
          ],
        },
      });

      // check the registerVia key- value
      if (setting.registerallow === allow) {
        ctx.args.data.userstatus = activestatus;
        // if registervia key is allow then after successfully sign up var user login into the sys
        // for sign up send otp and verify the otp
        // give a password because we are sign in with otp directly, so we have to password staticly from our side
        ctx.args.data.password = "b2buser@123";
      }

      if (setting.registerallow === admin && ctx.args.data.admincreated) {
        ctx.args.data.userstatus = activestatus;
        // if registervia key is admin then, in this senario user will get the sms of credentials
        // no otp, in this admin will add the user in sys
        // give a password because we are sign in with otp directly, so we have to password staticly from our side
        ctx.args.data.password = "b2buser@123";
      }

      if (setting.registerallow === adminapprove) {
        ctx.args.data.userstatus = deactivestatus;
        //if registervia key is adminapprove then user will create but not able to login into the sys.
        // give a password because we are sign in with otp directly, so we have to password staticly from our side
        ctx.args.data.password = "b2buser@123";
      }

      // When Admin Approve mode is Active Then Set Userstatus = Pending
      if (setting.registerallow === adminapprove) {
        ctx.args.data.userstatus = pendingstatus;
        ctx.args.data.password = "b2buser@123";
      }
      // is register or not

      // registerallow is admin and admincreated is not pass then throw error
      if (setting.registerallow === admin && !ctx.args.data.admincreated) {
        throw constants.createError(400, "Sorry, Admin can create the user");
      }

      if (!user) {
        // if user does not exists, just move forward
        ctx.args.data.password = "b2buser@123";
        return;
      } else if (user.isregistered === false) {
        await userModel.patchOrCreate({
          id: user.id,
          cellnumber: ctx.args.data.cellnumber,
          roleId: ctx.args.data.roleId,
          cityId: ctx.args.data.cityId,
          groupId: ctx.args.data.groupId,
          companyname: ctx.args.data.companyname,
          username: ctx.args.data.username,
          isregistered: true,
          password: ctx.args.data.password,
          created: new Date(),
          modified: new Date(),
          reportingto: ctx.args.data.reportingto,
          masterdetailId: ctx.args.data.masterdetailId,
        });
        return;
      } else {
        if (user.roleId === constants.SALESMAN_ROLEID) {
          throw constants.createError(
            400,
            "Already registered as a salesman, Try with another cellnumber"
          );
        } else if (user.roleId === constants.USER_ROLEID) {
          throw constants.createError(
            400,
            "Already registered as a customer, Try with another cellnumber"
          );
        } else if (user.roleId === constants.ADMIN_ROLEID) {
          throw constants.createError(
            400,
            "Already registered as a merchant, Try with another cellnumber"
          );
        } else if (getUser && getUser.roleId === constants.DEALER_ROLEID) {
          throw constants.createError(
            403,
            "Already registered as a dealer, Try with another email address"
          );
        }
      }
    } catch (err) {
      throw err;
    }
  });

  User.afterRemote("create", async (ctx, modelInstance, next) => {
    var usermetaauthModel = app.models.usermetaauth;
    var accessToken = app.models.AccessToken;
    var commoncounterModel = app.models.commoncounter;
    var notifyModel = app.models.notify;
    var settingModel = app.models.setting;
    var rolemappingModel = app.models.RoleMapping;
    var groupModel = app.models.group;
    var salesmanCity = app.models.salesmancity;

    try {
      if (
        ctx.args.data.roleId === constants.SALESMAN_ROLEID ||
        ctx.args.data.roleId === constants.DEALER_ROLEID
      ) {
        if (ctx.args.data.citydata) {
          for (let i = 0; i < ctx.args.data.citydata.length; i++) {
            const element = ctx.args.data.citydata[i].id;
            await salesmanCity.create({
              userId: modelInstance.id,
              cityId: element,
              masterdetailId: modelInstance.masterdetailId,
            });
          }
        }
      }
      if (ctx.args.data.roleId === constants.DEALER_ROLEID) {
        // get customer which BelongsTo city and reportingto no one
        var getCustomer = await User.find({
          where: {
            cityId: ctx.args.data.cityId,
            roleId: constants.USER_ROLEID,
            masterdetailId: ctx.args.data.masterdetailId,
            reportingto: {
              eq: null,
            },
          },
        });

        if (getCustomer.length > 0) {
          getCustomer.filter(async (item) => {
            await User.update(
              {
                id: item.id,
                masterdetailId: ctx.args.data.masterdetailId,
              },
              {
                reportingto: modelInstance.id,
              }
            );
          });
        }
      }

      // update counter of no. of user in group table
      if (ctx.args.data.groupId) {
        var groupdetail = await groupModel.findOne({
          where: {
            id: ctx.args.data.groupId,
            masterdetailId: modelInstance.masterdetailId,
          },
        });
        await groupModel.updateAll(
          {
            id: ctx.args.data.groupId,
            masterdetailId: modelInstance.masterdetailId,
          },
          {
            noofusers: groupdetail.noofusers + 1,
          }
        );
      }
      // Entry in commoncounterModel
      await commoncounterModel.create({
        userId: modelInstance.id,
        notifications: 0,
        cart: 0,
        masterdetailId: modelInstance.masterdetailId,
      });
      // Entry in usermetaauthModel
      await usermetaauthModel.create({
        userId: modelInstance.id,
        pushnotification: 1,
        masterdetailId: modelInstance.masterdetailId,
        tempcell: ctx.args.data.cellnumber,
      });
      // create entry in rolemapping table
      if (ctx.args.data.roleId == constants.SALESMAN_ROLEID) {
        await createRoleMapping({
          principalType: "SALESMAN",
          principalId: modelInstance.id,
          roleId: constants.SALESMAN_ROLEID,
          masterdetailId: modelInstance.masterdetailId,
        });
      } else if (ctx.args.data.roleId == constants.DEALER_ROLEID) {
        await createRoleMapping({
          principalType: "DEALER",
          principalId: modelInstance.id,
          roleId: constants.DEALER_ROLEID,
          masterdetailId: modelInstance.masterdetailId,
        });
      } else {
        await createRoleMapping({
          principalType: "USER",
          principalId: modelInstance.id,
          roleId: constants.USER_ROLEID,
          masterdetailId: modelInstance.masterdetailId,
        });
      }

      // modelInstance.unsetAttribute("id");
      var temperoryToken = await accessToken.create({
        ttl: -1,
        userId: modelInstance.id,
        masterdetailId: modelInstance.masterdetailId,
      });
      modelInstance.apitoken = temperoryToken.id;

      // if admin add the user then sms of credenticals will go to user
      if (modelInstance.registervia === admin) {
        var getMasterData = await app.models.masterdetail.findOne({
          where: {
            id: modelInstance.masterdetailId,
          },
        });
        var getLink = "";
        if (getMasterData) {
          var descriptionData = JSON.parse(getMasterData.description);
          if (descriptionData && descriptionData.length > 0) {
            getLink = descriptionData.find(
              (item) => item.key === "webstoreURL"
            );
          }
        }
        modelInstance.webstoreLink =
          app.get("serverConfig").webstore_url + getLink.value;
        await notifyModel.share("CREDENTIALS/SMS", modelInstance, {
          masterdetailId: modelInstance.masterdetailId,
        });
      }
    } catch (error) {
      throw error;
    }
  });

  User.beforeRemote("login", async (ctx, modelInstance, next) => {
    try {
      if (
        ctx &&
        ctx.args &&
        ctx.args.credentials &&
        ctx.args.credentials.roleId &&
        ctx.args.credentials.roleId === 6
      ) {
        var findSuperAdmin = await User.findOne({
          where: {
            roleId: 6,
          },
        });
        if (findSuperAdmin) {
          ctx.args.credentials.masterdetailId = findSuperAdmin.masterdetailId;
        } else {
          throw constants.createError(400, "User not found");
        }
      }

      var conditionArray = [];
      if (ctx.args.credentials.cellnumber) {
        conditionArray.push({ cellnumber: ctx.args.credentials.cellnumber });
      }

      if (ctx.args.credentials.username) {
        conditionArray.push({ username: ctx.args.credentials.username });
      }

      if (ctx.args.credentials.email) {
        conditionArray.push({ email: ctx.args.credentials.email });
      }

      conditionArray.push({
        roleId: ctx.args.credentials.roleId,
        masterdetailId: ctx.args.credentials.masterdetailId,
      });

      var userDetails = await User.findOne({
        where: {
          and: conditionArray,
        },
      });

      if (!userDetails) {
        throw constants.createError(400, "User not found");
      }

      if (userDetails.userstatus === deactivestatus) {
        throw constants.createError(
          400,
          "Your account is not active, please try again later"
        );
      }

      // pass roleId one for admin to login in App
      if (
        userDetails.roleId === constants.USER_ROLEID ||
        userDetails.roleId === constants.SALESMAN_ROLEID ||
        userDetails.roleId === constants.DEALER_ROLEID
        // userDetails.roleId === constants.SUPER_ADMIN_ROLEID
      ) {
        // pass the password in field
        ctx.args.credentials.email = userDetails.email;
        ctx.args.credentials.username = userDetails.username;
        ctx.args.credentials.password = "b2buser@123";
      }
    } catch (error) {
      throw error;
    }
  });

  User.afterRemote("login", async (ctx, modelInstance, next) => {
    var accessToken = app.models.AccessToken;

    try {
      var conditionArray = [];
      if (ctx.args.credentials.cellnumber) {
        conditionArray.push({ cellnumber: ctx.args.credentials.cellnumber });
      }

      if (ctx.args.credentials.username) {
        conditionArray.push({ username: ctx.args.credentials.username });
      }

      if (ctx.args.credentials.email) {
        conditionArray.push({ email: ctx.args.credentials.email });
      }

      conditionArray.push({
        roleId: ctx.args.credentials.roleId,
        masterdetailId: ctx.args.credentials.masterdetailId,
      });

      var user = await User.findOne({
        where: {
          and: conditionArray,
        },
      });

      // wholeseller
      if (ctx.args.credentials.email) {
        var temperoryToken = await accessToken.create({
          ttl: -1, // Chnaged ttl to -1 from 1209600 for creating permanent AccessToken : Parth dt_20-04-2021
          userId: user.id,
          masterdetailId: ctx.args.credentials.masterdetailId,
        });

        if (user.roleId === constants.ADMIN_ROLEID) {
          // Get Tenant Config Setting
          var getTenantConfigSetting = await app.models.setting.findOne({
            where: {
              masterdetailId: user.masterdetailId,
              registerallow: constants.SETTING_TENANT_CONFIG,
            },
          });
          if (getTenantConfigSetting) {
            getTenantConfigSetting = JSON.parse(getTenantConfigSetting.text);
            modelInstance.isShowXEModule =
              getTenantConfigSetting.isShowXEModule;
          }
        }

        modelInstance.userId = temperoryToken.userId;
        modelInstance.apitoken = temperoryToken.id;
        modelInstance.roleId = user.roleId;
        modelInstance.unsetAttribute("id");
        return modelInstance;
      }

      var temperoryToken = await accessToken.create({
        ttl: -1,
        userId: user.id,
        masterdetailId: ctx.args.credentials.masterdetailId,
      });

      if (user.roleId === constants.ADMIN_ROLEID) {
        // Get Tenant Config Setting
        var getTenantConfigSetting = await app.models.setting.findOne({
          where: {
            masterdetailId: user.masterdetailId,
            registerallow: constants.SETTING_TENANT_CONFIG,
          },
        });
        if (getTenantConfigSetting) {
          getTenantConfigSetting = JSON.parse(getTenantConfigSetting.text);
          modelInstance.isShowXEModule = getTenantConfigSetting.isShowXEModule;
        }
      }

      modelInstance.apitoken = temperoryToken.id;
      modelInstance.userId = temperoryToken.userId;
      modelInstance.roleId = user.roleId;
      modelInstance.unsetAttribute("id");
    } catch (error) {
      throw error;
    }
  });

  User.afterRemote("deleteById", async (ctx, modelInstnace, next) => {
    // Remove user meta auth
    var usermetaauthModel = app.models.usermetaauth;
    var commonCounterModel = app.models.commoncounter;
    var accessTokenModel = app.models.AccessToken;
    try {
      // decrease user count in group
      var userGroupDetail = await User.findOne({
        where: {
          id: ctx.req.params.id,
          masterdetailId: ctx.req.query.where.masterdetailId,
        },
        deleted: true,
      });

      if (userGroupDetail && userGroupDetail.roleId === 4) {
        await User.updateAll(
          {
            reportingto: ctx.req.params.id,
            masterdetailId: ctx.req.query.where.masterdetailId,
          },
          {
            reportingto: null,
          }
        );
      }

      if (
        userGroupDetail &&
        userGroupDetail.roleId === 2 &&
        userGroupDetail.groupId != null
      ) {
        var groupUserDetail = await constants.commonFindOneFunction({
          model: app.models.group,
          whereObj: {
            id: userGroupDetail.groupId,
            masterdetailId: ctx.req.query.where.masterdetailId,
          },
        });

        await app.models.group.updateAll(
          {
            id: userGroupDetail.groupId,
            masterdetailId: ctx.req.query.where.masterdetailId,
          },
          {
            noofusers: groupUserDetail.noofusers - 1,
          }
        );
      }

      // delete device token as well
      await usermetaauthModel.updateAll(
        {
          userId: ctx.req.params.id,
          masterdetailId: ctx.req.query.where.masterdetailId,
        },
        {
          devicetoken: null,
          deletedAt: new Date(),
        }
      );

      // set cart 0
      await commonCounterModel.updateAll(
        {
          userId: ctx.req.params.id,
          masterdetailId: ctx.req.query.where.masterdetailId,
        },
        {
          cart: 0,
        }
      );

      // get deleted user accesstoken
      var data = await accessTokenModel.find({
        where: {
          userId: ctx.req.params.id,
          masterdetailId: ctx.req.query.where.masterdetailId,
        },
      });
      if (data.length > 0) {
        for (let i = 0; i < data.length; i++) {
          const element = data[i];
          // delete accesstoken as well
          await accessTokenModel.deleteAll({
            id: element.id,
          });
        }
      }
    } catch (error) {
      throw error;
    }
  });

  User.beforeRemote("logout", (ctx, modelInstance, next) => {
    var usermetaauthModel = app.models.usermetaauth;
    try {
      // delete device token as well
      usermetaauthModel.updateAll(
        {
          userId: ctx.req.accessToken.userId,
          masterdetailId: ctx.req.query.where.masterdetailId,
        },
        {
          devicetoken: null,
        }
      );
      next();
    } catch (error) {
      throw error;
    }
  });

  User.beforeRemote(
    "prototype.patchAttributes",
    async (ctx, modelInstance, next) => {
      var userModel = app.models.user;
      var accessTokenModel = app.models.AccessToken;
      var usermetaauthModel = app.models.usermetaauth;
      var notifyModel = app.models.notify;
      var settingModel = app.models.setting;
      var groupModel = app.models.group;
      var stateModel = app.models.state;
      var cityModel = app.models.city;

      try {
        var getCurrentUserDetails = await User.findById(ctx.req.params.id);

        var getFileUploadSetting =
          await settingConstants.getTenantSettingValueBasedOnKey(
            settingConstants.FILE_UPLOAD_KEY,
            getCurrentUserDetails.masterdetailId
          );
        if (getFileUploadSetting === settingConstants.FILE_UPLOAD_TO_S3) {
          if (ctx.args.data.profilepic) {
            var attach_split = ctx.args.data.profilepic.split("/");
            ctx.args.data.profilepic = attach_split[attach_split.length - 1];
          }
        }

        // When Requested user is a guest then convert into user
        if (getCurrentUserDetails.roleId === constants.GUEST_ROLEID) {
          ctx.args.data.roleId = constants.USER_ROLEID;
        }

        if (
          ctx.args.data.userstatus === "ACTIVE" ||
          getCurrentUserDetails.userstatus === "ACTIVE"
        ) {
          ctx.args.data.userstatus = "Active";
        }
        if (
          ctx.args.data.userstatus === "DEACTIVE" ||
          getCurrentUserDetails.userstatus === "DEACTIVE"
        ) {
          ctx.args.data.userstatus = "Deactive";
        }

        // Verify Cell Number
        if (ctx.args.data.cellnumber) {
          var isCellnumberExist = await User.find({
            where: {
              masterdetailId: ctx.args.data.masterdetailId,
              email: ctx.args.data.cellnumber,
            },
          });
          if (isCellnumberExist.length > 0) {
            var getUser = isCellnumberExist.find(
              (item) =>
                item.cellnumber === ctx.args.data.cellnumber &&
                item.id != getCurrentUserDetails.id
            );
            if (getUser && getUser.roleId === constants.SALESMAN_ROLEID) {
              throw constants.createError(
                403,
                "Already registered as a salesman, Try with another cell number"
              );
            } else if (getUser && getUser.roleId === constants.ADMIN_ROLEID) {
              throw constants.createError(
                403,
                "Already registered as a merchant, Try with another cell number"
              );
            } else if (getUser && getUser.roleId === constants.USER_ROLEID) {
              throw constants.createError(
                403,
                "Already registered as a customer, Try with another cell number"
              );
            } else if (getUser && getUser.roleId === constants.DEALER_ROLEID) {
              throw constants.createError(
                403,
                "Already registered as a dealer, Try with another cell number"
              );
            }
          }
        }

        // Verify Email Address
        if (ctx.args.data.email) {
          var isvalid = validateEmail(ctx.args.data.email);
          if (!isvalid) {
            throw constants.createError(
              400,
              "Please enter valid email address."
            );
          }
          var isEmailExist = await User.find({
            where: {
              masterdetailId: ctx.args.data.masterdetailId,
              email: ctx.args.data.email,
            },
          });
          if (isEmailExist.length > 0) {
            var getUser = isEmailExist.find(
              (item) =>
                item.email === ctx.args.data.email &&
                item.id != getCurrentUserDetails.id
            );
            if (getUser && getUser.roleId === constants.SALESMAN_ROLEID) {
              throw constants.createError(
                403,
                "Already registered as a salesman, Try with another email address"
              );
            } else if (getUser && getUser.roleId === constants.ADMIN_ROLEID) {
              throw constants.createError(
                403,
                "Already registered as a marchant, Try with another email address"
              );
            } else if (getUser && getUser.roleId === constants.USER_ROLEID) {
              throw constants.createError(
                403,
                "Already registered as a customer, Try with another email address"
              );
            } else if (getUser && getUser.roleId === constants.DEALER_ROLEID) {
              throw constants.createError(
                403,
                "Already registered as a dealer, Try with another email address"
              );
            }
          }
        }

        // stringify Billing & Shipping & Transport Object before insert
        if (ctx.args.data.billingaddress) {
          // Check cityId provided in request
          if (!ctx.args.data.billingaddress.countryId) {
            throw constants.createError(400, "Please select country");
          }
          // Check cityId provided in request
          if (!ctx.args.data.billingaddress.stateId) {
            throw constants.createError(400, "Please select state");
          }
          // Check cityId provided in request
          if (!ctx.args.data.billingaddress.cityId) {
            throw constants.createError(400, "Please select city");
          }

          // Set Country name
          var setCountryName = await stateModel.findOne({
            where: {
              id: ctx.args.data.billingaddress.countryId,
              masterdetailId: ctx.args.data.masterdetailId,
            },
          });
          ctx.args.data.billingaddress.countryname = setCountryName.name;
          // Set State name
          var setStateName = await stateModel.findOne({
            where: {
              id: ctx.args.data.billingaddress.stateId,
              masterdetailId: ctx.args.data.masterdetailId,
            },
          });
          ctx.args.data.billingaddress.statename = setStateName.name;
          // Set City Name
          var setCityName = await cityModel.findOne({
            where: {
              id: ctx.args.data.billingaddress.cityId,
              masterdetailId: ctx.args.data.masterdetailId,
            },
          });
          ctx.args.data.billingaddress.cityname = setCityName.name;
          // set mobile
          if (
            !ctx.args.data.billingaddress.mobile ||
            ctx.args.data.billingaddress.mobile.length === 0
          ) {
            ctx.args.data.billingaddress.mobile =
              getCurrentUserDetails.cellnumber;
          }
          // set name
          if (
            !ctx.args.data.billingaddress.name ||
            ctx.args.data.billingaddress.name.length === 0
          ) {
            if (
              getCurrentUserDetails.firstname &&
              getCurrentUserDetails.lastname
            ) {
              ctx.args.data.billingaddress.name =
                getCurrentUserDetails.firstname.concat(
                  getCurrentUserDetails.lastname
                );
            } else if (getCurrentUserDetails.username) {
              ctx.args.data.billingaddress.name =
                getCurrentUserDetails.username;
            }
          }

          // set companyname
          ctx.args.data.billingaddress.companyname &&
          ctx.args.data.billingaddress.companyname.length === 0
            ? (ctx.args.data.billingaddress.companyname =
                getCurrentUserDetails.companyname)
            : (ctx.args.data.billingaddress.companyname =
                ctx.args.data.billingaddress.companyname);
          // set gstin
          ctx.args.data.billingaddress.gstin &&
          ctx.args.data.billingaddress.gstin.length === 0
            ? (ctx.args.data.billingaddress.gstin = getCurrentUserDetails.gstin)
            : (ctx.args.data.billingaddress.gstin =
                ctx.args.data.billingaddress.gstin);
          // set email
          ctx.args.data.billingaddress.email &&
          ctx.args.data.billingaddress.email.length === 0
            ? (ctx.args.data.billingaddress.email = getCurrentUserDetails.email)
            : (ctx.args.data.billingaddress.email =
                ctx.args.data.billingaddress.email);
          // stringify billingaddress
          ctx.args.data.billingaddress = JSON.stringify(
            ctx.args.data.billingaddress
          );
        }
        if (ctx.args.data.shippingaddress) {
          // Check cityId provided in request
          if (!ctx.args.data.shippingaddress.countryId) {
            throw constants.createError(400, "Please select country");
          }
          // Check cityId provided in request
          if (!ctx.args.data.shippingaddress.stateId) {
            throw constants.createError(400, "Please select state");
          }
          // Check cityId provided in request
          if (!ctx.args.data.shippingaddress.cityId) {
            throw constants.createError(400, "Please select city");
          }

          // Set Country name
          var setCountryName = await stateModel.findOne({
            where: {
              id: ctx.args.data.shippingaddress.countryId,
              masterdetailId: ctx.args.data.masterdetailId,
            },
          });
          ctx.args.data.shippingaddress.countryname = setCountryName.name;
          // Set State name
          var setStateName = await stateModel.findOne({
            where: {
              id: ctx.args.data.shippingaddress.stateId,
              masterdetailId: ctx.args.data.masterdetailId,
            },
          });
          ctx.args.data.shippingaddress.statename = setStateName.name;
          // Set City Name
          var setCityName = await cityModel.findOne({
            where: {
              id: ctx.args.data.shippingaddress.cityId,
              masterdetailId: ctx.args.data.masterdetailId,
            },
          });
          ctx.args.data.shippingaddress.cityname = setCityName.name;
          // set mobile
          if (
            !ctx.args.data.shippingaddress.mobile ||
            ctx.args.data.shippingaddress.mobile.length === 0
          ) {
            ctx.args.data.shippingaddress.mobile =
              getCurrentUserDetails.cellnumber;
          }
          // set name
          if (
            !ctx.args.data.shippingaddress.name ||
            ctx.args.data.shippingaddress.name.length === 0
          ) {
            if (
              getCurrentUserDetails.firstname &&
              getCurrentUserDetails.lastname
            ) {
              ctx.args.data.shippingaddress.name =
                getCurrentUserDetails.firstname.concat(
                  getCurrentUserDetails.lastname
                );
            } else if (getCurrentUserDetails.username) {
              ctx.args.data.shippingaddress.name =
                getCurrentUserDetails.username;
            }
          }

          // set companyname
          ctx.args.data.shippingaddress.companyname &&
          ctx.args.data.shippingaddress.companyname.length === 0
            ? (ctx.args.data.shippingaddress.companyname =
                getCurrentUserDetails.companyname)
            : (ctx.args.data.shippingaddress.companyname =
                ctx.args.data.shippingaddress.companyname);
          // set gstin
          ctx.args.data.shippingaddress.gstin &&
          ctx.args.data.shippingaddress.gstin.length === 0
            ? (ctx.args.data.shippingaddress.gstin =
                getCurrentUserDetails.gstin)
            : (ctx.args.data.shippingaddress.gstin =
                ctx.args.data.shippingaddress.gstin);
          // set email
          ctx.args.data.shippingaddress.email &&
          ctx.args.data.shippingaddress.email.length === 0
            ? (ctx.args.data.shippingaddress.email =
                getCurrentUserDetails.email)
            : (ctx.args.data.shippingaddress.email =
                ctx.args.data.shippingaddress.email);

          // stringify shippingaddress
          ctx.args.data.shippingaddress = JSON.stringify(
            ctx.args.data.shippingaddress
          );
        }

        /**
         * 1. When user cityId is null
         * 2. Check shipping address city provided if yes than consider as cityId
         * 3. If shipping address not provided than take billing address city is user cityId
         */

        if (
          getCurrentUserDetails.cityId &&
          getCurrentUserDetails.cityId.length === 0
        ) {
          getCurrentUserDetails.cityId = null;
        }

        if (
          !getCurrentUserDetails.cityId &&
          (ctx.args.data.shippingaddress || ctx.args.data.billingaddress)
        ) {
          var isCityExist;
          if (ctx.args.data.shippingaddress) {
            ctx.args.data.shippingaddress = JSON.parse(
              ctx.args.data.shippingaddress
            );
            // Check cityId provided in request
            if (!ctx.args.data.shippingaddress.countryId) {
              throw constants.createError(400, "Please select country");
            }
            // Check cityId provided in request
            if (!ctx.args.data.shippingaddress.stateId) {
              throw constants.createError(400, "Please select state");
            }
            // Check cityId provided in request
            if (!ctx.args.data.shippingaddress.cityId) {
              throw constants.createError(400, "Please select city");
            }
            if (ctx.args.data.shippingaddress.cityId) {
              isCityExist = await getCityDetails({
                id: ctx.args.data.shippingaddress.cityId,
                masterdetailId: ctx.args.data.masterdetailId,
              });
              if (isCityExist) {
                ctx.args.data.cityId = isCityExist.id;
              }
            }
            ctx.args.data.shippingaddress = JSON.stringify(
              ctx.args.data.shippingaddress
            );
          } else if (ctx.args.data.billingaddress) {
            ctx.args.data.billingaddress = JSON.parse(
              ctx.args.data.billingaddress
            );
            // Check cityId provided in request
            if (!ctx.args.data.billingaddress.countryId) {
              throw constants.createError(400, "Please select country");
            }
            // Check cityId provided in request
            if (!ctx.args.data.billingaddress.stateId) {
              throw constants.createError(400, "Please select state");
            }
            // Check cityId provided in request
            if (!ctx.args.data.billingaddress.cityId) {
              throw constants.createError(400, "Please select city");
            }
            if (ctx.args.data.billingaddress.cityId) {
              isCityExist = await getCityDetails({
                id: ctx.args.data.billingaddress.cityId,
                masterdetailId: ctx.args.data.masterdetailId,
              });
              if (isCityExist) {
                ctx.args.data.cityId = isCityExist.id;
              }
            }
            ctx.args.data.billingaddress = JSON.stringify(
              ctx.args.data.billingaddress
            );
          } else {
            throw constants.createError(400, "City not found");
          }
        }
        if (ctx.args.data.transport) {
          var data = JSON.stringify(ctx.args.data.transport);
          ctx.args.data.transport = data;
        }

        // check if pincode delivery is active
        var isPincodeDelivery = await constants.commonFindOneFunction({
          model: app.models.setting,
          whereObj: {
            registerallow: constants.SETTING_PINCODE_DELIVERY,
            masterdetailId: ctx.req.query.where.masterdetailId,
          },
        });

        if (
          isPincodeDelivery &&
          isPincodeDelivery.status === 1 &&
          ctx.args.data.updateShippingPrice == true
        ) {
          var pincodeData = JSON.parse(isPincodeDelivery.text);
          var shippingaddress = JSON.parse(ctx.args.data.shippingaddress);
          var isPincode = false;

          var getOrder = await app.models.order.findOne({
            where: {
              userId: ctx.req.params.id,
              inshoppingcart: 1,
              masterdetailId: ctx.req.query.where.masterdetailId,
            },
          });

          var charges = 0;
          for (let i = 0; i < pincodeData.length; i++) {
            const element = pincodeData[i];
            if (element.pincode == shippingaddress.zipcode) {
              charges = element.charges;
              break;
            }
          }

          // When picode does not match in our list Then set shipping price as 0.
          if (getOrder) {
            await app.models.order.update(
              {
                id: getOrder.id,
                userId: ctx.req.params.id,
                inshoppingcart: 1,
                masterdetailId: ctx.req.query.where.masterdetailId,
              },
              {
                shippingprice: charges,
              }
            );
          }
        }

        // check update profile mode
        var setting = await settingModel.findOne({
          where: {
            registerallow: "IS_USEREDITABLE",
            masterdetailId: ctx.req.query.where.masterdetailId,
          },
        });

        if (setting.status === 0) {
          throw constants.createError(
            400,
            "Edit profile is currently not available"
          );
        }

        // if change or add to group
        if (ctx.args.data.groupId) {
          // find user detail
          var userGroupDetail = await userModel.findOne({
            where: {
              id: ctx.instance.id,
              masterdetailId: ctx.req.query.where.masterdetailId,
            },
          });

          if (userGroupDetail.groupId) {
            // null previous group id
            await userModel.updateAll(
              {
                groupId: userGroupDetail.groupId,
                id: ctx.instance.id,
                masterdetailId: ctx.req.query.where.masterdetailId,
              },
              {
                groupId: null,
              }
            );

            // find groupdetail
            var groupUserDetail = await groupModel.findOne({
              where: {
                id: userGroupDetail.groupId,
                masterdetailId: ctx.req.query.where.masterdetailId,
              },
            });

            // descrese counter of previous group
            await groupModel.updateAll(
              {
                id: userGroupDetail.groupId,
                masterdetailId: ctx.req.query.where.masterdetailId,
              },
              {
                noofusers: groupUserDetail.noofusers - 1,
              }
            );
          }
        }

        // get admin id
        var adminuser = await userModel.findOne({
          where: {
            roleId: constants.ADMIN_ROLEID,
            masterdetailId: ctx.req.query.where.masterdetailId,
          },
        });

        if (ctx.args.data.userstatus === "Deactive") {
          await accessTokenModel.destroyAll(
            {
              userId: ctx.req.params.id,
            },
            {}
          );
        }

        if (ctx.args.data.cellnumber && ctx.req.params.id != adminuser.id) {
          var user = await userModel.findOne({
            where: {
              cellnumber: ctx.args.data.cellnumber,
              masterdetailId: ctx.req.query.where.masterdetailId,
            },
          });

          if (!user) {
            // if user does not exists, just move forward
            notifyModel.share("CELLNUMBER/CHANGE", ctx.args.data, {
              masterdetailId: ctx.req.query.where.masterdetailId,
            });
          } else {
            // check for same number
            if (
              user.cellnumber === ctx.args.data.cellnumber.toString() &&
              user.id != ctx.req.params.id
            ) {
              throw constants.createError(
                400,
                "User Already Exist! Try With Another cellnumber"
              );
            }
          }
        }

        if (
          ctx.args.data.reportingto &&
          ctx.req.accessToken.userId != adminuser.id
        ) {
          throw constants.createError(
            400,
            "Only Admin can assign a user to Dealer / Salesman"
          );
        }

        // store old cellnumber to usermetaauth table
        await usermetaauthModel.updateAll(
          {
            userId: ctx.instance.id,
            masterdetailId: ctx.req.query.where.masterdetailId,
          },
          {
            tempcell: ctx.instance.cellnumber,
          }
        );

        // Check whether reportingTo Salesman or dealer exist or not
        if (
          ctx.args.data.roleId &&
          (ctx.args.data.roleId === constants.SALESMAN_ROLEID ||
            ctx.args.data.roleId === constants.DEALER_ROLEID)
        ) {
          if (ctx.args.data.reportingto) {
            var isExistReportingTo = await User.findOne({
              where: {
                roleId: {
                  inq: [
                    constants.ADMIN_ROLEID,
                    constants.SALESMAN_ROLEID,
                    constants.DEALER_ROLEID,
                  ],
                },
                masterdetailId: ctx.req.query.where.masterdetailId,
              },
            });
            if (!isExistReportingTo) {
              if (ctx.args.data.roleId === constants.SALESMAN_ROLEID) {
                throw constants.createError(
                  400,
                  "Your reporting salesman not exist, Please choose another."
                );
              }
              if (ctx.args.data.roleId === constants.DEALER_ROLEID) {
                throw constants.createError(
                  400,
                  "Your reporting dealer not exist, Please choose another."
                );
              }
            }
          }
        }

        var getTenantConfig = await settingModel.findOne({
          where: {
            registerallow: constants.SETTING_TENANT_CONFIG,
            masterdetailId: ctx.args.data.masterdetailId,
          },
        });

        if (getTenantConfig) {
          getTenantConfig = constants.parseJson(getTenantConfig.text);
          if (
            ctx.args.data.discount &&
            (ctx.args.data.roleId === constants.DEALER_ROLEID ||
              ctx.args.data.roleId === constants.SALESMAN_ROLEID)
          ) {
            if (
              ctx.args.data.discount > getTenantConfig.maxDiscountPercentage
            ) {
              throw constants.createError(
                400,
                "Maximum discount limit is " +
                  getTenantConfig.maxDiscountPercentage +
                  ", So apply less than that."
              );
            }
          }
          if (
            !ctx.args.data.discount &&
            (ctx.args.data.roleId === constants.DEALER_ROLEID ||
              ctx.args.data.roleId === constants.SALESMAN_ROLEID)
          ) {
            ctx.args.data.discount = getTenantConfig.maxDiscountPercentage;
          }
        }
      } catch (error) {
        throw error;
      }
    }
  );

  User.afterRemote("prototype.patchAttributes", async (ctx, modelInstance) => {
    var notifyModel = app.models.notify;
    var userModel = app.models.user;
    var groupModel = app.models.group;
    var salesmanCityModel = app.models.salesmancity;

    try {
      // When we do signup process for guest user attach accesstoken in response
      if (ctx.req.headers.openstoreid) {
        modelInstance.apitoken = ctx.req.headers.authorization;
      }

      var user = await userModel.findOne({
        where: {
          id: modelInstance.id,
          masterdetailId: ctx.req.query.where.masterdetailId,
        },
      });

      // update counter of no. of user in group table
      if (ctx.args.data.groupId) {
        var groupdetail = await groupModel.findOne({
          where: {
            id: ctx.args.data.groupId,
            masterdetailId: ctx.req.query.where.masterdetailId,
          },
        });

        await groupModel.updateAll(
          {
            id: ctx.args.data.groupId,
            masterdetailId: ctx.req.query.where.masterdetailId,
          },
          {
            noofusers: groupdetail.noofusers + 1,
          }
        );
      }

      // send SMS to old cellnumber if cellnumber changed
      if (ctx.args.data.cellnumber) {
        if (user.cellnumber != ctx.args.data.cellnumber) {
          notifyModel.share("CELLNUMBER/CHANGE", modelInstance, {
            masterdetailId: ctx.req.query.where.masterdetailId,
          });
        }
      }

      // update salesmancities
      if (ctx.args.data.citydata) {
        const cityNames = ctx.args.data.citydata.map((d) => d.id);

        // Delete
        var salesmanCityDelete = await salesmanCityModel.find({
          where: {
            userId: ctx.args.data.id,
            masterdetailId: ctx.req.query.where.masterdetailId,
          },
        });

        salesmanCityDelete.map(async (d) => {
          await salesmanCityModel.updateAll(
            {
              id: d.id,
              masterdetailId: ctx.req.query.where.masterdetailId,
            },
            {
              deletedAt: new Date(),
            }
          );
        });

        cityNames.map(async (d) => {
          await salesmanCityModel
            .create({
              userId: modelInstance.id,
              cityId: d,
              masterdetailId: ctx.req.query.where.masterdetailId,
            })
            .catch((err) => {
              next("city created");
            });
        });
      }
    } catch (error) {
      throw error;
    }
  });

  User.beforeRemote("find", async (ctx, modelInstance, next) => {
    var responseData = [];
    try {
      ctx.req.query = ctx.req.query || {};
      ctx.req.query.filter = ctx.req.query.filter || {};
      if (typeof ctx.req.query.filter === "string") {
        ctx.req.query.filter = JSON.parse(ctx.req.query.filter);
        ctx.req.query.filter.where = ctx.req.query.filter.where || {};
        ctx.req.query.filter.where.masterdetailId =
          ctx.req.query.where.masterdetailId;
        ctx.req.query.filter = JSON.stringify(ctx.req.query.filter);
      } else {
        ctx.req.query.filter.where = ctx.req.query.filter.where || {};
        ctx.req.query.filter.where.masterdetailId =
          ctx.req.query.where.masterdetailId;
      }

      // check Plan Commonfunction
      if (
        ctx.args.filter &&
        ctx.args.filter.where &&
        ctx.args.filter.where.checkPermission
      ) {
        var result = await constants.getCurrentMarchantPlan(
          constants.CURRENT_MERCHANT_PLAN_LABEL,
          1,
          ctx.args.filter.where.masterdetailId
        );
        // Check Restriction Customer Management
        var userManagementResponse =
          await constants.commonCheckPlanCriteriaFeatures(
            result,
            ctx.args.filter.where.masterdetailId,
            constants.USER_MANAGEMENT_KEY
          );
        // push result for output
        responseData.push({
          customer_management_permission: userManagementResponse,
        });
        ctx.res.status(200).send(responseData);
      }

      if (
        ctx &&
        ctx.req &&
        ctx.req.query &&
        ctx.req.query.filter &&
        ctx.req.query.filter.where
      ) {
        if (
          ctx.req.query.filter.where.username &&
          ctx.req.query.filter.where.username.like
        ) {
          ctx.req.query.filter.where.username.like =
            ctx.req.query.filter.where.username.like.split("%20").join(" ");
        }
        if (
          ctx.req.query.filter.where.companyname &&
          ctx.req.query.filter.where.companyname.like
        ) {
          ctx.req.query.filter.where.companyname.like =
            ctx.req.query.filter.where.companyname.like.split("%20").join(" ");
        }
        if (ctx.req.query.filter.where.cityId) {
          ctx.req.query.filter.where.cityId = ctx.req.query.filter.where.cityId
            .split("%20")
            .join(" ");
          var getCities = await app.models.city.find({
            where: {
              name: {
                like: "%" + ctx.req.query.filter.where.cityId + "%",
              },
              masterdetailId: ctx.req.query.where.masterdetailId,
            },
          });
          if (getCities.length > 0) {
            var getCityIdArray = await getCities.map((item) => item.id);
            delete ctx.req.query.filter.where.cityId;
            ctx.req.query.filter.where = ctx.req.query.filter.where || {};
            ctx.req.query.filter.where.cityId = {
              inq: getCityIdArray,
            };
            console.log(ctx.req.query.filter.where.cityId.inq);
          }
        }
        if (ctx.req.query.filter.where.groupId) {
          ctx.req.query.filter.where.groupId =
            ctx.req.query.filter.where.groupId.split("%20").join(" ");
          var getCities = await app.models.group.find({
            where: {
              name: {
                like: "%" + ctx.req.query.filter.where.groupId + "%",
              },
              masterdetailId: ctx.req.query.where.masterdetailId,
            },
          });
          if (getCities.length > 0) {
            var getCityIdArray = await getCities.map((item) => item.id);
            delete ctx.req.query.filter.where.groupId;
            ctx.req.query.filter.where = ctx.req.query.filter.where || {};
            ctx.req.query.filter.where.groupId = {
              inq: getCityIdArray,
            };
            console.log(ctx.req.query.filter.where.groupId.inq);
          }
        }
      }
    } catch (error) {
      throw error;
    }
  });

  User.afterRemote("find", async (ctx, modelInstance, next) => {
    var userModel = app.models.user;
    var cityModel = app.models.city;
    var resData = {};

    try {
      // // Check Permission
      // if (ctx.args.filter.where && ctx.args.filter.where.and &&
      //   ctx.args.filter.where.and[0] && ctx.args.filter.where.and[0].checkPermission) {
      //   var hasPermission = await checkPlanCriteria(ctx.args.filter.where.and[0].masterdetailId);
      //   ctx.res.status(200).send({
      //     hasPermission: hasPermission
      //   });
      // }

      if (ctx.req.query.isWeb) {
        if (modelInstance.roleId === 2) {
          for (const key in modelInstance) {
            if (modelInstance.hasOwnProperty(key)) {
              const element = modelInstance[key];

              // if cityId is deleted or not
              if (element.cityId) {
                var city = await cityModel.findOne({
                  where: {
                    id: element.cityId,
                    masterdetailId: ctx.req.query.where.masterdetailId,
                  },
                  deleted: true,
                });
                element.cityname = city;
              }
            }
          }
        }

        for (const key in modelInstance) {
          if (modelInstance.hasOwnProperty(key)) {
            const element = modelInstance[key];
            if (modelInstance[key].roleId === constants.SALESMAN_ROLEID) {
              // if cityId is deleted or not
              if (element.__data.salesmancity) {
                var cities = element.__data.salesmancity;
                var cityArray = [];
                for (const iterator of cities) {
                  var city = await cityModel.findOne({
                    where: {
                      id: iterator.cityId,
                      masterdetailId: ctx.req.query.where.masterdetailId,
                    },
                    deleted: true,
                  });
                  if (city === null) {
                    console.log(iterator.cityId);
                  }
                  cityArray.push(city);
                }
                element.cities = cityArray;
              }
            }
            if (
              modelInstance[key].roleId === constants.SALESMAN_ROLEID ||
              modelInstance[key].roleId === constants.DEALER_ROLEID
            ) {
              if (element.reportingto) {
                var getReportingToSalesmanDetails = await User.findOne({
                  where: {
                    id: element.reportingto,
                  },
                });
                if (getReportingToSalesmanDetails) {
                  element.reportingto = getReportingToSalesmanDetails.username;
                } else {
                  element.reportingto = "--";
                }
              }
            }
          }
        }

        // below if is for Salesman only
        if (ctx.req.query.filter.where && ctx.req.query.filter.where.and) {
          if (ctx.req.query.filter.where.and[0].roleId === 3) {
            var user = await userModel.find({
              where: {
                roleId: 3,
                masterdetailId: ctx.req.query.where.masterdetailId,
              },
            });
            resData.data = modelInstance;
            resData.length = user.length;

            var Activeuser = await userModel.find({
              where: {
                userstatus: "Active",
                roleId: 3,
                masterdetailId: ctx.req.query.where.masterdetailId,
              },
            });

            var Deactiveuser = await userModel.find({
              where: {
                userstatus: "Deactive",
                roleId: 3,
                masterdetailId: ctx.req.query.where.masterdetailId,
              },
            });

            if (ctx.req.query.filter.where && ctx.req.query.filter.where.and) {
              if (ctx.req.query.filter.where.and[0].userstatus === "Active") {
                resData.data = modelInstance;
                resData.length = Activeuser.length;
                ctx.res.status(200).send(resData);
                return;
              } else if (
                ctx.req.query.filter.where.and[0].userstatus === "Deactive"
              ) {
                resData.data = modelInstance;
                resData.length = Deactiveuser.length;
                ctx.res.status(200).send(resData);
                return;
              } else {
                resData.data = modelInstance;
                resData.length = user.length;
                ctx.res.status(200).send(resData);
                return;
              }
            } else {
              ctx.res.status(200).send(resData);
              return;
            }
            return;
          }
        }

        // below code is for role id 2 and others excluding role id 3
        var user = await userModel.find({
          where: {
            roleId: ctx.req.query.filter.where.and[0].roleId,
            masterdetailId: ctx.req.query.where.masterdetailId,
          },
        });
        resData.data = modelInstance;
        resData.length = user.length;

        var Activeuser = await userModel.find({
          where: {
            userstatus: "Active",
            roleId: 2,
            masterdetailId: ctx.req.query.where.masterdetailId,
          },
        });

        var Deactiveuser = await userModel.find({
          where: {
            userstatus: "Deactive",
            roleId: 2,
            masterdetailId: ctx.req.query.where.masterdetailId,
          },
        });

        if (ctx.req.query.filter.where && ctx.req.query.filter.where.and) {
          if (ctx.req.query.filter.where.and[0].userstatus === "Active") {
            resData.data = modelInstance;
            resData.length = Activeuser.length;
            ctx.res.status(200).send(resData);
          } else if (
            ctx.req.query.filter.where.and[0].userstatus === "Deactive"
          ) {
            resData.data = modelInstance;
            resData.length = Deactiveuser.length;
            ctx.res.status(200).send(resData);
          } else {
            resData.data = modelInstance;
            resData.length = user.length;
            ctx.res.status(200).send(resData);
          }
        } else {
          ctx.res.status(200).send(resData);
        }
      }
    } catch (error) {
      throw error;
    }
  });

  User.afterRemote("findById", async (ctx, modelInstance, next) => {
    var usermetaauthModel = app.models.usermetaauth;
    var cityModel = app.models.city;
    var stateModel = app.models.state;
    var salesmanCityModel = app.models.salesmancity;
    var orderModel = app.models.order;
    var orderdetailsModel = app.models.orderdetails;
    var productModel = app.models.product;
    var productmediaModel = app.models.productmedia;
    var categoryModel = app.models.category;

    try {
      var usermetaauth = await usermetaauthModel.findOne({
        where: {
          userId: ctx.req.params.id,
          masterdetailId: ctx.req.query.where.masterdetailId,
        },
      });

      if (usermetaauth) {
        modelInstance.usermetaauthId = usermetaauth.id;
      }

      if (
        modelInstance.roleId === constants.SALESMAN_ROLEID ||
        modelInstance.roleId === constants.DEALER_ROLEID
      ) {
        // salesmen
        // if cityId is deleted or not
        if (modelInstance.__data.salesmancity) {
          var cities = modelInstance.__data.salesmancity;
          var cityArray = [];
          for (const iterator of cities) {
            var city = await cityModel.findOne({
              where: {
                id: iterator.cityId,
                masterdetailId: ctx.req.query.where.masterdetailId,
              },
              deleted: true,
            });
            cityArray.push(city);
          }
          modelInstance.cities = cityArray;
        }

        // Changed By AKIB for add cities for salesman
        var getSalesmanCities = await salesmanCityModel.find({
          where: {
            userId: modelInstance.id,
            masterdetailId: ctx.req.query.where.masterdetailId,
          },
          include: ["city"],
        });
        if (getSalesmanCities.length > 0) {
          // salesCityData.push(getSalesmanCities)
          modelInstance.salesmancitydata = getSalesmanCities;
        }

        // Attach Reposrting to salesman name
        if (modelInstance.reportingto) {
          var getReportedSalesmanData = await User.findById(
            modelInstance.reportingto
          );
          modelInstance.reportingtoSalesmanUsername =
            getReportedSalesmanData.username;
        }
      }

      if (
        modelInstance.roleId === constants.USER_ROLEID ||
        modelInstance.roleId === constants.DEALER_ROLEID
      ) {
        // normal user + Dealer
        modelInstance.cityname = null;
        modelInstance.stateId = null;
        modelInstance.statename = null;
        modelInstance.countryId = null;
        modelInstance.countryname = null;

        if (modelInstance.cityId) {
          var getcityData = await cityModel.findById(modelInstance.cityId);
          modelInstance.cityname = getcityData.name;

          var getStateData = await stateModel.findById(getcityData.stateId);
          modelInstance.stateId = getStateData.id;
          modelInstance.statename = getStateData.name;

          var getCountryData = await stateModel.findById(getStateData.parentId);
          modelInstance.countryId = getCountryData.id;
          modelInstance.countryname = getCountryData.name;
        }
      }

      var getUserFromAccesstoken = await User.findById(
        ctx.req.accessToken.userId
      );
      if (
        getUserFromAccesstoken &&
        getUserFromAccesstoken.roleId === constants.ADMIN_ROLEID
      ) {
        // Manage + Attach -> Order history of particular user
        var getOrdersOfUser = await orderModel.find({
          where: {
            inshoppingcart: 0,
            userId: ctx.req.params.id,
            masterdetailId: ctx.req.query.where.masterdetailId,
          },
        });

        var getOrderDetailsOfUser;
        var orderdetailsList = [];

        if (getOrdersOfUser) {
          for (let i = 0; i < getOrdersOfUser.length; i++) {
            const element = getOrdersOfUser[i];
            orderdetailsList = [];
            getOrderDetailsOfUser = await orderdetailsModel.find({
              where: {
                orderId: element.id,
                masterdetailId: ctx.req.query.where.masterdetailId,
              },
            });
            for (let j = 0; j < getOrderDetailsOfUser.length; j++) {
              const elementDetails = getOrderDetailsOfUser[j];
              // Attach Product Data
              elementDetails.productdata = await productModel.findOne({
                where: {
                  id: elementDetails.productId,
                },
                deleted: true,
                include: ["category", "productmedia"],
              });
              orderdetailsList.push(elementDetails);
            }
            // Attach orderdetails
            element.orderdetail = orderdetailsList;
          }
          modelInstance.order = getOrdersOfUser;
        } else {
          modelInstance.order = [];
        }

        // Manage + Attach -> Request product history of particular user
        var getRequestProductOfUser = await orderModel.find({
          where: {
            inshoppingcart: 3,
            userId: ctx.req.params.id,
            masterdetailId: ctx.req.query.where.masterdetailId,
          },
        });

        if (getRequestProductOfUser) {
          for (let i = 0; i < getRequestProductOfUser.length; i++) {
            const element = getRequestProductOfUser[i];
            // Attach Category Details
            if (element.categoryId) {
              element.categoryDetails = await categoryModel.findById(
                element.categoryId
              );
            }
            // Attach Request Product Media Details
            element.requestProductMediaDetails = await productmediaModel.find({
              where: {
                orderId: element.id,
              },
            });
          }
          modelInstance.requestproduct = getRequestProductOfUser;
        }
      }
    } catch (error) {
      throw error;
    }
  });

  // forgot password
  User.on("resetPasswordRequest", async function (info) {
    var email = app.models.email;
    var newPassword = "B2B@P" + randomString(4);

    try {
      // send Email
      if (info.user.roleId === 1) {
        email.sendEmail(
          {
            senderEmail: info.email,
            messageContent:
              "Hello , <br> Here is your new password for B2B Panel. <br> New Password: " +
              newPassword,
            subject: "Forgot Password",
          },
          (err, data) => {
            if (err) console.log(err);
          }
        );

        // update user password
        await User.patchOrCreate({
          id: info.user.id,
          password: newPassword,
          created: info.user.created,
          modified: info.user.modified,
          cellnumber: info.user.cellnumber,
          masterdetailId: info.user.masterdetailId,
        });
      } else {
        throw constants.createError(
          400,
          "Please enter valid admin email address"
        );
      }
    } catch (error) {
      throw error;
    }
  });

  // User.beforeRemote('changePassword', async (ctx, modelInstance, next) => {

  //   try {

  //     if (!ctx.args.oldPassword) {
  //       throw new Error('Old password is required');
  //     }

  //     if (!ctx.args.newPassword) {
  //       throw new Error('New password is required');
  //     }

  //   } catch (err) {
  //     throw err;
  //   }

  // });

  // User.afterRemote('changePassword', async (ctx, modelInstance, next) => {

  //   var accesstokenModel = app.models.AccessToken;
  //   var userModel = app.models.user;

  //   try {
  //     console.log(ctx.req.headers.authorization);

  //     // find user based on accesstoken
  //     var accessToken = await accesstokenModel.findOne({
  //       where: { id: ctx.req.headers.authorization }
  //     });
  //     var user = await userModel.findById(accessToken.userId);
  //     // get deleted user accesstoken
  //     var data = await accesstokenModel.find({ where: { userId: user.id } });
  //     if (data.length > 0) {
  //       for (var i = 0; i < data.length; i++) {
  //         const element = data[i];
  //         // delete accesstoken as well
  //         await accesstokenModel.deleteAll({ id: element.id });
  //       }
  //     }
  //   } catch (error) {
  //     throw error;
  //   }

  // });

  // when app is close and cart have some items
  User.remoteMethod("cartpush", {
    accepts: [
      {
        arg: "req",
        type: "object",
        http: {
          source: "req",
        },
      },
      {
        arg: "userId",
        type: "string",
        http: {
          source: "query",
        },
      },
    ],
    returns: {
      arg: "result",
      type: "Object",
      root: true,
    },
    http: {
      path: "/cartpush",
      verb: "get",
    },
  });

  User.cartpush = async (req, userId) => {
    var userModel = app.models.user;
    var notifyModel = app.models.notify;
    var orderModel = app.models.order;
    var orderdetailsModel = app.models.orderdetails;
    var user = {};

    try {
      var order = await orderModel.findOne({
        where: {
          userId: userId,
          inshoppingcart: 1,
          masterdetailId: req.query.where.masterdetailId,
        },
      });

      if (order) {
        var orderdetails = await orderdetailsModel.find({
          where: {
            orderId: order.id,
            masterdetailId: req.query.where.masterdetailId,
          },
        });

        user = await userModel.findOne({
          where: {
            id: order.userId,
            masterdetailId: req.query.where.masterdetailId,
          },
        });

        user.orderdetail = orderdetails;
        await notifyModel.share("CART/PUSH", user, {
          masterdetailId: req.query.where.masterdetailId,
        });
      }
      return user;
    } catch (error) {
      throw error;
    }
  };

  User.topuser = async (req) => {
    var userModel = app.models.user;
    var orderModel = app.models.order;
    var totalOrder = [];
    var tenant = req.baseUrl.substring(1);
    tenant = tenant.split("/")[0];

    try {
      // var string = "SELECT COUNT(userId) as countOf, userId,id FROM `order` GROUP BY userId  order BY countOf DESC  LIMIT 5";
      var string =
        "SELECT COUNT(userId) as countOf, userId FROM `order` where masterdetailId = '" +
        req.query.where.masterdetailId +
        "' GROUP BY userId  order BY countOf DESC  LIMIT 5";
      var data = await new Promise((resolve, reject) => {
        app.datasources.mysql.connector.execute(string, null, (err, result) => {
          if (err) reject(err);
          resolve(result);
        });
      });

      for (let i = 0; i < data.length; i++) {
        totalOrder.push(data[i].countOf);
        var order = await orderModel.find({
          where: {
            orderId: data[i].userId,
            masterdetailId: req.query.where.masterdetailId,
          },
        });
      }

      data = data.map((data) => data.userId);

      var user = await userModel.find({
        where: {
          id: {
            inq: data,
          },
          roleId: constants.USER_ROLEID,
          masterdetailId: req.query.where.masterdetailId,
        },
        deleted: true,
      });

      for (let j = 0; j < user.length; j++) {
        user[j].totalOrder = totalOrder[j];
      }

      return user;
    } catch (error) {
      throw error;
    }
  };

  //topuserbyamount
  User.topuserbyamount = async (req) => {
    var userModel = app.models.user;
    var orderModel = app.models.order;
    var orderdetailsModel = app.models.orderdetails;
    var orderAmount = [];

    try {
      var tenant = req.baseUrl.substring(1);
      tenant = tenant.split("/")[0];

      // var string = "SELECT COUNT(userId) as countOf, totalamount, userId FROM `order` GROUP BY totalamount order BY totalamount DESC LIMIT 5";
      var string =
        "SELECT SUM(totalamount) as totalamount, userId FROM `order` where masterdetailId = '" +
        req.query.where.masterdetailId +
        "' group BY userId order by totalamount DESC LIMIT 5;";
      var data = await new Promise((resolve, reject) => {
        app.datasources.mysql.connector.execute(string, null, (err, result) => {
          if (err) reject(err);
          resolve(result);
        });
      });

      var sameData = data;

      for (var i = 0; i < sameData.length; i++) {
        orderAmount.push(sameData[i].totalamount);
      }

      data = data.map((data) => data.userId);

      var user = await userModel.find({
        where: {
          id: {
            inq: data,
          },
          roleId: constants.USER_ROLEID,
          masterdetailId: req.query.where.masterdetailId,
        },
        deleted: true,
      });

      for (let j = 0; j < user.length; j++) {
        user[j].totalamount = orderAmount[j];
      }

      return user;
    } catch (error) {
      throw error;
    }
  };

  User.userprogress = async (req) => {
    var userModel = app.models.user;

    try {
      // find all product
      var alluser = await userModel.count({
        where: {
          masterdetailId: req.query.where.masterdetailId,
        },
      });

      // active product count
      var activeuser = await userModel.find({
        where: {
          userstatus: "Active",
          masterdetailId: req.query.where.masterdetailId,
        },
      });

      var deactiveuser = await userModel.find({
        where: {
          userstatus: "Deactive",
          masterdetailId: req.query.where.masterdetailId,
        },
      });

      var activeData = (activeuser.length * 100) / alluser;
      var deactiveData = (deactiveuser.length * 100) / alluser;

      var obj = {
        activeData: activeData,
        deactiveData: deactiveData,
      };
      return obj;
    } catch (error) {
      throw error;
    }
  };

  User.userexistence = async (req) => {
    try {
      var userModel = app.models.user;
      var mobile = req.body.mobile;
      var existinguser = await userModel.find({
        where: {
          cellnumber: mobile,
          masterdetailId: req.query.where.masterdetailId,
        },
      });
      if (existinguser.length == 1) {
        return existinguser[0];
      } else {
        var err = new Error("Sorry! User not found");
        err.statusCode = 404;
        throw err;
      }
    } catch (error) {
      throw error;
    }
  };

  // Search API For App (Cellnumber and customer name)
  User.searchCustomerData = async (req) => {
    try {
      var resData = [];

      // search by cellnumber and city
      if (req.query.filter.cellnumber && req.query.filter.cityId) {
        var res = await User.find({
          where: {
            and: [
              {
                cellnumber: {
                  like: "%" + req.query.filter.cellnumber + "%",
                },
              },
              {
                roleId: 2,
              },
              {
                cityId: req.query.filter.cityId,
              },
            ],
            masterdetailId: req.query.where.masterdetailId,
          },
          include: ["city", "group"],
        });

        if (res.length > 0) {
          for (var i = 0; i < res.length; i++) {
            const element = res[i];
            resData.push(element.__data);
          }
        } else {
          return resData;
        }
      } else if (req.query.filter.username && req.query.filter.cityId) {
        // search by usern.username and city
        var res = await User.find({
          where: {
            and: [
              {
                username: {
                  like: "%" + req.query.filter.username + "%",
                },
              },
              {
                roleId: 2,
              },
              {
                cityId: req.query.filter.cityId,
              },
            ],
            masterdetailId: req.query.where.masterdetailId,
          },
          include: ["city", "group"],
        });

        if (res.length > 0) {
          for (var i = 0; i < res.length; i++) {
            const element = res[i];
            resData.push(element.__data);
          }
        } else {
          return resData;
        }
      } else if (req.query.filter.cellnumber) {
        // search by cellnumber
        var res = await User.find({
          where: {
            and: [
              {
                cellnumber: {
                  like: "%" + req.query.filter.cellnumber + "%",
                },
              },
              {
                roleId: 2,
              },
              {
                userstatus: "Active",
              },
            ],
            masterdetailId: req.query.where.masterdetailId,
          },
          include: ["city", "group"],
        });

        if (res.length > 0) {
          for (let i = 0; i < res.length; i++) {
            const element = res[i];
            resData.push(element.__data);
          }
        } else {
          return resData;
        }
      } else if (req.query.filter.username) {
        // search by username
        var res = await User.find({
          where: {
            and: [
              {
                username: {
                  like: "%" + req.query.filter.username + "%",
                },
              },
              {
                roleId: 2,
              },
              {
                userstatus: "Active",
              },
            ],
            masterdetailId: req.query.where.masterdetailId,
          },
          include: ["city", "group"],
        });

        if (res.length > 0) {
          for (let i = 0; i < res.length; i++) {
            const element = res[i];
            resData.push(element.__data);
          }
        } else {
          return resData;
        }
      } else {
        var pusherr = {
          err: "Something Wrong .... Search not working",
        };
        resData.push(pusherr);
        return resData;
      }

      return resData;
    } catch (error) {
      throw error;
    }
  };

  // Search API For App (City & Cellnumber)
  User.searchCustomerDataByCity = async (req) => {
    try {
      var resData = [];
      var res;
      var accesstokenModel = app.models.AccessToken;
      var userModel = app.models.user;
      var salesmancityModel = app.models.salesmancity;
      var cityModel = app.models.city;
      var cityArray = [];
      // search by cellnumber and city

      // find user based on accesstoken
      var accessToken = await accesstokenModel.findOne({
        where: {
          id: req.headers.authorization,
        },
      });

      var user = await userModel.findById(accessToken.userId);

      // check requested user is admin or not
      if (user.roleId === 1) {
        // get all cities
        var getAllCities = await cityModel.find();
        if (getAllCities.length > 0) {
          for (let i = 0; i < getAllCities.length; i++) {
            const element = getAllCities[i];
            cityArray.push(element.id);
          }
        }
      } else {
        // get salesman which belongs to user city
        var getsalesman = await salesmancityModel.find({
          where: {
            userId: user.id,
          },
        });
        if (getsalesman.length > 0) {
          for (let i = 0; i < getsalesman.length; i++) {
            const element = getsalesman[i];
            cityArray.push(element.cityId);
          }
        }
      }

      // Salesmancities mendatory comment

      if (req.query) {
        if (req.query.filter) {
          if (req.query.filter.where) {
            if (
              req.query.filter.where.cityId !== undefined &&
              req.query.filter.where.username !== undefined
            ) {
              if (
                req.query.filter.where.cityId !== undefined &&
                req.query.filter.where.username.regexp !== "" &&
                req.query.filter.where.username.regexp !== undefined
              ) {
                if (
                  req.query.filter.where.skip !== undefined &&
                  req.query.filter.where.limit !== undefined
                ) {
                  res = await User.find({
                    where: {
                      and: [
                        {
                          roleId: 2,
                        },
                        {
                          cityId: req.query.filter.where.cityId,
                        },
                        {
                          username: {
                            regexp:
                              "^" + req.query.filter.where.username.regexp,
                          },
                        },
                        {
                          userstatus: "Active",
                        },
                      ],
                      masterdetailId: req.query.where.masterdetailId,
                    },
                    order: "username ASC",
                    include: ["city", "group"],
                    limit: req.query.filter.where.limit,
                    skip: req.query.filter.where.skip,
                  });
                } else {
                  res = await User.find({
                    where: {
                      and: [
                        {
                          roleId: 2,
                        },
                        {
                          cityId: req.query.filter.where.cityId,
                        },
                        {
                          username: {
                            regexp:
                              "^" + req.query.filter.where.username.regexp,
                          },
                        },
                        {
                          userstatus: "Active",
                        },
                      ],
                      masterdetailId: req.query.where.masterdetailId,
                    },
                    order: "username ASC",
                    include: ["city", "group"],
                  });
                }
                if (res.length > 0) {
                  for (let i = 0; i < res.length; i++) {
                    const element = res[i];
                    resData.push(element);
                  }
                } else {
                  return resData;
                }
              }
            } else if (req.query.filter.where.cityId !== undefined) {
              if (
                req.query.filter.where.skip !== undefined &&
                req.query.filter.where.limit !== undefined
              ) {
                res = await User.find({
                  where: {
                    and: [
                      {
                        roleId: 2,
                      },
                      {
                        cityId: req.query.filter.where.cityId,
                      },
                      {
                        userstatus: "Active",
                      },
                    ],
                    masterdetailId: req.query.where.masterdetailId,
                  },
                  order: "username ASC",
                  include: ["city", "group"],
                  limit: req.query.filter.where.limit,
                  skip: req.query.filter.where.skip,
                });
              } else {
                res = await User.find({
                  where: {
                    and: [
                      {
                        roleId: 2,
                      },
                      {
                        cityId: req.query.filter.where.cityId,
                      },
                      {
                        userstatus: "Active",
                      },
                    ],
                    masterdetailId: req.query.where.masterdetailId,
                  },
                  order: "username ASC",
                  include: ["city", "group"],
                });
              }
              if (res.length > 0) {
                for (let i = 0; i < res.length; i++) {
                  const element = res[i];
                  resData.push(element);
                }
              } else {
                return resData;
              }
            } else if (req.query.filter.where.username) {
              if (
                req.query.filter.where.username.regexp !== undefined &&
                req.query.filter.where.username.regexp !== ""
              ) {
                if (req.query.filter.where.username.regexp !== "") {
                  if (
                    req.query.filter.where.skip !== undefined &&
                    req.query.filter.where.limit !== undefined
                  ) {
                    res = await User.find({
                      where: {
                        and: [
                          {
                            username: {
                              regexp:
                                "^" + req.query.filter.where.username.regexp,
                            },
                          },
                          {
                            roleId: 2,
                          },
                          {
                            userstatus: "Active",
                          },
                          {
                            cityId: {
                              inq: cityArray,
                            },
                          },
                        ],
                        masterdetailId: req.query.where.masterdetailId,
                      },
                      order: "username ASC",
                      include: ["city", "group"],
                      limit: req.query.filter.where.limit,
                      skip: req.query.filter.where.skip,
                    });
                  } else {
                    res = await User.find({
                      where: {
                        and: [
                          {
                            username: {
                              regexp:
                                "^" + req.query.filter.where.username.regexp,
                            },
                          },
                          {
                            roleId: 2,
                          },
                          {
                            userstatus: "Active",
                          },
                          {
                            cityId: {
                              inq: cityArray,
                            },
                          },
                        ],
                        masterdetailId: req.query.where.masterdetailId,
                      },
                      order: "username ASC",
                      include: ["city", "group"],
                    });
                  }
                  if (res.length > 0) {
                    for (let i = 0; i < res.length; i++) {
                      const element = res[i];
                      resData.push(element);
                    }
                  } else {
                    return resData;
                  }
                } else {
                  res = await User.find({
                    where: {
                      and: [
                        {
                          roleId: 2,
                        },
                        {
                          userstatus: "Active",
                        },
                        {
                          cityId: {
                            inq: cityArray,
                          },
                        },
                      ],
                      masterdetailId: req.query.where.masterdetailId,
                    },
                    order: "username ASC",
                    include: ["city", "group"],
                  });
                  if (res.length > 0) {
                    for (let i = 0; i < res.length; i++) {
                      const element = res[i];
                      resData.push(element);
                    }
                  }
                }
              }
            } else if (
              req.query.filter.where.skip !== undefined &&
              req.query.filter.where.limit !== undefined
            ) {
              res = await User.find({
                where: {
                  and: [
                    {
                      roleId: 2,
                    },
                    {
                      userstatus: "Active",
                    },
                    {
                      cityId: {
                        inq: cityArray,
                      },
                    },
                  ],
                  masterdetailId: req.query.where.masterdetailId,
                },
                include: ["city", "group"],
                limit: req.query.filter.where.limit,
                skip: req.query.filter.where.skip,
                order: "username ASC",
              });
              if (res.length > 0) {
                for (var i = 0; i < res.length; i++) {
                  const element = res[i];
                  resData.push(element);
                }
              }
            } else {
              res = await User.find({
                where: {
                  and: [
                    {
                      roleId: 2,
                    },
                    {
                      cityId: req.query.filter.where.cityId,
                    },
                    {
                      username: {
                        regexp: "^" + req.query.filter.where.username.regexp,
                      },
                    },
                    {
                      userstatus: "Active",
                    },
                    {
                      cityId: {
                        inq: cityArray,
                      },
                    },
                  ],
                  masterdetailId: req.query.where.masterdetailId,
                },
                order: "username ASC",
                include: ["city", "group"],
              });
              if (res.length > 0) {
                for (let i = 0; i < res.length; i++) {
                  const element = res[i];
                  resData.push(element);
                }
              }
            }
          } else {
            res = await User.find({
              where: {
                and: [
                  {
                    roleId: 2,
                  },
                  {
                    userstatus: "Active",
                  },
                ],
                masterdetailId: req.query.where.masterdetailId,
              },
              include: ["city", "group"],
              order: "username ASC",
            });
            if (res.length > 0) {
              for (let i = 0; i < res.length; i++) {
                const element = res[i];
                resData.push(element);
              }
            }
          }
        }
      }

      return resData;
    } catch (error) {
      throw error;
    }
  };

  User.getUserDataByIdWithStatistics = async (req) => {
    var orderModel = app.models.order;
    var resData;
    var orderstatistics = {};
    var pendingorder = 0;
    var rejectedorder = 0;
    var inprogressorder = 0;
    var deliveredorder = 0;
    var confirmorder = 0;
    var cancelledorder = 0;
    var totalamount = 0;

    try {
      if (!req.query.filter.where.id) {
        var err = new Error("Sorry! Your Requested User Not Found");
        err.statusCode = 400;
        throw err;
      }

      // get user data
      resData = await User.findOne({
        where: {
          id: req.query.filter.where.id,
          masterdetailId: req.query.where.masterdetailId,
        },
        include: ["city"],
      });

      // get user order data
      var orderData = await orderModel.find({
        where: {
          inshoppingcart: 0,
          userId: req.query.filter.where.id,
          masterdetailId: req.query.where.masterdetailId,
        },
      });

      orderData.length > 0 ? orderData.length : (orderData.length = 0);

      orderData.filter((e) => {
        if (
          e.orderstatus ===
          constants.ORDER_PENDING(req.query.where.masterdetailId)
        ) {
          pendingorder = pendingorder + 1;
        } else if (
          e.orderstatus ===
          constants.ORDER_COMFIRMED(req.query.where.masterdetailId)
        ) {
          confirmorder = confirmorder + 1;
        } else if (
          e.orderstatus ===
          constants.ORDER_INPROGRESS(req.query.where.masterdetailId)
        ) {
          inprogressorder = inprogressorder + 1;
        } else if (
          e.orderstatus ===
          constants.ORDER_DELIVERED(req.query.where.masterdetailId)
        ) {
          deliveredorder = deliveredorder + 1;
        } else if (
          e.orderstatus ===
          constants.ORDER_CANCELLED(req.query.where.masterdetailId)
        ) {
          cancelledorder = cancelledorder + 1;
        } else if (
          e.orderstatus ===
          constants.ORDER_REJECTED(req.query.where.masterdetailId)
        ) {
          rejectedorder = rejectedorder + 1;
        }
      });

      orderData.find((e) => {
        if (
          e.orderstatus !==
            constants.ORDER_CANCELLED(req.query.where.masterdetailId) ||
          e.orderstatus !==
            constants.ORDER_REJECTED(req.query.where.masterdetailId)
        ) {
          totalamount = totalamount + e.totalamount;
        }
      });

      orderstatistics.allorders = orderData.length;
      orderstatistics.pendingorder = pendingorder;
      orderstatistics.confirmorder = confirmorder;
      orderstatistics.inprogressorder = inprogressorder;
      orderstatistics.deliveredorder = deliveredorder;
      orderstatistics.cancelledorder = cancelledorder;
      orderstatistics.rejectedorder = rejectedorder;
      orderstatistics.totalamount = totalamount;

      // attach orderstatistics
      resData.orderstatistics = orderstatistics;
      return resData;
    } catch (error) {
      throw error;
    }
  };

  User.getsalesmanListForReportingTo = async (req) => {
    var resData;
    var salesmanReportingToList = [];
    var tempQuery = "";

    try {
      // get  all salesman
      resData = await User.find({
        where: {
          roleId: {
            inq: [constants.ADMIN_ROLEID, constants.SALESMAN_ROLEID],
          },
          masterdetailId: req.query.where.masterdetailId,
        },
      });

      // resData.filter(e => {
      //   if (e.reportingto) {
      //     salesmanReportingToList.push(e.reportingto);
      //   }
      // });

      // console.log('Who is Reporting to someone :.... ', salesmanReportingToList);

      // get salesman which are not reported yet
      // resData = salesmanReportingToList.map(a => JSON.stringify(a)).join();

      // if (salesmanReportingToList.length > 0) {
      //   resData = "(" + resData + ")";
      // } else {
      //   resData = "('')";
      // }

      // tempQuery += " AND id NOT IN " + resData;

      // var query = "SELECT * FROM `user` WHERE   deletedAt IS NULL AND masterdetailId = '" + req.query.where.masterdetailId + "' AND roleId = 3 " + tempQuery;
      // resData = await new Promise((resolve, reject) => {
      //   app.datasources.mysql.connector.execute(query, null, (err, result) => {
      //     if (err) reject(err);
      //     resolve(result);
      //   });
      // });

      return resData;
    } catch (error) {
      throw error;
    }
  };

  User.listRecentlyAddedUser = async (req) => {
    try {
      return await User.find({
        where: {
          roleId: constants.USER_ROLEID,
          masterdetailId: req.query.where.masterdetailId,
        },
        order: "created ASC",
        skip: 0,
        limit: 5,
        include: ["city"],
      });
    } catch (error) {
      throw error;
    }
  };

  User.checkEmailOrCellnumberExist = async (req) => {
    var whereObject;
    var isExist;
    try {
      // Request for check Company Name
      if (req.query.filter.where.companyname) {
        if (req.accessToken && req.accessToken.userId) {
          whereObject = {
            companyname: {
              eq: req.query.filter.where.companyname,
            },
          };
        } else {
          whereObject = {
            companyname: {
              eq: req.query.filter.where.companyname,
              roleId: constants.ADMIN_ROLEID,
            },
          };
        }
      }

      // Request for check Cell Number
      if (req.query.filter.where.cellnumber) {
        if (req.accessToken && req.accessToken.userId) {
          whereObject = {
            email: req.query.filter.where.cellnumber,
          };
        } else {
          whereObject = {
            email: req.query.filter.where.cellnumber,
            roleId: constants.ADMIN_ROLEID,
          };
        }
      }

      // Request for check Email
      if (req.query.filter.where.email) {
        if (req.accessToken && req.accessToken.userId) {
          whereObject = {
            email: req.query.filter.where.email,
          };
        } else {
          whereObject = {
            email: req.query.filter.where.email,
            roleId: constants.ADMIN_ROLEID,
          };
        }
      }

      // Match Query
      isExist = await constants.userFind(whereObject);
      // If Email Exist
      if (isExist.length > 0 && req.query.filter.where.email) {
        constants.createError(403, "Sorry! Email address already exist.");
      }

      // If Cell number exist
      if (isExist.length > 0 && req.query.filter.where.cellnumber) {
        constants.createError(403, "Sorry! Cell number already exist.");
      }

      // If Company Name exist
      if (isExist.length > 0 && req.query.filter.where.companyname) {
        constants.createError(403, "Sorry! Bussiness Name already exist.");
      }

      return true;
    } catch (error) {
      throw error;
    }
  };

  // import user
  User.importUser = async (req) => {
    var createUser;
    var tempArray = [];
    var cityData;
    var stateData;
    var countryData;

    try {
      // check that the required field names are present
      for (let i = 0; i < req.body.length; i++) {
        const element = req.body[i];
        if (
          "First name" in element === true &&
          "Last name" in element === true &&
          "Cell number" in element === true &&
          "Address" in element === true &&
          "Email" in element === true &&
          "City" in element === true &&
          "State" in element === true &&
          "Country" in element === true
        ) {
        } else {
          throw constants.createError(
            404,
            "Please upload file in proper format"
          );
        }
      }

      if (req.body.length > 0) {
        // check any property is not empty
        req.body.filter((element) => {
          var result = Object.entries(element);
          result.filter((r) => {
            if (r[1] === "" || r[1] === null) {
              throw constants.createError(
                404,
                "Sorry! " + r[0] + " Cannot be blank or null in selected file"
              );
            }
          });
        });

        // check if any user already exist
        for (let i = 0; i < req.body.length; i++) {
          const element = req.body[i];

          // Find User Name Exist In DB
          var findUser = await constants.commonFindFunction({
            model: app.models.user,
            whereObj: {
              or: [
                {
                  cellnumber: element["Cell number"],
                },
                {
                  email: element["Email"],
                },
              ],
              masterdetailId: req.query.where.masterdetailId,
            },
          });

          if (findUser.length > 0) {
            throw constants.createError(
              "Sorry, user already exist in database!"
            );
          }
        }

        for (let i = 0; i < req.body.length; i++) {
          const element = req.body[i];

          // find city id from city table
          cityData = await constants.commonFindOneFunction({
            model: app.models.city,
            whereObj: {
              name: {
                like: element["City"],
              },
              masterdetailId: req.query.where.masterdetailId,
            },
          });

          if (cityData === null) {
            // find state Id
            stateData = await constants.commonFindOneFunction({
              model: app.models.state,
              whereObj: {
                name: {
                  like: element["State"],
                },
                parentId: {
                  neq: null,
                },
                masterdetailId: req.query.where.masterdetailId,
              },
            });

            if (stateData === null) {
              // find Country Id
              countryData = await constants.commonFindOneFunction({
                model: app.models.state,
                whereObj: {
                  name: {
                    like: element["Country"],
                  },
                  parentId: null,
                  masterdetailId: req.query.where.masterdetailId,
                },
              });

              if (countryData === null) {
                countryData = await app.models.state.create({
                  name: element["Country"],
                  masterdetailId: req.query.where.masterdetailId,
                });
              }

              stateData = await app.models.state.create({
                name: element["State"],
                parentId: countryData.id,
                masterdetailId: req.query.where.masterdetailId,
              });
            }

            // create City
            cityData = await app.models.city.create({
              name: element["City"],
              status: 1,
              createdby: req.accessToken.userId,
              modifiedby: req.accessToken.userId,
              stateId: stateData.id,
              masterdetailId: req.query.where.masterdetailId,
            });
          }

          // get group id for the user
          var groupData = await constants.commonFindOneFunction({
            model: app.models.group,
            whereObj: {
              name: "Default",
              masterdetailId: req.query.where.masterdetailId,
            },
          });

          // user's profile pic
          var profilePic;
          if (element["Profile pic"]) {
            profilePic = element["Profile pic"];
          } else {
            profilePic = constants.defaultUser;
          }

          // create User
          createUser = await User.create({
            firstname: element["First name"],
            lastname: element["Last name"],
            profilepic: profilePic,
            username: element["First name"] + " " + element["Last name"],
            email: element["Email"],
            password: "b2buser@123",
            cellnumber: element["Cell number"],
            cityId: cityData.id,
            address1: element["Address"],
            roleId: 2,
            userstatus: "Active",
            createdby: req.accessToken.userId,
            modifiedby: req.accessToken.userId,
            groupId: groupData.id,
            masterdetailId: req.query.where.masterdetailId,
            isregistered: true,
            // password: ctx.args.data.password,
            created: new Date(),
            modified: new Date(),
            registervia: "ADMIN",
          });
          tempArray.push(createUser);
        }
        return tempArray;
      } else {
        throw constants.createError("Sorry, Data not Available");
      }
    } catch (error) {
      throw error;
    }
  };

  // import salesmen
  User.importSalesmen = async (req) => {
    var createSalesmen;
    var tempArray = [];
    var cityData;
    var createSalesmenCity;

    try {
      // check that the required field names are present
      for (let i = 0; i < req.body.length; i++) {
        const element = req.body[i];
        if (
          "First name" in element === true &&
          "Last name" in element === true &&
          "Cell number" in element === true &&
          "Address" in element === true &&
          "Email" in element === true &&
          "City" in element === true
        ) {
        } else {
          // console.log("false");
          throw constants.createError(
            404,
            "Please upload file in proper format"
          );
        }
      }

      if (req.body.length > 0) {
        // check any property is not empty
        req.body.filter((element) => {
          var result = Object.entries(element);
          result.filter((r) => {
            if (r[1] === "" || r[1] === null) {
              throw constants.createError(
                404,
                'Sorry! " + r[0] + " cannot be blank or null in selected file'
              );
            }
          });
        });

        // check if any user already exist
        for (let i = 0; i < req.body.length; i++) {
          const element = req.body[i];

          // Find User Name Exist In DB
          var findUser = await constants.commonFindFunction({
            model: app.models.user,
            whereObj: {
              or: [
                {
                  cellnumber: element["Cell number"],
                },
                {
                  email: element["Email"],
                },
              ],
              masterdetailId: req.query.where.masterdetailId,
            },
          });

          if (findUser.length > 0) {
            throw constants.createError(
              404,
              "Sorry! data already exist in database"
            );
          }
        }

        for (let i = 0; i < req.body.length; i++) {
          const element = req.body[i];

          // get group id for the user
          var groupData = await constants.commonFindOneFunction({
            model: app.models.group,
            whereObj: {
              name: "Default",
              masterdetailId: req.query.where.masterdetailId,
            },
          });

          // user's profile pic
          var profilePic;
          if (element["Profile pic"]) {
            profilePic = element["Profile pic"];
          } else {
            profilePic = constants.defaultUser;
          }

          // create User
          createSalesmen = await User.create({
            firstname: element["First name"],
            lastname: element["Last name"],
            profilepic: profilePic,
            username: element["First name"] + " " + element["Last name"],
            cellnumber: element["Cell number"],
            password: "b2buser@123",
            roleId: 3,
            userstatus: "Active",
            createdby: req.accessToken.userId,
            groupId: groupData.id,
            masterdetailId: req.query.where.masterdetailId,
          });
          tempArray.push(createSalesmen);

          var re = /[a-zA-Z]+/gm;
          var cities = element["City"].match(re);

          for (let i = 0; i < cities.length; i++) {
            const element = cities[i];

            // find city id from city table
            cityData = await app.models.city.findOne({
              where: {
                name: {
                  like: element,
                },
                masterdetailId: req.query.where.masterdetailId,
              },
            });

            if (cityData === null) {
              // create City
              cityData = await app.models.city.create({
                name: element,
                status: 1,
                createdby: req.accessToken.userId,
                stateId: 1,
                masterdetailId: req.query.where.masterdetailId,
              });
            }

            createSalesmenCity = await app.models.salesmancity.create({
              userId: createSalesmen.id,
              cityId: cityData.id,
              masterdetailId: req.query.where.masterdetailId,
            });
          }
        }
        return tempArray;
      } else {
        throw constants.createError(404, "Sorry, No data available");
      }
    } catch (error) {
      throw error;
    }
  };

  // export user
  User.exportUser = async (req) => {
    var tempArray = [];
    var groupData = {
      name: "--",
    };

    try {
      var getUser = await constants.commonFindFunction({
        model: app.models.user,
        whereObj: {
          roleId: 2,
          masterdetailId: req.query.where.masterdetailId,
        },
      });

      if (getUser.length > 0) {
        for (let i = 0; i < getUser.length; i++) {
          const element = getUser[i];

          if (element.cityId !== null) {
            var cityData = await constants.commonFindOneFunction({
              model: app.models.city,
              whereObj: {
                id: element.cityId,
                masterdetailId: req.query.where.masterdetailId,
              },
            });
          }

          if (element.groupId !== null) {
            groupData = await constants.commonFindOneFunction({
              model: app.models.group,
              whereObj: {
                id: element.groupId,
                masterdetailId: req.query.where.masterdetailId,
              },
            });
          } else {
            groupData.name = null;
          }

          tempArray.push({
            // 'First Name': element.firstname,
            // 'last Name': element.lastname,
            Name: element.username,
            Status: element.userstatus,
            "Cell Number": element.cellnumber,
            Email: element.email,
            Address: element.address1,
            City: cityData.name,
            Group: groupData.name,
          });
        }
      } else {
        throw constants.createError(404, "Sorry! Data not Available");
      }

      return tempArray;
    } catch (error) {
      throw error;
    }
  };

  // validate email
  function validateEmail(email) {
    const re =
      /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(String(email).toLowerCase());
  }

  // validate gstin
  function validGSTIN(gstin) {
    const re = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    return re.test(gstin);
  }

  // check plan criteria
  async function checkPlanCriteria(data) {
    /**
     * 1. Check Customer Management Permission
     */

    var settingModel = app.models.setting;

    try {
      // get Current Merchant Plan
      var getCurrentMerchantPlan = await settingModel.findOne({
        where: {
          registerallow: constants.CURRENT_MERCHANT_PLAN_LABEL,
          status: 1,
          masterdetailId: data,
        },
      });

      if (getCurrentMerchantPlan) {
        getCurrentMerchantPlan = constants.parseJson(
          getCurrentMerchantPlan.text
        );
        for (let i = 0; i < getCurrentMerchantPlan.features.length; i++) {
          const element = getCurrentMerchantPlan.features[i];
          if (element.key === constants.USER_MANAGEMENT_KEY) {
            return element.value;
          }
        }
      }
    } catch (error) {
      throw error;
    }
  }

  User.topPerformingSalesman = async (req) => {
    var user;
    var resdata = [];
    try {
      user = await app.models.user.find({
        where: {
          roleId: constants.SALESMAN_ROLEID,
          userstatus: "Active",
          masterdetailId: req.query.where.masterdetailId,
        },
      });
      for (let i = 0; i < user.length; i++) {
        const element = user[i];
        var data = await app.models.order.find({
          where: {
            createdby: element.id,
            masterdetailId: element.masterdetailId,
          },
        });
        if (data.length > 0) {
          var amount = 0;
          for (let j = 0; j < data.length; j++) {
            const ele = data[j];
            amount += ele.totalamount;
          }
          resdata.push({
            userId: element.id,
            name: element.username,
            cellnumber: element.cellnumber,
            totalamount: amount,
            profilepic: element.profilepic,
          });
        }
      }

      var sorted = resdata.sort((a, b) =>
        a.totalamount < b.totalamount ? 1 : -1
      );
      if (sorted.length > 5) {
        return sorted.slice(0, 5);
      }
      return sorted;
    } catch (error) {
      throw error;
    }
  };

  User.getMerchantStatistics = async (req) => {
    var getTotalMerchants = 0;

    try {
      var getTotalMerchants = await User.find({
        where: {
          roleId: constants.ADMIN_ROLEID,
        },
      });

      var getTotalActiveMerchants = await User.find({
        where: {
          roleId: constants.ADMIN_ROLEID,
          userstatus: "Active",
        },
      });

      var getTotalDeactiveMerchants = await User.find({
        where: {
          roleId: constants.ADMIN_ROLEID,
          userstatus: "Deactive",
        },
      });

      return {
        getTotalMerchants: getTotalMerchants.length,
        getTotalActiveMerchants: getTotalActiveMerchants.length,
        getTotalDeactiveMerchants: getTotalDeactiveMerchants.length,
      };
    } catch (error) {
      throw error;
    }
  };

  async function createRoleMapping(params) {
    await app.models.rolemapping.create({
      principalType: params.principalType,
      principalId: params.principalId,
      roleId: params.roleId,
      masterdetailId: params.masterdetailId,
    });
  }

  async function getCityDetails(params) {
    return await app.models.city.findOne({
      where: {
        id: params.id,
        masterdetailId: params.masterdetailId,
      },
    });
  }
};
