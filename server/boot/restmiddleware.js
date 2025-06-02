const apps = require('../server');
const constants = require('../../common/const');

module.exports = function (app) {
  app.remotes().phases.addBefore('invoke', 'options-from-request').use(async function (ctx, next) {
    var accessTokenModel = app.models.AccessToken;
    var mastdetailModel = app.models.masterdetail;
    var auditlogModel = apps.models.auditlog;
    var requestUser;

    // check API version
    try {

      if (ctx.req.headers.authorization) {
        requestUser = await accessTokenModel.findById(ctx.req.headers.authorization);
      }

      if (!ctx.req.originalUrl.includes('masterdetails') &&
        !ctx.req.originalUrl.includes('login') &&
        !ctx.req.originalUrl.includes('containers') &&
        !ctx.req.originalUrl.includes('getColorCode') &&
        !ctx.req.originalUrl.includes('getLanguage') &&
        !ctx.req.originalUrl.includes('settings') &&
        !ctx.req.originalUrl.includes('cities') &&
        !(ctx.req.originalUrl.includes('/api/users') && ctx.req.method == 'POST') &&
        !(ctx.req.originalUrl.includes('/api/containers/tempmedia/upload') && ctx.req.method == 'POST') &&
        !ctx.req.originalUrl.includes('api/products/generaterandomproductno') &&
        !ctx.req.originalUrl.includes('api/products/countTotalProductsIntoCategory') &&
        !ctx.req.originalUrl.includes('api/users/checkEmailOrCellnumberExist') &&
        !ctx.req.originalUrl.includes('api/settings/getThemeColor') &&
        !ctx.req.originalUrl.includes('api/orders/generateInvoice') &&
        !ctx.req.originalUrl.includes('managescripts')
      ) {
        if (!requestUser) {
          throw constants.createError(401, 'Authorization required!');
        }

        // // * 1. Customer Groups
        // var checkGroupUrl = await constants.checkUrlInPlanConfiguration(requestUser.masterdetailId, constants.CUSTOMER_GROUP_KEY, ctx.req.originalUrl, ctx.req.method);
        // if (checkGroupUrl && checkGroupUrl.statusCode === 403) {
        //   throw constants.createError(403, 'Please update your plan!');
        // }
        // // * 2. Inquiry Management
        // var checkInquiryUrl = await constants.checkUrlInPlanConfiguration(requestUser.masterdetailId, constants.INQUIRY_MANAGEMENT_KEY, ctx.req.originalUrl, ctx.req.method);
        // if (checkInquiryUrl && checkInquiryUrl.statusCode === 403) {
        //   throw constants.createError(403, 'Please update your plan!');
        // }
        // // * 3. Orders Management
        // var checkOrderUrl = await constants.checkUrlInPlanConfiguration(requestUser.masterdetailId, constants.ORDER_MANAGEMENT_KEY, ctx.req.originalUrl, ctx.req.method);
        // if (checkOrderUrl && checkOrderUrl.statusCode === 403) {
        //   throw constants.createError(403, 'Please update your plan!');
        // }
        // // * 4. Customer Management
        // var checkUserUrl = await constants.checkUrlInPlanConfiguration(requestUser.masterdetailId, constants.USER_MANAGEMENT_KEY, ctx.req.originalUrl, ctx.req.method);
        // if (checkUserUrl && checkUserUrl.statusCode === 403) {
        //   throw constants.createError(403, 'Please update your plan!');
        // }
        // // * 5. Category Management
        // var checkCategoryUrl = await constants.checkUrlInPlanConfiguration(requestUser.masterdetailId, constants.CATEGORY_MANAGEMENT_KEY, ctx.req.originalUrl, ctx.req.method);
        // if (checkCategoryUrl && checkCategoryUrl.statusCode === 403) {
        //   throw constants.createError(403, 'Please update your plan!');
        // }

        // get tenant name
        var tenantName = await mastdetailModel.findById(requestUser.masterdetailId);

        if (!tenantName.status) {
          var err = new Error('Authorization required !');
          err.statusCode = 401;
          throw err;
        }

        var requestTransactionNumber = `${tenantName.codename}0` + (Math.floor(Math.random() * 90000000000) + 10000000000);

        if (ctx.req.method == 'GET') {
          ctx.req.query = ctx.req.query || {};
          ctx.req.query.where = ctx.req.query.where || {};
          ctx.req.query.where.masterdetailId = requestUser.masterdetailId;
          ctx.options.attacheddata = ctx.req.query;
          ctx.options.attacheddata.masterdetailId = requestUser.masterdetailId;
        }

        if (ctx.req.method == 'POST') {
          ctx.req.body.masterdetailId = requestUser.masterdetailId;
          ctx.options.attacheddata = ctx.req.body;
          ctx.options.attacheddata.masterdetailId = requestUser.masterdetailId;
        }

        if (ctx.req.method == 'PATCH') {
          ctx.req.body.masterdetailId = requestUser.masterdetailId;
          ctx.options.attacheddata = ctx.req.body;
          ctx.options.attacheddata.masterdetailId = requestUser.masterdetailId;
        }

        if (ctx.req.method == 'DELETE') {
          ctx.req.query = ctx.req.query || {};
          ctx.req.query.where = ctx.req.query.where || {};
          ctx.req.query.where.masterdetailId = requestUser.masterdetailId;
          ctx.options.attacheddata = ctx.req.query;
          ctx.options.attacheddata.masterdetailId = requestUser.masterdetailId;
        }

        ctx.req.query = ctx.req.query || {};
        ctx.req.query.where = ctx.req.query.where || {};
        ctx.req.query.where.masterdetailId = requestUser.masterdetailId;

        ctx.options.requestTransactionNumber = requestTransactionNumber;
        var obj = {
          ip: ctx.req.connection.remoteAddress,
          method: ctx.req.method,
          url: ctx.req.originalUrl,
          request: ctx.req.body,
          accessToken: ctx.req.headers.authorization,
          requestTransactionNumber: requestTransactionNumber,
          useragent: ctx.req.headers['user-agent']
        };

        auditlogModel.generateAuditLog(obj);
        // console.log(ctx.req.query);
        // console.log('Audit Obj : ', obj);

      } else {

        if (requestUser) {
          // get tenant name
          var tenantName = await mastdetailModel.findById(requestUser.masterdetailId);

          if (!tenantName.status) {
            var err = new Error('Authorization required !');
            err.statusCode = 401;
            throw err;
          }

          var requestTransactionNumber = `${tenantName.codename}0` + (Math.floor(Math.random() * 90000000000) + 10000000000);

          if (ctx.req.method == 'GET') {
            ctx.req.query = ctx.req.query || {};
            ctx.req.query.where = ctx.req.query.where || {};
            ctx.req.query.where.masterdetailId = requestUser.masterdetailId;
            ctx.options.attacheddata = ctx.req.query;
            ctx.options.attacheddata.masterdetailId = requestUser.masterdetailId;
          }

          if (ctx.req.method == 'POST') {
            ctx.req.body.masterdetailId = requestUser.masterdetailId;
            ctx.options.attacheddata = ctx.req.body;
            ctx.options.attacheddata.masterdetailId = requestUser.masterdetailId;
          }

          if (ctx.req.method == 'PATCH') {
            ctx.req.body.masterdetailId = requestUser.masterdetailId;
            ctx.options.attacheddata = ctx.req.body;
            ctx.options.attacheddata.masterdetailId = requestUser.masterdetailId;
          }

          if (ctx.req.method == 'DELETE') {
            ctx.req.query = ctx.req.query || {};
            ctx.req.query.where = ctx.req.query.where || {};
            ctx.req.query.where.masterdetailId = requestUser.masterdetailId;
            ctx.options.attacheddata = ctx.req.query;
            ctx.options.attacheddata.masterdetailId = requestUser.masterdetailId;
          }

          ctx.req.query = ctx.req.query || {};
          ctx.req.query.where = ctx.req.query.where || {};
          ctx.req.query.where.masterdetailId = requestUser.masterdetailId;

          ctx.options.requestTransactionNumber = requestTransactionNumber;
          var obj = {
            ip: ctx.req.connection.remoteAddress,
            method: ctx.req.method,
            url: ctx.req.originalUrl,
            request: ctx.req.body,
            accessToken: ctx.req.headers.authorization,
            requestTransactionNumber: requestTransactionNumber,
            useragent: ctx.req.headers['user-agent']
          };

          auditlogModel.generateAuditLog(obj);
          //   console.log(ctx.req.query);
          //   console.log('Audit Obj : ', obj);
        } else {
          ctx.req.query = ctx.req.query || {};
          ctx.req.query.where = ctx.req.query.where || {};
          if (ctx.req.query.filter && ctx.req.query.filter.where && ctx.req.query.filter.where.masterdetailId) {
            ctx.req.query.where.masterdetailId = ctx.req.query.filter.where.masterdetailId
          }
        }
      }

      next();

    } catch (error) {
      next(error)
      // throw error;
    }

  });

};
