'use strict';
const app = require("../../server/server");
const constants = require("../const");
const fs = require('fs');
const path = require("path");
const moment = require("moment");
const Razorpay = require("razorpay");
const axios = require('axios');
const request = require("request");
const rzp = require('../../server/bin/razorpay');
const settingConstants = require("../setting_constants");
var cache = require('memory-cache');
var s3Constants = require('../s3_constants');

module.exports = function (Masterdetail) {

  /** Raozr Pay Subscription */
  Masterdetail.razorPayOrder = async (req) => {

    var whereObject;
    var isRenewPlan = false;
    try {

      if (req.body.isRenewPlan) {
        isRenewPlan = true;
      }

      if (!isRenewPlan) { }
      // checkUniqueCompanyName
      if (req.body.companyname) {
        whereObject = {
          companyname: req.body.companyname,
          roleId: constants.ADMIN_ROLEID
        }
        var checkUniqueCompanyName = await constants.userFind(whereObject);
        if (checkUniqueCompanyName.length > 0) {
          throw constants.createError(404, 'Company name already exist!');
        }
      }

      // checkUniqueEmail
      if (req.body.email) {
        whereObject = {
          email: req.body.email,
          roleId: constants.ADMIN_ROLEID
        }
        var checkUniqueEmail = await constants.userFind(whereObject);
        if (req.body.email && checkUniqueEmail.length > 0) {
          throw constants.createError(404, 'Email address already exist!');
        }
      }

      // checkUniqueEmail
      if (req.body.cellnumber) {
        whereObject = {
          cellnumber: req.body.cellnumber,
          roleId: constants.ADMIN_ROLEID
        }
        var checkUniqueCellnumber = await constants.userFind(whereObject);
        if (req.body.cellnumber && checkUniqueCellnumber.length > 0) {
          throw constants.createError(404, 'Cell number already exist!');
        }
      }

      // Get Current Plan
      var currentPlan = await getCurrentPlandDetails(req.body.planId);
      if (!currentPlan) {
        throw constants.createError(400, 'Please upgrade your plan')
      }

      // Get Requested Plan Name
      req.body.planname = currentPlan.item.name;
      req.body.planname = req.body.planname.split(" ")[0];

      // If Period = monthly then pass totalcount = 1 if yearly then 6
      if (currentPlan.period === 'monthly') {
        req.body.total_count = 1;
      }

      if (currentPlan.period === 'yearly') {
        req.body.total_count = 6;
      }

      /** Get Timestamp from date */
      var timeStampWith3MonthsFromCurrentDate = moment(moment()).add(3, 'M').unix(); // add 3 months to current date
      // Start subscription after 3 months
      const postObject = {
        plan_id: currentPlan.id,
        total_count: req.body.total_count,
        quantity: req.body.quantity ? req.body.quantity = req.body.quantity : 1,
        customer_notify: req.body.customer_notify ? req.body.customer_notify = req.body.customer_notify : 1,
        start_at: timeStampWith3MonthsFromCurrentDate
      }

      const subscriptionData = await rzp.createSubscription(postObject);
      console.log(subscriptionData);

      /** Store SubscriptionId & Set free trial to false  */
      if (req.body.masterdetailId) {
        // get masterDetailsData
        var masterDetailsData = await Masterdetail.findOne({
          where: {
            id: req.body.masterdetailId
          }
        });
        if (masterDetailsData) {
          // push subscriptionId in description data
          var descriptionData = JSON.parse(masterDetailsData.description);
          if (descriptionData && descriptionData.length > 0) {
            descriptionData.push({
              key: "subscriptionDetails",
              value: subscriptionData
            });
            // set isFreeTrial false
            descriptionData.find(item => {
              if (item.key === 'isFreeTrial') {
                item.value = false;
              }
            });
            if (req.body.planname) {
              // Set Plan Name
              descriptionData.find(item => {
                if (item.key === 'plan_name') {
                  item.value = req.body.planname;
                }
              });
            }
            if (req.body.planId) {
              // Update Plan Id
              descriptionData.find(item => {
                if (item.key === 'planId') {
                  item.value = req.body.planId;
                }
              });
            }

            // Update Description Details
            await Masterdetail.updateAll({
              id: req.body.masterdetailId
            }, {
              description: JSON.stringify(descriptionData)
            });

          }
        }
      }

      return subscriptionData;

    } catch (error) {
      throw error;
    }

  };

  /** Raozr Pay One Time Payment */
  Masterdetail.razorPayOneTimePayment = async (req) => {
    try {

      // if accesstoken then get User details
      if (req.accessToken && req.accessToken.userId) {
        // Set Currency
        var getUsermetaAuthDetails = await app.models.usermetaauth.findOne({
          where: {
            userId: req.accessToken.userId
          }
        });
        console.log(getUsermetaAuthDetails);
        if (getUsermetaAuthDetails) {
          if (getUsermetaAuthDetails.countrycode === "+91" || getUsermetaAuthDetails.countrycode === null) {
            req.body.currency = "INR";
          } else {
            req.body.currency = "USD";
          }
        }
      }

      // For Now Currency Taken Statically
      req.body.currency = "INR";

      // Get Current Plan
      var currentPlan = await getCurrentPlandDetails(req.body.planId);
      if (!currentPlan) {
        throw constants.createError(400, 'Please upgrade your plan')
      }

      // Get Requested Plan Name
      req.body.planname = currentPlan.item.name;
      req.body.planname = req.body.planname.split(" ")[0];

      // Do Checkout Request
      var options = {
        amount: currentPlan.item.amount, //(by multiplying with 100 converting in Rs.) amount in the smallest currency unit
        currency: req.body.currency
      };
      const doCheckoutData = await rzp.doCheckoutRequest(options);

      /** Store Order Details & Set free trial to false  */
      if (req.body.masterdetailId) {
        // get masterDetailsData
        var masterDetailsData = await Masterdetail.findOne({
          where: {
            id: req.body.masterdetailId
          }
        });
        if (masterDetailsData) {
          // push subscriptionId in description data
          var descriptionData = JSON.parse(masterDetailsData.description);
          if (descriptionData && descriptionData.length > 0) {
            descriptionData.push({
              key: "orderDetails",
              value: doCheckoutData
            });
            // set isFreeTrial false
            descriptionData.find(item => {
              if (item.key === 'isFreeTrial') {
                item.value = false;
              }
            });
            if (req.body.planname) {
              // Set Plan Name
              descriptionData.find(item => {
                if (item.key === 'plan_name') {
                  item.value = req.body.planname;
                }
              });
            }
            if (req.body.planId) {
              // Update Plan Id
              descriptionData.find(item => {
                if (item.key === 'planId') {
                  item.value = req.body.planId;
                }
              });
            }

            // Update Description Details
            await Masterdetail.updateAll({
              id: req.body.masterdetailId
            }, {
              description: JSON.stringify(descriptionData)
            });

          }
        }
      }

      return doCheckoutData;

    } catch (error) {
      throw error;
    }

  };

  // Verify Signature Subscription
  Masterdetail.doVerifyPaymentDetails = async (req) => {
    try {
      var generateRazorpayIdHash = await rzp.convertToHasg(req.query.filter.where.razorpay_payment_id, req.query.filter.where.razorpay_subscription_id);
      if (generateRazorpayIdHash == req.query.filter.where.razorpay_signature) {
        return {
          isVerified: true
        };
      } else {
        return {
          isVerified: false
        };
      }
    } catch (error) {
      throw error;
    }
  };

  // Verify Signature One time payment
  Masterdetail.doVerifyOneTimePayment = async (req) => {
    try {
      var generateRazorpayIdHash = await rzp.doVerifySignature(req.query.filter.where.razorpay_payment_id, req.query.filter.where.razorpay_order_id);
      if (generateRazorpayIdHash == req.query.filter.where.razorpay_signature) {
        if (req.accessToken.masterdetailId) {
          // Update Dates of plan confguration
          await updatePlanDetails(req.accessToken.masterdetailId);

          var getUserDetail = await await app.models.user.findOne({
            where: {
              id: req.accessToken.userId
            }
          });

          // Get Plan Name
          var planDetails = await getDescriptionKeyData(req.accessToken.masterdetailId, 'plan_name');
          getUserDetail.planname = planDetails.value;

          var getPlanId = await getDescriptionKeyData(req.accessToken.masterdetailId, 'planId');
          getPlanId = getPlanId.value;


          var getAllPlans = await app.models.setting.findOne({
            where: {
              registerallow: constants.ALL_PLANS_LABLES
            }
          });

          var yearlyPlans, monthlyPlans = [];
          getAllPlans = JSON.parse(getAllPlans.text);
          yearlyPlans = getAllPlans.yearlyPlans;
          monthlyPlans = getAllPlans.monthlyPlans;

          const isMonthlyPlan = monthlyPlans.find(x => {
            if (x.planId === getPlanId) {
              return x;
            }
          });
          if (isMonthlyPlan) {
            getUserDetail.planname = isMonthlyPlan.planname;
            getUserDetail.amount = isMonthlyPlan.amount;
          } else {
            const isYearlyPlan = yearlyPlans.find(x => {
              if (x.planId === getPlanId) {
                return x;
              }
            });
            if (isYearlyPlan) {
              getUserDetail.planname = isYearlyPlan.planname;
              getUserDetail.amount = isYearlyPlan.amount;
            }
          }

          getUserDetail.paymentid = req.query.filter.where.razorpay_payment_id;
          getUserDetail.paymentdate = moment().format('YYYY-MM-DD');
          getUserDetail.paymentmode = 'Razorpay';
          getUserDetail.cellnumber = getUserDetail.cellnumber ? getUserDetail.cellnumber : '--';
          // Sent Greetings Email
          await app.models.notify.share("EMAIL/ONETIMEPAYMENT_SUCCESSFUL", getUserDetail, {
            masterdetailId: null
          });
          if (getUserDetail.cellnumber) {
            // payment successful SMS
            await app.models.notify.share("SMS/ONETIMEPAYMENT_SUCCESSFUL", getUserDetail, {
              masterdetailId: null
            });
          }
        }
        return {
          isVerified: true
        };
      } else {
        return {
          isVerified: false
        };
      }
    } catch (error) {
      throw error;
    }
  };


  /** Add New Tenant */
  Masterdetail.addNewMarchant = async (req) => {

    var userModel = app.models.user;
    var accessToken = app.models.AccessToken;
    var notifyModel = app.models.notify;
    var masterDetailsData;
    var userData;
    var temperoryToken;
    var whereObject;
    var masterdetailmetaModel = app.models.masterdetailmeta;
    var shorturlModel = app.models.shorturl;
    var commoncounterModel = app.models.commoncounter;
    var rolemappingModel = app.models.rolemapping;
    var usermetaauthModel = app.models.usermetaauth;
    var fullname;

    try {

      // checkUniqueCompanyName
      if (req.body.companyname) {
        whereObject = {
          companyname: req.body.companyname,
          roleId: constants.ADMIN_ROLEID
        }
        var checkUniqueCompanyName = await constants.userFind(whereObject);
        if (checkUniqueCompanyName.length > 0) {
          throw constants.createError(404, 'Company name already exist!');
        }
      }

      // checkUniqueEmail
      if (req.body.email) {
        whereObject = {
          email: req.body.email,
          roleId: constants.ADMIN_ROLEID
        }
        var checkUniqueEmail = await constants.userFind(whereObject);
        if (req.body.email && checkUniqueEmail.length > 0) {
          throw constants.createError(404, 'Email address already exist!');
        }
      }

      // checkUniqueEmail
      if (req.body.cellnumber) {
        whereObject = {
          cellnumber: req.body.cellnumber,
          roleId: constants.ADMIN_ROLEID
        }
        var checkUniqueCellnumber = await constants.userFind(whereObject);
        if (req.body.cellnumber && checkUniqueCellnumber.length > 0) {
          throw constants.createError(404, 'Cell number already exist!');
        }
      }

      var currentPlan = await getCurrentPlandDetails(req.body.planId);
      if (!currentPlan) {
        throw constants.createError(400, 'Please upgrade your plan')
      }

      if (!req.body.planname) {
        req.body.planname = currentPlan.item.name;
        req.body.planname = req.body.planname.split(" ")[0];
      }

      // Set Name Like Sukan Foods : sf
      if (req.body.companyname) {
        fullname = req.body.companyname;
        req.body.name = fullname.split(/\s/).reduce((response, word) => response += word.slice(0, 1), '');
        req.body.name = req.body.name.toLowerCase();
        req.body.webstoreURL = req.body.companyname.toLowerCase().split(" ").join("");
      }

      req.body.codename = Math.floor(100000 + Math.random() * 900000);
      var catalogue_plan_Object = [{
        key: "catalogue_name",
        value: req.body.cataloguename
      }, {
        key: "plan_name",
        value: req.body.planname
      }, {
        key: "planId",
        value: req.body.planId
      }, {
        key: "city",
        value: req.body.city && req.body.city.length > 0 ? req.body.city : null
      }, {
        key: "state",
        value: req.body.state && req.body.state.length > 0 ? req.body.state : null
      }, {
        key: "country",
        value: req.body.country && req.body.country.length > 0 ? req.body.country : null
      }, {
        key: "countrycode",
        value: req.body.countrycode && req.body.countrycode.length > 0 ? req.body.countrycode : null
      }, {
        key: "isFreeTrial",
        value: true
      }, {
        key: "webstoreURL",
        value: req.body.webstoreURL ? req.body.webstoreURL : null
      }, {
        key: "domainURL",
        value: req.body.domainURL ? req.body.domainURL : null
      }];

      // add in Masterdetail
      masterDetailsData = await Masterdetail.create({
        name: req.body.name,
        codename: req.body.codename,
        description: constants.stringifyJson(catalogue_plan_Object),
        status: true,
        fullname: req.body.companyname
      });
      console.log('Masterdetail Inserted');

      if (!req.body.username && req.body.firstname && req.body.lastname) {
        req.body.username = req.body.firstname.concat(' ' + req.body.lastname)
      }

      // add User
      userData = await userModel.create({
        masterdetailId: masterDetailsData.id,
        email: req.body.email,
        roleId: 1,
        userstatus: 'Active',
        firstname: req.body.firstname,
        lastname: req.body.lastname,
        username: req.body.username,
        cellnumber: req.body.cellnumber,
        password: req.body.password,
        gstin: req.body.gstin,
        address1: req.body.address1,
        address2: req.body.address2,
        // isregistered: true,
        companyname: req.body.companyname,
        profilepic: req.body.profilepic,
        admincreated: true,
        registervia: 'ADMIN'
      });
      if (userData) {
        console.log('Admin User Created');
      }

      // var redirectURL = 'https://managebizon.sufalam.live/auth/verifyemail/' + temperoryToken.id;
      // var getShortURL = await constants.shortUrl(redirectURL); // using reusable function to short URL
      // console.log(temperoryToken.id);

      // await shorturlModel.create({
      //     longurl: redirectURL,
      //     shortUrl: getShortURL,
      //     userId: userData.id,
      //     masterdetailId: userData.masterdetailId
      // });

      // userData.redirectURL = getShortURL;

      // await notifyModel.share("EMAIL/VERIFICATION", userData, {
      //     masterdetailId: null
      // });

      // await notifyModel.share("SMS/VERIFICATION", userData, {
      //     masterdetailId: null
      // });

      // add commoncounter
      await commoncounterModel.create({
        notifications: 0,
        createdby: userData.id,
        modifiedby: userData.id,
        cart: 0,
        userId: userData.id,
        masterdetailId: masterDetailsData.id
      });
      console.log('Commoncounter Inserted');

      var countrycodeDetails = await getDescriptionKeyData(masterDetailsData.id, 'countrycode');

      // Set rolemapping
      await rolemappingModel.create({
        principalType: 'USER',
        principalId: userData.id,
        roleId: 1,
        masterdetailId: masterDetailsData.id
      });
      console.log('Role Mapping Inserted');

      // Return Admin Data
      var resData = await userModel.findById(userData.id);

      // attach api token
      // resData.apitoken = temperoryToken.id;

      //generate otp
      var t = new Date();
      var otp = Math.floor(1000 + Math.random() * 9000); //get a random no 1000 - 9999
      t.setSeconds(t.getSeconds() + 310); // get a time 5 mins. more than current time
      var otpObject = [];
      var otpDataObject = {};
      console.log(otp);
      console.log(t);

      // UsermeataAuth
      await usermetaauthModel.create({
        userId: userData.id,
        pushnotification: 1,
        signupotp: otp,
        signupotpvalidtill: t,
        countrycode: countrycodeDetails.value,
        masterdetailId: masterDetailsData.id
      });
      console.log('UsermeataAuth Inserted');

      otpDataObject["signupotpvalidtill"] = t;
      otpDataObject["signupotp"] = otp;
      otpDataObject["companyname"] = userData.companyname;
      otpObject.push(otpDataObject);
      otpObject.push(userData.id);

      // Send Email Of Instance (Tenant) Verification Code
      await notifyModel.share("OTP/INSTANCE", otpObject, {
        masterdetailId: null
      });

      // Get Catalogue Name
      var getCatlogueName = await getDescriptionKeyData(masterDetailsData.id, 'catalogue_name');
      userData.catelague = getCatlogueName.value;

      var getPlanId = await getDescriptionKeyData(masterDetailsData.id, 'planId');
      getPlanId = getPlanId.value;

      var getAllPlans = await app.models.setting.findOne({
        where: {
          registerallow: constants.ALL_PLANS_LABLES
        }
      });

      var yearlyPlans, monthlyPlans = [];
      getAllPlans = JSON.parse(getAllPlans.text);
      yearlyPlans = getAllPlans.yearlyPlans;
      monthlyPlans = getAllPlans.monthlyPlans;

      const isMonthlyPlan = monthlyPlans.find(x => {
        if (x.planId === getPlanId) {
          return x;
        }
      });
      if (isMonthlyPlan) {
        userData.planname = isMonthlyPlan.planname;
      } else {
        const isYearlyPlan = yearlyPlans.find(x => {
          if (x.planId === getPlanId) {
            return x;
          }
        });
        if (isYearlyPlan) {
          userData.planname = isYearlyPlan.planname;
        }
      }

      // EMAIL/MERCHANT_CREATED
      await notifyModel.share("EMAIL/MERCHANT_CREATED", userData, {
        masterdetailId: null
      });

      return resData;

    } catch (error) {
      throw error;
    }

  };

  Masterdetail.verifyMarchant = async (req) => {

    var userModel = app.models.user;
    var cityModel = app.models.city;
    var stateModel = app.models.state;
    var groupModel = app.models.group;
    var notifyModel = app.models.notify;
    var sourceModel = app.models.source;
    var settingModel = app.models.setting;
    var languageModel = app.models.language;
    var orderstatusModel = app.models.orderstatus;
    var accesstokenModel = app.models.AccessToken;
    var rolemappingModel = app.models.rolemapping;
    var usermetaauthModel = app.models.usermetaauth;
    var commoncounterModel = app.models.commoncounter;
    var invoicestatusModel = app.models.invoicestatus;
    var masterdetailmetaModel = app.models.masterdetailmeta;
    var notificationtypeModel = app.models.notificationtype;

    var fullname;
    var userData;
    var groupData;
    var stateData;
    var countryData;
    var whereObject;
    var temperoryToken;
    var masterDetailsData;
    var getTenantCityData;

    var getPaymentDetailsJSONFromConst = settingConstants.PAYMENT_DETAILS_JSON;
    var getCacheForDisableStateSetting = cache.get(settingConstants.SET_STATE_NOT_VISIBLE);
    var getAddressConfigurationJSONFromConst = settingConstants.ADDRESS_CONFIGURATION_JSON;
    var getCacheForEnableSadadPayment = cache.get(settingConstants.ENABLE_SADAD_PAYMENT_WHEN_CREATE_INSTANCE);

    try {

      if (req && req.body && req.body.isAddMerchantDetails) {

        // checkUniqueCompanyName
        if (req.body.companyname) {
          whereObject = {
            companyname: req.body.companyname,
            roleId: constants.ADMIN_ROLEID
          }
          var checkUniqueCompanyName = await constants.userFind(whereObject);
          if (checkUniqueCompanyName.length > 0) {
            throw constants.createError(404, 'Company name already exist!');
          }
        }

        // checkUniqueEmail
        if (req.body.email) {
          whereObject = {
            email: req.body.email,
            roleId: constants.ADMIN_ROLEID
          }
          var checkUniqueEmail = await constants.userFind(whereObject);
          if (req.body.email && checkUniqueEmail.length > 0) {
            throw constants.createError(404, 'Email address already exist!');
          }
        }

        // checkUniqueEmail
        if (req.body.cellnumber) {
          whereObject = {
            cellnumber: req.body.cellnumber,
            roleId: constants.ADMIN_ROLEID
          }
          var checkUniqueCellnumber = await constants.userFind(whereObject);
          if (req.body.cellnumber && checkUniqueCellnumber.length > 0) {
            throw constants.createError(404, 'Cell number already exist!');
          }
        }

        var currentPlan = await getCurrentPlandDetails(req.body.planId);
        if (!currentPlan) {
          throw constants.createError(400, 'Please upgrade your plan')
        }

        if (!req.body.planname) {
          req.body.planname = currentPlan.item.name;
          req.body.planname = req.body.planname.split(" ")[0];
        }

        // Set Name Like Sukan Foods : sf
        if (req.body.companyname) {
          fullname = req.body.companyname;
          req.body.name = fullname.split(/\s/).reduce((response, word) => response += word.slice(0, 1), '');
          req.body.name = req.body.name.toLowerCase();
          req.body.webstoreURL = req.body.companyname.toLowerCase().split(" ").join("");
        }

        req.body.codename = Math.floor(100000 + Math.random() * 900000);
        var catalogue_plan_Object = [{
          key: "catalogue_name", value: req.body.cataloguename
        }, {
          key: "plan_name", value: req.body.planname
        }, {
          key: "planId", value: req.body.planId
        }, {
          key: "city", value: req.body.city && req.body.city.length > 0 ? req.body.city : null
        }, {
          key: "state", value: req.body.state && req.body.state.length > 0 ? req.body.state : null
        }, {
          key: "country", value: req.body.country && req.body.country.length > 0 ? req.body.country : null
        }, {
          key: "countrycode", value: req.body.countrycode && req.body.countrycode.length > 0 ? req.body.countrycode : null
        }, {
          key: "isFreeTrial", value: true
        }, {
          key: "webstoreURL", value: req.body.webstoreURL ? req.body.webstoreURL : null
        }, {
          key: "domainURL", value: req.body.domainURL ? req.body.domainURL : null
        }];

        // add in Masterdetail
        masterDetailsData = await Masterdetail.create({
          name: req.body.name,
          codename: req.body.codename,
          description: constants.stringifyJson(catalogue_plan_Object),
          status: true,
          fullname: req.body.companyname
        });
        console.log('Masterdetail Inserted');

        if (!req.body.username && req.body.firstname && req.body.lastname) {
          req.body.username = req.body.firstname.concat(' ' + req.body.lastname)
        }

        // add User
        userData = await userModel.create({
          masterdetailId: masterDetailsData.id,
          email: req.body.email,
          roleId: 1,
          userstatus: 'Active',
          firstname: req.body.firstname,
          lastname: req.body.lastname,
          username: req.body.username,
          cellnumber: req.body.cellnumber,
          password: req.body.password,
          gstin: req.body.gstin,
          address1: req.body.address1,
          address2: req.body.address2,
          // isregistered: true,
          companyname: req.body.companyname,
          profilepic: req.body.profilepic,
          admincreated: true,
          registervia: 'ADMIN'
        });

        // add commoncounter
        await commoncounterModel.create({
          notifications: 0,
          createdby: userData.id,
          modifiedby: userData.id,
          cart: 0,
          userId: userData.id,
          masterdetailId: masterDetailsData.id
        });
        console.log('Commoncounter Inserted');

        var countrycodeDetails = await getDescriptionKeyData(masterDetailsData.id, 'countrycode');

        // Set rolemapping
        await rolemappingModel.create({
          principalType: 'USER',
          principalId: userData.id,
          roleId: 1,
          masterdetailId: masterDetailsData.id
        });
        console.log('Role Mapping Inserted');

        // create accessToken lifetime
        temperoryToken = await accesstokenModel.create({
          ttl: -1,
          userId: userData.id,
          masterdetailId: userData.masterdetailId
        });

        // attach api token
        req.body.accessToekn = temperoryToken.id;

        //generate otp
        var t = new Date();
        var otp = Math.floor(1000 + Math.random() * 9000); //get a random no 1000 - 9999
        t.setSeconds(t.getSeconds() + 310); // get a time 5 mins. more than current time

        // UsermeataAuth
        await usermetaauthModel.create({
          userId: userData.id,
          pushnotification: 1,
          signupotp: otp,
          signupotpvalidtill: t,
          countrycode: countrycodeDetails.value,
          masterdetailId: masterDetailsData.id
        });
        console.log('UsermeataAuth Inserted');
      }


      // get userId
      var accessToeknData = await accesstokenModel.findOne({
        where: {
          id: req.body.accessToekn
        }
      });

      if (accessToeknData) {

        var t = new Date();
        var current_seconds = t.getTime() / 1000;

        if (current_seconds >= accessToeknData.ttl && !req.body.isAddMerchantDetails) {
          throw constants.createError(404, 'Your verification link is expired!, Please register again');
        } else {
          await userModel.updateAll({
            id: accessToeknData.userId
          }, {
            emailVerified: 1
          });
        }

      }

      // Get Requested Admin User Data
      userData = await userModel.findOne({
        where: {
          id: accessToeknData.userId
        }
      });

      // get masterDetailsData
      var masterDetailsData = await Masterdetail.findOne({
        where: {
          id: userData.masterdetailId
        }
      });

      // Create Folders As Per Tenant name
      if (masterDetailsData) {
        if (cache.get(settingConstants.IS_CREATE_FOLDER_IN_S3_BUCKET)) {
          var dirArray = ['productmedia', 'profilepic', 'requestproduct', 'ordermedia'];
          for (let i = 0; i < dirArray.length; i++) {
            const element = dirArray[i];
            await s3Constants.createFolder(element, masterDetailsData.codename);
          }
        } else {
          var dirArray = ['server/containers/productmedia-', 'server/containers/profilepic-', 'server/containers/requestproduct-', 'server/containers/ordermedia-'];
          for (let i = 0; i < dirArray.length; i++) {
            const element = dirArray[i];
            if (!fs.existsSync(element + masterDetailsData.codename)) {
              fs.mkdirSync(element + masterDetailsData.codename);
            }
          }
        }
      }

      var countryDetails = await getDescriptionKeyData(masterDetailsData.id, 'country');
      // add Country
      countryData = await stateModel.create({
        name: countryDetails.value,
        masterdetailId: masterDetailsData.id
      });
      console.log('Country Inserted');

      // add state
      var stateDetails = await getDescriptionKeyData(masterDetailsData.id, 'state');
      if (stateDetails && stateDetails.value) {
        stateData = await stateModel.create({
          name: stateDetails.value,
          masterdetailId: masterDetailsData.id,
          parentId: countryData.id
        });
        console.log('State Inserted');
      }

      // add city
      var cityDetails = await getDescriptionKeyData(masterDetailsData.id, 'city');
      if (cityDetails && cityDetails.value) {
        getTenantCityData = await cityModel.create({
          name: cityDetails.value,
          createdby: userData.id,
          modifiedby: userData.id,
          status: 1,
          stateId: stateData.id,
          masterdetailId: masterDetailsData.id
        });
        console.log('City Inserted');
      }


      // When state setting is disabled do not add state
      if (getCacheForDisableStateSetting) {
        // Check country inserted
        var getCountry = await stateModel.findOne({
          where: {
            parentId: null,
            masterdetailId: masterDetailsData.id
          }
        });
        if (!getCountry) {
          getCountry = await app.models.state.create({
            name: settingConstants.QATAR_ARABIC,
            parentId: null,
            masterdetailId: masterDetailsData.id
          });
          console.log(settingConstants.QATAR_ARABIC + ' Country Inserted');
        }

        // Check is state is inserted or not
        var getState;
        getState = await stateModel.findOne({
          where: {
            parentId: getCountry.id,
            masterdetailId: masterDetailsData.id
          }
        });
        if (!getState) {
          getState = await app.models.state.create({
            name: getCountry.name,
            parentId: getCountry.id,
            masterdetailId: masterDetailsData.id
          });
          console.log(getCountry.name + ' State Inserted');
        }

        // Add Cities
        var cityArray = settingConstants.QATAR_CITY_LIST;
        for (let i = 0; i < cityArray.length; i++) {
          const item = cityArray[i];
          await cityModel.create({
            name: item,
            stateId: getState.id,
            status: 1,
            masterdetailId: masterDetailsData.id
          });
          console.log(item + ' City Inserted');
        }

      } else {
        // Add Country, States & Cities From Setting
        var getLocationJSON = await app.models.setting.findOne({
          where: {
            registerallow: constants.SETTING_LOCATION_DETAILS
          }
        });

        if (getLocationJSON) {
          getLocationJSON = JSON.parse(getLocationJSON.text);

          if (getLocationJSON.Countries.length > 0) {
            for (let i = 0; i < getLocationJSON.Countries.length; i++) {
              const element = getLocationJSON.Countries[i];
              const getCountry = await stateModel.findOne({
                where: {
                  name: {
                    eq: element.country
                  },
                  masterdetailId: masterDetailsData.id
                }
              });
              if (!getCountry) {
                await app.models.state.create({
                  name: element.country,
                  parentId: null,
                  masterdetailId: masterDetailsData.id
                });
                console.log(element.country + ' Country Inserted');
              }
            }
          }

          if (getLocationJSON.States.length > 0) {
            // States
            for (let i = 0; i < getLocationJSON.States.length; i++) {
              const element = getLocationJSON.States[i];
              const getCountry = await stateModel.findOne({
                where: {
                  name: {
                    eq: element.country
                  },
                  masterdetailId: masterDetailsData.id
                }
              });

              if (!getCountry) {
                constants.createError(404, element.country + ' Country not found.');
              }

              if (getCountry) {
                const getState = await stateModel.findOne({
                  where: {
                    name: {
                      eq: element.state
                    },
                    parentId: getCountry.id,
                    masterdetailId: masterDetailsData.id
                  }
                });
                if (!getState) {
                  await stateModel.create({
                    name: element.state,
                    parentId: getCountry.id,
                    masterdetailId: masterDetailsData.id
                  });
                  console.log(element.country + ' - ' + element.state + ' State Inserted');
                }
              }
            }
          }

          if (getLocationJSON.Cities.length > 0) {
            // Cities
            for (let i = 0; i < getLocationJSON.Cities.length; i++) {
              const element = getLocationJSON.Cities[i];
              const getState = await stateModel.findOne({
                where: {
                  name: {
                    eq: element.state
                  },
                  masterdetailId: masterDetailsData.id
                }
              });

              if (!getState) {
                constants.createError(404, element.state + ' State not found.');
              }

              if (getState) {
                const getCity = await cityModel.findOne({
                  where: {
                    name: {
                      eq: element.state
                    },
                    stateId: getState.id,
                    masterdetailId: masterDetailsData.id
                  }
                });
                if (!getCity) {
                  await cityModel.create({
                    name: element.city,
                    stateId: getState.id,
                    status: true,
                    masterdetailId: masterDetailsData.id
                  });
                  console.log(element.state + ' - ' + element.city + ' City Inserted');
                }
              }
            }
          }

        }
      }

      // add default group
      groupData = await groupModel.create({
        name: 'Default',
        isprice: 1,
        noofusers: 0,
        status: 1,
        masterdetailId: masterDetailsData.id,
        createdby: userData.id,
        modifiedby: userData.id
      });
      console.log('Group Inserted');

      // add language
      var getLanguage = await languageModel.find({
        where: {
          masterdetailId: constants.defaultTenantId
        }
      });
      for (let i = 0; i < getLanguage.length; i++) {
        const element = getLanguage[i];
        await languageModel.create({
          key: element.key,
          value: element.value,
          createdby: userData.id,
          modifiedby: userData.id,
          masterdetailId: masterDetailsData.id
        });
      }
      console.log('Language Inserted');

      // add Invoice Status
      var getInvoicestatus = await invoicestatusModel.find({
        where: {
          masterdetailId: constants.defaultTenantId
        }
      });
      for (let i = 0; i < getInvoicestatus.length; i++) {
        const element = getInvoicestatus[i];
        await invoicestatusModel.create({
          name: element.name,
          status: 1,
          createdby: userData.id,
          modifiedby: userData.id,
          masterdetailId: masterDetailsData.id
        });
      }
      console.log('Invoice Status Inserted');

      // add notification type
      var getNotificationType = await notificationtypeModel.find({
        where: {
          masterdetailId: constants.defaultTenantId
        }
      });
      for (let i = 0; i < getNotificationType.length; i++) {
        const element = getNotificationType[i];
        await notificationtypeModel.create({
          textmessage: element.textmessage,
          textmessage_html: element.textmessage_html,
          code: element.code,
          notification: element.__data.notification,
          createdby: userData.id,
          modifiedby: userData.id,
          masterdetailId: masterDetailsData.id,
          templateId: element.templateId
        });
      }
      console.log('Notificationtype Inserted');

      // add Order Status
      var getOrderStatus = await orderstatusModel.find({
        where: {
          masterdetailId: constants.defaultTenantId
        }
      });
      for (let i = 0; i < getOrderStatus.length; i++) {
        const element = getOrderStatus[i];
        await orderstatusModel.create({
          status: element.status,
          createdby: userData.id,
          modifiedby: userData.id,
          masterdetailId: masterDetailsData.id
        });
      }
      console.log('Orderstatus Inserted');

      // add Source
      var getSource = await sourceModel.find({
        where: {
          masterdetailId: constants.defaultTenantId
        }
      });
      for (let i = 0; i < getSource.length; i++) {
        const element = getSource[i];
        await sourceModel.create({
          name: element.name,
          createdby: userData.id,
          modifiedby: userData.id,
          masterdetailId: masterDetailsData.id
        });
      }
      console.log('Source Inserted');

      // add Settings
      var getSettings = await settingModel.find({
        where: {
          masterdetailId: constants.defaultTenantId
        }
      });
      for (let i = 0; i < getSettings.length; i++) {
        const element = getSettings[i];
        await settingModel.create({
          registerallow: element.registerallow,
          status: element.status,
          createdby: userData.id,
          modifiedby: userData.id,
          text: element.text,
          masterdetailId: masterDetailsData.id
        });
        console.log(i + '  ----  ' + element.registerallow);
      }
      console.log('Settings Inserted');

      await userModel.updateAll({
        id: userData.id
      }, {
        cityId: getTenantCityData ? getTenantCityData.id : null,
        groupId: groupData.id,
        createdby: userData.id,
        modifiedby: userData.id
      });
      console.log('User Updated');

      // Update Merchant Information Into Setting.
      var merchantObject = {
        firstname: userData.firstname ? userData.firstname : null,
        lastname: userData.lastname ? userData.lastname : null,
        email: userData.email ? userData.email : null,
        username: userData.username ? userData.username : null,
        cellnumber: userData.cellnumber ? userData.cellnumber : null,
        companyname: userData.companyname ? userData.companyname : null,
        address1: userData.address1 ? userData.address1 : null,
        gstin: userData.gstin ? userData.gstin : '',
        profilepic: userData.profilepic ? userData.profilepic : 'defaultuser.jpeg',
        countryId: countryData ? countryData.id : null,
        stateId: stateData ? stateData.id : null,
        cityId: getTenantCityData ? getTenantCityData.id : null,
        website: userData.website ? userData.website : null,
        enablegst: userData.enablegst ? userData.enablegst : 0,
        SGST: userData.SGST ? userData.SGST : 0,
        CGST: userData.CGST ? userData.CGST : 0,
        IGST: userData.IGST ? userData.IGST : 0,
        bankdetails: {
          accountnumber: userData.bankdetails ? userData.bankdetails.accountnumber : null,
          accountholdername: userData.bankdetails ? userData.bankdetails.accountholdername : null,
          isShow: userData.bankdetails ? userData.bankdetails.isShow : false
        },
        // countryname: countryData.name,
        countryname: countryData ? countryData.name : null,
        statename: stateData ? stateData.name : null,
        cityname: getTenantCityData ? getTenantCityData.name : null,
        CountGstPerProduct: userData.CountGstPerProduct ? (userData.SGST + userData.CGST) : 0
      }

      // Update Merchnat Inforemation
      await settingModel.updateAll({
        registerallow: constants.MERCHANTINFORMATION_LABLE,
        masterdetailId: masterDetailsData.id
      }, {
        text: constants.stringifyJson(merchantObject)
      });

      // Update Offer Banner
      await settingModel.updateAll({
        registerallow: constants.OFFER_BANNER_LABLE,
        masterdetailId: masterDetailsData.id
      }, {
        text: '[]'
      });

      // Update Product Variation
      await settingModel.updateAll({
        registerallow: settingConstants.PRODUCT_VARIATION,
        masterdetailId: masterDetailsData.id
      }, {
        text: '[]'
      });

      // Update Product Unit
      await settingModel.updateAll({
        registerallow: constants.PRODUCT_UNIT_LABEL,
        masterdetailId: masterDetailsData.id
      }, {
        text: '[]'
      });

      if (!userData.companyname) {
        userData.companyname = 'Sufalam Technologies';
      }

      var privacyText = await settingConstants.getPrivacyPolictText(userData.companyname);

      // Update privacy policy
      await settingModel.updateAll({
        registerallow: settingConstants.PRIVACYPOLICY,
        masterdetailId: masterDetailsData.id
      }, {
        text: privacyText
      });

      // Update App Name
      await settingModel.updateAll({
        registerallow: constants.APP_NAME_LABLE,
        masterdetailId: masterDetailsData.id
      }, {
        text: userData.companyname ? userData.companyname : null
      });

      // Update Menu Categories Data
      await settingModel.updateAll({
        registerallow: settingConstants.MENU_CATEGORIES,
        masterdetailId: masterDetailsData.id
      }, {
        text: null
      });

      // Update currency
      if (countryData.name === 'India' || countryData.name === 'india') {
        await settingModel.updateAll({
          registerallow: constants.CURRENCY_LABLE,
          masterdetailId: masterDetailsData.id
        }, {
          text: '₹'
        });
      }

      if (getCacheForEnableSadadPayment) {
        await settingModel.updateAll({
          registerallow: constants.CURRENCY_LABLE,
          masterdetailId: masterDetailsData.id
        }, {
          text: 'QAR'
        });
      }

      if (!getCacheForEnableSadadPayment && (countryData.name !== 'India' || countryData.name !== 'india')) {
        await settingModel.updateAll({
          registerallow: constants.CURRENCY_LABLE,
          masterdetailId: masterDetailsData.id
        }, {
          text: '$'
        });
      }

      // Update Inquiry Industry / Action : Parth dt_14-04-2021
      await settingModel.updateAll({
        registerallow: constants.INQUIRY_ACTION_KEY,
        masterdetailId: masterDetailsData.id
      }, {
        text: JSON.stringify([{
          "next_action": [],
          "industry": []
        }])
      });

      // Update Order Vai Whatsapp Cell Number
      var ordercell = {
        cellnumber: userData.cellnumber ? userData.cellnumber : null
      }
      await settingModel.updateAll({
        registerallow: constants.ORDER_VIA_WHATSAPP_LABLE,
        masterdetailId: masterDetailsData.id
      }, {
        text: constants.stringifyJson(ordercell)
      });

      var catalogueDetails = await getDescriptionKeyData(masterDetailsData.id, 'catalogue_name');

      req.body.cataloguename = catalogueDetails.value;
      // According Catalogue Set Status
      var setCatalogueType;
      if (req.body.cataloguename === 'Fmcg') {
        setCatalogueType = constants.CATALOGUE_FMCG_LABLE;
      }
      if (req.body.cataloguename === 'Jewellery') {
        setCatalogueType = constants.CATALOGUEJEWELLARY_LABLE;
      }
      if (req.body.cataloguename === 'Fabric') {
        setCatalogueType = constants.CATALOGUE_FABRIC_LABLE;
      }

      // Update Status when any of type specified
      if (req.body.cataloguename === 'Fabric' || req.body.cataloguename === 'Fmcg' || req.body.cataloguename === 'Jewellery') {
        await settingModel.updateAll({
          registerallow: setCatalogueType,
          masterdetailId: masterDetailsData.id
        }, {
          status: 1
        });
      }
      console.log('Catalogue Updated');

      // Get Package Details & Cretae Murchant Package Setting key
      var planDetails = await getDescriptionKeyData(masterDetailsData.id, 'plan_name');
      req.body.planname = planDetails.value;

      var getPlanData = await settingModel.findOne({
        where: {
          registerallow: constants.PACKAGE_DETAILS_LABEL
        }
      });
      getPlanData = constants.parseJson(getPlanData.text);
      for (let i = 0; i < getPlanData.length; i++) {
        const element = getPlanData[i];
        if (element.type.value === req.body.planname) {
          await settingModel.updateAll({
            registerallow: constants.CURRENT_MERCHANT_PLAN_LABEL,
            status: 1,
            masterdetailId: masterDetailsData.id
          }, {
            text: constants.stringifyJson(element)
          });
        }
      }
      console.log('CUREENT MERCHANT PLAN Updated');


      if (getSettings && getSettings.length > 0) {
        // Update Payment Gateway
        if (getCacheForEnableSadadPayment) {
          // When need to enable only sadad payment gateway
          getPaymentDetailsJSONFromConst.filter(async item => item.name === 'Sadad' ? item.status = 1 : item.status = 0);
        } else {
          // When new instance created and sadad payment gateway neep disabled
          getPaymentDetailsJSONFromConst.filter(async item => item.name === 'COD' ? item.status = 1 : item.status = 0);
        }

        await settingModel.updateAll({
          registerallow: settingConstants.PAYMENT_DETAILS,
          masterdetailId: masterDetailsData.id
        }, {
          text: JSON.stringify(getPaymentDetailsJSONFromConst)
        });

        // Update Address Configuration
        // When need to disable state option
        if (getCacheForDisableStateSetting) {
          getAddressConfigurationJSONFromConst.filter(async item => {
            if (item.field_name === 'state' || item.field_name === 'gstin') {
              item.visible = 0;
              item.mandatory = 0;
            }
            if (
              item.field_name === 'zone_number' || item.field_name === 'street_number' ||
              item.field_name === 'building_number' || item.field_name === 'unit_number'
            ) {
              item.visible = 1;
              item.mandatory = 1;
            }
          });
        } else {
          getAddressConfigurationJSONFromConst.filter(async item => {
            if (item.field_name === 'state' || item.field_name === 'gstin') {
              item.visible = 1;
              item.mandatory = 1;
            }
            if (
              item.field_name === 'zone_number' || item.field_name === 'street_number' ||
              item.field_name === 'building_number' || item.field_name === 'unit_number'
            ) {
              item.visible = 0;
              item.mandatory = 0;
            }
          });
        }

        await settingModel.updateAll({
          registerallow: settingConstants.ADDRESS_CONFIGURATION,
          masterdetailId: masterDetailsData.id
        }, {
          text: JSON.stringify(getAddressConfigurationJSONFromConst)
        });

      }

      await settingModel.updateAll({
        registerallow: constants.INQUIRY_ACTION_KEY,
        masterdetailId: masterDetailsData.id
      }, {
        text: null
      });

      // Enable Open store
      await settingModel.updateAll({
        registerallow: settingConstants.OPEN_STORE,
        masterdetailId: masterDetailsData.id
      }, {
        status: 1
      });

      // Get Android Setting
      var androidVersionObject = JSON.parse(getSettings[9].registerallow);
      if (androidVersionObject) {
        // Update android version to 1.0.0
        await settingModel.updateAll({
          id: getSettings[9].id
        }, {
          registerallow: JSON.stringify({
            min_android_version: "1.0.0", current_android_version: "1.0.0"
          })
        });
      }

      // Get iOS Setting
      var iosVersionObject = JSON.parse(getSettings[10].registerallow);
      if (iosVersionObject) {
        // Update iOS version to 1.0.0
        await settingModel.updateAll({
          id: getSettings[10].id
        }, {
          registerallow: JSON.stringify({
            min_ios_version: "1.0.0", current_ios_version: "1.0.0"
          })
        });
      }

      console.log('Settings Updated');

      if (userData.profilepic) {
        req.body.profilepic = userData.profilepic;
      }

      req.body.codename = masterDetailsData.codename;

      // Move Image to particular instance folder
      if (cache.get(settingConstants.IS_CREATE_FOLDER_IN_S3_BUCKET)) {
        await s3Constants.copyDefaultImage(app.get('isProduction'), req.body.codename, 'default_category.png', 'productmedia');
        await s3Constants.copyDefaultImage(app.get('isProduction'), req.body.codename, 'noimagefound.png', 'productmedia');
        await s3Constants.copyDefaultImage(app.get('isProduction'), req.body.codename, 'defaultuser.jpeg', 'profilepic');
        await s3Constants.copyDefaultImage(app.get('isProduction'), req.body.codename, 'noimagefound.png', 'requestproduct');
      } else {
        var imageArray = [];
        if (req.body.profilepic) {
          imageArray = ['default_category.png', 'noimagefound.png', 'defaultuser.jpeg', 'noimagefound.png', req.body.profilepic];
        } else {
          imageArray = ['default_category.png', 'noimagefound.png', 'defaultuser.jpeg', 'noimagefound.png'];
        }

        for (let i = 0; i < imageArray.length; i++) {
          const element = imageArray[i];

          const pathToFile = path.join('server/containers/tempmedia', element);
          var pathToNewDestination;

          if (i === 0 || i === 1) {
            pathToNewDestination = path.join('server/containers/productmedia-' + req.body.codename, element);
          }
          if (i === 2 || i === 4) {
            pathToNewDestination = path.join('server/containers/profilepic-' + req.body.codename, element);
          }
          if (i === 3) {
            pathToNewDestination = path.join('server/containers/requestproduct-' + req.body.codename, element)
          }

          fs.copyFile(pathToFile, pathToNewDestination, function (err) {
            if (err) {
              throw err;
            } else {
              console.log("Successfully copied and moved the file!");
            }
          });

        }
      }

      var mastermetaconfigJson = {
        "planDetails": [{
          "purchaseStartDate": moment().format('YYYY-MM-DD'),
          "purchaseStartTime": moment().format('hh-mm-ss'),
          "purchaseExpireDate": moment().add(3, 'M').format('YYYY-MM-DD'),
          "purchaseExpireTime": moment().format('hh-mm-ss'),
          "isPlanUpdated": false,
          'isShowDashboardWelcomeModal': true,
          "updatedExpireDate": null,
          "updatedExpireTime": null,
        }]
      };

      // While creating new instance add entry into masterdetailmeta for sms credits
      await masterdetailmetaModel.create({
        smscredits: 0,
        status: 1,
        createdby: userData.id,
        modifiedby: userData.id,
        masterdetailId: masterDetailsData.id,
        configuration: constants.stringifyJson(mastermetaconfigJson)
      });
      console.log('Masterdetailmeta Inserted Successfully');

      console.log('API Run Successfully');

      console.log('Code ', masterDetailsData.codename);

      userData.code = masterDetailsData.codename;
      userData.adminpanel = app.get('serverConfig').adminpanel_url;
      var getURLDetails = await getDescriptionKeyData(masterDetailsData.id, 'webstoreURL');
      if (getURLDetails && getURLDetails.value) {
        userData.webstore = app.get('serverConfig').webstore_url + getURLDetails.value;
      } else {
        userData.webstore = '--';
      }

      userData.startdate = mastermetaconfigJson.planDetails[0].purchaseStartDate;
      userData.expiredate = mastermetaconfigJson.planDetails[0].purchaseExpireDate;

      // Based on planId get Plan Details

      var getPlanId = await getDescriptionKeyData(masterDetailsData.id, 'planId');
      getPlanId = getPlanId.value;

      var getAllPlans = await app.models.setting.findOne({
        where: {
          registerallow: constants.ALL_PLANS_LABLES
        }
      });

      var yearlyPlans, monthlyPlans = [];
      getAllPlans = JSON.parse(getAllPlans.text);
      yearlyPlans = getAllPlans.yearlyPlans;
      monthlyPlans = getAllPlans.monthlyPlans;

      const isMonthlyPlan = monthlyPlans.find(x => {
        if (x.planId === getPlanId) {
          return x;
        }
      });
      if (isMonthlyPlan) {
        userData.plan = isMonthlyPlan.planname;
        userData.price = isMonthlyPlan.currency + isMonthlyPlan.amount;
      } else {
        const isYearlyPlan = yearlyPlans.find(x => {
          if (x.planId === getPlanId) {
            return x;
          }
        });
        if (isYearlyPlan) {
          userData.plan = isYearlyPlan.planname;
          userData.price = isYearlyPlan.currency + isYearlyPlan.amount;
        }
      }

      // Send Code Via Email || Cellnumber
      if (userData.email) {
        await notifyModel.share("CODE/INSTANCE", userData, {
          masterdetailId: null
        });
      }
      if (userData.cellnumber) {
        await notifyModel.share("CODE/INSTANCE_SMS", userData, {
          masterdetailId: null
        });
      }

      // Return Admin Data
      var resData = await userModel.findById(userData.id);

      if (!req.body.isAddMerchantDetails) {
        // create accessToken lifetime
        temperoryToken = await accesstokenModel.create({
          ttl: -1,
          userId: resData.id,
          masterdetailId: resData.masterdetailId
        });
      }

      // console.log('Accesstoken Details --- > ', temperoryToken.id);

      resData.apitoken = temperoryToken.id;
      resData.codename = masterDetailsData.codename;

      return resData;

    } catch (error) {
      throw error;
    }

  };

  Masterdetail.sendPlanExpireEmail = async (req) => {

    var notifyModel = app.models.notify;
    var userModel = app.models.user;
    var userData;
    var redirectURL;
    var getShortURL;

    try {

      userData = await userModel.findOne({
        where: {
          id: req.query.filter.where.userId
        }
      });

      if (!userData) {
        constants.createError(404, 'Admin details not found');
      }

      redirectURL = 'https://managebizon.sufalam.live/';
      getShortURL = await constants.shortUrl(redirectURL);
      userData.redirectURL = getShortURL;
      userData.noofdays = req.query.filter.where.noofdays;
      if (!userData.companyname) {
        userData.companyname = userData.username;
      }
      // Send Email
      await notifyModel.share("EMAIL/EXPIRE_PLAN", userData, {
        masterdetailId: null
      });

    } catch (error) {
      throw error;
    }

  };

  // Resend OTP
  Masterdetail.resendOtp = async function (req) {

    var otpObject = [];
    var otpDataObject = {};
    var userModel = app.models.user;
    var usermetaauthModel = app.models.usermetaauth;
    var notifyModel = app.models.notify;

    try {
      //generate otp
      var t = new Date();
      var otp = Math.floor(1000 + Math.random() * 9000); //get a random no 1000 - 9999
      t.setSeconds(t.getSeconds() + 310); // get a time 5 mins. more than current time

      var userData = await userModel.findById(req.query.filter.where.userId);

      if (userData) {
        // UsermeataAuth
        await usermetaauthModel.updateAll({
          userId: userData.id
        }, {
          signupotp: otp,
          signupotpvalidtill: t
        });

        otpDataObject["signupotpvalidtill"] = t;
        otpDataObject["signupotp"] = otp;
        otpDataObject["companyname"] = userData.companyname;
        otpObject.push(otpDataObject);
        otpObject.push(userData.id);

        // Share OTP
        notifyModel.share("OTP/INSTANCE", otpObject, {
          masterdetailId: null
        });

      } else {
        constants.createError(404, 'Sorry! User not found.');
      }

      return userData;

    } catch (error) {
      throw error;
    }
  };

  Masterdetail.verifyOtp = async function (req) {
    var userModel = app.models.user;
    var usermetaauthModel = app.models.usermetaauth;
    var accesstokenModel = app.models.AccessToken;
    var temperoryToken;

    try {

      // Return Admin Data
      var resData = await userModel.findById(req.body.userId);

      // check for OTP with userId within valid timeframe
      var usermetaauth = await usermetaauthModel.findOne({
        where: {
          signupotp: req.body.signupotp,
          userId: resData.userId,
          signupotpvalidtill: {
            gt: new Date()
          },
          masterdetailId: resData.masterdetailId
        }
      })

      if (!usermetaauth) { // otp is not found with the userId
        await constants.createError(400, 'Please enter a valid OTP');
      }

      var t = new Date();
      t.setSeconds(t.getSeconds() + 10800);
      var seconds = t.getTime() / 1000;

      // create accessToken which valid for 3h
      temperoryToken = await accesstokenModel.create({
        ttl: seconds,
        userId: req.body.userId,
        masterdetailId: resData.masterdetailId
      });

      await userModel.updateAll({
        id: req.body.userId,
        masterdetailId: resData.masterdetailId
      }, {
        isregistered: true
      });

      // attach api token
      resData.apitoken = temperoryToken.id;

      return resData;

    } catch (error) {
      throw error;
    }
  };

  Masterdetail.getMasterDetailsFromURL = async function (req) {
    var resData;

    try {

      if (req.query && req.query.filter && req.query.filter.where &&
        req.query.filter.where.getDetailsFromURL && req.query.filter.where.getDetailsFromDomain) {
        var getAllDetails = await Masterdetail.find();
        if (getAllDetails.length > 0) {
          for (let i = 0; i < getAllDetails.length; i++) {
            const element = getAllDetails[i];

            var getDomainDetails = await getDescriptionKeyData(element.id, 'domainURL');
            if (getDomainDetails && getDomainDetails.value === req.query.filter.where.getDetailsFromDomain) {
              resData = element;
              resData.isFromDomain = true;
              break;
            } else {
              var getURLDetails = await getDescriptionKeyData(element.id, 'webstoreURL');
              if (getURLDetails && getURLDetails.value === req.query.filter.where.getDetailsFromURL) {
                resData = element;
                resData.isFromDomain = false;
                break;
              }
            }

          }
        }
      }

      if (!resData) {
        resData = {};
      }
      return resData;

    } catch (error) {
      throw error;
    }
  };

  Masterdetail.patchMaterdetailsMetaConfiguration = async function (req) {

    try {
      var masterMetaData = await constants.commonFindOneFunction({
        model: app.models.masterdetailmeta,
        whereObj: {
          masterdetailId: req.query.where.masterdetailId
        }
      });
      masterMetaData = JSON.parse(masterMetaData.configuration);
      masterMetaData.planDetails[0].isShowDashboardWelcomeModal = false;
      return await app.models.masterdetailmeta.updateAll({
        masterdetailId: req.query.where.masterdetailId
      }, {
        configuration: JSON.stringify(masterMetaData)
      });
    } catch (error) {
      throw error;
    }
  };

  /**
   * Change Name In Language JSON As per define in Request Body
   */

  /**
   * Add Tenant id in all tables
   */

  //   UPDATE `AccessToken` SET `masterdetailId` = 'ba19035f-5998-4d73-b8c2-acc5c1a6705c';

  //   UPDATE `category` SET `masterdetailId` = 'ba19035f-5998-4d73-b8c2-acc5c1a6705c';

  //   UPDATE `categorymedia` SET `masterdetailId` = 'ba19035f-5998-4d73-b8c2-acc5c1a6705c';

  //   UPDATE `city` SET `masterdetailId` = 'ba19035f-5998-4d73-b8c2-acc5c1a6705c';

  //   UPDATE `commoncounter` SET `masterdetailId` = 'ba19035f-5998-4d73-b8c2-acc5c1a6705c';

  //   UPDATE `group` SET `masterdetailId` = 'ba19035f-5998-4d73-b8c2-acc5c1a6705c';

  //   UPDATE `groupcategory` SET `masterdetailId` = 'ba19035f-5998-4d73-b8c2-acc5c1a6705c';

  //   UPDATE `groupprice` SET `masterdetailId` = 'ba19035f-5998-4d73-b8c2-acc5c1a6705c';

  //   UPDATE `inquiry` SET `masterdetailId` = 'ba19035f-5998-4d73-b8c2-acc5c1a6705c';

  //   UPDATE `language` SET `masterdetailId` = 'ba19035f-5998-4d73-b8c2-acc5c1a6705c';

  //   UPDATE `notification` SET `masterdetailId` = 'ba19035f-5998-4d73-b8c2-acc5c1a6705c';

  //   UPDATE `notificationreceiver` SET `masterdetailId` = 'ba19035f-5998-4d73-b8c2-acc5c1a6705c';

  //   UPDATE `notificationtype` SET `masterdetailId` = 'ba19035f-5998-4d73-b8c2-acc5c1a6705c';

  //   UPDATE `order` SET `masterdetailId` = 'ba19035f-5998-4d73-b8c2-acc5c1a6705c';

  //   UPDATE `orderdetails` SET `masterdetailId` = 'ba19035f-5998-4d73-b8c2-acc5c1a6705c';

  //   UPDATE `ordernotes` SET `masterdetailId` = 'ba19035f-5998-4d73-b8c2-acc5c1a6705c';

  //   UPDATE `ordernotesmedia` SET `masterdetailId` = 'ba19035f-5998-4d73-b8c2-acc5c1a6705c';

  //   UPDATE `orderstatus` SET `masterdetailId` = 'ba19035f-5998-4d73-b8c2-acc5c1a6705c';

  //   UPDATE `product` SET `masterdetailId` = 'ba19035f-5998-4d73-b8c2-acc5c1a6705c';

  //   UPDATE `productbrand` SET `masterdetailId` = 'ba19035f-5998-4d73-b8c2-acc5c1a6705c';

  //   UPDATE `productmedia` SET `masterdetailId` = 'ba19035f-5998-4d73-b8c2-acc5c1a6705c';

  //   UPDATE `producttags` SET `masterdetailId` = 'ba19035f-5998-4d73-b8c2-acc5c1a6705c';

  //   UPDATE `producttype` SET `masterdetailId` = 'ba19035f-5998-4d73-b8c2-acc5c1a6705c';

  //   UPDATE `role` SET `masterdetailId` = 'ba19035f-5998-4d73-b8c2-acc5c1a6705c';

  //   UPDATE `rolemapping` SET `masterdetailId` = 'ba19035f-5998-4d73-b8c2-acc5c1a6705c';

  //   UPDATE `salesmancity` SET `masterdetailId` = 'ba19035f-5998-4d73-b8c2-acc5c1a6705c';

  //   UPDATE `setting` SET `masterdetailId` = 'ba19035f-5998-4d73-b8c2-acc5c1a6705c';

  //   UPDATE `shorturl` SET `masterdetailId` = 'ba19035f-5998-4d73-b8c2-acc5c1a6705c';

  //   UPDATE `source` SET `masterdetailId` = 'ba19035f-5998-4d73-b8c2-acc5c1a6705c';

  //   UPDATE `state` SET `masterdetailId` = 'ba19035f-5998-4d73-b8c2-acc5c1a6705c';

  //   UPDATE `user` SET `masterdetailId` = 'ba19035f-5998-4d73-b8c2-acc5c1a6705c';

  //   UPDATE `useraddress` SET `masterdetailId` = 'ba19035f-5998-4d73-b8c2-acc5c1a6705c';

  //   UPDATE `usermetaauth` SET `masterdetailId` = 'ba19035f-5998-4d73-b8c2-acc5c1a6705c';

  //   UPDATE `userrole` SET `masterdetailId` = 'ba19035f-5998-4d73-b8c2-acc5c1a6705c';




  /**
   *
   * Update commoncounter query
   * UPDATE commoncounter SET id = UUID();
   */


  /**
   *
   * Update usermetaauth query
   * UPDATE usermetaauth SET id = UUID();
   */

  Masterdetail.changeAdminIdSFRole = async (req) => {
    var rolemappingModel = app.models.rolemapping;

    try {
      // get rolemapping
      rolemappingModel.attachTo(app.dataSources.mysqlsf);
      var rolemapping = await rolemappingModel.find();
      console.log('rolemapping ==== :', rolemapping.length);

      // add rolemapping
      rolemappingModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < rolemapping.length; i++) {
        const element = rolemapping[i];
        await rolemappingModel.create({
          principalType: element.principalType,
          principalId: element.principalId,
          roleId: element.roleId,
          masterdetailId: element.masterdetailId
        });
      }

      console.log('rolemapping updated ');


    } catch (error) {
      throw error;
    }
  };

  // SF
  Masterdetail.changeAdminIdSF = async (req) => {

    var categoryModel = app.models.category;
    var categorymediaModel = app.models.categorymedia;
    var cityModel = app.models.city;
    var commoncounterModel = app.models.commoncounter;
    var groupModel = app.models.group;
    var languageModel = app.models.language;
    var notificationtypeModel = app.models.notificationtype;
    var orderstatusModel = app.models.orderstatus;
    var productModel = app.models.product;
    var productmediaModel = app.models.productmedia;
    var rolemappingModel = app.models.rolemapping;
    var settingModel = app.models.setting;
    var userModel = app.models.user;
    var usermetaauthModel = app.models.usermetaauth;
    var groupcategoryModel = app.models.groupcategory;
    var grouppriceModel = app.models.groupprice;
    var salesmancityModel = app.models.salesmancity;
    var inquiryModel = app.models.inquiry;
    var notificationModel = app.models.notification;
    var notificationreceiverModel = app.models.notificationreceiver;
    var orderModel = app.models.order;
    var orderdetailsModel = app.models.orderdetails;
    var shorturlModel = app.models.shorturl;
    var sourceModel = app.models.source;
    var stateModel = app.models.state;

    try {


      // Category

      // get category
      categoryModel.attachTo(app.dataSources.mysqlsf);
      var categories = await categoryModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('categories ==== :', categories.length);

      // add category
      // categoryModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < categories.length; i++) {
        const element = categories[i];
        await categoryModel.updateAll({
          id: element.id
        }, {
          createdby: 'de632af5-28ea-4a7f-b451-e9ef70625621',
          modifiedby: 'de632af5-28ea-4a7f-b451-e9ef70625621'
        });
      }

      console.log('categories updated ');


      // categorymedia

      // get categorymedia
      categorymediaModel.attachTo(app.dataSources.mysqlsf);
      var categorymedia = await categorymediaModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('categorymedia ==== :', categorymedia.length);

      // add categorymedia
      // categorymediaModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < categorymedia.length; i++) {
        const element = categorymedia[i];
        await categorymediaModel.updateAll({
          id: element.id
        }, {
          createdby: 'de632af5-28ea-4a7f-b451-e9ef70625621',
          modifiedby: 'de632af5-28ea-4a7f-b451-e9ef70625621'
        });
      }

      console.log('categorymedia updated ');



      // city

      // get city
      cityModel.attachTo(app.dataSources.mysqlsf);
      var city = await cityModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('city ==== :', city.length);

      // add city
      // cityModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < city.length; i++) {
        const element = city[i];
        await cityModel.updateAll({
          id: element.id
        }, {
          createdby: 'de632af5-28ea-4a7f-b451-e9ef70625621',
          modifiedby: 'de632af5-28ea-4a7f-b451-e9ef70625621'
        });
      }

      console.log('city updated ');



      // commoncounter

      // get commoncounter
      commoncounterModel.attachTo(app.dataSources.mysqlsf);
      var commoncounter = await commoncounterModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('commoncounter ==== :', commoncounter.length);

      // add commoncounter
      // commoncounterModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < commoncounter.length; i++) {
        const element = commoncounter[i];
        await commoncounterModel.updateAll({
          id: element.id
        }, {
          createdby: 'de632af5-28ea-4a7f-b451-e9ef70625621',
          modifiedby: 'de632af5-28ea-4a7f-b451-e9ef70625621'
        });
      }

      console.log('commoncounter updated ');




      // group

      // get group
      groupModel.attachTo(app.dataSources.mysqlsf);
      var group = await groupModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('group ==== :', group.length);

      // add group
      // groupModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < group.length; i++) {
        const element = group[i];
        await groupModel.updateAll({
          id: element.id
        }, {
          createdby: 'de632af5-28ea-4a7f-b451-e9ef70625621',
          modifiedby: 'de632af5-28ea-4a7f-b451-e9ef70625621'
        });
      }

      console.log('group updated ');



      // language

      // get language
      languageModel.attachTo(app.dataSources.mysqlsf);
      var language = await languageModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('language ==== :', language.length);

      // add language
      // languageModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < language.length; i++) {
        const element = language[i];
        await languageModel.updateAll({
          id: element.id
        }, {
          createdby: 'de632af5-28ea-4a7f-b451-e9ef70625621',
          modifiedby: 'de632af5-28ea-4a7f-b451-e9ef70625621'
        });
      }

      console.log('language updated ');



      // notificationtype

      // get notificationtype
      notificationtypeModel.attachTo(app.dataSources.mysqlsf);
      var notificationtype = await notificationtypeModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('notificationtype ==== :', notificationtype.length);

      // add notificationtype
      // notificationtypeModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < notificationtype.length; i++) {
        const element = notificationtype[i];
        await notificationtypeModel.updateAll({
          id: element.id
        }, {
          createdby: 'de632af5-28ea-4a7f-b451-e9ef70625621',
          modifiedby: 'de632af5-28ea-4a7f-b451-e9ef70625621'
        });
      }

      console.log('notificationtype updated ');


      // orderstatus

      // get orderstatus
      orderstatusModel.attachTo(app.dataSources.mysqlsf);
      var orderstatus = await orderstatusModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('orderstatus ==== :', orderstatus.length);

      // add orderstatus
      // orderstatusModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < orderstatus.length; i++) {
        const element = orderstatus[i];
        await orderstatusModel.updateAll({
          id: element.id
        }, {
          createdby: 'de632af5-28ea-4a7f-b451-e9ef70625621',
          modifiedby: 'de632af5-28ea-4a7f-b451-e9ef70625621'
        });
      }

      console.log('orderstatus updated ');


      // product

      // get product
      productModel.attachTo(app.dataSources.mysqlsf);
      var product = await productModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('product ==== :', product.length);

      // add product
      // productModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < product.length; i++) {
        const element = product[i];
        await productModel.updateAll({
          id: element.id
        }, {
          createdby: 'de632af5-28ea-4a7f-b451-e9ef70625621',
          modifiedby: 'de632af5-28ea-4a7f-b451-e9ef70625621'
        });
      }

      console.log('product updated ');


      // productmedia

      // get productmedia
      productmediaModel.attachTo(app.dataSources.mysqlsf);
      var productmedia = await productmediaModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('productmedia ==== :', productmedia.length);

      // add productmedia
      // productmediaModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < productmedia.length; i++) {
        const element = productmedia[i];
        await productmediaModel.updateAll({
          id: element.id
        }, {
          createdby: 'de632af5-28ea-4a7f-b451-e9ef70625621',
          modifiedby: 'de632af5-28ea-4a7f-b451-e9ef70625621'
        });
      }

      console.log('productmedia updated ');



      // rolemapping - principalId

      // get rolemapping
      rolemappingModel.attachTo(app.dataSources.mysqlsf);
      var rolemapping = await rolemappingModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          principalId: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('rolemapping ==== :', rolemapping.length);

      // add rolemapping
      // rolemappingModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < rolemapping.length; i++) {
        const element = rolemapping[i];
        await rolemappingModel.updateAll({
          id: element.id
        }, {
          principalId: 'de632af5-28ea-4a7f-b451-e9ef70625621'
        });
      }

      console.log('rolemapping updated ');


      // setting

      // get setting
      settingModel.attachTo(app.dataSources.mysqlsf);
      var setting = await settingModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('setting ==== :', setting.length);

      // add setting
      // settingModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < setting.length; i++) {
        const element = setting[i];
        await settingModel.updateAll({
          id: element.id
        }, {
          createdby: 'de632af5-28ea-4a7f-b451-e9ef70625621',
          modifiedby: 'de632af5-28ea-4a7f-b451-e9ef70625621'
        });
      }

      console.log('setting updated ');




      // user

      // get user
      userModel.attachTo(app.dataSources.mysqlsf);
      var user = await userModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('user ==== :', user.length);

      // add user
      // userModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < user.length; i++) {
        const element = user[i];
        await userModel.updateAll({
          id: element.id
        }, {
          createdby: 'de632af5-28ea-4a7f-b451-e9ef70625621',
          modifiedby: 'de632af5-28ea-4a7f-b451-e9ef70625621'
        });
      }

      console.log('user updated ');


      // usermetaauth

      // get usermetaauth
      usermetaauthModel.attachTo(app.dataSources.mysqlsf);
      var usermetaauth = await usermetaauthModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('usermetaauth ==== :', usermetaauth.length);

      // add usermetaauth
      // usermetaauthModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < usermetaauth.length; i++) {
        const element = usermetaauth[i];
        await usermetaauthModel.updateAll({
          id: element.id
        }, {
          createdby: 'de632af5-28ea-4a7f-b451-e9ef70625621',
          modifiedby: 'de632af5-28ea-4a7f-b451-e9ef70625621'
        });
      }

      console.log('usermetaauth updated ');
      console.log('SF : Change Admin Id - Done');


      // change default group id
      var string = "UPDATE `group` SET id = UUID() where name = 'Default';";
      console.log(string);
      var data = await new Promise((resolve, reject) => {
        app.datasources.mysqlsf.connector.execute(string, null, (err, result) => {
          if (err) reject(err);
          resolve(result);
        });
      });


      groupModel.attachTo(app.dataSources.mysqlsf);
      var groupDefault = await groupModel.findOne({
        where: {
          name: 'Default'
        }
      });

      console.log(groupDefault);

      // change group id in groupcategory table
      // get group category
      groupcategoryModel.attachTo(app.dataSources.mysqlsf);
      var groupcategory = await groupcategoryModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          groupId: 'b4a77eec-e686-4d16-839d-ffddb190b159'
        }
      });
      console.log('groupcategory ==== :', groupcategory.length);

      // add group category
      for (let i = 0; i < groupcategory.length; i++) {
        const element = groupcategory[i];
        await groupcategoryModel.updateAll({
          id: element.id
        }, {
          groupId: groupDefault.id
        });
      }

      console.log('groupcategory updated ');


      // change group id in groupprice table
      // get groupprice
      grouppriceModel.attachTo(app.dataSources.mysqlsf);
      var groupprice = await grouppriceModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          groupId: 'b4a77eec-e686-4d16-839d-ffddb190b159'
        }
      });
      console.log('groupprice ==== :', groupprice.length);

      // add groupprice
      for (let i = 0; i < groupprice.length; i++) {
        const element = groupprice[i];
        await grouppriceModel.updateAll({
          id: element.id
        }, {
          groupId: groupDefault.id
        });
      }

      console.log('groupprice updated ');

      // change group id in user table
      // get user
      userModel.attachTo(app.dataSources.mysqlsf);
      var user = await userModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          groupId: 'b4a77eec-e686-4d16-839d-ffddb190b159'
        }
      });
      console.log('user ==== :', user.length);

      // add user
      for (let i = 0; i < user.length; i++) {
        const element = user[i];
        await userModel.updateAll({
          id: element.id
        }, {
          groupId: groupDefault.id
        });
      }

      console.log('user updated ');


      // get city
      cityModel.attachTo(app.dataSources.mysqlsf);
      userModel.attachTo(app.dataSources.mysqlsf);
      salesmancityModel.attachTo(app.dataSources.mysqlsf);
      var cityIdChange = await cityModel.find({
        where: {
          deletedAt: {
            eq: null
          }
        }
      });
      console.log('city count :  ', cityIdChange.length);

      for (let i = 0; i < cityIdChange.length; i++) {
        const element = cityIdChange[i];

        var string = "UPDATE `city` SET id = UUID() where name = '" + element.name + "';";
        var data = await new Promise((resolve, reject) => {
          app.datasources.mysqlsf.connector.execute(string, null, (err, result) => {
            if (err) reject(err);
            resolve(result);
          });
        });

        var cityOne = await cityModel.findOne({
          where: {
            name: element.name
          }
        });


        await userModel.updateAll({
          cityId: element.id
        }, {
          cityId: cityOne.id
        });
        console.log('User city updated ');

        await salesmancityModel.updateAll({
          cityId: element.id
        }, {
          cityId: cityOne.id
        });
        console.log('salesman city updated ');

      }



      // chnage internal user's ID and related data
      userModel.attachTo(app.dataSources.mysqlsf);
      commoncounterModel.attachTo(app.dataSources.mysqlsf);
      inquiryModel.attachTo(app.dataSources.mysqlsf);
      notificationModel.attachTo(app.dataSources.mysqlsf);
      notificationreceiverModel.attachTo(app.dataSources.mysqlsf);
      orderModel.attachTo(app.dataSources.mysqlsf);
      orderdetailsModel.attachTo(app.dataSources.mysqlsf);
      rolemappingModel.attachTo(app.dataSources.mysqlsf);
      salesmancityModel.attachTo(app.dataSources.mysqlsf);
      shorturlModel.attachTo(app.dataSources.mysqlsf);
      usermetaauthModel.attachTo(app.dataSources.mysqlsf);

      var changeUsers = await userModel.find({
        where: {
          cellnumber: {
            inq: ['9726502809', '9665656464', '9228220042', '9054088413', '8401981510', '8401981588', '9537608322', '8320849409',
              '9313751388', '9909514307', '9998792646', '6352766480', '9067013598', '9426184837', '9712070814', '9712056809',
              '9067747041', '8200310991', '8452964844', '9428439526', '9818845455', '7621075934'
            ]
          }
        }
      });

      console.log('User : ', changeUsers.length);

      for (let i = 0; i < changeUsers.length; i++) {
        const element = changeUsers[i];
        var string = "UPDATE `user` SET id = UUID() where cellnumber = '" + element.cellnumber + "';";
        console.log(string);
        var data = await new Promise((resolve, reject) => {
          app.datasources.mysqlsf.connector.execute(string, null, (err, result) => {
            if (err) reject(err);
            resolve(result);
          });
        });

        var user = await userModel.findOne({
          where: {
            cellnumber: element.cellnumber
          }
        });

        console.log('user', user.id);


        await commoncounterModel.updateAll({
          userId: element.id
        }, {
          userId: user.id
        });
        console.log('commoncounterModel updated ');

        await inquiryModel.updateAll({
          assignedto: element.id
        }, {
          assignedto: user.id,
          createdby: user.id,
          userId: user.id
        });
        console.log('inquiryModel assignedto updated ');


        await notificationModel.updateAll({
          notificationreceiverId: element.id
        }, {
          notificationreceiverId: user.id,
          createdby: user.id
        });
        console.log('notificationModel notificationreceiverId updated ');


        await notificationreceiverModel.updateAll({
          userId: element.id
        }, {
          userId: user.id,
          createdby: user.id
        });
        console.log('notificationreceiverModel userId updated ');


        await orderModel.updateAll({
          userId: element.id
        }, {
          userId: user.id,
          createdby: user.id
        });
        console.log('orderModel updated ');

        await orderdetailsModel.updateAll({
          userId: element.id
        }, {
          createdby: user.id
        });
        console.log('orderModel updated ');

        await rolemappingModel.updateAll({
          principalId: element.id
        }, {
          principalId: user.id
        });
        console.log('rolemappingModel updated ');

        await salesmancityModel.updateAll({
          userId: element.id
        }, {
          userId: user.id
        });
        console.log('salesmancityModel updated ');

        await shorturlModel.updateAll({
          userId: element.id
        }, {
          userId: user.id
        });
        console.log('shorturlModel updated ');

        await usermetaauthModel.updateAll({
          userId: element.id
        }, {
          userId: user.id
        });
        console.log('usermetaauthModel updated ');


      }



      // language

      // get language
      languageModel.attachTo(app.dataSources.mysqlsf);
      var language = await languageModel.find({
        where: {
          deletedAt: {
            eq: null
          }
        }
      });
      console.log('language ==== :', language.length);

      // add language
      languageModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < language.length; i++) {
        const element = language[i];
        await languageModel.create({
          key: element.key,
          value: element.value,
          createdby: element.assignedto,
          modifiedby: element.industryId,
          created: element.created,
          modified: element.modified,
          masterdetailId: element.masterdetailId
        });
      }

      console.log('language updated ');




      // notificationType

      // get notificationType
      notificationtypeModel.attachTo(app.dataSources.mysqlsf);
      var notificationtype = await notificationtypeModel.find({
        where: {
          deletedAt: {
            eq: null
          }
        }
      });
      console.log('notificationtype ==== :', notificationtype.length);

      // add notificationType
      notificationtypeModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < notificationtype.length; i++) {
        const element = notificationtype[i];
        await notificationtypeModel.create({
          textmessage: element.textmessage,
          textmessage_html: element.textmessage_html,
          code: element.code,
          notification: element.notification,
          notificationId: element.notificationId,
          createdby: element.assignedto,
          modifiedby: element.industryId,
          created: element.created,
          modified: element.modified,
          masterdetailId: element.masterdetailId
        });
      }

      console.log('notificationtype updated ');



      // orderstatus

      // get orderstatus
      orderstatusModel.attachTo(app.dataSources.mysqlsf);
      var orderstatus = await orderstatusModel.find({
        where: {
          deletedAt: {
            eq: null
          }
        }
      });
      console.log('orderstatus ==== :', orderstatus.length);

      // add orderstatus
      orderstatusModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < orderstatus.length; i++) {
        const element = orderstatus[i];
        await orderstatusModel.create({
          status: element.status,
          createdby: element.createdby,
          modifiedby: element.modifiedby,
          created: element.created,
          modified: element.modified,
          masterdetailId: element.masterdetailId
        });
      }

      console.log('orderstatus updated ');



      // rolemapping

      // get rolemapping
      rolemappingModel.attachTo(app.dataSources.mysqlsf);
      var rolemapping = await rolemappingModel.find({
        where: {
          deletedAt: {
            eq: null
          }
        }
      });
      console.log('rolemapping ==== :', rolemapping.length);

      // add rolemapping
      rolemappingModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < rolemapping.length; i++) {
        const element = rolemapping[i];
        await rolemappingModel.create({
          principalType: element.principalType,
          principalId: element.principalId,
          roleId: element.roleId,
          masterdetailId: element.masterdetailId
        });
      }

      console.log('rolemapping updated ');



      // setting

      // get setting
      settingModel.attachTo(app.dataSources.mysqlsf);
      var setting = await settingModel.find({
        where: {
          deletedAt: {
            eq: null
          }
        }
      });
      console.log('setting ==== :', setting.length);

      // add setting
      settingModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < setting.length; i++) {
        const element = setting[i];
        await settingModel.create({
          registerallow: element.registerallow,
          status: element.status,
          text: element.text,
          createdby: element.createdby,
          modifiedby: element.modifiedby,
          created: element.created,
          modified: element.modified,
          masterdetailId: element.masterdetailId
        });
      }

      console.log('setting updated ');


      // source

      // get source
      sourceModel.attachTo(app.dataSources.mysqlsf);
      var source = await sourceModel.find({
        where: {
          deletedAt: {
            eq: null
          }
        }
      });
      console.log('source ==== :', source.length);

      // add source
      sourceModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < source.length; i++) {
        const element = source[i];
        await sourceModel.create({
          name: element.name,
          created: element.created,
          modified: element.modified,
          masterdetailId: element.masterdetailId
        });
      }

      console.log('source updated ');


      // state

      // get state
      stateModel.attachTo(app.dataSources.mysqlsf);
      var state = await stateModel.find({
        where: {
          deletedAt: {
            eq: null
          }
        }
      });
      console.log('state ==== :', state.length);

      // add state
      stateModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < state.length; i++) {
        const element = state[i];
        await stateModel.create({
          name: element.name,
          parentId: element.parentId,
          created: element.created,
          modified: element.modified,
          masterdetailId: element.masterdetailId
        });
      }

      console.log('state updated ');




      return true;

    } catch (error) {
      throw error;
    }

  };

  // SJ
  Masterdetail.changeAdminIdSJ = async (req) => {

    var categoryModel = app.models.category;
    var categorymediaModel = app.models.categorymedia;
    var cityModel = app.models.city;
    var commoncounterModel = app.models.commoncounter;
    var groupModel = app.models.group;
    var languageModel = app.models.language;
    var notificationtypeModel = app.models.notificationtype;
    var orderstatusModel = app.models.orderstatus;
    var productModel = app.models.product;
    var productmediaModel = app.models.productmedia;
    var rolemappingModel = app.models.rolemapping;
    var settingModel = app.models.setting;
    var userModel = app.models.user;
    var usermetaauthModel = app.models.usermetaauth;
    var groupcategoryModel = app.models.groupcategory;
    var grouppriceModel = app.models.groupprice;
    var salesmancityModel = app.models.salesmancity;
    var inquiryModel = app.models.inquiry;
    var notificationModel = app.models.notification;
    var notificationreceiverModel = app.models.notificationreceiver;
    var orderModel = app.models.order;
    var orderdetailsModel = app.models.orderdetails;
    var shorturlModel = app.models.shorturl;
    var sourceModel = app.models.source;
    var stateModel = app.models.state;

    try {


      // Category

      // get category
      categoryModel.attachTo(app.dataSources.mysqlsf);
      var categories = await categoryModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('categories ==== :', categories.length);

      // add category
      // categoryModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < categories.length; i++) {
        const element = categories[i];
        await categoryModel.updateAll({
          id: element.id
        }, {
          createdby: '5e3b76f4-f7bd-4f55-ac1a-5f968b0a885a',
          modifiedby: '5e3b76f4-f7bd-4f55-ac1a-5f968b0a885a'
        });
      }

      console.log('categories updated ');


      // categorymedia

      // get categorymedia
      categorymediaModel.attachTo(app.dataSources.mysqlsf);
      var categorymedia = await categorymediaModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('categorymedia ==== :', categorymedia.length);

      // add categorymedia
      // categorymediaModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < categorymedia.length; i++) {
        const element = categorymedia[i];
        await categorymediaModel.updateAll({
          id: element.id
        }, {
          createdby: '5e3b76f4-f7bd-4f55-ac1a-5f968b0a885a',
          modifiedby: '5e3b76f4-f7bd-4f55-ac1a-5f968b0a885a'
        });
      }

      console.log('categorymedia updated ');



      // city

      // get city
      cityModel.attachTo(app.dataSources.mysqlsf);
      var city = await cityModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('city ==== :', city.length);

      // add city
      // cityModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < city.length; i++) {
        const element = city[i];
        await cityModel.updateAll({
          id: element.id
        }, {
          createdby: '5e3b76f4-f7bd-4f55-ac1a-5f968b0a885a',
          modifiedby: '5e3b76f4-f7bd-4f55-ac1a-5f968b0a885a'
        });
      }

      console.log('city updated ');



      // commoncounter

      // get commoncounter
      commoncounterModel.attachTo(app.dataSources.mysqlsf);
      var commoncounter = await commoncounterModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('commoncounter ==== :', commoncounter.length);

      // add commoncounter
      // commoncounterModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < commoncounter.length; i++) {
        const element = commoncounter[i];
        await commoncounterModel.updateAll({
          id: element.id
        }, {
          createdby: '5e3b76f4-f7bd-4f55-ac1a-5f968b0a885a',
          modifiedby: '5e3b76f4-f7bd-4f55-ac1a-5f968b0a885a'
        });
      }

      console.log('commoncounter updated ');




      // group

      // get group
      groupModel.attachTo(app.dataSources.mysqlsf);
      var group = await groupModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('group ==== :', group.length);

      // add group
      // groupModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < group.length; i++) {
        const element = group[i];
        await groupModel.updateAll({
          id: element.id
        }, {
          createdby: '5e3b76f4-f7bd-4f55-ac1a-5f968b0a885a',
          modifiedby: '5e3b76f4-f7bd-4f55-ac1a-5f968b0a885a'
        });
      }

      console.log('group updated ');



      // language

      // get language
      languageModel.attachTo(app.dataSources.mysqlsf);
      var language = await languageModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('language ==== :', language.length);

      // add language
      // languageModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < language.length; i++) {
        const element = language[i];
        await languageModel.updateAll({
          id: element.id
        }, {
          createdby: '5e3b76f4-f7bd-4f55-ac1a-5f968b0a885a',
          modifiedby: '5e3b76f4-f7bd-4f55-ac1a-5f968b0a885a'
        });
      }

      console.log('language updated ');



      // notificationtype

      // get notificationtype
      notificationtypeModel.attachTo(app.dataSources.mysqlsf);
      var notificationtype = await notificationtypeModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('notificationtype ==== :', notificationtype.length);

      // add notificationtype
      // notificationtypeModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < notificationtype.length; i++) {
        const element = notificationtype[i];
        await notificationtypeModel.updateAll({
          id: element.id
        }, {
          createdby: '5e3b76f4-f7bd-4f55-ac1a-5f968b0a885a',
          modifiedby: '5e3b76f4-f7bd-4f55-ac1a-5f968b0a885a'
        });
      }

      console.log('notificationtype updated ');


      // orderstatus

      // get orderstatus
      orderstatusModel.attachTo(app.dataSources.mysqlsf);
      var orderstatus = await orderstatusModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('orderstatus ==== :', orderstatus.length);

      // add orderstatus
      // orderstatusModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < orderstatus.length; i++) {
        const element = orderstatus[i];
        await orderstatusModel.updateAll({
          id: element.id
        }, {
          createdby: '5e3b76f4-f7bd-4f55-ac1a-5f968b0a885a',
          modifiedby: '5e3b76f4-f7bd-4f55-ac1a-5f968b0a885a'
        });
      }

      console.log('orderstatus updated ');


      // product

      // get product
      productModel.attachTo(app.dataSources.mysqlsf);
      var product = await productModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('product ==== :', product.length);

      // add product
      // productModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < product.length; i++) {
        const element = product[i];
        await productModel.updateAll({
          id: element.id
        }, {
          createdby: '5e3b76f4-f7bd-4f55-ac1a-5f968b0a885a',
          modifiedby: '5e3b76f4-f7bd-4f55-ac1a-5f968b0a885a'
        });
      }

      console.log('product updated ');


      // productmedia

      // get productmedia
      productmediaModel.attachTo(app.dataSources.mysqlsf);
      var productmedia = await productmediaModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('productmedia ==== :', productmedia.length);

      // add productmedia
      // productmediaModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < productmedia.length; i++) {
        const element = productmedia[i];
        await productmediaModel.updateAll({
          id: element.id
        }, {
          createdby: '5e3b76f4-f7bd-4f55-ac1a-5f968b0a885a',
          modifiedby: '5e3b76f4-f7bd-4f55-ac1a-5f968b0a885a'
        });
      }

      console.log('productmedia updated ');



      // rolemapping - principalId

      // get rolemapping
      rolemappingModel.attachTo(app.dataSources.mysqlsf);
      var rolemapping = await rolemappingModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          principalId: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('rolemapping ==== :', rolemapping.length);

      // add rolemapping
      // rolemappingModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < rolemapping.length; i++) {
        const element = rolemapping[i];
        await rolemappingModel.updateAll({
          id: element.id
        }, {
          principalId: '5e3b76f4-f7bd-4f55-ac1a-5f968b0a885a'
        });
      }

      console.log('rolemapping updated ');


      // setting

      // get setting
      settingModel.attachTo(app.dataSources.mysqlsf);
      var setting = await settingModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('setting ==== :', setting.length);

      // add setting
      // settingModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < setting.length; i++) {
        const element = setting[i];
        await settingModel.updateAll({
          id: element.id
        }, {
          createdby: '5e3b76f4-f7bd-4f55-ac1a-5f968b0a885a',
          modifiedby: '5e3b76f4-f7bd-4f55-ac1a-5f968b0a885a'
        });
      }

      console.log('setting updated ');




      // user

      // get user
      userModel.attachTo(app.dataSources.mysqlsf);
      var user = await userModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('user ==== :', user.length);

      // add user
      // userModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < user.length; i++) {
        const element = user[i];
        await userModel.updateAll({
          id: element.id
        }, {
          createdby: '5e3b76f4-f7bd-4f55-ac1a-5f968b0a885a',
          modifiedby: '5e3b76f4-f7bd-4f55-ac1a-5f968b0a885a'
        });
      }

      console.log('user updated ');


      // usermetaauth

      // get usermetaauth
      usermetaauthModel.attachTo(app.dataSources.mysqlsf);
      var usermetaauth = await usermetaauthModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('usermetaauth ==== :', usermetaauth.length);

      // add usermetaauth
      // usermetaauthModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < usermetaauth.length; i++) {
        const element = usermetaauth[i];
        await usermetaauthModel.updateAll({
          id: element.id
        }, {
          createdby: '5e3b76f4-f7bd-4f55-ac1a-5f968b0a885a',
          modifiedby: '5e3b76f4-f7bd-4f55-ac1a-5f968b0a885a'
        });
      }

      console.log('usermetaauth updated ');
      console.log('SJ : Change Admin Id - Done');

      // change default group id
      var string = "UPDATE `group` SET id = UUID() where name = 'Default';";
      console.log(string);
      var data = await new Promise((resolve, reject) => {
        app.datasources.mysqlsf.connector.execute(string, null, (err, result) => {
          if (err) reject(err);
          resolve(result);
        });
      });


      groupModel.attachTo(app.dataSources.mysqlsf);
      var groupDefault = await groupModel.findOne({
        where: {
          name: 'Default'
        }
      });

      console.log(groupDefault);

      // change group id in groupcategory table
      // get group category
      groupcategoryModel.attachTo(app.dataSources.mysqlsf);
      var groupcategory = await groupcategoryModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          groupId: 'b4a77eec-e686-4d16-839d-ffddb190b159'
        }
      });
      console.log('groupcategory ==== :', groupcategory.length);

      // add group category
      for (let i = 0; i < groupcategory.length; i++) {
        const element = groupcategory[i];
        await groupcategoryModel.updateAll({
          id: element.id
        }, {
          groupId: groupDefault.id
        });
      }

      console.log('groupcategory updated ');


      // change group id in groupprice table
      // get groupprice
      grouppriceModel.attachTo(app.dataSources.mysqlsf);
      var groupprice = await grouppriceModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          groupId: 'b4a77eec-e686-4d16-839d-ffddb190b159'
        }
      });
      console.log('groupprice ==== :', groupprice.length);

      // add groupprice
      for (let i = 0; i < groupprice.length; i++) {
        const element = groupprice[i];
        await grouppriceModel.updateAll({
          id: element.id
        }, {
          groupId: groupDefault.id
        });
      }

      console.log('groupprice updated ');

      // change group id in user table
      // get user
      userModel.attachTo(app.dataSources.mysqlsf);
      var user = await userModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          groupId: 'b4a77eec-e686-4d16-839d-ffddb190b159'
        }
      });
      console.log('user ==== :', user.length);

      // add user
      for (let i = 0; i < user.length; i++) {
        const element = user[i];
        await userModel.updateAll({
          id: element.id
        }, {
          groupId: groupDefault.id
        });
      }

      console.log('user updated ');


      // get city
      cityModel.attachTo(app.dataSources.mysqlsf);
      userModel.attachTo(app.dataSources.mysqlsf);
      salesmancityModel.attachTo(app.dataSources.mysqlsf);
      var cityIdChange = await cityModel.find({
        where: {
          deletedAt: {
            eq: null
          }
        }
      });
      console.log('city count :  ', cityIdChange.length);

      for (let i = 0; i < cityIdChange.length; i++) {
        const element = cityIdChange[i];

        var string = "UPDATE `city` SET id = UUID() where name = '" + element.name + "';";
        var data = await new Promise((resolve, reject) => {
          app.datasources.mysqlsf.connector.execute(string, null, (err, result) => {
            if (err) reject(err);
            resolve(result);
          });
        });

        var cityOne = await cityModel.findOne({
          where: {
            name: element.name
          }
        });


        await userModel.updateAll({
          cityId: element.id
        }, {
          cityId: cityOne.id
        });
        console.log('User city updated ');

        await salesmancityModel.updateAll({
          cityId: element.id
        }, {
          cityId: cityOne.id
        });
        console.log('salesman city updated ');

      }

      // chnage internal user's ID and related data
      userModel.attachTo(app.dataSources.mysqlsf);
      commoncounterModel.attachTo(app.dataSources.mysqlsf);
      inquiryModel.attachTo(app.dataSources.mysqlsf);
      notificationModel.attachTo(app.dataSources.mysqlsf);
      notificationreceiverModel.attachTo(app.dataSources.mysqlsf);
      orderModel.attachTo(app.dataSources.mysqlsf);
      orderdetailsModel.attachTo(app.dataSources.mysqlsf);
      rolemappingModel.attachTo(app.dataSources.mysqlsf);
      salesmancityModel.attachTo(app.dataSources.mysqlsf);
      shorturlModel.attachTo(app.dataSources.mysqlsf);
      usermetaauthModel.attachTo(app.dataSources.mysqlsf);

      var changeUsers = await userModel.find({
        where: {
          cellnumber: {
            inq: ['9726502809', '9665656464', '9228220042', '9054088413', '8401981510', '8401981588', '9537608322', '8320849409',
              '9313751388', '9909514307', '9998792646', '6352766480', '9067013598', '9426184837', '9712070814', '9712056809',
              '9067747041', '8200310991', '8452964844', '9428439526', '9818845455', '7621075934'
            ]
          }
        }
      });

      console.log('User : ', changeUsers.length);

      for (let i = 0; i < changeUsers.length; i++) {
        const element = changeUsers[i];
        var string = "UPDATE `user` SET id = UUID() where cellnumber = '" + element.cellnumber + "';";
        console.log(string);
        var data = await new Promise((resolve, reject) => {
          app.datasources.mysqlsf.connector.execute(string, null, (err, result) => {
            if (err) reject(err);
            resolve(result);
          });
        });

        var user = await userModel.findOne({
          where: {
            cellnumber: element.cellnumber
          }
        });

        console.log('user', user.id);


        await commoncounterModel.updateAll({
          userId: element.id
        }, {
          userId: user.id
        });
        console.log('commoncounterModel updated ');

        await inquiryModel.updateAll({
          assignedto: element.id
        }, {
          assignedto: user.id,
          createdby: user.id,
          userId: user.id
        });
        console.log('inquiryModel assignedto updated ');


        await notificationModel.updateAll({
          notificationreceiverId: element.id
        }, {
          notificationreceiverId: user.id,
          createdby: user.id
        });
        console.log('notificationModel notificationreceiverId updated ');


        await notificationreceiverModel.updateAll({
          userId: element.id
        }, {
          userId: user.id,
          createdby: user.id
        });
        console.log('notificationreceiverModel userId updated ');


        await orderModel.updateAll({
          userId: element.id
        }, {
          userId: user.id,
          createdby: user.id
        });
        console.log('orderModel updated ');

        await orderdetailsModel.updateAll({
          userId: element.id
        }, {
          createdby: user.id
        });
        console.log('orderModel updated ');

        await rolemappingModel.updateAll({
          principalId: element.id
        }, {
          principalId: user.id
        });
        console.log('rolemappingModel updated ');

        await salesmancityModel.updateAll({
          userId: element.id
        }, {
          userId: user.id
        });
        console.log('salesmancityModel updated ');

        await shorturlModel.updateAll({
          userId: element.id
        }, {
          userId: user.id
        });
        console.log('shorturlModel updated ');

        await usermetaauthModel.updateAll({
          userId: element.id
        }, {
          userId: user.id
        });
        console.log('usermetaauthModel updated ');

      }


      // language

      // get language
      languageModel.attachTo(app.dataSources.mysqlsf);
      var language = await languageModel.find({
        where: {
          deletedAt: {
            eq: null
          }
        }
      });
      console.log('language ==== :', language.length);

      // add language
      languageModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < language.length; i++) {
        const element = language[i];
        await languageModel.create({
          key: element.key,
          value: element.value,
          createdby: element.assignedto,
          modifiedby: element.industryId,
          created: element.created,
          modified: element.modified,
          masterdetailId: element.masterdetailId
        });
      }

      console.log('language updated ');




      // notificationType

      // get notificationType
      notificationtypeModel.attachTo(app.dataSources.mysqlsf);
      var notificationtype = await notificationtypeModel.find({
        where: {
          deletedAt: {
            eq: null
          }
        }
      });
      console.log('notificationtype ==== :', notificationtype.length);

      // add notificationType
      notificationtypeModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < notificationtype.length; i++) {
        const element = notificationtype[i];
        await notificationtypeModel.create({
          textmessage: element.textmessage,
          textmessage_html: element.textmessage_html,
          code: element.code,
          notification: element.notification,
          notificationId: element.notificationId,
          createdby: element.assignedto,
          modifiedby: element.industryId,
          created: element.created,
          modified: element.modified,
          masterdetailId: element.masterdetailId
        });
      }

      console.log('notificationtype updated ');



      // orderstatus

      // get orderstatus
      orderstatusModel.attachTo(app.dataSources.mysqlsf);
      var orderstatus = await orderstatusModel.find({
        where: {
          deletedAt: {
            eq: null
          }
        }
      });
      console.log('orderstatus ==== :', orderstatus.length);

      // add orderstatus
      orderstatusModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < orderstatus.length; i++) {
        const element = orderstatus[i];
        await orderstatusModel.create({
          status: element.status,
          createdby: element.createdby,
          modifiedby: element.modifiedby,
          created: element.created,
          modified: element.modified,
          masterdetailId: element.masterdetailId
        });
      }

      console.log('orderstatus updated ');



      // rolemapping

      // get rolemapping
      rolemappingModel.attachTo(app.dataSources.mysqlsf);
      var rolemapping = await rolemappingModel.find({
        where: {
          deletedAt: {
            eq: null
          }
        }
      });
      console.log('rolemapping ==== :', rolemapping.length);

      // add rolemapping
      rolemappingModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < rolemapping.length; i++) {
        const element = rolemapping[i];
        await rolemappingModel.create({
          principalType: element.principalType,
          principalId: element.principalId,
          roleId: element.roleId,
          masterdetailId: element.masterdetailId
        });
      }

      console.log('rolemapping updated ');



      // setting

      // get setting
      settingModel.attachTo(app.dataSources.mysqlsf);
      var setting = await settingModel.find({
        where: {
          deletedAt: {
            eq: null
          }
        }
      });
      console.log('setting ==== :', setting.length);

      // add setting
      settingModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < setting.length; i++) {
        const element = setting[i];
        await settingModel.create({
          registerallow: element.registerallow,
          status: element.status,
          text: element.text,
          createdby: element.createdby,
          modifiedby: element.modifiedby,
          created: element.created,
          modified: element.modified,
          masterdetailId: element.masterdetailId
        });
      }

      console.log('setting updated ');


      // source

      // get source
      sourceModel.attachTo(app.dataSources.mysqlsf);
      var source = await sourceModel.find({
        where: {
          deletedAt: {
            eq: null
          }
        }
      });
      console.log('source ==== :', source.length);

      // add source
      sourceModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < source.length; i++) {
        const element = source[i];
        await sourceModel.create({
          name: element.name,
          created: element.created,
          modified: element.modified,
          masterdetailId: element.masterdetailId
        });
      }

      console.log('source updated ');


      // state

      // get state
      stateModel.attachTo(app.dataSources.mysqlsf);
      var state = await stateModel.find({
        where: {
          deletedAt: {
            eq: null
          }
        }
      });
      console.log('state ==== :', state.length);

      // add state
      stateModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < state.length; i++) {
        const element = state[i];
        await stateModel.create({
          name: element.name,
          parentId: element.parentId,
          created: element.created,
          modified: element.modified,
          masterdetailId: element.masterdetailId
        });
      }

      console.log('state updated ');

      return true;

    } catch (error) {
      throw error;
    }

  };

  // KJ
  Masterdetail.changeAdminIdKJ = async (req) => {

    var categoryModel = app.models.category;
    var categorymediaModel = app.models.categorymedia;
    var cityModel = app.models.city;
    var commoncounterModel = app.models.commoncounter;
    var groupModel = app.models.group;
    var languageModel = app.models.language;
    var notificationtypeModel = app.models.notificationtype;
    var orderstatusModel = app.models.orderstatus;
    var productModel = app.models.product;
    var productmediaModel = app.models.productmedia;
    var rolemappingModel = app.models.rolemapping;
    var settingModel = app.models.setting;
    var userModel = app.models.user;
    var usermetaauthModel = app.models.usermetaauth;
    var groupcategoryModel = app.models.groupcategory;
    var grouppriceModel = app.models.groupprice;
    var salesmancityModel = app.models.salesmancity;
    var inquiryModel = app.models.inquiry;
    var notificationModel = app.models.notification;
    var notificationreceiverModel = app.models.notificationreceiver;
    var orderModel = app.models.order;
    var orderdetailsModel = app.models.orderdetails;
    var shorturlModel = app.models.shorturl;
    var sourceModel = app.models.source;
    var stateModel = app.models.state;

    try {

      // Category

      // get category
      categoryModel.attachTo(app.dataSources.mysqlsf);
      var categories = await categoryModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('categories ==== :', categories.length);

      // add category
      // categoryModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < categories.length; i++) {
        const element = categories[i];
        await categoryModel.updateAll({
          id: element.id
        }, {
          createdby: '2d8bcfbd-d696-4ef5-b2f0-2a57c6de66a3',
          modifiedby: '2d8bcfbd-d696-4ef5-b2f0-2a57c6de66a3'
        });
      }

      console.log('categories updated ');


      // categorymedia

      // get categorymedia
      categorymediaModel.attachTo(app.dataSources.mysqlsf);
      var categorymedia = await categorymediaModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('categorymedia ==== :', categorymedia.length);

      // add categorymedia
      // categorymediaModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < categorymedia.length; i++) {
        const element = categorymedia[i];
        await categorymediaModel.updateAll({
          id: element.id
        }, {
          createdby: '2d8bcfbd-d696-4ef5-b2f0-2a57c6de66a3',
          modifiedby: '2d8bcfbd-d696-4ef5-b2f0-2a57c6de66a3'
        });
      }

      console.log('categorymedia updated ');



      // city

      // get city
      cityModel.attachTo(app.dataSources.mysqlsf);
      var city = await cityModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('city ==== :', city.length);

      // add city
      // cityModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < city.length; i++) {
        const element = city[i];
        await cityModel.updateAll({
          id: element.id
        }, {
          createdby: '2d8bcfbd-d696-4ef5-b2f0-2a57c6de66a3',
          modifiedby: '2d8bcfbd-d696-4ef5-b2f0-2a57c6de66a3'
        });
      }

      console.log('city updated ');



      // commoncounter

      // get commoncounter
      commoncounterModel.attachTo(app.dataSources.mysqlsf);
      var commoncounter = await commoncounterModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('commoncounter ==== :', commoncounter.length);

      // add commoncounter
      // commoncounterModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < commoncounter.length; i++) {
        const element = commoncounter[i];
        await commoncounterModel.updateAll({
          id: element.id
        }, {
          createdby: '2d8bcfbd-d696-4ef5-b2f0-2a57c6de66a3',
          modifiedby: '2d8bcfbd-d696-4ef5-b2f0-2a57c6de66a3'
        });
      }

      console.log('commoncounter updated ');




      // group

      // get group
      groupModel.attachTo(app.dataSources.mysqlsf);
      var group = await groupModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('group ==== :', group.length);

      // add group
      // groupModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < group.length; i++) {
        const element = group[i];
        await groupModel.updateAll({
          id: element.id
        }, {
          createdby: '2d8bcfbd-d696-4ef5-b2f0-2a57c6de66a3',
          modifiedby: '2d8bcfbd-d696-4ef5-b2f0-2a57c6de66a3'
        });
      }

      console.log('group updated ');



      // language

      // get language
      languageModel.attachTo(app.dataSources.mysqlsf);
      var language = await languageModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('language ==== :', language.length);

      // add language
      // languageModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < language.length; i++) {
        const element = language[i];
        await languageModel.updateAll({
          id: element.id
        }, {
          createdby: '2d8bcfbd-d696-4ef5-b2f0-2a57c6de66a3',
          modifiedby: '2d8bcfbd-d696-4ef5-b2f0-2a57c6de66a3'
        });
      }

      console.log('language updated ');



      // notificationtype

      // get notificationtype
      notificationtypeModel.attachTo(app.dataSources.mysqlsf);
      var notificationtype = await notificationtypeModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('notificationtype ==== :', notificationtype.length);

      // add notificationtype
      // notificationtypeModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < notificationtype.length; i++) {
        const element = notificationtype[i];
        await notificationtypeModel.updateAll({
          id: element.id
        }, {
          createdby: '2d8bcfbd-d696-4ef5-b2f0-2a57c6de66a3',
          modifiedby: '2d8bcfbd-d696-4ef5-b2f0-2a57c6de66a3'
        });
      }

      console.log('notificationtype updated ');


      // orderstatus

      // get orderstatus
      orderstatusModel.attachTo(app.dataSources.mysqlsf);
      var orderstatus = await orderstatusModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('orderstatus ==== :', orderstatus.length);

      // add orderstatus
      // orderstatusModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < orderstatus.length; i++) {
        const element = orderstatus[i];
        await orderstatusModel.updateAll({
          id: element.id
        }, {
          createdby: '2d8bcfbd-d696-4ef5-b2f0-2a57c6de66a3',
          modifiedby: '2d8bcfbd-d696-4ef5-b2f0-2a57c6de66a3'
        });
      }

      console.log('orderstatus updated ');


      // product

      // get product
      productModel.attachTo(app.dataSources.mysqlsf);
      var product = await productModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('product ==== :', product.length);

      // add product
      // productModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < product.length; i++) {
        const element = product[i];
        await productModel.updateAll({
          id: element.id
        }, {
          createdby: '2d8bcfbd-d696-4ef5-b2f0-2a57c6de66a3',
          modifiedby: '2d8bcfbd-d696-4ef5-b2f0-2a57c6de66a3'
        });
      }

      console.log('product updated ');


      // productmedia

      // get productmedia
      productmediaModel.attachTo(app.dataSources.mysqlsf);
      var productmedia = await productmediaModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('productmedia ==== :', productmedia.length);

      // add productmedia
      // productmediaModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < productmedia.length; i++) {
        const element = productmedia[i];
        await productmediaModel.updateAll({
          id: element.id
        }, {
          createdby: '2d8bcfbd-d696-4ef5-b2f0-2a57c6de66a3',
          modifiedby: '2d8bcfbd-d696-4ef5-b2f0-2a57c6de66a3'
        });
      }

      console.log('productmedia updated ');



      // rolemapping - principalId

      // get rolemapping
      rolemappingModel.attachTo(app.dataSources.mysqlsf);
      var rolemapping = await rolemappingModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          principalId: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('rolemapping ==== :', rolemapping.length);

      // add rolemapping
      // rolemappingModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < rolemapping.length; i++) {
        const element = rolemapping[i];
        await rolemappingModel.updateAll({
          id: element.id
        }, {
          principalId: '2d8bcfbd-d696-4ef5-b2f0-2a57c6de66a3'
        });
      }

      console.log('rolemapping updated ');


      // setting

      // get setting
      settingModel.attachTo(app.dataSources.mysqlsf);
      var setting = await settingModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('setting ==== :', setting.length);

      // add setting
      // settingModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < setting.length; i++) {
        const element = setting[i];
        await settingModel.updateAll({
          id: element.id
        }, {
          createdby: '2d8bcfbd-d696-4ef5-b2f0-2a57c6de66a3',
          modifiedby: '2d8bcfbd-d696-4ef5-b2f0-2a57c6de66a3'
        });
      }

      console.log('setting updated ');




      // user

      // get user
      userModel.attachTo(app.dataSources.mysqlsf);
      var user = await userModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('user ==== :', user.length);

      // add user
      // userModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < user.length; i++) {
        const element = user[i];
        await userModel.updateAll({
          id: element.id
        }, {
          createdby: '2d8bcfbd-d696-4ef5-b2f0-2a57c6de66a3',
          modifiedby: '2d8bcfbd-d696-4ef5-b2f0-2a57c6de66a3'
        });
      }

      console.log('user updated ');


      // usermetaauth

      // get usermetaauth
      usermetaauthModel.attachTo(app.dataSources.mysqlsf);
      var usermetaauth = await usermetaauthModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('usermetaauth ==== :', usermetaauth.length);

      // add usermetaauth
      // usermetaauthModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < usermetaauth.length; i++) {
        const element = usermetaauth[i];
        await usermetaauthModel.updateAll({
          id: element.id
        }, {
          createdby: '2d8bcfbd-d696-4ef5-b2f0-2a57c6de66a3',
          modifiedby: '2d8bcfbd-d696-4ef5-b2f0-2a57c6de66a3'
        });
      }

      console.log('usermetaauth updated ');
      console.log('KJ : Change Admin Id - Done');

      // change default group id
      var string = "UPDATE `group` SET id = UUID() where name = 'Default';";
      console.log(string);
      var data = await new Promise((resolve, reject) => {
        app.datasources.mysqlsf.connector.execute(string, null, (err, result) => {
          if (err) reject(err);
          resolve(result);
        });
      });


      groupModel.attachTo(app.dataSources.mysqlsf);
      var groupDefault = await groupModel.findOne({
        where: {
          name: 'Default'
        }
      });

      console.log(groupDefault);

      // change group id in groupcategory table
      // get group category
      groupcategoryModel.attachTo(app.dataSources.mysqlsf);
      var groupcategory = await groupcategoryModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          groupId: 'b4a77eec-e686-4d16-839d-ffddb190b159'
        }
      });
      console.log('groupcategory ==== :', groupcategory.length);

      // add group category
      for (let i = 0; i < groupcategory.length; i++) {
        const element = groupcategory[i];
        await groupcategoryModel.updateAll({
          id: element.id
        }, {
          groupId: groupDefault.id
        });
      }

      console.log('groupcategory updated ');


      // change group id in groupprice table
      // get groupprice
      grouppriceModel.attachTo(app.dataSources.mysqlsf);
      var groupprice = await grouppriceModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          groupId: 'b4a77eec-e686-4d16-839d-ffddb190b159'
        }
      });
      console.log('groupprice ==== :', groupprice.length);

      // add groupprice
      for (let i = 0; i < groupprice.length; i++) {
        const element = groupprice[i];
        await grouppriceModel.updateAll({
          id: element.id
        }, {
          groupId: groupDefault.id
        });
      }

      console.log('groupprice updated ');

      // change group id in user table
      // get user
      userModel.attachTo(app.dataSources.mysqlsf);
      var user = await userModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          groupId: 'b4a77eec-e686-4d16-839d-ffddb190b159'
        }
      });
      console.log('user ==== :', user.length);

      // add user
      for (let i = 0; i < user.length; i++) {
        const element = user[i];
        await userModel.updateAll({
          id: element.id
        }, {
          groupId: groupDefault.id
        });
      }

      console.log('user updated ');


      // get city
      cityModel.attachTo(app.dataSources.mysqlsf);
      userModel.attachTo(app.dataSources.mysqlsf);
      salesmancityModel.attachTo(app.dataSources.mysqlsf);
      var cityIdChange = await cityModel.find({
        where: {
          deletedAt: {
            eq: null
          }
        }
      });
      console.log('city count :  ', cityIdChange.length);

      for (let i = 0; i < cityIdChange.length; i++) {
        const element = cityIdChange[i];

        var string = "UPDATE `city` SET id = UUID() where name = '" + element.name + "';";
        var data = await new Promise((resolve, reject) => {
          app.datasources.mysqlsf.connector.execute(string, null, (err, result) => {
            if (err) reject(err);
            resolve(result);
          });
        });

        var cityOne = await cityModel.findOne({
          where: {
            name: element.name
          }
        });


        await userModel.updateAll({
          cityId: element.id
        }, {
          cityId: cityOne.id
        });
        console.log('User city updated ');

        await salesmancityModel.updateAll({
          cityId: element.id
        }, {
          cityId: cityOne.id
        });
        console.log('salesman city updated ');

      }

      // chnage internal user's ID and related data
      userModel.attachTo(app.dataSources.mysqlsf);
      commoncounterModel.attachTo(app.dataSources.mysqlsf);
      inquiryModel.attachTo(app.dataSources.mysqlsf);
      notificationModel.attachTo(app.dataSources.mysqlsf);
      notificationreceiverModel.attachTo(app.dataSources.mysqlsf);
      orderModel.attachTo(app.dataSources.mysqlsf);
      orderdetailsModel.attachTo(app.dataSources.mysqlsf);
      rolemappingModel.attachTo(app.dataSources.mysqlsf);
      salesmancityModel.attachTo(app.dataSources.mysqlsf);
      shorturlModel.attachTo(app.dataSources.mysqlsf);
      usermetaauthModel.attachTo(app.dataSources.mysqlsf);

      var changeUsers = await userModel.find({
        where: {
          cellnumber: {
            inq: ['9726502809', '9665656464', '9228220042', '9054088413', '8401981510', '8401981588', '9537608322', '8320849409',
              '9313751388', '9909514307', '9998792646', '6352766480', '9067013598', '9426184837', '9712070814', '9712056809',
              '9067747041', '8200310991', '8452964844', '9428439526', '9818845455', '7621075934'
            ]
          }
        }
      });

      console.log('User : ', changeUsers.length);

      for (let i = 0; i < changeUsers.length; i++) {
        const element = changeUsers[i];
        var string = "UPDATE `user` SET id = UUID() where cellnumber = '" + element.cellnumber + "';";
        console.log(string);
        var data = await new Promise((resolve, reject) => {
          app.datasources.mysqlsf.connector.execute(string, null, (err, result) => {
            if (err) reject(err);
            resolve(result);
          });
        });

        var user = await userModel.findOne({
          where: {
            cellnumber: element.cellnumber
          }
        });

        console.log('user', user.id);


        await commoncounterModel.updateAll({
          userId: element.id
        }, {
          userId: user.id
        });
        console.log('commoncounterModel updated ');

        await inquiryModel.updateAll({
          assignedto: element.id
        }, {
          assignedto: user.id,
          createdby: user.id,
          userId: user.id
        });
        console.log('inquiryModel assignedto updated ');


        await notificationModel.updateAll({
          notificationreceiverId: element.id
        }, {
          notificationreceiverId: user.id,
          createdby: user.id
        });
        console.log('notificationModel notificationreceiverId updated ');


        await notificationreceiverModel.updateAll({
          userId: element.id
        }, {
          userId: user.id,
          createdby: user.id
        });
        console.log('notificationreceiverModel userId updated ');


        await orderModel.updateAll({
          userId: element.id
        }, {
          userId: user.id,
          createdby: user.id
        });
        console.log('orderModel updated ');

        await orderdetailsModel.updateAll({
          userId: element.id
        }, {
          createdby: user.id
        });
        console.log('orderModel updated ');

        await rolemappingModel.updateAll({
          principalId: element.id
        }, {
          principalId: user.id
        });
        console.log('rolemappingModel updated ');

        await salesmancityModel.updateAll({
          userId: element.id
        }, {
          userId: user.id
        });
        console.log('salesmancityModel updated ');

        await shorturlModel.updateAll({
          userId: element.id
        }, {
          userId: user.id
        });
        console.log('shorturlModel updated ');

        await usermetaauthModel.updateAll({
          userId: element.id
        }, {
          userId: user.id
        });
        console.log('usermetaauthModel updated ');


      }

      // language

      // get language
      languageModel.attachTo(app.dataSources.mysqlsf);
      var language = await languageModel.find({
        where: {
          deletedAt: {
            eq: null
          }
        }
      });
      console.log('language ==== :', language.length);

      // add language
      languageModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < language.length; i++) {
        const element = language[i];
        await languageModel.create({
          key: element.key,
          value: element.value,
          createdby: element.assignedto,
          modifiedby: element.industryId,
          created: element.created,
          modified: element.modified,
          masterdetailId: element.masterdetailId
        });
      }

      console.log('language updated ');




      // notificationType

      // get notificationType
      notificationtypeModel.attachTo(app.dataSources.mysqlsf);
      var notificationtype = await notificationtypeModel.find({
        where: {
          deletedAt: {
            eq: null
          }
        }
      });
      console.log('notificationtype ==== :', notificationtype.length);

      // add notificationType
      notificationtypeModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < notificationtype.length; i++) {
        const element = notificationtype[i];
        await notificationtypeModel.create({
          textmessage: element.textmessage,
          textmessage_html: element.textmessage_html,
          code: element.code,
          notification: element.notification,
          notificationId: element.notificationId,
          createdby: element.assignedto,
          modifiedby: element.industryId,
          created: element.created,
          modified: element.modified,
          masterdetailId: element.masterdetailId
        });
      }

      console.log('notificationtype updated ');



      // orderstatus

      // get orderstatus
      orderstatusModel.attachTo(app.dataSources.mysqlsf);
      var orderstatus = await orderstatusModel.find({
        where: {
          deletedAt: {
            eq: null
          }
        }
      });
      console.log('orderstatus ==== :', orderstatus.length);

      // add orderstatus
      orderstatusModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < orderstatus.length; i++) {
        const element = orderstatus[i];
        await orderstatusModel.create({
          status: element.status,
          createdby: element.createdby,
          modifiedby: element.modifiedby,
          created: element.created,
          modified: element.modified,
          masterdetailId: element.masterdetailId
        });
      }

      console.log('orderstatus updated ');



      // rolemapping

      // get rolemapping
      rolemappingModel.attachTo(app.dataSources.mysqlsf);
      var rolemapping = await rolemappingModel.find({
        where: {
          deletedAt: {
            eq: null
          }
        }
      });
      console.log('rolemapping ==== :', rolemapping.length);

      // add rolemapping
      rolemappingModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < rolemapping.length; i++) {
        const element = rolemapping[i];
        await rolemappingModel.create({
          principalType: element.principalType,
          principalId: element.principalId,
          roleId: element.roleId,
          masterdetailId: element.masterdetailId
        });
      }

      console.log('rolemapping updated ');



      // setting

      // get setting
      settingModel.attachTo(app.dataSources.mysqlsf);
      var setting = await settingModel.find({
        where: {
          deletedAt: {
            eq: null
          }
        }
      });
      console.log('setting ==== :', setting.length);

      // add setting
      settingModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < setting.length; i++) {
        const element = setting[i];
        await settingModel.create({
          registerallow: element.registerallow,
          status: element.status,
          text: element.text,
          createdby: element.createdby,
          modifiedby: element.modifiedby,
          created: element.created,
          modified: element.modified,
          masterdetailId: element.masterdetailId
        });
      }

      console.log('setting updated ');


      // source

      // get source
      sourceModel.attachTo(app.dataSources.mysqlsf);
      var source = await sourceModel.find({
        where: {
          deletedAt: {
            eq: null
          }
        }
      });
      console.log('source ==== :', source.length);

      // add source
      sourceModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < source.length; i++) {
        const element = source[i];
        await sourceModel.create({
          name: element.name,
          created: element.created,
          modified: element.modified,
          masterdetailId: element.masterdetailId
        });
      }

      console.log('source updated ');


      // state

      // get state
      stateModel.attachTo(app.dataSources.mysqlsf);
      var state = await stateModel.find({
        where: {
          deletedAt: {
            eq: null
          }
        }
      });
      console.log('state ==== :', state.length);

      // add state
      stateModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < state.length; i++) {
        const element = state[i];
        await stateModel.create({
          name: element.name,
          parentId: element.parentId,
          created: element.created,
          modified: element.modified,
          masterdetailId: element.masterdetailId
        });
      }

      console.log('state updated ');


      return true;

    } catch (error) {
      throw error;
    }

  };

  // Panam
  Masterdetail.changeAdminIdPANAM = async (req) => {

    var categoryModel = app.models.category;
    var categorymediaModel = app.models.categorymedia;
    var cityModel = app.models.city;
    var commoncounterModel = app.models.commoncounter;
    var groupModel = app.models.group;
    var languageModel = app.models.language;
    var notificationtypeModel = app.models.notificationtype;
    var orderstatusModel = app.models.orderstatus;
    var productModel = app.models.product;
    var productmediaModel = app.models.productmedia;
    var rolemappingModel = app.models.rolemapping;
    var settingModel = app.models.setting;
    var userModel = app.models.user;
    var usermetaauthModel = app.models.usermetaauth;
    var groupcategoryModel = app.models.groupcategory;
    var grouppriceModel = app.models.groupprice;
    var salesmancityModel = app.models.salesmancity;
    var inquiryModel = app.models.inquiry;
    var notificationModel = app.models.notification;
    var notificationreceiverModel = app.models.notificationreceiver;
    var orderModel = app.models.order;
    var orderdetailsModel = app.models.orderdetails;
    var shorturlModel = app.models.shorturl;
    var sourceModel = app.models.source;
    var stateModel = app.models.state;

    try {


      // Category

      // get category
      categoryModel.attachTo(app.dataSources.mysqlsf);
      var categories = await categoryModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('categories ==== :', categories.length);

      // add category
      // categoryModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < categories.length; i++) {
        const element = categories[i];
        await categoryModel.updateAll({
          id: element.id
        }, {
          createdby: '1cf9d222-b26d-4585-a961-e5a54a518263',
          modifiedby: '1cf9d222-b26d-4585-a961-e5a54a518263'
        });
      }

      console.log('categories updated ');


      // categorymedia

      // get categorymedia
      categorymediaModel.attachTo(app.dataSources.mysqlsf);
      var categorymedia = await categorymediaModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('categorymedia ==== :', categorymedia.length);

      // add categorymedia
      // categorymediaModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < categorymedia.length; i++) {
        const element = categorymedia[i];
        await categorymediaModel.updateAll({
          id: element.id
        }, {
          createdby: '1cf9d222-b26d-4585-a961-e5a54a518263',
          modifiedby: '1cf9d222-b26d-4585-a961-e5a54a518263'
        });
      }

      console.log('categorymedia updated ');



      // city

      // get city
      cityModel.attachTo(app.dataSources.mysqlsf);
      var city = await cityModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('city ==== :', city.length);

      // add city
      // cityModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < city.length; i++) {
        const element = city[i];
        await cityModel.updateAll({
          id: element.id
        }, {
          createdby: '1cf9d222-b26d-4585-a961-e5a54a518263',
          modifiedby: '1cf9d222-b26d-4585-a961-e5a54a518263'
        });
      }

      console.log('city updated ');



      // commoncounter

      // get commoncounter
      commoncounterModel.attachTo(app.dataSources.mysqlsf);
      var commoncounter = await commoncounterModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('commoncounter ==== :', commoncounter.length);

      // add commoncounter
      // commoncounterModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < commoncounter.length; i++) {
        const element = commoncounter[i];
        await commoncounterModel.updateAll({
          id: element.id
        }, {
          createdby: '1cf9d222-b26d-4585-a961-e5a54a518263',
          modifiedby: '1cf9d222-b26d-4585-a961-e5a54a518263'
        });
      }

      console.log('commoncounter updated ');




      // group

      // get group
      groupModel.attachTo(app.dataSources.mysqlsf);
      var group = await groupModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('group ==== :', group.length);

      // add group
      // groupModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < group.length; i++) {
        const element = group[i];
        await groupModel.updateAll({
          id: element.id
        }, {
          createdby: '1cf9d222-b26d-4585-a961-e5a54a518263',
          modifiedby: '1cf9d222-b26d-4585-a961-e5a54a518263'
        });
      }

      console.log('group updated ');



      // language

      // get language
      languageModel.attachTo(app.dataSources.mysqlsf);
      var language = await languageModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('language ==== :', language.length);

      // add language
      // languageModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < language.length; i++) {
        const element = language[i];
        await languageModel.updateAll({
          id: element.id
        }, {
          createdby: '1cf9d222-b26d-4585-a961-e5a54a518263',
          modifiedby: '1cf9d222-b26d-4585-a961-e5a54a518263'
        });
      }

      console.log('language updated ');



      // notificationtype

      // get notificationtype
      notificationtypeModel.attachTo(app.dataSources.mysqlsf);
      var notificationtype = await notificationtypeModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('notificationtype ==== :', notificationtype.length);

      // add notificationtype
      // notificationtypeModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < notificationtype.length; i++) {
        const element = notificationtype[i];
        await notificationtypeModel.updateAll({
          id: element.id
        }, {
          createdby: '1cf9d222-b26d-4585-a961-e5a54a518263',
          modifiedby: '1cf9d222-b26d-4585-a961-e5a54a518263'
        });
      }

      console.log('notificationtype updated ');


      // orderstatus

      // get orderstatus
      orderstatusModel.attachTo(app.dataSources.mysqlsf);
      var orderstatus = await orderstatusModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('orderstatus ==== :', orderstatus.length);

      // add orderstatus
      // orderstatusModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < orderstatus.length; i++) {
        const element = orderstatus[i];
        await orderstatusModel.updateAll({
          id: element.id
        }, {
          createdby: '1cf9d222-b26d-4585-a961-e5a54a518263',
          modifiedby: '1cf9d222-b26d-4585-a961-e5a54a518263'
        });
      }

      console.log('orderstatus updated ');


      // product

      // get product
      productModel.attachTo(app.dataSources.mysqlsf);
      var product = await productModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('product ==== :', product.length);

      // add product
      // productModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < product.length; i++) {
        const element = product[i];
        await productModel.updateAll({
          id: element.id
        }, {
          createdby: '1cf9d222-b26d-4585-a961-e5a54a518263',
          modifiedby: '1cf9d222-b26d-4585-a961-e5a54a518263'
        });
      }

      console.log('product updated ');


      // productmedia

      // get productmedia
      productmediaModel.attachTo(app.dataSources.mysqlsf);
      var productmedia = await productmediaModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('productmedia ==== :', productmedia.length);

      // add productmedia
      // productmediaModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < productmedia.length; i++) {
        const element = productmedia[i];
        await productmediaModel.updateAll({
          id: element.id
        }, {
          createdby: '1cf9d222-b26d-4585-a961-e5a54a518263',
          modifiedby: '1cf9d222-b26d-4585-a961-e5a54a518263'
        });
      }

      console.log('productmedia updated ');



      // rolemapping - principalId

      // get rolemapping
      rolemappingModel.attachTo(app.dataSources.mysqlsf);
      var rolemapping = await rolemappingModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          principalId: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('rolemapping ==== :', rolemapping.length);

      // add rolemapping
      // rolemappingModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < rolemapping.length; i++) {
        const element = rolemapping[i];
        await rolemappingModel.updateAll({
          id: element.id
        }, {
          principalId: '1cf9d222-b26d-4585-a961-e5a54a518263'
        });
      }

      console.log('rolemapping updated ');


      // setting

      // get setting
      settingModel.attachTo(app.dataSources.mysqlsf);
      var setting = await settingModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('setting ==== :', setting.length);

      // add setting
      // settingModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < setting.length; i++) {
        const element = setting[i];
        await settingModel.updateAll({
          id: element.id
        }, {
          createdby: '1cf9d222-b26d-4585-a961-e5a54a518263',
          modifiedby: '1cf9d222-b26d-4585-a961-e5a54a518263'
        });
      }

      console.log('setting updated ');




      // user

      // get user
      userModel.attachTo(app.dataSources.mysqlsf);
      var user = await userModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('user ==== :', user.length);

      // add user
      // userModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < user.length; i++) {
        const element = user[i];
        await userModel.updateAll({
          id: element.id
        }, {
          createdby: '1cf9d222-b26d-4585-a961-e5a54a518263',
          modifiedby: '1cf9d222-b26d-4585-a961-e5a54a518263'
        });
      }

      console.log('user updated ');


      // usermetaauth

      // get usermetaauth
      usermetaauthModel.attachTo(app.dataSources.mysqlsf);
      var usermetaauth = await usermetaauthModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('usermetaauth ==== :', usermetaauth.length);

      // add usermetaauth
      // usermetaauthModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < usermetaauth.length; i++) {
        const element = usermetaauth[i];
        await usermetaauthModel.updateAll({
          id: element.id
        }, {
          createdby: '1cf9d222-b26d-4585-a961-e5a54a518263',
          modifiedby: '1cf9d222-b26d-4585-a961-e5a54a518263'
        });
      }

      console.log('usermetaauth updated ');
      console.log('Panam : Change Admin Id - Done');

      // change default group id
      var string = "UPDATE `group` SET id = UUID() where name = 'Default';";
      console.log(string);
      var data = await new Promise((resolve, reject) => {
        app.datasources.mysqlsf.connector.execute(string, null, (err, result) => {
          if (err) reject(err);
          resolve(result);
        });
      });


      groupModel.attachTo(app.dataSources.mysqlsf);
      var groupDefault = await groupModel.findOne({
        where: {
          name: 'Default'
        }
      });

      console.log(groupDefault);

      // change group id in groupcategory table
      // get group category
      groupcategoryModel.attachTo(app.dataSources.mysqlsf);
      var groupcategory = await groupcategoryModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          groupId: 'b4a77eec-e686-4d16-839d-ffddb190b159'
        }
      });
      console.log('groupcategory ==== :', groupcategory.length);

      // add group category
      for (let i = 0; i < groupcategory.length; i++) {
        const element = groupcategory[i];
        await groupcategoryModel.updateAll({
          id: element.id
        }, {
          groupId: groupDefault.id
        });
      }

      console.log('groupcategory updated ');


      // change group id in groupprice table
      // get groupprice
      grouppriceModel.attachTo(app.dataSources.mysqlsf);
      var groupprice = await grouppriceModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          groupId: 'b4a77eec-e686-4d16-839d-ffddb190b159'
        }
      });
      console.log('groupprice ==== :', groupprice.length);

      // add groupprice
      for (let i = 0; i < groupprice.length; i++) {
        const element = groupprice[i];
        await grouppriceModel.updateAll({
          id: element.id
        }, {
          groupId: groupDefault.id
        });
      }

      console.log('groupprice updated ');

      // change group id in user table
      // get user
      userModel.attachTo(app.dataSources.mysqlsf);
      var user = await userModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          groupId: 'b4a77eec-e686-4d16-839d-ffddb190b159'
        }
      });
      console.log('user ==== :', user.length);

      // add user
      for (let i = 0; i < user.length; i++) {
        const element = user[i];
        await userModel.updateAll({
          id: element.id
        }, {
          groupId: groupDefault.id
        });
      }

      console.log('user updated ');


      // get city
      cityModel.attachTo(app.dataSources.mysqlsf);
      userModel.attachTo(app.dataSources.mysqlsf);
      salesmancityModel.attachTo(app.dataSources.mysqlsf);
      var cityIdChange = await cityModel.find({
        where: {
          deletedAt: {
            eq: null
          }
        }
      });
      console.log('city count :  ', cityIdChange.length);

      for (let i = 0; i < cityIdChange.length; i++) {
        const element = cityIdChange[i];

        var string = "UPDATE `city` SET id = UUID() where name = '" + element.name + "';";
        var data = await new Promise((resolve, reject) => {
          app.datasources.mysqlsf.connector.execute(string, null, (err, result) => {
            if (err) reject(err);
            resolve(result);
          });
        });

        var cityOne = await cityModel.findOne({
          where: {
            name: element.name
          }
        });


        await userModel.updateAll({
          cityId: element.id
        }, {
          cityId: cityOne.id
        });
        console.log('User city updated ');

        await salesmancityModel.updateAll({
          cityId: element.id
        }, {
          cityId: cityOne.id
        });
        console.log('salesman city updated ');

      }

      // chnage internal user's ID and related data
      userModel.attachTo(app.dataSources.mysqlsf);
      commoncounterModel.attachTo(app.dataSources.mysqlsf);
      inquiryModel.attachTo(app.dataSources.mysqlsf);
      notificationModel.attachTo(app.dataSources.mysqlsf);
      notificationreceiverModel.attachTo(app.dataSources.mysqlsf);
      orderModel.attachTo(app.dataSources.mysqlsf);
      orderdetailsModel.attachTo(app.dataSources.mysqlsf);
      rolemappingModel.attachTo(app.dataSources.mysqlsf);
      salesmancityModel.attachTo(app.dataSources.mysqlsf);
      shorturlModel.attachTo(app.dataSources.mysqlsf);
      usermetaauthModel.attachTo(app.dataSources.mysqlsf);

      var changeUsers = await userModel.find({
        where: {
          cellnumber: {
            inq: ['9726502809', '9665656464', '9228220042', '9054088413', '8401981510', '8401981588', '9537608322', '8320849409',
              '9313751388', '9909514307', '9998792646', '6352766480', '9067013598', '9426184837', '9712070814', '9712056809',
              '9067747041', '8200310991', '8452964844', '9428439526', '9818845455', '7621075934'
            ]
          }
        }
      });

      console.log('User : ', changeUsers.length);

      for (let i = 0; i < changeUsers.length; i++) {
        const element = changeUsers[i];
        var string = "UPDATE `user` SET id = UUID() where cellnumber = '" + element.cellnumber + "';";
        console.log(string);
        var data = await new Promise((resolve, reject) => {
          app.datasources.mysqlsf.connector.execute(string, null, (err, result) => {
            if (err) reject(err);
            resolve(result);
          });
        });

        var user = await userModel.findOne({
          where: {
            cellnumber: element.cellnumber
          }
        });

        console.log('user', user.id);


        await commoncounterModel.updateAll({
          userId: element.id
        }, {
          userId: user.id
        });
        console.log('commoncounterModel updated ');

        await inquiryModel.updateAll({
          assignedto: element.id
        }, {
          assignedto: user.id,
          createdby: user.id,
          userId: user.id
        });
        console.log('inquiryModel assignedto updated ');


        await notificationModel.updateAll({
          notificationreceiverId: element.id
        }, {
          notificationreceiverId: user.id,
          createdby: user.id
        });
        console.log('notificationModel notificationreceiverId updated ');


        await notificationreceiverModel.updateAll({
          userId: element.id
        }, {
          userId: user.id,
          createdby: user.id
        });
        console.log('notificationreceiverModel userId updated ');


        await orderModel.updateAll({
          userId: element.id
        }, {
          userId: user.id,
          createdby: user.id
        });
        console.log('orderModel updated ');

        await orderdetailsModel.updateAll({
          userId: element.id
        }, {
          createdby: user.id
        });
        console.log('orderModel updated ');

        await rolemappingModel.updateAll({
          principalId: element.id
        }, {
          principalId: user.id
        });
        console.log('rolemappingModel updated ');

        await salesmancityModel.updateAll({
          userId: element.id
        }, {
          userId: user.id
        });
        console.log('salesmancityModel updated ');

        await shorturlModel.updateAll({
          userId: element.id
        }, {
          userId: user.id
        });
        console.log('shorturlModel updated ');

        await usermetaauthModel.updateAll({
          userId: element.id
        }, {
          userId: user.id
        });
        console.log('usermetaauthModel updated ');


      }

      // language

      // get language
      languageModel.attachTo(app.dataSources.mysqlsf);
      var language = await languageModel.find({
        where: {
          deletedAt: {
            eq: null
          }
        }
      });
      console.log('language ==== :', language.length);

      // add language
      languageModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < language.length; i++) {
        const element = language[i];
        await languageModel.create({
          key: element.key,
          value: element.value,
          createdby: element.assignedto,
          modifiedby: element.industryId,
          created: element.created,
          modified: element.modified,
          masterdetailId: element.masterdetailId
        });
      }

      console.log('language updated ');




      // notificationType

      // get notificationType
      notificationtypeModel.attachTo(app.dataSources.mysqlsf);
      var notificationtype = await notificationtypeModel.find({
        where: {
          deletedAt: {
            eq: null
          }
        }
      });
      console.log('notificationtype ==== :', notificationtype.length);

      // add notificationType
      notificationtypeModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < notificationtype.length; i++) {
        const element = notificationtype[i];
        await notificationtypeModel.create({
          textmessage: element.textmessage,
          textmessage_html: element.textmessage_html,
          code: element.code,
          notification: element.notification,
          notificationId: element.notificationId,
          createdby: element.assignedto,
          modifiedby: element.industryId,
          created: element.created,
          modified: element.modified,
          masterdetailId: element.masterdetailId
        });
      }

      console.log('notificationtype updated ');



      // orderstatus

      // get orderstatus
      orderstatusModel.attachTo(app.dataSources.mysqlsf);
      var orderstatus = await orderstatusModel.find({
        where: {
          deletedAt: {
            eq: null
          }
        }
      });
      console.log('orderstatus ==== :', orderstatus.length);

      // add orderstatus
      orderstatusModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < orderstatus.length; i++) {
        const element = orderstatus[i];
        await orderstatusModel.create({
          status: element.status,
          createdby: element.createdby,
          modifiedby: element.modifiedby,
          created: element.created,
          modified: element.modified,
          masterdetailId: element.masterdetailId
        });
      }

      console.log('orderstatus updated ');



      // rolemapping

      // get rolemapping
      rolemappingModel.attachTo(app.dataSources.mysqlsf);
      var rolemapping = await rolemappingModel.find({
        where: {
          deletedAt: {
            eq: null
          }
        }
      });
      console.log('rolemapping ==== :', rolemapping.length);

      // add rolemapping
      rolemappingModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < rolemapping.length; i++) {
        const element = rolemapping[i];
        await rolemappingModel.create({
          principalType: element.principalType,
          principalId: element.principalId,
          roleId: element.roleId,
          masterdetailId: element.masterdetailId
        });
      }

      console.log('rolemapping updated ');



      // setting

      // get setting
      settingModel.attachTo(app.dataSources.mysqlsf);
      var setting = await settingModel.find({
        where: {
          deletedAt: {
            eq: null
          }
        }
      });
      console.log('setting ==== :', setting.length);

      // add setting
      settingModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < setting.length; i++) {
        const element = setting[i];
        await settingModel.create({
          registerallow: element.registerallow,
          status: element.status,
          text: element.text,
          createdby: element.createdby,
          modifiedby: element.modifiedby,
          created: element.created,
          modified: element.modified,
          masterdetailId: element.masterdetailId
        });
      }

      console.log('setting updated ');


      // source

      // get source
      sourceModel.attachTo(app.dataSources.mysqlsf);
      var source = await sourceModel.find({
        where: {
          deletedAt: {
            eq: null
          }
        }
      });
      console.log('source ==== :', source.length);

      // add source
      sourceModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < source.length; i++) {
        const element = source[i];
        await sourceModel.create({
          name: element.name,
          created: element.created,
          modified: element.modified,
          masterdetailId: element.masterdetailId
        });
      }

      console.log('source updated ');


      // state

      // get state
      stateModel.attachTo(app.dataSources.mysqlsf);
      var state = await stateModel.find({
        where: {
          deletedAt: {
            eq: null
          }
        }
      });
      console.log('state ==== :', state.length);

      // add state
      stateModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < state.length; i++) {
        const element = state[i];
        await stateModel.create({
          name: element.name,
          parentId: element.parentId,
          created: element.created,
          modified: element.modified,
          masterdetailId: element.masterdetailId
        });
      }

      console.log('state updated ');


      return true;

    } catch (error) {
      throw error;
    }

  };

  // Nutland
  Masterdetail.changeAdminIdNUTLAND = async (req) => {

    var categoryModel = app.models.category;
    var categorymediaModel = app.models.categorymedia;
    var cityModel = app.models.city;
    var commoncounterModel = app.models.commoncounter;
    var groupModel = app.models.group;
    var languageModel = app.models.language;
    var notificationtypeModel = app.models.notificationtype;
    var orderstatusModel = app.models.orderstatus;
    var productModel = app.models.product;
    var productmediaModel = app.models.productmedia;
    var rolemappingModel = app.models.rolemapping;
    var settingModel = app.models.setting;
    var userModel = app.models.user;
    var usermetaauthModel = app.models.usermetaauth;
    var groupcategoryModel = app.models.groupcategory;
    var grouppriceModel = app.models.groupprice;
    var salesmancityModel = app.models.salesmancity;
    var inquiryModel = app.models.inquiry;
    var notificationModel = app.models.notification;
    var notificationreceiverModel = app.models.notificationreceiver;
    var orderModel = app.models.order;
    var orderdetailsModel = app.models.orderdetails;
    var shorturlModel = app.models.shorturl;
    var sourceModel = app.models.source;
    var stateModel = app.models.state;

    try {


      // Category

      // get category
      categoryModel.attachTo(app.dataSources.mysqlsf);
      var categories = await categoryModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('categories ==== :', categories.length);

      // add category
      // categoryModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < categories.length; i++) {
        const element = categories[i];
        await categoryModel.updateAll({
          id: element.id
        }, {
          createdby: '8c07a925-4671-4323-a083-1d61a6f6d5ba',
          modifiedby: '8c07a925-4671-4323-a083-1d61a6f6d5ba'
        });
      }

      console.log('categories updated ');


      // categorymedia

      // get categorymedia
      categorymediaModel.attachTo(app.dataSources.mysqlsf);
      var categorymedia = await categorymediaModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('categorymedia ==== :', categorymedia.length);

      // add categorymedia
      // categorymediaModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < categorymedia.length; i++) {
        const element = categorymedia[i];
        await categorymediaModel.updateAll({
          id: element.id
        }, {
          createdby: '8c07a925-4671-4323-a083-1d61a6f6d5ba',
          modifiedby: '8c07a925-4671-4323-a083-1d61a6f6d5ba'
        });
      }

      console.log('categorymedia updated ');



      // city

      // get city
      cityModel.attachTo(app.dataSources.mysqlsf);
      var city = await cityModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('city ==== :', city.length);

      // add city
      // cityModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < city.length; i++) {
        const element = city[i];
        await cityModel.updateAll({
          id: element.id
        }, {
          createdby: '8c07a925-4671-4323-a083-1d61a6f6d5ba',
          modifiedby: '8c07a925-4671-4323-a083-1d61a6f6d5ba'
        });
      }

      console.log('city updated ');



      // commoncounter

      // get commoncounter
      commoncounterModel.attachTo(app.dataSources.mysqlsf);
      var commoncounter = await commoncounterModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('commoncounter ==== :', commoncounter.length);

      // add commoncounter
      // commoncounterModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < commoncounter.length; i++) {
        const element = commoncounter[i];
        await commoncounterModel.updateAll({
          id: element.id
        }, {
          createdby: '8c07a925-4671-4323-a083-1d61a6f6d5ba',
          modifiedby: '8c07a925-4671-4323-a083-1d61a6f6d5ba'
        });
      }

      console.log('commoncounter updated ');




      // group

      // get group
      groupModel.attachTo(app.dataSources.mysqlsf);
      var group = await groupModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('group ==== :', group.length);

      // add group
      // groupModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < group.length; i++) {
        const element = group[i];
        await groupModel.updateAll({
          id: element.id
        }, {
          createdby: '8c07a925-4671-4323-a083-1d61a6f6d5ba',
          modifiedby: '8c07a925-4671-4323-a083-1d61a6f6d5ba'
        });
      }

      console.log('group updated ');



      // language

      // get language
      languageModel.attachTo(app.dataSources.mysqlsf);
      var language = await languageModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('language ==== :', language.length);

      // add language
      // languageModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < language.length; i++) {
        const element = language[i];
        await languageModel.updateAll({
          id: element.id
        }, {
          createdby: '8c07a925-4671-4323-a083-1d61a6f6d5ba',
          modifiedby: '8c07a925-4671-4323-a083-1d61a6f6d5ba'
        });
      }

      console.log('language updated ');



      // notificationtype

      // get notificationtype
      notificationtypeModel.attachTo(app.dataSources.mysqlsf);
      var notificationtype = await notificationtypeModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('notificationtype ==== :', notificationtype.length);

      // add notificationtype
      // notificationtypeModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < notificationtype.length; i++) {
        const element = notificationtype[i];
        await notificationtypeModel.updateAll({
          id: element.id
        }, {
          createdby: '8c07a925-4671-4323-a083-1d61a6f6d5ba',
          modifiedby: '8c07a925-4671-4323-a083-1d61a6f6d5ba'
        });
      }

      console.log('notificationtype updated ');


      // orderstatus

      // get orderstatus
      orderstatusModel.attachTo(app.dataSources.mysqlsf);
      var orderstatus = await orderstatusModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('orderstatus ==== :', orderstatus.length);

      // add orderstatus
      // orderstatusModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < orderstatus.length; i++) {
        const element = orderstatus[i];
        await orderstatusModel.updateAll({
          id: element.id
        }, {
          createdby: '8c07a925-4671-4323-a083-1d61a6f6d5ba',
          modifiedby: '8c07a925-4671-4323-a083-1d61a6f6d5ba'
        });
      }

      console.log('orderstatus updated ');


      // product

      // get product
      productModel.attachTo(app.dataSources.mysqlsf);
      var product = await productModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('product ==== :', product.length);

      // add product
      // productModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < product.length; i++) {
        const element = product[i];
        await productModel.updateAll({
          id: element.id
        }, {
          createdby: '8c07a925-4671-4323-a083-1d61a6f6d5ba',
          modifiedby: '8c07a925-4671-4323-a083-1d61a6f6d5ba'
        });
      }

      console.log('product updated ');


      // productmedia

      // get productmedia
      productmediaModel.attachTo(app.dataSources.mysqlsf);
      var productmedia = await productmediaModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('productmedia ==== :', productmedia.length);

      // add productmedia
      // productmediaModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < productmedia.length; i++) {
        const element = productmedia[i];
        await productmediaModel.updateAll({
          id: element.id
        }, {
          createdby: '8c07a925-4671-4323-a083-1d61a6f6d5ba',
          modifiedby: '8c07a925-4671-4323-a083-1d61a6f6d5ba'
        });
      }

      console.log('productmedia updated ');



      // rolemapping - principalId

      // get rolemapping
      rolemappingModel.attachTo(app.dataSources.mysqlsf);
      var rolemapping = await rolemappingModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          principalId: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('rolemapping ==== :', rolemapping.length);

      // add rolemapping
      // rolemappingModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < rolemapping.length; i++) {
        const element = rolemapping[i];
        await rolemappingModel.updateAll({
          id: element.id
        }, {
          principalId: '8c07a925-4671-4323-a083-1d61a6f6d5ba'
        });
      }

      console.log('rolemapping updated ');


      // setting

      // get setting
      settingModel.attachTo(app.dataSources.mysqlsf);
      var setting = await settingModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('setting ==== :', setting.length);

      // add setting
      // settingModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < setting.length; i++) {
        const element = setting[i];
        await settingModel.updateAll({
          id: element.id
        }, {
          createdby: '8c07a925-4671-4323-a083-1d61a6f6d5ba',
          modifiedby: '8c07a925-4671-4323-a083-1d61a6f6d5ba'
        });
      }

      console.log('setting updated ');




      // user

      // get user
      userModel.attachTo(app.dataSources.mysqlsf);
      var user = await userModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('user ==== :', user.length);

      // add user
      // userModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < user.length; i++) {
        const element = user[i];
        await userModel.updateAll({
          id: element.id
        }, {
          createdby: '8c07a925-4671-4323-a083-1d61a6f6d5ba',
          modifiedby: '8c07a925-4671-4323-a083-1d61a6f6d5ba'
        });
      }

      console.log('user updated ');


      // usermetaauth

      // get usermetaauth
      usermetaauthModel.attachTo(app.dataSources.mysqlsf);
      var usermetaauth = await usermetaauthModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('usermetaauth ==== :', usermetaauth.length);

      // add usermetaauth
      // usermetaauthModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < usermetaauth.length; i++) {
        const element = usermetaauth[i];
        await usermetaauthModel.updateAll({
          id: element.id
        }, {
          createdby: '8c07a925-4671-4323-a083-1d61a6f6d5ba',
          modifiedby: '8c07a925-4671-4323-a083-1d61a6f6d5ba'
        });
      }

      console.log('usermetaauth updated ');
      console.log('Nutland : Change Admin Id - Done');

      // change default group id
      var string = "UPDATE `group` SET id = UUID() where name = 'Default';";
      console.log(string);
      var data = await new Promise((resolve, reject) => {
        app.datasources.mysqlsf.connector.execute(string, null, (err, result) => {
          if (err) reject(err);
          resolve(result);
        });
      });


      groupModel.attachTo(app.dataSources.mysqlsf);
      var groupDefault = await groupModel.findOne({
        where: {
          name: 'Default'
        }
      });

      console.log(groupDefault);

      // change group id in groupcategory table
      // get group category
      groupcategoryModel.attachTo(app.dataSources.mysqlsf);
      var groupcategory = await groupcategoryModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          groupId: 'b4a77eec-e686-4d16-839d-ffddb190b159'
        }
      });
      console.log('groupcategory ==== :', groupcategory.length);

      // add group category
      for (let i = 0; i < groupcategory.length; i++) {
        const element = groupcategory[i];
        await groupcategoryModel.updateAll({
          id: element.id
        }, {
          groupId: groupDefault.id
        });
      }

      console.log('groupcategory updated ');


      // change group id in groupprice table
      // get groupprice
      grouppriceModel.attachTo(app.dataSources.mysqlsf);
      var groupprice = await grouppriceModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          groupId: 'b4a77eec-e686-4d16-839d-ffddb190b159'
        }
      });
      console.log('groupprice ==== :', groupprice.length);

      // add groupprice
      for (let i = 0; i < groupprice.length; i++) {
        const element = groupprice[i];
        await grouppriceModel.updateAll({
          id: element.id
        }, {
          groupId: groupDefault.id
        });
      }

      console.log('groupprice updated ');

      // change group id in user table
      // get user
      userModel.attachTo(app.dataSources.mysqlsf);
      var user = await userModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          groupId: 'b4a77eec-e686-4d16-839d-ffddb190b159'
        }
      });
      console.log('user ==== :', user.length);

      // add user
      for (let i = 0; i < user.length; i++) {
        const element = user[i];
        await userModel.updateAll({
          id: element.id
        }, {
          groupId: groupDefault.id
        });
      }

      console.log('user updated ');


      // get city
      cityModel.attachTo(app.dataSources.mysqlsf);
      userModel.attachTo(app.dataSources.mysqlsf);
      salesmancityModel.attachTo(app.dataSources.mysqlsf);
      var cityIdChange = await cityModel.find({
        where: {
          deletedAt: {
            eq: null
          }
        }
      });
      console.log('city count :  ', cityIdChange.length);

      for (let i = 0; i < cityIdChange.length; i++) {
        const element = cityIdChange[i];

        var string = "UPDATE `city` SET id = UUID() where name = '" + element.name + "';";
        var data = await new Promise((resolve, reject) => {
          app.datasources.mysqlsf.connector.execute(string, null, (err, result) => {
            if (err) reject(err);
            resolve(result);
          });
        });

        var cityOne = await cityModel.findOne({
          where: {
            name: element.name
          }
        });


        await userModel.updateAll({
          cityId: element.id
        }, {
          cityId: cityOne.id
        });
        console.log('User city updated ');

        await salesmancityModel.updateAll({
          cityId: element.id
        }, {
          cityId: cityOne.id
        });
        console.log('salesman city updated ');

      }

      // chnage internal user's ID and related data
      userModel.attachTo(app.dataSources.mysqlsf);
      commoncounterModel.attachTo(app.dataSources.mysqlsf);
      inquiryModel.attachTo(app.dataSources.mysqlsf);
      notificationModel.attachTo(app.dataSources.mysqlsf);
      notificationreceiverModel.attachTo(app.dataSources.mysqlsf);
      orderModel.attachTo(app.dataSources.mysqlsf);
      orderdetailsModel.attachTo(app.dataSources.mysqlsf);
      rolemappingModel.attachTo(app.dataSources.mysqlsf);
      salesmancityModel.attachTo(app.dataSources.mysqlsf);
      shorturlModel.attachTo(app.dataSources.mysqlsf);
      usermetaauthModel.attachTo(app.dataSources.mysqlsf);

      var changeUsers = await userModel.find({
        where: {
          cellnumber: {
            inq: ['9726502809', '9665656464', '9228220042', '9054088413', '8401981510', '8401981588', '9537608322', '8320849409',
              '9313751388', '9909514307', '9998792646', '6352766480', '9067013598', '9426184837', '9712070814', '9712056809',
              '9067747041', '8200310991', '8452964844', '9428439526', '9818845455', '7621075934'
            ]
          }
        }
      });

      console.log('User : ', changeUsers.length);

      for (let i = 0; i < changeUsers.length; i++) {
        const element = changeUsers[i];
        var string = "UPDATE `user` SET id = UUID() where cellnumber = '" + element.cellnumber + "';";
        console.log(string);
        var data = await new Promise((resolve, reject) => {
          app.datasources.mysqlsf.connector.execute(string, null, (err, result) => {
            if (err) reject(err);
            resolve(result);
          });
        });

        var user = await userModel.findOne({
          where: {
            cellnumber: element.cellnumber
          }
        });

        console.log('user', user.id);


        await commoncounterModel.updateAll({
          userId: element.id
        }, {
          userId: user.id
        });
        console.log('commoncounterModel updated ');

        await inquiryModel.updateAll({
          assignedto: element.id
        }, {
          assignedto: user.id,
          createdby: user.id,
          userId: user.id
        });
        console.log('inquiryModel assignedto updated ');


        await notificationModel.updateAll({
          notificationreceiverId: element.id
        }, {
          notificationreceiverId: user.id,
          createdby: user.id
        });
        console.log('notificationModel notificationreceiverId updated ');


        await notificationreceiverModel.updateAll({
          userId: element.id
        }, {
          userId: user.id,
          createdby: user.id
        });
        console.log('notificationreceiverModel userId updated ');


        await orderModel.updateAll({
          userId: element.id
        }, {
          userId: user.id,
          createdby: user.id
        });
        console.log('orderModel updated ');

        await orderdetailsModel.updateAll({
          userId: element.id
        }, {
          createdby: user.id
        });
        console.log('orderModel updated ');

        await rolemappingModel.updateAll({
          principalId: element.id
        }, {
          principalId: user.id
        });
        console.log('rolemappingModel updated ');

        await salesmancityModel.updateAll({
          userId: element.id
        }, {
          userId: user.id
        });
        console.log('salesmancityModel updated ');

        await shorturlModel.updateAll({
          userId: element.id
        }, {
          userId: user.id
        });
        console.log('shorturlModel updated ');

        await usermetaauthModel.updateAll({
          userId: element.id
        }, {
          userId: user.id
        });
        console.log('usermetaauthModel updated ');


      }

      // language

      // get language
      languageModel.attachTo(app.dataSources.mysqlsf);
      var language = await languageModel.find({
        where: {
          deletedAt: {
            eq: null
          }
        }
      });
      console.log('language ==== :', language.length);

      // add language
      languageModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < language.length; i++) {
        const element = language[i];
        await languageModel.create({
          key: element.key,
          value: element.value,
          createdby: element.assignedto,
          modifiedby: element.industryId,
          created: element.created,
          modified: element.modified,
          masterdetailId: element.masterdetailId
        });
      }

      console.log('language updated ');




      // notificationType

      // get notificationType
      notificationtypeModel.attachTo(app.dataSources.mysqlsf);
      var notificationtype = await notificationtypeModel.find({
        where: {
          deletedAt: {
            eq: null
          }
        }
      });
      console.log('notificationtype ==== :', notificationtype.length);

      // add notificationType
      notificationtypeModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < notificationtype.length; i++) {
        const element = notificationtype[i];
        await notificationtypeModel.create({
          textmessage: element.textmessage,
          textmessage_html: element.textmessage_html,
          code: element.code,
          notification: element.notification,
          notificationId: element.notificationId,
          createdby: element.assignedto,
          modifiedby: element.industryId,
          created: element.created,
          modified: element.modified,
          masterdetailId: element.masterdetailId
        });
      }

      console.log('notificationtype updated ');



      // orderstatus

      // get orderstatus
      orderstatusModel.attachTo(app.dataSources.mysqlsf);
      var orderstatus = await orderstatusModel.find({
        where: {
          deletedAt: {
            eq: null
          }
        }
      });
      console.log('orderstatus ==== :', orderstatus.length);

      // add orderstatus
      orderstatusModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < orderstatus.length; i++) {
        const element = orderstatus[i];
        await orderstatusModel.create({
          status: element.status,
          createdby: element.createdby,
          modifiedby: element.modifiedby,
          created: element.created,
          modified: element.modified,
          masterdetailId: element.masterdetailId
        });
      }

      console.log('orderstatus updated ');



      // rolemapping

      // get rolemapping
      rolemappingModel.attachTo(app.dataSources.mysqlsf);
      var rolemapping = await rolemappingModel.find({
        where: {
          deletedAt: {
            eq: null
          }
        }
      });
      console.log('rolemapping ==== :', rolemapping.length);

      // add rolemapping
      rolemappingModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < rolemapping.length; i++) {
        const element = rolemapping[i];
        await rolemappingModel.create({
          principalType: element.principalType,
          principalId: element.principalId,
          roleId: element.roleId,
          masterdetailId: element.masterdetailId
        });
      }

      console.log('rolemapping updated ');



      // setting

      // get setting
      settingModel.attachTo(app.dataSources.mysqlsf);
      var setting = await settingModel.find({
        where: {
          deletedAt: {
            eq: null
          }
        }
      });
      console.log('setting ==== :', setting.length);

      // add setting
      settingModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < setting.length; i++) {
        const element = setting[i];
        await settingModel.create({
          registerallow: element.registerallow,
          status: element.status,
          text: element.text,
          createdby: element.createdby,
          modifiedby: element.modifiedby,
          created: element.created,
          modified: element.modified,
          masterdetailId: element.masterdetailId
        });
      }

      console.log('setting updated ');


      // source

      // get source
      sourceModel.attachTo(app.dataSources.mysqlsf);
      var source = await sourceModel.find({
        where: {
          deletedAt: {
            eq: null
          }
        }
      });
      console.log('source ==== :', source.length);

      // add source
      sourceModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < source.length; i++) {
        const element = source[i];
        await sourceModel.create({
          name: element.name,
          created: element.created,
          modified: element.modified,
          masterdetailId: element.masterdetailId
        });
      }

      console.log('source updated ');


      // state

      // get state
      stateModel.attachTo(app.dataSources.mysqlsf);
      var state = await stateModel.find({
        where: {
          deletedAt: {
            eq: null
          }
        }
      });
      console.log('state ==== :', state.length);

      // add state
      stateModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < state.length; i++) {
        const element = state[i];
        await stateModel.create({
          name: element.name,
          parentId: element.parentId,
          created: element.created,
          modified: element.modified,
          masterdetailId: element.masterdetailId
        });
      }

      console.log('state updated ');


      return true;

    } catch (error) {
      throw error;
    }

  };

  // Nextview
  Masterdetail.changeAdminIdNextview = async (req) => {

    var categoryModel = app.models.category;
    var categorymediaModel = app.models.categorymedia;
    var cityModel = app.models.city;
    var commoncounterModel = app.models.commoncounter;
    var groupModel = app.models.group;
    var languageModel = app.models.language;
    var notificationtypeModel = app.models.notificationtype;
    var orderstatusModel = app.models.orderstatus;
    var productModel = app.models.product;
    var productmediaModel = app.models.productmedia;
    var rolemappingModel = app.models.rolemapping;
    var settingModel = app.models.setting;
    var userModel = app.models.user;
    var usermetaauthModel = app.models.usermetaauth;
    var groupcategoryModel = app.models.groupcategory;
    var grouppriceModel = app.models.groupprice;
    var salesmancityModel = app.models.salesmancity;
    var inquiryModel = app.models.inquiry;
    var notificationModel = app.models.notification;
    var notificationreceiverModel = app.models.notificationreceiver;
    var orderModel = app.models.order;
    var orderdetailsModel = app.models.orderdetails;
    var shorturlModel = app.models.shorturl;
    var sourceModel = app.models.source;
    var stateModel = app.models.state;

    try {


      // Category

      // get category
      categoryModel.attachTo(app.dataSources.mysqlsf);
      var categories = await categoryModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('categories ==== :', categories.length);

      // add category
      // categoryModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < categories.length; i++) {
        const element = categories[i];
        await categoryModel.updateAll({
          id: element.id
        }, {
          createdby: '10e2931c-6e3e-4146-a1a1-b3d74a21d91f',
          modifiedby: '10e2931c-6e3e-4146-a1a1-b3d74a21d91f'
        });
      }

      console.log('categories updated ');


      // categorymedia

      // get categorymedia
      categorymediaModel.attachTo(app.dataSources.mysqlsf);
      var categorymedia = await categorymediaModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('categorymedia ==== :', categorymedia.length);

      // add categorymedia
      // categorymediaModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < categorymedia.length; i++) {
        const element = categorymedia[i];
        await categorymediaModel.updateAll({
          id: element.id
        }, {
          createdby: '10e2931c-6e3e-4146-a1a1-b3d74a21d91f',
          modifiedby: '10e2931c-6e3e-4146-a1a1-b3d74a21d91f'
        });
      }

      console.log('categorymedia updated ');



      // city

      // get city
      cityModel.attachTo(app.dataSources.mysqlsf);
      var city = await cityModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('city ==== :', city.length);

      // add city
      // cityModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < city.length; i++) {
        const element = city[i];
        await cityModel.updateAll({
          id: element.id
        }, {
          createdby: '10e2931c-6e3e-4146-a1a1-b3d74a21d91f',
          modifiedby: '10e2931c-6e3e-4146-a1a1-b3d74a21d91f'
        });
      }

      console.log('city updated ');



      // commoncounter

      // get commoncounter
      commoncounterModel.attachTo(app.dataSources.mysqlsf);
      var commoncounter = await commoncounterModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('commoncounter ==== :', commoncounter.length);

      // add commoncounter
      // commoncounterModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < commoncounter.length; i++) {
        const element = commoncounter[i];
        await commoncounterModel.updateAll({
          id: element.id
        }, {
          createdby: '10e2931c-6e3e-4146-a1a1-b3d74a21d91f',
          modifiedby: '10e2931c-6e3e-4146-a1a1-b3d74a21d91f'
        });
      }

      console.log('commoncounter updated ');




      // group

      // get group
      groupModel.attachTo(app.dataSources.mysqlsf);
      var group = await groupModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('group ==== :', group.length);

      // add group
      // groupModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < group.length; i++) {
        const element = group[i];
        await groupModel.updateAll({
          id: element.id
        }, {
          createdby: '10e2931c-6e3e-4146-a1a1-b3d74a21d91f',
          modifiedby: '10e2931c-6e3e-4146-a1a1-b3d74a21d91f'
        });
      }

      console.log('group updated ');



      // language

      // get language
      languageModel.attachTo(app.dataSources.mysqlsf);
      var language = await languageModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('language ==== :', language.length);

      // add language
      // languageModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < language.length; i++) {
        const element = language[i];
        await languageModel.updateAll({
          id: element.id
        }, {
          createdby: '10e2931c-6e3e-4146-a1a1-b3d74a21d91f',
          modifiedby: '10e2931c-6e3e-4146-a1a1-b3d74a21d91f'
        });
      }

      console.log('language updated ');



      // notificationtype

      // get notificationtype
      notificationtypeModel.attachTo(app.dataSources.mysqlsf);
      var notificationtype = await notificationtypeModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('notificationtype ==== :', notificationtype.length);

      // add notificationtype
      // notificationtypeModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < notificationtype.length; i++) {
        const element = notificationtype[i];
        await notificationtypeModel.updateAll({
          id: element.id
        }, {
          createdby: '10e2931c-6e3e-4146-a1a1-b3d74a21d91f',
          modifiedby: '10e2931c-6e3e-4146-a1a1-b3d74a21d91f'
        });
      }

      console.log('notificationtype updated ');


      // orderstatus

      // get orderstatus
      orderstatusModel.attachTo(app.dataSources.mysqlsf);
      var orderstatus = await orderstatusModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('orderstatus ==== :', orderstatus.length);

      // add orderstatus
      // orderstatusModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < orderstatus.length; i++) {
        const element = orderstatus[i];
        await orderstatusModel.updateAll({
          id: element.id
        }, {
          createdby: '10e2931c-6e3e-4146-a1a1-b3d74a21d91f',
          modifiedby: '10e2931c-6e3e-4146-a1a1-b3d74a21d91f'
        });
      }

      console.log('orderstatus updated ');


      // product

      // get product
      productModel.attachTo(app.dataSources.mysqlsf);
      var product = await productModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('product ==== :', product.length);

      // add product
      // productModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < product.length; i++) {
        const element = product[i];
        await productModel.updateAll({
          id: element.id
        }, {
          createdby: '10e2931c-6e3e-4146-a1a1-b3d74a21d91f',
          modifiedby: '10e2931c-6e3e-4146-a1a1-b3d74a21d91f'
        });
      }

      console.log('product updated ');


      // productmedia

      // get productmedia
      productmediaModel.attachTo(app.dataSources.mysqlsf);
      var productmedia = await productmediaModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('productmedia ==== :', productmedia.length);

      // add productmedia
      // productmediaModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < productmedia.length; i++) {
        const element = productmedia[i];
        await productmediaModel.updateAll({
          id: element.id
        }, {
          createdby: '10e2931c-6e3e-4146-a1a1-b3d74a21d91f',
          modifiedby: '10e2931c-6e3e-4146-a1a1-b3d74a21d91f'
        });
      }

      console.log('productmedia updated ');



      // rolemapping - principalId

      // get rolemapping
      rolemappingModel.attachTo(app.dataSources.mysqlsf);
      var rolemapping = await rolemappingModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          principalId: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('rolemapping ==== :', rolemapping.length);

      // add rolemapping
      // rolemappingModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < rolemapping.length; i++) {
        const element = rolemapping[i];
        await rolemappingModel.updateAll({
          id: element.id
        }, {
          principalId: '10e2931c-6e3e-4146-a1a1-b3d74a21d91f'
        });
      }

      console.log('rolemapping updated ');


      // setting

      // get setting
      settingModel.attachTo(app.dataSources.mysqlsf);
      var setting = await settingModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('setting ==== :', setting.length);

      // add setting
      // settingModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < setting.length; i++) {
        const element = setting[i];
        await settingModel.updateAll({
          id: element.id
        }, {
          createdby: '10e2931c-6e3e-4146-a1a1-b3d74a21d91f',
          modifiedby: '10e2931c-6e3e-4146-a1a1-b3d74a21d91f'
        });
      }

      console.log('setting updated ');




      // user

      // get user
      userModel.attachTo(app.dataSources.mysqlsf);
      var user = await userModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('user ==== :', user.length);

      // add user
      // userModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < user.length; i++) {
        const element = user[i];
        await userModel.updateAll({
          id: element.id
        }, {
          createdby: '10e2931c-6e3e-4146-a1a1-b3d74a21d91f',
          modifiedby: '10e2931c-6e3e-4146-a1a1-b3d74a21d91f'
        });
      }

      console.log('user updated ');


      // usermetaauth

      // get usermetaauth
      usermetaauthModel.attachTo(app.dataSources.mysqlsf);
      var usermetaauth = await usermetaauthModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('usermetaauth ==== :', usermetaauth.length);

      // add usermetaauth
      // usermetaauthModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < usermetaauth.length; i++) {
        const element = usermetaauth[i];
        await usermetaauthModel.updateAll({
          id: element.id
        }, {
          createdby: '10e2931c-6e3e-4146-a1a1-b3d74a21d91f',
          modifiedby: '10e2931c-6e3e-4146-a1a1-b3d74a21d91f'
        });
      }

      console.log('usermetaauth updated ');
      console.log('Nextview : Change Admin Id - Done');

      // change default group id
      var string = "UPDATE `group` SET id = UUID() where name = 'Default';";
      console.log(string);
      var data = await new Promise((resolve, reject) => {
        app.datasources.mysqlsf.connector.execute(string, null, (err, result) => {
          if (err) reject(err);
          resolve(result);
        });
      });


      groupModel.attachTo(app.dataSources.mysqlsf);
      var groupDefault = await groupModel.findOne({
        where: {
          name: 'Default'
        }
      });

      console.log(groupDefault);

      // change group id in groupcategory table
      // get group category
      groupcategoryModel.attachTo(app.dataSources.mysqlsf);
      var groupcategory = await groupcategoryModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          groupId: 'b4a77eec-e686-4d16-839d-ffddb190b159'
        }
      });
      console.log('groupcategory ==== :', groupcategory.length);

      // add group category
      for (let i = 0; i < groupcategory.length; i++) {
        const element = groupcategory[i];
        await groupcategoryModel.updateAll({
          id: element.id
        }, {
          groupId: groupDefault.id
        });
      }

      console.log('groupcategory updated ');


      // change group id in groupprice table
      // get groupprice
      grouppriceModel.attachTo(app.dataSources.mysqlsf);
      var groupprice = await grouppriceModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          groupId: 'b4a77eec-e686-4d16-839d-ffddb190b159'
        }
      });
      console.log('groupprice ==== :', groupprice.length);

      // add groupprice
      for (let i = 0; i < groupprice.length; i++) {
        const element = groupprice[i];
        await grouppriceModel.updateAll({
          id: element.id
        }, {
          groupId: groupDefault.id
        });
      }

      console.log('groupprice updated ');

      // change group id in user table
      // get user
      userModel.attachTo(app.dataSources.mysqlsf);
      var user = await userModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          groupId: 'b4a77eec-e686-4d16-839d-ffddb190b159'
        }
      });
      console.log('user ==== :', user.length);

      // add user
      for (let i = 0; i < user.length; i++) {
        const element = user[i];
        await userModel.updateAll({
          id: element.id
        }, {
          groupId: groupDefault.id
        });
      }

      console.log('user updated ');

      // get city
      cityModel.attachTo(app.dataSources.mysqlsf);
      userModel.attachTo(app.dataSources.mysqlsf);
      salesmancityModel.attachTo(app.dataSources.mysqlsf);
      var cityIdChange = await cityModel.find({
        where: {
          deletedAt: {
            eq: null
          }
        }
      });
      console.log('city count :  ', cityIdChange.length);

      for (let i = 0; i < cityIdChange.length; i++) {
        const element = cityIdChange[i];

        var string = "UPDATE `city` SET id = UUID() where name = '" + element.name + "';";
        var data = await new Promise((resolve, reject) => {
          app.datasources.mysqlsf.connector.execute(string, null, (err, result) => {
            if (err) reject(err);
            resolve(result);
          });
        });

        var cityOne = await cityModel.findOne({
          where: {
            name: element.name
          }
        });


        await userModel.updateAll({
          cityId: element.id
        }, {
          cityId: cityOne.id
        });
        console.log('User city updated ');

        await salesmancityModel.updateAll({
          cityId: element.id
        }, {
          cityId: cityOne.id
        });
        console.log('salesman city updated ');

      }

      // chnage internal user's ID and related data
      userModel.attachTo(app.dataSources.mysqlsf);
      commoncounterModel.attachTo(app.dataSources.mysqlsf);
      inquiryModel.attachTo(app.dataSources.mysqlsf);
      notificationModel.attachTo(app.dataSources.mysqlsf);
      notificationreceiverModel.attachTo(app.dataSources.mysqlsf);
      orderModel.attachTo(app.dataSources.mysqlsf);
      orderdetailsModel.attachTo(app.dataSources.mysqlsf);
      rolemappingModel.attachTo(app.dataSources.mysqlsf);
      salesmancityModel.attachTo(app.dataSources.mysqlsf);
      shorturlModel.attachTo(app.dataSources.mysqlsf);
      usermetaauthModel.attachTo(app.dataSources.mysqlsf);

      var changeUsers = await userModel.find({
        where: {
          cellnumber: {
            inq: ['9726502809', '9665656464', '9228220042', '9054088413', '8401981510', '8401981588', '9537608322', '8320849409',
              '9313751388', '9909514307', '9998792646', '6352766480', '9067013598', '9426184837', '9712070814', '9712056809',
              '9067747041', '8200310991', '8452964844', '9428439526', '9818845455', '7621075934'
            ]
          }
        }
      });

      console.log('User : ', changeUsers.length);

      for (let i = 0; i < changeUsers.length; i++) {
        const element = changeUsers[i];
        var string = "UPDATE `user` SET id = UUID() where cellnumber = '" + element.cellnumber + "';";
        console.log(string);
        var data = await new Promise((resolve, reject) => {
          app.datasources.mysqlsf.connector.execute(string, null, (err, result) => {
            if (err) reject(err);
            resolve(result);
          });
        });

        var user = await userModel.findOne({
          where: {
            cellnumber: element.cellnumber
          }
        });

        console.log('user', user.id);


        await commoncounterModel.updateAll({
          userId: element.id
        }, {
          userId: user.id
        });
        console.log('commoncounterModel updated ');

        await inquiryModel.updateAll({
          assignedto: element.id
        }, {
          assignedto: user.id,
          createdby: user.id,
          userId: user.id
        });
        console.log('inquiryModel assignedto updated ');


        await notificationModel.updateAll({
          notificationreceiverId: element.id
        }, {
          notificationreceiverId: user.id,
          createdby: user.id
        });
        console.log('notificationModel notificationreceiverId updated ');


        await notificationreceiverModel.updateAll({
          userId: element.id
        }, {
          userId: user.id,
          createdby: user.id
        });
        console.log('notificationreceiverModel userId updated ');


        await orderModel.updateAll({
          userId: element.id
        }, {
          userId: user.id,
          createdby: user.id
        });
        console.log('orderModel updated ');

        await orderdetailsModel.updateAll({
          userId: element.id
        }, {
          createdby: user.id
        });
        console.log('orderModel updated ');

        await rolemappingModel.updateAll({
          principalId: element.id
        }, {
          principalId: user.id
        });
        console.log('rolemappingModel updated ');

        await salesmancityModel.updateAll({
          userId: element.id
        }, {
          userId: user.id
        });
        console.log('salesmancityModel updated ');

        await shorturlModel.updateAll({
          userId: element.id
        }, {
          userId: user.id
        });
        console.log('shorturlModel updated ');

        await usermetaauthModel.updateAll({
          userId: element.id
        }, {
          userId: user.id
        });
        console.log('usermetaauthModel updated ');


      }


      // language

      // get language
      languageModel.attachTo(app.dataSources.mysqlsf);
      var language = await languageModel.find({
        where: {
          deletedAt: {
            eq: null
          }
        }
      });
      console.log('language ==== :', language.length);

      // add language
      languageModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < language.length; i++) {
        const element = language[i];
        await languageModel.create({
          key: element.key,
          value: element.value,
          createdby: element.assignedto,
          modifiedby: element.industryId,
          created: element.created,
          modified: element.modified,
          masterdetailId: element.masterdetailId
        });
      }

      console.log('language updated ');




      // notificationType

      // get notificationType
      notificationtypeModel.attachTo(app.dataSources.mysqlsf);
      var notificationtype = await notificationtypeModel.find({
        where: {
          deletedAt: {
            eq: null
          }
        }
      });
      console.log('notificationtype ==== :', notificationtype.length);

      // add notificationType
      notificationtypeModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < notificationtype.length; i++) {
        const element = notificationtype[i];
        await notificationtypeModel.create({
          textmessage: element.textmessage,
          textmessage_html: element.textmessage_html,
          code: element.code,
          notification: element.notification,
          notificationId: element.notificationId,
          createdby: element.assignedto,
          modifiedby: element.industryId,
          created: element.created,
          modified: element.modified,
          masterdetailId: element.masterdetailId
        });
      }

      console.log('notificationtype updated ');



      // orderstatus

      // get orderstatus
      orderstatusModel.attachTo(app.dataSources.mysqlsf);
      var orderstatus = await orderstatusModel.find({
        where: {
          deletedAt: {
            eq: null
          }
        }
      });
      console.log('orderstatus ==== :', orderstatus.length);

      // add orderstatus
      orderstatusModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < orderstatus.length; i++) {
        const element = orderstatus[i];
        await orderstatusModel.create({
          status: element.status,
          createdby: element.createdby,
          modifiedby: element.modifiedby,
          created: element.created,
          modified: element.modified,
          masterdetailId: element.masterdetailId
        });
      }

      console.log('orderstatus updated ');



      // rolemapping

      // get rolemapping
      rolemappingModel.attachTo(app.dataSources.mysqlsf);
      var rolemapping = await rolemappingModel.find({
        where: {
          deletedAt: {
            eq: null
          }
        }
      });
      console.log('rolemapping ==== :', rolemapping.length);

      // add rolemapping
      rolemappingModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < rolemapping.length; i++) {
        const element = rolemapping[i];
        await rolemappingModel.create({
          principalType: element.principalType,
          principalId: element.principalId,
          roleId: element.roleId,
          masterdetailId: element.masterdetailId
        });
      }

      console.log('rolemapping updated ');



      // setting

      // get setting
      settingModel.attachTo(app.dataSources.mysqlsf);
      var setting = await settingModel.find({
        where: {
          deletedAt: {
            eq: null
          }
        }
      });
      console.log('setting ==== :', setting.length);

      // add setting
      settingModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < setting.length; i++) {
        const element = setting[i];
        await settingModel.create({
          registerallow: element.registerallow,
          status: element.status,
          text: element.text,
          createdby: element.createdby,
          modifiedby: element.modifiedby,
          created: element.created,
          modified: element.modified,
          masterdetailId: element.masterdetailId
        });
      }

      console.log('setting updated ');


      // source

      // get source
      sourceModel.attachTo(app.dataSources.mysqlsf);
      var source = await sourceModel.find({
        where: {
          deletedAt: {
            eq: null
          }
        }
      });
      console.log('source ==== :', source.length);

      // add source
      sourceModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < source.length; i++) {
        const element = source[i];
        await sourceModel.create({
          name: element.name,
          created: element.created,
          modified: element.modified,
          masterdetailId: element.masterdetailId
        });
      }

      console.log('source updated ');


      // state

      // get state
      stateModel.attachTo(app.dataSources.mysqlsf);
      var state = await stateModel.find({
        where: {
          deletedAt: {
            eq: null
          }
        }
      });
      console.log('state ==== :', state.length);

      // add state
      stateModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < state.length; i++) {
        const element = state[i];
        await stateModel.create({
          name: element.name,
          parentId: element.parentId,
          created: element.created,
          modified: element.modified,
          masterdetailId: element.masterdetailId
        });
      }

      console.log('state updated ');


      return true;

    } catch (error) {
      throw error;
    }

  };


  // Jewel
  Masterdetail.changeAdminIdJewel = async (req) => {

    var categoryModel = app.models.category;
    var categorymediaModel = app.models.categorymedia;
    var cityModel = app.models.city;
    var commoncounterModel = app.models.commoncounter;
    var groupModel = app.models.group;
    var languageModel = app.models.language;
    var notificationtypeModel = app.models.notificationtype;
    var orderstatusModel = app.models.orderstatus;
    var productModel = app.models.product;
    var productmediaModel = app.models.productmedia;
    var rolemappingModel = app.models.rolemapping;
    var settingModel = app.models.setting;
    var userModel = app.models.user;
    var usermetaauthModel = app.models.usermetaauth;
    var groupcategoryModel = app.models.groupcategory;
    var grouppriceModel = app.models.groupprice;
    var salesmancityModel = app.models.salesmancity;
    var inquiryModel = app.models.inquiry;
    var notificationModel = app.models.notification;
    var notificationreceiverModel = app.models.notificationreceiver;
    var orderModel = app.models.order;
    var orderdetailsModel = app.models.orderdetails;
    var shorturlModel = app.models.shorturl;
    var sourceModel = app.models.source;
    var stateModel = app.models.state;

    try {


      // Category

      // get category
      categoryModel.attachTo(app.dataSources.mysqlsf);
      var categories = await categoryModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('categories ==== :', categories.length);

      // add category
      // categoryModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < categories.length; i++) {
        const element = categories[i];
        await categoryModel.updateAll({
          id: element.id
        }, {
          createdby: 'e38e8c48-0788-44fd-bf47-64c2b7a0348e',
          modifiedby: 'e38e8c48-0788-44fd-bf47-64c2b7a0348e'
        });
      }

      console.log('categories updated ');


      // categorymedia

      // get categorymedia
      categorymediaModel.attachTo(app.dataSources.mysqlsf);
      var categorymedia = await categorymediaModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('categorymedia ==== :', categorymedia.length);

      // add categorymedia
      // categorymediaModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < categorymedia.length; i++) {
        const element = categorymedia[i];
        await categorymediaModel.updateAll({
          id: element.id
        }, {
          createdby: 'e38e8c48-0788-44fd-bf47-64c2b7a0348e',
          modifiedby: 'e38e8c48-0788-44fd-bf47-64c2b7a0348e'
        });
      }

      console.log('categorymedia updated ');



      // city

      // get city
      cityModel.attachTo(app.dataSources.mysqlsf);
      var city = await cityModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('city ==== :', city.length);

      // add city
      // cityModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < city.length; i++) {
        const element = city[i];
        await cityModel.updateAll({
          id: element.id
        }, {
          createdby: 'e38e8c48-0788-44fd-bf47-64c2b7a0348e',
          modifiedby: 'e38e8c48-0788-44fd-bf47-64c2b7a0348e'
        });
      }

      console.log('city updated ');



      // commoncounter

      // get commoncounter
      commoncounterModel.attachTo(app.dataSources.mysqlsf);
      var commoncounter = await commoncounterModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('commoncounter ==== :', commoncounter.length);

      // add commoncounter
      // commoncounterModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < commoncounter.length; i++) {
        const element = commoncounter[i];
        await commoncounterModel.updateAll({
          id: element.id
        }, {
          createdby: 'e38e8c48-0788-44fd-bf47-64c2b7a0348e',
          modifiedby: 'e38e8c48-0788-44fd-bf47-64c2b7a0348e'
        });
      }

      console.log('commoncounter updated ');




      // group

      // get group
      groupModel.attachTo(app.dataSources.mysqlsf);
      var group = await groupModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('group ==== :', group.length);

      // add group
      // groupModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < group.length; i++) {
        const element = group[i];
        await groupModel.updateAll({
          id: element.id
        }, {
          createdby: 'e38e8c48-0788-44fd-bf47-64c2b7a0348e',
          modifiedby: 'e38e8c48-0788-44fd-bf47-64c2b7a0348e'
        });
      }

      console.log('group updated ');



      // language

      // get language
      languageModel.attachTo(app.dataSources.mysqlsf);
      var language = await languageModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('language ==== :', language.length);

      // add language
      // languageModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < language.length; i++) {
        const element = language[i];
        await languageModel.updateAll({
          id: element.id
        }, {
          createdby: 'e38e8c48-0788-44fd-bf47-64c2b7a0348e',
          modifiedby: 'e38e8c48-0788-44fd-bf47-64c2b7a0348e'
        });
      }

      console.log('language updated ');



      // notificationtype

      // get notificationtype
      notificationtypeModel.attachTo(app.dataSources.mysqlsf);
      var notificationtype = await notificationtypeModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('notificationtype ==== :', notificationtype.length);

      // add notificationtype
      // notificationtypeModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < notificationtype.length; i++) {
        const element = notificationtype[i];
        await notificationtypeModel.updateAll({
          id: element.id
        }, {
          createdby: 'e38e8c48-0788-44fd-bf47-64c2b7a0348e',
          modifiedby: 'e38e8c48-0788-44fd-bf47-64c2b7a0348e'
        });
      }

      console.log('notificationtype updated ');


      // orderstatus

      // get orderstatus
      orderstatusModel.attachTo(app.dataSources.mysqlsf);
      var orderstatus = await orderstatusModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('orderstatus ==== :', orderstatus.length);

      // add orderstatus
      // orderstatusModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < orderstatus.length; i++) {
        const element = orderstatus[i];
        await orderstatusModel.updateAll({
          id: element.id
        }, {
          createdby: 'e38e8c48-0788-44fd-bf47-64c2b7a0348e',
          modifiedby: 'e38e8c48-0788-44fd-bf47-64c2b7a0348e'
        });
      }

      console.log('orderstatus updated ');


      // product

      // get product
      productModel.attachTo(app.dataSources.mysqlsf);
      var product = await productModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('product ==== :', product.length);

      // add product
      // productModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < product.length; i++) {
        const element = product[i];
        await productModel.updateAll({
          id: element.id
        }, {
          createdby: 'e38e8c48-0788-44fd-bf47-64c2b7a0348e',
          modifiedby: 'e38e8c48-0788-44fd-bf47-64c2b7a0348e'
        });
      }

      console.log('product updated ');


      // productmedia

      // get productmedia
      productmediaModel.attachTo(app.dataSources.mysqlsf);
      var productmedia = await productmediaModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('productmedia ==== :', productmedia.length);

      // add productmedia
      // productmediaModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < productmedia.length; i++) {
        const element = productmedia[i];
        await productmediaModel.updateAll({
          id: element.id
        }, {
          createdby: 'e38e8c48-0788-44fd-bf47-64c2b7a0348e',
          modifiedby: 'e38e8c48-0788-44fd-bf47-64c2b7a0348e'
        });
      }

      console.log('productmedia updated ');



      // rolemapping - principalId

      // get rolemapping
      rolemappingModel.attachTo(app.dataSources.mysqlsf);
      var rolemapping = await rolemappingModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          principalId: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('rolemapping ==== :', rolemapping.length);

      // add rolemapping
      // rolemappingModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < rolemapping.length; i++) {
        const element = rolemapping[i];
        await rolemappingModel.updateAll({
          id: element.id
        }, {
          principalId: 'e38e8c48-0788-44fd-bf47-64c2b7a0348e'
        });
      }

      console.log('rolemapping updated ');


      // setting

      // get setting
      settingModel.attachTo(app.dataSources.mysqlsf);
      var setting = await settingModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('setting ==== :', setting.length);

      // add setting
      // settingModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < setting.length; i++) {
        const element = setting[i];
        await settingModel.updateAll({
          id: element.id
        }, {
          createdby: 'e38e8c48-0788-44fd-bf47-64c2b7a0348e',
          modifiedby: 'e38e8c48-0788-44fd-bf47-64c2b7a0348e'
        });
      }

      console.log('setting updated ');




      // user

      // get user
      userModel.attachTo(app.dataSources.mysqlsf);
      var user = await userModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('user ==== :', user.length);

      // add user
      // userModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < user.length; i++) {
        const element = user[i];
        await userModel.updateAll({
          id: element.id
        }, {
          createdby: 'e38e8c48-0788-44fd-bf47-64c2b7a0348e',
          modifiedby: 'e38e8c48-0788-44fd-bf47-64c2b7a0348e'
        });
      }

      console.log('user updated ');


      // usermetaauth

      // get usermetaauth
      usermetaauthModel.attachTo(app.dataSources.mysqlsf);
      var usermetaauth = await usermetaauthModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('usermetaauth ==== :', usermetaauth.length);

      // add usermetaauth
      // usermetaauthModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < usermetaauth.length; i++) {
        const element = usermetaauth[i];
        await usermetaauthModel.updateAll({
          id: element.id
        }, {
          createdby: 'e38e8c48-0788-44fd-bf47-64c2b7a0348e',
          modifiedby: 'e38e8c48-0788-44fd-bf47-64c2b7a0348e'
        });
      }

      console.log('usermetaauth updated ');
      console.log('Jewel : Change Admin Id - Done');

      // change default group id
      var string = "UPDATE `group` SET id = UUID() where name = 'Default';";
      console.log(string);
      var data = await new Promise((resolve, reject) => {
        app.datasources.mysqlsf.connector.execute(string, null, (err, result) => {
          if (err) reject(err);
          resolve(result);
        });
      });


      groupModel.attachTo(app.dataSources.mysqlsf);
      var groupDefault = await groupModel.findOne({
        where: {
          name: 'Default'
        }
      });

      console.log(groupDefault);

      // change group id in groupcategory table
      // get group category
      groupcategoryModel.attachTo(app.dataSources.mysqlsf);
      var groupcategory = await groupcategoryModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          groupId: 'b4a77eec-e686-4d16-839d-ffddb190b159'
        }
      });
      console.log('groupcategory ==== :', groupcategory.length);

      // add group category
      for (let i = 0; i < groupcategory.length; i++) {
        const element = groupcategory[i];
        await groupcategoryModel.updateAll({
          id: element.id
        }, {
          groupId: groupDefault.id
        });
      }

      console.log('groupcategory updated ');


      // change group id in groupprice table
      // get groupprice
      grouppriceModel.attachTo(app.dataSources.mysqlsf);
      var groupprice = await grouppriceModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          groupId: 'b4a77eec-e686-4d16-839d-ffddb190b159'
        }
      });
      console.log('groupprice ==== :', groupprice.length);

      // add groupprice
      for (let i = 0; i < groupprice.length; i++) {
        const element = groupprice[i];
        await grouppriceModel.updateAll({
          id: element.id
        }, {
          groupId: groupDefault.id
        });
      }

      console.log('groupprice updated ');

      // change group id in user table
      // get user
      userModel.attachTo(app.dataSources.mysqlsf);
      var user = await userModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          groupId: 'b4a77eec-e686-4d16-839d-ffddb190b159'
        }
      });
      console.log('user ==== :', user.length);

      // add user
      for (let i = 0; i < user.length; i++) {
        const element = user[i];
        await userModel.updateAll({
          id: element.id
        }, {
          groupId: groupDefault.id
        });
      }

      console.log('user updated ');


      // get city
      cityModel.attachTo(app.dataSources.mysqlsf);
      userModel.attachTo(app.dataSources.mysqlsf);
      salesmancityModel.attachTo(app.dataSources.mysqlsf);
      var cityIdChange = await cityModel.find({
        where: {
          deletedAt: {
            eq: null
          }
        }
      });
      console.log('city count :  ', cityIdChange.length);

      for (let i = 0; i < cityIdChange.length; i++) {
        const element = cityIdChange[i];

        var string = "UPDATE `city` SET id = UUID() where name = '" + element.name + "';";
        var data = await new Promise((resolve, reject) => {
          app.datasources.mysqlsf.connector.execute(string, null, (err, result) => {
            if (err) reject(err);
            resolve(result);
          });
        });

        var cityOne = await cityModel.findOne({
          where: {
            name: element.name
          }
        });


        await userModel.updateAll({
          cityId: element.id
        }, {
          cityId: cityOne.id
        });
        console.log('User city updated ');

        await salesmancityModel.updateAll({
          cityId: element.id
        }, {
          cityId: cityOne.id
        });
        console.log('salesman city updated ');

      }

      // chnage internal user's ID and related data
      userModel.attachTo(app.dataSources.mysqlsf);
      commoncounterModel.attachTo(app.dataSources.mysqlsf);
      inquiryModel.attachTo(app.dataSources.mysqlsf);
      notificationModel.attachTo(app.dataSources.mysqlsf);
      notificationreceiverModel.attachTo(app.dataSources.mysqlsf);
      orderModel.attachTo(app.dataSources.mysqlsf);
      orderdetailsModel.attachTo(app.dataSources.mysqlsf);
      rolemappingModel.attachTo(app.dataSources.mysqlsf);
      salesmancityModel.attachTo(app.dataSources.mysqlsf);
      shorturlModel.attachTo(app.dataSources.mysqlsf);
      usermetaauthModel.attachTo(app.dataSources.mysqlsf);

      var changeUsers = await userModel.find({
        where: {
          cellnumber: {
            inq: ['9726502809', '9665656464', '9228220042', '9054088413', '8401981510', '8401981588', '9537608322', '8320849409',
              '9313751388', '9909514307', '9998792646', '6352766480', '9067013598', '9426184837', '9712070814', '9712056809',
              '9067747041', '8200310991', '8452964844', '9428439526', '9818845455', '7621075934'
            ]
          }
        }
      });

      console.log('User : ', changeUsers.length);

      for (let i = 0; i < changeUsers.length; i++) {
        const element = changeUsers[i];
        var string = "UPDATE `user` SET id = UUID() where cellnumber = '" + element.cellnumber + "';";
        console.log(string);
        var data = await new Promise((resolve, reject) => {
          app.datasources.mysqlsf.connector.execute(string, null, (err, result) => {
            if (err) reject(err);
            resolve(result);
          });
        });

        var user = await userModel.findOne({
          where: {
            cellnumber: element.cellnumber
          }
        });

        console.log('user', user.id);


        await commoncounterModel.updateAll({
          userId: element.id
        }, {
          userId: user.id
        });
        console.log('commoncounterModel updated ');

        await inquiryModel.updateAll({
          assignedto: element.id
        }, {
          assignedto: user.id,
          createdby: user.id,
          userId: user.id
        });
        console.log('inquiryModel assignedto updated ');


        await notificationModel.updateAll({
          notificationreceiverId: element.id
        }, {
          notificationreceiverId: user.id,
          createdby: user.id
        });
        console.log('notificationModel notificationreceiverId updated ');


        await notificationreceiverModel.updateAll({
          userId: element.id
        }, {
          userId: user.id,
          createdby: user.id
        });
        console.log('notificationreceiverModel userId updated ');


        await orderModel.updateAll({
          userId: element.id
        }, {
          userId: user.id,
          createdby: user.id
        });
        console.log('orderModel updated ');

        await orderdetailsModel.updateAll({
          userId: element.id
        }, {
          createdby: user.id
        });
        console.log('orderModel updated ');

        await rolemappingModel.updateAll({
          principalId: element.id
        }, {
          principalId: user.id
        });
        console.log('rolemappingModel updated ');

        await salesmancityModel.updateAll({
          userId: element.id
        }, {
          userId: user.id
        });
        console.log('salesmancityModel updated ');

        await shorturlModel.updateAll({
          userId: element.id
        }, {
          userId: user.id
        });
        console.log('shorturlModel updated ');

        await usermetaauthModel.updateAll({
          userId: element.id
        }, {
          userId: user.id
        });
        console.log('usermetaauthModel updated ');


      }

      // language

      // get language
      languageModel.attachTo(app.dataSources.mysqlsf);
      var language = await languageModel.find({
        where: {
          deletedAt: {
            eq: null
          }
        }
      });
      console.log('language ==== :', language.length);

      // add language
      languageModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < language.length; i++) {
        const element = language[i];
        await languageModel.create({
          key: element.key,
          value: element.value,
          createdby: element.assignedto,
          modifiedby: element.industryId,
          created: element.created,
          modified: element.modified,
          masterdetailId: element.masterdetailId
        });
      }

      console.log('language updated ');




      // notificationType

      // get notificationType
      notificationtypeModel.attachTo(app.dataSources.mysqlsf);
      var notificationtype = await notificationtypeModel.find({
        where: {
          deletedAt: {
            eq: null
          }
        }
      });
      console.log('notificationtype ==== :', notificationtype.length);

      // add notificationType
      notificationtypeModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < notificationtype.length; i++) {
        const element = notificationtype[i];
        await notificationtypeModel.create({
          textmessage: element.textmessage,
          textmessage_html: element.textmessage_html,
          code: element.code,
          notification: element.notification,
          notificationId: element.notificationId,
          createdby: element.assignedto,
          modifiedby: element.industryId,
          created: element.created,
          modified: element.modified,
          masterdetailId: element.masterdetailId
        });
      }

      console.log('notificationtype updated ');



      // orderstatus

      // get orderstatus
      orderstatusModel.attachTo(app.dataSources.mysqlsf);
      var orderstatus = await orderstatusModel.find({
        where: {
          deletedAt: {
            eq: null
          }
        }
      });
      console.log('orderstatus ==== :', orderstatus.length);

      // add orderstatus
      orderstatusModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < orderstatus.length; i++) {
        const element = orderstatus[i];
        await orderstatusModel.create({
          status: element.status,
          createdby: element.createdby,
          modifiedby: element.modifiedby,
          created: element.created,
          modified: element.modified,
          masterdetailId: element.masterdetailId
        });
      }

      console.log('orderstatus updated ');



      // rolemapping

      // get rolemapping
      rolemappingModel.attachTo(app.dataSources.mysqlsf);
      var rolemapping = await rolemappingModel.find({
        where: {
          deletedAt: {
            eq: null
          }
        }
      });
      console.log('rolemapping ==== :', rolemapping.length);

      // add rolemapping
      rolemappingModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < rolemapping.length; i++) {
        const element = rolemapping[i];
        await rolemappingModel.create({
          principalType: element.principalType,
          principalId: element.principalId,
          roleId: element.roleId,
          masterdetailId: element.masterdetailId
        });
      }

      console.log('rolemapping updated ');



      // setting

      // get setting
      settingModel.attachTo(app.dataSources.mysqlsf);
      var setting = await settingModel.find({
        where: {
          deletedAt: {
            eq: null
          }
        }
      });
      console.log('setting ==== :', setting.length);

      // add setting
      settingModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < setting.length; i++) {
        const element = setting[i];
        await settingModel.create({
          registerallow: element.registerallow,
          status: element.status,
          text: element.text,
          createdby: element.createdby,
          modifiedby: element.modifiedby,
          created: element.created,
          modified: element.modified,
          masterdetailId: element.masterdetailId
        });
      }

      console.log('setting updated ');


      // source

      // get source
      sourceModel.attachTo(app.dataSources.mysqlsf);
      var source = await sourceModel.find({
        where: {
          deletedAt: {
            eq: null
          }
        }
      });
      console.log('source ==== :', source.length);

      // add source
      sourceModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < source.length; i++) {
        const element = source[i];
        await sourceModel.create({
          name: element.name,
          created: element.created,
          modified: element.modified,
          masterdetailId: element.masterdetailId
        });
      }

      console.log('source updated ');


      // state

      // get state
      stateModel.attachTo(app.dataSources.mysqlsf);
      var state = await stateModel.find({
        where: {
          deletedAt: {
            eq: null
          }
        }
      });
      console.log('state ==== :', state.length);

      // add state
      stateModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < state.length; i++) {
        const element = state[i];
        await stateModel.create({
          name: element.name,
          parentId: element.parentId,
          created: element.created,
          modified: element.modified,
          masterdetailId: element.masterdetailId
        });
      }

      console.log('state updated ');


      return true;

    } catch (error) {
      throw error;
    }

  };


  // FMCG
  Masterdetail.changeAdminIdFMCG = async (req) => {

    var categoryModel = app.models.category;
    var categorymediaModel = app.models.categorymedia;
    var cityModel = app.models.city;
    var commoncounterModel = app.models.commoncounter;
    var groupModel = app.models.group;
    var languageModel = app.models.language;
    var notificationtypeModel = app.models.notificationtype;
    var orderstatusModel = app.models.orderstatus;
    var productModel = app.models.product;
    var productmediaModel = app.models.productmedia;
    var rolemappingModel = app.models.rolemapping;
    var settingModel = app.models.setting;
    var userModel = app.models.user;
    var usermetaauthModel = app.models.usermetaauth;
    var groupcategoryModel = app.models.groupcategory;
    var grouppriceModel = app.models.groupprice;
    var salesmancityModel = app.models.salesmancity;
    var inquiryModel = app.models.inquiry;
    var notificationModel = app.models.notification;
    var notificationreceiverModel = app.models.notificationreceiver;
    var orderModel = app.models.order;
    var orderdetailsModel = app.models.orderdetails;
    var shorturlModel = app.models.shorturl;
    var sourceModel = app.models.source;
    var stateModel = app.models.state;

    try {


      // Category

      // get category
      categoryModel.attachTo(app.dataSources.mysqlsf);
      var categories = await categoryModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('categories ==== :', categories.length);

      // add category
      // categoryModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < categories.length; i++) {
        const element = categories[i];
        await categoryModel.updateAll({
          id: element.id
        }, {
          createdby: '54cf3866-8dcd-4eda-8a68-cb5df73dd337',
          modifiedby: '54cf3866-8dcd-4eda-8a68-cb5df73dd337'
        });
      }

      console.log('categories updated ');


      // categorymedia

      // get categorymedia
      categorymediaModel.attachTo(app.dataSources.mysqlsf);
      var categorymedia = await categorymediaModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('categorymedia ==== :', categorymedia.length);

      // add categorymedia
      // categorymediaModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < categorymedia.length; i++) {
        const element = categorymedia[i];
        await categorymediaModel.updateAll({
          id: element.id
        }, {
          createdby: '54cf3866-8dcd-4eda-8a68-cb5df73dd337',
          modifiedby: '54cf3866-8dcd-4eda-8a68-cb5df73dd337'
        });
      }

      console.log('categorymedia updated ');



      // city

      // get city
      cityModel.attachTo(app.dataSources.mysqlsf);
      var city = await cityModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('city ==== :', city.length);

      // add city
      // cityModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < city.length; i++) {
        const element = city[i];
        await cityModel.updateAll({
          id: element.id
        }, {
          createdby: '54cf3866-8dcd-4eda-8a68-cb5df73dd337',
          modifiedby: '54cf3866-8dcd-4eda-8a68-cb5df73dd337'
        });
      }

      console.log('city updated ');



      // commoncounter

      // get commoncounter
      commoncounterModel.attachTo(app.dataSources.mysqlsf);
      var commoncounter = await commoncounterModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('commoncounter ==== :', commoncounter.length);

      // add commoncounter
      // commoncounterModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < commoncounter.length; i++) {
        const element = commoncounter[i];
        await commoncounterModel.updateAll({
          id: element.id
        }, {
          createdby: '54cf3866-8dcd-4eda-8a68-cb5df73dd337',
          modifiedby: '54cf3866-8dcd-4eda-8a68-cb5df73dd337'
        });
      }

      console.log('commoncounter updated ');




      // group

      // get group
      groupModel.attachTo(app.dataSources.mysqlsf);
      var group = await groupModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('group ==== :', group.length);

      // add group
      // groupModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < group.length; i++) {
        const element = group[i];
        await groupModel.updateAll({
          id: element.id
        }, {
          createdby: '54cf3866-8dcd-4eda-8a68-cb5df73dd337',
          modifiedby: '54cf3866-8dcd-4eda-8a68-cb5df73dd337'
        });
      }

      console.log('group updated ');



      // language

      // get language
      languageModel.attachTo(app.dataSources.mysqlsf);
      var language = await languageModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('language ==== :', language.length);

      // add language
      // languageModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < language.length; i++) {
        const element = language[i];
        await languageModel.updateAll({
          id: element.id
        }, {
          createdby: '54cf3866-8dcd-4eda-8a68-cb5df73dd337',
          modifiedby: '54cf3866-8dcd-4eda-8a68-cb5df73dd337'
        });
      }

      console.log('language updated ');



      // notificationtype

      // get notificationtype
      notificationtypeModel.attachTo(app.dataSources.mysqlsf);
      var notificationtype = await notificationtypeModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('notificationtype ==== :', notificationtype.length);

      // add notificationtype
      // notificationtypeModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < notificationtype.length; i++) {
        const element = notificationtype[i];
        await notificationtypeModel.updateAll({
          id: element.id
        }, {
          createdby: '54cf3866-8dcd-4eda-8a68-cb5df73dd337',
          modifiedby: '54cf3866-8dcd-4eda-8a68-cb5df73dd337'
        });
      }

      console.log('notificationtype updated ');


      // orderstatus

      // get orderstatus
      orderstatusModel.attachTo(app.dataSources.mysqlsf);
      var orderstatus = await orderstatusModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('orderstatus ==== :', orderstatus.length);

      // add orderstatus
      // orderstatusModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < orderstatus.length; i++) {
        const element = orderstatus[i];
        await orderstatusModel.updateAll({
          id: element.id
        }, {
          createdby: '54cf3866-8dcd-4eda-8a68-cb5df73dd337',
          modifiedby: '54cf3866-8dcd-4eda-8a68-cb5df73dd337'
        });
      }

      console.log('orderstatus updated ');


      // product

      // get product
      productModel.attachTo(app.dataSources.mysqlsf);
      var product = await productModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('product ==== :', product.length);

      // add product
      // productModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < product.length; i++) {
        const element = product[i];
        await productModel.updateAll({
          id: element.id
        }, {
          createdby: '54cf3866-8dcd-4eda-8a68-cb5df73dd337',
          modifiedby: '54cf3866-8dcd-4eda-8a68-cb5df73dd337'
        });
      }

      console.log('product updated ');


      // productmedia

      // get productmedia
      productmediaModel.attachTo(app.dataSources.mysqlsf);
      var productmedia = await productmediaModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('productmedia ==== :', productmedia.length);

      // add productmedia
      // productmediaModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < productmedia.length; i++) {
        const element = productmedia[i];
        await productmediaModel.updateAll({
          id: element.id
        }, {
          createdby: '54cf3866-8dcd-4eda-8a68-cb5df73dd337',
          modifiedby: '54cf3866-8dcd-4eda-8a68-cb5df73dd337'
        });
      }

      console.log('productmedia updated ');



      // rolemapping - principalId

      // get rolemapping
      rolemappingModel.attachTo(app.dataSources.mysqlsf);
      var rolemapping = await rolemappingModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          principalId: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('rolemapping ==== :', rolemapping.length);

      // add rolemapping
      // rolemappingModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < rolemapping.length; i++) {
        const element = rolemapping[i];
        await rolemappingModel.updateAll({
          id: element.id
        }, {
          principalId: '54cf3866-8dcd-4eda-8a68-cb5df73dd337'
        });
      }

      console.log('rolemapping updated ');


      // setting

      // get setting
      settingModel.attachTo(app.dataSources.mysqlsf);
      var setting = await settingModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('productmedia ==== :', productmedia.length);

      // add productmedia
      // productmediaModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < productmedia.length; i++) {
        const element = productmedia[i];
        await productmediaModel.updateAll({
          id: element.id
        }, {
          createdby: '54cf3866-8dcd-4eda-8a68-cb5df73dd337',
          modifiedby: '54cf3866-8dcd-4eda-8a68-cb5df73dd337'
        });
      }

      console.log('productmedia updated ');



      // rolemapping - principalId

      // get rolemapping
      rolemappingModel.attachTo(app.dataSources.mysqlsf);
      var rolemapping = await rolemappingModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          principalId: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('rolemapping ==== :', rolemapping.length);

      // add rolemapping
      // rolemappingModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < rolemapping.length; i++) {
        const element = rolemapping[i];
        await rolemappingModel.updateAll({
          id: element.id
        }, {
          principalId: '54cf3866-8dcd-4eda-8a68-cb5df73dd337'
        });
      }

      console.log('rolemapping updated ');


      // setting

      // get setting
      settingModel.attachTo(app.dataSources.mysqlsf);
      var setting = await settingModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('setting ==== :', setting.length);

      // add setting
      // settingModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < setting.length; i++) {
        const element = setting[i];
        await settingModel.updateAll({
          id: element.id
        }, {
          createdby: '54cf3866-8dcd-4eda-8a68-cb5df73dd337',
          modifiedby: '54cf3866-8dcd-4eda-8a68-cb5df73dd337'
        });
      }

      console.log('setting updated ');




      // user

      // get user
      userModel.attachTo(app.dataSources.mysqlsf);
      var user = await userModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('user ==== :', user.length);

      // add user
      // userModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < user.length; i++) {
        const element = user[i];
        await userModel.updateAll({
          id: element.id
        }, {
          createdby: '54cf3866-8dcd-4eda-8a68-cb5df73dd337',
          modifiedby: '54cf3866-8dcd-4eda-8a68-cb5df73dd337'
        });
      }

      console.log('user updated ');


      // usermetaauth

      // get usermetaauth
      usermetaauthModel.attachTo(app.dataSources.mysqlsf);
      var usermetaauth = await usermetaauthModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('usermetaauth ==== :', usermetaauth.length);

      // add usermetaauth
      // usermetaauthModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < usermetaauth.length; i++) {
        const element = usermetaauth[i];
        await usermetaauthModel.updateAll({
          id: element.id
        }, {
          createdby: '54cf3866-8dcd-4eda-8a68-cb5df73dd337',
          modifiedby: '54cf3866-8dcd-4eda-8a68-cb5df73dd337'
        });
      }

      console.log('usermetaauth updated ');
      console.log('FMCG : Change Admin Id - Done');


      // change default group id
      var string = "UPDATE `group` SET id = UUID() where name = 'Default';";
      console.log(string);
      var data = await new Promise((resolve, reject) => {
        app.datasources.mysqlsf.connector.execute(string, null, (err, result) => {
          if (err) reject(err);
          resolve(result);
        });
      });


      groupModel.attachTo(app.dataSources.mysqlsf);
      var groupDefault = await groupModel.findOne({
        where: {
          name: 'Default'
        }
      });

      console.log(groupDefault);

      // change group id in groupcategory table
      // get group category
      groupcategoryModel.attachTo(app.dataSources.mysqlsf);
      var groupcategory = await groupcategoryModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          groupId: 'b4a77eec-e686-4d16-839d-ffddb190b159'
        }
      });
      console.log('groupcategory ==== :', groupcategory.length);

      // add group category
      for (let i = 0; i < groupcategory.length; i++) {
        const element = groupcategory[i];
        await groupcategoryModel.updateAll({
          id: element.id
        }, {
          groupId: groupDefault.id
        });
      }

      console.log('groupcategory updated ');


      // change group id in groupprice table
      // get groupprice
      grouppriceModel.attachTo(app.dataSources.mysqlsf);
      var groupprice = await grouppriceModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          groupId: 'b4a77eec-e686-4d16-839d-ffddb190b159'
        }
      });
      console.log('groupprice ==== :', groupprice.length);

      // add groupprice
      for (let i = 0; i < groupprice.length; i++) {
        const element = groupprice[i];
        await grouppriceModel.updateAll({
          id: element.id
        }, {
          groupId: groupDefault.id
        });
      }

      console.log('groupprice updated ');

      // change group id in user table
      // get user
      userModel.attachTo(app.dataSources.mysqlsf);
      var user = await userModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          groupId: 'b4a77eec-e686-4d16-839d-ffddb190b159'
        }
      });
      console.log('user ==== :', user.length);

      // add user
      for (let i = 0; i < user.length; i++) {
        const element = user[i];
        await userModel.updateAll({
          id: element.id
        }, {
          groupId: groupDefault.id
        });
      }

      console.log('user updated ');


      // get city
      cityModel.attachTo(app.dataSources.mysqlsf);
      userModel.attachTo(app.dataSources.mysqlsf);
      salesmancityModel.attachTo(app.dataSources.mysqlsf);
      var cityIdChange = await cityModel.find({
        where: {
          deletedAt: {
            eq: null
          }
        }
      });
      console.log('city count :  ', cityIdChange.length);

      for (let i = 0; i < cityIdChange.length; i++) {
        const element = cityIdChange[i];

        var string = "UPDATE `city` SET id = UUID() where name = '" + element.name + "';";
        var data = await new Promise((resolve, reject) => {
          app.datasources.mysqlsf.connector.execute(string, null, (err, result) => {
            if (err) reject(err);
            resolve(result);
          });
        });

        var cityOne = await cityModel.findOne({
          where: {
            name: element.name
          }
        });


        await userModel.updateAll({
          cityId: element.id
        }, {
          cityId: cityOne.id
        });
        console.log('User city updated ');

        await salesmancityModel.updateAll({
          cityId: element.id
        }, {
          cityId: cityOne.id
        });
        console.log('salesman city updated ');

      }

      // chnage internal user's ID and related data
      userModel.attachTo(app.dataSources.mysqlsf);
      commoncounterModel.attachTo(app.dataSources.mysqlsf);
      inquiryModel.attachTo(app.dataSources.mysqlsf);
      notificationModel.attachTo(app.dataSources.mysqlsf);
      notificationreceiverModel.attachTo(app.dataSources.mysqlsf);
      orderModel.attachTo(app.dataSources.mysqlsf);
      orderdetailsModel.attachTo(app.dataSources.mysqlsf);
      rolemappingModel.attachTo(app.dataSources.mysqlsf);
      salesmancityModel.attachTo(app.dataSources.mysqlsf);
      shorturlModel.attachTo(app.dataSources.mysqlsf);
      usermetaauthModel.attachTo(app.dataSources.mysqlsf);

      var changeUsers = await userModel.find({
        where: {
          cellnumber: {
            inq: ['9726502809', '9665656464', '9228220042', '9054088413', '8401981510', '8401981588', '9537608322', '8320849409',
              '9313751388', '9909514307', '9998792646', '6352766480', '9067013598', '9426184837', '9712070814', '9712056809',
              '9067747041', '8200310991', '8452964844', '9428439526', '9818845455', '7621075934'
            ]
          }
        }
      });

      console.log('User : ', changeUsers.length);

      for (let i = 0; i < changeUsers.length; i++) {
        const element = changeUsers[i];
        var string = "UPDATE `user` SET id = UUID() where cellnumber = '" + element.cellnumber + "';";
        console.log(string);
        var data = await new Promise((resolve, reject) => {
          app.datasources.mysqlsf.connector.execute(string, null, (err, result) => {
            if (err) reject(err);
            resolve(result);
          });
        });

        var user = await userModel.findOne({
          where: {
            cellnumber: element.cellnumber
          }
        });

        console.log('user', user.id);


        await commoncounterModel.updateAll({
          userId: element.id
        }, {
          userId: user.id
        });
        console.log('commoncounterModel updated ');

        await inquiryModel.updateAll({
          assignedto: element.id
        }, {
          assignedto: user.id,
          createdby: user.id,
          userId: user.id
        });
        console.log('inquiryModel assignedto updated ');


        await notificationModel.updateAll({
          notificationreceiverId: element.id
        }, {
          notificationreceiverId: user.id,
          createdby: user.id
        });
        console.log('notificationModel notificationreceiverId updated ');


        await notificationreceiverModel.updateAll({
          userId: element.id
        }, {
          userId: user.id,
          createdby: user.id
        });
        console.log('notificationreceiverModel userId updated ');


        await orderModel.updateAll({
          userId: element.id
        }, {
          userId: user.id,
          createdby: user.id
        });
        console.log('orderModel updated ');

        await orderdetailsModel.updateAll({
          userId: element.id
        }, {
          createdby: user.id
        });
        console.log('orderModel updated ');

        await rolemappingModel.updateAll({
          principalId: element.id
        }, {
          principalId: user.id
        });
        console.log('rolemappingModel updated ');

        await salesmancityModel.updateAll({
          userId: element.id
        }, {
          userId: user.id
        });
        console.log('salesmancityModel updated ');

        await shorturlModel.updateAll({
          userId: element.id
        }, {
          userId: user.id
        });
        console.log('shorturlModel updated ');

        await usermetaauthModel.updateAll({
          userId: element.id
        }, {
          userId: user.id
        });
        console.log('usermetaauthModel updated ');


      }

      // language

      // get language
      languageModel.attachTo(app.dataSources.mysqlsf);
      var language = await languageModel.find({
        where: {
          deletedAt: {
            eq: null
          }
        }
      });
      console.log('language ==== :', language.length);

      // add language
      languageModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < language.length; i++) {
        const element = language[i];
        await languageModel.create({
          key: element.key,
          value: element.value,
          createdby: element.assignedto,
          modifiedby: element.industryId,
          created: element.created,
          modified: element.modified,
          masterdetailId: element.masterdetailId
        });
      }

      console.log('language updated ');




      // notificationType

      // get notificationType
      notificationtypeModel.attachTo(app.dataSources.mysqlsf);
      var notificationtype = await notificationtypeModel.find({
        where: {
          deletedAt: {
            eq: null
          }
        }
      });
      console.log('notificationtype ==== :', notificationtype.length);

      // add notificationType
      notificationtypeModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < notificationtype.length; i++) {
        const element = notificationtype[i];
        await notificationtypeModel.create({
          textmessage: element.textmessage,
          textmessage_html: element.textmessage_html,
          code: element.code,
          notification: element.notification,
          notificationId: element.notificationId,
          createdby: element.assignedto,
          modifiedby: element.industryId,
          created: element.created,
          modified: element.modified,
          masterdetailId: element.masterdetailId
        });
      }

      console.log('notificationtype updated ');



      // orderstatus

      // get orderstatus
      orderstatusModel.attachTo(app.dataSources.mysqlsf);
      var orderstatus = await orderstatusModel.find({
        where: {
          deletedAt: {
            eq: null
          }
        }
      });
      console.log('orderstatus ==== :', orderstatus.length);

      // add orderstatus
      orderstatusModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < orderstatus.length; i++) {
        const element = orderstatus[i];
        await orderstatusModel.create({
          status: element.status,
          createdby: element.createdby,
          modifiedby: element.modifiedby,
          created: element.created,
          modified: element.modified,
          masterdetailId: element.masterdetailId
        });
      }

      console.log('orderstatus updated ');



      // rolemapping

      // get rolemapping
      rolemappingModel.attachTo(app.dataSources.mysqlsf);
      var rolemapping = await rolemappingModel.find({
        where: {
          deletedAt: {
            eq: null
          }
        }
      });
      console.log('rolemapping ==== :', rolemapping.length);

      // add rolemapping
      rolemappingModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < rolemapping.length; i++) {
        const element = rolemapping[i];
        await rolemappingModel.create({
          principalType: element.principalType,
          principalId: element.principalId,
          roleId: element.roleId,
          masterdetailId: element.masterdetailId
        });
      }

      console.log('rolemapping updated ');



      // setting

      // get setting
      settingModel.attachTo(app.dataSources.mysqlsf);
      var setting = await settingModel.find({
        where: {
          deletedAt: {
            eq: null
          }
        }
      });
      console.log('setting ==== :', setting.length);

      // add setting
      settingModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < setting.length; i++) {
        const element = setting[i];
        await settingModel.create({
          registerallow: element.registerallow,
          status: element.status,
          text: element.text,
          createdby: element.createdby,
          modifiedby: element.modifiedby,
          created: element.created,
          modified: element.modified,
          masterdetailId: element.masterdetailId
        });
      }

      console.log('setting updated ');


      // source

      // get source
      sourceModel.attachTo(app.dataSources.mysqlsf);
      var source = await sourceModel.find({
        where: {
          deletedAt: {
            eq: null
          }
        }
      });
      console.log('source ==== :', source.length);

      // add source
      sourceModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < source.length; i++) {
        const element = source[i];
        await sourceModel.create({
          name: element.name,
          created: element.created,
          modified: element.modified,
          masterdetailId: element.masterdetailId
        });
      }

      console.log('source updated ');


      // state

      // get state
      stateModel.attachTo(app.dataSources.mysqlsf);
      var state = await stateModel.find({
        where: {
          deletedAt: {
            eq: null
          }
        }
      });
      console.log('state ==== :', state.length);

      // add state
      stateModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < state.length; i++) {
        const element = state[i];
        await stateModel.create({
          name: element.name,
          parentId: element.parentId,
          created: element.created,
          modified: element.modified,
          masterdetailId: element.masterdetailId
        });
      }

      console.log('state updated ');

      return true;

    } catch (error) {
      throw error;
    }

  };


  // Electronics
  Masterdetail.changeAdminIdElectronic = async (req) => {

    var categoryModel = app.models.category;
    var categorymediaModel = app.models.categorymedia;
    var cityModel = app.models.city;
    var commoncounterModel = app.models.commoncounter;
    var groupModel = app.models.group;
    var languageModel = app.models.language;
    var notificationtypeModel = app.models.notificationtype;
    var orderstatusModel = app.models.orderstatus;
    var productModel = app.models.product;
    var productmediaModel = app.models.productmedia;
    var rolemappingModel = app.models.rolemapping;
    var settingModel = app.models.setting;
    var userModel = app.models.user;
    var usermetaauthModel = app.models.usermetaauth;
    var groupcategoryModel = app.models.groupcategory;
    var grouppriceModel = app.models.groupprice;
    var salesmancityModel = app.models.salesmancity;
    var inquiryModel = app.models.inquiry;
    var notificationModel = app.models.notification;
    var notificationreceiverModel = app.models.notificationreceiver;
    var orderModel = app.models.order;
    var orderdetailsModel = app.models.orderdetails;
    var shorturlModel = app.models.shorturl;
    var sourceModel = app.models.source;
    var stateModel = app.models.state;

    try {

      // Category

      // get category
      categoryModel.attachTo(app.dataSources.mysqlsf);
      var categories = await categoryModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('categories ==== :', categories.length);

      // add category
      // categoryModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < categories.length; i++) {
        const element = categories[i];
        await categoryModel.updateAll({
          id: element.id
        }, {
          createdby: '843843c9-e64a-49e6-8ca7-348f23a438e5',
          modifiedby: '843843c9-e64a-49e6-8ca7-348f23a438e5'
        });
      }

      console.log('categories updated ');


      // categorymedia

      // get categorymedia
      categorymediaModel.attachTo(app.dataSources.mysqlsf);
      var categorymedia = await categorymediaModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('categorymedia ==== :', categorymedia.length);

      // add categorymedia
      // categorymediaModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < categorymedia.length; i++) {
        const element = categorymedia[i];
        await categorymediaModel.updateAll({
          id: element.id
        }, {
          createdby: '843843c9-e64a-49e6-8ca7-348f23a438e5',
          modifiedby: '843843c9-e64a-49e6-8ca7-348f23a438e5'
        });
      }

      console.log('categorymedia updated ');



      // city

      // get city
      cityModel.attachTo(app.dataSources.mysqlsf);
      var city = await cityModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('city ==== :', city.length);

      // add city
      // cityModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < city.length; i++) {
        const element = city[i];
        await cityModel.updateAll({
          id: element.id
        }, {
          createdby: '843843c9-e64a-49e6-8ca7-348f23a438e5',
          modifiedby: '843843c9-e64a-49e6-8ca7-348f23a438e5'
        });
      }

      console.log('city updated ');



      // commoncounter

      // get commoncounter
      commoncounterModel.attachTo(app.dataSources.mysqlsf);
      var commoncounter = await commoncounterModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('commoncounter ==== :', commoncounter.length);

      // add commoncounter
      // commoncounterModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < commoncounter.length; i++) {
        const element = commoncounter[i];
        await commoncounterModel.updateAll({
          id: element.id
        }, {
          createdby: '843843c9-e64a-49e6-8ca7-348f23a438e5',
          modifiedby: '843843c9-e64a-49e6-8ca7-348f23a438e5'
        });
      }

      console.log('commoncounter updated ');




      // group

      // get group
      groupModel.attachTo(app.dataSources.mysqlsf);
      var group = await groupModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('group ==== :', group.length);

      // add group
      // groupModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < group.length; i++) {
        const element = group[i];
        await groupModel.updateAll({
          id: element.id
        }, {
          createdby: '843843c9-e64a-49e6-8ca7-348f23a438e5',
          modifiedby: '843843c9-e64a-49e6-8ca7-348f23a438e5'
        });
      }

      console.log('group updated ');



      // language

      // get language
      languageModel.attachTo(app.dataSources.mysqlsf);
      var language = await languageModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('language ==== :', language.length);

      // add language
      // languageModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < language.length; i++) {
        const element = language[i];
        await languageModel.updateAll({
          id: element.id
        }, {
          createdby: '843843c9-e64a-49e6-8ca7-348f23a438e5',
          modifiedby: '843843c9-e64a-49e6-8ca7-348f23a438e5'
        });
      }

      console.log('language updated ');



      // notificationtype

      // get notificationtype
      notificationtypeModel.attachTo(app.dataSources.mysqlsf);
      var notificationtype = await notificationtypeModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('notificationtype ==== :', notificationtype.length);

      // add notificationtype
      // notificationtypeModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < notificationtype.length; i++) {
        const element = notificationtype[i];
        await notificationtypeModel.updateAll({
          id: element.id
        }, {
          createdby: '843843c9-e64a-49e6-8ca7-348f23a438e5',
          modifiedby: '843843c9-e64a-49e6-8ca7-348f23a438e5'
        });
      }

      console.log('notificationtype updated ');


      // orderstatus

      // get orderstatus
      orderstatusModel.attachTo(app.dataSources.mysqlsf);
      var orderstatus = await orderstatusModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('orderstatus ==== :', orderstatus.length);

      // add orderstatus
      // orderstatusModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < orderstatus.length; i++) {
        const element = orderstatus[i];
        await orderstatusModel.updateAll({
          id: element.id
        }, {
          createdby: '843843c9-e64a-49e6-8ca7-348f23a438e5',
          modifiedby: '843843c9-e64a-49e6-8ca7-348f23a438e5'
        });
      }

      console.log('orderstatus updated ');


      // product

      // get product
      productModel.attachTo(app.dataSources.mysqlsf);
      var product = await productModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('product ==== :', product.length);

      // add product
      // productModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < product.length; i++) {
        const element = product[i];
        await productModel.updateAll({
          id: element.id
        }, {
          createdby: '843843c9-e64a-49e6-8ca7-348f23a438e5',
          modifiedby: '843843c9-e64a-49e6-8ca7-348f23a438e5'
        });
      }

      console.log('product updated ');


      // productmedia

      // get productmedia
      productmediaModel.attachTo(app.dataSources.mysqlsf);
      var productmedia = await productmediaModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('productmedia ==== :', productmedia.length);

      // add productmedia
      // productmediaModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < productmedia.length; i++) {
        const element = productmedia[i];
        await productmediaModel.updateAll({
          id: element.id
        }, {
          createdby: '843843c9-e64a-49e6-8ca7-348f23a438e5',
          modifiedby: '843843c9-e64a-49e6-8ca7-348f23a438e5'
        });
      }

      console.log('productmedia updated ');



      // rolemapping - principalId

      // get rolemapping
      rolemappingModel.attachTo(app.dataSources.mysqlsf);
      var rolemapping = await rolemappingModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          principalId: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('rolemapping ==== :', rolemapping.length);

      // add rolemapping
      // rolemappingModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < rolemapping.length; i++) {
        const element = rolemapping[i];
        await rolemappingModel.updateAll({
          id: element.id
        }, {
          principalId: '843843c9-e64a-49e6-8ca7-348f23a438e5'
        });
      }

      console.log('rolemapping updated ');


      // setting

      // get setting
      settingModel.attachTo(app.dataSources.mysqlsf);
      var setting = await settingModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('setting ==== :', setting.length);

      // add setting
      // settingModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < setting.length; i++) {
        const element = setting[i];
        await settingModel.updateAll({
          id: element.id
        }, {
          createdby: '843843c9-e64a-49e6-8ca7-348f23a438e5',
          modifiedby: '843843c9-e64a-49e6-8ca7-348f23a438e5'
        });
      }

      console.log('setting updated ');



      // usermetaauth

      // user

      // get user
      userModel.attachTo(app.dataSources.mysqlsf);
      var user = await userModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('user ==== :', user.length);

      // add user
      // userModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < user.length; i++) {
        const element = user[i];
        await userModel.updateAll({
          id: element.id
        }, {
          createdby: '843843c9-e64a-49e6-8ca7-348f23a438e5',
          modifiedby: '843843c9-e64a-49e6-8ca7-348f23a438e5'
        });
      }

      console.log('user updated ');


      // usermetaauth

      // get usermetaauth
      usermetaauthModel.attachTo(app.dataSources.mysqlsf);
      var usermetaauth = await usermetaauthModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91'
        }
      });
      console.log('usermetaauth ==== :', usermetaauth.length);

      // add usermetaauth
      // usermetaauthModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < usermetaauth.length; i++) {
        const element = usermetaauth[i];
        await usermetaauthModel.updateAll({
          id: element.id
        }, {
          createdby: '843843c9-e64a-49e6-8ca7-348f23a438e5',
          modifiedby: '843843c9-e64a-49e6-8ca7-348f23a438e5'
        });
      }

      console.log('usermetaauth updated ');
      console.log('SF : Change Admin Id - Done');

      // change default group id
      var string = "UPDATE `group` SET id = UUID() where name = 'Default';";
      console.log(string);
      var data = await new Promise((resolve, reject) => {
        app.datasources.mysqlsf.connector.execute(string, null, (err, result) => {
          if (err) reject(err);
          resolve(result);
        });
      });


      groupModel.attachTo(app.dataSources.mysqlsf);
      var groupDefault = await groupModel.findOne({
        where: {
          name: 'Default'
        }
      });

      console.log(groupDefault);

      // change group id in groupcategory table
      // get group category
      groupcategoryModel.attachTo(app.dataSources.mysqlsf);
      var groupcategory = await groupcategoryModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          groupId: 'b4a77eec-e686-4d16-839d-ffddb190b159'
        }
      });
      console.log('groupcategory ==== :', groupcategory.length);

      // add group category
      for (let i = 0; i < groupcategory.length; i++) {
        const element = groupcategory[i];
        await groupcategoryModel.updateAll({
          id: element.id
        }, {
          groupId: groupDefault.id
        });
      }

      console.log('groupcategory updated ');


      // change group id in groupprice table
      // get groupprice
      grouppriceModel.attachTo(app.dataSources.mysqlsf);
      var groupprice = await grouppriceModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          groupId: 'b4a77eec-e686-4d16-839d-ffddb190b159'
        }
      });
      console.log('groupprice ==== :', groupprice.length);

      // add groupprice
      for (let i = 0; i < groupprice.length; i++) {
        const element = groupprice[i];
        await grouppriceModel.updateAll({
          id: element.id
        }, {
          groupId: groupDefault.id
        });
      }

      console.log('groupprice updated ');

      // change group id in user table
      // get user
      userModel.attachTo(app.dataSources.mysqlsf);
      var user = await userModel.find({
        where: {
          deletedAt: {
            eq: null
          },
          groupId: 'b4a77eec-e686-4d16-839d-ffddb190b159'
        }
      });
      console.log('user ==== :', user.length);

      // add user
      for (let i = 0; i < user.length; i++) {
        const element = user[i];
        await userModel.updateAll({
          id: element.id
        }, {
          groupId: groupDefault.id
        });
      }

      console.log('user updated ');


      // get city
      cityModel.attachTo(app.dataSources.mysqlsf);
      userModel.attachTo(app.dataSources.mysqlsf);
      salesmancityModel.attachTo(app.dataSources.mysqlsf);
      var cityIdChange = await cityModel.find({
        where: {
          deletedAt: {
            eq: null
          }
        }
      });
      console.log('city count :  ', cityIdChange.length);

      for (let i = 0; i < cityIdChange.length; i++) {
        const element = cityIdChange[i];

        var string = "UPDATE `city` SET id = UUID() where name = '" + element.name + "';";
        var data = await new Promise((resolve, reject) => {
          app.datasources.mysqlsf.connector.execute(string, null, (err, result) => {
            if (err) reject(err);
            resolve(result);
          });
        });

        var cityOne = await cityModel.findOne({
          where: {
            name: element.name
          }
        });


        await userModel.updateAll({
          cityId: element.id
        }, {
          cityId: cityOne.id
        });
        console.log('User city updated ');

        await salesmancityModel.updateAll({
          cityId: element.id
        }, {
          cityId: cityOne.id
        });
        console.log('salesman city updated ');

      }

      // chnage internal user's ID and related data
      userModel.attachTo(app.dataSources.mysqlsf);
      commoncounterModel.attachTo(app.dataSources.mysqlsf);
      inquiryModel.attachTo(app.dataSources.mysqlsf);
      notificationModel.attachTo(app.dataSources.mysqlsf);
      notificationreceiverModel.attachTo(app.dataSources.mysqlsf);
      orderModel.attachTo(app.dataSources.mysqlsf);
      orderdetailsModel.attachTo(app.dataSources.mysqlsf);
      rolemappingModel.attachTo(app.dataSources.mysqlsf);
      salesmancityModel.attachTo(app.dataSources.mysqlsf);
      shorturlModel.attachTo(app.dataSources.mysqlsf);
      usermetaauthModel.attachTo(app.dataSources.mysqlsf);

      var changeUsers = await userModel.find({
        where: {
          cellnumber: {
            inq: ['9726502809', '9665656464', '9228220042', '9054088413', '8401981510', '8401981588', '9537608322', '8320849409',
              '9313751388', '9909514307', '9998792646', '6352766480', '9067013598', '9426184837', '9712070814', '9712056809',
              '9067747041', '8200310991', '8452964844', '9428439526', '9818845455', '7621075934'
            ]
          }
        }
      });

      console.log('User : ', changeUsers.length);

      for (let i = 0; i < changeUsers.length; i++) {
        const element = changeUsers[i];
        var string = "UPDATE `user` SET id = UUID() where cellnumber = '" + element.cellnumber + "';";
        console.log(string);
        var data = await new Promise((resolve, reject) => {
          app.datasources.mysqlsf.connector.execute(string, null, (err, result) => {
            if (err) reject(err);
            resolve(result);
          });
        });

        var user = await userModel.findOne({
          where: {
            cellnumber: element.cellnumber
          }
        });

        console.log('user', user.id);


        await commoncounterModel.updateAll({
          userId: element.id
        }, {
          userId: user.id
        });
        console.log('commoncounterModel updated ');

        await inquiryModel.updateAll({
          assignedto: element.id
        }, {
          assignedto: user.id,
          createdby: user.id,
          userId: user.id
        });
        console.log('inquiryModel assignedto updated ');


        await notificationModel.updateAll({
          notificationreceiverId: element.id
        }, {
          notificationreceiverId: user.id,
          createdby: user.id
        });
        console.log('notificationModel notificationreceiverId updated ');


        await notificationreceiverModel.updateAll({
          userId: element.id
        }, {
          userId: user.id,
          createdby: user.id
        });
        console.log('notificationreceiverModel userId updated ');


        await orderModel.updateAll({
          userId: element.id
        }, {
          userId: user.id,
          createdby: user.id
        });
        console.log('orderModel updated ');

        await orderdetailsModel.updateAll({
          userId: element.id
        }, {
          createdby: user.id
        });
        console.log('orderModel updated ');

        await rolemappingModel.updateAll({
          principalId: element.id
        }, {
          principalId: user.id
        });
        console.log('rolemappingModel updated ');

        await salesmancityModel.updateAll({
          userId: element.id
        }, {
          userId: user.id
        });
        console.log('salesmancityModel updated ');

        await shorturlModel.updateAll({
          userId: element.id
        }, {
          userId: user.id
        });
        console.log('shorturlModel updated ');

        await usermetaauthModel.updateAll({
          userId: element.id
        }, {
          userId: user.id
        });
        console.log('usermetaauthModel updated ');


      }

      // language

      // get language
      languageModel.attachTo(app.dataSources.mysqlsf);
      var language = await languageModel.find({
        where: {
          deletedAt: {
            eq: null
          }
        }
      });
      console.log('language ==== :', language.length);

      // add language
      languageModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < language.length; i++) {
        const element = language[i];
        await languageModel.create({
          key: element.key,
          value: element.value,
          createdby: element.assignedto,
          modifiedby: element.industryId,
          created: element.created,
          modified: element.modified,
          masterdetailId: element.masterdetailId
        });
      }

      console.log('language updated ');




      // notificationType

      // get notificationType
      notificationtypeModel.attachTo(app.dataSources.mysqlsf);
      var notificationtype = await notificationtypeModel.find({
        where: {
          deletedAt: {
            eq: null
          }
        }
      });
      console.log('notificationtype ==== :', notificationtype.length);

      // add notificationType
      notificationtypeModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < notificationtype.length; i++) {
        const element = notificationtype[i];
        await notificationtypeModel.create({
          textmessage: element.textmessage,
          textmessage_html: element.textmessage_html,
          code: element.code,
          notification: element.notification,
          notificationId: element.notificationId,
          createdby: element.assignedto,
          modifiedby: element.industryId,
          created: element.created,
          modified: element.modified,
          masterdetailId: element.masterdetailId
        });
      }

      console.log('notificationtype updated ');



      // orderstatus

      // get orderstatus
      orderstatusModel.attachTo(app.dataSources.mysqlsf);
      var orderstatus = await orderstatusModel.find({
        where: {
          deletedAt: {
            eq: null
          }
        }
      });
      console.log('orderstatus ==== :', orderstatus.length);

      // add orderstatus
      orderstatusModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < orderstatus.length; i++) {
        const element = orderstatus[i];
        await orderstatusModel.create({
          status: element.status,
          createdby: element.createdby,
          modifiedby: element.modifiedby,
          created: element.created,
          modified: element.modified,
          masterdetailId: element.masterdetailId
        });
      }

      console.log('orderstatus updated ');



      // rolemapping

      // get rolemapping
      rolemappingModel.attachTo(app.dataSources.mysqlsf);
      var rolemapping = await rolemappingModel.find({
        where: {
          deletedAt: {
            eq: null
          }
        }
      });
      console.log('rolemapping ==== :', rolemapping.length);

      // add rolemapping
      rolemappingModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < rolemapping.length; i++) {
        const element = rolemapping[i];
        await rolemappingModel.create({
          principalType: element.principalType,
          principalId: element.principalId,
          roleId: element.roleId,
          masterdetailId: element.masterdetailId
        });
      }

      console.log('rolemapping updated ');



      // setting

      // get setting
      settingModel.attachTo(app.dataSources.mysqlsf);
      var setting = await settingModel.find({
        where: {
          deletedAt: {
            eq: null
          }
        }
      });
      console.log('setting ==== :', setting.length);

      // add setting
      settingModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < setting.length; i++) {
        const element = setting[i];
        await settingModel.create({
          registerallow: element.registerallow,
          status: element.status,
          text: element.text,
          createdby: element.createdby,
          modifiedby: element.modifiedby,
          created: element.created,
          modified: element.modified,
          masterdetailId: element.masterdetailId
        });
      }

      console.log('setting updated ');


      // source

      // get source
      sourceModel.attachTo(app.dataSources.mysqlsf);
      var source = await sourceModel.find({
        where: {
          deletedAt: {
            eq: null
          }
        }
      });
      console.log('source ==== :', source.length);

      // add source
      sourceModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < source.length; i++) {
        const element = source[i];
        await sourceModel.create({
          name: element.name,
          created: element.created,
          modified: element.modified,
          masterdetailId: element.masterdetailId
        });
      }

      console.log('source updated ');


      // state

      // get state
      stateModel.attachTo(app.dataSources.mysqlsf);
      var state = await stateModel.find({
        where: {
          deletedAt: {
            eq: null
          }
        }
      });
      console.log('state ==== :', state.length);

      // add state
      stateModel.attachTo(app.dataSources.mysql);
      for (let i = 0; i < state.length; i++) {
        const element = state[i];
        await stateModel.create({
          name: element.name,
          parentId: element.parentId,
          created: element.created,
          modified: element.modified,
          masterdetailId: element.masterdetailId
        });
      }

      console.log('state updated ');

      return true;

    } catch (error) {
      throw error;
    }

  };

  Masterdetail.deleteInstanceTableData = async (req) => {

    var categoryModel = app.models.category;
    var categorymediaModel = app.models.categorymedia;
    var cityModel = app.models.city;
    var commoncounterModel = app.models.commoncounter;
    var groupModel = app.models.group;
    var languageModel = app.models.language;
    var notificationtypeModel = app.models.notificationtype;
    var orderstatusModel = app.models.orderstatus;
    var productModel = app.models.product;
    var productmediaModel = app.models.productmedia;
    var rolemappingModel = app.models.rolemapping;
    var settingModel = app.models.setting;
    var userModel = app.models.user;
    var usermetaauthModel = app.models.usermetaauth;
    var groupcategoryModel = app.models.groupcategory;
    var grouppriceModel = app.models.groupprice;
    var salesmancityModel = app.models.salesmancity;
    var inquiryModel = app.models.inquiry;
    var notificationModel = app.models.notification;
    var notificationreceiverModel = app.models.notificationreceiver;
    var orderModel = app.models.order;
    var orderdetailsModel = app.models.orderdetails;
    var shorturlModel = app.models.shorturl;
    var sourceModel = app.models.source;
    var stateModel = app.models.state;

    try {

      // Delete Group Data
      var groupCount = await groupModel.deleteAll({
        masterdetailId: req.query.where.masterdetailId
      });
      console.log('Group Records Delete Count --- ', groupCount.count);

      return true;

    } catch (error) {
      throw error;
    }

  };




  async function sendEmail(userData, text) {
    var notificationtypeModel = app.models.notificationtype;
    var emailModel = app.models.email;

    var notificationcode = await notificationtypeModel.findOne({
      where: {
        code: 'EMAIL/VERIFICATION'
      }
    });

    var textMessage = notificationcode.code;
    textMessage = textMessage.replace('[name]', userData.firstname);
    textMessage = textMessage.replace('[text]', text);

    var data = {
      senderEmail: [userData.email],
      subject: 'Verify Email Account',
      messageContent: textMessage
    };

    console.log(data);

    emailModel.sendVerificationEmail(data, (err, data) => {
      if (err) console.log(err);
      console.log('Verification : Email sent');
    });

  };

  function toDateTime(secs) {
    var t = new Date();
    t.setSeconds(secs);
    return t;
  }

  async function getDescriptionKeyData(masterdetailId, key) {
    var descriptionData = await Masterdetail.findOne({
      where: {
        id: masterdetailId
      }
    });
    descriptionData = JSON.parse(descriptionData.description);
    return descriptionData = descriptionData.find(e => e.key === key);
  }

  async function getCurrentPlandDetails(planId) {
    const rezPayData = await rzp.getAllPlans();
    // Get Current Plan
    return rezPayData.find(obj => obj.id === planId);
  }

  async function updatePlanDetails(mid) {

    var monthlyPlans = [];
    var yearlyPlans = [];

    try {

      var getAllPlans = await app.models.setting.findOne({
        where: {
          registerallow: constants.ALL_PLANS_LABLES
        }
      });

      getAllPlans = JSON.parse(getAllPlans.text);
      yearlyPlans = getAllPlans.yearlyPlans;
      monthlyPlans = getAllPlans.monthlyPlans;

      var getMasterdetailIData = await Masterdetail.findOne({
        where: {
          id: mid
        }
      });

      const descriptionData = JSON.parse(getMasterdetailIData.description);
      var getPlanId = descriptionData.find(item => {
        if (item.key === 'planId') {
          return item.value;
        }
      });
      getPlanId = getPlanId.value

      // check plan type
      var setExpireDate;
      const isMonthlyPlan = monthlyPlans.find(x => x.planId === getPlanId);
      if (isMonthlyPlan) {
        setExpireDate = moment().add(1, 'M').format('YYYY-MM-DD')
      } else {
        const isYearlyPlan = yearlyPlans.find(x => x.planId === getPlanId);
        if (isYearlyPlan) {
          setExpireDate = moment().add(12, 'M').format('YYYY-MM-DD')
        }
      }

      var mastermetaconfigJson = {
        "planDetails": [{
          "purchaseStartDate": moment().format('YYYY-MM-DD'),
          "purchaseStartTime": moment().format('hh-mm-ss'),
          "purchaseExpireDate": setExpireDate,
          "purchaseExpireTime": moment().format('hh-mm-ss'),
          "isPlanUpdated": false,
          "updatedExpireDate": null,
          "updatedExpireTime": null,
          'isShowDashboardWelcomeModal': false
        }]
      };

      await app.models.masterdetailmeta.updateAll({
        masterdetailId: mid
      }, {
        smscredits: 0,
        configuration: JSON.stringify(mastermetaconfigJson)
      });

      // Update Currenct Marchant Plan
      var getCurrentMarchantPlan = await app.models.setting.findOne({
        where: {
          registerallow: constants.PACKAGE_DETAILS_LABEL
        }
      });
      getCurrentMarchantPlan = JSON.parse(getCurrentMarchantPlan.text);
      var getPlanName = descriptionData.find(item => {
        if (item.key === 'plan_name') {
          return item.value;
        }
      });
      getPlanName = getPlanName.value
      getCurrentMarchantPlan = getCurrentMarchantPlan.find(x => x.type.value === getPlanName);
      await app.models.setting.updateAll({
        registerallow: constants.PACKAGE_DETAILS_LABEL,
        masterdetailId: mid
      }, {
        text: JSON.stringify(getCurrentMarchantPlan)
      });

      return;

    } catch (error) {
      throw error;
    }

  }

  Masterdetail.afterRemote("find", async (ctx, modelInstance, next) => {

    try {

      if (modelInstance && modelInstance.length > 0) {
        console.log(modelInstance[0]);
        var getTenantSetting = await app.models.setting.findOne({
          where: {
            registerallow: settingConstants.TENANT_CONFIG,
            masterdetailId: modelInstance[0].id
          }
        });
        if (getTenantSetting) {
          getTenantSetting = JSON.parse(getTenantSetting.text);
          modelInstance[0].TenantSettings = [{
            key: 'isShowXEModule',
            value: getTenantSetting.isShowXEModule
          }];
        }
      }
    } catch (error) {
      throw error;
    }

  });

};



