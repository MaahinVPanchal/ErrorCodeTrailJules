'use strict';
var app = require('../../server/server');

module.exports = function (Notificationreceiver) {



  Notificationreceiver.beforeRemote('find', (ctx, modelInstance, next) => {
    var notificationReceiverId = ctx.args.filter.where.userId;

    // manual check for authentication
    if (ctx.args.filter != undefined && notificationReceiverId != undefined
      && notificationReceiverId == ctx.req.accessToken.userId) {
      next();
    } else {
      var err = new Error('Authorization Required');
      err.statusCode = 401;
      return next(err);
    }

  });


  Notificationreceiver.afterRemote('find', async (ctx, modelInstance, next) => {
    var productModel = app.models.product;
    var orderModel = app.models.order;
    var orderdetailsModel = app.models.orderdetails;
    var commoncounterModel = app.models.commoncounter;
    var productData = [];
    var orderData = [];
    var order;
    var orderdetails;


    for (let i = 0; i < modelInstance.length; i++) {
      order = await orderModel.find({
        where: {
          id: modelInstance[i].orderId,
          masterdetailId: ctx.req.query.where.masterdetailId
        }
      });

      // update the notification when it read counter
      if (modelInstance[i].isread === false) {
        // update notification as read and decrease counter of notification
        await Notificationreceiver.updateAll({
          id: modelInstance[i].id
        }, {
          isread: 1
        });

        modelInstance[i].isread = 1;

        commoncounterModel.updateCounters(modelInstance[i].userId, '-', 1, 'notifications', ctx.req.baseUrl);
      }

      if (order.length > 0) {
        for (let j = 0; j < order.length; j++) {
          orderdetails = await orderdetailsModel.findOne({
            where: {
              orderId: order[j].id,
              masterdetailId: ctx.req.query.where.masterdetailId
            }
          });

          if (orderdetails) {
            var product = await productModel.findOne({
              where: {
                id: orderdetails.productId
              },
              include: "user"
            });
          }

        }
        if (orderdetails) {
          productData.push(product);
        }

      }
      orderData.push(order);
      modelInstance[i].product = productData;
      modelInstance[i].currentDateTime = new Date();
      modelInstance.order = orderData;
    }
  });


  Notificationreceiver.createNotification = async (entityId, textMessage, arabicTextMessage, sender, receiver, tenant, masterdetailId) => {

    var notificationModel = app.models.notification;
    var commonCounterModel = app.models.commoncounter;

    // create a notification for receiver
    notificationModel.create({
      "entity_id": entityId,
      "arabicTextmessage": arabicTextMessage,
      "textmessage": textMessage,
      "textmessage_html": "",
      "createdby": sender,
      "modifiedby": sender,
      masterdetailId: masterdetailId
    }).then((notification) => {

      // once notification is created use its id to make an entry in notificationreceivers table
      Notificationreceiver.create({
        "isread": false,
        "ishide": false,
        "createdby": sender,
        "modifiedby": 0,
        "notificationId": notification.id,
        "userId": receiver,
        "orderId": notification.entity_id,
        masterdetailId: masterdetailId
      }).catch(console.log);
    }).catch(console.log);

    commonCounterModel.updateCounters(receiver, '+', 1, 'notifications', tenant);
  }
};
