'use strict';
const app = require("../../server/server");

module.exports = function (Orderstatus) {

    Orderstatus.beforeRemote("find", async (ctx, modelInstance, next) => {

        try {

            ctx.req.query = ctx.req.query || {};
            ctx.req.query.filter = ctx.req.query.filter || {};
            if (typeof ctx.req.query.filter === 'string') {

                ctx.req.query.filter = JSON.parse(ctx.req.query.filter);
                ctx.req.query.filter.where = ctx.req.query.filter.where || {};
                ctx.req.query.filter.where.masterdetailId = ctx.req.query.where.masterdetailId;
                ctx.req.query.filter = JSON.stringify(ctx.req.query.filter);
            } else {
                ctx.req.query.filter.where = ctx.req.query.filter.where || {};
                ctx.req.query.filter.where.masterdetailId = ctx.req.query.where.masterdetailId;
            }
            // console.log(ctx.req.query);

        } catch (error) {
            throw error;
        }

    });

    Orderstatus.afterRemote("find", async (ctx, modelInstance, next) => {
        var responseOrderstatus;
        try {
            responseOrderstatus = await Orderstatus.find({
                where: {
                    masterdetailId: ctx.req.query.masterdetailId
                }
            });
            ctx.res.status(200).send(responseOrderstatus);
        } catch (error) {
            throw error;
        }

    });

};
