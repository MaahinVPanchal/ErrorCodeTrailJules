"use strict";
var app = require("../../server/server");

module.exports = function (Ordernotes) {

  Ordernotes.afterRemote("create", async (ctx, modelInstance, next) => {
    var ordernotesmedia = app.models.ordernotesmedia;
    try {
      if (ctx.args.data.ordernotesmedia) {
        await ordernotesmedia.create({
          file: ctx.args.data.ordernotesmedia.name,
          filetype: ctx.args.data.ordernotesmedia.type,
          ordernotesId: modelInstance.id,
          masterdetailId: ctx.req.query.where.masterdetailId
        }).catch((err) => {
          next("User ordernotes details saved, please check the ordernotesmedia media.. ");
        });
      }
    } catch (error) {
      throw error;
    }
  });

  Ordernotes.afterRemote("find", async (ctx, modelInstance, next) => {
    var resData = {};
    try {
      if (ctx.req.query.filter) {
        if (ctx.req.query.filter.where) {
          if (ctx.req.query.filter.where.and[0].orderId) {
            let ordernotesdata = await Ordernotes.find({
              where: {
                orderId: ctx.req.query.filter.where.and[0].orderId,
                masterdetailId: ctx.req.query.where.masterdetailId
              },
              include: ["ordernotesmedia", "user"],
            });
            resData.data = ordernotesdata;
            resData.length = ordernotesdata.length;
            ctx.res.status(200).send(resData);
          }
        }
      }
    } catch (error) {
      throw error;
    }
  });
};
