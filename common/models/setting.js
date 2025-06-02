"use strict";

const app = require("../../server/server");

const titlecase = require("title-case");
const constants = require("../../common/const");
const rzp = require("../../server/bin/razorpay");
const getSize = require("get-folder-size");
const path = require("path");
const Razorpay = require("razorpay");
const buffer = require("buffer/").Buffer;
const SETTING_CONSTANTS = require("../../common/setting_constants");
const s3Constants = require("../s3_constants");

module.exports = function (Setting) {
  Setting.beforeRemote("create", async (ctx, modelInstance) => {
    try {
      ctx.args.data.createdby = ctx.req.accessToken.userId;
      ctx.args.data.modifiedby = ctx.req.accessToken.userId;
      ctx.args.data.text = JSON.stringify(ctx.args.data.text);
    } catch (error) {
      throw error;
    }
  });

  Setting.beforeRemote("find", async (ctx, modelInstance, next) => {
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
    } catch (error) {
      throw error;
    }
  });

  Setting.afterRemote("find", async (ctx, modelInstance) => {
    var resData = {};
    try {
      if (
        ctx.args.filter &&
        ctx.args.filter.where &&
        ctx.args.filter.where.and &&
        ctx.args.filter.where.and[0]
      ) {
        if (
          ctx.args.filter.where.and[0].registerallow ===
          constants.PAYMENT_DETAILS_KEY
        ) {
          var getPaymentData = await Setting.find({
            where: {
              registerallow: constants.PAYMENT_DETAILS_KEY,
              masterdetailId: ctx.req.query.where.masterdetailId,
            },
          });
          if (getPaymentData) {
            var obj = JSON.parse(getPaymentData[0].__data.text);
            getPaymentData[0].__data.text = obj;
            resData = getPaymentData;
            ctx.res.status(200).send(resData);
            return;
          }
        }

        if (
          ctx.args.filter.where.and[0].registerallow ===
          constants.LOGIN_OPTIONS_KEY
        ) {
          var getLoginData = await Setting.find({
            where: {
              registerallow: constants.LOGIN_OPTIONS_KEY,
              masterdetailId: ctx.req.query.where.masterdetailId,
            },
          });
          if (getLoginData.length > 0) {
            var data = JSON.parse(getLoginData[0].__data.text);
            getLoginData[0].__data.text = data;
            resData = getLoginData;
            ctx.res.status(200).send(resData);
            return;
          }
        }

        if (
          ctx.args.filter.where.and[0].registerallow ===
          constants.CATALOGUE_FMCG_LABLE
        ) {
          var getLoginData = await Setting.find({
            where: {
              registerallow: constants.CATALOGUE_FMCG_LABLE,
              masterdetailId: ctx.req.query.where.masterdetailId,
            },
          });
          if (getLoginData.length > 0) {
            resData = getLoginData;
            ctx.res.status(200).send(resData);
            return;
          }
        }

        if (
          ctx.args.filter.where.and[0].registerallow ===
          constants.CATALOGUEJEWELLARY_LABLE
        ) {
          var getLoginData = await Setting.find({
            where: {
              registerallow: constants.CATALOGUEJEWELLARY_LABLE,
              masterdetailId: ctx.req.query.where.masterdetailId,
            },
          });
          if (getLoginData.length > 0) {
            var data = JSON.parse(getLoginData[0].__data.text);
            getLoginData[0].__data.text = data;
            resData = getLoginData;
            ctx.res.status(200).send(resData);
            return;
          }
        }

        if (
          ctx.args.filter.where.and[0].registerallow ===
          constants.INQUIRY_ACTION_KEY
        ) {
          var getLoginData = await Setting.findOne({
            where: {
              registerallow: constants.INQUIRY_ACTION_KEY,
              masterdetailId: ctx.req.query.where.masterdetailId,
            },
          });
          if (getLoginData) {
            var data = JSON.parse(getLoginData.text);
            ctx.res.status(200).send(data);
            return;
          }
        }

        if (
          ctx.args.filter.where.and[0].registerallow ===
          constants.OFFER_BANNER_LABLE
        ) {
          var getLoginData = await Setting.findOne({
            where: {
              registerallow: constants.OFFER_BANNER_LABLE,
              masterdetailId: ctx.req.query.where.masterdetailId,
            },
          });
          if (getLoginData.length > 0) {
            var data = JSON.parse(getLoginData.text);
            getLoginData.text = data;
            modelInstance = getLoginData;
          }
        }

        if (
          ctx.args.filter.where.and[0].registerallow ===
          constants.CONTACT_US_KEY
        ) {
          var getData = await Setting.findOne({
            where: {
              registerallow: constants.CONTACT_US_KEY,
              masterdetailId: ctx.req.query.where.masterdetailId,
            },
          });
          var settingId = getData.id;
          if (getData) {
            getData = JSON.parse(getData.text);
            getData.id = settingId;
            ctx.res.status(200).send(getData);
            return;
          }
        }

        if (
          ctx.args.filter.where.and[0].registerallow ===
          constants.MERCHANTINFORMATION_LABLE
        ) {
          var getData = await Setting.findOne({
            where: {
              registerallow: constants.MERCHANTINFORMATION_LABLE,
              masterdetailId: ctx.req.query.where.masterdetailId,
            },
          });
          if (getData) {
            getData = JSON.parse(getData.text);
            ctx.res.status(200).send(getData);
            return;
          }
        }

        if (
          ctx.args.filter.where.and[0].registerallow ===
          constants.PRODUCT_UNIT_LABEL
        ) {
          var getData = await Setting.findOne({
            where: {
              registerallow: constants.PRODUCT_UNIT_LABEL,
              masterdetailId: ctx.req.query.where.masterdetailId,
            },
          });
          if (getData) {
            ctx.res.status(200).send(JSON.parse(getData.text));
            return;
          }
        }

        if (
          ctx.args.filter.where.and[0].registerallow ===
          constants.PRODUCT_VARIATION_KEY
        ) {
          var getData = await Setting.findOne({
            where: {
              registerallow: constants.PRODUCT_VARIATION_KEY,
              masterdetailId: ctx.req.query.where.masterdetailId,
            },
          });
          if (getData) {
            var data = JSON.parse(getData.text);
            ctx.res.status(200).send(data);
            return;
          }
        }

        if (
          ctx.args.filter.where.and[0].registerallow ===
          constants.SHIPPINGOPTIONS_LABLE
        ) {
          var getData = await Setting.findOne({
            where: {
              registerallow: constants.SHIPPINGOPTIONS_LABLE,
              masterdetailId: ctx.req.query.where.masterdetailId,
            },
          });
          if (getData) {
            ctx.res.status(200).send(JSON.parse(getData.text));
            return;
          }
        }

        if (
          ctx.args.filter.where.and[0].registerallow ===
          constants.CURRENT_MERCHANT_PLAN_LABEL
        ) {
          var getData = await Setting.findOne({
            where: {
              registerallow: constants.CURRENT_MERCHANT_PLAN_LABEL,
              masterdetailId: ctx.req.query.where.masterdetailId,
            },
          });
          if (getData) {
            ctx.res.status(200).send(constants.parseJson(getData.text));
            return;
          }
        }

        // Get All Package Details
        if (
          ctx.args.filter.where.and[0].registerallow ===
          constants.PACKAGE_DETAILS_LABEL
        ) {
          var getPackageDetails = await Setting.findOne({
            where: {
              registerallow: constants.PACKAGE_DETAILS_LABEL,
            },
          });
          if (getPackageDetails) {
            ctx.res
              .status(200)
              .send(constants.parseJson(getPackageDetails.text));
            return;
          }
        }

        if (
          ctx.args.filter.where.and[0].registerallow ===
          constants.MANIFEST_DETAILS_KEY
        ) {
          var getSettingData = await Setting.findOne({
            where: {
              registerallow: constants.MANIFEST_DETAILS_KEY,
            },
          });
          if (getSettingData) {
            var getTextData = JSON.parse(getSettingData.text);
            // Check in array provided key is available?
            const manifestKeyDetails = getTextData.find(
              (item) =>
                item.short_name.toLowerCase() ===
                ctx.args.filter.where.and[0].short_name.toLowerCase()
            );
            if (!manifestKeyDetails) {
              constants.createError(
                404,
                "Sorry, Provide code manifest details not exist."
              );
            }
            ctx.res.status(200).send(manifestKeyDetails);
            return;
          }
        }
      }
    } catch (error) {
      throw error;
    }
  });

  Setting.beforeRemote("prototype.patchAttributes", async (ctx) => {
    var productModel = app.models.product;
    var categoryModel = app.models.category;
    var stateModel = app.models.state;
    var cityModel = app.models.city;
    var userModel = app.models.user;
    var masterdetailModel = app.models.masterdetail;
    var groupModel = app.models.group;

    try {
      if (
        ctx.args.data.registerallow === constants.CONTACT_US_KEY ||
        ctx.args.data.registerallow === SETTING_CONSTANTS.MENU_CATEGORIES
      ) {
        ctx.args.data.text = JSON.stringify(ctx.args.data.text);
      }

      // Edit Merchant Info
      if (ctx.args.data.registerallow === constants.MERCHANTINFORMATION_LABLE) {
        if (typeof ctx.args.data.text === "string") {
          ctx.args.data.text = JSON.parse(ctx.args.data.text);
        }

        if (ctx.args.data.text.email) {
          var isEmailExist = await userModel.find({
            where: {
              masterdetailId: ctx.args.data.masterdetailId,
              email: ctx.args.data.text.email,
              id: {
                neq: ctx.req.accessToken.userId,
              },
            },
          });

          if (isEmailExist && isEmailExist.length > 0) {
            var getUser = isEmailExist.find(
              (item) =>
                item.email === ctx.args.data.text.email &&
                item.id != ctx.req.accessToken.userId
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
          // Update admin Email
          await userModel.updateAll(
            {
              roleId: 1,
              masterdetailId: ctx.req.query.where.masterdetailId,
            },
            {
              email: ctx.args.data.text.email,
            }
          );
        }

        if (ctx.args.data.text.cellnumber) {
          var isCellnumberExist = await userModel.find({
            where: {
              masterdetailId: ctx.args.data.masterdetailId,
              cellnumber: ctx.args.data.text.cellnumber,
              id: {
                neq: ctx.req.accessToken.userId,
              },
            },
          });
          if (isCellnumberExist && isCellnumberExist.length > 0) {
            var getUser = isCellnumberExist.find(
              (item) =>
                item.cellnumber === ctx.args.data.text.cellnumber &&
                item.id != ctx.req.accessToken.userId
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
          // Update admin Email
          await userModel.updateAll(
            {
              roleId: 1,
              masterdetailId: ctx.req.query.where.masterdetailId,
            },
            {
              cellnumber: ctx.args.data.text.cellnumber,
            }
          );
        }

        if (ctx.args.data.text.companyname) {
          // Update App Name
          await Setting.updateAll(
            {
              registerallow: constants.APP_NAME_LABLE,
              masterdetailId: ctx.args.data.masterdetailId,
            },
            {
              text: ctx.args.data.text.companyname,
            }
          );

          // Update admin Email
          await userModel.updateAll(
            {
              roleId: 1,
              masterdetailId: ctx.req.query.where.masterdetailId,
            },
            {
              companyname: ctx.args.data.text.companyname,
            }
          );

          // Update Name in LanguageJSON
          if (ctx.args.data.text.isCompanyNameChanged) {
            var getLanguageJSON = await app.models.language.find({
              where: {
                key: {
                  inq: [
                    SETTING_CONSTANTS.ANDROID_LANGUAGE_KEY,
                    SETTING_CONSTANTS.IOS_LANGUAGE_KEY,
                  ],
                },
                masterdetailId: ctx.args.data.masterdetailId,
              },
            });
            if (getLanguageJSON && getLanguageJSON.length > 0) {
              for (let i = 0; i < getLanguageJSON.length; i++) {
                const element = getLanguageJSON[i];
                var languageValue = JSON.parse(element.value);
                if (languageValue.en) {
                  languageValue.en.app_name = ctx.args.data.text.companyname;
                }
                languageValue.en.app_name = ctx.args.data.text.companyname;
                languageValue.ar.app_name = ctx.args.data.text.companyname;
                languageValue.hi.app_name = ctx.args.data.text.companyname;
                if (languageValue.ch) {
                  languageValue.ch.app_name = ctx.args.data.text.companyname;
                }
                await app.models.language.updateAll(
                  {
                    id: element.id,
                  },
                  {
                    value: JSON.stringify(languageValue),
                  }
                );
              }
            }
          }
        }

        // Set Country name
        var setCountryName = await stateModel.findOne({
          where: {
            id: ctx.args.data.text.countryId,
            masterdetailId: ctx.req.query.where.masterdetailId,
          },
        });
        if (setCountryName) {
          ctx.args.data.text.countryname = setCountryName.name;
        } else {
          constants.createError(400, "Sorry, Country not exist.");
        }
        // Set State name
        var setStateName = await stateModel.findOne({
          where: {
            id: ctx.args.data.text.stateId,
            masterdetailId: ctx.req.query.where.masterdetailId,
          },
        });
        if (setStateName) {
          ctx.args.data.text.statename = setStateName.name;
        } else {
          constants.createError(400, "Sorry, State not exist.");
        }
        // Set City Name
        var setCityName = await cityModel.findOne({
          where: {
            id: ctx.args.data.text.cityId,
            masterdetailId: ctx.req.query.where.masterdetailId,
          },
        });
        if (setCityName) {
          ctx.args.data.text.cityname = setCityName.name;
        } else {
          constants.createError(400, "Sorry, City not exist.");
        }
        ctx.args.data.text.CountGstPerProduct =
          ctx.args.data.text.CGST + ctx.args.data.text.SGST;

        if (ctx.args.data.text.gstin) {
          await userModel.updateAll(
            {
              roleId: 1,
              masterdetailId: ctx.req.query.where.masterdetailId,
            },
            {
              gstin: ctx.args.data.text.gstin,
            }
          );
        }

        ctx.args.data.text = JSON.stringify(ctx.args.data.text);
      }

      // edit Color_Code
      if (ctx.args.data.registerallow === constants.COLORCODE_KEY) {
        ctx.args.data.text = JSON.stringify(ctx.args.data.text);
      }

      // edit Offer_Banners
      if (ctx.args.data.registerallow === constants.OFFER_BANNER_LABLE) {
        var getBannerData = await Setting.findOne({
          where: {
            registerallow: constants.OFFER_BANNER_LABLE,
            masterdetailId: ctx.req.query.where.masterdetailId,
          },
        });
        if (getBannerData) {
          var data = JSON.parse(getBannerData.text);

          var temp = data.find((e) => e.id === ctx.args.data.data.id);

          if (ctx.args.data.data.media[0].image) {
            temp.media[0].image = ctx.args.data.data.media[0].image.name;
          }
          if (ctx.args.data.data.media[0].video) {
            temp.media[0].video = ctx.args.data.data.media[0].video.name;
          }
          if (ctx.args.data.data.link[0].productId) {
            var getProduct = await productModel.findById(
              ctx.args.data.data.link[0].productId
            );
            temp.link[0].productId = getProduct.id;
            temp.link[0].productname = getProduct.name;
          }
          if (ctx.args.data.data.link[0].categoryId) {
            var getCategory = await categoryModel.findById(
              ctx.args.data.data.link[0].categoryId
            );
            temp.link[0].categoryId = getCategory.id;
            temp.link[0].categoryname = getCategory.name;
          }
          if (ctx.args.data.data.link[0].link) {
            temp.link[0].link = ctx.args.data.data.link[0].link;
          }

          const i = data.findIndex((_item) => _item.id === temp.id);
          if (i > -1) data[i] = temp;
          else data.push(item);

          var stringifyData = JSON.stringify(data);
          ctx.args.data.text = stringifyData;
        }
      }

      if (ctx.args.data.registerallow === constants.SHIPPINGOPTIONS_LABLE) {
        if (ctx.args.data.text) {
          if (
            ctx.args.data.text[3].status === 1 &&
            (ctx.args.data.text[0].status === 1 ||
              ctx.args.data.text[2].status === 1 ||
              ctx.args.data.text[3].status === 1)
          ) {
            await constants.createError(
              403,
              "Please disable not applicable first."
            );
          }

          if (ctx.args.data.text[3].status === 1) {
            for (let i = 0; i < ctx.args.data.text.length - 1; i++) {
              const element = ctx.args.data.text[i];
              element.status = 0;
            }
          }
          if (
            ctx.args.data.text[0].status === 1 ||
            ctx.args.data.text[1].status === 1 ||
            ctx.args.data.text[2].status === 1
          ) {
            ctx.args.data.text[3].status = 0;
          }
          ctx.args.data.text = JSON.stringify(ctx.args.data.text);
        }
      }

      if (ctx.args.data.registerallow === constants.BARCODE_QRCODE_KEY) {
        if (ctx.args.data.text) {
          ctx.args.data.text = JSON.stringify(ctx.args.data.text);
        }
      }

      // edit Product_Variation
      if (ctx.args.data.registerallow === constants.PRODUCT_VARIATION_KEY) {
        var getVariationData = await Setting.findOne({
          where: {
            registerallow: ctx.args.data.registerallow,
            masterdetailId: ctx.req.query.where.masterdetailId,
          },
        });
        if (getVariationData) {
          var data = JSON.parse(getVariationData.text);
          var temp = data.find((e) => e.id === ctx.args.data.data.id);
          if (ctx.args.data.data.name) {
            temp.name = titlecase.titleCase(ctx.args.data.data.name);
          }
          const i = data.findIndex((_item) => _item.id === temp.id);
          if (i > -1) data[i] = temp;
          else data.push(item);
          var stringifyData = JSON.stringify(data);
          ctx.args.data.text = stringifyData;
        }
      }

      // edit Product_Unit
      if (ctx.args.data.registerallow === constants.PRODUCT_UNIT_LABEL) {
        var getUnitData = await Setting.findOne({
          where: {
            registerallow: ctx.args.data.registerallow,
            masterdetailId: ctx.req.query.where.masterdetailId,
          },
        });
        if (getUnitData) {
          var data = JSON.parse(getUnitData.text);
          var temp = data.find((e) => e.id === ctx.args.data.data.id);
          if (ctx.args.data.data.name) {
            temp.name = ctx.args.data.data.name;
          }
          const i = data.findIndex((_item) => _item.id === temp.id);
          if (i > -1) data[i] = temp;
          else data.push(item);
          var stringifyData = JSON.stringify(data);
          ctx.args.data.text = stringifyData;
        }
      }

      // edit Fixed_Productdetails
      if (ctx.args.data.registerallow === constants.FIXED_PRODUCTDETAILS_KEY) {
        var getProductDetailsData = await Setting.findOne({
          where: {
            registerallow: ctx.args.data.registerallow,
            masterdetailId: ctx.req.query.where.masterdetailId,
          },
        });
        if (getProductDetailsData) {
          var data = JSON.parse(getProductDetailsData.text);
          var temp = data.find((e) => e.id === ctx.args.data.data.id);
          if (ctx.args.data.data.lable) {
            temp.lable = ctx.args.data.data.lable;
            temp.data = "";
          }
          const i = data.findIndex((_item) => _item.id === temp.id);
          if (i > -1) data[i] = temp;
          else data.push(item);
          var stringifyData = JSON.stringify(data);
          ctx.args.data.text = stringifyData;
        }
      }

      // edit Inquiry_Action
      if (ctx.args.data.registerallow === constants.INQUIRY_ACTION_KEY) {
        var getInquiryActionData = await Setting.findOne({
          where: {
            registerallow: ctx.args.data.registerallow,
            masterdetailId: ctx.req.query.where.masterdetailId,
          },
        });

        if (getInquiryActionData) {
          var data = JSON.parse(getInquiryActionData.text);

          if (ctx.args.data.subTitle === constants.SETTING_NEXT_ACTION) {
            var temp = data[0].next_action.find(
              (e) => e.id === ctx.args.data.data.id
            );
            if (ctx.args.data.data.actionname) {
              temp.actionname = titlecase.titleCase(
                ctx.args.data.data.actionname
              );
            }

            const i = data[0].next_action.findIndex(
              (_item) => _item.id === temp.id
            );
            if (i > -1) data[0].next_action[i] = temp;
            else data[0].next_action.push(item);
          } else if (ctx.args.data.subTitle === constants.SETTING_INDUSTRY) {
            var temp = data[0].industry.find(
              (e) => e.id === ctx.args.data.data.id
            );
            if (ctx.args.data.data.industryname) {
              temp.industryname = titlecase.titleCase(
                ctx.args.data.data.industryname
              );
            }

            const i = data[0].industry.findIndex(
              (_item) => _item.id === temp.id
            );
            if (i > -1) data[0].industry[i] = temp;
            else data.push(item);
          }
          var stringifyData = JSON.stringify(data);
          ctx.args.data.text = stringifyData;
        }
      }

      // ORDER_VIA_WHATSAPP_LABLE
      if (ctx.args.data.registerallow === constants.ORDER_VIA_WHATSAPP_LABLE) {
        ctx.args.data.text = constants.stringifyJson(ctx.args.data.text);
      }

      // edit PACKAGE_DETAILS
      if (ctx.args.data.registerallow === constants.PACKAGE_DETAILS_LABEL) {
        var changedPackageData = [];
        var tempArray = [];
        var getPackageData = await Setting.findById(ctx.ctorArgs.id);

        if (ctx.args.data.isUpdatePackageJSON) {
          ctx.args.data.text = JSON.stringify(ctx.args.data.text);
          ctx.args.data.masterdetailId = null;
        } else {
          if (
            getPackageData.registerallow === constants.PACKAGE_DETAILS_LABEL
          ) {
            getPackageData = constants.parseJson(getPackageData.text);
            var enterPriseData = getPackageData[4];
            for (let i = 0; i < getPackageData.length - 1; i++) {
              const element = getPackageData[i];
              // When Request for edit features
              if (
                ctx.args.data.isEdit &&
                ctx.args.data.text[i].features &&
                ctx.args.data.text[i].features.length > 0
              ) {
                // Add new objects if any
                var result = ctx.args.data.text[i].features.filter((elm) => {
                  !element.features
                    .map((elm) => {
                      JSON.stringify(elm.key);
                    })
                    .includes(JSON.stringify(elm.key));
                });
                element.features = result.concat(element.features);
                // Update Object if it is Exist
                element.features.filter((e) => {
                  ctx.args.data.text[i].features.filter((feature) => {
                    if (e.key === feature.key) {
                      e.value = feature.value;
                    }
                  });
                });
              }
              // When Request for delete features
              if (
                ctx.args.data.isDelete &&
                ctx.args.data.text[i].features &&
                ctx.args.data.text[i].features.length > 0
              ) {
                // Delete Object if it is Exist
                element.features.filter((e) => {
                  ctx.args.data.text[i].features.filter((feature) => {
                    if (e.key === feature.key) {
                      const index = element.features.findIndex(
                        (el) => el.key === e.key
                      );
                      delete element.features[index];
                      element.features.filter((elm) => {
                        tempArray.push(elm);
                      });
                    }
                  });
                });
                if (tempArray.length > 0) {
                  element.features = tempArray;
                }
                tempArray = [];
              }
              // When Request for edit customer_support
              if (
                ctx.args.data.isEdit &&
                ctx.args.data.text[i].customer_support &&
                ctx.args.data.text[i].customer_support.length > 0
              ) {
                // Add new objects if any
                var result = ctx.args.data.text[i].customer_support.filter(
                  (elm) =>
                    !element.customer_support
                      .map((elm) => JSON.stringify(elm.key))
                      .includes(JSON.stringify(elm.key))
                );
                element.customer_support = result.concat(
                  element.customer_support
                );
                // Update Object if it is Exist
                element.customer_support.filter((e) => {
                  ctx.args.data.text[i].customer_support.filter((feature) => {
                    if (e.key === feature.key) {
                      e.value = feature.value;
                    }
                  });
                });
              }
              // When Request for delete customer_support
              if (
                ctx.args.data.isDelete &&
                ctx.args.data.text[i].customer_support &&
                ctx.args.data.text[i].customer_support.length > 0
              ) {
                // Delete Object if it is Exist
                element.customer_support.filter((e) => {
                  ctx.args.data.text[i].customer_support.filter((feature) => {
                    if (e.key === feature.key) {
                      const index = element.customer_support.findIndex(
                        (el) => el.key === e.key
                      );
                      delete element.customer_support[index];
                      element.customer_support.filter((elm) => {
                        tempArray.push(elm);
                      });
                    }
                  });
                });
                if (tempArray.length > 0) {
                  element.customer_support = tempArray;
                }
                tempArray = [];
              }
              // When Request for edit pricing
              if (
                ctx.args.data.isEdit &&
                ctx.args.data.text[i].pricing &&
                ctx.args.data.text[i].pricing.length > 0
              ) {
                // Add new objects if any
                var result = ctx.args.data.text[i].pricing.filter(
                  (elm) =>
                    !element.pricing
                      .map((elm) => JSON.stringify(elm.key))
                      .includes(JSON.stringify(elm.key))
                );
                element.pricing = result.concat(element.pricing);
                // Update Object if it is Exist
                element.pricing.filter((e) => {
                  ctx.args.data.text[i].pricing.filter((feature) => {
                    if (e.key === feature.key) {
                      e.value = feature.value;
                    }
                  });
                });
              }
              // When Request for delete pricing
              if (
                ctx.args.data.isDelete &&
                ctx.args.data.text[i].pricing &&
                ctx.args.data.text[i].pricing.length > 0
              ) {
                // Delete Object if it is Exist
                element.pricing.filter((e) => {
                  ctx.args.data.text[i].pricing.filter((feature) => {
                    if (e.key === feature.key) {
                      const index = element.pricing.findIndex(
                        (el) => el.key === e.key
                      );
                      delete element.pricing[index];
                      element.pricing.filter((elm) => {
                        tempArray.push(elm);
                      });
                    }
                  });
                });
                if (tempArray.length > 0) {
                  element.pricing = tempArray;
                }
                tempArray = [];
              }
              changedPackageData.push(element);
            }
            if (changedPackageData.length > 0) {
              changedPackageData.push(enterPriseData);
              // Update Current Marchant Plan Settings Also as per individual plans
              var getCurrentPlan = await Setting.find({
                where: {
                  registerallow: constants.CURRENT_MERCHANT_PLAN_LABEL,
                  status: 1,
                },
              });
              // update each object
              for (let i = 0; i < getCurrentPlan.length; i++) {
                const element = getCurrentPlan[i];
                var elemeText = constants.parseJson(element.text);
                changedPackageData.filter(async (e) => {
                  if (e.type.value === elemeText.type.value) {
                    await Setting.updateAll(
                      {
                        id: element.id,
                      },
                      {
                        text: constants.stringifyJson(e),
                      }
                    );
                    return;
                  }
                });
              }
              ctx.args.data.text = constants.stringifyJson(changedPackageData);
            }
            // null masterdetailId
            ctx.args.data.masterdetailId = null;
          }
        }
      }

      // ADDRESS_CONFIGURATION
      if (
        ctx.args.data.registerallow === SETTING_CONSTANTS.ADDRESS_CONFIGURATION
      ) {
        // When Request for edit ADDRESS_CONFIGURATION
        if (ctx.args.data.isEdit) {
          ctx.args.data.text = constants.stringifyJson(ctx.args.data.text);
        }
        // When Request for add new object in ADDRESS_CONFIGURATION
        if (ctx.args.data.isAdd) {
          var whereObject = {
            registerallow: ctx.args.data.registerallow,
            masterdetailId: ctx.req.query.where.masterdetailId,
          };
          var getAddressConfig = await SETTING_CONSTANTS.settingFindOneQuery(
            whereObject
          );
          getAddressConfig = constants.parseJson(getAddressConfig.text);

          const maxValueOfId = Math.max(
            ...getAddressConfig.map((o) => o.id),
            0
          );

          if (maxValueOfId === null) {
            maxValueOfId = 0;
          }

          var insertObj = {
            id: maxValueOfId + 1,
            display_text: ctx.args.data.text.display_text,
            field_name: ctx.args.data.text.display_text
              .toLowerCase()
              .split(" ")
              .join("_"),
            visible: ctx.args.data.text.visible,
            mandatory: ctx.args.data.text.mandatory,
          };

          getAddressConfig.push(insertObj);
          ctx.args.data.text = constants.stringifyJson(getAddressConfig);
        }
      }

      // Signup_Options
      if (ctx.args.data.registerallow === constants.SIGNUP_OPTIONS_LABLE) {
        // When Reques for edit signup options
        if (ctx.args.data.isEdit) {
          ctx.args.data.text = constants.stringifyJson(ctx.args.data.text);
        }
        // When Reques for add new object in signup options
        if (ctx.args.data.isAdd) {
          var whereObject = {
            registerallow: ctx.args.data.registerallow,
            masterdetailId: ctx.req.query.where.masterdetailId,
          };
          var getSignupOptions = await constants.settingFindOneQuery(
            whereObject
          );
          getSignupOptions = constants.parseJson(getSignupOptions.text);
          getSignupOptions.push(ctx.args.data.text);
          ctx.args.data.text = constants.stringifyJson(getSignupOptions);
        }
      }

      // Pincode Delivery (Add, edit, delete)
      if (ctx.args.data.registerallow === constants.SETTING_PINCODE_DELIVERY) {
        // Get Pincode Details
        var getPincodeData = await constants.commonFindOneFunction({
          model: app.models.setting,
          whereObj: {
            registerallow: ctx.args.data.registerallow,
            masterdetailId: ctx.req.query.where.masterdetailId,
          },
        });
        // parse pincode text to JSON.
        getPincodeData = await constants.parseJson(getPincodeData.text);
        var cityDetails;

        if (ctx.args.data.isAdd || ctx.args.data.isEdit) {
          cityDetails = await cityModel.findById(ctx.args.data.text.cityId);
        }

        // When Request for addiing new Pincode
        if (ctx.args.data.isAdd) {
          var insertId = 1;
          if (getPincodeData.length > 0) {
            // Check Pincode Already Exist
            const isPincodeExist = getPincodeData.find(
              (x) => x.pincode === ctx.args.data.text.pincode
            );
            if (isPincodeExist) {
              throw await constants.createError(
                409,
                "Sorry, Pinocde already exist"
              );
            }
            // Get Last Object Details
            var lastObjectDetails = getPincodeData.slice(-1);
            insertId = lastObjectDetails[0].id + 1;
          }
          // Add Pincode
          getPincodeData.push({
            id: insertId,
            pincode: ctx.args.data.text.pincode,
            cityId: ctx.args.data.text.cityId,
            status: 1,
            charges: ctx.args.data.text.charges,
            cityName: cityDetails.name,
          });
        }

        // When Request for edit Pincode
        if (ctx.args.data.isEdit) {
          ctx.args.data.text.id = parseInt(ctx.args.data.text.id);
          for (let i = 0; i < getPincodeData.length; i++) {
            const element = getPincodeData[i];
            if (element.id === ctx.args.data.text.id) {
              // Check wheather chnaged pincode already exist or not
              const isPincodeExist = getPincodeData.find(
                (x) => x.pincode === ctx.args.data.text.pincode
              );
              if (
                isPincodeExist &&
                ctx.args.data.text.pincode !== element.pincode
              ) {
                throw await constants.createError(
                  409,
                  "Sorry, Pinocde already exist"
                );
              }
              element.pincode = ctx.args.data.text.pincode;
              element.status = 1;
              element.cityId = ctx.args.data.text.cityId;
              element.cityName = cityDetails.name;
              element.charges = ctx.args.data.text.charges;
              break;
            }
          }
        }

        // When Request for deleting Pincode
        if (ctx.args.data.isDelete) {
          ctx.args.data.text.id = parseInt(ctx.args.data.text.id);
          const index = getPincodeData.findIndex(
            (i) => i.id === ctx.args.data.text.id
          );
          if (index !== -1) {
            getPincodeData.splice(index, 1);
          }
        }

        // After Operation Stringify Data Again
        ctx.args.data.text = constants.stringifyJson(getPincodeData);
      }

      // Edit Current Merchant Plan
      if (
        ctx.args.data.registerallow === constants.CURRENT_MERCHANT_PLAN_LABEL
      ) {
        if (ctx.args.data.isPlanEditByAdmin) {
          if (ctx.args.data.masterdetailId) {
            // get masterDetailsData
            var masterDetailsData = await masterdetailModel.findOne({
              where: {
                id: ctx.args.data.masterdetailId,
              },
            });
            if (masterDetailsData) {
              // push subscriptionId in description data
              var descriptionData = JSON.parse(masterDetailsData.description);
              if (descriptionData && descriptionData.length > 0) {
                // set isFreeTrial false
                descriptionData.find((item) => {
                  if (item.key === "isFreeTrial") {
                    item.value = false;
                  }
                  if (item.key === "plan_name") {
                    item.value = "Starter";
                  }
                  // If PlanId is provided to set monthly plan or yearly then set it else go with monthly free plan
                  if (item.key === "planId") {
                    ctx.args.data.planId
                      ? (item.value = ctx.args.data.planId)
                      : (item.value = "plan_veqEORBzplmGbV");
                  }
                });
                // Update Both Details
                await masterdetailModel.updateAll(
                  {
                    id: ctx.args.data.masterdetailId,
                  },
                  {
                    description: JSON.stringify(descriptionData),
                    modified: new Date(),
                  }
                );
              }
            }
          }

          // Set Starter Package
          var getAllPackages = await Setting.findOne({
            where: {
              registerallow: constants.PACKAGE_DETAILS_LABEL,
            },
          });
          getAllPackages = JSON.parse(getAllPackages.text);
          ctx.args.data.text = getAllPackages.find(
            (obj) => obj.type.value === "Starter"
          );

          // Get Product Limit
          var productLimit = await constants.getFreePlanDetails(
            ctx.args.data.text,
            constants.NUMBER_OF_PRODUCT_KEY,
            true
          );
          // 3rd parameter we have passed true is for check key in features

          if (productLimit !== constants.UNLIMITED_LABEL) {
            // Get Total Products
            var getTotalProductsCount = await productModel.find({
              where: {
                masterdetailId: ctx.args.data.masterdetailId,
              },
            });
            getTotalProductsCount = getTotalProductsCount.length;

            if (getTotalProductsCount > productLimit) {
              getTotalProductsCount -= productLimit;
              var getProductsOutOfLimit = await productModel.find({
                where: {
                  masterdetailId: ctx.args.data.masterdetailId,
                },
                order: "created ASC",
                skip: productLimit,
                limit: getTotalProductsCount,
              });

              // Update status of out of limit products
              for (let i = 0; i < getProductsOutOfLimit.length; i++) {
                const element = getProductsOutOfLimit[i];
                await productModel.updateAll(
                  {
                    id: element.id,
                    masterdetailId: ctx.args.data.masterdetailId,
                  },
                  {
                    productstatus: 0,
                  }
                );
              }
            }
          }

          // Get User Limit
          var userLimit = await constants.getFreePlanDetails(
            ctx.args.data.text,
            constants.NUMBER_OF_USER_ACCOUNT_KEY,
            true
          );
          // 3rd parameter we have passed true is for check key in features

          if (userLimit !== constants.UNLIMITED_LABEL) {
            // Get Total Users
            var getTotalUsersCount = await userModel.find({
              where: {
                masterdetailId: ctx.args.data.masterdetailId,
                roleId: 2,
              },
            });
            getTotalUsersCount = getTotalUsersCount.length;

            if (getTotalUsersCount > userLimit) {
              getTotalUsersCount -= userLimit;
              var getUsersOutOfLimit = await userModel.find({
                where: {
                  masterdetailId: ctx.args.data.masterdetailId,
                  roleId: 2,
                },
                order: "created ASC",
                skip: userLimit,
                limit: getTotalUsersCount,
              });

              // Update status of out of limit customers
              for (let i = 0; i < getUsersOutOfLimit.length; i++) {
                const element = getUsersOutOfLimit[i];
                await userModel.updateAll(
                  {
                    id: element.id,
                    roleId: 2,
                    masterdetailId: ctx.args.data.masterdetailId,
                  },
                  {
                    userstatus: "Deactive",
                  }
                );
              }
            }
          }

          // Get Salesman Limit
          var salesmanLimit = await constants.getFreePlanDetails(
            ctx.args.data.text,
            constants.NUMBER_OF_STAFF_ACCOUNT_KEY,
            true
          );
          // 3rd parameter we have passed true is for check key in features

          if (salesmanLimit !== constants.UNLIMITED_LABEL) {
            // Get Total Salesman
            var getTotalSalesmanCount = await userModel.find({
              where: {
                masterdetailId: ctx.args.data.masterdetailId,
                roleId: 3,
              },
            });
            getTotalSalesmanCount = getTotalSalesmanCount.length;

            if (getTotalSalesmanCount > salesmanLimit) {
              getTotalSalesmanCount -= salesmanLimit;
              var getSalesmanOutOfLimit = await userModel.find({
                where: {
                  masterdetailId: ctx.args.data.masterdetailId,
                  roleId: 3,
                },
                order: "created ASC",
                skip: salesmanLimit,
                limit: getTotalSalesmanCount,
              });

              // Update status of out of limit customers
              for (let i = 0; i < getSalesmanOutOfLimit.length; i++) {
                const element = getSalesmanOutOfLimit[i];
                await userModel.updateAll(
                  {
                    id: element.id,
                    roleId: 3,
                    masterdetailId: ctx.args.data.masterdetailId,
                  },
                  {
                    userstatus: "Deactive",
                  }
                );
              }
            }
          }

          // Set Receive Orders on Whatsapp Status
          var getReceiveOrdersOnWhatsAppStatus =
            await constants.getFreePlanDetails(
              ctx.args.data.text,
              constants.RECEIVE_ORDERS_ON_WHATSAPP_KEY,
              true
            );
          // Update status
          await Setting.updateAll(
            {
              masterdetailId: ctx.args.data.masterdetailId,
              registerallow: constants.ORDER_VIA_WHATSAPP_LABLE,
            },
            {
              status: getReceiveOrdersOnWhatsAppStatus,
            }
          );

          // Product Variations
          // Multiple Product Images
          // Product Youtube URL
          // Product Brochure(PDF)

          // Customer Groups
          var getGroupStatus = await constants.getFreePlanDetails(
            ctx.args.data.text,
            constants.CUSTOMER_GROUP_KEY,
            true
          );

          if (!getGroupStatus) {
            // Get All Groups & Deactivate
            var getAllGroups = await groupModel.find({
              where: {
                masterdetailId: ctx.args.data.masterdetailId,
              },
            });

            // Except Default Deactivate all other groups
            for (let i = 0; i < getAllGroups.length; i++) {
              const element = getAllGroups[i];
              if (element.name !== constants.DEFAULT) {
                await groupModel.updateAll(
                  {
                    id: element.id,
                    masterdetailId: ctx.args.data.masterdetailId,
                  },
                  {
                    status: 0,
                    noofusers: 0,
                  }
                );
              }
            }

            // Update all user to default groupId
            var getDefaultGroupId = await constants.default_groupId(
              ctx.args.data.masterdetailId
            );
            if (getDefaultGroupId) {
              await userModel.updateAll(
                {
                  masterdetailId: ctx.args.data.masterdetailId,
                  roleId: 2,
                },
                {
                  groupId: getDefaultGroupId,
                }
              );
              // Get Total users
              var getTotalUsersCount = await userModel.find({
                where: {
                  masterdetailId: ctx.args.data.masterdetailId,
                  groupId: getDefaultGroupId,
                  roleId: 2,
                },
              });
              // Set total users of default group
              await groupModel.updateAll(
                {
                  id: getDefaultGroupId,
                  masterdetailId: ctx.args.data.masterdetailId,
                },
                {
                  noofusers: getTotalUsersCount.length,
                }
              );
            }
          }

          // Extra Fields in Signup/Order
          // Pending

          // Payment Gateway Integration
          var getPaymentGatewayStatus = await constants.getFreePlanDetails(
            ctx.args.data.text,
            constants.SETTING_PAYMENT_GATEWAY_INTEGRATION,
            true
          );

          if (!getPaymentGatewayStatus) {
            var getPaymentDetails = await Setting.findOne({
              where: {
                masterdetailId: ctx.args.data.masterdetailId,
                registerallow: constants.PAYMENT_DETAILS_KEY,
              },
            });
            if (getPaymentDetails) {
              var getPaymentDetailsText = JSON.parse(getPaymentDetails.text);
              getPaymentDetailsText.filter((item) => (item.status = 0));
            }
            // Update Payment Gateway JSON
            await Setting.updateAll(
              {
                registerallow: constants.PAYMENT_DETAILS_KEY,
                masterdetailId: ctx.args.data.masterdetailId,
              },
              {
                text: JSON.stringify(getPaymentDetailsText),
              }
            );
          }

          // Shipping API Integration
          var getShippingStatus = await constants.getFreePlanDetails(
            ctx.args.data.text,
            constants.SETTING_SHIPPING_API_INTEGRATION,
            true
          );
          if (!getShippingStatus) {
            // Update Shipping Options
            await Setting.updateAll(
              {
                registerallow: constants.SHIPPINGOPTIONS_LABLE,
                masterdetailId: ctx.args.data.masterdetailId,
              },
              {
                status: 0,
              }
            );
          }
        }

        ctx.args.data.text = JSON.stringify(ctx.args.data.text);
      }

      // Edit Theme_Config
      if (
        ctx.args.data.registerallow === constants.THEME_CONFIG_KEY ||
        ctx.args.data.registerallow === constants.SETTING_INSTANCE_CONFIGURATION
      ) {
        ctx.args.data.text = JSON.stringify(ctx.args.data.text);
      }

      // Edit Tenant_Config
      if (ctx.args.data.registerallow === constants.SETTING_TENANT_CONFIG) {
        var text;
        var tenantConfigData = await Setting.findOne({
          where: {
            id: ctx.req.params.id,
            registerallow: constants.SETTING_TENANT_CONFIG,
            masterdetailId: ctx.args.data.masterdetailId,
          },
        });
        if (tenantConfigData) {
          text = JSON.parse(tenantConfigData.text);
          if (ctx.args.data.text.maxDiscountPercentage) {
            text.maxDiscountPercentage =
              ctx.args.data.text.maxDiscountPercentage;
          }
          if (ctx.args.data.text.maxCellnumberDigitLimit) {
            text.maxCellnumberDigitLimit =
              ctx.args.data.text.maxCellnumberDigitLimit;
          }
          if (ctx.args.data.changeLoginMode) {
            if (ctx.args.data.text.isEmailBasedLogin) {
              text.isEmailBasedLogin = ctx.args.data.text.isEmailBasedLogin;
            } else {
              text.isEmailBasedLogin = false;
            }
          }
          if (ctx.args.data.changeDarkMode) {
            if (ctx.args.data.text.isDarkMode) {
              text.isDarkMode = ctx.args.data.text.isDarkMode;
            } else {
              text.isDarkMode = false;
            }
          }
          if (ctx.args.data.changeDefaultLoaderMode) {
            if (ctx.args.data.text.isDefaultLoader) {
              text.isDefaultLoader = ctx.args.data.text.isDefaultLoader;
            } else {
              text.isDefaultLoader = false;
            }
          }
          if (ctx.args.data.changeShowLastModifiedDateMode) {
            if (ctx.args.data.text.isShowLastModifiedDate) {
              text.isShowLastModifiedDate =
                ctx.args.data.text.isShowLastModifiedDate;
            } else {
              text.isShowLastModifiedDate = false;
            }
          }
          if (ctx.args.data.changeXEMode) {
            text.isShowXEModule = ctx.args.data.text.isShowXEModule;
          }
          ctx.args.data.text = JSON.stringify(text);
        }
      }

      // Edit Service Charge
      if (ctx.args.data.registerallow === constants.SERVICE_CHARGE_KEY) {
        ctx.args.data.text = JSON.stringify(ctx.args.data.text);
      }

      // Edit Menifest json / General Setting / Credentials / All_Plans
      if (
        ctx.args.data.registerallow === constants.MANIFEST_DETAILS_KEY ||
        ctx.args.data.registerallow === constants.SETTING_GENERAL_CONFIG ||
        ctx.args.data.registerallow ===
          constants.SUFALAM_RAZORPAY_CREDENTIALS_LABEL ||
        ctx.args.data.registerallow === constants.ALL_PLANS_LABLES ||
        ctx.args.data.registerallow === SETTING_CONSTANTS.COLLECTION
      ) {
        ctx.args.data.text = JSON.stringify(ctx.args.data.text);
        ctx.args.data.masterdetailId = null;
      }
    } catch (error) {
      throw error;
    }
  });

  Setting.afterRemote(
    "prototype.patchAttributes",
    async (ctx, modelInstance) => {
      var productModel = app.models.product;
      var notifyModel = app.models.notify;

      try {
        var registrationArray = [];
        // Registration Mode: allow
        if (ctx.args.data.registerallow === constants.ALLOW_LABLE) {
          registrationArray = ["ADMIN", "ADMINAPPROVE"];
        }
        // Registration Mode: admin
        if (ctx.args.data.registerallow === constants.ADMIN_LABLE) {
          registrationArray = ["ALLOW", "ADMINAPPROVE"];
        }
        // Registration Mode: admin allow
        if (ctx.args.data.registerallow === constants.ADMIN_APPROVE_LABLE) {
          registrationArray = ["ALLOW", "ADMIN"];
        }
        // Update Registration Mode
        if (
          ctx.args.data.registerallow === constants.ALLOW_LABLE ||
          ctx.args.data.registerallow === constants.ADMIN_LABLE ||
          ctx.args.data.registerallow === constants.ADMIN_APPROVE_LABLE
        ) {
          await Setting.updateAll(
            {
              registerallow: {
                inq: registrationArray,
              },
              masterdetailId: ctx.req.query.where.masterdetailId,
            },
            {
              status: 0,
            }
          );
        }

        // in inquiry
        if (ctx.instance.id === 4) {
          if (ctx.args.data.status === 1) {
            await productModel.updateAll(
              {
                masterdetailId: ctx.req.query.where.masterdetailId,
              },
              {
                inInquiry: true,
              }
            );
          } else if (ctx.args.data.status === 0) {
            await productModel.updateAll(
              {
                masterdetailId: ctx.req.query.where.masterdetailId,
              },
              {
                inInquiry: false,
              }
            );
          }
        }

        // if(ctx.args.data.status == 1){
        var cdmData = await Setting.findById(parseInt(ctx.req.params.id));
        if (
          cdmData &&
          cdmData.registerallow === constants.CUSTOM_DOMAIN_MAPPING_KEY &&
          ctx.args.data.text &&
          ctx.args.data.text.length > 0
        ) {
          var userData = await app.models.user.findOne({
            where: {
              id: ctx.req.accessToken.userId,
              masterdetailId: ctx.req.query.where.masterdetailId,
            },
          });
          userData.customdomain = ctx.args.data.text;
          await notifyModel.share("CDM/EMAIL", userData, {
            masterdetailId: null,
          });
        }
      } catch (error) {
        throw error;
      }
    }
  );

  // check api version
  Setting.checkversion = async (req) => {
    var versionObj,
      minAPIVerion,
      CurrentVersion,
      androidVersionObject,
      minAndroidVersion,
      androidCurrentVersion,
      iosVersionObject,
      minIOSVersion,
      iOSCurrentVersion;
    var resObject;
    try {
      var setting = await Setting.find({
        where: {
          masterdetailId: req.query.where.masterdetailId,
        },
      });

      // api version
      versionObj = JSON.parse(setting[8].registerallow);
      minAPIVerion = versionObj["min_api_version"];
      CurrentVersion = versionObj["current_api_version"];

      // android version
      androidVersionObject = JSON.parse(setting[9].registerallow);
      minAndroidVersion = androidVersionObject["min_android_version"];
      androidCurrentVersion = androidVersionObject["current_android_version"];

      // iOS version
      iosVersionObject = JSON.parse(setting[10].registerallow);
      minIOSVersion = iosVersionObject["min_ios_version"];
      iOSCurrentVersion = iosVersionObject["current_ios_version"];

      if (req.body.androidVersion) {
        // android version

        if (req.body.androidVersion < androidCurrentVersion) {
          // requested api version is lower than current version

          if (req.body.androidVersion < minAndroidVersion) {
            // requested api version is lower then min api verion
            resObject = createObject(
              505,
              "Your application is running an outdated version ! Please Update the application!",
              minAndroidVersion,
              androidCurrentVersion
            );
          } else {
            // requested api version is greater than min api version
            resObject = createObject(
              515,
              "A new version is available!",
              minAndroidVersion,
              androidCurrentVersion
            );
          }
        } else if (req.body.androidVersion === androidCurrentVersion) {
          // Equal api version
          resObject = createObject(
            200,
            "Success",
            minAndroidVersion,
            androidCurrentVersion
          );
        } else {
          resObject = createObject(
            525,
            "API will be unavailable!",
            minAndroidVersion,
            androidCurrentVersion
          );
        }
      } else if (req.body.iOSVersion) {
        // iOS version

        if (req.body.iOSVersion < iOSCurrentVersion) {
          // requested api version is lower than current version

          if (req.body.iOSVersion < minIOSVersion) {
            // requested api version is lower then min api verion
            resObject = createObject(
              505,
              "Your application is running an outdated version ! Please Update the application!",
              minIOSVersion,
              iOSCurrentVersion
            );
          } else {
            // requested api version is greater than min api version
            resObject = createObject(
              515,
              "A new version is available!",
              minIOSVersion,
              iOSCurrentVersion
            );
          }
        } else if (req.body.iOSVersion === iOSCurrentVersion) {
          // Equal api version
          resObject = createObject(
            200,
            "Success",
            minIOSVersion,
            iOSCurrentVersion
          );
        } else {
          resObject = createObject(
            525,
            "API will be unavailable!",
            minIOSVersion,
            iOSCurrentVersion
          );
        }
      } else if (req.body.APIVersion) {
        // API version

        if (req.body.APIVersion < CurrentVersion) {
          // requested api version is lower than current version

          if (req.body.APIVersion < minAPIVerion) {
            // requested api version is lower then min api verion
            resObject = createObject(
              505,
              "Your application is running an outdated version ! Please Update the application!",
              minAPIVerion,
              CurrentVersion
            );
          } else {
            // requested api version is greater than min api version
            resObject = createObject(
              515,
              "A new version is available!",
              minAPIVerion,
              CurrentVersion
            );
          }
        } else if (req.body.APIVersion === CurrentVersion) {
          // Equal api version
          resObject = createObject(
            200,
            "Success",
            minAPIVerion,
            CurrentVersion
          );
        } else {
          resObject = createObject(
            525,
            "API will be unavailable!",
            minAPIVerion,
            CurrentVersion
          );
        }
      }

      return resObject;
    } catch (error) {
      throw error;
    }
  };

  // Enable/Disable Payment Mode
  Setting.changeStatus = async (req) => {
    var productModel = app.models.product;
    var getUpdatedData;
    var resData;
    var reqData = [];

    try {
      if (req.body) {
        if (req.body[0].registerallow === "Login_Options") {
          var logindata = req.body[0].text;
          var data = JSON.stringify(logindata);
          var updateData = await Setting.updateAll(
            {
              id: req.body[0].id,
              masterdetailId: req.query.where.masterdetailId,
            },
            {
              text: data,
            }
          );
        }

        if (req.body[0].registerallow === "Catalogue_Jewellary") {
          var logindata = req.body[0].text;
          var data = JSON.stringify(logindata);
          var updateData = await Setting.updateAll(
            {
              id: req.body[0].id,
              masterdetailId: req.query.where.masterdetailId,
            },
            {
              text: data,
            }
          );

          // Update the Product Price too
          var getData = await productModel.find({
            where: {
              masterdetailId: req.query.where.masterdetailId,
            },
          });
          if (getData.length > 0) {
            for (var i = 0; i < getData.length; i++) {
              const element = getData[i];
              data = JSON.parse(element.other);
              if (
                data &&
                data.jewelleryData.id === req.body[0].editjewellerytypeid
              ) {
                //  update the Other Object
                data.jewelleryData.name = req.body[0].editjewellerytypename;
                data.jewelleryData.price = req.body[0].editjewellerytypeprice;
                data.jewelleryData.jwellerytypePrice =
                  req.body[0].editjewellerytypeprice;
                data.jewelleryData.weightintoprice =
                  data.jewelleryData.weight * data.jewelleryData.price;
                data.jewelleryData.weightintoprice = parseInt(
                  data.jewelleryData.weightintoprice
                );

                // set gst 0 in making charges
                data.jewelleryData.makingcharges.filter((e) => {
                  if (e.id === 1) {
                    // e.pricelable = titlecase.titleCase(e.pricelable);
                    e.pricelable = "Gst 3%";
                    e.amount = 0;
                  }
                });

                // total of makingcharges with gst price 0
                var temp = 0;
                data.jewelleryData.makingcharges.filter((e) => {
                  temp += e.amount;
                });

                // calculate total price
                var totalprice =
                  parseFloat(data.jewelleryData.price) *
                    data.jewelleryData.weight +
                  temp;

                // get gst percentage
                var getGstPercentage = await Setting.findOne({
                  where: {
                    registerallow: "Merchant_Information",
                    masterdetailId: req.query.where.masterdetailId,
                  },
                });

                getGstPercentage = JSON.parse(getGstPercentage.text);

                if (getGstPercentage.enablegst === 1) {
                  getGstPercentage = getGstPercentage.CountGstPerProduct;
                }

                // count gst
                var calculateGST = (totalprice * getGstPercentage) / 100;
                calculateGST = parseInt(calculateGST);

                data.jewelleryData.makingcharges.filter((e) => {
                  if (e.id === 1) {
                    e.amount = parseInt(calculateGST);
                  }
                });

                // add gst into totalprice
                totalprice = totalprice + calculateGST;
                totalprice = parseInt(totalprice);

                //  stingify other object
                var stringifiedData = JSON.stringify(data);
                // update the product
                await productModel.updateAll(
                  {
                    id: element.id,
                    masterdetailId: req.query.where.masterdetailId,
                  },
                  {
                    price: totalprice,
                    other: stringifiedData,
                  }
                );
              }
            }
          }

          data = await Setting.findOne({
            where: {
              registerallow: constants.CATALOGUEJEWELLARY_LABLE,
              masterdetailId: req.query.where.masterdetailId,
            },
          });
          return data;
        }

        if (req.body[0].registerallow === "Payment_Details") {
          reqData.push(req.body);
          resData = reqData.filter(async (e) => {
            var paymentgatewaydata = e.filter((el) => el.text);
            var data = JSON.stringify(paymentgatewaydata[0].text);
            var updateData = await Setting.updateAll(
              {
                id: paymentgatewaydata[0].id,
                masterdetailId: req.query.where.masterdetailId,
              },
              {
                text: data,
              }
            );

            getUpdatedData = await Setting.findById(paymentgatewaydata[0].id);

            if (getUpdatedData) {
              return getUpdatedData;
            }
          });
        }
      }
      return resData;
    } catch (error) {
      throw error;
    }
  };

  // Get Login Options Without Accesstoken
  Setting.getLoginOptions = async (req) => {
    var resData = {};
    try {
      var getLoginData = await Setting.find({
        where: {
          registerallow: "Login_Options",
          masterdetailId: req.query.where.masterdetailId,
        },
      });
      if (getLoginData.length > 0) {
        var data = JSON.parse(getLoginData[0].__data.text);
        getLoginData[0].__data.text = data;
        resData = getLoginData;
      }
      return resData;
    } catch (error) {
      throw error;
    }
  };

  // Get Colorcode Without Accesstoken
  Setting.getColorCode = async (req) => {
    var resData;
    var data;
    try {
      resData = await Setting.findOne({
        where: {
          registerallow: "Color_Code",
          masterdetailId: req.query.filter.where.masterdetailId,
        },
      });
      if (resData) {
        data = JSON.parse(resData.text);
        // resData.text = data;
        return data;
      }
    } catch (error) {
      throw error;
    }
  };

  Setting.validateAdmin = async (req) => {
    try {
      var setting_api = await Setting.findOne({
        where: {
          text: "API_VERSION",
          masterdetailId: req.query.where.masterdetailId,
        },
      });
      setting_api = JSON.parse(setting_api.registerallow);

      return {
        result: true,
        version: setting_api.current_api_version,
      };
    } catch (error) {
      throw error;
    }
  };

  // Post Banner Object
  Setting.postBanner = async (req) => {
    try {
      var productModel = app.models.product;
      var categoryModel = app.models.category;

      var getBannerData = await Setting.findOne({
        where: {
          registerallow: "Offer_Banners",
          masterdetailId: req.query.where.masterdetailId,
        },
      });

      if (getBannerData) {
        var data = JSON.parse(getBannerData.text);

        const maxValueOfId = Math.max(...data.map((o) => o.id), 0);

        if (maxValueOfId === null) {
          maxValueOfId = 0;
        }

        var bannerObj = {
          id: maxValueOfId + 1,
          media: [
            {
              image: null,
              video: null,
            },
          ],
          link: [
            {
              product: null,
              category: null,
              link: null,
            },
          ],
        };

        if (req.body.media) {
          if (req.body.media[0].image) {
            bannerObj.media[0].image = req.body.media[0].image.name;
          } else {
            bannerObj.media[0].video = req.body.media[0].video.name;
          }
        }
        if (req.body.productId) {
          var getProduct = await productModel.findById(req.body.productId);
          bannerObj.link[0].productId = req.body.productId;
          bannerObj.link[0].productname = getProduct.name;
        }
        if (req.body.categoryId) {
          var getCategory = await categoryModel.findById(req.body.categoryId);
          bannerObj.link[0].categoryId = req.body.categoryId;
          bannerObj.link[0].categoryname = getCategory.name;
        }
        if (req.body.link) {
          bannerObj.link[0].link = req.body.link;
        }

        // var stringifyNewBanner = JSON.stringify(bannerObj);
        data.push(bannerObj);

        var stringifyData = JSON.stringify(data);

        await Setting.updateAll(
          {
            registerallow: "Offer_Banners",
            masterdetailId: req.query.where.masterdetailId,
          },
          {
            text: stringifyData,
          }
        );
      }
    } catch (error) {
      throw error;
    }
  };

  Setting.deleteBanner = async (req) => {
    try {
      var getBannerData = await Setting.findOne({
        where: {
          registerallow: "Offer_Banners",
          masterdetailId: req.query.where.masterdetailId,
        },
      });
      var data = JSON.parse(getBannerData.text);

      const index = data.findIndex((i) => i.id === req.body.id);
      if (index !== -1) {
        data.splice(index, 1);
      }

      var stringifyData = JSON.stringify(data);
      await Setting.updateAll(
        {
          registerallow: "Offer_Banners",
          masterdetailId: req.query.where.masterdetailId,
        },
        {
          text: stringifyData,
        }
      );
    } catch (error) {
      throw error;
    }
  };

  // for app getBanner
  Setting.getOfferBanner = async (req) => {
    var resData;
    var data;
    try {
      resData = await Setting.findOne({
        where: {
          registerallow: "Offer_Banners",
          masterdetailId: req.query.filter.where.masterdetailId,
        },
      });
      if (resData) {
        data = JSON.parse(resData.text);
        // resData.text = data;
        return data;
      }
    } catch (error) {
      throw error;
    }
  };

  // Post razorpayment
  Setting.razorpayment = async (req) => {
    var razorpay_config;
    var response = {};

    try {
      // get razorpay_config
      var getconfig = await Setting.findOne({
        where: {
          registerallow: "Payment_Details",
          masterdetailId: req.query.where.masterdetailId,
        },
      });
      getconfig = JSON.parse(getconfig.text);
      for (var i = 0; i < getconfig.length; i++) {
        const element = getconfig[i];
        if (element.name === "RazorPay") {
          razorpay_config = element;
        }
      }

      var instance = new Razorpay({
        key_id: razorpay_config.config.key_id,
        key_secret: razorpay_config.config.key_secret,
      });

      var options = {
        amount: req.body.amount * 100, //(by multiplying with 100 converting in Rs.) amount in the smallest currency unit
        currency: "INR",
      };

      var data = await new Promise((resolve, reject) => {
        instance.orders.create(options, (err, order) => {
          if (err) {
            reject(err);
          } else if (order) {
            response = {
              amount: order.amount / 100, // convertingpaisa to Rs.
              orderId: order.id,
            };
            resolve(response);
          }
        });
      });

      return data;
    } catch (error) {
      throw error;
    }
  };

  // Get admin details Without Accesstoken
  Setting.getLogo = async (req) => {
    var resData;
    try {
      resData = await Setting.findOne({
        where: {
          registerallow: constants.MERCHANTINFORMATION_LABLE,
          masterdetailId: req.query.filter.where.masterdetailId,
        },
      });

      // resData.firstname.length > 0 && resData.lastname.length ? resData.username = resData.firstname.concat(' ' + resData.lastname) : resData.username

      if (resData) {
        resData = JSON.parse(resData.text);
        if (resData.companyname) {
          resData.username = resData.companyname;
        } else if (!resData.username) {
          if (
            resData.firstname &&
            resData.firstname.length > 0 &&
            resData.lastname &&
            resData.lastname.length
          ) {
            resData.username = resData.firstname.concat(" " + resData.lastname);
          } else {
            if (resData.companyname) {
              resData.username = resData.companyname;
            }
          }
        }
        resData = {
          profilepic: resData.profilepic,
          username: resData.username,
        };
        return resData;
      }
    } catch (error) {
      throw error;
    }
  };

  // Get getSignupOptions Without Accesstoken
  Setting.getSignupOptions = async (req) => {
    var resData;
    try {
      resData = await Setting.findOne({
        where: {
          registerallow: "Signup_Options",
          masterdetailId: req.query.where.masterdetailId,
        },
      });
      if (resData) {
        return JSON.parse(resData.text);
      }
    } catch (error) {
      throw error;
    }
  };

  // Post Product_Variation + Product_Unit + Inquiry_Action + Fixed_Productdetails
  Setting.postSetting = async (req) => {
    try {
      var getData = await Setting.findOne({
        where: {
          registerallow: req.body.registerallow,
          masterdetailId: req.query.where.masterdetailId,
        },
      });

      if (getData) {
        var data = JSON.parse(getData.text);

        if (req.body.registerallow === "Inquiry_Action") {
          if (req.body.subTitle === "next_action") {
            if (data[0].next_action === null) {
              data[0].next_action = [];
            }

            const maxValueOfId = Math.max(
              ...data[0].next_action.map((o) => o.id),
              0
            );

            if (maxValueOfId === null) {
              maxValueOfId = 0;
            }

            var obj = {
              id: maxValueOfId + 1,
            };

            if (req.body.name) {
              obj.actionname = titlecase.titleCase(req.body.name);
            }

            data[0].next_action.push(obj);
            var stringifyData = JSON.stringify(data);

            await Setting.updateAll(
              {
                registerallow: req.body.registerallow,
                masterdetailId: req.query.where.masterdetailId,
              },
              {
                text: stringifyData,
              }
            );
          } else if (req.body.subTitle === "industry") {
            if (data[0].industry === null) {
              data[0].industry = [];
            }

            const maxValueOfId = Math.max(
              ...data[0].industry.map((o) => o.id),
              0
            );

            if (maxValueOfId === null) {
              maxValueOfId = 0;
            }

            var obj = {
              id: maxValueOfId + 1,
            };

            if (req.body.name) {
              obj.industryname = titlecase.titleCase(req.body.name);
            }

            data[0].industry.push(obj);
            var stringifyData = JSON.stringify(data);

            await Setting.updateAll(
              {
                registerallow: req.body.registerallow,
                masterdetailId: ctx.query.where.masterdetailId,
              },
              {
                text: stringifyData,
              }
            );
          }
        } else {
          if (data === null) {
            data = [];
          }

          const maxValueOfId = Math.max(...data.map((o) => o.id), 0);

          if (maxValueOfId === null) {
            maxValueOfId = 0;
          }

          var obj = {
            id: maxValueOfId + 1,
          };

          if (
            req.body.name &&
            req.body.registerallow === "Fixed_Productdetails"
          ) {
            obj.lable = titlecase.titleCase(req.body.name);
            obj.data = "";
          } else {
            obj.name = titlecase.titleCase(req.body.name);
          }

          data.push(obj);
          var stringifyData = JSON.stringify(data);

          await Setting.updateAll(
            {
              registerallow: req.body.registerallow,
              masterdetailId: ctx.query.where.masterdetailId,
            },
            {
              text: stringifyData,
            }
          );
        }
      } else {
        var err = new Error("Setting not found.");
        err.statusCode = 400;
        throw err;
      }
    } catch (error) {
      throw error;
    }
  };

  // Delete Product_Variation + Product_Unit
  Setting.deleteSetting = async (req) => {
    try {
      var getData = await Setting.findOne({
        where: {
          registerallow: req.body.registerallow,
          masterdetailId: req.query.where.masterdetailId,
        },
      });
      var data = JSON.parse(getData.text);

      if (req.body.registerallow === "Inquiry_Action") {
        if (req.body.subTitle === "next_action") {
          const index = data[0].next_action.findIndex(
            (i) => i.id === req.body.id
          );
          if (index !== -1) {
            data[0].next_action.splice(index, 1);
          }
        } else if (req.body.subTitle === "industry") {
          const index = data[0].industry.findIndex((i) => i.id === req.body.id);
          if (index !== -1) {
            data[0].industry.splice(index, 1);
          }
        }
      } else {
        const index = data.findIndex((i) => i.id === req.body.id);
        if (index !== -1) {
          data.splice(index, 1);
        }
      }

      var stringifyData = JSON.stringify(data);

      await Setting.updateAll(
        {
          registerallow: req.body.registerallow,
          masterdetailId: req.query.where.masterdetailId,
        },
        {
          text: stringifyData,
        }
      );
    } catch (error) {
      throw error;
    }
  };

  Setting.addSettingKey = async (req) => {
    var masterdetailModel = app.models.masterdetail;
    var getMasterdetailIds;
    var userModel = app.models.user;

    try {
      // get all masterdetail ids for add setting
      getMasterdetailIds = await masterdetailModel.find();

      for (let i = 0; i < getMasterdetailIds.length; i++) {
        const element = getMasterdetailIds[i];

        // get admin id of each instance
        var getAdminData = await userModel.findOne({
          where: {
            masterdetailId: element.id,
            roleId: 1,
          },
        });

        if (getAdminData) {
          await Setting.create({
            registerallow: req.body.registerallow,
            text: constants.stringifyJson(req.body.text),
            status: 1,
            createdby: getAdminData.id,
            modifiedby: getAdminData.id,
            masterdetailId: element.id,
          });
        }
      }
    } catch (error) {
      throw error;
    }
  };

  Setting.addSettingKeyGeneral = async (req) => {
    try {
      var settingData = await Setting.create({
        registerallow: req.body.registerallow,
        status: req.body.status,
        text: constants.stringifyJson(req.body.text),
      });
      return settingData;
    } catch (error) {
      throw error;
    }
  };

  Setting.listAllDetails = async (req) => {
    var resData;
    var lable;

    try {
      if (
        req.query.filter.where.registerallow === constants.ALL_CATALOGUES_LABLE
      ) {
        lable = constants.ALL_CATALOGUES_LABLE;
      }
      if (req.query.filter.where.registerallow === constants.ALL_PLANS_LABLES) {
        lable = constants.ALL_PLANS_LABLES;
      }

      resData = await Setting.findOne({
        where: {
          registerallow: lable,
        },
      });

      return (resData.text = constants.parseJson(resData.text));
    } catch (error) {
      throw error;
    }
  };

  // Create plan in razorpay plans
  Setting.createRazorpayPlan = async (req) => {
    try {
      // Check All Criteria as per documentation of it | Refer a below link to get details
      // https://razorpay.com/docs/api/subscriptions/#create-a-plan

      if (!req.body.period) {
        throw constants.createError(404, "Please provide period of plan!");
      }
      if (!req.body.interval) {
        throw constants.createError(404, "Please provide interval of plan!");
      }
      if (req.body.item) {
        if (!req.body.item.name) {
          throw constants.createError(404, "Please provide name of plan!");
        }
        if (!req.body.item.amount) {
          throw constants.createError(404, "Please provide amount of plan!");
        }
        if (!req.body.item.currency) {
          throw constants.createError(404, "Please provide currency of plan!");
        }
      }

      var obj = {
        period: req.body.period,
        interval: req.body.interval,
        item: {
          name: req.body.item.name,
          amount: req.body.item.amount,
          currency: req.body.item.currency,
        },
      };

      const rezPayData = await rzp.createPlan(obj);
      return rezPayData;
    } catch (error) {
      throw error;
    }
  };

  // Create plan in razorpay plans
  Setting.doRazorpayOrder = async (req) => {
    var masterdetailModel = app.models.masterdetail;
    try {
      // Get Plan Name
      var currentPlanName = await masterdetailModel.findById(
        req.body.masterdetailId
      );
      currentPlanName = JSON.parse(currentPlanName.description);
      currentPlanName = currentPlanName[1].value;

      const rezPayData = await rzp.getAllPlans();

      // Get Current Plan
      var currentPlan = rezPayData.filter((e) => {
        if (e.item.name === currentPlanName) {
          return e;
        }
      });

      const postObject = {
        plan_id: currentPlan[0].id,
        total_count: req.body.total_count,
        quantity: req.body.quantity
          ? (req.body.quantity = req.body.quantity)
          : 1,
        customer_notify: req.body.customer_notify
          ? (req.body.customer_notify = req.body.customer_notify)
          : 1,
      };

      // var getCurrentTimeStamp = + new Date();
      // console.log(getCurrentTimeStamp);

      const subscriptionData = await rzp.createSubscription(postObject);

      return subscriptionData;
    } catch (error) {
      throw error;
    }
  };

  // get package details data for showing into admin panel dashboard
  Setting.getDashboardPackageDetails = async (req) => {
    var response = {};
    var products = {};
    var customers = {};
    var salesmen = {};
    var smsCredits = {};
    var diskSpace = {};
    var subDirectory = {};

    try {
      /**
       * 1.No of Products
       * 2.No of Customers
       * 3.No of Staff Accounts
       * 4.SMS Credits
       * 5.Disk Space (for product images/brochrue)
       */

      // Get Total Products
      var totalProducts = await app.models.product.find({
        where: {
          masterdetailId: req.query.where.masterdetailId,
        },
      });
      // Get Total Users
      var totalUsers = await app.models.user.find({
        where: {
          roleId: 2,
          masterdetailId: req.query.where.masterdetailId,
        },
      });
      // Get Total Salesmans
      var totalSalesmen = await app.models.user.find({
        where: {
          roleId: 3,
          masterdetailId: req.query.where.masterdetailId,
        },
      });
      // Get Total Sent SMS Count
      var getSMSCredit = await app.models.masterdetailmeta.findOne({
        where: {
          masterdetailId: req.query.where.masterdetailId,
        },
      });
      // changes for get disk space
      // get size of used disk space
      // var data = await getDiskSpace({
      //   path: "server/containers"
      // });
      // data = parseFloat(Number(data).toFixed(4));

      // get current merchant plan.
      var result = await constants.getCurrentMarchantPlan(
        constants.CURRENT_MERCHANT_PLAN_LABEL,
        1,
        req.query.where.masterdetailId
      );
      // get allocated limits
      var totalProductLimit = await constants.commonCheckPlanCriteriaFeatures(
        result,
        req.query.where.masterdetailId,
        constants.NUMBER_OF_PRODUCT_KEY
      );
      var totalUserLimit = await constants.commonCheckPlanCriteriaFeatures(
        result,
        req.query.where.masterdetailId,
        constants.NUMBER_OF_USER_ACCOUNT_KEY
      );
      var totalSalesmenLimit = await constants.commonCheckPlanCriteriaFeatures(
        result,
        req.query.where.masterdetailId,
        constants.NUMBER_OF_STAFF_ACCOUNT_KEY
      );
      var totalDiskSpaceLimit = await constants.commonCheckPlanCriteriaFeatures(
        result,
        req.query.where.masterdetailId,
        constants.DISK_SPACE_KEY
      );
      totalDiskSpaceLimit = parseFloat(totalDiskSpaceLimit);
      var totalSmsCreditLimit = await constants.commonCheckPlanCriteriaFeatures(
        result,
        req.query.where.masterdetailId,
        constants.SMS_CREDITS_KEY
      );
      products.productLimit = totalProductLimit;
      products.products = totalProducts.length;
      products.productProgress = parseFloat(
        ((totalProducts.length * 100) / totalProductLimit).toFixed(0)
      );
      products.isProductMaximumLimitReach = await getAlert(
        totalProductLimit,
        totalProducts.length
      );

      customers.userLimit = totalUserLimit;
      customers.users = totalUsers.length;
      if (totalUserLimit === "Unlimited") {
        customers.userProgress = 100; // unlimited users so 100% progress
        customers.isUserMaximumLimitReach = false; // as it's unlimited so it won't reach the max limit
      } else {
        customers.userProgress = parseFloat(
          ((totalUsers.length * 100) / totalUserLimit).toFixed(0)
        );
        customers.isUserMaximumLimitReach = await getAlert(
          totalUserLimit,
          totalUsers.length
        );
      }

      salesmen.salesmenLimit = totalSalesmenLimit;
      salesmen.salesmen = totalSalesmen.length;
      salesmen.salesmenProgress = parseFloat(
        ((totalSalesmen.length * 100) / totalSalesmenLimit).toFixed(0)
      );
      salesmen.isSalesmenMaximumLimitReach = await getAlert(
        totalSalesmenLimit,
        totalSalesmen.length
      );

      smsCredits.smsCreditsLimit = totalSmsCreditLimit;
      smsCredits.smsCredits = getSMSCredit.smscredits;
      smsCredits.smsCreditProgress = parseFloat(
        ((getSMSCredit.smscredits * 100) / totalSmsCreditLimit).toFixed(0)
      );
      smsCredits.isSMSCreditMaximumLimitReach = await getAlert(
        totalSmsCreditLimit,
        getSMSCredit.smscredits
      );

      // sub-directory disk-space
      var code = await app.models.masterdetail.findOne({
        where: {
          id: req.query.where.masterdetailId,
        },
      });

      var getFileUploadSetting =
        await SETTING_CONSTANTS.getTenantSettingValueBasedOnKey(
          SETTING_CONSTANTS.FILE_UPLOAD_KEY,
          req.query.where.masterdetailId
        );
      var productmedia, profilepic, requestproduct;

      if (getFileUploadSetting === SETTING_CONSTANTS.FILE_UPLOAD_TO_S3) {
        productmedia = await s3Constants.getS3BucketFolderSize(
          "productmedia-" + code.codename
        );
        profilepic = await s3Constants.getS3BucketFolderSize(
          "profilepic-" + code.codename
        );
        requestproduct = await s3Constants.getS3BucketFolderSize(
          "requestproduct-" + code.codename
        );
      } else {
        productmedia = await getDiskSpace({
          path: "server/containers/productmedia-" + code.codename,
        });
        profilepic = await getDiskSpace({
          path: "server/containers/profilepic-" + code.codename,
        });
        requestproduct = await getDiskSpace({
          path: "server/containers/requestproduct-" + code.codename,
        });
      }

      diskSpace.filledDiskSpaceLimit = totalDiskSpaceLimit; // + " GB";
      diskSpace.filledDiskSpace = parseFloat(
        (
          Number(productmedia) +
          Number(profilepic) +
          Number(requestproduct)
        ).toFixed(2)
      ); // + " GB";
      diskSpace.diskSpaceProgress = parseFloat(
        ((diskSpace.filledDiskSpace * 100) / totalDiskSpaceLimit).toFixed(2)
      );
      diskSpace.isDiskSpaceMaximumLimitReach = await getAlert(
        totalDiskSpaceLimit,
        diskSpace.filledDiskSpace
      );

      response.products = products;
      response.customers = customers;
      response.salesmen = salesmen;
      response.smsCredits = smsCredits;
      response.diskSpace = diskSpace;

      return response;
    } catch (error) {
      throw error;
    }
  };

  // get package details data for showing into admin panel dashboard
  Setting.getCredentials = async (req) => {
    var response = {};
    try {
      var getData = await Setting.findOne({
        where: {
          registerallow: constants.SUFALAM_RAZORPAY_CREDENTIALS_LABEL,
        },
      });
      getData = JSON.parse(getData.text);
      response.key = buffer.from(getData.key_id).toString("base64");
      return response;
    } catch (error) {
      throw error;
    }
  };

  Setting.getPincodeListing = async (req) => {
    var resData = {};
    var pincodeData, pincodeLength;
    var cityModel = app.models.city;
    var resultData = [];

    try {
      // Get Pincode Details
      pincodeData = await constants.commonFindOneFunction({
        model: app.models.setting,
        whereObj: {
          registerallow: await constants.SETTING_PINCODE_DELIVERY,
          masterdetailId: req.query.where.masterdetailId,
        },
      });

      // parse pincode text to JSON.
      pincodeData = await constants.parseJson(pincodeData.text);
      pincodeLength = pincodeData.length;

      if (req.query.isWeb) {
        if (req.query && req.query.filter && req.query.filter.where) {
          var filteredArray;

          // Picode Filter
          if (
            req.query.filter.where.pincode &&
            req.query.filter.where.pincode.like
          ) {
            filteredArray = pincodeData
              .filter((obj) => {
                obj.pincode = String(obj.pincode);
                if (obj.pincode.includes(req.query.filter.where.pincode.like)) {
                  return obj;
                }
              })
              .map((obj) => obj);
            pincodeData = filteredArray;
            pincodeLength = pincodeData.length;
          }

          // City Filter
          if (req.query.filter.where.city && req.query.filter.where.city.like) {
            filteredArray = [];
            req.query.filter.where.city.like =
              req.query.filter.where.city.like.toLowerCase();
            filteredArray = pincodeData
              .filter((obj) => {
                if (
                  obj.cityName
                    .toLowerCase()
                    .includes(req.query.filter.where.city.like)
                ) {
                  return obj;
                }
              })
              .map((obj) => obj);
            pincodeData = filteredArray;
            pincodeLength = pincodeData.length;
          }

          // Charges Filter
          if (
            req.query.filter.where.charges &&
            req.query.filter.where.charges.like
          ) {
            filteredArray = [];
            filteredArray = pincodeData
              .filter((obj) => {
                obj.charges = String(obj.charges);
                if (obj.charges.includes(req.query.filter.where.charges.like)) {
                  return obj;
                }
              })
              .map((obj) => obj);
            pincodeData = filteredArray;
            pincodeLength = pincodeData.length;
          }
        }

        var limit = parseInt(req.query.filter.limit);
        var skip = parseInt(req.query.filter.skip);

        for (let i = 0; i < pincodeData.length; i++) {
          if (i >= skip && resultData.length < limit) {
            const element = pincodeData[i];
            var city = await cityModel.findById(element.cityId); // find and attach city data
            resultData.push({
              id: element.id,
              pincode: element.pincode,
              cityId: element.cityId,
              status: element.status,
              charges: element.charges,
              cityName: element.cityName,
              city,
            });
          }
        }

        // Order Filter
        if (req.query && req.query.filter && req.query.filter.order) {
          var getOrderKey = req.query.filter.order.split(" ")[0];
          var getOrderValue = req.query.filter.order.split(" ")[1];
          var getOrderType;
          if (resultData.length > 0) {
            getOrderType = typeof resultData[0][getOrderKey];
            if (getOrderValue === "desc" || getOrderValue === "DESC") {
              if (getOrderType === "string") {
                resultData.sort((a, b) => a[getOrderKey] < b[getOrderKey]);
              }
              if (getOrderType === "number") {
                resultData.sort((a, b) => a[getOrderKey] - b[getOrderKey]);
              }
            } else {
              if (getOrderType === "string") {
                resultData.sort((a, b) => b[getOrderKey] < a[getOrderKey]);
              }
              if (getOrderType === "number") {
                resultData.sort((a, b) => b[getOrderKey] - a[getOrderKey]);
              }
            }
          }
        }

        resData.data = resultData;
        resData.length = pincodeLength;
      }

      if (
        req.query &&
        req.query.filter &&
        req.query.filter.where &&
        req.query.filter.where.getSinglePincodeDetails
      ) {
        req.query.filter.where.getSinglePincodeDetails = parseInt(
          req.query.filter.where.getSinglePincodeDetails
        );
        resData = pincodeData.find(
          (x) => x.id === req.query.filter.where.getSinglePincodeDetails
        );
        var city = await cityModel.findById(resData.cityId); // find and attach city data
        resData.city = city;
      }

      // throw await constants.createError(404, 'Sorry, No data available');
      return resData;
    } catch (error) {
      throw error;
    }
  };

  // Import Pincode
  Setting.importPincode = async (req) => {
    var getPincodeDelivery;
    var updatedPincodeData;
    var cityDetails;

    try {
      getPincodeDelivery = await constants.commonFindOneFunction({
        model: app.models.setting,
        whereObj: {
          registerallow: constants.SETTING_PINCODE_DELIVERY,
          masterdetailId: req.body.masterdetailId,
        },
      });

      if (getPincodeDelivery) {
        var pincodes = JSON.parse(getPincodeDelivery.text);
        var length = pincodes.length;
        for (let i = 0; i < req.body.length; i++) {
          const element = req.body[i];
          if (element.City) {
            cityDetails = await constants.commonFindOneFunction({
              model: app.models.city,
              whereObj: {
                name: {
                  like: element.City,
                },
                masterdetailId: req.body.masterdetailId,
              },
            });

            if (!cityDetails) {
              throw constants.createError(
                404,
                element.City + " City is not added. Please add the city"
              );
            }
          } else {
            throw constants.createError(404, "City name is required");
          }
          length += 1;
          pincodes.push({
            id: length,
            pincode: element.Pincode,
            cityId: cityDetails.id,
            status: 1,
            charges: element.Charges,
            cityName: cityDetails.name,
          });
        }

        pincodes = constants.stringifyJson(pincodes);
        updatedPincodeData = await Setting.update(
          {
            registerallow: constants.SETTING_PINCODE_DELIVERY,
            masterdetailId: req.body.masterdetailId,
          },
          {
            text: pincodes,
          }
        );

        return updatedPincodeData;
      } else {
        throw constants.createError(404, "Sorry! Data not Available!");
      }
    } catch (error) {
      throw error;
    }
  };

  // Export Pincode
  Setting.exportPincode = async (req) => {
    var tempArray = [];
    var getPincodeDelivery;

    try {
      getPincodeDelivery = await constants.commonFindOneFunction({
        model: app.models.setting,
        whereObj: {
          registerallow: constants.SETTING_PINCODE_DELIVERY,
          masterdetailId: req.query.where.masterdetailId,
        },
      });

      if (getPincodeDelivery) {
        var pincodes = JSON.parse(getPincodeDelivery.text);

        for (let i = 0; i < pincodes.length; i++) {
          const element = pincodes[i];
          if (element.cityId) {
            var city = await constants.commonFindOneFunction({
              model: app.models.city,
              whereObj: {
                id: element.cityId,
                masterdetailId: req.body.masterdetailId,
              },
            });
          }
          if (element.status === 0) {
            element.status = "Deactive";
          } else if (element.status === 1) {
            element.status = "Active";
          } else {
            element.status = "--";
          }
          tempArray.push({
            Pincode: element.pincode,
            City: city.name,
            "Charges Amount": element.charges,
          });
        }

        return tempArray;
      }
    } catch (error) {
      throw error;
    }
  };

  // get Theme Color API : Parth dt_14-04-2021
  Setting.getThemeColor = async (req) => {
    try {
      var getTheme;
      getTheme = await constants.commonFindOneFunction({
        model: app.models.setting,
        whereObj: {
          registerallow: constants.THEME_CONFIG_KEY,
          masterdetailId: req.query.where.masterdetailId,
        },
      });

      if (getTheme) {
        var text = JSON.parse(getTheme.text);
        return text.webapp.find((o) => o.selected === true);
      }
    } catch (error) {
      throw error;
    }
  };

  Setting.getPackageDetails = async (req) => {
    var responseData = {};
    var getPackageDetails, countryCode;
    var fkeys = [];
    var cskeys = [];
    var pkeys = [];
    var ykeys = [];
    var features = [];
    var customer_support = [];
    var pricing = [];
    var yearly = [];

    try {
      countryCode = await constants.commonFindOneFunction({
        model: app.models.usermetaauth,
        whereObj: {
          userId: req.accessToken.userId,
          roleId: constants.ADMIN_ROLEID,
          masterdetailId: req.query.where.masterdetailId,
        },
      });
      // get PackageDetail key
      getPackageDetails = await Setting.findOne({
        where: {
          registerallow: constants.PACKAGE_DETAILS_LABEL,
        },
      });

      // parseing the text to JSON
      if (getPackageDetails) {
        getPackageDetails = constants.parseJson(getPackageDetails.text);
      }

      getPackageDetails[0].features.filter((obj) => {
        fkeys.push(obj.key);
      });

      getPackageDetails[0].customer_support.filter((obj) => {
        cskeys.push(obj.key);
      });

      getPackageDetails[0].pricing.filter((obj) => {
        pkeys.push(obj.key);
      });

      getPackageDetails[0].yearly.filter((obj) => {
        ykeys.push(obj.key);
      });

      // for features
      for (let k = 0; k < fkeys.length; k++) {
        var values = [];
        for (let i = 0; i < getPackageDetails.length; i++) {
          const element = getPackageDetails[i];
          if (element.features) {
            element.features.find((obj) => {
              if (obj.key == fkeys[k]) {
                values.push(obj.value);
              }
            });
          }
        }
        features.push({
          key: fkeys[k],
          value1: values[0],
          value2: values[1],
          value3: values[2],
          value4: values[3],
        });
      }

      // for customer_support
      for (let k = 0; k < cskeys.length; k++) {
        var values = [];
        for (let i = 0; i < getPackageDetails.length; i++) {
          const element = getPackageDetails[i];
          if (element.customer_support) {
            element.customer_support.find((obj) => {
              if (obj.key == cskeys[k]) {
                values.push(obj.value);
              }
            });
          }
        }
        customer_support.push({
          key: cskeys[k],
          value1: values[0],
          value2: values[1],
          value3: values[2],
          value4: values[3],
        });
      }

      // for pricing
      for (let k = 0; k < pkeys.length; k++) {
        var values = [];
        for (let i = 0; i < getPackageDetails.length; i++) {
          const element = getPackageDetails[i];
          if (element.pricing) {
            element.pricing.find((obj) => {
              if (obj.key == pkeys[k]) {
                if (
                  countryCode.countrycode == "+91" ||
                  countryCode.countrycode == null
                ) {
                  values.push(obj.valueINR);
                } else {
                  values.push(obj.valueUSD);
                }
              }
            });
          }
        }
        pricing.push({
          key: pkeys[k],
          value1: values[0],
          value2: values[1],
          value3: values[2],
          value4: values[3],
        });
      }

      // for yearly
      for (let k = 0; k < ykeys.length; k++) {
        var values = [];
        for (let i = 0; i < getPackageDetails.length; i++) {
          const element = getPackageDetails[i];
          if (element.yearly) {
            element.yearly.find((obj) => {
              if (obj.key == ykeys[k]) {
                if (
                  countryCode.countrycode == "+91" ||
                  countryCode.countrycode == null
                ) {
                  values.push(obj.valueINR);
                } else {
                  values.push(obj.valueUSD);
                }
              }
            });
          }
        }
        yearly.push({
          key: ykeys[k],
          value1: values[0],
          value2: values[1],
          value3: values[2],
          value4: values[3],
        });
      }

      responseData.features = features;
      responseData.customer_support = customer_support;
      responseData.pricing = pricing;
      responseData.yearly = yearly;

      return responseData;
    } catch (error) {
      throw error;
    }
  };

  function createObject(code, message, minVersion, maxVersion) {
    return {
      statusCode: code,
      message: message,
      minVersion: minVersion,
      maxVersion: maxVersion,
    };
  }

  // get used disk space
  async function getDiskSpace(params) {
    try {
      var myFolder = path.resolve(params.path);
      var diskSize;
      var data = await new Promise((resolve, reject) => {
        getSize(myFolder, (err, size) => {
          if (err) reject(err);
          diskSize = parseFloat((size / 1024 / 1024 / 1024).toFixed(6)); // converted in GB
          resolve(diskSize);
        });
      });
      return data;
    } catch (error) {
      throw error;
    }
  }

  // for giving alert if less than 20 percent remaining of total allocated.
  async function getAlert(limit, data) {
    var alertLimit = (limit * 80) / 100;

    if (data < alertLimit) {
      return false;
    } else {
      return true;
    }
  }

  // get Brochure Details API : Parth dt_03-05-2021
  Setting.getBrochureDetails = async (req) => {
    var brochure;
    try {
      brochure = await Setting.findOne({
        where: {
          registerallow: constants.SETTING_TENANT_CONFIG,
          masterdetailId: req.query.where.masterdetailId,
        },
      });

      if (brochure) {
        brochure = constants.parseJson(brochure.text);
      }
      return brochure.brochureDetails;
    } catch (error) {
      throw error;
    }
  };

  // get Import Sample Details
  Setting.getSampleDetails = async (req) => {
    var configDetails;

    try {
      configDetails = await Setting.findOne({
        where: {
          registerallow: constants.SETTING_GENERAL_CONFIG,
        },
      });

      if (!configDetails) {
        throw constants.createError(404, "Sample Not Found");
      }

      if (configDetails) {
        configDetails = constants.parseJson(configDetails.text);
        configDetails = configDetails.importSampleDetails;
        configDetails = configDetails.find((item) => {
          if (item.key === req.query.filter.where.key) {
            return item;
          }
        });
        return configDetails;
      }
    } catch (error) {
      throw error;
    }
  };

  Setting.patchFlatPriceShipping = async (req) => {
    var getShippingDetails;

    try {
      console.log(req);

      getShippingDetails = await Setting.findOne({
        where: {
          registerallow: SETTING_CONSTANTS.SHIPPING_OPTIONS,
          masterdetailId: req.query.where.masterdetailId,
        },
      });

      if (getShippingDetails) {
        getShippingDetails = JSON.parse(getShippingDetails.text);
        var getFlatPriceShippingDetails = getShippingDetails.find(
          (item) => item.id === 3
        );
        getFlatPriceShippingDetails.options = req.body.options;
        await Setting.update(
          {
            registerallow: SETTING_CONSTANTS.SHIPPING_OPTIONS,
            masterdetailId: req.query.where.masterdetailId,
          },
          {
            text: JSON.stringify(getShippingDetails),
          }
        );
      } else {
        throw constants.createError(404, "Shipping details not found");
      }
    } catch (error) {
      throw error;
    }
  };
};
