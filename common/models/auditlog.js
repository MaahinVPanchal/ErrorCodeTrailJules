"use strict";
var app = require("../../server/server");
var ip6addr = require("ip6addr");
var DeviceDetector = require("device-detector-js");

module.exports = function (Auditlog) {
  // save audit log to db
  Auditlog.generateAuditLog = (auditlog) => {
    var accesstokenModel = app.models.AccessToken;
    var userModel = app.models.user;
    // var addr = ip6addr.parse(auditlog.ip);

    // auditlog.ip = addr.toString({ format: 'v4' });

    const deviceDetector = new DeviceDetector();
    const userAgent = auditlog.useragent;
    var device = deviceDetector.parse(userAgent);
    device = JSON.stringify(device);

    if (auditlog.statusCode <= 399) {
      auditlog.result = "";
    }

    // find userId
    if (auditlog.accessToken) {
      var accesstokenModel = accesstokenModel
        .findOne({
          where: {
            id: auditlog.accessToken,
          },
        })
        .then((data) => {
          if (data) {
            // find user detail
            var user = userModel
              .findOne({
                where: {
                  id: data.userId,
                },
                deleted: true,
              })
              .then((data) => {
                Auditlog.create({
                  ip: auditlog.ip || null,
                  deviceinfo: device,
                  method: auditlog.method,
                  url: auditlog.url,
                  request: JSON.stringify(auditlog.request),
                  response_code: auditlog.statusCode,
                  response: JSON.stringify(auditlog.result),
                  userId: data.id,
                  cellnumber: data.cellnumber,
                  username: data.username,
                  masterdetailId: auditlog.masterdetailId,
                });
              });
          } else {
            Auditlog.create({
              ip: auditlog.ip,
              deviceinfo: device,
              method: auditlog.method,
              url: auditlog.url,
              request: JSON.stringify(auditlog.request),
              response_code: auditlog.statusCode,
              response: JSON.stringify(auditlog.result),
              userId: null,
              cellnumber: null,
              username: null,
              masterdetailId: auditlog.masterdetailId,
            });
          }
        });
    } else {
      Auditlog.create({
        ip: auditlog.ip,
        deviceinfo: device,
        method: auditlog.method,
        url: auditlog.url,
        request: JSON.stringify(auditlog.request),
        response_code: auditlog.statusCode,
        response: JSON.stringify(auditlog.result),
        userId: null,
        cellnumber: null,
        username: null,
        masterdetailId: auditlog.masterdetailId,
      });
    }
  };

  Auditlog.afterRemote("find", async (ctx, modelInstance) => {
    var resData = {};
    var tempQuery;
    try {
      if (ctx.req.query.isWeb) {
        var auditlog = await Auditlog.find();
        resData.data = modelInstance;
        resData.length = auditlog.length;
        if (
          ctx &&
          ctx.req &&
          ctx.req.query &&
          ctx.req.query.filter &&
          ctx.req.query.filter.where &&
          ctx.req.query.filter.where.and
        ) {
          tempQuery = ctx.req.query.filter;
          delete tempQuery.limit;
          delete tempQuery.skip;
          var filteraudit = await Auditlog.find({
            where: tempQuery.where,
          });
          resData.data = modelInstance;
          resData.length = filteraudit.length;
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
