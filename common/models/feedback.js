'use strict';
var app = require("../../server/server");
var constants = require("../const");

module.exports = function (Feedback) {

  Feedback.beforeRemote("create", async (ctx, modelInstance, next) => {

    try {
      ctx.args.data.userId = ctx.req.accessToken.userId;
      if (!ctx.args.data.email) {
        var userEmail = await constants.commonFindOneFunction({
          model: app.models.user,
          whereObj: {
            id: ctx.args.data.userId,
            masterdetailId: ctx.args.data.masterdetailId
          }
        });
        if (userEmail && userEmail.email) {
          ctx.args.data.email = userEmail.email;
        }
      }
    } catch (error) {
      throw error;
    }

  });

  Feedback.afterRemote("create", async (ctx, modelInstance, next) => {

    var userData;
    var userModel = app.models.user;
    var notifyModel = app.models.notify;

    try {

      userData = await constants.commonFindOneFunction({
        model: userModel,
        whereObj: {
          id: ctx.args.data.userId,
          masterdetailId: ctx.args.data.masterdetailId
        }
      });

      userData.feedback = modelInstance.description;

      if (userData.email === null || userData.email === undefined) {
        userData.email = ctx.req.body.email;
      }

      var mailreceiver = await constants.commonFindOneFunction({
        model: userModel,
        whereObj: {
          roleId: constants.ADMIN_ROLEID,
          masterdetailId: ctx.args.data.masterdetailId
        }
      });
      userData.mailreceiver = mailreceiver.email;

      await notifyModel.share("EMAIL/FEEDBACK", userData, {
        masterdetailId: null
      });

    } catch (error) {
      throw error;
    }

  });

};
