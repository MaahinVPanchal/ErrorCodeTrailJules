"use strict";
var app = require("../../server/server");

module.exports = function (Notification) {
  Notification.afterRemote("find", async (ctx, modelInstance, next) => {
    var notificationModel = app.models.notification;
    var resData = {};

    try {
      if (ctx.req.query.isWeb) {
        var notification = await notificationModel.find({
          where: {
            masterdetailId: ctx.req.query.where.masterdetailId,
          },
        });
        resData.data = modelInstance;
        resData.length = notification.length;

        if (ctx.req.query.filter.where && ctx.req.query.filter.where.and) {
          resData.data = modelInstance;
          resData.length = modelInstance.length;
          ctx.res.status(200).send(resData);
          return;
        } else {
          ctx.res.status(200).send(resData);
          return;
        }
      }
    } catch (error) {
      throw error;
    }
  });
};
