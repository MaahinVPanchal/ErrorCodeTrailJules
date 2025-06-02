'use strict';

var moment = require("moment");
const constants = require("../const");
const titlecase = require("title-case");
var app = require("../../server/server");

module.exports = function (Finance) {

  Finance.beforeRemote("create", async (ctx, modelInstance, next) => {

    try {

      // Check Collection name already exist or not?
      var checkSameNameExist = await Finance.findOne({
        where: {
          name: ctx.args.data.name,
          masterdetailId: ctx.args.data.masterdetailId
        }
      });

      // Check Name Validation
      if (checkSameNameExist) {
        throw constants.createError(409, 'Name already exist, Please try with another');
      }

      if (ctx.args.data.startdate)
        ctx.args.data.startdate = JSON.stringify(ctx.args.data.startdate);
      if (ctx.args.data.enddate)
        ctx.args.data.enddate = JSON.stringify(ctx.args.data.enddate);
      if (ctx.args.data.bysalesmen)
        ctx.args.data.bysalesmen = JSON.stringify(ctx.args.data.bysalesmen);
      if (ctx.args.data.bycategories)
        ctx.args.data.bycategories = JSON.stringify(ctx.args.data.bycategories);
      if (ctx.args.data.byterritories)
        ctx.args.data.byterritories = JSON.stringify(ctx.args.data.byterritories);

      // Captalizing name
      ctx.args.data.name = titlecase.titleCase(ctx.args.data.name);

    } catch (err) {
      throw err;
    }

  });

  Finance.beforeRemote("prototype.patchAttributes", async (ctx, modelInstance, next) => {

    try {

      if (ctx.args.data.startdate)
        ctx.args.data.startdate = JSON.stringify(ctx.args.data.startdate);
      if (ctx.args.data.enddate)
        ctx.args.data.enddate = JSON.stringify(ctx.args.data.enddate);
      if (ctx.args.data.bysalesmen)
        ctx.args.data.bysalesmen = JSON.stringify(ctx.args.data.bysalesmen);
      if (ctx.args.data.bycategories)
        ctx.args.data.bycategories = JSON.stringify(ctx.args.data.bycategories);
      if (ctx.args.data.byterritories)
        ctx.args.data.byterritories = JSON.stringify(ctx.args.data.byterritories);

      // Captalizing name
      ctx.args.data.name = titlecase.titleCase(ctx.args.data.name);

    } catch (err) {
      throw err;
    }

  });

  Finance.getSalesByCategories = async (req, res) => {

    var productModel = app.models.product;
    var categoryModel = app.models.category;
    var orderdetailsModel = app.models.orderdetails;
    var productList = [];
    var categoryProduct = [];

    try {

      const { masterdetailId } = req.body;

      const startDate = await getDateUsingMoment(req.body.startdate.year, req.body.startdate.month, req.body.startdate.day);
      const endDate = await getDateUsingMoment(req.body.enddate.year, req.body.enddate.month, req.body.enddate.day);

      var getCategories = await categoryModel.find({
        where: {
          categorystatus: 1,
          masterdetailId,
          parentId: null
        }
      });

      if (getCategories && getCategories.length > 0) {
        for (let i = 0; i < getCategories.length; i++) {
          const element = getCategories[i];
          productList = [];
          var getSubcategoryOfElement = await categoryModel.find({
            where: {
              parentId: element.id,
              masterdetailId
            }
          });

          for (let j = 0; j < getSubcategoryOfElement.length; j++) {
            const elementOfSubcategory = getSubcategoryOfElement[j];
            var getProductsOfSubcategory = await productModel.find({
              where: {
                categoryId: elementOfSubcategory.id,
                masterdetailId,
                productstatus: 1
              }
            });

            if (getProductsOfSubcategory && getProductsOfSubcategory.length > 0) {
              for (let k = 0; k < getProductsOfSubcategory.length; k++) {
                const elementOfProduct = getProductsOfSubcategory[k];
                productList.push(elementOfProduct.id);
              }
            }

          }

          categoryProduct.push({
            name: element.name,
            categoryId: element.id,
            productList,
            actualSales: 0,
            targetSales: 0
          });

        }
      }

      var getOrders = await getOrderBetweenDates(startDate, endDate, masterdetailId);
      if (getOrders && getOrders.length > 0) {
        for (let i = 0; i < getOrders.length; i++) {
          const element = getOrders[i];

          var getOrderDetailsOfOrder = await orderdetailsModel.find({
            where: {
              orderId: element.id
            }
          });

          for (let j = 0; j < getOrderDetailsOfOrder.length; j++) {
            const elementOfOrderDetails = getOrderDetailsOfOrder[j];
            for (let k = 0; k < categoryProduct.length; k++) {
              const elementOfCategoryProduct = categoryProduct[k];
              if (elementOfCategoryProduct.productList.includes(elementOfOrderDetails.productId)) {
                elementOfCategoryProduct.actualSales += elementOfOrderDetails.amount;
              }
            }
          }

        }
      }

      return categoryProduct;

    } catch (error) {
      throw error;
    }

  }

  Finance.getSalesBySalesmen = async (req, res) => {

    var responseJson = [];
    var userModel = app.models.user;
    var orderModel = app.models.order;

    try {

      const { masterdetailId } = req.body;
      const getPendingOrderStatus = await constants.ORDER_PENDING(masterdetailId);
      const getConfirmOrderStatus = await constants.ORDER_COMFIRMED(masterdetailId);
      const getDeliveredOrderStatus = await constants.ORDER_DELIVERED(masterdetailId);
      const getInProgressOrderStatus = await constants.ORDER_INPROGRESS(masterdetailId);
      const startDate = await getDateUsingMoment(req.body.startdate.year, req.body.startdate.month, req.body.startdate.day);
      const endDate = await getDateUsingMoment(req.body.enddate.year, req.body.enddate.month, req.body.enddate.day);

      var getSalesmenList = await userModel.find({
        where: {
          userstatus: "Active",
          roleId: 3,
          masterdetailId
        },
        include: ['salesmancity']
      });
      var actualSales = 0;
      for (let i = 0; i < getSalesmenList.length; i++) {
        const element = getSalesmenList[i];
        actualSales = 0;
        var getOrdersOfSalesman = await orderModel.find({
          where: {
            date: {
              between: [startDate, endDate]
            },
            inshoppingcart: 0,
            orderstatus: {
              inq: [getPendingOrderStatus, getInProgressOrderStatus, getConfirmOrderStatus, getDeliveredOrderStatus]
            },
            masterdetailId,
            createdby: element.id
          }
        });
        if (getOrdersOfSalesman && getOrdersOfSalesman.length > 0) {
          for (let j = 0; j < getOrdersOfSalesman.length; j++) {
            const elementOfSalesmanOrder = getOrdersOfSalesman[j];
            actualSales += elementOfSalesmanOrder.totalamount;
          }
        }
        responseJson.push({
          userId: element.id,
          name: element.username,
          actualSales,
          targetSales: 0
        });
      }

      return responseJson;

    } catch (error) {
      throw error;
    }

  }

  Finance.getSalesByTerritories = async (req, res) => {

    var responseJson = [];
    var cityModel = app.models.city;

    try {

      const { masterdetailId } = req.body;
      const getPendingOrderStatus = await constants.ORDER_PENDING(masterdetailId);
      const getConfirmOrderStatus = await constants.ORDER_COMFIRMED(masterdetailId);
      const getDeliveredOrderStatus = await constants.ORDER_DELIVERED(masterdetailId);
      const getInProgressOrderStatus = await constants.ORDER_INPROGRESS(masterdetailId);
      const ORDERSTATUS_STRING = "(" + getPendingOrderStatus + "," + getConfirmOrderStatus + "," + getDeliveredOrderStatus + "," + getInProgressOrderStatus + ")";
      const startDate = await getDateUsingMoment(req.body.startdate.year, req.body.startdate.month, req.body.startdate.day);
      const endDate = await getDateUsingMoment(req.body.enddate.year, req.body.enddate.month, req.body.enddate.day);

      var getCitiesList = await cityModel.find({
        where: {
          masterdetailId,
          stateId: {
            neq: null
          }
        }
      });

      if (getCitiesList && getCitiesList.length) {
        for (let j = 0; j < getCitiesList.length; j++) {
          const elementOfCity = getCitiesList[j];

          var query = "SELECT SUM(`totalamount`) AS totalamount FROM `order` WHERE deletedAt IS NULL AND `masterdetailId` = '" + masterdetailId
            + "' AND `cityId` = '" + elementOfCity.id + "' AND `inshoppingcart` = 0 AND `date` BETWEEN '" + startDate + "' AND '" + endDate
            + "' AND `orderstatus` IN" + ORDERSTATUS_STRING;

          var getAmount = await new Promise((resolve, reject) => {
            app.datasources.mysql.connector.execute(query, null, (err, result) => {
              if (err) {
                console.log('execute query error ==> ', err);
                reject(err);
              } else {
                resolve(result);
              }
            });
          });

          getAmount = JSON.stringify(getAmount); // Convert the object to a string, remove RowDataPacket
          getAmount = JSON.parse(getAmount); // Convert the results string to a json object
          getAmount = getAmount[0];

          if (getAmount.totalamount === null) {
            getAmount.totalamount = 0;
          }

          responseJson.push({
            cityId: elementOfCity.id,
            name: elementOfCity.name,
            actualSales: getAmount.totalamount,
            targetSales: 0
          });

        }
      }

      return responseJson;

    } catch (error) {
      throw error;
    }

  }

};

async function getOrderBetweenDates(sd, ed, mid) {
  return await app.models.order.find({
    where: {
      date: {
        between: [sd, ed]
      },
      inshoppingcart: 0,
      masterdetailId: mid
    }
  });
}

async function getDateUsingMoment(y, m, d) {
  return moment(y + '-' + m + '-' + d).format("YYYY-MM-DD");
}
