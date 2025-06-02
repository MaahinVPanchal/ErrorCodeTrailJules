'use strict';
var app = require('../../server/server');
var sendIP = require('../../server/bin/iosPush');
var sendN = require('../../server/bin/androidPush');

// var moment = require('moment');
// userdefined modules
var sendS = require('../../server/bin/sendsms');
// var sendIP = require('../../server/bin/sendiOspush');
// var sendN = require('../../server/bin/sendAndroidpush');

var constants = require("../../common/const");
const {
  commonFindOneFunction
} = require('../../common/const');

var NOTIFICATIONTYPE; // sms,push,email send or not
module.exports = function (Notify) {

  Notify.share = async function (code, instance, notifyOptions) {

    var notificationReceiverModel = app.models.notificationreceiver;
    var accessToken = app.models.AccessToken;
    var settingModel = app.models.setting;
    var user, metaAuth, notificationType, textMessage, tenantType, email, arabicTextMessage;
    var templateId, storeName, adminData, sendTo; //changes by Parth
    var isEmailLogin = false;

    notificationType = await getNotificationType(code, notifyOptions.masterdetailId);
    NOTIFICATIONTYPE = notificationType; // store the notification type instance

    if (!notifyOptions.masterdetailId && instance && instance.masterdetailId) {
      notifyOptions.masterdetailId = instance.masterdetailId;
    }
    tenantType = await getTenantName(notifyOptions.masterdetailId);

    var loginViaEmail;
    // is login via email enabled
    // get tenanat config data
    if (instance && (instance.masterdetailId || notifyOptions.masterdetailId)) {

      if (!instance.masterdetailId) {
        instance.masterdetailId = notifyOptions.masterdetailId;
      }

      loginViaEmail = await constants.commonFindOneFunction({
        model: app.models.setting,
        whereObj: {
          registerallow: constants.SETTING_TENANT_CONFIG,
          status: 1,
          masterdetailId: instance.masterdetailId
        }
      });
    }

    if (loginViaEmail) {
      loginViaEmail = JSON.parse(loginViaEmail.text); // parse tenant config text to json
      // check isEmailBasedLogin key true or false
      if (loginViaEmail.isEmailBasedLogin === true) {
        isEmailLogin = true;
      }
    }

    // get admin data
    adminData = await app.models.user.findOne({
      where: {
        roleId: constants.ADMIN_ROLEID,
        masterdetailId: instance.masterdetailId
      }
    });

    //setting is_notify check
    var setting = await settingModel.findOne({
      where: {
        registerallow: constants.IS_NOTIFY_KEY,
        masterdetailId: notifyOptions.masterdetailId
      }
    });

    // fetch user details
    if (instance.$userId) {
      user = await getUser(instance.$userId);
      metaAuth = await getUserMeta(instance.$userId);
      // userPreferences = await getUserPreferences(instance.$userId);
    }

    // cart push notification
    if (instance.id) {
      user = await getUser(instance.id);
      metaAuth = await getUserMeta(instance.id);
      // userPreferences = await getUserPreferences(instance.$userId);
    }

    // fetch userdetaiis for OTP
    if (instance[1]) {
      user = await getUser(instance[1]);
      metaAuth = await getUserMeta(instance[1]);
    }
    // userPreferences = await getUserPreferences(instance.$userId);

    // for device token
    if (instance.userId) {
      user = await getUser(instance.userId);
      metaAuth = await getUserMeta(instance.userId);
      // userPreferences = await getUserPreferences(instance.$userId);
    }

    if (code === 'ORDER/INPROGRESS') {
      textMessage = NOTIFICATIONTYPE.$notification;
      textMessage = textMessage.replace('[orderno]', instance.orderno);
      textMessage = textMessage.replace('[noofproduct]', instance.orderdetail.length);
      textMessage = textMessage.replace('[merchant_business_name]', tenantType.text);

      if (instance.$userId) {
        notificationReceiverModel.createNotification(
          instance.id, //order id
          textMessage, // content is same as message
          instance.$userId, //who order
          instance.$userId, //who order
          instance.tenant,
          notifyOptions.masterdetailId
        );
      }
      if (metaAuth.pushnotification === 1) {
        // send push notification to ios device
        sendIP.sendiOspush(metaAuth.devicetoken, textMessage, instance.id, constants.ORDERNOTIFICATION, {
          masterdetailId: notifyOptions.masterdetailId
        });
        // send push notification to android device
        sendN.sendAndroidpush(metaAuth.devicetoken, textMessage, instance.id, constants.ORDERNOTIFICATION, {
          masterdetailId: notifyOptions.masterdetailId
        });
      }
      // for sending email
      if (isEmailLogin == true && user.email) {
        email = NOTIFICATIONTYPE.textmessage_html;
        email = email.replace('[name]', user.username);
        email = email.replace('[orderno]', instance.orderno);
        email = email.replace('[noofproduct]', instance.orderdetail.length);
        email = email.replace('[companyname]', tenantType.text);
        sendEmail(user.email, email, 'Order In-Progress', app.get('serverConfig').emailSenderName);
      }
      templateId = NOTIFICATIONTYPE.templateId;
      // send sms to user
      // if (app.get('isProduction')) {
      sendS.sendSms(user.cellnumber, textMessage, {
        masterdetailId: user.masterdetailId,
        templateId: templateId
      });
      // }
    } else if (code === 'INQUIRY/INPROGRESS') {
      textMessage = NOTIFICATIONTYPE.$notification;
      textMessage = textMessage.replace('[orderno]', instance.orderno);
      textMessage = textMessage.replace('[noofproduct]', instance.orderdetail.length);
      textMessage = textMessage.replace('[merchant_business_name]', tenantType.text);

      if (instance.$userId) {
        notificationReceiverModel.createNotification(
          instance.id, //order id
          textMessage, // content is same as message
          instance.$userId, //who order
          instance.$userId, //who order
          instance.tenant,
          notifyOptions.masterdetailId
        );
      }
      if (metaAuth.pushnotification === 1) {
        // send push notification to ios device
        sendIP.sendiOspush(metaAuth.devicetoken, textMessage, instance.id, constants.ORDERNOTIFICATION, {
          masterdetailId: notifyOptions.masterdetailId
        }); // Added 1 new parameter "notifyOptions.masterdetailId" :Parth dt_21-04-2021
        // send push notification to android device
        sendN.sendAndroidpush(metaAuth.devicetoken, textMessage, instance.id, constants.ORDERNOTIFICATION, {
          masterdetailId: notifyOptions.masterdetailId
        }); // Added 1 new parameter "notifyOptions.masterdetailId" :Parth dt_12-04-2021
        // static device token used for testing.
        // sendN.sendAndroidpush('erScQvrmTNSEGaGs_AjIeq:APA91bFvYotM3-WgTQD7p0eGmZJDMzR2L7VQjdqnFePfZrnp-5830fBHzPB8X0LTDUpXWBxF5VMu_adQ-6GFH9xVMIJz5Ay7GUlOfPpo4Ij5IVg_JLhaM0mqFuUwY-R6uFLawLYzhbD9', textMessage, instance.id, constants.ORDERNOTIFICATION, "752c80a9-e15f-416a-b79b-a0168ec15402");
        // sendIP.sendiOspush('fa3f9b1a8755916207603da1df4f4defed862d6967dc17e82b6c655b8d1961ed', textMessage, instance.id, constants.ORDERNOTIFICATION, "752c80a9-e15f-416a-b79b-a0168ec15402");
      }
      // for sending email
      if (isEmailLogin == true && user.email) {
        email = NOTIFICATIONTYPE.textmessage_html;
        email = email.replace('[name]', user.username);
        email = email.replace('[orderno]', instance.orderno);
        email = email.replace('[noofproduct]', instance.orderdetail.length);
        email = email.replace('[companyname]', adminData.companyname);
        sendEmail(user.email, email, 'Inquiry In-Progress', app.get('serverConfig').emailSenderName);
      }
      templateId = NOTIFICATIONTYPE.templateId;
      // send sms to user
      // if (app.get('isProduction')) {
      sendS.sendSms(user.cellnumber, textMessage, {
        masterdetailId: user.masterdetailId,
        templateId: templateId
      });
      // }
    } else if (code === 'ORDER/PENDING') {
      textMessage = NOTIFICATIONTYPE.$notification;
      textMessage = textMessage.replace('[orderno]', instance.orderno);
      textMessage = textMessage.replace('[noofproduct]', instance.orderdetail.length);
      textMessage = textMessage.replace('[merchant_business_name]', tenantType.text);

      arabicTextMessage = NOTIFICATIONTYPE.$arabicNotification;
      arabicTextMessage = arabicTextMessage.replace('[orderno]', instance.orderno);
      arabicTextMessage = arabicTextMessage.replace('[noofproduct]', instance.orderdetail.length);
      arabicTextMessage = arabicTextMessage.replace('[merchant_business_name]', tenantType.text);

      if (instance.$userId) {
        notificationReceiverModel.createNotification(
          instance.id, //order id
          textMessage, // content is same as message
          arabicTextMessage, // content is same as message
          instance.$userId, //who order
          instance.$userId, //who order
          instance.tenant,
          notifyOptions.masterdetailId
        );
      }
      if (metaAuth.pushnotification === 1) {
        // send push notification to ios device
        sendIP.sendiOspush(metaAuth.devicetoken, textMessage, instance.id, constants.ORDERNOTIFICATION, {
          masterdetailId: notifyOptions.masterdetailId
        }); // Added 1 new parameter "notifyOptions.masterdetailId" :Parth dt_21-04-2021
        // send push notification to android device
        sendN.sendAndroidpush(metaAuth.devicetoken, textMessage, instance.id, constants.ORDERNOTIFICATION, {
          masterdetailId: notifyOptions.masterdetailId
        }); // Added 1 new parameter "notifyOptions.masterdetailId" :Parth dt_12-04-2021
        // static device token used for testing.
        // sendN.sendAndroidpush('erScQvrmTNSEGaGs_AjIeq:APA91bFvYotM3-WgTQD7p0eGmZJDMzR2L7VQjdqnFePfZrnp-5830fBHzPB8X0LTDUpXWBxF5VMu_adQ-6GFH9xVMIJz5Ay7GUlOfPpo4Ij5IVg_JLhaM0mqFuUwY-R6uFLawLYzhbD9', textMessage, instance.id, constants.ORDERNOTIFICATION, "752c80a9-e15f-416a-b79b-a0168ec15402");
        // sendIP.sendiOspush('fa3f9b1a8755916207603da1df4f4defed862d6967dc17e82b6c655b8d1961ed', textMessage, instance.id, constants.ORDERNOTIFICATION, "752c80a9-e15f-416a-b79b-a0168ec15402");
      }

      // for sending email
      if (isEmailLogin == true && user.email) {
        email = NOTIFICATIONTYPE.textmessage_html;
        email = email.replace('[name]', user.username);
        email = email.replace('[orderno]', instance.orderno);
        email = email.replace('[noofproduct]', instance.orderdetail.length);
        email = email.replace('[companyname]', tenantType.text);
        sendEmail(user.email, email, 'Order Pending', app.get('serverConfig').emailSenderName);
      }

      templateId = NOTIFICATIONTYPE.templateId;
      // send sms to user
      // if (app.get('isProduction')) {
      sendS.sendSms(user.cellnumber, textMessage, {
        masterdetailId: user.masterdetailId,
        templateId: templateId
      });
      // }
    } else if (code === 'INQUIRY/PENDING') {
      textMessage = NOTIFICATIONTYPE.$notification;
      textMessage = textMessage.replace('[orderno]', instance.orderno);
      textMessage = textMessage.replace('[noofproduct]', instance.orderdetail.length);
      textMessage = textMessage.replace('[merchant_business_name]', tenantType.text);

      if (instance.$userId) {
        notificationReceiverModel.createNotification(
          instance.id, //order id
          textMessage, // content is same as message
          instance.$userId, //who order
          instance.$userId, //who order
          instance.tenant,
          notifyOptions.masterdetailId
        );
      }
      if (metaAuth.pushnotification === 1) {
        // send push notification to ios device
        sendIP.sendiOspush(metaAuth.devicetoken, textMessage, instance.id, constants.ORDERNOTIFICATION, {
          masterdetailId: instance.masterdetailId
        }); // Added 1 new parameter "notifyOptions.masterdetailId" :Parth dt_21-04-2021
        // send push notification to android device
        sendN.sendAndroidpush(metaAuth.devicetoken, textMessage, instance.id, constants.ORDERNOTIFICATION, {
          masterdetailId: instance.masterdetailId
        }); // Added 1 new parameter "notifyOptions.masterdetailId" :Parth dt_12-04-2021
        // static device token used for testing.
        // sendN.sendAndroidpush('erScQvrmTNSEGaGs_AjIeq:APA91bFvYotM3-WgTQD7p0eGmZJDMzR2L7VQjdqnFePfZrnp-5830fBHzPB8X0LTDUpXWBxF5VMu_adQ-6GFH9xVMIJz5Ay7GUlOfPpo4Ij5IVg_JLhaM0mqFuUwY-R6uFLawLYzhbD9', textMessage, instance.id, constants.ORDERNOTIFICATION, "752c80a9-e15f-416a-b79b-a0168ec15402");
        // sendIP.sendiOspush('fa3f9b1a8755916207603da1df4f4defed862d6967dc17e82b6c655b8d1961ed', textMessage, instance.id, constants.ORDERNOTIFICATION, "752c80a9-e15f-416a-b79b-a0168ec15402");
      }
      // for sending email
      if (isEmailLogin == true && user.email) {
        email = NOTIFICATIONTYPE.textmessage_html;
        email = email.replace('[name]', user.username);
        email = email.replace('[orderno]', instance.orderno);
        email = email.replace('[noofproduct]', instance.orderdetail.length);
        email = email.replace('[companyname]', adminData.companyname);
        sendEmail(user.email, email, 'Inquiry Pending', app.get('serverConfig').emailSenderName);
      }
      templateId = NOTIFICATIONTYPE.templateId;
      // send sms to user
      // if (app.get('isProduction')) {
      sendS.sendSms(user.cellnumber, textMessage, {
        masterdetailId: user.masterdetailId,
        templateId: templateId
      });
      // }
    } else if (code === 'ORDER/COMFIRMED') {
      textMessage = NOTIFICATIONTYPE.$notification;
      textMessage = textMessage.replace('[orderno]', instance.orderno);
      textMessage = textMessage.replace('[noofproduct]', instance.orderdetail.length);
      textMessage = textMessage.replace('[merchant_business_name]', tenantType.text);

      if (instance.$userId) {
        notificationReceiverModel.createNotification(
          instance.id, //order id
          textMessage, // content is same as message
          instance.$userId, //who order
          instance.$userId, //who order
          instance.tenant,
          notifyOptions.masterdetailId
        );
      }
      if (metaAuth.pushnotification === 1) {
        // send push notification to ios device
        sendIP.sendiOspush(metaAuth.devicetoken, textMessage, instance.id, constants.ORDERNOTIFICATION, {
          masterdetailId: notifyOptions.masterdetailId
        });
        // send push notification to android device
        sendN.sendAndroidpush(metaAuth.devicetoken, textMessage, instance.id, constants.ORDERNOTIFICATION, {
          masterdetailId: notifyOptions.masterdetailId
        });
      }
      // for sending email
      if (isEmailLogin == true && user.email) {
        email = NOTIFICATIONTYPE.textmessage_html;
        email = email.replace('[name]', user.username);
        email = email.replace('[orderno]', instance.orderno);
        email = email.replace('[noofproduct]', instance.orderdetail.length);
        email = email.replace('[companyname]', tenantType.text);
        sendEmail(user.email, email, 'Order Confirmed', app.get('serverConfig').emailSenderName);
      }
      templateId = NOTIFICATIONTYPE.templateId;
      // send sms to user
      // if (app.get('isProduction')) {
      sendS.sendSms(user.cellnumber, textMessage, {
        masterdetailId: user.masterdetailId,
        templateId: templateId
      });
      // }
    } else if (code === 'INQUIRY/COMFIRMED') {
      textMessage = NOTIFICATIONTYPE.$notification;
      textMessage = textMessage.replace('[orderno]', instance.orderno);
      textMessage = textMessage.replace('[noofproduct]', instance.orderdetail.length);
      textMessage = textMessage.replace('[merchant_business_name]', tenantType.text);

      if (instance.$userId) {
        notificationReceiverModel.createNotification(
          instance.id, //order id
          textMessage, // content is same as message
          instance.$userId, //who order
          instance.$userId, //who order
          instance.tenant,
          notifyOptions.masterdetailId
        );
      }

      if (metaAuth.pushnotification === 1) {
        // send push notification to ios device
        sendIP.sendiOspush(metaAuth.devicetoken, textMessage, instance.id, constants.ORDERNOTIFICATION, {
          masterdetailId: instance.masterdetailId
        });
        // send push notification to android device
        sendN.sendAndroidpush(metaAuth.devicetoken, textMessage, instance.id, constants.ORDERNOTIFICATION, {
          masterdetailId: instance.masterdetailId
        });
      }
      // for sending email
      if (isEmailLogin == true && user.email) {
        email = NOTIFICATIONTYPE.textmessage_html;
        email = email.replace('[name]', user.username);
        email = email.replace('[orderno]', instance.orderno);
        email = email.replace('[noofproduct]', instance.orderdetail.length);
        email = email.replace('[companyname]', adminData.companyname);
        sendEmail(user.email, email, 'Inquiry Confirmed', app.get('serverConfig').emailSenderName);
      }
      templateId = NOTIFICATIONTYPE.templateId;
      // send sms to user
      // if (app.get('isProduction')) {
      sendS.sendSms(user.cellnumber, textMessage, {
        masterdetailId: user.masterdetailId,
        templateId: templateId
      });
      // }
    } else if (code === 'ORDER/CANCELLED') {
      textMessage = NOTIFICATIONTYPE.$notification;
      textMessage = textMessage.replace('[orderno]', instance.orderno);
      textMessage = textMessage.replace('[noofproduct]', instance.orderdetail.length);
      if (instance.ORDER_CANCEL_BY && instance.ORDER_CANCEL_BY === 'SELF') {
        textMessage = textMessage.replace('[merchant_business_name]', instance.customername);
      } else {
        textMessage = textMessage.replace('[merchant_business_name]', tenantType.text);
      }

      if (instance.$userId) {
        notificationReceiverModel.createNotification(
          instance.id, //order id
          textMessage, // content is same as message
          instance.$userId, //who order
          instance.$userId, //who order
          instance.tenant,
          notifyOptions.masterdetailId
        );
      }
      if (metaAuth.pushnotification === 1) {
        // send push notification to ios device
        sendIP.sendiOspush(metaAuth.devicetoken, textMessage, instance.id, constants.ORDERNOTIFICATION, {
          masterdetailId: notifyOptions.masterdetailId
        });
        // send push notification to android device
        sendN.sendAndroidpush(metaAuth.devicetoken, textMessage, instance.id, constants.ORDERNOTIFICATION, {
          masterdetailId: notifyOptions.masterdetailId
        });
      }
      // for sending email
      if (isEmailLogin == true && user.email) {
        email = NOTIFICATIONTYPE.textmessage_html;
        email = email.replace('[name]', user.username);
        email = email.replace('[orderno]', instance.orderno);
        email = email.replace('[noofproduct]', instance.orderdetail.length);
        email = email.replace('[companyname]', tenantType.text);
        sendEmail(user.email, email, 'Order Cancelled', app.get('serverConfig').emailSenderName);
      }
      templateId = NOTIFICATIONTYPE.templateId;
      // send sms to user
      // if (app.get('isProduction')) {
      sendS.sendSms(user.cellnumber, textMessage, {
        masterdetailId: user.masterdetailId,
        templateId: templateId
      });
      // }
    } else if (code === 'INQUIRY/CANCELLED') {
      textMessage = NOTIFICATIONTYPE.$notification;
      textMessage = textMessage.replace('[orderno]', instance.orderno);
      textMessage = textMessage.replace('[noofproduct]', instance.orderdetail.length);
      textMessage = textMessage.replace('[merchant_business_name]', tenantType.text);

      if (instance.$userId) {
        notificationReceiverModel.createNotification(
          instance.id, //order id
          textMessage, // content is same as message
          instance.$userId, //who order
          instance.$userId, //who order
          instance.tenant,
          notifyOptions.masterdetailId
        );
      }
      if (metaAuth.pushnotification === 1) {
        // send push notification to ios device
        sendIP.sendiOspush(metaAuth.devicetoken, textMessage, instance.id, constants.ORDERNOTIFICATION, {
          masterdetailId: instance.masterdetailId
        });
        // send push notification to android device
        sendN.sendAndroidpush(metaAuth.devicetoken, textMessage, instance.id, constants.ORDERNOTIFICATION, {
          masterdetailId: instance.masterdetailId
        });
      }
      // for sending email
      if (isEmailLogin == true && user.email) {
        email = NOTIFICATIONTYPE.textmessage_html;
        email = email.replace('[name]', user.username);
        email = email.replace('[orderno]', instance.orderno);
        email = email.replace('[noofproduct]', instance.orderdetail.length);
        email = email.replace('[companyname]', adminData.companyname);
        sendEmail(user.email, email, 'Inquiry Cancelled', app.get('serverConfig').emailSenderName);
      }
      templateId = NOTIFICATIONTYPE.templateId;
      // send sms to user
      // if (app.get('isProduction')) {
      sendS.sendSms(user.cellnumber, textMessage, {
        masterdetailId: user.masterdetailId,
        templateId: templateId
      });
      // }
    } else if (code === 'ORDER/REJECTED') {
      textMessage = NOTIFICATIONTYPE.$notification;
      textMessage = textMessage.replace('[orderno]', instance.orderno);
      textMessage = textMessage.replace('[noofproduct]', instance.orderdetail.length);
      textMessage = textMessage.replace('[merchant_business_name]', tenantType.text);

      if (instance.$userId) {
        notificationReceiverModel.createNotification(
          instance.id, //order id
          textMessage, // content is same as message
          instance.$userId, //who order
          instance.$userId, //who order
          instance.tenant,
          notifyOptions.masterdetailId
        );
      }
      if (metaAuth.pushnotification === 1) {
        // send push notification to ios device
        sendIP.sendiOspush(metaAuth.devicetoken, textMessage, instance.id, constants.ORDERNOTIFICATION, {
          masterdetailId: notifyOptions.masterdetailId
        });
        // send push notification to android device
        sendN.sendAndroidpush(metaAuth.devicetoken, textMessage, instance.id, constants.ORDERNOTIFICATION, {
          masterdetailId: notifyOptions.masterdetailId
        });
      }
      // for sending email
      if (isEmailLogin == true && user.email) {
        email = NOTIFICATIONTYPE.textmessage_html;
        email = email.replace('[name]', user.username);
        email = email.replace('[orderno]', instance.orderno);
        email = email.replace('[noofproduct]', instance.orderdetail.length);
        email = email.replace('[companyname]', tenantType.text);
        sendEmail(user.email, email, 'Order Rejected', app.get('serverConfig').emailSenderName);
      }
      templateId = NOTIFICATIONTYPE.templateId;
      // send sms to user
      // if (app.get('isProduction')) {
      sendS.sendSms(user.cellnumber, textMessage, {
        masterdetailId: user.masterdetailId,
        templateId: templateId
      });
      // }
    } else if (code === 'INQUIRY/REJECTED') {
      textMessage = NOTIFICATIONTYPE.$notification;
      textMessage = textMessage.replace('[orderno]', instance.orderno);
      textMessage = textMessage.replace('[noofproduct]', instance.orderdetail.length);
      textMessage = textMessage.replace('[merchant_business_name]', tenantType.text);

      if (instance.$userId) {
        notificationReceiverModel.createNotification(
          instance.id, //order id
          textMessage, // content is same as message
          instance.$userId, //who order
          instance.$userId, //who order
          instance.tenant,
          notifyOptions.masterdetailId
        );
      }
      if (metaAuth.pushnotification === 1) {
        // send push notification to ios device
        sendIP.sendiOspush(metaAuth.devicetoken, textMessage, instance.id, constants.ORDERNOTIFICATION, {
          masterdetailId: instance.masterdetailId
        });
        // send push notification to android device
        sendN.sendAndroidpush(metaAuth.devicetoken, textMessage, instance.id, constants.ORDERNOTIFICATION, {
          masterdetailId: instance.masterdetailId
        });
      }
      // for sending email
      if (isEmailLogin == true && user.email) {
        email = NOTIFICATIONTYPE.textmessage_html;
        email = email.replace('[name]', user.username);
        email = email.replace('[orderno]', instance.orderno);
        email = email.replace('[noofproduct]', instance.orderdetail.length);
        email = email.replace('[companyname]', adminData.companyname);
        sendEmail(user.email, email, 'Inquiry Rejected', app.get('serverConfig').emailSenderName);
      }
      templateId = NOTIFICATIONTYPE.templateId;
      // send sms to user
      // if (app.get('isProduction')) {
      sendS.sendSms(user.cellnumber, textMessage, {
        masterdetailId: user.masterdetailId,
        templateId: templateId
      });
      // }
    } else if (code === 'ORDER/DELIVERED') {
      textMessage = NOTIFICATIONTYPE.$notification;
      textMessage = textMessage.replace('[orderno]', instance.orderno);
      textMessage = textMessage.replace('[noofproduct]', instance.orderdetail.length);
      textMessage = textMessage.replace('[merchant_business_name]', tenantType.text);

      if (instance.$userId) {
        notificationReceiverModel.createNotification(
          instance.id, //order id
          textMessage, // content is same as message
          instance.$userId, //who order
          instance.$userId, //who order
          instance.tenant,
          notifyOptions.masterdetailId
        );
      }
      if (metaAuth.pushnotification === 1) {
        // send push notification to ios device
        sendIP.sendiOspush(metaAuth.devicetoken, textMessage, instance.id, constants.ORDERNOTIFICATION, {
          masterdetailId: notifyOptions.masterdetailId
        });
        // send push notification to android device
        sendN.sendAndroidpush(metaAuth.devicetoken, textMessage, instance.id, constants.ORDERNOTIFICATION, {
          masterdetailId: notifyOptions.masterdetailId
        });
      }
      // for sending email
      if (isEmailLogin == true && user.email) {
        email = NOTIFICATIONTYPE.textmessage_html;
        email = email.replace('[name]', user.username);
        email = email.replace('[orderno]', instance.orderno);
        email = email.replace('[noofproduct]', instance.orderdetail.length);
        email = email.replace('[companyname]', tenantType.text);
        sendEmail(user.email, email, 'Order Delivered', app.get('serverConfig').emailSenderName);
      }
      templateId = NOTIFICATIONTYPE.templateId;
      // send sms to user
      // if (app.get('isProduction')) {
      sendS.sendSms(user.cellnumber, textMessage, {
        masterdetailId: user.masterdetailId,
        templateId: templateId
      });
      // }
    } else if (code === 'INQUIRY/DELIVERED') {
      textMessage = NOTIFICATIONTYPE.$notification;
      textMessage = textMessage.replace('[orderno]', instance.orderno);
      textMessage = textMessage.replace('[noofproduct]', instance.orderdetail.length);
      textMessage = textMessage.replace('[merchant_business_name]', tenantType.text);

      if (instance.$userId) {
        notificationReceiverModel.createNotification(
          instance.id, //order id
          textMessage, // content is same as message
          instance.$userId, //who order
          instance.$userId, //who order
          instance.tenant,
          notifyOptions.masterdetailId
        );
      }
      if (metaAuth.pushnotification === 1) {
        // send push notification to ios device
        sendIP.sendiOspush(metaAuth.devicetoken, textMessage, instance.id, constants.ORDERNOTIFICATION, {
          masterdetailId: instance.masterdetailId
        });
        // send push notification to android device
        sendN.sendAndroidpush(metaAuth.devicetoken, textMessage, instance.id, constants.ORDERNOTIFICATION, {
          masterdetailId: instance.masterdetailId
        });
      }
      // for sending email
      if (isEmailLogin == true && user.email) {
        email = NOTIFICATIONTYPE.textmessage_html;
        email = email.replace('[name]', user.username);
        email = email.replace('[orderno]', instance.orderno);
        email = email.replace('[noofproduct]', instance.orderdetail.length);
        email = email.replace('[companyname]', adminData.companyname);
        sendEmail(user.email, email, 'Inquiry Delivered', app.get('serverConfig').emailSenderName);
      }
      templateId = NOTIFICATIONTYPE.templateId;
      // send sms to user
      // if (app.get('isProduction')) {
      sendS.sendSms(user.cellnumber, textMessage, {
        masterdetailId: user.masterdetailId,
        templateId: templateId
      });
      // }
    } else if (code === 'SIGNIN/OTP/ANDROID' && instance[2]) {
      textMessage = NOTIFICATIONTYPE.$notification;
      textMessage = textMessage.replace('[otp]', instance[0].signinotp);
      textMessage = textMessage.replace('[appname]', tenantType.text);
      textMessage = textMessage.replace('[smstoken]', instance[2]);
      templateId = NOTIFICATIONTYPE.templateId; //changes by Parth
      textMessage = textMessage.replace('[merchant_business_name]', tenantType.text);
      // if (app.get('isProduction')) {
      sendS.sendSms(user.cellnumber, textMessage, {
        masterdetailId: user.masterdetailId,
        templateId: templateId
      });
      // }
      //changes by Parth
      if (isEmailLogin == true && user.email) {
        email = NOTIFICATIONTYPE.textmessage_html;
        email = email.replace('[username]', user.username);
        email = email.replace('[otp]', instance[0].signinotp);
        email = email.replace('[appname]', tenantType.text);
        sendEmail(user.email, email, 'Sign In OTP', app.get('serverConfig').emailSenderName);
      }
    } else if (code === 'SIGNUP/OTP/ANDROID' && instance[2]) {
      textMessage = NOTIFICATIONTYPE.$notification;
      textMessage = textMessage.replace('[otp]', instance[0].signupotp);
      textMessage = textMessage.replace('[appname]', tenantType.text);
      textMessage = textMessage.replace('[merchant_business_name]', tenantType.text);

      templateId = NOTIFICATIONTYPE.templateId;
      // textMessage = textMessage.replace('[smstoken]', instance[2]);
      // if (app.get('isProduction')) {
      sendS.sendSms(user.cellnumber, textMessage, {
        masterdetailId: user.masterdetailId,
        templateId: templateId
      });
      // }
      if (isEmailLogin == true && user.email) {
        email = NOTIFICATIONTYPE.textmessage_html;
        email = email.replace('[username]', user.username);
        email = email.replace('[otp]', instance[0].signupotp);
        email = email.replace('[appname]', tenantType.text);
        sendEmail(user.email, email, 'Sign Up OTP', app.get('serverConfig').emailSenderName);
      }
    } else if (code === 'SIGNIN/OTP') {
      textMessage = NOTIFICATIONTYPE.$notification;
      textMessage = textMessage.replace('[otp]', instance[0].signinotp);
      textMessage = textMessage.replace('[appname]', tenantType.text);
      textMessage = textMessage.replace('[merchant_business_name]', tenantType.text);

      templateId = NOTIFICATIONTYPE.templateId;
      // if (app.get('isProduction')) {
      sendS.sendSms(user.cellnumber, textMessage, {
        masterdetailId: user.masterdetailId,
        templateId: templateId
      });
      // }
      if (isEmailLogin == true && user.email) {
        email = NOTIFICATIONTYPE.textmessage_html;
        email = email.replace('[username]', user.username);
        email = email.replace('[otp]', instance[0].signinotp);
        email = email.replace('[appname]', tenantType.text);
        sendEmail(user.email, email, 'Sign In OTP', app.get('serverConfig').emailSenderName);
      }
    } else if (code === 'SIGNUP/OTP') {
      textMessage = NOTIFICATIONTYPE.$notification;
      textMessage = textMessage.replace('[otp]', instance[0].signupotp);
      textMessage = textMessage.replace('[appname]', tenantType.text);
      textMessage = textMessage.replace('[merchant_business_name]', tenantType.text);

      templateId = NOTIFICATIONTYPE.templateId;
      // if (app.get('isProduction')) {
      sendS.sendSms(user.cellnumber, textMessage, {
        masterdetailId: user.masterdetailId,
        templateId: templateId
      });
      // }
      if (isEmailLogin == true && user.email) {
        email = NOTIFICATIONTYPE.textmessage_html;
        email = email.replace('[username]', user.username);
        email = email.replace('[otp]', instance[0].signupotp);
        email = email.replace('[appname]', tenantType.text);
        sendEmail(user.email, email, 'Sign Up OTP', app.get('serverConfig').emailSenderName);
      }
    } else if (code === 'DEVICE/CHANGE') {

      textMessage = NOTIFICATIONTYPE.$notification;
      // send push notification to ios device
      sendIP.sendiOspush(metaAuth.devicetoken, textMessage, instance.id, constants.LOGOUTNOTIFICATION, {
        masterdetailId: notifyOptions.masterdetailId
      });
      // send push notification to android device
      sendN.sendAndroidpush(metaAuth.devicetoken, textMessage, instance.id, constants.LOGOUTNOTIFICATION, {
        masterdetailId: notifyOptions.masterdetailId
      });

    } else if (code === 'CART/PUSH') {

      textMessage = NOTIFICATIONTYPE.$notification;
      textMessage = textMessage.replace('[noofproduct]', instance.orderdetail.length);
      textMessage = textMessage.replace('[merchant_business_name]', tenantType.text);
      textMessage = textMessage.replace('[store_link]', app.get('serverConfig').webstore_url);
      if (metaAuth.pushnotification === 1) {
        // send push notification to ios device
        sendIP.sendiOspush(metaAuth.devicetoken, textMessage, instance.id, constants.ADDTOCARTNOTIFICATION, {
          masterdetailId: notifyOptions.masterdetailId
        });
        // send push notification to android device
        sendN.sendAndroidpush(metaAuth.devicetoken, textMessage, instance.id, constants.ADDTOCARTNOTIFICATION, {
          masterdetailId: notifyOptions.masterdetailId
        });
      }

    } else if (code === 'CREDENTIALS/SMS') {
      textMessage = NOTIFICATIONTYPE.$notification;
      if (instance.companyname) {
        textMessage = textMessage.replace('[username]', instance.companyname);
      } else {
        textMessage = textMessage.replace('[username]', instance.username);
      }
      textMessage = textMessage.replace('[cellnumber]', instance.cellnumber);
      textMessage = textMessage.replace('[appname]', tenantType.text);
      textMessage = textMessage.replace('[storelink]', instance.webstoreLink);
      textMessage = textMessage.replace('[merchant_business_name]', tenantType.text);
      templateId = NOTIFICATIONTYPE.templateId;
      // if (app.get('isProduction')) {
      sendS.sendSms(instance.cellnumber, textMessage, {
        masterdetailId: instance.masterdetailId,
        templateId: templateId
      });
      // }
    } else if (code === 'CELLNUMBER/CHANGE') {
      // Dear[username], Your cellnumber of [appname] App is changed from[oldcell] to[newcell].
      textMessage = NOTIFICATIONTYPE.$notification;
      textMessage = textMessage.replace('[username]', instance.username);
      textMessage = textMessage.replace('[oldcell]', metaAuth.tempcell);
      textMessage = textMessage.replace('[newcell]', instance.cellnumber);
      textMessage = textMessage.replace('[appname]', tenantType.text);
      textMessage = textMessage.replace('[merchant_business_name]', tenantType.text);
      templateId = NOTIFICATIONTYPE.templateId;
      // if (app.get('isProduction')) {
      sendS.sendSms(instance.cellnumber, textMessage, {
        masterdetailId: instance.masterdetailId,
        templateId: templateId
      });
      // }
    } else if (code === 'ORDER/UPDATE/ADMIN') {
      // Your order [orderno] has been updated by the seller.
      textMessage = NOTIFICATIONTYPE.$notification;
      textMessage = textMessage.replace('[orderno]', instance.orderno);
      if (instance.$userId) {
        notificationReceiverModel.createNotification(
          instance.id, //order id
          textMessage, // content is same as message
          instance.$userId, //who order
          instance.$userId, //who order
          instance.tenant,
          notifyOptions.masterdetailId
        );
      }
      if (metaAuth.pushnotification === 1) {
        // send push notification to ios device
        sendIP.sendiOspush(metaAuth.devicetoken, textMessage, instance.id, constants.ORDERNOTIFICATION, {
          masterdetailId: notifyOptions.masterdetailId
        });
        // send push notification to android device
        sendN.sendAndroidpush(metaAuth.devicetoken, textMessage, instance.id, constants.ORDERNOTIFICATION, {
          masterdetailId: notifyOptions.masterdetailId
        });
      }
    } else if (code === 'ORDER/SAMPLEREQUEST') {
      textMessage = NOTIFICATIONTYPE.$notification;
      textMessage = textMessage.replace('[name]', instance.name);
      textMessage = textMessage.replace('[appname]', tenantType.text);
      textMessage = textMessage.replace('[merchant_business_name]', tenantType.text);

      if (instance.$userId) {
        notificationReceiverModel.createNotification(
          instance.id, //order id
          textMessage, // content is same as message
          instance.$userId, //who order
          instance.$userId, //who order
          instance.tenant,
          notifyOptions.masterdetailId
        );
      }
      if (metaAuth.pushnotification === 1) {
        // send push notification to ios device
        sendIP.sendiOspush(metaAuth.devicetoken, textMessage, instance.id, constants.ORDERNOTIFICATION, {
          masterdetailId: notifyOptions.masterdetailId
        });
        // send push notification to android device
        sendN.sendAndroidpush(metaAuth.devicetoken, textMessage, instance.id, constants.ORDERNOTIFICATION, {
          masterdetailId: notifyOptions.masterdetailId
        });
      }
      templateId = NOTIFICATIONTYPE.templateId;
      // send sms to user
      // if (app.get('isProduction')) {
      sendS.sendSms(user.cellnumber, textMessage, {
        masterdetailId: user.masterdetailId,
        templateId: templateId
      });
      // }
    } else if (code === 'EMAIL/VERIFICATION') {
      textMessage = NOTIFICATIONTYPE.$notification;
      textMessage = textMessage.replace('[name]', instance.companyname);
      textMessage = textMessage.replace('[text]', instance.redirectURL);
      sendEmail(user.email, textMessage, 'Email Verification', app.get('serverConfig').emailSenderName);
    } else if (code === 'CODE/INSTANCE') {
      textMessage = NOTIFICATIONTYPE.$notification;
      textMessage = textMessage.replace('[name]', instance.companyname);
      textMessage = textMessage.replace('[code]', instance.code);
      textMessage = textMessage.replace('[name]', instance.companyname);
      textMessage = textMessage.replace('[webstore]', instance.webstore);
      textMessage = textMessage.replace('[webstore]', instance.webstore);
      textMessage = textMessage.replace('[adminpanel]', instance.adminpanel);
      textMessage = textMessage.replace('[adminpanel]', instance.adminpanel);
      textMessage = textMessage.replace('[plan]', instance.plan);
      textMessage = textMessage.replace('[price]', instance.price);
      textMessage = textMessage.replace('[startdate]', instance.startdate);
      textMessage = textMessage.replace('[expiredate]', instance.expiredate);
      sendEmail(user.email, textMessage, 'Trial Started', app.get('serverConfig').emailSenderName);

    } else if (code === 'SMS/VERIFICATION') {
      textMessage = NOTIFICATIONTYPE.$notification;
      textMessage = textMessage.replace('[name]', instance.companyname);
      textMessage = textMessage.replace('[text]', instance.redirectURL);
      templateId = NOTIFICATIONTYPE.templateId;
      // if (app.get('isProduction')) {
      sendS.sendSms(user.cellnumber, textMessage, {
        masterdetailId: user.masterdetailId,
        templateId: templateId
      });
      // }
    } else if (code === 'CODE/INSTANCE_SMS') {
      textMessage = NOTIFICATIONTYPE.$notification;
      textMessage = textMessage.replace('[name]', instance.companyname);
      textMessage = textMessage.replace('[code]', instance.code);
      templateId = NOTIFICATIONTYPE.templateId;
      // if (app.get('isProduction')) {
      sendS.sendSms(user.cellnumber, textMessage, {
        masterdetailId: user.masterdetailId,
        templateId: templateId
      });
      // }
    } else if (code === 'OTP/INSTANCE') {
      textMessage = NOTIFICATIONTYPE.$notification;
      textMessage = textMessage.replace('[name]', instance[0].companyname);
      textMessage = textMessage.replace('[code]', instance[0].signupotp);
      sendEmail(user.email, textMessage, 'Verification Code for your' + app.get('serverConfig').emailSenderName + 'account', app.get('serverConfig').emailSenderName);
    } else if (code === 'EMAIL/EXPIRE_PLAN') {
      textMessage = NOTIFICATIONTYPE.$notification;
      textMessage = textMessage.replace('[name]', instance.companyname);
      textMessage = textMessage.replace('[noofdays]', instance.noofdays);
      sendEmail(user.email, textMessage, 'Plan Expires', app.get('serverConfig').emailSenderName);
    } else if (code === 'EMAIL/ONETIPMEPAYMENT_EXPIRE_PLAN') {
      textMessage = NOTIFICATIONTYPE.$notification;
      textMessage = textMessage.replace('[name]', instance.companyname);
      textMessage = textMessage.replace('[noofdays]', instance.noofdays);
      sendEmail(user.email, textMessage, 'One Time Payment Plan Expires', app.get('serverConfig').emailSenderName);
    } else if (code === 'EMAIL/ORDER_PENDING') {
      textMessage = NOTIFICATIONTYPE.$notification;
      textMessage = textMessage.replace('[name]', user.username);
      textMessage = textMessage.replace('[orderno]', instance.orderno);
      textMessage = textMessage.replace('[noofproduct]', instance.orderdetail.length);
      storeName = await commonFindOneFunction({
        model: app.models.user,
        whereObj: {
          roleId: constants.ADMIN_ROLEID,
          masterdetailId: user.masterdetailId
        }
      });
      textMessage = textMessage.replace('[companyname]', storeName.companyname);
      sendEmail(user.email, textMessage, 'Order Pending', app.get('serverConfig').emailSenderName);
    } else if (code === 'EMAIL/INQUIRY_PENDING') {
      textMessage = NOTIFICATIONTYPE.$notification;
      textMessage = textMessage.replace('[name]', user.username);
      textMessage = textMessage.replace('[orderno]', instance.orderno);
      textMessage = textMessage.replace('[noofproduct]', instance.orderdetail.length);
      storeName = await commonFindOneFunction({
        model: app.models.user,
        whereObj: {
          roleId: constants.ADMIN_ROLEID,
          masterdetailId: user.masterdetailId
        }
      });
      textMessage = textMessage.replace('[companyname]', storeName.companyname);
      sendEmail(user.email, textMessage, 'Inquiry Pending', app.get('serverConfig').emailSenderName);
    } else if (code === 'EMAIL/ONETIMEPAYMENT_SUCCESSFUL') {
      textMessage = NOTIFICATIONTYPE.$notification;
      textMessage = textMessage.replace('[name]', user.companyname);
      textMessage = textMessage.replace('[planname]', instance.planname);
      textMessage = textMessage.replace('[amount]', instance.amount);
      textMessage = textMessage.replace('[paymentid]', instance.paymentid);
      textMessage = textMessage.replace('[date]', instance.paymentdate);
      textMessage = textMessage.replace('[paymentmode]', instance.paymentmode);
      textMessage = textMessage.replace('[email]', instance.email);
      textMessage = textMessage.replace('[mobileno]', instance.cellnumber);

      sendEmail(user.email, textMessage, 'Payment Successful', app.get('serverConfig').emailSenderName);
    } else if (code === 'SMS/ONETIMEPAYMENT_SUCCESSFUL') {
      textMessage = NOTIFICATIONTYPE.$notification;
      textMessage = textMessage.replace('[name]', user.username ? user.username : '--');
      textMessage = textMessage.replace('[planname]', instance.planname);
      textMessage = textMessage.replace('[amount]', instance.amount);
      textMessage = textMessage.replace('[paymentid]', instance.paymentid);
      textMessage = textMessage.replace('[date]', instance.paymentdate);
      textMessage = textMessage.replace('[paymentmode]', instance.paymentmode);
      textMessage = textMessage.replace('[email]', instance.email);
      textMessage = textMessage.replace('[mobileno]', instance.mobilenumber);
      templateId = NOTIFICATIONTYPE.templateId;
      // if (app.get('isProduction')) {
      sendS.sendSms(user.cellnumber, textMessage, {
        masterdetailId: user.masterdetailId,
        templateId: templateId
      });
      // }
    } else if (code === 'EMAIL/MERCHANT_CREATED') {
      textMessage = NOTIFICATIONTYPE.$notification;
      textMessage = textMessage.replace('[username]', instance.companyname);
      textMessage = textMessage.replace('[email]', instance.email);
      textMessage = textMessage.replace('[cellnumber]', instance.cellnumber ? instance.cellnumber : '--');
      textMessage = textMessage.replace('[companyname]', instance.companyname);
      textMessage = textMessage.replace('[catelague]', instance.catelague);
      textMessage = textMessage.replace('[planname]', instance.planname);

      var newMerchantEmail = [];
      if (app.get('isProduction')) {
        newMerchantEmail = constants.newMerchantEmailLive;
      } else {
        newMerchantEmail = constants.commonEmailForTest;
      }

      sendEmail(newMerchantEmail, textMessage, 'New Merchant Created', app.get('serverConfig').emailSenderName);
    } else if (code === 'EMAIL/FEEDBACK') {
      email = NOTIFICATIONTYPE.textmessage_html;
      email = email.replace('[customername]', instance.username === null ? 'Guest Customer' : instance.username);
      email = email.replace('[description]', instance.feedback);
      email = email.replace('[username]', instance.username === null ? 'Guest Customer' : instance.username);
      email = email.replace('[email]', instance.email);
      email = email.replace('[cellnumber]', instance.cellnumber === null ? '--' : instance.cellnumber);
      sendEmail(instance.mailreceiver, email, 'Customer Feedback', app.get('serverConfig').emailSenderName);
    } else if (code === 'INVOICE/EMAIL') {
      email = NOTIFICATIONTYPE.textmessage_html;
      email = email.replace('[name]', user.username);
      email = email.replace('[date]', instance.date);
      var attachment = [{
        filename: 'invoice.pdf',
        path: instance.filename
      }]
      sendEmail(user.email, email, 'Order Invoice', app.get('serverConfig').emailSenderName, attachment);
      //for admin
      var emailtext = NOTIFICATIONTYPE.textmessage;
      emailtext = emailtext.replace('[appname]', adminData.companyname);
      emailtext = emailtext.replace('[orderno]', instance.orderno);
      emailtext = emailtext.replace('[username]', user.username);
      emailtext = emailtext.replace('[date]', instance.date);
      sendEmail(instance.adminEmail, emailtext, 'Order Invoice', app.get('serverConfig').emailSenderName, attachment);
    } else if (code === 'CDM/EMAIL') { // for Custom Domain Mapping
      email = NOTIFICATIONTYPE.textmessage_html;
      email = email.replace('[name]', instance.username);
      email = email.replace('[appname]', instance.companyname);
      email = email.replace('[domainname]', instance.customdomain);
      var customdomainEmail = [];
      if (app.get('isProduction')) {
        customdomainEmail = constants.customdomainEmailLive;
      } else {
        customdomainEmail = constants.commonEmailForTest;
      }
      var sendto = [instance.email, customdomainEmail]
      sendEmail(sendto, email, 'Custom Domain Mapping', app.get('serverConfig').emailSenderName);
    } else if (code === 'PLACEORDER/ADMIN') {
      email = NOTIFICATIONTYPE.textmessage_html;
      email = email.replace('[appname]', adminData.companyname);
      email = email.replace('[orderno]', instance.orderno);
      email = email.replace('[username]', user.username);

      sendEmail(adminData.email, email, 'Order Received', app.get('serverConfig').emailSenderName);
    } else if (code === 'ORDERSTATUS/ADMIN') {
      var status = await getOrderStatus(instance.orderstatus, instance.masterdetailId);
      email = NOTIFICATIONTYPE.textmessage_html;
      email = email.replace('[appname]', adminData.companyname);
      email = email.replace('[orderno]', instance.orderno);
      email = email.replace('[orderstatus]', status.status);
      sendEmail(adminData.email, email, 'Order Status Changed', app.get('serverConfig').emailSenderName);
    } else if (code === 'PLACEINQUIRY/ADMIN') {
      email = NOTIFICATIONTYPE.textmessage_html;
      email = email.replace('[appname]', adminData.companyname);
      email = email.replace('[orderno]', instance.orderno);
      email = email.replace('[username]', user.username);
      sendEmail(adminData.email, email, 'Inquiry Received', app.get('serverConfig').emailSenderName);
    } else if (code === 'INQUIRYSTATUS/ADMIN') {
      var status = await getOrderStatus(instance.orderstatus, instance.masterdetailId);
      email = NOTIFICATIONTYPE.textmessage_html;
      email = email.replace('[appname]', adminData.companyname);
      email = email.replace('[orderno]', instance.orderno);
      email = email.replace('[orderstatus]', status.status);
      sendEmail(adminData.email, email, 'Inquiry Status Changed', app.get('serverConfig').emailSenderName);
    }

  }

};

//  get user informations
function getUser(userId) {
  var userModel = app.models.user;
  return userModel.findById(userId);
}

// get user's meta information
function getUserMeta(userId) {

  var userMetaAuthModel = app.models.usermetaauth;
  return userMetaAuthModel.findOne({
    where: {
      userId: userId
    }
  });
}

// Get Tenant Information.
function getTenantName(masterdetailId) {
  let settingModel = app.models.setting;
  return settingModel.findOne({
    where: {
      registerallow: constants.APP_NAME_LABLE,
      masterdetailId: masterdetailId
    }
  });
}

// Get Order status.
async function getOrderStatus(statusId, masterdetailId) {
  return app.models.orderstatus.findOne({
    where: {
      id: statusId,
      masterdetailId: masterdetailId
    }
  });
}

// get notification type
function getNotificationType(code, masterdetailId) {
  var notificationTypesModel = app.models.notificationtype;
  return notificationTypesModel.findOne({
    where: {
      code: code,
      masterdetailId: masterdetailId
    }
  });
}

// get user's Business
function getUserBusiness(userId) {
  var userBusinessModel = app.models.userbusiness;
  return userBusinessModel.findOne({
    where: {
      userId: userId
    }
  });
}

// send push
function sendPush(token, content, notificationType, isplayasound, entity) {
  if (NOTIFICATIONTYPE.is_sendpushnotification) {
    // send push notification to ios device
    sendIP.sendiOspush(token, content, notificationType, isplayasound, entity);
    // send push notification to android device
    sendN.sendAndroidpush(token, content, notificationType, isplayasound, entity);
  }
}

async function sendSms(cellnumber, content, options) {
  // Get Current Merchant : Manage Sms Limit & Send SMS

  if (options.masterdetailId) {
    var getCurrentSmsCreditLimit = await app.models.masterdetailmeta.findOne({
      where: {
        masterdetailId: options.masterdetailId
      }
    });

    // check Plan Commonfunction
    var result = await constants.getCurrentMarchantPlan(constants.CURRENT_MERCHANT_PLAN_LABEL, 1, options.masterdetailId);
    var getResultOfSMSKey = await constants.commonCheckPlanCriteriaFeatures(result, ctx.args.data.masterdetailId, constants.SMS_CREDITS_KEY);

    if (getCurrentSmsCreditLimit.smscredits > getResultOfSMSKey) {
      throw constants.createError(404, 'You have rich your maximum limit of sms!');
    }
    if (NOTIFICATIONTYPE.is_sendsms) {
      sendS.sendSms('+91' + cellnumber, content);
      await app.models.masterdetailmeta.updateAll({
        id: getCurrentSmsCreditLimit.id,
        masterdetailId: options.masterdetailId
      }, {
        smscredits: getCurrentSmsCreditLimit.smscredits + 1
      });
    }
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
