'use strict';
var app = require('../../server/server');
module.exports = function (Notificationtype) {


  Notificationtype.afterRemote('findOne', async (ctx, modelInstance, next) => {
    var settingModel = app.models.setting;

    var setting = await settingModel.findOne({
      where: {
        status: 2,
        masterdetailId: ctx.req.query.where.masterdetailId
      }
    });

    if (ctx.req.query.filter) {
      var appname = setting.registerallow;
      var information = modelInstance.$notification;
      information = information.replace('[appname]', appname);
    }

    return modelInstance.notification = information;
  });
};
