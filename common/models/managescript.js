'use strict';

const app = require("../../server/server");
const constants = require("../const");
const moment = require("moment");
var cache = require('memory-cache');
const settingConstants = require("../setting_constants");
const s3Constants = require("../s3_constants");
var NOTIFICATIONTYPE;
var textMessage, arabicTextMessage;
var isEmailLogin = false;
var sendS = require('../../server/bin/sendsms');
module.exports = function (Managescript) {

  Managescript.changeTemplateNotificationType = async (req) => {
    try {
      // console.log(req);
      var getNotificationType = await app.models.notificationtype.find();
      var message;
      var templateId;
      for (let i = 0; i < getNotificationType.length; i++) {
        const element = getNotificationType[i];

        if (element.code == 'ORDER/INPROGRESS') {
          templateId = '1307163896625717750';
          message = '[merchant_business_name] has marked your order [orderno]  "In Progress". Notification from SufalamTech - BizOn365';
        } else if (element.code == 'ORDER/PENDING') {
          templateId = '1307164732376370569';
          message = 'Thank you for your order [orderno] for [noofproducts] products to [merchant_business_name]. Notification from SufalamTech - BizOn365 platform.';
        } else if (element.code == 'ORDER/COMFIRMED') {
          templateId = '1307163937573869776';
          message = '[merchant_business_name] has confirmed your order [orderno] of [noofproduct] products. Notification from SufalamTech - BizOn365';
        } else if (element.code == 'ORDER/CANCELLED') {
          templateId = '1307163937629538513';
          message = '[merchant_business_name] has cancelled your order [orderno] of [noofproduct] products. Notification from SufalamTech - BizOn365';
        } else if (element.code == 'ORDER/REJECTED') {
          templateId = '1307163937657156984';
          message = '[merchant_business_name] has rejected your order [orderno] of [noofproduct] products. Notification from SufalamTech - BizOn365';
        } else if (element.code == 'ORDER/DELIVERED') {
          templateId = '1307163937690700351';
          message = '[merchant_business_name] has marked your order [orderno] of [noofproduct] products as "Delivered". Notification from SufalamTech - BizOn365';
        } else if (element.code == 'SIGNIN/OTP/ANDROID') {
          templateId = '1307163937725768365';
          message = 'Your One Time Password (OTP) is [otp] for signin to [merchant_business_name]. Notification from SufalamTech - BizOn365';
        } else if (element.code == 'SIGNUP/OTP/ANDROID') {
          templateId = '1307163937769155338';
          message = 'Your One Time Password (OTP) is [otp] for signin to [merchant_business_name]. Notification from SufalamTech - BizOn365';
        } else if (element.code == 'DEVICE/CHANGE') {
          templateId = '1307161881025491181';
          message = 'You have logged in with another device\r\nSufalam';
        } else if (element.code == 'SIGNIN/OTP') {
          templateId = '1307163937744615601';
          message = 'Your One Time Password (OTP) is [otp] for signin to [merchant_business_name]. Notification from SufalamTech - BizOn365';
        } else if (element.code == 'SIGNUP/OTP') {
          templateId = '1307163937769155338';
          message = 'Your One Time Password (OTP) is [otp] for signin to [merchant_business_name]. Notification from SufalamTech - BizOn365';
        } else if (element.code == 'CART/PUSH') {
          templateId = '1307163937812405949';
          message = 'You have [noofproduct] items in your cart on [merchant_business_name]. Please login to [store_link] to checkout. Notification from SufalamTech - BizOn365';
        } else if (element.code == 'CREDENTIALS/SMS') {
          templateId = '1307163937837352063';
          message = 'Dear [username],your store [appname] has been created successfully using cell number [cellnumber]. Please login to [storelink] to setup your store. Notification from SufalamTech - BizOn365';
        } else if (element.code == 'CELLNUMBER/CHANGE') {
          templateId = '1307161881006769637'
          message = 'Dear [username],your cellnumber of [appname] is changed from [oldcell] to [newcell].\r\nSufalam'
        } else if (element.code == 'INFORMATION') {
          templateId = '1307161881000691093'
          message = 'This information will show in your [appname] application contact us screen, so if user have any query regarding our product or anything then they can easily contact us. Please provide the valid and correct information.\r\nSufalam'
        } else if (element.code == 'ORDER/UPDATE/ADMIN') {
          templateId = '1307161880997297221'
          message = 'Your order [orderno] has been updated by the seller.\r\nSufalam'
        } else if (element.code == 'CODE/INSTANCE_SMS') {
          templateId = '1307161832037251640'
          message = 'Dear[name],\r\nYour login code is [code] .\r\nPlease proceed further with your account\r\nThank You.BizOn Team'
        } else if (element.code == 'SMS/VERIFICATION') {
          templateId = '1307161832049563441'
          message = 'Dear [name], Please click on below link to verify your BizOn account.\r\nLink : [text] Click Here\r\nThank You. BizOn Team'
        } else {
          templateId = null;
          message = element.$textmessage;
        }

        await app.models.notificationtype.updateAll({
          code: element.code
        }, {
          textmessage: message,
          notification: message,
          templateId: templateId
        });

      }
    } catch (error) {
      throw error;
    }
  };

  Managescript.updateCredentialsSMSTemplate = async () => {
    try {
      var getNotificationType = await app.models.notificationtype.find({
        where: {
          code: 'CREDENTIALS/SMS'
        }
      });
      var message;
      for (let i = 0; i < getNotificationType.length; i++) {
        const element = getNotificationType[i];
        message = 'Dear [username],your store [appname] has been created successfully using cell number [cellnumber]. Please login to [storelink] to setup your store. Notification from SufalamTech - BizOn365';
        await app.models.notificationtype.updateAll({
          id: element.id
        }, {
          textmessage: message,
          notification: message
        });
      }
    } catch (error) {

    }
  }

  Managescript.manageNewOrderPendingSMSTemplate = async () => {
    try {
      var getNotificationType = await app.models.notificationtype.find({
        where: {
          code: 'ORDER/PENDING'
        }
      });
      var message;
      for (let i = 0; i < getNotificationType.length; i++) {
        const element = getNotificationType[i];
        message = 'Thank you for your order [orderno] for [noofproducts] products to [merchant_business_name]. Notification from SufalamTech - BizOn365 platform.';
        await app.models.notificationtype.updateAll({
          id: element.id
        }, {
          textmessage: message,
          textmessage_html: 'Dear [name],<br><br>Thank you for your order [orderno] of [noofproduct] products to [companyname].<br><br>Thank You.<br>BizOn365 Team',
          notification: message,
          templateId: '1307164732376370569'
        });
      }
    } catch (error) {
      throw error;
    }
  }

  Managescript.manageLastmodifiedDateOfPrice = async () => {
    var productModel = app.models.product;
    try {
      var getAllProducts = await productModel.find();
      for (let i = 0; i < getAllProducts.length; i++) {
        const element = getAllProducts[i];
        if (!element.lastModifiedPriceDate) {
          await productModel.updateAll({
            id: element.id
          }, {
            lastModifiedPriceDate: formatDate(element.created, 'yyyy-MM-dd HH:mm:ss.S')
          });
        }
      }
    } catch (error) {
      throw error;
    }
  }

  Managescript.manageCartCounterOfParticularInstanceUserWise = async (req) => {

    var userModel = app.models.user;
    var commoncounterModel = app.models.commoncounter
    var orderModel = app.models.order;
    var orderdetailsModel = app.models.orderdetails;

    try {
      var getAllUsers = await userModel.find({
        where: {
          roleId: {
            inq: [constants.USER_ROLEID, constants.GUEST_ROLEID]
          },
          masterdetailId: req.query.filter.where.id
        }
      });
      for (let i = 0; i < getAllUsers.length; i++) {
        const element = getAllUsers[i];

        // Check user having order in cart
        var getUserOrder = await orderModel.findOne({
          where: {
            inshoppingcart: 1,
            userId: element.id,
            masterdetailId: req.query.filter.where.id
          }
        });
        if (getUserOrder) {
          var getOrderDetails = await orderdetailsModel.find({
            where: {
              orderId: getUserOrder.id,
              masterdetailId: req.query.filter.where.id
            }
          });
          await commoncounterModel.updateAll({
            userId: element.id,
            masterdetailId: req.query.filter.where.id
          }, {
            cart: getOrderDetails ? getOrderDetails.length : 0,
            notifications: 0
          });
        } else {
          await commoncounterModel.updateAll({
            userId: element.id,
            masterdetailId: req.query.filter.where.id
          }, {
            cart: 0,
            notifications: 0
          });
        }
      }
    } catch (error) {
      throw error;
    }
  }

  Managescript.postNotificationType = async (req) => {

    var notificationTypesModel = app.models.notificationtype;

    try {

      // for (let i = 0; i < req.body.length; i++) {
      //   const element = req.body[i];
      //   await notificationTypesModel.create({
      //     code: element.code,
      //     notification: element.notification,
      //     created: new Date()
      //   });
      //   console.log(element.code, ': Notificationtype Inserted');
      // }

      await notificationTypesModel.create({
        code: req.body.code,
        notification: req.body.notification,
        created: new Date()
      });

    } catch (error) {
      throw error;
    }
  };

  Managescript.postInvoiceStatus = async (req) => {

    var invoicestatusModel = app.models.invoicestatus;
    var statusArray = ['PAID', 'UNPAID', 'DRAFT', 'PARTIALLY_PAID'];

    try {
      var getMasterdetailIData = await app.models.masterdetail.find();
      for (let i = 0; i < getMasterdetailIData.length; i++) {
        const element = getMasterdetailIData[i];
        statusArray.filter(async e => {

          await invoicestatusModel.create({
            name: e,
            status: 1,
            created: new Date(),
            masterdetailId: element.id
          });

        });
      }
    } catch (error) {
      throw error;
    }
  };

  Managescript.patchMasterdetailDescriptionJSON = async (req) => {

    var masterdetailModel = app.models.masterdetail;

    try {

      var getMasterDetails = await masterdetailModel.findOne({
        where: {
          id: req.body.id
        }
      });

      if (getMasterDetails) {
        await masterdetailModel.updateAll({
          id: req.body.id
        }, {
          description: constants.stringifyJson(req.body.description),
          name: req.body.name
        });
        return getMasterDetails = await masterdetailModel.findById(req.body.id);
      }

    } catch (error) {
      throw error;
    }
  };

  Managescript.setDynamicOrderstatus = async (req) => {

    try {

      var orders = await app.models.order.find();

      if (orders.length > 0) {
        for (let i = 0; i < orders.length; i++) {
          const e = orders[i];

          if (e.masterdetailId != '752c80a9-e15f-416a-b79b-a0168ec15402' && e.orderstatus <= 6) {
            var status;
            if (e.orderstatus == 1) {
              status = 'PENDING'
            } else if (e.orderstatus == 2) {
              status = 'CONFIRMED'
            } else if (e.orderstatus == 3) {
              status = 'INPROGRESS'
            } else if (e.orderstatus == 4) {
              status = 'DELIVERED'
            } else if (e.orderstatus == 5) {
              status = 'CANCELLED'
            } else if (e.orderstatus == 6) {
              status = 'REJECTED'
            }

            // to find status ID on basis of status name
            var orderstatus = await app.models.orderstatus.findOne({
              where: {
                status: status,
                masterdetailId: e.masterdetailId
              }
            });
            // update orderstatus from id obtained in above query
            await app.models.order.update({
              id: e.id,
              masterdetailId: e.masterdetailId
            }, {
              orderstatus: orderstatus.id
            });
          }
        }
      }

    } catch (error) {
      throw error;
    }
  };

  Managescript.setTotalUsersOfGroup = async (req) => {

    try {

      var masterDetailData = await app.models.masterdetail.find();

      for (let i = 0; i < masterDetailData.length; i++) {
        const element = masterDetailData[i];

        var groupData = await app.models.group.find({
          where: {
            masterdetailId: element.id
          }
        });

        for (let j = 0; j < groupData.length; j++) {
          const ele = groupData[j];
          var userData = await app.models.user.find({
            where: {
              groupId: ele.id,
              masterdetailId: element.id,
              roleId: 2
            }
          });
          await app.models.group.updateAll({
            id: ele.id,
            masterdetailId: ele.masterdetailId
          }, {
            noofusers: userData.length
          });
        }
      }

    } catch (error) {
      throw error;
    }
  };

  Managescript.setTotalproductsOfCategory = async (req) => {

    try {
      // get all sub-categories
      var categoryData = await app.models.category.find({
        where: {
          parentId: {
            neq: null
          }
        }
      });

      for (let i = 0; i < categoryData.length; i++) {
        const element = categoryData[i];

        // get products on basis of category Id
        var productData = await app.models.product.find({
          where: {
            categoryId: element.id,
            masterdetailId: element.masterdetailId
          }
        });

        //update total products of the category
        await app.models.category.update({
          id: element.id,
          masterdetailId: element.masterdetailId
        }, {
          totalproducts: productData.length
        });
      }

    } catch (error) {
      throw error;
    }
  };

  Managescript.SetTotalSubcategoryCount = async (req) => {

    try {

      var categoryData = await app.models.category.find({
        where: {
          parentId: null
        }
      });

      for (let i = 0; i < categoryData.length; i++) {
        const element = categoryData[i];
        var subCategory = await constants.commonFindFunction({
          model: app.models.category,
          whereObj: {
            parentId: element.id,
            masterdetailId: element.masterdetailId
          }
        });
        await app.models.category.update({
          id: element.id,
          masterdetailId: element.masterdetailId
        }, {
          totalsubcategories: subCategory.length
        });
      }

    } catch (error) {
      throw error;
    }
  };


  Managescript.deleteTestUsers = async (req) => {

    try {
      notificationType

      //delete user from user table
      var users = await constants.commonFindOneFunction({
        model: app.models.user,
        whereObj: {
          id: req.query.userId
        }
      });
      if (users) {
        await app.models.user.update({
          id: req.query.userId
        }, {
          deletedAt: new Date()
        });
        console.log("user deleted");
      }

      // delete from usermetaauth
      var usermetaauth = await constants.commonFindOneFunction({
        model: app.models.usermetaauth,
        whereObj: {
          userId: req.query.userId
        }
      });
      if (usermetaauth) {
        await app.models.usermetaauth.update({
          userId: req.query.userId
        }, {
          deletedAt: new Date()
        });
        console.log("usermetaauth deleted");
      }

      //decrease user count in group
      var groups = await constants.commonFindOneFunction({
        model: app.models.group,
        whereObj: {
          id: users.groupId
        }
      });
      if (groups) {
        await app.models.group.update({
          id: users.groupId
        }, {
          noofusers: groups.noofusers - 1
        });
        console.log("decreased from group");
      }

      // delete from common counter
      var commonCounters = await constants.commonFindOneFunction({
        model: app.models.commoncounter,
        whereObj: {
          userId: req.query.userId
        }
      });
      if (commonCounters) {
        await app.models.commoncounter.update({
          id: req.query.userId
        }, {
          deletedAt: new Date()
        });
        console.log("commoncounter deleted");
      }

      // delete from order
      var orders = await constants.commonFindFunction({
        model: app.models.order,
        whereObj: {
          userId: req.query.userId
        }
      });
      if (orders) {
        await app.models.order.updateAll({
          userId: req.query.userId
        }, {
          deletedAt: new Date()
        });
        console.log("orders deleted");
      }

      // delete from orderdetails
      var orderdetails = await constants.commonFindFunction({
        model: app.models.orderdetails,
        whereObj: {
          createdby: req.query.userId
        }
      });
      if (orderdetails) {
        await app.models.orderdetails.updateAll({
          createdby: req.query.userId
        }, {
          deletedAt: new Date()
        });
        console.log("orderdetails deleted");
      }

      // delete from notifications
      var notifications = await constants.commonFindFunction({
        model: app.models.notification,
        whereObj: {
          createdby: req.query.userId
        }
      });
      if (notifications.length > 0) {
        await app.models.notification.updateAll({
          createdby: req.query.userId
        }, {
          deletedAt: new Date()
        });
        console.log("notifications deleted");
      }

      // delete from notification receiver
      var notificationReceiver = await constants.commonFindFunction({
        model: app.models.notificationreceiver,
        whereObj: {
          userId: req.query.userId
        }
      });
      if (notificationReceiver.length > 0) {
        await app.models.notificationreceiver.updateAll({
          userId: req.query.userId
        }, {
          deletedAt: new Date()
        });
        console.log("notification receiver deleted");
      }

      // delete from shorturl
      var shortUrl = await constants.commonFindFunction({
        model: app.models.shorturl,
        whereObj: {
          userId: req.query.userId
        }
      });
      if (shortUrl.length > 0) {
        await app.models.shorturl.updateAll({
          userId: req.query.userId
        }, {
          deletedAt: new Date()
        });
        console.log("shorturl deleted");
      }

    } catch (error) {
      throw error;
    }
  };


  Managescript.updateDefaultImage = async (req) => {

    try {

      await app.models.categorymedia.updateAll({}, {
        categoryname: 'default_category.png'
      });

      await app.models.productmedia.updateAll({}, {
        productname: 'noimagefound.png'
      });

      await app.models.user.updateAll({
        profilepic: {
          neq: null
        }
      }, {
        profilepic: 'defaultuser.jpeg'
      });

      await app.models.collection.updateAll({}, {
        collection_image: 'noimagefound.png'
      });

      // // Get First 300 Products Which are created first
      // var getProducts = await app.models.product.find({
      //   where: {
      //     masterdetailId: '752c80a9-e15f-416a-b79b-a0168ec15402'
      //   }, order: 'created DESC',
      //   limit: 300
      // });
      // console.log(getProducts.length);
      // return getProducts;

    } catch (error) {
      throw error;
    }
  };

  Managescript.sendEmail = async (req) => {
    try {
      var textMessage = 'Dear [name], <br><br> Your verification OTP is [code].<br>Please use this OTP to complete the verification process.<br><br>Thank You.<br>' + app.get('serverConfig').emailSenderName + ' Team';
      textMessage = textMessage.replace('[name]', 'Akib Dahya');
      textMessage = textMessage.replace('[code]', '0000');
      sendEmail(
        'akibjavid.dahya@sufalamtech.com', // Send to whom
        textMessage, // Content of Email
        'Verification Code for your ' + app.get('serverConfig').emailSenderName + '  account', // Subject of Email
        app.get('serverConfig').emailSenderName // Merchant Name
      );
    } catch (error) {
      throw error;
    }
  };

  Managescript.managePlanCreationAndExpireDate = async (req) => {

    var masterdetailmetaModel = app.models.masterdetailmeta;

    try {

      var masterMetaData = await constants.commonFindFunction({
        model: masterdetailmetaModel,
        whereObj: {
          configuration: null
        }
      });

      masterMetaData.filter(obj => {

        var mastermetaconfigJson = {
          "planDetails": [{
            "purchaseStartDate": moment(obj.created).format('YYYY-MM-DD'),
            "purchaseStartTime": moment(obj.created).format('hh-mm-ss'),
            "purchaseExpireDate": moment(obj.created).add(12, 'M').format('YYYY-MM-DD'),
            "purchaseExpireTime": moment(obj.created).format('hh-mm-ss'),
            "isPlanUpdated": false,
            "updatedExpireDate": null,
            "updatedExpireTime": null,
          }]
        }

        masterdetailmetaModel.update({
          id: obj.id,
          masterdetailId: obj.masterdetailId,
        }, {
          configuration: constants.stringifyJson(mastermetaconfigJson)
        });

      });

    } catch (error) {
      throw error;
    }

  }

  Managescript.clonePabraiToSufalam = async () => {
    var categotyModel = app.models.category;
    var categorymediaModel = app.models.categorymedia;
    var productModel = app.models.product;
    var productmediaModel = app.models.productmedia;

    try {
      console.log(' ::: clonePabraiToSufalam started :::');

      // get all main category of pabrai
      var maincategory = await categotyModel.find({
        where: {
          masterdetailId: '601f12f4-81ef-47dc-9c85-087272d23998',
          parentId: null
        }
      });

      for (let i = 0; i < maincategory.length; i++) {
        const mainONEcategory = maincategory[i];

        console.log(' ::: clonePabraiToSufalam started maincategory :::');

        // store one new category
        var newMain = await categotyModel.create({
          name: mainONEcategory.name,
          categorystatus: mainONEcategory.categorystatus,
          totalproducts: mainONEcategory.totalproducts,
          createdby: '957a320b-3b8a-4ea6-866e-787dca5ae56a',
          modifiedby: '957a320b-3b8a-4ea6-866e-787dca5ae56a',
          totalsubcategories: mainONEcategory.totalsubcategories,
          parentId: null,
          masterdetailId: '354c064b-3820-4f0b-83a8-913bc3978982'
        });

        // find main category media
        var maincategoryMedia = await categorymediaModel.findOne({
          where: {
            categoryId: mainONEcategory.id
          }
        });

        // store main category media
        await categorymediaModel.create({
          categoryname: maincategoryMedia.categoryname,
          createdby: '957a320b-3b8a-4ea6-866e-787dca5ae56a',
          modifiedby: '957a320b-3b8a-4ea6-866e-787dca5ae56a',
          categoryId: newMain.id,
          masterdetailId: '354c064b-3820-4f0b-83a8-913bc3978982'
        });

        // find all subactegory of Pabrai
        var subcategory = await categotyModel.find({
          where: {
            masterdetailId: '601f12f4-81ef-47dc-9c85-087272d23998',
            parentId: mainONEcategory.id
          }
        });

        for (let j = 0; j < subcategory.length; j++) {
          const subONEcategory = subcategory[j];

          console.log(' ::: clonePabraiToSufalam started subcategory :::');

          // store new subcategory
          var newSub = await categotyModel.create({
            name: subONEcategory.name,
            categorystatus: subONEcategory.categorystatus,
            totalproducts: subONEcategory.totalproducts,
            createdby: '957a320b-3b8a-4ea6-866e-787dca5ae56a',
            modifiedby: '957a320b-3b8a-4ea6-866e-787dca5ae56a',
            totalsubcategories: subONEcategory.totalsubcategories,
            parentId: newMain.id,
            masterdetailId: '354c064b-3820-4f0b-83a8-913bc3978982'
          });

          // find sub category media
          var subcategoryMedia = await categorymediaModel.findOne({
            where: {
              categoryId: subONEcategory.id
            }
          });

          // store sub category media
          await categorymediaModel.create({
            categoryname: subcategoryMedia.categoryname,
            createdby: '957a320b-3b8a-4ea6-866e-787dca5ae56a',
            modifiedby: '957a320b-3b8a-4ea6-866e-787dca5ae56a',
            categoryId: newSub.id,
            masterdetailId: '354c064b-3820-4f0b-83a8-913bc3978982'
          });


          // get all products of Pabrai
          var oldProducsts = await productModel.find({
            where: {
              masterdetailId: '601f12f4-81ef-47dc-9c85-087272d23998',
              categoryId: subONEcategory.id
            }
          });

          for (let k = 0; k < oldProducsts.length; k++) {
            const oldONEProducst = oldProducsts[k];

            console.log(' ::: clonePabraiToSufalam started oldProducsts :::');

            // store new product
            var newProduct = await productModel.create({
              name: oldONEProducst.name,
              price: oldONEProducst.price,
              availablequantity: oldONEProducst.availablequantity,
              productstatus: oldONEProducst.productstatus,
              inInquiry: oldONEProducst.inInquiry,
              expecteddays: oldONEProducst.expecteddays,
              createdby: '957a320b-3b8a-4ea6-866e-787dca5ae56a',
              modifiedby: '957a320b-3b8a-4ea6-866e-787dca5ae56a',
              sellcounter: oldONEProducst.sellcounter,
              categoryId: newSub.id,
              userId: '957a320b-3b8a-4ea6-866e-787dca5ae56a',
              other: oldONEProducst.other,
              description: oldONEProducst.description,
              productdetails: oldONEProducst.productdetails,
              productvariation: oldONEProducst.productvariation,
              variationconfig: oldONEProducst.variationconfig,
              productunit: oldONEProducst.productunit,
              productbrochure: oldONEProducst.productbrochure,
              masterdetailId: '354c064b-3820-4f0b-83a8-913bc3978982'
            });

            // find product media
            var productMedia = await productmediaModel.find({
              where: {
                masterdetailId: '601f12f4-81ef-47dc-9c85-087272d23998',
                productId: oldONEProducst.id
              }
            });

            for (let m = 0; m < productMedia.length; m++) {
              const ONEproductMedia = productMedia[m];

              // store product media
              await productmediaModel.create({
                productname: ONEproductMedia.productname,
                createdby: '957a320b-3b8a-4ea6-866e-787dca5ae56a',
                modifiedby: '957a320b-3b8a-4ea6-866e-787dca5ae56a',
                productId: newProduct.id,
                masterdetailId: '354c064b-3820-4f0b-83a8-913bc3978982'
              });

            }

          }

        }

      }

      console.log(' ::: clonePabraiToSufalam Done :::');

    } catch (error) {
      throw error;
    }
  };

  Managescript.experimentAPI = async (req, code) => {
    try {

      // for (var i = 0; i < 5; i++) {
      //   console.log(i);
      //   continue;
      //   console.log('oo');
      // }
      // return 'Hi! Welcome to BizOn365';

      // Delete Orders
      // await app.models.order.updateAll({
      //   masterdetailId: '645d3407-c3e9-4e69-ad74-a8c5c1722a25'
      // }, {
      //   deletedAt: new Date()
      // });

      var variationConfig = [{
        "id": 1,
        "name": "Size",
        "Size": [{
          "itemname": "X", "parentType": "Size"
        }]
      }, {
        "id": 2,
        "name": "Color",
        "Color": [{
          "itemname": "Red", "parentType": "Color"
        }, {
          "itemname": "Green", "parentType": "Color"
        }, {
          "itemname": "Black", "parentType": "Color"
        }]
      }];

      for (let i = 0; i < variationConfig.length; i++) {
        const element = variationConfig[i];
        console.log(Object.entries(element).length);
      }

    } catch (error) {
      throw error;
    }
  };

  Managescript.addLocations = async (req) => {
    var stateModel = app.models.state;
    var cityModel = app.models.city;
    try {

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
                masterdetailId: req.query.where.masterdetailId
              }
            });
            if (!getCountry) {
              await app.models.state.create({
                name: element.country,
                parentId: null,
                masterdetailId: req.query.where.masterdetailId
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
                masterdetailId: req.query.where.masterdetailId
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
                  masterdetailId: req.query.where.masterdetailId
                }
              });
              if (!getState) {
                await stateModel.create({
                  name: element.state,
                  parentId: getCountry.id,
                  masterdetailId: req.query.where.masterdetailId
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
                masterdetailId: req.query.where.masterdetailId
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
                  parentId: getState.id,
                  masterdetailId: req.query.where.masterdetailId
                }
              });
              if (!getCity) {
                await cityModel.create({
                  name: element.city,
                  stateId: getState.id,
                  masterdetailId: req.query.where.masterdetailId
                });
                console.log(element.state + ' - ' + element.city + ' City Inserted');
              }
            }
          }
        }

      }

    } catch (error) {
      throw error;
    }

  };

  Managescript.updateTenantConfig = async (req) => {
    try {

      // if (req.query.filter.where.isRecurringPaymentEnabled && typeof req.query.filter.where.isRecurringPaymentEnabled === 'string') {
      //   req.query.filter.where.isRecurringPaymentEnabled === 'false' ? req.query.filter.where.isRecurringPaymentEnabled = false : req.query.filter.where.isRecurringPaymentEnabled = true;
      // }
      // if (req.query.filter.where.isEmailBasedLogin && typeof req.query.filter.where.isEmailBasedLogin === 'string') {
      //   req.query.filter.where.isEmailBasedLogin === 'false' ? req.query.filter.where.isEmailBasedLogin = false : req.query.filter.where.isEmailBasedLogin = true;
      // }
      // if (req.query.filter.where.maxDiscountPercentage && typeof req.query.filter.where.maxDiscountPercentage === 'string') {
      //   req.query.filter.where.maxDiscountPercentage = parseInt(req.query.filter.where.maxDiscountPercentage, 0);
      // }
      if (req.query.filter.where.maxCellnumberDigitLimit && typeof req.query.filter.where.maxCellnumberDigitLimit === 'string') {
        req.query.filter.where.maxCellnumberDigitLimit = parseInt(req.query.filter.where.maxCellnumberDigitLimit, 0);
      }
      if (req.query.filter.where.isDarkMode && typeof req.query.filter.where.isDarkMode === 'string') {
        req.query.filter.where.isDarkMode === 'false' ? req.query.filter.where.isDarkMode = false : req.query.filter.where.isDarkMode = true;
      }
      if (req.query.filter.where.isDefaultLoader && typeof req.query.filter.where.isDefaultLoader === 'string') {
        req.query.filter.where.isDefaultLoader === 'false' ? req.query.filter.where.isDefaultLoader = false : req.query.filter.where.isDefaultLoader = true;
      }
      if (req.query.filter.where.isShowChangeLanguageModalPopUp && typeof req.query.filter.where.isShowChangeLanguageModalPopUp === 'string') {
        req.query.filter.where.isShowChangeLanguageModalPopUp === 'false' ? req.query.filter.where.isShowChangeLanguageModalPopUp = false : req.query.filter.where.isShowChangeLanguageModalPopUp = true;
      }
      if (req.query.filter.where.keepLogoOnRightSideOnDashboard && typeof req.query.filter.where.keepLogoOnRightSideOnDashboard === 'string') {
        req.query.filter.where.keepLogoOnRightSideOnDashboard === 'false' ? req.query.filter.where.keepLogoOnRightSideOnDashboard = false : req.query.filter.where.keepLogoOnRightSideOnDashboard = true;
      }
      if (req.query.filter.where.isShowXEModule && typeof req.query.filter.where.isShowXEModule === 'string') {
        req.query.filter.where.isShowXEModule === 'false' ? req.query.filter.where.isShowXEModule = false : req.query.filter.where.isShowXEModule = true;
      }
      if (req.query.filter.where.isShowLastModifiedDate && typeof req.query.filter.where.isShowLastModifiedDate === 'string') {
        req.query.filter.where.isShowLastModifiedDate === 'false' ? req.query.filter.where.isShowLastModifiedDate = false : req.query.filter.where.isShowLastModifiedDate = true;
      }

      var getMasterDetails = await app.models.masterdetail.find();
      for (let i = 0; i < getMasterDetails.length; i++) {
        const element = getMasterDetails[i];
        var getTenantConfig = await app.models.setting.findOne({
          where: {
            registerallow: constants.SETTING_TENANT_CONFIG,
            masterdetailId: element.id
          }
        });

        // if (element.id === '6b623f64-ed4c-46fb-88f0-ce700aa6fcb1') {
        //   req.query.filter.where.isShowXEModule = true;
        // } else {
        //   req.query.filter.where.isShowXEModule = false;
        // }

        if (element.id === '645d3407-c3e9-4e69-ad74-a8c5c1722a25') {
          req.query.filter.where.isShowLastModifiedDate = true;
        } else {
          req.query.filter.where.isShowLastModifiedDate = false;
        }

        if (getTenantConfig) {
          var getTextData = JSON.parse(getTenantConfig.text);
          // getTextData.isRecurringPaymentEnabled = req.query.filter.where.isRecurringPaymentEnabled;
          // getTextData.isEmailBasedLogin = req.query.filter.where.isEmailBasedLogin;
          // getTextData.maxDiscountPercentage = req.query.filter.where.maxDiscountPercentage;
          getTextData.maxCellnumberDigitLimit = req.query.filter.where.maxCellnumberDigitLimit;
          getTextData.uploadFilePlatform = req.query.filter.where.uploadFilePlatform;
          getTextData.merchantPanelType = req.query.filter.where.merchantPanelType;
          getTextData.isDarkMode = req.query.filter.where.isDarkMode;
          getTextData.isDefaultLoader = req.query.filter.where.isDefaultLoader;
          getTextData.keepLogoOnRightSideOnDashboard = req.query.filter.where.keepLogoOnRightSideOnDashboard;
          getTextData.isShowChangeLanguageModalPopUp = req.query.filter.where.isShowChangeLanguageModalPopUp;
          getTextData.isShowXEModule = req.query.filter.where.isShowXEModule;
          getTextData.isShowLastModifiedDate = req.query.filter.where.isShowLastModifiedDate;

          await app.models.setting.updateAll({
            registerallow: constants.SETTING_TENANT_CONFIG,
            masterdetailId: element.id
          }, {
            text: JSON.stringify(getTextData)
          });

        }
      }

    } catch (error) {
      throw error;
    }
  };

  Managescript.updatePlanDetails = async (req) => {
    try {

      var getMasterDetails = await app.models.masterdetail.find();
      for (let i = 0; i < getMasterDetails.length; i++) {
        const element = getMasterDetails[i];
        var getMasterdetailIMetaData = await app.models.masterdetailmeta.findOne({
          where: {
            masterdetailId: element.id
          }
        });

        if (getMasterdetailIMetaData) {
          var getConfigurationData = JSON.parse(getMasterdetailIMetaData.configuration);
          getConfigurationData.planDetails[0].isShowRenewPlanPopup = false;
          await app.models.masterdetailmeta.updateAll({
            masterdetailId: element.id
          }, {
            configuration: JSON.stringify(getConfigurationData)
          });
        }

      }

    } catch (error) {
      throw error;
    }
  };

  Managescript.updateStateId = async (req) => {
    try {

      var cities = await app.models.city.find({
        where: {
          stateId: {
            eq: null
          },
          masterdetailId: {
            neq: null
          }
        }
      });

      var locationData = await app.models.setting.findOne({
        where: {
          registerallow: constants.SETTING_LOCATION_DETAILS,
          status: 1
        }
      });

      locationData = JSON.parse(locationData.text)
      locationData = locationData.Cities;

      for (let i = 0; i < cities.length; i++) {
        const element = cities[i];

        var city = locationData.find(item => item.city === element.name);
        s
        var stateData = await app.models.state.findOne({
          where: {
            name: city.state,
            masterdetailId: element.masterdetailId
          }
        });

        if (stateData) {
          await app.models.city.update({
            id: element.id,
            name: element.name,
            masterdetailId: element.masterdetailId
          }, {
            stateId: stateData.id,
            status: 1
          });
        } else {
          throw constants.createError(404, city.state + ' State not found.')
        }

      }

    } catch (error) {
      throw error;
    }
  };

  Managescript.updateEmailTemplates = async (req) => {
    var notificationModel = app.models.notificationtype;
    try {

      await notificationModel.updateAll({
        code: 'SIGNIN/OTP',
      }, {
        textmessage_html: "Dear [username],<br><br>Your One Time Password (OTP) is [otp] for Sign-in to [appname].<br><br>Thank You.<br>BizOn Team"
      });

      await notificationModel.updateAll({
        code: 'SIGNIN/OTP/ANDROID',
      }, {
        textmessage_html: "Dear [username],<br><br>Your One Time Password (OTP) is [otp] for Sign-in to [appname].<br><br>Thank You.<br>BizOn Team"
      });

      await notificationModel.updateAll({
        code: 'SIGNUP/OTP',
      }, {
        textmessage_html: "Dear [username],<br><br>Your One Time Password (OTP) is [otp] for Signup to [appname].<br><br>Thank You.<br>BizOn Team"
      });

      await notificationModel.updateAll({
        code: 'SIGNUP/OTP/ANDROID',
      }, {
        textmessage_html: "Dear [username],<br><br>Your One Time Password (OTP) is [otp] for Signup to [appname].<br><br>Thank You.<br>BizOn Team"
      });

      await notificationModel.create({
        code: 'EMAIL/FEEDBACK',
        textmessage_html: "Dear Admin,<br><br>You have received a feedback from [customername].<br><br>Feedback : [description]<br><br>User details are as below:<table><td>Name</td><td>:</td><td>[username]</td><tr></tr><tr></tr><td>Email</td><td>:</td><td>[email]</td><tr></tr><tr></tr><td>Contact</td><td>:</td><td>[cellnumber]</td></table><br><br>Thank You<br>Team BizOn",
        created: new Date(),
        modified: new Date()
      });

    } catch (error) {
      throw error;
    }
  };

  Managescript.updateInquiryNotificationTemplates = async (req) => {

    try {

      var inquiryPending = "UPDATE `notificationtype` SET `templateId` = '1307163937954826017', `textmessage` = 'Your inquiry [orderno] of [noofproduct] products has been submitted successfully to [merchant_business_name]. Notification from SufalamTech - BizOn365', `notification` = 'Your inquiry [orderno] of [noofproduct] products has been submitted successfully to [merchant_business_name]. Notification from SufalamTech - BizOn365' WHERE `notificationtype`.`id` = 606";
      executeQuery(inquiryPending);

      var inquiryInprogress = "UPDATE `notificationtype` SET `templateId` = '1307163937929106441', `textmessage` = '[merchant_business_name] has marked your inquiry [orderno] \"In Progress\". Notification from SufalamTech - BizOn365', `textmessage_html` = 'Dear [name],<br><br>Your inprogress [orderno] of [noofproduct] products are in progress. Order will be delivered within 48 hours.<br>[companyname]<br><br>Thank You.<br>BizOn Team', `notification` = '[merchant_business_name] has marked your inquiry [orderno] \"In Progress\". Notification from SufalamTech - BizOn365' WHERE `notificationtype`.`id` = 607";
      executeQuery(inquiryInprogress);

      var inquiryConfirmed = "UPDATE `notificationtype` SET `templateId` = '1307163937979848614', `textmessage` = '[merchant_business_name] has confirmed your inquiry [orderno] of [noofproduct] products. Notification from SufalamTech - BizOn365', `notification` = '[merchant_business_name] has confirmed your inquiry [orderno] of [noofproduct] products. Notification from SufalamTech - BizOn365' WHERE `notificationtype`.`id` = 608";
      executeQuery(inquiryConfirmed);

      var inquiryCancelled = "UPDATE `notificationtype` SET `templateId` = '1307163938000398813', `textmessage` = '[merchant_business_name] has cancelled your inquiry [orderno] of [noofproduct] products. Notification from SufalamTech - BizOn365', `notification` = '[merchant_business_name] has cancelled your inquiry [orderno] of [noofproduct] products. Notification from SufalamTech - BizOn365' WHERE `notificationtype`.`id` = 609";
      executeQuery(inquiryCancelled);

      var inquiryRejected = "UPDATE `notificationtype` SET `templateId` = '1307163938018882678', `textmessage` = '[merchant_business_name] has rejected your inquiry [orderno] of [noofproduct] products. Notification from SufalamTech - BizOn365', `notification` = '[merchant_business_name] has rejected your inquiry [orderno] of [noofproduct] products. Notification from SufalamTech - BizOn365' WHERE `notificationtype`.`id` = 610";
      executeQuery(inquiryRejected);

      var inquiryDelivered = "UPDATE `notificationtype` SET `textmessage` = '[merchant_business_name] has marked your inquiry [orderno] of [noofproduct] products as \"Delivered\". Notification from SufalamTech - BizOn365', `notification` = '[merchant_business_name] has marked your inquiry [orderno] of [noofproduct] products as \"Delivered\". Notification from SufalamTech - BizOn365' WHERE `notificationtype`.`id` = 611";
      executeQuery(inquiryDelivered);

    } catch (error) {
      throw error;
    }
  };

  Managescript.insertNewRole = async () => {

    try {

      var query = "INSERT INTO `role` (`id`, `name`, `description`, `created`, `modified`, `deletedAt`, `masterdetailId`) VALUES (NULL, 'Super Admin', 'super admin', NOW(), NOW(), NULL, '752c80a9-e15f-416a-b79b-a0168ec15402');";
      await new Promise((resolve, reject) => {
        app.datasources.mysql.connector.execute(query, null, (err, result) => {
          if (err) reject(err);
          resolve(result);
        });
      });

      // var updateRole = "UPDATE `role` SET `name` = 'Guest', `description` = 'guest' WHERE `role`.`id` = 5"
      // executeQuery(updateRole);

    } catch (error) {
      throw error;
    }
  };

  Managescript.updateOrderAndInquiryEmailTemplates = async (req) => {

    try {
      var orderInprogress = "UPDATE `notificationtype` SET `textmessage_html` = 'Dear [name],<br><br>Your order [orderno] of [noofproduct] products are in progress. Order will be delivered within 48 hours.<br>[companyname]<br><br>Thank You.<br>BizOn Team' WHERE `notificationtype`.`code` = 'ORDER/INPROGRESS'";
      executeQuery(orderInprogress);
      var orderPending = "UPDATE `notificationtype` SET `textmessage_html` = 'Dear [name],<br><br>Your order [orderno] of [noofproduct] products has been pending.<br>[companyname]<br><br>Thank You.<br>BizOn Team' WHERE `notificationtype`.`code` = 'ORDER/PENDING'";
      executeQuery(orderPending);
      var orderConfirmed = "UPDATE `notificationtype` SET `textmessage_html` = 'Dear [name],<br><br>Your order [orderno] of [noofproduct] products has been confirmed.<br>[companyname]<br><br>Thank You.<br>BizOn Team' WHERE `notificationtype`.`code` = 'ORDER/COMFIRMED'";
      executeQuery(orderConfirmed);
      var orderCancelled = "UPDATE `notificationtype` SET `textmessage_html` = 'Dear [name],<br><br>Your order [orderno] of [noofproduct] products has been cancelled.<br>[companyname]<br><br>Thank You.<br>BizOn Team' WHERE `notificationtype`.`code` = 'ORDER/CANCELLED'";
      executeQuery(orderCancelled);
      var orderRejected = "UPDATE `notificationtype` SET `textmessage_html` = 'Dear [name],<br><br>Your order [orderno] of [noofproduct] products has been rejected.<br>[companyname]<br><br>Thank You.<br>BizOn Team' WHERE `notificationtype`.`code` = 'ORDER/REJECTED'";
      executeQuery(orderRejected);
      var orderDelivered = "UPDATE `notificationtype` SET `textmessage_html` = 'Dear [name],<br><br>Your order [orderno] of [noofproduct] products has been delivered.<br>[companyname]<br><br>Thank You.<br>BizOn Team' WHERE `notificationtype`.`code` = 'ORDER/DELIVERED'";
      executeQuery(orderDelivered);
      var inquiryInprogress = "UPDATE `notificationtype` SET `textmessage_html` = 'Dear [name],<br><br>Your inquiry [orderno] of [noofproduct] products are in progress.<br>[companyname]<br><br>Thank You.<br>BizOn Team' WHERE`notificationtype`.`code` = 'INQUIRY/INPROGRESS'";
      executeQuery(inquiryInprogress);
      var inquiryPending = "UPDATE `notificationtype` SET `textmessage_html` = 'Dear [name],<br><br>Your inquiry [orderno] of [noofproduct] products has been pending.<br>[companyname]<br><br>Thank You.<br>BizOn Team' WHERE`notificationtype`.`code` = 'INQUIRY/PENDING'";
      executeQuery(inquiryPending);
      var inquiryConfirmed = "UPDATE `notificationtype` SET `textmessage_html` = 'Dear [name],<br><br>Your inquiry [orderno] of [noofproduct] products has been confirmed.<br>[companyname]<br><br>Thank You.<br>BizOn Team' WHERE`notificationtype`.`code` = 'INQUIRY/COMFIRMED'";
      executeQuery(inquiryConfirmed);
      var inquiryCancelled = "UPDATE `notificationtype` SET `textmessage_html` = 'Dear [name],<br><br>Your inquiry [orderno] of [noofproduct] products has been cancelled.<br>[companyname]<br><br>Thank You.<br>BizOn Team' WHERE`notificationtype`.`code` = 'INQUIRY/CANCELLED'";
      executeQuery(inquiryCancelled);
      var inquiryRejected = "UPDATE `notificationtype` SET `textmessage_html` = 'Dear [name],<br><br>Your inquiry [orderno] of [noofproduct] products has been rejected.<br>[companyname]<br><br>Thank You.<br>BizOn Team' WHERE`notificationtype`.`code` = 'INQUIRY/REJECTED'";
      executeQuery(inquiryRejected);
      var inquiryDelivered = "UPDATE `notificationtype` SET `textmessage_html` = 'Dear [name],<br><br>Your inquiry [orderno] of [noofproduct] products has been delivered.<br>[companyname]<br><br>Thank You.<br>BizOn Team' WHERE`notificationtype`.`code` = 'INQUIRY/DELIVERED'";
      executeQuery(inquiryDelivered);
    } catch (error) {
      throw error;
    }
  };

  Managescript.insertCustomDomainTemplate = async (req) => {
    try {
      var query = "INSERT INTO `notificationtype` (`id`, `textmessage`, `textmessage_html`, `code`, `notification`, `createdby`, `modifiedby`, `notificationId`, `deletedAt`, `created`, `modified`, `masterdetailId`, `templateId`) VALUES (NULL, NULL, 'Dear [name],<br><br>We have received your request to use your domain for the BizOn365 [appname] store.<br><br>Request Domain : [domainname]<br>Server IP : 1.1.1.1<br>Please point the domain to above given IP address. Our team started working on it. Once we are done with the configuration changes you will receive the email.<br><br>Thank You.<br>BizOn Team', 'CDM/EMAIL', NULL, NULL, NULL, NULL, NULL, NOW(), NOW(), NULL, NULL);";
      executeQuery(query);
    } catch (error) {
      throw error;
    }
  };

  Managescript.insertInvoiceTemplate = async (req) => {
    try {
      var query = "INSERT INTO `notificationtype` (`id`, `textmessage`, `textmessage_html`, `code`, `notification`, `createdby`, `modifiedby`, `notificationId`, `deletedAt`, `created`, `modified`, `masterdetailId`, `templateId`) VALUES (NULL, NULL, 'Dear [name],<br><br>Please see attached invoice for your order, placed on [date]. <br>Don’t hesitate to reach out if you have any questions.<br><br>Thank You.<br>BizOn Team', 'INVOICE/EMAIL', NULL, NULL, NULL, NULL, NULL, NOW(), NOW(), NULL, NULL);";
      executeQuery(query);
    } catch (error) {
      throw error;
    }
  };

  Managescript.getUsermetaauthDetails = async (req) => {
    try {
      var userDetails = await app.models.usermetaauth.findOne({
        where: {
          userId: req.query.userId
        },
        include: ['user']
      });
      return userDetails;
    } catch (error) {
      throw error;
    }
  };

  Managescript.changeStatusOfCustomDomainMapping = async (req) => {
    try {
      var masterDetails = await app.models.masterdetail.find({});
      for (let i = 0; i < masterDetails.length; i++) {
        const element = masterDetails[i];
        var getCustomDomainMappingSetting = await app.models.setting.findOne({
          where: {
            registerallow: constants.CUSTOM_DOMAIN_MAPPING_KEY,
            masterdetailId: element.id
          }
        });
        if (getCustomDomainMappingSetting) {
          await app.models.setting.updateAll({
            id: getCustomDomainMappingSetting.id
          }, {
            status: 0
          });
        }
      }
    } catch (error) {
      throw error;
    }
  };

  Managescript.updateInvoiceTemplate = async (req) => {
    try {
      var query = "UPDATE `notificationtype` SET `textmessage` = 'Dear [appname],<br><br>Please see attached invoice for order [orderno], placed by [username] on [date].<br><br>Thank You.<br>BizOn Team' WHERE `notificationtype`.`code` = 'INVOICE/EMAIL';";
      executeQuery(query);
    } catch (error) {
      throw error;
    }
  };

  Managescript.insertAdminOrderNotificationTemplate = async (req) => {
    try {
      var query = "INSERT INTO `notificationtype` (`id`, `textmessage`, `textmessage_html`, `code`, `notification`, `createdby`, `modifiedby`, `notificationId`, `deletedAt`, `created`, `modified`, `masterdetailId`, `templateId`) VALUES" +
        "(NULL, NULL, 'Dear [appname],<br><br>You have received a new order [orderno] from [username].<br><br>Thank You.<br>BizOn Team.', 'PLACEORDER/ADMIN', NULL, NULL, NULL, NULL, NULL, NOW(), NOW(), NULL, NULL)," +
        "(NULL, NULL, 'Dear [appname],<br><br>Order status for order [orderno] has been changed to [orderstatus].<br><br>Thank You.<br>BizOn Team.', 'ORDERSTATUS/ADMIN', NULL, NULL, NULL, NULL, NULL, NOW(), NOW(), NULL, NULL)," +
        "(NULL, NULL, 'Dear [appname],<br><br>You have received a new inquiry [orderno] from [username].<br><br>Thank You.<br>BizOn Team.', 'PLACEINQUIRY/ADMIN', NULL, NULL, NULL, NULL, NULL, NOW(), NOW(), NULL, NULL)," +
        "(NULL, NULL, 'Dear [appname],<br><br>Inquiry status for inquiry [orderno] has been changed to [orderstatus].<br><br>Thank You.<br>BizOn Team.', 'INQUIRYSTATUS/ADMIN', NULL, NULL, NULL, NULL, NULL, NOW(), NOW(), NULL, NULL);";
      executeQuery(query);
    } catch (error) {
      throw error;
    }
  };

  Managescript.updateLanguageJSON = async (req) => {
    try {
      var getLanguageJSON = await app.models.language.find({
        where: {
          key: req.body.key
        }
      });
      for (let i = 0; i < getLanguageJSON.length; i++) {
        const element = getLanguageJSON[i];
        var getLanguages = JSON.parse(element.value);

        if (req.body.hindiLanguage) {
          getLanguages.hi = req.body.hindiLanguage;
        }

        if (req.body.arabicLanguage) {
          getLanguages.ar = req.body.arabicLanguage;
        }

        if (req.body.englishLanguage) {
          getLanguages.en = req.body.englishLanguage;
        }

        var getAdminDetails = await app.models.user.findOne({
          where: {
            roleId: constants.ADMIN_ROLEID,
            masterdetailId: element.masterdetailId
          }
        });

        if (getAdminDetails && (getAdminDetails.companyname === null || getAdminDetails.companyname === undefined)) {
          getAdminDetails.companyname = getAdminDetails.username;
        }

        if (getLanguages.en) {
          getLanguages.en.app_name = getAdminDetails.companyname ? getAdminDetails.companyname : null;
        }
        if (getLanguages.ar) {
          getLanguages.ar.app_name = getAdminDetails.companyname ? getAdminDetails.companyname : null;
        }
        if (getLanguages.hi) {
          getLanguages.hi.app_name = getAdminDetails.companyname ? getAdminDetails.companyname : null;
        }
        await constants.addLog('Update Language JSON', req.body.key, getAdminDetails.companyname);
        await app.models.language.updateAll({
          id: element.id
        }, {
          value: JSON.stringify(getLanguages)
        });

      }
    } catch (error) {
      throw error;
    }
  };

  Managescript.updateTemplateID = async (req) => {
    try {

      var getNotificationType = await app.models.notificationtype.find();
      var message;
      var templateId;
      for (let i = 0; i < getNotificationType.length; i++) {
        const element = getNotificationType[i];

        if (element.masterdetailId != '5494ffd6-ba63-4e69-8760-9e3d454b9659' &&
          element.masterdetailId != '19d6262b-8425-4b81-b700-9e5f5331bea1') {

          if (element.code == 'ORDER/INPROGRESS') {
            templateId = '1307163896625717750'
          } else if (element.code == 'ORDER/PENDING') {
            templateId = '1307163937553978021'
          } else if (element.code == 'ORDER/COMFIRMED') {
            templateId = '1307163937573869776'
          } else if (element.code == 'ORDER/CANCELLED') {
            templateId = '1307163937629538513'
          } else if (element.code == 'ORDER/REJECTED') {
            templateId = '1307163937657156984'
          } else if (element.code == 'ORDER/DELIVERED') {
            templateId = '1307163937690700351'
          } else if (element.code == 'SIGNIN/OTP/ANDROID') {
            templateId = '1307163937725768365'
          } else if (element.code == 'SIGNUP/OTP/ANDROID') {
            templateId = '1307163938033818524'
          } else if (element.code == 'DEVICE/CHANGE') {
            templateId = '1307161881025491181'
          } else if (element.code == 'SIGNIN/OTP') {
            templateId = '1307163937837352063'
          } else if (element.code == 'SIGNUP/OTP') {
            templateId = '1307163937769155338'
          } else if (element.code == 'CART/PUSH') {
            templateId = '1307163937812405949'
          } else if (element.code == 'CREDENTIALS/SMS') {
            templateId = '1307163937837352063'
          }

          // else if (element.code == 'CELLNUMBER/CHANGE') {
          //   templateId = '1307161881006769637'
          // } else if (element.code == 'INFORMATION') {
          //   templateId = '1307161881000691093'
          // } else if (element.code == 'ORDER/UPDATE/ADMIN') {
          //   templateId = '1307161880997297221'
          // } else if (element.code == 'CODE/INSTANCE_SMS') {
          //   templateId = '1307161832037251640'
          // } else if (element.code == 'SMS/VERIFICATION') {
          //   templateId = '1307161832049563441'
          // }

          else {
            templateId = element.templateId;
            message = element.$notification;
          }

          await app.models.notificationtype.updateAll({
            code: element.code
          }, {
            templateId: templateId
          });

        }

      }
    } catch (error) {
      throw error;
    }
  };

  Managescript.addMultiLanguageJSON = async (req) => {
    try {
      if (req.body.isAdd) {
        return await app.models.language.create({
          key: 'ADMINPANEL_LANGUAGE',
          value: JSON.stringify(req.body.value),
          masterdetailId: null
        });
      }
      if (req.body.isEdit) {
        return await app.models.language.updateAll({
          id: req.body.id
        }, {
          value: constants.stringifyJson(req.body.value),
          masterdetailId: req.body.masterdetailId
        });
      }
    } catch (error) {
      throw error;
    }
  };

  Managescript.migrateCGRecords = async (req) => {
    try {
      var userQuery = "INSERT INTO `user` (`id`, `firstname`, `lastname`, `username`, `cellnumber`, `address1`, `address2`, `profilepic`, `userstatus`, `registervia`, `cellVerified`, `devicetoken`, `roleId`, `companyname`, `createdby`, `modifiedby`, `isregistered`, `admincreated`, `realm`, `password`, `email`, `emailVerified`, `verificationToken`, `deletedAt`, `created`, `modified`, `orderId`, `cityId`, `notificationreceiverId`, `commoncounterId`, `groupId`, `gstin`, `shippingaddress`, `billingaddress`, `transport`, `reportingto`,`masterdetailId`) VALUES ('1bd01041-cc32-429c-9e4f-ee59a10ce360', NULL, NULL, 'Manjunatch L', '9663746875', NULL, NULL, NULL, 'Active', 'ALLOW', NULL, '618acbfe1df2abae547f137e44ffab20a788d998604a28e387206bc0fe750a9b', '2', 'Annapoorna Agence', NULL, NULL, '0', NULL, NULL, '$2a$10$mYXM8HLY5yCM3jmY2fHtXOQMDrfmd5GrOMj1nuvvN1Fzed7Do1W3y', NULL, NULL, NULL, NULL, '2021-07-04 15:17:08', '2021-07-04 15:17:08', NULL, '0ef2f126-22e2-4f61-a1ed-a951f17a8438', NULL, NULL, '91fd6ffb-c438-45be-be3b-97e94b3cb503', NULL, NULL, NULL, NULL, NULL,'85b14ad3-5d40-4a96-98cf-ba33811bbc39')";
      await executeQuery(userQuery);
      var userMetaAuthQuery = "INSERT INTO `usermetaauth` (`id`, `signinotp`, `signinotpvalidtill`, `changepasswordotp`, `changepasswordotpvalidtill`, `forgotpasswordotp`, `forgotpasswordotpvalidtill`, `changecellnumberotp`, `signupotp`, `signupotpvalidtill`, `accesstoken`, `accesstokenvalidtill`, `pushnotification`, `blocked`, `devicetoken`, `tempcell`, `tempemail`, `createdby`, `modifiedby`, `userId`, `deletedAt`, `created`, `modified`, `masterdetailId`) VALUES ('28df746f-e4c3-4734-b424-e4b37c423448', '3834', '2021-07-04 15:28:26', NULL, NULL, NULL, NULL, NULL, '8860', '2021-07-04 15:18:18', NULL, NULL, '1', NULL, '618acbfe1df2abae547f137e44ffab20a788d998604a28e387206bc0fe750a9b', NULL, NULL, NULL, NULL, '1bd01041-cc32-429c-9e4f-ee59a10ce360', NULL, '2021-07-04 15:17:08', '2021-07-04 15:17:08', '85b14ad3-5d40-4a96-98cf-ba33811bbc39')";
      await executeQuery(userMetaAuthQuery);
      var userRoleMappingQuery = "INSERT INTO `rolemapping` (`id`, `principalType`, `principalId`, `roleId`, `masterdetailId`) VALUES (NULL, 'USER', '1bd01041-cc32-429c-9e4f-ee59a10ce360', '2', '85b14ad3-5d40-4a96-98cf-ba33811bbc39')"
      await executeQuery(userRoleMappingQuery);
      var userCommonCounterQuery = "INSERT INTO `commoncounter` (`id`, `notifications`, `createdby`, `modifiedby`, `cart`, `userId`, `deletedAt`, `created`, `modified`, `masterdetailId`) VALUES ('7cf03ec2-b33f-40ed-8d48-0c3955165bda', '0', NULL, NULL, '0', '1bd01041-cc32-429c-9e4f-ee59a10ce360', NULL, '2021-07-04 15:17:08', '2021-07-04 15:17:08', '85b14ad3-5d40-4a96-98cf-ba33811bbc39')"
      await executeQuery(userCommonCounterQuery);
    } catch (error) {
      throw error;
    }
  };

  Managescript.manageLanguageJSON = async (req) => {
    try {

      var getLanguageJSON = await app.models.language.findOne({
        where: {
          key: req.body.key,
          masterdetailId: req.body.masterdetailId
        }
      });

      var getLanguages = JSON.parse(getLanguageJSON.value);

      if (req.body.hindiLanguage) {
        getLanguages.hi = req.body.hindiLanguage;
      }

      if (req.body.arabicLanguage) {
        getLanguages.ar = req.body.arabicLanguage;
      }

      if (req.body.englishLanguage) {
        getLanguages.en = req.body.englishLanguage;
      }

      if (req.body.chineseLanguage) {
        getLanguages.ch = req.body.chineseLanguage;
      }

      var getAppName = await app.models.setting.findOne({
        where: {
          registerallow: 'App Name',
          masterdetailId: req.body.masterdetailId
        }
      });

      if (getAppName && getAppName.text && req.body.key === 'Android_Language') {
        if (getLanguages.en) {
          getLanguages.en.app_name = getAppName.text;
        }
        if (getLanguages.ar) {
          getLanguages.ar.app_name = getAppName.text;
        }
        if (getLanguages.hi) {
          getLanguages.hi.app_name = getAppName.text;
        }
        if (getLanguages.ch) {
          getLanguages.ch.app_name = getAppName.text;
        }
        await app.models.language.updateAll({
          id: getLanguageJSON.id
        }, {
          value: JSON.stringify(getLanguages)
        });

      }

    } catch (error) {
      throw error;
    }
  };

  Managescript.patchCODOptionInPaymentJSON = async (req) => {

    try {

      var masterDetailData = await app.models.masterdetail.find();
      var getPaymentSetting;

      for (let i = 0; i < masterDetailData.length; i++) {
        const element = masterDetailData[i];
        getPaymentSetting = await app.models.setting.findOne({
          where: {
            registerallow: constants.PAYMENT_DETAILS_KEY,
            masterdetailId: element.id
          }
        });
        if (getPaymentSetting) {
          getPaymentSetting = JSON.parse(getPaymentSetting.text);

          getPaymentSetting.find(item => {
            if (item.name === 'COD') {
              item.name = 'Cash On Delivery';
            }
          });

          // getPaymentSetting.push({
          //   name: "COD",
          //   paymenttype: "Cash",
          //   status: 1,
          //   config: {}
          // });

          getPaymentSetting = JSON.stringify(getPaymentSetting);
          await app.models.setting.updateAll({
            registerallow: constants.PAYMENT_DETAILS_KEY,
            masterdetailId: element.id
          }, {
            text: getPaymentSetting
          });
        }
      }

    } catch (error) {
      throw error;
    }
  };

  Managescript.updateMasterdetailJSON = async (req) => {

    var masterDetailData;

    try {
      masterDetailData = await app.models.masterdetail.find();

      if (masterDetailData) {
        for (let i = 0; i < masterDetailData.length; i++) {
          const element = masterDetailData[i];
          var isWebStoreURL = false;
          var isDomainURL = false;
          var description = JSON.parse(element.description);

          description.find(item => {
            if (item.key == 'webstoreURL') {
              isWebStoreURL = true;
            }
            if (item.key == 'domainURL') {
              isDomainURL = true;
            }
          });

          if (!isWebStoreURL && element.fullname) {
            description.push({
              key: 'webstoreURL',
              value: element.fullname.toLowerCase().split(" ").join("")
            });
          }
          if (!isDomainURL) {
            description.push({
              key: 'domainURL',
              value: null
            });
          }

          if (!isWebStoreURL || !isDomainURL) {
            await app.models.masterdetail.update({
              id: element.id,
              code: element.code
            }, {
              description: JSON.stringify(description)
            });
          }

        }
      }

    } catch (error) {
      throw error;
    }
  };

  Managescript.uploadDefaultImagesToS3 = async (req) => {
    try {
      if (req && req.query && req.query.filter && req.query.filter.where && req.query.filter.where.masterdetailId) {
        var getCode = await app.models.masterdetail.findOne({
          where: {
            id: req.query.filter.where.masterdetailId
          }
        });
        if (getCode && getCode.codename) {
          var environment;
          if (app.get('isProduction')) {
            environment = 'prod/';
          } else {
            environment = 'dev/';
          }
          await s3Constants.copyDefaultImage(environment, getCode.codename, 'default_category.png', 'productmedia');
          await s3Constants.copyDefaultImage(environment, getCode.codename, 'noimagefound.png', 'productmedia');
          await s3Constants.copyDefaultImage(environment, getCode.codename, 'defaultuser.jpeg', 'profilepic');
          await s3Constants.copyDefaultImage(environment, getCode.codename, 'noimagefound.png', 'requestproduct');
          return {
            response: 'Files Copied'
          };
        } else {
          throw constants.createError(404, 'MasterdetailId not found');
        }
      }
    } catch (error) {
      throw error;
    }
  };

  Managescript.updateExistGuestUserRoleId = async (req) => {
    try {
      var getGuestUserList = await app.models.user.find({
        where: {
          cellnumber: {
            eq: null
          },
          firstname: {
            eq: null
          },
          lastname: {
            eq: null
          },
          username: {
            eq: null
          },
          companyname: {
            eq: null
          },
          email: {
            eq: null
          }
        }
      });

      getGuestUserList.filter(async item => {
        await app.models.user.updateAll({
          id: item.id
        }, {
          roleId: constants.GUEST_ROLEID
        });
        await constants.addLog('updateExistGuestUserRoleId', item.id, item.masterdetailId);
      });
      return {
        response: 'Updated'
      };
    } catch (error) {
      throw error;
    }
  };

  Managescript.updateCountryCodeInOrderViaWhatsApp = async (req) => {
    try {

      var getMasterdetailIData = await app.models.masterdetail.find();
      for (let i = 0; i < getMasterdetailIData.length; i++) {
        const element = getMasterdetailIData[i];

        var getAdminDetails = await app.models.user.findOne({
          where: {
            roleId: 1,
            masterdetailId: element.id
          }
        });

        var getUsermetaauthDetails = await app.models.usermetaauth.findOne({
          where: {
            userId: getAdminDetails.id,
            masterdetailId: element.id
          }
        });

        var getOrderViaWhatsapp = await app.models.setting.findOne({
          where: {
            masterdetailId: element.id,
            registerallow: settingConstants.ORDER_VIA_WHATSAPP
          }
        });

        if (getOrderViaWhatsapp && getUsermetaauthDetails) {
          var parseText = JSON.parse(getOrderViaWhatsapp.text);
          parseText.countryCode = getUsermetaauthDetails.countrycode;
          // update order via whatsapp
          await app.models.setting.updateAll({
            id: getOrderViaWhatsapp.id,
            masterdetailId: element.id,
            registerallow: settingConstants.ORDER_VIA_WHATSAPP
          }, {
            text: JSON.stringify(parseText)
          });
        } else {
          await app.models.setting.updateAll({
            masterdetailId: element.id,
            registerallow: settingConstants.ORDER_VIA_WHATSAPP
          }, {
            status: 0
          });
        }

      }
    } catch (error) {
      throw error;
    }
  };

  Managescript.updateExistingOrderPaymentStatus = async (req) => {
    try {
      var getOrderstatusDetails;
      var getAllOrder = await app.models.order.find({
        where: {
          inshoppingcart: 0
        }
      });
      for (let i = 0; i < getAllOrder.length; i++) {
        const element = getAllOrder[i];

        // get orderstatus value
        getOrderstatusDetails = await app.models.orderstatus.findOne({
          id: element.id,
          masterdetailId: element.masterdetailId
        });

        if (getOrderstatusDetails && getOrderstatusDetails.status === 'PENDING') {
          element.paymentstatus = 1;
        }
        if (getOrderstatusDetails && getOrderstatusDetails.status === 'CONFIRMED') {
          element.paymentstatus = 2;
        }
        if (getOrderstatusDetails && getOrderstatusDetails.status === 'INPROGRESS') {
          element.paymentstatus = 1;
        }
        if (getOrderstatusDetails && getOrderstatusDetails.status === 'DELIVERED') {
          element.paymentstatus = 2;
        }
        if (getOrderstatusDetails && getOrderstatusDetails.status === 'CANCELLED') {
          element.paymentstatus = 3;
        }
        if (getOrderstatusDetails && getOrderstatusDetails.status === 'REJECTED') {
          element.paymentstatus = 3;
        }
        await app.models.order.updateAll({
          id: element.id
        }, {
          paymentstatus: element.paymentstatus
        });
        await constants.addLog('Update Payment Status Of Order', element.id, element.paymentstatus);
      }
    } catch (error) {
      throw error;
    }
  };

  Managescript.updateUserStatus = async (req) => {
    try {
      var getAllActiveEntries = await app.models.user.find();

      for (let i = 0; i < getAllActiveEntries.length; i++) {
        const element = getAllActiveEntries[i];
        if (element.userstatus === 'ACTIVE') {
          element.userstatus = 'Active';
        }
        if (element.userstatus === 'DEACTIVE') {
          element.userstatus = 'Deactive';
        }
        await app.models.user.updateAll({
          id: element.id
        }, {
          userstatus: element.userstatus
        });
      }

    } catch (error) {
      throw error;
    }
  };

  Managescript.updateNotificationsIntoSadadStore = async (req) => {
    try {

      var orderInprogress = "UPDATE `notificationtype` SET `textmessage_html` = 'Dear [name],<br><br>Your order [orderno] of [noofproduct] products are in progress. Order will be delivered within 48 hours.<br>[companyname]<br><br>Thank You.<br>Sadad Store Team' WHERE `notificationtype`.`code`='ORDER/INPROGRESS'";
      executeQuery(orderInprogress);

      var orderPending = "UPDATE `notificationtype` SET `textmessage_html` = 'Dear [name],<br><br>Your order [orderno] of [noofproduct] products has been pending.<br>[companyname]<br><br>Thank You.<br>Sadad Store Team' WHERE `notificationtype`.`code`='ORDER/PENDING';";
      executeQuery(orderPending);

      var orderConfirmed = "UPDATE `notificationtype` SET `textmessage_html` = 'Dear [name],<br><br>Your order [orderno] of [noofproduct] products has been confirmed.<br>[companyname]<br><br>Thank You.<br>Sadad Store Team' WHERE `notificationtype`.`code`='ORDER/COMFIRMED';";
      executeQuery(orderConfirmed);

      var orderCancelled = "UPDATE `notificationtype` SET `textmessage_html` = 'Dear [name],<br><br>Your order [orderno] of [noofproduct] products has been cancelled.<br>[companyname]<br><br>Thank You.<br>Sadad Store Team' WHERE `notificationtype`.`code`='ORDER/CANCELLED';";
      executeQuery(orderCancelled);

      var orderRejected = "UPDATE `notificationtype` SET `textmessage_html` = 'Dear [name],<br><br>Your order [orderno] of [noofproduct] products has been rejected.<br>[companyname]<br><br>Thank You.<br>Sadad Store Team' WHERE `notificationtype`.`code` = 'ORDER/REJECTED';";
      executeQuery(orderRejected);

      var orderDelivered = "UPDATE `notificationtype` SET `textmessage_html` = 'Dear [name],<br><br>Your order [orderno] of [noofproduct] products has been delivered.<br>[companyname]<br><br>Thank You.<br>Sadad Store Team' WHERE `notificationtype`.`code` = 'ORDER/DELIVERED';";
      executeQuery(orderDelivered);

      var signInOtpAndroid = "UPDATE `notificationtype` SET `textmessage_html` = 'Dear [username],<br><br>Your One Time Password (OTP) is [otp] for Sign-in to [appname].<br><br>Thank You.<br>Sadad Store Team' WHERE `notificationtype`.`code` = 'SIGNIN/OTP/ANDROID';";
      executeQuery(signInOtpAndroid);

      var signUpOtpAndroid = "UPDATE `notificationtype` SET `textmessage_html` = 'Dear [username],<br><br>Your One Time Password (OTP) is [otp] for Signup to [appname].<br><br>Thank You.<br>Sadad Store Team' WHERE `notificationtype`.`code` = 'SIGNUP/OTP/ANDROID';";
      executeQuery(signUpOtpAndroid);

      var signInOtp = "UPDATE `notificationtype` SET `textmessage_html` = 'Dear [username],<br><br>Your One Time Password (OTP) is [otp] for Sign-in to [appname].<br><br>Thank You.<br>Sadad Store Team' WHERE `notificationtype`.`code` = 'SIGNIN/OTP';";
      executeQuery(signInOtp);

      var signUpOtp = "UPDATE `notificationtype` SET `textmessage_html` = 'Dear [username],<br><br>Your One Time Password (OTP) is [otp] for Signup to [appname].<br><br>Thank You.<br>Sadad Store Team' WHERE `notificationtype`.`code` = 'SIGNUP/OTP';";
      executeQuery(signUpOtp);

      var codeInstance = "UPDATE `notificationtype` SET `notification` = '<p>Dear [name],</p> <p>Thanks for choosing Sadad Store</p> <p>Your free trial starts today.</p> <p>Congratulations on starting your journey with Sadad Store. We are excited you are here and can't wait to help you get started.</p> <p>You will get an access to all features available on BizOn365. During these next 3 months, so make sure you can utilize them fully. </p><b>Your Store Details:</b> <ul> <li><u>Your web store name</u> : [name]</li> <li><u>Your store code </u> : [code]</li> <li><u>Your webstore link</u> : <a href=\"[webstore]\">[webstore]</a></li> <li><u>Your Admin panel link</u> : <a href=\"[adminpanel]\">[adminpanel]</a></li> <li><u>Your current active plan</u> : [plan] </li> <li><u>Your current plan price</u> : [price] </li> <li><u>Your trial start date </u> : [startdate] </li> <li><u>Your trial expire date </u> : [expiredate] </li> </ul> <p>To your online success</p> <p>Team Sadad Store</p>' WHERE `notificationtype`.`code` = 'CODE/INSTANCE';"
      executeQuery(codeInstance);

      var emailVerification = "UPDATE `notificationtype` SET `notification` = 'Dear [name],<br><br>Please click on below link to verify your Sadad Store account. <br>Link : <a href=\"[text]\">Click Here</a><br><br>Thank You.<br>Sadad Store Team' WHERE `notificationtype`.`code` = 'EMAIL/VERIFICATION';"
      executeQuery(emailVerification);

      var codeInstanceSMS = "UPDATE `notificationtype` SET `notification` = 'Dear[name],\r\nYour login code is [code] .\r\nPlease proceed further with your account\r\nThank You. Sadad Store Team' WHERE `notificationtype`.`code` = 'CODE/INSTANCE_SMS';";
      executeQuery(codeInstanceSMS);

      var smsVerification = "UPDATE `notificationtype` SET `notification` = 'Dear [name], Please click on the below link to verify your Sadad Store account.\r\nLink : [text] Click Here\r\nThank You. Sadad Store Team' WHERE `notificationtype`.`code` = 'SMS/VERIFICATION';";
      executeQuery(smsVerification);

      var emailOneTimePayment = "UPDATE `notificationtype` SET `notification` = '<center><p>Dear [name],</p>Your payment for plan [planname] is successful. Please find your payment details below:<br><br><table><td>Payment Id</td><td>:</td><td>[paymentid]</td><tr></tr><tr></tr><td>Attempted On</td><td>:</td><td>[date]</td><tr></tr><tr></tr><td>Payment via</td><td>:</td><td>[paymentmode]</td><tr></tr><tr></tr><td>Email</td><td>:</td><td>[email]</td><tr></tr><tr></tr><td>Mobile Number</td><td>:</td><td>[mobileno]</td><tr></tr><tr></tr><td>Amount</td><td>:</td><td>[amount]</td></table><br><br><p>Thank You</p><p>Team Sadad Store</p></center>' WHERE `notificationtype`.`code` = 'EMAIL/ONETIMEPAYMENT_SUCCESSFUL';";
      executeQuery(emailOneTimePayment);

      var smsOneTimePayment = "UPDATE `notificationtype` SET `notification` = 'Dear [name],\r\nYour payment for the plan [planname] is successful. Please find your payment details below:\r\n[amount]\r\nPayment Successful.\r\nPayment Id : [paymentid]\r\nAttempted On: date]\r\nPayment via : [paymentmode]\r\nEmail : [email]\r\nMobile Number : [mobileno]\r\nThank You\r\nTeam Sadad Store' WHERE `notificationtype`.`code` = 'SMS/ONETIMEPAYMENT_SUCCESSFUL';";
      executeQuery(smsOneTimePayment);

      var invoiceEmail = "UPDATE `notificationtype` SET `textmessage` = 'Dear [appname],<br><br>Please see attached invoice for order [orderno], placed by [username] on [date].<br><br>Thank You.<br>Sadad Store Team', `textmessage_html` = 'Dear [name],<br><br>Please see attached invoice for your order, placed on [date]. <br>Don’t hesitate to reach out if you have any questions.<br><br>Thank You.<br>Sadad Store Team' WHERE `notificationtype`.`code` = 'INVOICE/EMAIL';";
      executeQuery(invoiceEmail);

      var cdmEmail = "UPDATE `notificationtype` SET `textmessage_html` = 'Dear [name],<br><br>We have received your request to use your domain for the Sadad Store [appname] store.<br><br>Request Domain : [domainname]<br>Server IP : 1.1.1.1<br>Please point the domain to above given IP address. Our team started working on it. Once we are done with the configuration changes you will receive the email.<br><br>Thank You.<br>Sadad Store Team' WHERE `notificationtype`.`code` = 'CDM/EMAIL';";
      executeQuery(cdmEmail);

      var inquiryPending = "UPDATE `notificationtype` SET `textmessage_html` = 'Dear [name],<br><br>Your inquiry [orderno] of [noofproduct] products has been pending.<br>[companyname]<br><br>Thank You.<br>Sadad Store Team' WHERE `notificationtype`.`code` = 'INQUIRY/PENDING';";
      executeQuery(inquiryPending);

      var inquiryInprogress = "UPDATE `notificationtype` SET `textmessage_html` = 'Dear [name],<br><br>Your inquiry [orderno] of [noofproduct] products are in progress.<br>[companyname]<br><br>Thank You.<br>Sadad Store Team' WHERE `notificationtype`.`code` = 'INQUIRY/INPROGRESS';";
      executeQuery(inquiryInprogress);

      var inquiryConfirmed = "UPDATE `notificationtype` SET `textmessage_html` = 'Dear [name],<br><br>Your inquiry [orderno] of [noofproduct] products has been confirmed.<br>[companyname]<br><br>Thank You.<br>Sadad Store Team' WHERE `notificationtype`.`code` = 'INQUIRY/COMFIRMED';";
      executeQuery(inquiryConfirmed);

      var inquiryCancelled = "UPDATE `notificationtype` SET `textmessage_html` = 'Dear [name],<br><br>Your inquiry [orderno] of [noofproduct] products has been cancelled.<br>[companyname]<br><br>Thank You.<br>Sadad Store Team' WHERE `notificationtype`.`code` = 'INQUIRY/CANCELLED';";
      executeQuery(inquiryCancelled);

      var inquiryRejected = "UPDATE `notificationtype` SET `textmessage_html` = 'Dear [name],<br><br>Your inquiry [orderno] of [noofproduct] products has been rejected.<br>[companyname]<br><br>Thank You.<br>Sadad Store Team' WHERE `notificationtype`.`code` = 'INQUIRY/REJECTED';";
      executeQuery(inquiryRejected);

      var inquiryDelivered = "UPDATE `notificationtype` SET `textmessage_html` = 'Dear [name],<br><br>Your inquiry [orderno] of [noofproduct] products has been delivered.<br>[companyname]<br><br>Thank You.<br>Sadad Store Team' WHERE `notificationtype`.`code` = 'INQUIRY/DELIVERED';";
      executeQuery(inquiryDelivered);

      var otpInstance = "UPDATE `notificationtype` SET `notification` = 'Dear [name], <br><br> Your verification OTP is [code].<br>Please use this OTP to complete the verification process.<br><br>Thank You.<br>Sadad Store Team' WHERE `notificationtype`.`code` = 'OTP/INSTANCE';";
      executeQuery(otpInstance);

      var emailFeedback = "UPDATE `notificationtype` SET `textmessage_html` = 'Dear Admin,<br><br>You have received a feedback from [customername].<br><br>Feedback : [description]<br><br>User details are as below:<table><td>Name</td><td>:</td><td>[username]</td><tr></tr><tr></tr><td>Email</td><td>:</td><td>[email]</td><tr></tr><tr></tr><td>Contact</td><td>:</td><td>[cellnumber]</td></table><br><br>Thank You<br>Team Sadad Store' WHERE `notificationtype`.`code` = 'EMAIL/FEEDBACK';";
      executeQuery(emailFeedback);

      var placeOrderAdmin = "UPDATE `notificationtype` SET `textmessage_html` = 'Dear [appname],<br><br>You have received a new order [orderno] from [username].<br><br>Thank You.<br>Sadad Store Team.' WHERE `notificationtype`.`code` = 'PLACEORDER/ADMIN';";
      executeQuery(placeOrderAdmin);

      var orderstatusAdmin = "UPDATE `notificationtype` SET `textmessage_html` = 'Dear [appname],<br><br>Order status for order [orderno] has been changed to [orderstatus].<br><br>Thank You.<br>Sadad Store Team.' WHERE `notificationtype`.`code` = 'ORDERSTATUS/ADMIN';";
      executeQuery(orderstatusAdmin);

      var placeInquiryAdmin = "UPDATE `notificationtype` SET `textmessage_html` = 'Dear [appname],<br><br>You have received a new inquiry [orderno] from [username].<br><br>Thank You.<br>Sadad Store Team.' WHERE `notificationtype`.`code` = 'PLACEINQUIRY/ADMIN';";
      executeQuery(placeInquiryAdmin);

      var inquirystatusAdmin = "UPDATE `notificationtype` SET `textmessage_html` = 'Dear [appname],<br><br>Inquiry status for inquiry [orderno] has been changed to [orderstatus].<br><br>Thank You.<br>Sadad Store Team.' WHERE `notificationtype`.`code` = 'INQUIRYSTATUS/ADMIN';";
      executeQuery(inquirystatusAdmin);

      var otpInstanceSms = "UPDATE `notificationtype` SET `notification` = 'Dear[name], \r\nYour OTP is [otp]. \r\nPlease verify your account by providing OTP.\r\nThank You. Sadad Store Team' WHERE `notificationtype`.`code` = 'OTP/INSTANCE_SMS';";
      executeQuery(otpInstanceSms);

      var emailExpiryPlan = "UPDATE `notificationtype` SET `notification` = '<p>Dear [name],</p> <p>Your current plan will be expire in the next <b> [noofdays] days. </b></p> <p>Kindly please update your plan from the given link.</p> <a href=\"https://manage.sadad.store/\"> Sadad Store : https://manage.sadad.store </a> <br> <p>If you will not update your plan then we will move you to a free plan. </p> <ul> <li> If your products are out of the limit, We will deactivate your products as per the free plan limit. </li> <li> If your users, salesmen, are out of the limit, We will deactivate them as per the free plan limit. </li> <li> We will move all customers to the default group, you are not able to add additional groups. </li> <li> We will disable all payment gateways & not allowing any kind of shipping charges on orders. </li> </ul> Thank You, <b>Sadad Store Team.</b>\r\n' WHERE `notificationtype`.`code` = 'EMAIL/EXPIRE_PLAN';";
      executeQuery(emailExpiryPlan);

    } catch (error) {
      throw error;
    }
  };

  Managescript.updateAddressConfigJSON = async (req) => {
    var settingModel = app.models.setting;
    var addressConfigJSON;

    try {

      addressConfigJSON = [{
        "id": 1, "field_name": "name", "visible": 1, "mandatory": 1, "display_text": "Name"
      }, {
        "id": 2, "field_name": "mobile_number", "visible": 1, "mandatory": 1, "display_text": "Mobile Number"
      }, {
        "id": 3, "field_name": "email_address", "visible": 1, "mandatory": 1, "display_text": "Email Address"
      }, {
        "id": 4, "field_name": "company_name", "visible": 1, "mandatory": 0, "display_text": "Company Name"
      }, {
        "id": 5, "field_name": "gstin", "visible": 1, "mandatory": 0, "display_text": "GSTIN"
      }, {
        "id": 6, "field_name": "address_line_1", "visible": 1, "mandatory": 1, "display_text": "Address Line 1"
      }, {
        "id": 7, "field_name": "address_line_2", "visible": 1, "mandatory": 1, "display_text": "Address Line 2"
      }, {
        "id": 8, "field_name": "landmark", "visible": 1, "mandatory": 1, "display_text": "Landmark"
      }, {
        "id": 9, "field_name": "pincode", "visible": 1, "mandatory": 1, "display_text": "Pincode"
      }, {
        "id": 10, "field_name": "country", "visible": 1, "mandatory": 1, "display_text": "Country"
      }, {
        "id": 11, "field_name": "state", "visible": 1, "mandatory": 1, "display_text": "State"
      }, {
        "id": 12, "field_name": "city", "visible": 1, "mandatory": 1, "display_text": "City"
      }, {
        "id": 13, "field_name": "zone_number", "visible": 0, "mandatory": 0, "display_text": "Zone Number"
      }, {
        "id": 14, "field_name": "street_number", "visible": 0, "mandatory": 0, "display_text": "Street Number"
      }, {
        "id": 15, "field_name": "building_number", "visible": 0, "mandatory": 0, "display_text": "Building Number"
      }, {
        "id": 16, "field_name": "unit_number", "visible": 0, "mandatory": 0, "display_text": "Unit Number"
      }];

      var getAllMasterdetails = await app.models.masterdetail.find();
      if (getAllMasterdetails && getAllMasterdetails.length > 0) {
        for (let i = 0; i < getAllMasterdetails.length; i++) {
          const element = getAllMasterdetails[i];
          // Get Address Config ID from Setting
          var getAddressConfigSetting = await settingModel.findOne({
            where: {
              registerallow: settingConstants.ADDRESS_CONFIGURATION,
              masterdetailId: element.id
            }
          });
          if (getAddressConfigSetting) {
            // Update Setting of it
            await settingModel.updateAll({
              id: getAddressConfigSetting.id
            }, {
              text: JSON.stringify(addressConfigJSON)
            });
          }
        }
      }

    } catch (error) {
      throw error;
    }
  };

  Managescript.updateFixedProductDetailsLabel = async (req) => {
    var settingModel = app.models.setting;

    try {

      var getAllMasterdetails = await app.models.masterdetail.find();
      if (getAllMasterdetails && getAllMasterdetails.length > 0) {
        for (let i = 0; i < getAllMasterdetails.length; i++) {
          const element = getAllMasterdetails[i];

          // Get Jewellery Setting
          var getJewellerySetting = await settingModel.findOne({
            where: {
              registerallow: settingConstants.CATALOGUE_JEWELLARY,
              masterdetailId: element.id
            }
          });

          if (getJewellerySetting && getJewellerySetting.status === 0) {
            // Get Address Config ID from Setting
            var getFixedProductDetailsSetting = await settingModel.findOne({
              where: {
                registerallow: settingConstants.FIXED_PRODUCT_DETAILS,
                masterdetailId: element.id
              }
            });
            if (getFixedProductDetailsSetting) {
              // Update Setting of it
              await settingModel.updateAll({
                id: getFixedProductDetailsSetting.id
              }, {
                status: 0
              });
            }
          }

        }
      }

    } catch (error) {
      throw error;
    }
  };

  Managescript.manageInquiryActions = async (req) => {
    var settingModel = app.models.setting;

    try {

      var getAllMasterdetails = await app.models.masterdetail.find();
      if (getAllMasterdetails && getAllMasterdetails.length > 0) {
        for (let i = 0; i < getAllMasterdetails.length; i++) {
          const element = getAllMasterdetails[i];

          // Get InquiryAction
          var getInquiryActionSetting = await settingModel.findOne({
            where: {
              registerallow: settingConstants.INQUIRY_ACTION,
              masterdetailId: element.id
            }
          });

          if (getInquiryActionSetting && (getInquiryActionSetting.text === null || getInquiryActionSetting.text === undefined)) {
            await settingModel.updateAll({
              id: getInquiryActionSetting.id
            }, {
              text: JSON.stringify([{
                next_action: [],
                industry: []
              }])
            });
          }

        }
      }

    } catch (error) {
      throw error;
    }
  };

  Managescript.manageNotificationsInArabic = async (req) => {

    var notificationTypeModel = app.models.notificationtype;

    try {

      var getAllMasterdetails = await app.models.masterdetail.find();
      if (getAllMasterdetails && getAllMasterdetails.length > 0) {
        for (let i = 0; i < getAllMasterdetails.length; i++) {
          const element = getAllMasterdetails[i];

          // Get ORDER/INPROGRESS
          var getOrderInprogressNotificationType = await notificationTypeModel.findOne({
            where: {
              code: settingConstants.ORDER_INPROGRESS,
              masterdetailId: element.id
            }
          });

          if (getOrderInprogressNotificationType) {
            await notificationTypeModel.updateAll({
              id: getOrderInprogressNotificationType.id
            }, {
              arabicNotification: 'طلبك [orderno] من [noofproduct] من المنتجات قيد التقدم.'
            });
          }

          // Get ORDER/PENDING
          var getOrderPendingNotificationType = await notificationTypeModel.findOne({
            where: {
              code: settingConstants.ORDER_PENDING,
              masterdetailId: element.id
            }
          });
          if (getOrderPendingNotificationType) {
            await notificationTypeModel.updateAll({
              id: getOrderPendingNotificationType.id
            }, {
              arabicNotification: 'طلبك [orderno] من [noofproduct] من المنتجات معلق.'
            });
          }

          // Get ORDER_CONFIRMED
          var getOrderConfirmedNotificationType = await notificationTypeModel.findOne({
            where: {
              code: settingConstants.ORDER_CONFIRMED,
              masterdetailId: element.id
            }
          });
          if (getOrderConfirmedNotificationType) {
            await notificationTypeModel.updateAll({
              id: getOrderConfirmedNotificationType.id
            }, {
              arabicNotification: "تم تأكيد طلبك [orderno] من [noofproduct] من المنتجات."
            });
          }

          // Get ORDER_CANCELLED
          var getOrderCancelledNotificationType = await notificationTypeModel.findOne({
            where: {
              code: settingConstants.ORDER_CANCELLED,
              masterdetailId: element.id
            }
          });
          if (getOrderCancelledNotificationType) {
            await notificationTypeModel.updateAll({
              id: getOrderCancelledNotificationType.id
            }, {
              arabicNotification: "تم إلغاء طلبك [orderno] من [noofproduct] من المنتجات."
            });
          }

          // Get ORDER_REJECTED
          var getOrderRejectedNotificationType = await notificationTypeModel.findOne({
            where: {
              code: settingConstants.ORDER_REJECTED,
              masterdetailId: element.id
            }
          });
          if (getOrderRejectedNotificationType) {
            await notificationTypeModel.updateAll({
              id: getOrderRejectedNotificationType.id
            }, {
              arabicNotification: "تم رفض طلبك [orderno] من [noofproduct] من المنتجات."
            });
          }

          // Get ORDER_DELIVERED
          var getOrderDeliveredNotificationType = await notificationTypeModel.findOne({
            where: {
              code: settingConstants.ORDER_DELIVERED,
              masterdetailId: element.id
            }
          });
          if (getOrderDeliveredNotificationType) {
            await notificationTypeModel.updateAll({
              id: getOrderDeliveredNotificationType.id
            }, {
              arabicNotification: "تم تسليم طلبك [orderno] من [noofproduct] من المنتجات."
            });
          }

        }
      }

    } catch (error) {
      throw error;
    }
  };

  Managescript.manageNotificationsTextMessageIntoArabicTextMessage = async (req) => {

    var orderModel = app.models.order;
    var orderstatusModel = app.models.orderstatus;
    var orderdetailsModel = app.models.orderdetails;
    var notificationModel = app.models.notification;
    var commonCounterModel = app.models.commoncounter;
    var notificationTypeModel = app.models.notificationtype;
    var notificationReceiverModel = app.models.notificationreceiver;
    var getAllNotifications, getNotificationReciever, getOrder, getCartCounter, getOrderStatus, getNotificationType, arabicTextMessage;

    try {

      getAllNotifications = await notificationModel.find();
      if (getAllNotifications) {
        for (let i = 0; i < getAllNotifications.length; i++) {
          const element = getAllNotifications[i];

          // Based on Notification get Order Id from Notification Reciever
          getNotificationReciever = await notificationReceiverModel.findOne({
            where: {
              notificationId: element.id
            }
          });

          if (getNotificationReciever) {
            // Based On getNotificationReciever (OrderId) get Order
            getOrder = await orderModel.findOne({
              where: {
                id: getNotificationReciever.orderId
              },
              deleted: true
            });

            if (getOrder) {
              // Get cart counter
              getCartCounter = await orderdetailsModel.find({
                where: {
                  orderId: getOrder.id
                }
              });

              getOrderStatus = await orderstatusModel.findOne({
                where: {
                  id: getOrder.orderstatus
                }
              });

              if (getOrderStatus) {
                if (getOrderStatus.status === settingConstants.ORDERSTATUS_PENDING) {
                  getNotificationType = await notificationTypeModel.findOne({
                    where: {
                      masterdetailId: element.masterdetailId,
                      code: settingConstants.ORDER_PENDING
                    }
                  });
                }
                if (getOrderStatus.status === settingConstants.ORDERSTATUS_INPROGRESS) {
                  getNotificationType = await notificationTypeModel.findOne({
                    where: {
                      masterdetailId: element.masterdetailId,
                      code: settingConstants.ORDER_INPROGRESS
                    }
                  });
                }
                if (getOrderStatus.status === settingConstants.ORDERSTATUS_CONFIRMED) {
                  getNotificationType = await notificationTypeModel.findOne({
                    where: {
                      masterdetailId: element.masterdetailId,
                      code: settingConstants.ORDER_CONFIRMED
                    }
                  });
                }
                if (getOrderStatus.status === settingConstants.ORDERSTATUS_CANCELLED) {
                  getNotificationType = await notificationTypeModel.findOne({
                    where: {
                      masterdetailId: element.masterdetailId,
                      code: settingConstants.ORDER_CANCELLED
                    }
                  });
                }
                if (getOrderStatus.status === settingConstants.ORDERSTATUS_REJECTED) {
                  getNotificationType = await notificationTypeModel.findOne({
                    where: {
                      masterdetailId: element.masterdetailId,
                      code: settingConstants.ORDER_REJECTED
                    }
                  });
                }
                if (getOrderStatus.status === settingConstants.ORDERSTATUS_DELIVERED) {
                  getNotificationType = await notificationTypeModel.findOne({
                    where: {
                      masterdetailId: element.masterdetailId,
                      code: settingConstants.ORDER_DELIVERED
                    }
                  });
                }
                if (getNotificationType) {
                  arabicTextMessage = getNotificationType.arabicNotification;
                  arabicTextMessage = arabicTextMessage.replace('[orderno]', getOrder.orderno);
                  arabicTextMessage = arabicTextMessage.replace('[noofproduct]', getCartCounter.length);
                }
                // Update Notification
                await notificationModel.updateAll({
                  id: element.id
                }, {
                  arabicTextmessage: arabicTextMessage
                });
              }

            }
          }

        }

      }

    } catch (error) {
      throw error;
    }
  };

  Managescript.manageSadadStorePaymentGateway = async () => {
    try {

      var masterDetailData = await app.models.masterdetail.find();
      var getPaymentSetting;

      for (let i = 0; i < masterDetailData.length; i++) {
        const element = masterDetailData[i];
        getPaymentSetting = await app.models.setting.findOne({
          where: {
            registerallow: constants.PAYMENT_DETAILS_KEY,
            masterdetailId: element.id
          }
        });
        if (getPaymentSetting) {
          getPaymentSetting = JSON.parse(getPaymentSetting.text);
          // 1. If COD then convert in Cash On Delivery
          // 2. Disable Sadad Payment gateway
          // 3. Enable Cash On Delivery
          getPaymentSetting.find(item => {
            if (item.name === 'COD' || item.name === 'Cash On Delivery') {
              item.name = 'Cash On Delivery';
              item.status = 1;
            }
            if (item.name === 'Sadad') {
              item.status = 0;
            }
          });
          // Update Payment Gateway
          getPaymentSetting = JSON.stringify(getPaymentSetting);
          await app.models.setting.updateAll({
            registerallow: constants.PAYMENT_DETAILS_KEY,
            masterdetailId: element.id
          }, {
            text: getPaymentSetting
          });
        }
      }
    } catch (error) {
      throw error;
    }
  };

  Managescript.manageCategoryDetails = async () => {
    try {

      var categoryDetailsData = await app.models.categorydetail.find({
        where: {
          name: {
            eq: null
          }
        }
      });

      console.log(categoryDetailsData.length);

      for (let i = 0; i < categoryDetailsData.length; i++) {
        const element = categoryDetailsData[i];
        await app.models.categorydetail.updateAll({
          id: element.id
        }, {
          deletedAt: new Date()
        });
      }

    } catch (error) {
      throw error;
    }
  };

  Managescript.updateCustomDomainMappingNotificationType = async () => {
    try {

      var updateCustomDomainMappingNotification = "UPDATE `notificationtype` SET `textmessage_html` = 'Dear [name],<br><br>We have received your request to use your domain for the [appname] store.<br><br>Request Domain : [domainname]<br>Server IP : 18.220.166.15<br>Please point the domain to above given IP address. Our team started working on it. Once we are done with the configuration changes you will receive the email.<br><br>Thank You.<br>Sadad Store Team' WHERE `notificationtype`.`id` = 605;"
      executeQuery(updateCustomDomainMappingNotification);

    } catch (error) {
      throw error;
    }
  };

  Managescript.manageVersionOfInstance = async () => {
    var settingModel = app.models.setting;
    try {
      var getAllSettings = await settingModel.find({
        where: {
          masterdetailId: constants.defaultTenantId
        }
      });

      // Get Android Setting
      var androidVersionObject = JSON.parse(getAllSettings[9].registerallow);
      if (androidVersionObject) {
        await settingModel.updateAll({
          id: getAllSettings[9].id
        }, {
          registerallow: JSON.stringify({
            min_android_version: "1.0.0", current_android_version: "1.0.0"
          })
        });
      }

      // Get iOS Setting
      var iosVersionObject = JSON.parse(getAllSettings[10].registerallow);
      if (iosVersionObject) {
        await settingModel.updateAll({
          id: getAllSettings[10].id
        }, {
          registerallow: JSON.stringify({
            min_ios_version: "1.0.0", current_ios_version: "1.0.0"
          })
        });
      }

    } catch (error) {
      throw error;
    }
  };

  Managescript.updateRoleIdOfSuperAdmin = async (req) => {
    var settingModel = app.models.setting;
    var userModel = app.models.user;

    try {

      var getRequestedUserDetails = await userModel.findOne({
        where: {
          id: req.query.id
        }
      });

      if (getRequestedUserDetails && getRequestedUserDetails.roleId === 1) {
        await userModel.updateAll({
          id: getRequestedUserDetails.id
        }, {
          roleId: 6
        });
      }

    } catch (error) {
      throw error;
    }
  };

  Managescript.deleteProductWhichSubcategoryOrCategoryNotExist = async () => {

    var categotyModel = app.models.category;
    var productModel = app.models.product;
    var getSubcategoryDetails, getCategoryDetails;

    try {

      var getProductList = await productModel.find();
      for (let i = 0; i < getProductList.length; i++) {
        const element = getProductList[i];
        // Check subcategory of product us exist or not
        getSubcategoryDetails = await categotyModel.findOne({
          where: {
            id: element.categoryId
          }
        });
        // When Subcategory Exist than check category exist or not
        if (getSubcategoryDetails) {
          getCategoryDetails = await categotyModel.findOne({
            where: {
              id: getSubcategoryDetails.parentId
            }
          });
          if (!getCategoryDetails) {
            await productModel.updateAll({
              id: element.id
            }, {
              deletedAt: new Date()
            });
          }
        } else {
          await productModel.updateAll({
            id: element.id
          }, {
            deletedAt: new Date()
          });
        }

      }

    } catch (error) {
      throw error;
    }
  };

  Managescript.getSuperAdmin = async () => {
    try {

      var getUserDetails = await app.models.user.findOne({
        where: {
          roleId: constants.SUPER_ADMIN_ROLEID
        }
      });

      if (getUserDetails) {
        var getMasterDetails = await app.models.masterdetail.findOne({
          where: {
            id: getUserDetails.masterdetailId
          }
        });
        getUserDetails.code = getMasterDetails.codename;
        return getUserDetails;
      } else {
        throw constants.createError(404, 'User not found');
      }

    } catch (error) {
      throw error;
    }
  };

  Managescript.deleteMasterId = async (req) => {
    try {

      var getMasterDetails = await app.models.masterdetail.findOne({
        where: {
          id: req.query.filter.where.id
        }
      });

      if (getMasterDetails) {
        var getUserDetails = await app.models.user.findOne({
          where: {
            roleId: constants.ADMIN_ROLEID,
            masterdetailId: getMasterDetails.id
          }
        });
        if (getUserDetails) {
          await app.models.user.update({
            id: getUserDetails.id
          }, {
            deletedAt: new Date()
          });
        }
        await app.models.masterdetail.update({
          id: getMasterDetails.id
        }, {
          deletedAt: new Date()
        });
      }

    } catch (error) {
      throw error;
    }
  };

  Managescript.deleteSalesModuleData = async (req) => {
    try {

      var getMasterDetails = await app.models.masterdetail.findOne({
        where: {
          id: req.query.filter.where.id
        }
      });

      if (getMasterDetails) {
        // Delete Order + Requested Product Data
        var getOrderTableData = await app.models.order.find({
          where: {
            masterdetailId: getMasterDetails.id
          }
        });

        if (getOrderTableData && getOrderTableData.length > 0) {
          for (let i = 0; i < getOrderTableData.length; i++) {
            const element = getOrderTableData[i];
            await app.models.order.update({
              id: element.id
            }, {
              deletedAt: new Date()
            });
          }
        }

        // Delete Inquiry Data
        var getInquiryTableData = await app.models.inquiry.find({
          where: {
            masterdetailId: getMasterDetails.id
          }
        });

        if (getInquiryTableData && getInquiryTableData.length > 0) {
          for (let i = 0; i < getInquiryTableData.length; i++) {
            const element = getInquiryTableData[i];
            await app.models.inquiry.update({
              id: element.id
            }, {
              deletedAt: new Date()
            });
          }
        }

      }

    } catch (error) {
      throw error;
    }
  };

  Managescript.setNotificationTypes = async (req) => {

    try {

      var otpInstance = "UPDATE `notificationtype` SET `notification` = 'Dear [name], <br><br> Your verification OTP is [code].<br>Please use this OTP to complete the verification process.<br><br>Thank You.<br>BizOn365 Team' WHERE `notificationtype`.`code` = 'OTP/INSTANCE';";
      executeQuery(otpInstance);

      var codeInstance = "UPDATE `notificationtype` SET `notification` = '<p>Dear [name],</p> <p>Thanks for choosing BizOn365</p> <p>Your free trial starts today.</p> <p>Congratulations on starting your journey with BizOn365. We are excited you are here and cant wait to help you get started.</p> <p>You will get an access to all features available on BizOn365. During these next 3 months, so make sure you can utilize them fully. </p><b>Your Store Details:</b> <ul> <li><u>Your web store name</u> : [name]</li> <li><u>Your store code </u> : [code]</li> <li><u>Your webstore link</u> : <a href=\"[webstore]\">[webstore]</a></li> <li><u>Your Admin panel link</u> : <a href=\"[adminpanel]\">[adminpanel]</a></li> <li><u>Your current active plan</u> : [plan] </li> <li><u>Your current plan price</u> : [price] </li> <li><u>Your trial start date </u> : [startdate] </li> <li><u>Your trial expire date </u> : [expiredate] </li> </ul> <p>To your online success</p> <p>Team BizOn365</p>' WHERE `notificationtype`.`id` = 17;"
      executeQuery(codeInstance);

      var emailVerification = "UPDATE `notificationtype` SET `notification` = 'Dear [name],<br><br>Please click on below link to verify your BizOn365 account. <br>Link : <a href=\"[text]\">Click Here</a><br><br>Thank You.<br>BizOn365 Team' WHERE `notificationtype`.`code` = 'EMAIL/VERIFICATION';"
      executeQuery(emailVerification);

      var otpInstanceSms = "UPDATE `notificationtype` SET `notification` = 'Dear[name], \r\nYour OTP is [otp]. \r\nPlease verify your account by providing OTP.\r\nThank You. BizOn365 Team' WHERE `notificationtype`.`code` = 'OTP/INSTANCE_SMS';";
      executeQuery(otpInstanceSms);

      var emailExpiryPlan = "UPDATE `notificationtype` SET `notification` = '<p>Dear [name],</p> <p>Your current plan will be expire in the next <b> [noofdays] days. </b></p> <p>Kindly please update your plan from the given link.</p> <a href=\"https://manage.bizon365.com/\"> BizOn365 : https://manage.bizon365.com/ </a> <br> <p>If you will not update your plan then we will move you to a free plan. </p> <ul> <li> If your products are out of the limit, We will deactivate your products as per the free plan limit. </li> <li> If your users, salesmen, are out of the limit, We will deactivate them as per the free plan limit. </li> <li> We will move all customers to the default group, you are not able to add additional groups. </li> <li> We will disable all payment gateways & not allowing any kind of shipping charges on orders. </li> </ul> Thank You, <b>BizOn365 Team.</b>\r\n' WHERE `notificationtype`.`code` = 'EMAIL/EXPIRE_PLAN';";
      executeQuery(emailExpiryPlan);

      var emailOneTimePayment = "UPDATE `notificationtype` SET `notification` = '<center><p>Dear [name],</p>Your payment for plan [planname] is successful. Please find your payment details below:<br><br><table><td>Payment Id</td><td>:</td><td>[paymentid]</td><tr></tr><tr></tr><td>Attempted On</td><td>:</td><td>[date]</td><tr></tr><tr></tr><td>Payment via</td><td>:</td><td>[paymentmode]</td><tr></tr><tr></tr><td>Email</td><td>:</td><td>[email]</td><tr></tr><tr></tr><td>Mobile Number</td><td>:</td><td>[mobileno]</td><tr></tr><tr></tr><td>Amount</td><td>:</td><td>[amount]</td></table><br><br><p>Thank You</p><p>Team BizOn365 </p></center>' WHERE `notificationtype`.`code` = 'EMAIL/ONETIMEPAYMENT_SUCCESSFUL';";
      executeQuery(emailOneTimePayment);

      var emailMerchantCreated = "UPDATE `notificationtype` SET `notification` = '<p>Dear Sufalam Technologies</p>A new merchant has been registered.<br>Following are the details:<br><br><table><td>Name</td><td>:</td><td>[username]</td><tr></tr><tr></tr><td>Email</td><td>:</td><td>[email]</td><tr></tr><tr></tr><td>Contact Number</td><td>:</td><td>[cellnumber]</td><tr></tr><tr></tr><td>Business Name</td><td>:</td><td>[companyname]</td><tr></tr><tr></tr><td>Catalogue Type</td><td>:</td><td>[catelague]</td><tr></tr><tr></tr><td>Plan Name</td><td>:</td><td>[planname]</td></table><br><br><p>Thank You</p>' WHERE `notificationtype`.`id` = 345;";
      executeQuery(emailMerchantCreated);

      var smsOneTimePayment = "UPDATE `notificationtype` SET `notification` = 'Dear [name],\r\nYour payment for the plan [planname] is successful. Please find your payment details below:\r\n[amount]\r\nPayment Successful.\r\nPayment Id : [paymentid]\r\nAttempted On: date]\r\nPayment via : [paymentmode]\r\nEmail : [email]\r\nMobile Number : [mobileno]\r\nThank You\r\nTeam BizOn365' WHERE `notificationtype`.`code` = 'SMS/ONETIMEPAYMENT_SUCCESSFUL';";
      executeQuery(smsOneTimePayment);

    } catch (error) {
      throw error;
    }
  };

  Managescript.updateOrderEmailNotifications = async (req) => {

    var notificationTypeModel = app.models.notificationtype;

    try {

      var getMasterdetailIData = await app.models.masterdetail.find();

      for (let i = 0; i < getMasterdetailIData.length; i++) {
        const element = getMasterdetailIData[i];
        if (element.id === constants.defaultTenantId) {
          // Get ORDER/PENDING
          var getOrderPendingNotificationType = await notificationTypeModel.findOne({
            where: {
              code: settingConstants.ORDER_PENDING,
              masterdetailId: element.id
            }
          });
          // Update ORDER/PENDING
          await notificationTypeModel.updateAll({
            id: getOrderPendingNotificationType.id
          }, {
            textmessage_html: '<p> Dear Akib Dahya, </p> <p> Your order [orderno] of [noofproduct] products has been submitted successfully to [merchant_business_name].</p> <table> <td>Total Items</td> <td>:</td> <td>[totalitems]</td> <tr></tr> <td>Amount Payable</td> <td>:</td> <td>[totalamount]</td> <tr></tr> <td>Name</td> <td>:</td> <td>[username]</td> <tr></tr> <td>Email ID</td> <td>:</td> <td>[email]</td> <tr></tr> <td>Billing Address</td> <td>:</td> <td>[billingaddress]</td> </table> <br><br> <p> Thank You </p> <p> ' + app.get('serverConfig').emailSenderName + ' Team </p> '
          });
        }
      }

    } catch (error) {
      throw error;
    }

  };

  Managescript.updateProductVariation = async (req) => {

    try {

      var productModel = app.models.product;

      var getAllMasterdetails = await app.models.masterdetail.find();

      if (getAllMasterdetails && getAllMasterdetails.length > 0) {
        for (let i = 0; i < getAllMasterdetails.length; i++) {
          const elementMaster = getAllMasterdetails[i];

          var getMasterVariationSetting = await app.models.setting.findOne({
            where: {
              registerallow: constants.PRODUCT_VARIATION_KEY,
              masterdetailId: elementMaster.id
            }
          });
          if (getMasterVariationSetting && getMasterVariationSetting.text) {
            getMasterVariationSetting = JSON.parse(getMasterVariationSetting.text);
          } else {
            getMasterVariationSetting = [];
          }

          if (getMasterVariationSetting.length > 0) {
            var getAllProducts = await productModel.find({
              where: {
                masterdetailId: elementMaster.id
              }
            });
            for (let i = 0; i < getAllProducts.length; i++) {
              const element = getAllProducts[i];
              if (!element.variationconfig) {
                await app.models.product.update({
                  id: element.id
                }, {
                  variationconfig: JSON.stringify(getMasterVariationSetting)
                });
              }
            }
          }
        }
      }

    } catch (error) {
      throw error;
    }

  };

  Managescript.updateAppName = async (req) => {

    try {

      console.log(req.body);

      var getMasterData = await app.models.masterdetail.findOne({
        where: {
          id: req.body.masterdetailId
        }
      });

      var descriptionData = JSON.parse(getMasterData.description);

      descriptionData.find(item => {
        if (item.key === 'webstoreURL') {
          item.value = req.body.app_name.toLowerCase().split(" ").join("");
        }
      });
      descriptionData = JSON.stringify(descriptionData);
      await app.models.masterdetail.updateAll({
        id: req.body.masterdetailId
      }, {
        description: descriptionData,
        fullname: req.body.app_name
      });

      await app.models.setting.findOne({
        masterdetailId: req.body.masterdetailId,
        registerallow: constants.APP_NAME_LABLE
      }, {
        text: req.body.app_name
      });


    } catch (error) {
      throw error;
    }

  };

  Managescript.deleteDataOfInstance = async (req) => {

    try {

      const OFFER_BANNERS = 'Offer_Banners';

      // Delete Orders + Inquiries + Requested Products
      if (req.body.isDeleteOrderData) {
        await app.models.order.updateAll({
          masterdetailId: req.body.masterdetailId
        }, {
          deletedAt: new Date()
        });
      }

      // Delete Salesman Inquiries
      if (req.body.isDeleteRequestedProductData) {
        await app.models.inquiry.updateAll({
          masterdetailId: req.body.masterdetailId
        }, {
          deletedAt: new Date()
        });
      }

      // Delete Categories
      if (req.body.isDeleteCategoryData) {
        await app.models.category.updateAll({
          masterdetailId: req.body.masterdetailId
        }, {
          deletedAt: new Date()
        });
      }

      // Delete Products
      if (req.body.isDeleteProductData) {
        await app.models.product.updateAll({
          masterdetailId: req.body.masterdetailId
        }, {
          deletedAt: new Date()
        });
      }

      // Delete Collections
      if (req.body.isDeleteCollectionData) {
        await app.models.collection.updateAll({
          masterdetailId: req.body.masterdetailId
        }, {
          deletedAt: new Date()
        });
      }

      // Delete Banners
      if (req.body.isDeleteBannersData) {
        await app.models.setting.updateAll({
          masterdetailId: req.body.masterdetailId,
          registerallow: OFFER_BANNERS
        }, {
          text: JSON.stringify([])
        });
      }

      // Delete Notifications
      if (req.body.isDeleteNotificationData) {
        await app.models.notificationreceiver.updateAll({
          masterdetailId: req.body.masterdetailId
        }, {
          deletedAt: new Date()
        });
      }

    } catch (error) {
      throw error;
    }

  };

  Managescript.updateNumberOfTimeSignIn = async (req) => {

    var userModel = app.models.user;
    var usermetaauthModel = app.models.usermetaauth;

    try {

      await usermetaauthModel.updateAll({
        nooftimesignin: null
      }, {
        nooftimesignin: 0
      });

      await userModel.updateAll({
        countrycode: null
      }, {
        countrycode: "+91"
      });

    } catch (error) {
      throw error;
    }

  };

  Managescript.importDaxalCosmeticContacts = async (req) => {

    var userModel = app.models.user;
    var usermetaauthModel = app.models.usermetaauth;
    var commoncounterModel = app.models.commoncounter;

    const DC_DEFAULT_GROUPID = "e4b3364c-e30c-480a-a8a7-6d064148593c";
    const DC_AHMEDABAD_CITYID = "c7314aca-2c9c-46e4-a511-3259e25c9eb3";
    const DC_MASTERID = "efa3a3fa-a292-470a-a06d-3cf8e60e481d";

    try {

      var updateGujaratStateId = "UPDATE `city` SET `stateId`='703' WHERE `stateId`='658';";
      executeQuery(updateGujaratStateId);

      var undoDeleteCalifornia = "UPDATE `state` SET `deletedAt` = NULL WHERE `state`.`id` = 669;"
      executeQuery(undoDeleteCalifornia);

      var undoDeleteFlorida = "UPDATE `state` SET `deletedAt` = NULL WHERE `state`.`id` = 671;"
      executeQuery(undoDeleteFlorida);

      var undoDeleteAlaska = "UPDATE `state` SET `deletedAt` = NULL WHERE `state`.`id` = 672;"
      executeQuery(undoDeleteAlaska);

      for (let i = 0; i < req.body.userData.length; i++) {
        const element = req.body.userData[i];

        let createdUser = await userModel.create({
          cellnumber: element.cellnumber,
          roleId: constants.USER_ROLEID,
          cityId: DC_AHMEDABAD_CITYID,
          groupId: DC_DEFAULT_GROUPID,
          companyname: element.companyname,
          username: element.username,
          cellnumber: element.cellnumber,
          isregistered: true,
          password: "b2buser@123",
          created: new Date(),
          modified: new Date(),
          masterdetailId: DC_MASTERID,
          userstatus: "Active",
          registervia: "'ADMIN'"
        });

        // usermetaauthModel
        await usermetaauthModel.create({
          userId: createdUser.id,
          pushnotification: 1,
          masterdetailId: DC_MASTERID,
          tempcell: element.cellnumber
        });

        // Entry in commoncounterModel
        await commoncounterModel.create({
          userId: createdUser.id,
          notifications: 0,
          cart: 0,
          masterdetailId: DC_MASTERID
        });

        await createRoleMapping({
          principalType: "USER",
          principalId: createdUser.id,
          roleId: constants.USER_ROLEID,
          masterdetailId: DC_MASTERID.masterdetailId
        });

      }



      // Delete Ahmedabad, Surat

    } catch (error) {
      throw error;
    }

  };

  /**
   * delete instances from live    Dt: 14/07/2022
   *
   */
  Managescript.deleteInstance = async (req) => {

    var { masterdetail } = app.models;

    try {

      var instanceIds = [
        "601f12f4-81ef-47dc-9c85-087272d23998", // Pabrai
        "354c064b-3820-4f0b-83a8-913bc3978982", // sufalam
        "752c80a9-e15f-416a-b79b-a0168ec15402", // sf
        "75dc9196-642f-455f-8dee-428fce178164", // K M Electronics
        "3fdd9730-ecac-4a5a-bfe9-9fd9c697793b", // Starco Care
      ];

      let deleted = await masterdetail.update({
        id: { inq: instanceIds }
      }, {
        status: false,
        deletedAt: new Date()
      });

      return deleted;

    } catch (error) {
      throw error;
    }

  };


  /**
   * SQL Queries
   *
   * Set Product Variation Null
   * UPDATE `product` SET `productvariation` = NULL, `variationconfig` = NULL
   *
   * Set Default Category Image
   * UPDATE `categorymedia` SET `categoryname`='default_category.png'
   *
   * Set Default Product Image
   * UPDATE `productmedia` SET `productname`='noimagefound.png'
   *
   * Get timestamp from date
   * var timeStampWith3MonthsFromCurrentDate = moment(moment()).add(3, 'M').unix(); // add 3 months to current date
   *
   */

  /** MasterdetailId Of All Isntances
   * SF - 752c80a9-e15f-416a-b79b-a0168ec15402
   * Nutland - 6b623f64-ed4c-46fb-88f0-ce700aa6fcb1
   * CG - 85b14ad3-5d40-4a96-98cf-ba33811bbc39
   * Kapasi - 68ad28f0-7784-4fea-ba8d-03780b8df4cc
   */

  /**
   * Sadad Store Instances
   * 1. ddb7f289-7341-4950-9699-da7eeb0befb1 - Ibrahim Comp ()
   * 2.
   */

};


async function executeQuery(query) {
  try {
    return await new Promise((resolve, reject) => {
      app.datasources.mysql.connector.execute(query, null, (err, result) => {
        if (err) reject(err);
        resolve(result);
      });
    });
  } catch (error) {
    throw error;
  }
}

function sendEmail(email, content, subject, merchantcompanyname, attachment) {
  var emailModel = app.models.email;
  emailModel.sendEmail({
    senderEmail: email,
    subject: subject,
    messageContent: content,
    merchantcompanyname: merchantcompanyname,
    attachment: attachment
  }, (err, data) => {
    if (err) console.log(err);
    console.log('Email sent');
  });
}

function formatDate(date, patternStr) {

  var monthNames = [
    "January", "February", "March", "April", "May", "June", "July",
    "August", "September", "October", "November", "December"
  ];

  var dayOfWeekNames = [
    "Sunday", "Monday", "Tuesday",
    "Wednesday", "Thursday", "Friday", "Saturday"
  ];

  if (!patternStr) {
    patternStr = 'M/d/yyyy';
  }
  var day = date.getDate(),
    month = date.getMonth(),
    year = date.getFullYear(),
    hour = date.getHours(),
    minute = date.getMinutes(),
    second = date.getSeconds(),
    miliseconds = date.getMilliseconds(),
    h = hour % 12,
    hh = twoDigitPad(h),
    HH = twoDigitPad(hour),
    mm = twoDigitPad(minute),
    ss = twoDigitPad(second),
    aaa = hour < 12 ? 'AM' : 'PM',
    EEEE = dayOfWeekNames[date.getDay()],
    EEE = EEEE.substr(0, 3),
    dd = twoDigitPad(day),
    M = month + 1,
    MM = twoDigitPad(M),
    MMMM = monthNames[month],
    MMM = MMMM.substr(0, 3),
    yyyy = year + "",
    yy = yyyy.substr(2, 2)
    ;
  // checks to see if month name will be used
  patternStr = patternStr
    .replace('hh', hh).replace('h', h)
    .replace('HH', HH).replace('H', hour)
    .replace('mm', mm).replace('m', minute)
    .replace('ss', ss).replace('s', second)
    .replace('S', miliseconds)
    .replace('dd', dd).replace('d', day)

    .replace('EEEE', EEEE).replace('EEE', EEE)
    .replace('yyyy', yyyy)
    .replace('yy', yy)
    .replace('aaa', aaa);
  if (patternStr.indexOf('MMM') > -1) {
    patternStr = patternStr
      .replace('MMMM', MMMM)
      .replace('MMM', MMM);
  }
  else {
    patternStr = patternStr
      .replace('MM', MM)
      .replace('M', M);
  }
  return patternStr;
}

function twoDigitPad(num) {
  return num < 10 ? "0" + num : num;
}

async function createRoleMapping(params) {
  await app.models.rolemapping.create({
    principalType: params.principalType,
    principalId: params.principalId,
    roleId: params.roleId,
    masterdetailId: params.masterdetailId
  });
}
