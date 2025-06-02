"use strict";
var app = require("../../server/server");

module.exports = function (Groupcategory) {

  Groupcategory.afterRemote("find", async (ctx, modelInstance, next) => {
    var categoryModel = app.models.category;
    var tempArraay = [];
    var getCatArray = [];
    var catArray = [];
    // var categoryRes
    // var resData = {}
    var resData = [];

    try {
      for (let key in modelInstance) {
        if (modelInstance.hasOwnProperty(key)) {
          let element = modelInstance[key];
          tempArraay.push(element.categoryId);
        }
      }

      for (let i = 0; i < tempArraay.length; i++) {
        const element = tempArraay[i];
        var cat = await categoryModel.findOne({
          where: {
            id: element,
            masterdetailId: ctx.req.query.where.masterdetailId
          },
        });
        getCatArray.push(cat);
      }

      for (let index = 0; index < getCatArray.length; index++) {
        const element = getCatArray[index];
        var getcat = await categoryModel.findOne({
          where: {
            id: element.parentId,
            masterdetailId: ctx.req.query.where.masterdetailId
          },
        });
        catArray.push(getcat);
      }

      var unique = catArray.map((item) => {
        return item.id;
      });

      var catUnique = unique.filter((item, index) => {
        return unique.indexOf(item) >= index;
      });

      for (let i in catUnique) {
        if (catUnique.hasOwnProperty(i)) {
          let element = catUnique[i];
          var categoryRes = await categoryModel.findOne({
            where: {
              id: element,
              masterdetailId: ctx.req.query.where.masterdetailId
            },
          });
          resData.push(categoryRes);
        }
      }
      ctx.res.status(200).send(resData);
    } catch (error) {
      throw error;
    }
  });
};
