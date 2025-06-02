'use strict';

var app = require('../../server/server');
var constants = require("../const");
var titlecase = require("title-case");

var staticAllowedUsers = [
  'a33591ab-4bc4-4b55-8390-38c2ef421087', // cg , Pranav Sir
  'aa54e5cf-f95e-4b19-8a4b-916c03e9abb6', // cg , Ashok

  '3229651a-466a-46c4-95c1-7e54fd3b0405', // sj , Pranav Sir
  '122cf23c-96f6-4b1f-88ed-b0f16271a0d2', // sj , Ashok

  '7cd22f0e-a9dc-488f-8d73-2d36deaa4df6', // sf , Pranav Sir
  '41751fb3-b21e-4570-b5cb-444886f37c39', // sf , Ashok

  'bb43ec06-d902-4ca7-9e18-c3eb1ee78564', // kj , Pranav Sir
  'a4af7acb-ee3e-4a15-a42e-b47d824da268', // kj , Ashok

  'bb43ec06-d902-4ca7-9e18-c3eb1ee78564', // panam , Pranav Sir
  '81860098-24ce-4a0a-b5f4-069e6ac6a74f', // panam , Ashok

  'bb43ec06-d902-4ca7-9e18-c3eb1ee78564', // nextview , Pranav Sir
  '9ec690d4-c39f-49d0-98a8-ad5b1a230991', // nextview , Ashok

  'd07bd37a-a654-11eb-bcbc-0242ac130002', // nutland , Pranav Sir
  '41751fb3-b21e-4570-b5cb-444886f37c39', // nutland , Ashok

  '257b35b2-f24b-42d8-8ce0-e137a247773d', // cg , ashok, salesmen

  '5ce29bda-3359-418c-8f44-1b37d5b17b47', // MAPL, abhiraj

  '67d13545-a17d-4886-a0c1-674bd260c53f', // JB , ODS

  'de973e57-f63e-4495-8038-4c725f0cd5b1', // Jayshree - 9925241819

  '66f2ac3d-a47f-4fc9-8b68-2cf72403a8fc', // Akib (Kapasi) - 6352766480

  '5069a172-aa07-4e0e-a812-78e9e9add9ee', // Jayshree test

  'd99e94a1-308c-4fc4-8d35-2a6ca069b167', // Parth (Nutland)

  '03d6efaf-6c65-442a-a7ce-0b5fbd2c2339', // Hitesh Salesman(Nutland)

  '5efa3df5-b4a8-432b-987c-0821f7dac914' // 9726502809 - daxal
];

module.exports = function (Usermetaauth) {

  // send otp to user
  Usermetaauth.remoteMethod('sendOtp', {
    accepts: [{
      arg: 'req',
      type: 'object',
      http: {
        source: 'req'
      }
    }, {
      arg: 'userId',
      type: 'string',
      http: {
        source: 'query'
      }
    }, {
      arg: 'receiverType',
      type: 'string',
      http: {
        source: 'query'
      }
    }, {
      arg: 'type',
      type: 'string',
      http: {
        source: 'query'
      }
    }, {
      arg: 'smstoken',
      type: 'string',
      http: {
        source: 'query'
      }
    }, {
      arg: 'accessToken',
      type: 'object',
      http: function (ctx) {
        return ctx.req.accessToken;
      }
    }],
    returns: {
      arg: 'result',
      type: 'Object',
      root: true
    },
    http: {
      path: '/sendOtp',
      verb: 'get'
    }
  });

  Usermetaauth.sendOtp = async (req, userId, receiverType, type, smstoken, accessToken, cb) => {

    var t = new Date();
    var otp = Math.floor(1000 + Math.random() * 9000); //get a random no 1000 - 9999
    t.setSeconds(t.getSeconds() + 70); // get a time 60sec more than current time
    var otpObject = [];
    var otpDataObject = {};
    var userModel = app.models.user;
    var notifyModel = app.models.notify;

    req.headers.openstoreid ? userId = req.query.userId : userId = accessToken.userId;

    // use this whem we import the sms gateway - that time pass the cellnumber
    var userDetail = await userModel.findOne({
      where: {
        id: userId,
        masterdetailId: req.query.where.masterdetailId
      }
    });

    if (type === "signupotp") {

      otpDataObject["signupotpvalidtill"] = t;
      otpDataObject["signupotp"] = otp;
      otpObject.push(otpDataObject);
      otpObject.push(userId);
      otpObject.push(smstoken)

      // function for otp
      sendOTP(otpObject);

      if (receiverType === "SMS") {
        // sms function - also in sms call function pass the user data[mainly cellnumber]
        // sendS.sendSms(userDetail.cellnumber, otpDataObject);

        if (!staticAllowedUsers.includes(userDetail.id)) {
          if (smstoken) {
            await notifyModel.share('SIGNUP/OTP/ANDROID', otpObject, {
              masterdetailId: req.query.where.masterdetailId
            });
          } else {
            await notifyModel.share('SIGNUP/OTP', otpObject, {
              masterdetailId: req.query.where.masterdetailId
            });
          }
        }
        console.log('otp is', otpDataObject.signupotp);
      }

      return otpObject[0]; //pass object

    } else if (type === 'signinotp') {

      otpDataObject["signinotpvalidtill"] = t;
      otpDataObject["signinotp"] = otp;
      otpObject.push(otpDataObject);
      otpObject.push(userId);
      otpObject.push(smstoken);

      // function for otp
      sendOTP(otpObject);

      if (receiverType === "SMS") {
        // sms function - also in sms call function pass the user data[mainly cellnumber]
        // sendS.sendSms(userDetail.cellnumber, otpDataObject);

        if (!staticAllowedUsers.includes(userDetail.id)) {
          if (smstoken) {
            notifyModel.share('SIGNIN/OTP/ANDROID', otpObject, {
              masterdetailId: req.query.where.masterdetailId
            });
          } else {
            notifyModel.share('SIGNIN/OTP', otpObject, {
              masterdetailId: req.query.where.masterdetailId
            });
          }
        }

        console.log('otp is', otpDataObject.signinotp);
      }

      return otpObject[0]; //pass object
    }
  }

  // verify otp
  Usermetaauth.verifyOtp = async function (msg, req, cb) {
    var notifyModel = app.models.notify;
    var userModel = app.models.user;
    var accessToken = app.models.AccessToken;
    var groupModel = app.models.group;
    var temperoryToken, usermetaauthuser;

    try {
      msg.userId = req.body.userId;

      usermetaauthuser = await Usermetaauth.findOne({
        where: {
          userId: msg.userId,
          masterdetailId: req.body.masterdetailId
        }
      });

      if (!usermetaauthuser) { // otp is not found with the userId
        throw constants.createError(404, 'User not found');
      }

      if (staticAllowedUsers.includes(usermetaauthuser.userId) && msg.signinotp) {
        msg.signinotp = usermetaauthuser.signinotp;
      }

      if (staticAllowedUsers.includes(usermetaauthuser.userId) && msg.signupotp) {
        msg.signupotp = usermetaauthuser.signupotp;
      }

      if (msg.signupotp) {

        var user = await userModel.findOne({
          where: {
            id: msg.userId,
            masterdetailId: req.body.masterdetailId
          }
        });

        // check for OTP with userId within valid timeframe
        var usermetaauth;
        if (!staticAllowedUsers.includes(msg.userId)) {
          usermetaauth = await Usermetaauth.findOne({
            where: {
              and: [{
                signupotp: msg.signupotp
              }, {
                userId: msg.userId
              }, {
                signupotpvalidtill: {
                  gt: new Date()
                }
              }],
              masterdetailId: req.body.masterdetailId
            }
          });
        } else {
          usermetaauth = await Usermetaauth.findOne({
            where: {
              and: [{
                signupotp: msg.signupotp
              }, {
                userId: msg.userId
              }],
              masterdetailId: req.body.masterdetailId
            }
          });
        }

        if (!usermetaauth) { // otp is not found with the userId
          throw constants.createError(400, 'Please enter a valid OTP');
        } else if (req.body.isVerifyInstance === true) {

          await userModel.updateAll({
            id: req.body.userId,
            masterdetailId: req.body.masterdetailId
          }, {
            isregistered: true
          });

          return user;

        } else {

          // When no openstoreid in headers then create accesstoken
          if (!req.headers.openstoreid) {
            temperoryToken = await accessToken.create({
              ttl: -1,
              userId: msg.userId,
              masterdetailId: req.body.masterdetailId
            });
          }

          // set user in default group
          var groupDetails = await groupModel.findOne({
            where: {
              name: constants.DEFAULT,
              masterdetailId: req.body.masterdetailId
            }
          });

          // condition on basis of flag.(verifyInstanceOTP)
          // is register field update when otp is verify
          await userModel.updateAll({
            id: msg.userId,
            masterdetailId: req.body.masterdetailId
          }, {
            isregistered: true,
            groupId: groupDetails.id
          });
          // Increase Group user count
          await groupModel.updateAll({
            id: groupDetails.id,
            masterdetailId: req.body.masterdetailId
          }, {
            noofusers: groupDetails.noofusers + 1
          });

          // Set Accesstoken response
          req.headers.openstoreid ? user.apitoken = req.headers.authorization : user.apitoken = temperoryToken.id;

          // Update Usermetaauth Details
          await Usermetaauth.updateAll({
            id: usermetaauth.id,
            masterdetailId: req.body.masterdetailId
          }, {
            devicetoken: msg.devicetoken
          });
          user.usermetaauthId = usermetaauth.id;

          return user;

        }
      } else if (msg.signinotp) {

        // Check for OTP with userId within valid timeframe
        var user = await userModel.findOne({
          where: {
            id: msg.userId,
            masterdetailId: req.body.masterdetailId
          }
        });

        var usermetaauth;
        if (!staticAllowedUsers.includes(msg.userId)) {
          usermetaauth = await Usermetaauth.findOne({
            where: {
              and: [{
                signinotp: msg.signinotp
              }, {
                userId: msg.userId
              }, {
                signinotpvalidtill: {
                  gt: new Date()
                }
              }],
              masterdetailId: req.body.masterdetailId
            }
          });
        } else {
          usermetaauth = await Usermetaauth.findOne({
            where: {
              and: [{
                signinotp: msg.signinotp
              }, {
                userId: msg.userId
              }],
              masterdetailId: req.body.masterdetailId
            }
          });
        }

        if (!usermetaauth) { // otp is not found with the userId
          throw constants.createError(400, 'Please enter a valid OTP');
        } else {

          // When no openstoreid in headers then create accesstoken
          if (!req.headers.openstoreid) {
            temperoryToken = await accessToken.create({
              ttl: -1,
              userId: msg.userId,
              masterdetailId: req.body.masterdetailId
            });
          }

          // Set Accesstoken response
          req.headers.openstoreid ? user.apitoken = req.headers.authorization : user.apitoken = temperoryToken.id;

          // when device is changed
          if ((usermetaauth.devicetoken != msg.devicetoken) && (usermetaauth.devicetoken != null)) {
            msg.deviceToken = usermetaauth.devicetoken;
            await notifyModel.share('DEVICE/CHANGE', msg, {
              masterdetailId: req.body.masterdetailId
            });
            await accessToken.destroyAll({
              userId: msg.userId,
              id: {
                neq: user.apitoken
              },
              masterdetailId: req.body.masterdetailId
            });
          }

          // update device token
          if (msg.devicetoken) {
            //store devicetoken into user table
            Usermetaauth.updateAll({
              userId: user.id,
              masterdetailId: req.body.masterdetailId
            }, {
              devicetoken: msg.devicetoken
            });
          }
          user.usermetaauthId = usermetaauth.id;

          // Increase no of time sign in
          Usermetaauth.updateAll({
            userId: user.id,
            masterdetailId: req.body.masterdetailId
          }, {
            nooftimesignin: usermetaauth.nooftimesignin === 0 ? 1 : usermetaauth.nooftimesignin + 1
          });

          return user;
        }
      }
    } catch (error) {
      throw error;
    }
  }


  Usermetaauth.remoteMethod('verifyOtp', {
    accepts: [{
      arg: 'msg',
      type: 'object',
      http: {
        source: 'body'
      }
    }, {
      arg: 'req',
      type: 'object',
      http: {
        source: 'req'
      }
    }],
    returns: {
      arg: 'result',
      type: 'object',
      root: true
    },
    http: {
      path: '/verifyOtp',
      verb: 'post'
    }
  });

  Usermetaauth.afterRemote('verifyOtp', async (ctx, modelInstance, next) => {

    var userDetails, getOrderOfUser, getOrderOfGuest, getFinalOrder,
      getOrderOfUserOrderdetails, getOrderOfGuestOrderdetails, getFinalOrderdetails;
    var finalOrderTotalAmount, finalOrderBasePrice, finalOrderShippingPrice, finalOrderGSTPrice,
      finalOrderPincodeBasedPrice, getShippingPrice, getGSTDetails, getPincodeBasedDeliveryDetails,
      finaladditionalcharge, finalBasePriceWithCharges, additionalchargedetails;

    var userModel = app.models.user;
    var orderModel = app.models.order;
    var productModel = app.models.product;
    var settingModel = app.models.setting;
    var orderdetailsModel = app.models.orderdetails;
    var commonCounterModel = app.models.commoncounter;
    var groupModel = app.models.group;

    try {
      if (ctx.req.headers.openstoreid && ctx.req.headers.masterdetailid) {

        // When user do signup request we not need to do anything

        // Update Accesstoken
        await app.models.AccessToken.updateAll({
          id: ctx.req.headers.authorization
        }, {
          userId: ctx.req.body.userId
        });

        // Check when signinotp
        if (ctx.req.body.signinotp) {

          // Get Default groupId
          var getDefaultGroupDetails = await groupModel.findOne({
            where: {
              name: constants.DEFAULT,
              masterdetailId: ctx.req.headers.masterdetailid
            }
          });

          // Get Guest User Group Id
          var getGuestDetails = await userModel.findOne({
            where: {
              id: ctx.req.headers.openstoreid,
              masterdetailId: ctx.req.headers.masterdetailid
            }
          });


          // Get User Group Id
          var getUserDetails = await userModel.findOne({
            where: {
              id: ctx.req.body.userId,
              masterdetailId: ctx.req.headers.masterdetailid
            }
          });

          // Get order of user
          getOrderOfUser = await orderModel.findOne({
            where: {
              inshoppingcart: constants.INSHOPPINGCART,
              userId: ctx.req.body.userId,
              masterdetailId: ctx.req.headers.masterdetailid
            }
          });
          // Get order of guest
          getOrderOfGuest = await orderModel.findOne({
            where: {
              inshoppingcart: constants.INSHOPPINGCART,
              userId: ctx.req.headers.openstoreid,
              masterdetailId: ctx.req.headers.masterdetailid
            }
          });
          // When order exist
          if (getOrderOfUser && getOrderOfGuest) {
            console.log('Guest & User both order exist');
            // Get orderdetails of user
            getOrderOfUserOrderdetails = await getOrderDetails({
              orderId: getOrderOfUser.id,
              userId: getOrderOfUser.userId,
              masterdetailId: getOrderOfUser.masterdetailId
            });
            // Get orderdetails of guest
            getOrderOfGuestOrderdetails = await getOrderDetails({
              orderId: getOrderOfGuest.id,
              userId: getOrderOfGuest.userId,
              masterdetailId: getOrderOfGuest.masterdetailId
            });

            if (getOrderOfUser && getOrderOfUserOrderdetails.length > 0 && getOrderOfGuest && getOrderOfGuestOrderdetails.length > 0) {
              getFinalOrder = getOrderOfUser;
              getFinalOrderdetails = await getUniquieArrayOfObject(getOrderOfUserOrderdetails, getOrderOfGuestOrderdetails);
            }

          } else if (getOrderOfUser) {
            console.log('User order exist');
            getOrderOfUserOrderdetails = await getOrderDetails({
              orderId: getOrderOfUser.id,
              userId: getOrderOfUser.userId,
              masterdetailId: getOrderOfUser.masterdetailId
            });
            if (getOrderOfUser && getOrderOfUserOrderdetails.length > 0) {
              getFinalOrder = getOrderOfUser;
              getFinalOrderdetails = getOrderOfUserOrderdetails;
            }
          } else if (getOrderOfGuest) {
            console.log('Guest order exist');
            getOrderOfGuestOrderdetails = await getOrderDetails({
              orderId: getOrderOfGuest.id,
              userId: getOrderOfGuest.userId,
              masterdetailId: getOrderOfGuest.masterdetailId
            });
            if (getOrderOfGuest && getOrderOfGuestOrderdetails.length > 0) {
              getFinalOrder = getOrderOfGuest;
              getFinalOrderdetails = getOrderOfGuestOrderdetails;
            }
          } else {
            console.log('No order exist');
          }

          // Delete Guest User Order
          if (getOrderOfGuest && getOrderOfUser) {
            await orderModel.updateAll({
              id: getOrderOfGuest.id
            }, {
              deletedAt: new Date()
            });
          }

          if (getFinalOrder && getFinalOrderdetails) {

            // When Guest & Existing GroupId is not Same
            if (getUserDetails && getGuestDetails && getUserDetails.groupId !== getGuestDetails.groupId) {
              // Update order details with product - groupprice
              getFinalOrderdetails = await updateProductPriceBasedOnGroup(getFinalOrderdetails, getUserDetails.groupId);
            }

            // Set Total Amount
            finalOrderTotalAmount = await calculateTotalAmount(getFinalOrderdetails);

            // Set Base Price
            finalOrderBasePrice = finalOrderTotalAmount;

            // add service charge to total amount
            var totalAmount = await constants.getServiceCharge({ masterdetailId: ctx.req.headers.masterdetailid, totalamount: finalOrderTotalAmount });
            if (totalAmount) {
              finalBasePriceWithCharges = totalAmount.amount;
              finaladditionalcharge = totalAmount.charges;
              additionalchargedetails = JSON.stringify(totalAmount.additionalChargeDetails);


              // Calculate Shipping Price
              getShippingPrice = await calculateShippingPrice(finalBasePriceWithCharges, ctx.req.headers.masterdetailid);
              if (getShippingPrice) {
                // finalOrderTotalAmount = getShippingPrice.totalamount;
                finalOrderShippingPrice = getShippingPrice.shippingprice;
              }
              // Calculate GST
              getGSTDetails = await calculateGST(ctx.req.headers.masterdetailid, finalBasePriceWithCharges, getFinalOrder.address)

              if (getGSTDetails) {
                var getObjectLength = Object.keys(getGSTDetails);
                if (getObjectLength.length === 2) {
                  finalOrderGSTPrice = getGSTDetails.igstPrice;
                  finalOrderTotalAmount += finalOrderGSTPrice;
                }
                if (getObjectLength.length === 4) {
                  finalOrderGSTPrice = getGSTDetails.cgstPrice + getGSTDetails.sgstPrice;
                  finalOrderTotalAmount += finalOrderGSTPrice;
                }
              }

            } else {
              // Calculate Shipping Price
              getShippingPrice = await calculateShippingPrice(finalOrderBasePrice, ctx.req.headers.masterdetailid);
              if (getShippingPrice) {
                // finalOrderTotalAmount = getShippingPrice.totalamount;
                finalOrderShippingPrice = getShippingPrice.shippingprice;
              }
              // Calculate GST
              getGSTDetails = await calculateGST(ctx.req.headers.masterdetailid, finalOrderBasePrice, getFinalOrder.address)

              if (getGSTDetails) {
                var getObjectLength = Object.keys(getGSTDetails);
                if (getObjectLength.length === 2) {
                  finalOrderGSTPrice = getGSTDetails.igstPrice;
                  finalOrderTotalAmount += finalOrderGSTPrice;
                }
                if (getObjectLength.length === 4) {
                  finalOrderGSTPrice = getGSTDetails.cgstPrice + getGSTDetails.sgstPrice;
                  finalOrderTotalAmount += finalOrderGSTPrice;
                }
              }
            }

            if (getFinalOrder.address) {
              getPincodeBasedDeliveryDetails = await calculatePincodeBasedDeliveryCharges(ctx.req.headers.masterdetailid, getFinalOrder.address);
              if (getPincodeBasedDeliveryDetails) {
                finalOrderPincodeBasedPrice = getPincodeBasedDeliveryDetails.charges
                finalOrderTotalAmount += finalOrderPincodeBasedPrice;
              }
            }


            if (getFinalOrderdetails) {
              // Update userId / orderId of user in orderdetails table

              for (let i = 0; i < getFinalOrderdetails.length; i++) {
                const element = getFinalOrderdetails[i];
                await orderdetailsModel.updateAll({
                  id: element.id
                }, {
                  amount: element.amount,
                  quantity: element.quantity,
                  createdby: ctx.req.body.userId,
                  orderId: getFinalOrder.id,
                  variation: element.variation ? element.variation : null
                });
              }

              // Set commoncounter
              await commonCounterModel.updateAll({
                userId: ctx.req.body.userId,
                masterdetailId: ctx.req.body.masterdetailid
              }, {
                cart: getFinalOrderdetails.length
              });

              // Get User details
              userDetails = await constants.commonFindOneFunction({
                model: userModel,
                whereObj: {
                  id: ctx.req.body.userId,
                  masterdetailId: ctx.req.body.masterdetailid
                }
              });

              // Update Order
              await orderModel.updateAll({
                id: getFinalOrder.id
              }, {
                createdby: ctx.req.body.userId,
                userId: ctx.req.body.userId,
                masterdetailId: ctx.req.headers.masterdetailid,
                orderstatus: await constants.ORDER_PENDING(ctx.req.headers.masterdetailid),
                totalamount: finalOrderTotalAmount,
                totalitems: getFinalOrderdetails.length,
                tax: getGSTDetails ? JSON.stringify(getGSTDetails) : null,
                shippingprice: finalOrderShippingPrice,
                baseprice: finalOrderBasePrice,
                additionalcharge: finaladditionalcharge,
                additionalchargedetails: additionalchargedetails,
                customername: userDetails.username ? titlecase.titleCase(userDetails.username) : null,
              });
            }

            // TODO use addLog for logging details
            console.log('------------------------------------------------');
            console.log('finalOrderBasePrice', finalOrderBasePrice);
            console.log('finalOrderShippingPrice', finalOrderShippingPrice);
            console.log('finalOrderGSTPrice', finalOrderGSTPrice);
            console.log('finalOrderPincodeBasedPrice', finalOrderPincodeBasedPrice);
            console.log('------------------------------------------------');
            console.log('finalOrderTotalAmount', finalOrderTotalAmount);
          }

        }
      }
    } catch (error) {
      throw error;
    }
  });


  Usermetaauth.beforeRemote('findOne', async (ctx, modelInstance, next) => {
    // manual check for authentication
    if (ctx.args.filter != undefined && ctx.args.filter.where.userId != undefined && ctx.args.filter.where.userId == ctx.req.accessToken.userId) {
      return;
    } else {
      throw constants.createError(401, 'Authorization Required');
    }
  });

  Usermetaauth.beforeRemote('prototype.patchAttributes', async (ctx, modelInstance, next) => {
    // manual check for authentication
    if (ctx.instance.$userId != ctx.req.accessToken.userId) {
      throw constants.createError(401, 'Authorization Required');
    }
  });
};

// function for save otp in usermetaauth table
async function sendOTP(sendotpObject) {
  try {
    await app.models.usermetaauth.updateAll({
      userId: sendotpObject[1]
    }, sendotpObject[0]);
    return {
      result: true
    }
  } catch (error) {
    throw error;
  }
}

async function getUniquieArrayOfObject(arr1, arr2) {
  // Increase quantity of product
  arr2.filter(item => {
    arr1.filter(innerItem => {
      if (item.productId === innerItem.productId) {
        innerItem.quantity += item.quantity;
      }
    });
  });
  // remove duplicate entries
  arr2.filter(item => {
    var index = arr1.findIndex((o) => o.productId === item.productId)
    if (index !== -1) arr2.splice(index, 1);
  });
  // concat array
  return arr1.concat(arr2);

}

async function getOrderDetails(params) {
  return await app.models.orderdetails.find({
    where: {
      orderId: params.orderId,
      userId: params.userId,
      masterdetailId: params.masterdetailId
    }
  });
}

async function calculateTotalAmount(orderdetails) {
  var totalAmount = 0;
  orderdetails.filter(item => totalAmount = totalAmount + (item.amount * item.quantity));
  return totalAmount;
}

async function calculateShippingPrice(baseprice, masterdetailId) {
  var totalamount = 0;
  var shippingprice = 0;

  var shippingPriceSetting = await constants.commonFindOneFunction({
    model: app.models.setting,
    whereObj: {
      registerallow: constants.SHIPPINGOPTIONS_LABLE,
      masterdetailId
    }
  });

  if (shippingPriceSetting && shippingPriceSetting.status === 1) {
    var shippingText = JSON.parse(shippingPriceSetting.text);
    shippingText = shippingText.find(e => e.status === 1);
    // when Flat Price Shipping is active from setting
    if (shippingText && shippingText.id === 3) {
      shippingText = shippingText.options;
      shippingText.filter(item => {
        if (item.maxCondition) {
          if (baseprice >= item.minValue) {
            shippingprice = item.charges;
            return;
          }
        } else if (baseprice >= item.minValue && baseprice <= item.maxValue) {
          shippingprice = item.charges;
          return;
        }
      });
      // set baseprice with shippingprice
      totalamount = baseprice + shippingprice;
    } else {
      return;
    }
  } else {
    return;
  }
  return {
    shippingprice,
    totalamount
  };
}

async function calculateGST(masterdetailId, baseprice, orderAddress) {
  var totalamount = 0;
  var tax = {};
  // Check Jewellery catalogue is not active
  var isJewelleryCatalogueActive = await constants.commonFindOneFunction({
    model: app.models.setting,
    whereObj: {
      registerallow: constants.CATALOGUEJEWELLARY_LABLE,
      masterdetailId
    }
  });

  if (isJewelleryCatalogueActive && isJewelleryCatalogueActive.status === 0) {
    // Get GST Setting
    var getGSTSetting = await constants.commonFindOneFunction({
      model: app.models.setting,
      whereObj: {
        registerallow: constants.MERCHANTINFORMATION_LABLE,
        masterdetailId
      }
    });

    if (getGSTSetting) {
      getGSTSetting = JSON.parse(getGSTSetting.text);
      if (getGSTSetting.enablegst === 1) {
        var sgst = (baseprice * getGSTSetting.SGST) / 100;
        var cgst = (baseprice * getGSTSetting.CGST) / 100;
        // Set Tax JSON
        tax.cgst = getGSTSetting.CGST;
        tax.cgstPrice = cgst;
        tax.sgst = getGSTSetting.SGST;
        tax.sgstPrice = sgst;

        // Calculation if IGST
        if (orderAddress) {
          orderAddress = JSON.parse(orderAddress);
          if (Object.keys(orderAddress).length !== 0 && orderAddress.billingaddress) {
            // get order billing
            var billingaddress = orderAddress.billingaddress;
            // Get User country name
            var getCountryName = await constants.commonFindOneFunction({
              model: app.models.state,
              whereObj: {
                id: billingaddress.countryId,
                masterdetailId
              }
            });
            if (getCountryName.name !== getGSTSetting.countryname) {
              tax = {};
              var igst = (baseprice * getGSTSetting.IGST) / 100;
              // set tax json
              tax.igst = getData.IGST;
              tax.igstPrice = igst;
            }
          }
        }
      } else {
        return;
      }
    }
    return tax;
  } else {
    return;
  }
}


async function calculatePincodeBasedDeliveryCharges(masterdetailId, orderAddress) {
  // Get Setting
  var getPincodeDeliverySetting = await constants.commonFindOneFunction({
    model: app.models.setting,
    whereObj: {
      registerallow: constants.SETTING_PINCODE_DELIVERY,
      masterdetailId
    }
  });

  if (getPincodeDeliverySetting && getPincodeDeliverySetting.status === 1) {
    getPincodeDeliverySetting = JSON.parse(getPincodeDeliverySetting.text);
    orderAddress = JSON.parse(orderAddress);
    if (Object.keys(orderAddress).length !== 0 && orderAddress.shippingaddress && orderAddress.shippingaddress.zipcode) {
      return getPincodeDeliverySetting.find(obj => obj.pincode == orderAddress.shippingaddress.zipcode);
    } else {
      return;
    }
  } else {
    return;
  }

}

async function updateProductPriceBasedOnGroup(orderdetailsArray, groupId) {

  var productModel = app.models.product;
  var grouppriceModel = app.models.groupprice;
  var product, groupPrice;

  for (let i = 0; i < orderdetailsArray.length; i++) {
    const element = orderdetailsArray[i];
    // Get product price
    product = await productModel.findOne({
      where: {
        id: element.productId,
        masterdetailId: element.masterdetailId
      },
      deleted: true
    });
    // get group price
    groupPrice = await grouppriceModel.findOne({
      where: {
        groupId: groupId,
        productId: product.id,
        masterdetailId: element.masterdetailId
      }
    });
    // if exist than update price of order
    if (groupPrice) {
      element.amount = groupPrice.newprice;
    }

  }

  return orderdetailsArray;

}
