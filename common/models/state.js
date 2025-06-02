"use strict";
const app = require("../../server/server");
const CONSTANTS = require("../const");
const TITLE_CASE = require("title-case");

module.exports = function (State) {

  State.beforeRemote("create", async (ctx, modelInstance, next) => {

    try {

      if (ctx.args.data.parentId) {
        ctx.args.data.name = ctx.args.data.name.trim();
        if (ctx.args.data.name.length === 0) {
          throw CONSTANTS.createError(400, 'Please enter valid state name');
        }

        // Check State name already exist or not?
        var checkStateNameExist = await State.findOne({
          where: {
            name: ctx.args.data.name,
            masterdetailId: ctx.args.data.masterdetailId,
            parentId: ctx.args.data.parentId
          }
        });

        // Check Name Validation
        if (checkStateNameExist) {
          throw CONSTANTS.createError(409, 'State already exist, Please try with another');
        }
      }
      if (!ctx.args.data.parentId) {
        ctx.args.data.name = ctx.args.data.name.trim();
        if (ctx.args.data.name.length === 0) {
          throw CONSTANTS.createError(400, 'Please enter valid country name');
        }

        // Check State name already exist or not?
        var checkCountryNameExist = await State.findOne({
          where: {
            name: ctx.args.data.name,
            masterdetailId: ctx.args.data.masterdetailId
          }
        });

        // Check Name Validation
        if (checkCountryNameExist) {
          throw CONSTANTS.createError(409, 'Country already exist, Please try with another');
        }
      }

      //Captalizing name
      ctx.args.data.name = TITLE_CASE.titleCase(ctx.args.data.name);

    } catch (err) {
      throw err;
    }
  });

  State.beforeRemote('find', async (ctx, modelInstance) => {

    if (ctx.req.query.isWeb) {
      if (ctx.req.query.filter.where && ctx.req.query.filter.where.name) {
        ctx.req.query.filter.where.name = ctx.req.query.filter.where.name;
      } else {
        ctx.req.query.filter['where'] = {};
      }
      ctx.req.query.filter.where['parentId'] = {
        neq: null
      };
      ctx.req.query = ctx.req.query || {};
      ctx.req.query.filter = ctx.req.query.filter || {};
      ctx.req.query.filter.where = ctx.req.query.filter.where || {};
      ctx.req.query.filter.where.masterdetailId = ctx.req.query.where.masterdetailId;
    }

    if (ctx && ctx.req && ctx.req.query && ctx.req.query.filter && ctx.req.query.filter.where) {
      if (ctx.req.query.filter.where.name && ctx.req.query.filter.where.name.like) {
        ctx.req.query.filter.where.name.like = ctx.req.query.filter.where.name.like.split('%20').join(' ');
      }
    }

  });

  State.afterRemote('find', async (ctx, modelInstance) => {
    var resData = {};
    var whereObject;

    try {
      if (ctx.req.query.isWeb) {

        if (ctx && ctx.req && ctx.req.query && ctx.req.query.filter && ctx.req.query.filter.where && ctx.req.query.filter.where.and
          && ctx.req.query.filter.where.and[0] && ctx.req.query.filter.where.and[0].name && ctx.req.query.filter.where.and[0].name.like) {
          whereObject = {
            where: {
              masterdetailId: ctx.req.query.where.masterdetailId,
              parentId: { neq: null },
              name: {
                like: ctx.req.query.filter.where.and[0].name.like
              }
            },
            order: 'name ASC',
            skip: ctx.req.query.filter.skip,
            limit: ctx.req.query.filter.limit
          }
        } else {
          whereObject = {
            where: {
              masterdetailId: ctx.req.query.where.masterdetailId,
              parentId: { neq: null }
            },
            order: 'name ASC',
            skip: ctx.req.query.filter.skip,
            limit: ctx.req.query.filter.limit
          }
        }
        var stateData = await State.find(whereObject);
        var stateLength = await State.find({
          where: {
            masterdetailId: ctx.req.query.where.masterdetailId,
            parentId: { neq: null }
          }
        });
        resData.data = stateData;
        resData.length = stateLength.length;
      } else if (ctx.req.query.getCountries === 'getCountries') {
        // get Countries
        let country = await State.find({
          where: {
            parentId: null,
            masterdetailId: ctx.req.query.where.masterdetailId
          },
          order: 'name ASC'
        });
        resData.data = country;
        resData.length = country.length;
      } else if (ctx.req.query.getStates === 'getStates') {
        // get getStates
        let country = await State.find({
          where: {
            parentId:
            {
              neq: null
            },
            masterdetailId: ctx.req.query.where.masterdetailId
          },
          order: 'name ASC'
        });
        resData.data = country;
        resData.length = country.length;
      } else if (ctx.req.query.filter) {
        // get States
        if (ctx.req.query.filter.where) {
          if (ctx.req.query.filter.where.and) {
            if (ctx.req.query.filter.where.and[0].parentId) {
              let state = await State.find({
                where: {
                  parentId: ctx.req.query.filter.where.and[0].parentId,
                  masterdetailId: ctx.req.query.where.masterdetailId
                },
                order: 'name ASC'
              });
              resData.data = state;
              resData.length = state.length;
            }
          }
        }
      } else {
        var state = await State.find({
          where: {
            masterdetailId: ctx.req.query.where.masterdetailId
          },
          order: 'name ASC'
        });
        resData.data = modelInstance;
        resData.length = state.length;
      }
      ctx.res.status(200).send(resData);
    } catch (error) {
      throw error;
    }
  });

  State.afterRemote("deleteById", async (ctx, modelInstance) => {
    let { city } = app.models;
    try {

      // delete cities
      await city.updateAll({
        stateId: ctx.args.id
      }, {
        deletedAt: new Date()
      });

    } catch (error) {
      throw error;
    }
  });

};
