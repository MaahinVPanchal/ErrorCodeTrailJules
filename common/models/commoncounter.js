'use strict';
var app = require('../../server/server');

module.exports = function (Commoncounter) {

  Commoncounter.updateCounters = async function (
    userId,
    operation, // add or deduct + or -
    value,
    counterName,
    tenant
  ) {
    // var tenant_new = tenant.substring(1);
    // tenant_new = tenant_new.split('/')[0];
    var string = "UPDATE commoncounter SET " + counterName + " = " + counterName + " " + operation + " " + value + " WHERE userId = '" + userId + "'";
    return app.datasources.mysql.connector.execute(string, null, (err, result) => {
      if (err) console.log(err);
    });
  }

  Commoncounter.beforeRemote('find', async (ctx, modelInstnace, next) => {
    var commoncounterModel = app.models.commoncounter;
    try {


      if (ctx.args.filter != undefined && ctx.args.filter.where.userId != undefined && ctx.args.filter.where.userId == ctx.req.accessToken.userId) {

        var commoncounter = await commoncounterModel.findOne({
          where: {
            userId: ctx.req.query.filter.where.userId
          }
        });

        if (commoncounter.cart < 0) {
          await commoncounterModel.updateAll({
            id: commoncounter.id
          }, {
            cart: 0
          })
        };
      } else {
        var err = new Error('Authorization Required');
        err.statusCode = 401;
        throw err;
      }

    } catch (error) {
      throw error;
    }
  });


};
