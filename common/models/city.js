"use strict";

const app = require("../../server/server");
const titlecase = require("title-case");
const constants = require("../const");
const moment = require("moment");

module.exports = function (City) {
  City.beforeRemote("create", async (ctx, modelInstance, next) => {
    try {
      ctx.args.data.name = ctx.args.data.name.trim();
      if (ctx.args.data.name.length === 0) {
        throw constants.createError(400, "Please enter valid city name");
      }

      // Check State name already exist or not?
      var checkStateNameExist = await City.findOne({
        where: {
          name: ctx.args.data.name,
          masterdetailId: ctx.args.data.masterdetailId,
          parentId: ctx.args.data.parentId,
        },
      });

      // Check Name Validation
      if (checkStateNameExist) {
        throw constants.createError(
          409,
          "City already exist, Please try with another"
        );
      }

      //Captalizing name
      ctx.args.data.name = titlecase.titleCase(ctx.args.data.name);
    } catch (err) {
      throw err;
    }
  });

  City.beforeRemote("find", async (ctx, modelInstance, next) => {
    try {
      ctx.req.query = ctx.req.query || {};
      ctx.req.query.filter = ctx.req.query.filter || {};
      ctx.req.query.filter.where = ctx.req.query.filter.where || {};
      ctx.req.query.filter.where.masterdetailId =
        ctx.req.query.where.masterdetailId;

      if (
        ctx &&
        ctx.req &&
        ctx.req.query &&
        ctx.req.query.filter &&
        ctx.req.query.filter.where
      ) {
        if (
          ctx.req.query.filter.where.name &&
          ctx.req.query.filter.where.name.like
        ) {
          ctx.req.query.filter.where.name.like =
            ctx.req.query.filter.where.name.like.split("%20").join(" ");
        }
      }
    } catch (error) {
      throw error;
    }
  });

  City.afterRemote("find", async (ctx, modelInstance) => {
    var resData = {};
    var stateModel = app.models.state;
    try {
      if (ctx.req.query.isWeb) {
        var city = await City.find({
          where: {
            masterdetailId: ctx.req.query.where.masterdetailId,
          },
          include: ["state"],
          order: "name ASC",
        });
        resData.data = modelInstance;
        resData.length = city.length;
        ctx.res.status(200).send(resData);
        return;
      } else if (ctx.req.query.filter) {
        // get States
        if (ctx.req.query.filter.where) {
          if (ctx.req.query.filter.where.and) {
            if (ctx.req.query.filter.where.and[0].stateId) {
              var state = await City.find({
                where: {
                  stateId: ctx.req.query.filter.where.and[0].stateId,
                  masterdetailId: ctx.req.query.where.masterdetailId,
                },
                order: "name ASC",
              });
              resData.data = state;
              resData.length = state.length;
              ctx.res.status(200).send(resData);
              return;
            }
          } else {
            resData = {};
            var city = await City.find({
              where: {
                masterdetailId: ctx.req.query.where.masterdetailId,
              },
              include: ["state"],
              order: "name ASC",
            });
            resData = city;
            if (city && city.length > 0) {
              for (let i = 0; i < city.length; i++) {
                const element = city[i];
                var getCountryData = await stateModel.findOne({
                  where: {
                    id: element.__data.state.parentId,
                  },
                });
                if (getCountryData) {
                  element.__data.state.country = getCountryData;
                }
              }
            }
            ctx.res.status(200).send(resData);
            return;
          }
        }
      } else {
        resData = {};
        var city = await City.find({
          where: {
            masterdetailId: ctx.req.query.where.masterdetailId,
          },
          include: ["state"],
          order: "name ASC",
        });
        resData = city;
        ctx.res.status(200).send(resData);
        return;
      }
    } catch (error) {
      throw error;
    }
  });
};
