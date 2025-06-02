"use strict";

const app = require("../../server/server");
const constants = require("../../common/const");
const moment = require("moment");

module.exports = (Invoice) => {
  Invoice.beforeRemote("create", async (ctx) => {
    var accesstokenModel = app.models.AccessToken;
    var invoicestatusModel = app.models.invoicestatus;
    var userModel = app.models.user;
    var invoice_status_array = [];
    var accessToken;
    var user;
    var getInvoiceStatus;

    try {
      // find user based on accesstoken
      accessToken = await accesstokenModel.findOne({
        where: {
          id: ctx.req.headers.authorization,
          masterdetailId: ctx.req.query.where.masterdetailId,
        },
      });

      user = await userModel.findById(accessToken.userId);

      // set createdby & modifiedby
      if (user) {
        ctx.args.data.createdby = user.id;
        ctx.args.data.modifiedby = user.id;
      }

      //  is invoice_number available
      if (!ctx.args.data.due_date) {
        var err = new Error("Please enter invoice number!");
        err.statusCode = 400;
        throw err;
      }

      //  set start date
      if (!ctx.args.data.start_date) {
        ctx.args.data.start_date = moment.utc(new Date()).format("DD-MM-YYYY");
      }

      //  set due date
      if (!ctx.args.data.due_date) {
        // ctx.args.data.due_date = moment.utc(new Date()).format('DD-MM-YYYY');
        var err = new Error("Please select invoice due date!");
        err.statusCode = 400;
        throw err;
      }

      // get all statuses
      getInvoiceStatus = await invoicestatusModel.find({
        where: {
          masterdetailId: ctx.req.query.where.masterdetailId,
        },
      });

      if (getInvoiceStatus.length > 0) {
        getInvoiceStatus.filter((e) => invoice_status_array.push(e.id));
      }

      // check invoice status is valid
      if (!invoice_status_array.includes(ctx.args.data.invoice_status)) {
        var err = new Error("Please select valid invoice status!");
        err.statusCode = 400;
        throw err;
      }

      // set totalproducts
      if (ctx.args.data.invoicedetails) {
        ctx.args.data.totalproducts = ctx.args.data.invoicedetails.length;
      }

      // stringify data
      if (ctx.args.data.other) {
        ctx.args.data.other = constants.stringifyJson(ctx.args.data.other);
      }

      if (ctx.args.data.additional_charges) {
        ctx.args.data.additional_charges = constants.stringifyJson(
          ctx.args.data.additional_charges
        );
      }

      if (ctx.args.data.tax) {
        ctx.args.data.tax = constants.stringifyJson(ctx.args.data.tax);
      }
    } catch (error) {
      throw error;
    }
  });

  Invoice.afterRemote("create", async (ctx, modelInstance, next) => {
    var grouppriceModel = app.models.groupprice;
    var productModel = app.models.product;
    var invoicedetailsModel = app.models.invoicedetails;
    var userModel = app.models.user;
    var settingModel = app.models.setting;
    var postInvoicedetails;
    var invoicedetails = [];
    var taxdetails = {};
    var getMerchantInfoSetting;
    var userData;
    var productData;

    try {
      // get Status Of GST
      getMerchantInfoSetting = await settingModel.findOne({
        where: {
          registerallow: constants.MERCHANTINFORMATION_LABLE,
          masterdetailId: ctx.req.query.where.masterdetailId,
        },
      });

      // get user data
      userData = await userModel.findOne({
        where: {
          id: modelInstance.userId,
          masterdetailId: ctx.req.query.where.masterdetailId,
        },
        deleted: true,
      });

      for (var i = 0; i < ctx.args.data.invoicedetails.length; i++) {
        const element = ctx.args.data.invoicedetails[i];

        // product Data
        productData = await productModel.findOne({
          where: {
            id: element.productId,
            masterdetailId: ctx.req.query.where.masterdetailId,
          },
          deleted: true,
        });

        if (!productData) {
          // If product not exist then delete invoice
          await Invoice.updateAll(
            {
              id: modelInstance.id,
              masterdetailId: ctx.req.query.where.masterdetailId,
            },
            {
              deletedAt: new Date(),
            }
          );

          var err = new Error("Sorry Item not exists in the system!");
          err.statusCode = 400;
          throw err;
        }

        var invoice_amount = 0;

        if (element.variation) {
          var variationUserGroupData = [];

          if (!element.variation.variationGroupPrice) {
            element.variation.variationGroupPrice = [];
          }

          if (
            element.variation.variationGroupPrice &&
            element.variation.variationGroupPrice.length > 0
          ) {
            variationUserGroupData =
              element.variation.variationGroupPrice.filter(
                (e) => e.group_id === userData.groupId
              );
          }

          if (variationUserGroupData.length === 0) {
            invoice_amount = element.variation.price;
          } else {
            invoice_amount = variationUserGroupData[0].groupprice;
          }

          postInvoicedetails = await invoicedetailsModel.create({
            quantity: element.quantity,
            mrp: element.variation.price,
            invoiceamount: invoice_amount,
            invoiceId: modelInstance.id,
            createdby: modelInstance.createdby,
            productId: element.productId,
            variation: JSON.stringify(element.variation),
            masterdetailId: ctx.req.query.where.masterdetailId,
          });
        } else {
          // Group price
          var grouppriceData = await grouppriceModel.findOne({
            where: {
              groupId: userData.groupId,
              productId: element.productId,
              masterdetailId: ctx.req.query.where.masterdetailId,
            },
          });

          if (grouppriceData) {
            invoice_amount = grouppriceData.newprice;
          } else {
            invoice_amount = productData.price;
          }

          postInvoicedetails = await invoicedetailsModel.create({
            quantity: element.quantity,
            mrp: productData.price,
            invoiceamount: invoice_amount,
            invoiceId: modelInstance.id,
            createdby: modelInstance.createdby,
            productId: element.productId,
            masterdetailId: ctx.req.query.where.masterdetailId,
          });
        }

        invoicedetails.push(postInvoicedetails);
      }

      // calculation amount and update in invoice
      if (invoicedetails.length > 0) {
        var netampuntongrossamount = 0;
        var GSTOnGrossamount;
        var netamountonadditionalcharges = 0;
        var GSTOnAdditionalCharges;
        var grossamount = 0;
        var additional_charges = 0;
        var netamount = 0;

        // Gross Amount
        invoicedetails.filter(
          (e) => (grossamount += e.invoiceamount * e.quantity)
        );
        GSTOnGrossamount = calculateGST(grossamount, getMerchantInfoSetting);

        GSTOnGrossamount.filter((e) => {
          netampuntongrossamount += parseFloat(e.value);
        });

        // get additional_charges total
        var additional_chargesData = constants.parseJson(
          modelInstance.additional_charges
        );
        if (additional_chargesData.length > 0) {
          additional_chargesData.filter((e) => {
            additional_charges += parseFloat(e.charge);
          });

          GSTOnAdditionalCharges = calculateGST(
            additional_charges,
            getMerchantInfoSetting
          );

          GSTOnAdditionalCharges.filter((e) => {
            netamountonadditionalcharges += parseFloat(e.value);
          });
        }

        netamount =
          grossamount +
          additional_charges +
          netampuntongrossamount +
          netamountonadditionalcharges;

        // Discount
        if (ctx.args.data.discount) {
          netamount = netamount - ctx.args.data.discount;
        }

        // push data in tax
        if (GSTOnGrossamount.length > 0) {
          taxdetails["netAmountTax"] = GSTOnGrossamount;
        }

        if (
          additional_chargesData.length > 0 &&
          GSTOnAdditionalCharges.length > 0
        ) {
          taxdetails["additionalChargeTax"] = GSTOnAdditionalCharges;
        }

        taxdetails = constants.stringifyJson(taxdetails);

        // Update Invoice Data
        await Invoice.updateAll(
          {
            id: modelInstance.id,
            masterdetailId: ctx.req.query.where.masterdetailId,
          },
          {
            grossamount: grossamount,
            netamount: netamount,
            tax: taxdetails,
          }
        );

        // attach original grossamount & netamount
        modelInstance.grossamount = grossamount;
        modelInstance.netamount = netamount;
        modelInstance.tax = taxdetails;
      }

      // attach invoicedetails
      invoicedetails.length > 0
        ? (modelInstance.invoice_details = invoicedetails)
        : (modelInstance.invoice_details = []);
    } catch (error) {
      throw error;
    }
  });

  Invoice.afterRemote("findById", async (ctx, modelInstance, next) => {
    var invoicedetailsModel = app.models.invoicedetails;
    var userModel = app.models.user;
    var productModel = app.models.product;
    var invoicedetails;
    var userdetails;

    try {
      // find and attach invoice details data
      invoicedetails = await invoicedetailsModel.find({
        where: {
          invoiceId: modelInstance.id,
          masterdetailId: ctx.req.query.where.masterdetailId,
        },
      });

      for (const key in invoicedetails) {
        if (invoicedetails.hasOwnProperty(key)) {
          const element = invoicedetails[key];

          // find product
          var product = await productModel.findOne({
            where: {
              id: element.productId,
              masterdetailId: ctx.req.query.where.masterdetailId,
            },
            deleted: true,
            include: ["category", "productmedia"],
          });

          element.product_details = product;
        }
      }

      modelInstance.invoice_details = invoicedetails;

      // find and attach user details data
      userdetails = await userModel.findOne({
        where: {
          id: modelInstance.userId,
          masterdetailId: ctx.req.query.where.masterdetailId,
        },
        deleted: true,
      });

      modelInstance.user_details = userdetails;
    } catch (error) {
      throw error;
    }
  });

  Invoice.afterRemote("find", async (ctx, modelInstance, next) => {
    var invoicedetailsModel = app.models.invoicedetails;
    var userModel = app.models.user;
    var productModel = app.models.product;
    var user;
    var lengthQuery;
    var tempQuery = "";
    var dataQuery;
    var invoiceData, invoiceLength;
    var resData = {};
    var invoicestatistics = {
      toatl_invoice: 0,
      invoice_draft: 0,
      invoice_paid: 0,
      invoice_partially_paid: 0,
      invoice_unpaid: 0,
      total_amount: 0,
    };
    var statistics;

    try {
      lengthQuery =
        "SELECT COUNT(id) as count FROM `invoice` WHERE deletedAt IS NULL AND masterdetailId = '" +
        ctx.req.query.where.masterdetailId +
        "'";

      user = await userModel.findOne({
        where: {
          id: ctx.req.accessToken.userId,
          masterdetailId: ctx.req.query.where.masterdetailId,
        },
        deleted: true,
      });

      // when request done by salesman attach createdby
      if (user && user.roleId === 3) {
        tempQuery += " AND createdby = '" + ctx.req.accessToken.userId + "' ";
      }

      if (
        ctx.req.query.filter &&
        ctx.req.query.filter.where &&
        ctx.req.query.filter.where.and &&
        ctx.req.query.filter.where.and[0] &&
        ctx.req.query.filter.where.and[0].invoicestatistics
      ) {
        dataQuery =
          "SELECT COUNT(*) AS TOTAL, COUNT(CASE WHEN `invoice_status` = '" +
          (await constants.INVOICE_PAID(ctx.req.query.where.masterdetailId)) +
          "' THEN 1 END) AS PAID, COUNT(CASE WHEN `invoice_status` = '" +
          (await constants.INVOICE_UNPAID(ctx.req.query.where.masterdetailId)) +
          "' THEN 1 END) AS UNPAID, COUNT(CASE WHEN `invoice_status` = '" +
          (await constants.INVOICE_DRAFT(ctx.req.query.where.masterdetailId)) +
          "' THEN 1 END) AS DRAFT, COUNT(CASE WHEN `invoice_status` = '" +
          (await constants.INVOICE_PARTIALLY_PAID(
            ctx.req.query.where.masterdetailId
          )) +
          "' THEN 1 END) AS PARTIALLY_PAID, SUM(`netamount`) AS TOTAL_AMOUNT, SUM(CASE WHEN `invoice_status` = '" +
          (await constants.INVOICE_UNPAID(ctx.req.query.where.masterdetailId)) +
          "' THEN `netamount` END) AS TOATL_UNPAID_AMOUNT, SUM(CASE WHEN `invoice_status` = '" +
          (await constants.INVOICE_DRAFT(ctx.req.query.where.masterdetailId)) +
          "' THEN `netamount` END) AS TOATL_DRAFT_AMOUNT  FROM `invoice` WHERE deletedAt IS NULL AND masterdetailId = '" +
          ctx.req.query.where.masterdetailId +
          "' ";

        if (user.roleId === 3) {
          dataQuery += " AND createdby = '" + ctx.req.accessToken.userId + "' ";
        }

        statistics = await new Promise((resolve, reject) => {
          app.datasources.mysql.connector.execute(
            dataQuery,
            null,
            (err, result) => {
              if (err) reject(err);
              resolve(result);
            }
          );
        });

        if (statistics[0].TOATL_DRAFT_AMOUNT === null) {
          statistics[0].TOATL_DRAFT_AMOUNT = 0;
        }
        if (statistics[0].TOATL_UNPAID_AMOUNT_AMOUNT === null) {
          statistics[0].TOATL_UNPAID_AMOUNT_AMOUNT = 0;
        }

        // attach invoicestatistics data
        invoicestatistics.invoice_draft = statistics[0].DRAFT;
        invoicestatistics.invoice_paid = statistics[0].PAID;
        invoicestatistics.invoice_unpaid = statistics[0].UNPAID;
        invoicestatistics.invoice_partially_paid = statistics[0].PARTIALLY_PAID;
        invoicestatistics.toatl_invoice = statistics[0].TOTAL;
        invoicestatistics.total_amount =
          statistics[0].TOTAL_AMOUNT -
          (statistics[0].TOATL_UNPAID_AMOUNT +
            statistics[0].TOATL_DRAFT_AMOUNT);

        // send Response
        ctx.res.status(200).send(invoicestatistics);
        return;
      } else if (
        ctx.req.query.filter &&
        ctx.req.query.filter.where &&
        ctx.req.query.filter.where.and
      ) {
        if (ctx.req.query.filter.where.and[0].invoice_status) {
          // invoice_status
          tempQuery +=
            " AND invoice_status = '" +
            ctx.req.query.filter.where.and[0].invoice_status +
            "' ";
        }

        dataQuery =
          "SELECT * FROM `invoice` WHERE deletedAt IS NULL AND masterdetailId = '" +
          ctx.req.query.where.masterdetailId +
          "' " +
          tempQuery +
          " LIMIT " +
          ctx.req.query.filter.skip +
          "," +
          ctx.req.query.filter.limit;
      } else {
        user.roleId === 1
          ? (dataQuery =
              "SELECT * FROM `invoice` WHERE deletedAt IS NULL AND masterdetailId = '" +
              ctx.req.query.where.masterdetailId +
              "' LIMIT " +
              ctx.req.query.filter.skip +
              ", " +
              ctx.req.query.filter.limit)
          : (dataQuery =
              "SELECT * FROM `invoice` WHERE deletedAt IS NULL AND masterdetailId = '" +
              ctx.req.query.where.masterdetailId +
              "' " +
              tempQuery +
              "  LIMIT " +
              ctx.req.query.filter.skip +
              "," +
              ctx.req.query.filter.limit);
      }

      invoiceData = await new Promise((resolve, reject) => {
        app.datasources.mysql.connector.execute(
          dataQuery,
          null,
          (err, result) => {
            if (err) reject(err);
            resolve(result);
          }
        );
      });

      // invoiceLength
      invoiceLength = await new Promise((resolve, reject) => {
        app.datasources.mysql.connector.execute(
          lengthQuery,
          null,
          (err, result) => {
            if (err) reject(err);
            resolve(result);
          }
        );
      });

      for (var i = 0; i < invoiceData.length; i++) {
        const singleInvoice = invoiceData[i];

        // find and attach invoice details data
        var invoicedetails = await invoicedetailsModel.find({
          where: {
            invoiceId: singleInvoice.id,
            masterdetailId: ctx.req.query.where.masterdetailId,
          },
        });

        for (const key in invoicedetails) {
          if (invoicedetails.hasOwnProperty(key)) {
            const element = invoicedetails[key];

            // find product
            var product = await productModel.findOne({
              where: {
                id: element.productId,
                masterdetailId: ctx.req.query.where.masterdetailId,
              },
              deleted: true,
              include: ["category", "productmedia"],
            });

            element.product_details = product;
          }
        }

        singleInvoice.invoice_details = invoicedetails;

        // find and attach user details data
        var userdetails = await userModel.findOne({
          where: {
            id: singleInvoice.userId,
            masterdetailId: ctx.req.query.where.masterdetailId,
          },
          deleted: true,
        });

        singleInvoice.user_details = userdetails;

        // find and attach Salesman details data when requested by admin
        if (user.roleId === 1) {
          var salesmandetails = await userModel.findOne({
            where: {
              id: singleInvoice.createdby,
              masterdetailId: ctx.req.query.where.masterdetailId,
            },
            deleted: true,
          });

          singleInvoice.salesman_details = salesmandetails;
        }
      }

      if (ctx.req.query.isWeb) {
        resData.data = invoiceData;
        resData.length = invoiceLength[0].count;
      } else {
        resData = invoiceData;
      }

      if (resData) ctx.res.status(200).send(resData);
      return;
    } catch (error) {
      throw error;
    }
  });

  Invoice.afterRemote("deleteById", async (ctx) => {
    var invoicedetailsModel = app.models.invoicedetails;
    var getInvoiceData;

    try {
      getInvoiceData = await invoicedetailsModel.find({
        where: {
          invoiceId: ctx.args.id,
          createdby: ctx.req.accessToken.userId,
          masterdetailId: ctx.req.query.where.masterdetailId,
        },
      });

      if (getInvoiceData.length > 0) {
        await invoicedetailsModel.updateAll(
          {
            invoiceId: ctx.args.id,
            createdby: ctx.req.accessToken.userId,
            masterdetailId: ctx.req.query.where.masterdetailId,
          },
          {
            deletedAt: new Date(),
          }
        );
      }
    } catch (error) {
      throw error;
    }
  });

  // check quantity is sufficient or not || as per requirement quantity available or not
  // check with discount already exist case
  // check with IGST

  Invoice.beforeRemote("prototype.patchAttributes", async (ctx) => {
    var invoicedetailsModel = app.models.invoicedetails;
    var productModel = app.models.product;
    var grouppriceModel = app.models.groupprice;
    var settingModel = app.models.setting;
    var userModel = app.models.user;
    var isExist;
    var productData;
    var invoiceData;
    var userData;
    var invoicedetails;
    var taxdetails = {};
    var getMerchantInfoSetting;

    try {
      invoiceData = await Invoice.findById(ctx.req.params.id);

      if (!invoiceData) {
        var err = new Error("Sorry, Invoice does not exist!");
        err.statusCode = 400;
        throw err;
      }

      // Get Merchant Information Data for Calculation Of GST
      getMerchantInfoSetting = await settingModel.findOne({
        where: {
          registerallow: constants.MERCHANTINFORMATION_LABLE,
          masterdetailId: ctx.req.query.where.masterdetailId,
        },
      });

      // get user data
      let tempdata;

      if (ctx.args.data.userId) {
        tempdata = ctx.args.data.userId;
      } else {
        tempdata = invoiceData.userId;
      }

      userData = await userModel.findOne({
        where: {
          id: tempdata,
          masterdetailId: ctx.req.query.where.masterdetailId,
        },
        deleted: true,
      });

      if (ctx.args.data.additional_charges) {
        invoiceData.additional_charges = constants.stringifyJson(
          ctx.args.data.additional_charges
        );
      }

      if (
        ctx.args.data.invoicedetails &&
        ctx.args.data.invoicedetails.length > 0
      ) {
        // If quantity 0 : delete the item
        for (var i = 0; i < ctx.args.data.invoicedetails.length; i++) {
          const element = ctx.args.data.invoicedetails[i];
          // check invoice item Exist or not

          if (element.id) {
            isExist = await invoicedetailsModel.findOne({
              where: {
                id: element.id,
                masterdetailId: ctx.req.query.where.masterdetailId,
              },
            });

            if (!isExist) {
              var err = new Error("Sorry, Invoice item does not exist!");
              err.statusCode = 400;
              throw err;
            }
          }

          // if new item added in invoice then check is item exist or not
          if (element.productId) {
            productData = await productModel.findOne({
              where: {
                id: element.productId,
                masterdetailId: ctx.req.query.where.masterdetailId,
              },
              deleted: true,
            });

            if (!productData) {
              var err = new Error("Sorry, Product does not exist!");
              err.statusCode = 400;
              throw err;
            }
          }

          // id && quantity
          if (element.id && element.quantity) {
            if (element.quantity === 0) {
              await invoicedetailsModel.updateAll(
                {
                  id: element.id,
                  invoiceId: ctx.req.params.id,
                  masterdetailId: ctx.req.query.where.masterdetailId,
                },
                {
                  deletedAt: new Date(),
                }
              );
            } else {
              await invoicedetailsModel.updateAll(
                {
                  id: element.id,
                  invoiceId: ctx.req.params.id,
                  masterdetailId: ctx.req.query.where.masterdetailId,
                },
                {
                  quantity: element.quantity,
                }
              );
            }
          }

          // productId && quantity
          if (element.productId && element.quantity) {
            var invoice_amount = 0;

            if (element.variation) {
              var variationUserGroupData = [];

              if (!element.variation.variationGroupPrice) {
                element.variation.variationGroupPrice = [];
              }

              if (
                element.variation.variationGroupPrice &&
                element.variation.variationGroupPrice.length > 0
              ) {
                variationUserGroupData =
                  element.variation.variationGroupPrice.filter(
                    (e) => e.group_id === userData.groupId
                  );
              }

              if (variationUserGroupData) {
                invoice_amount = element.variation.price;
              } else {
                invoice_amount = variationUserGroupData[0].groupprice;
              }

              await invoicedetailsModel.create({
                quantity: element.quantity,
                mrp: element.variation.price,
                invoiceamount: invoice_amount,
                invoiceId: ctx.req.params.id,
                createdby: ctx.req.accessToken.userId,
                productId: element.productId,
                variation: JSON.stringify(element.variation),
                masterdetailId: ctx.req.query.where.masterdetailId,
              });
            } else {
              // Group price
              var grouppriceData = await grouppriceModel.findOne({
                where: {
                  groupId: userData.groupId,
                  productId: element.productId,
                  masterdetailId: ctx.req.query.where.masterdetailId,
                },
              });

              if (grouppriceData) {
                invoice_amount = grouppriceData.newprice;
              } else {
                invoice_amount = productData.price;
              }

              await invoicedetailsModel.create({
                quantity: element.quantity,
                mrp: productData.price,
                invoiceamount: invoice_amount,
                invoiceId: ctx.req.params.id,
                createdby: ctx.req.accessToken.userId,
                productId: element.productId,
                masterdetailId: ctx.req.query.where.masterdetailId,
              });
            }
          }

          // id && deleted
          if (element.id && element.deleted) {
            await invoicedetailsModel.updateAll(
              {
                id: element.id,
                invoiceId: ctx.req.params.id,
                masterdetailId: ctx.req.query.where.masterdetailId,
              },
              {
                deletedAt: new Date(),
              }
            );
          }
        }
      }

      invoicedetails = await invoicedetailsModel.find({
        invoiceId: ctx.req.params.id,
        masterdetailId: ctx.req.query.where.masterdetailId,
      });

      // calculation amount and update in invoice
      var netampuntongrossamount = 0;
      var GSTOnGrossamount;
      var netamountonadditionalcharges = 0;
      var GSTOnAdditionalCharges;
      var grossamount = 0;
      var additional_charges = 0;
      var netamount = 0;

      // Gross Amount
      invoicedetails.length > 0
        ? invoicedetails.filter(
            (e) => (grossamount += e.invoiceamount * e.quantity)
          )
        : (grossamount = 0);

      GSTOnGrossamount = calculateGST(grossamount, getMerchantInfoSetting);

      GSTOnGrossamount.filter((e) => {
        netampuntongrossamount += parseFloat(e.value);
      });

      // get additional_charges total
      var additional_chargesData;

      ctx.args.data.additional_charges
        ? (additional_chargesData = ctx.args.data.additional_charges)
        : (additional_chargesData = constants.parseJson(
            invoiceData.additional_charges
          ));

      if (additional_chargesData.length > 0) {
        additional_chargesData.filter((e) => {
          additional_charges += parseFloat(e.charge);
        });

        GSTOnAdditionalCharges = calculateGST(
          additional_charges,
          getMerchantInfoSetting
        );

        GSTOnAdditionalCharges.filter((e) => {
          netamountonadditionalcharges += parseFloat(e.value);
        });
      }

      netamount =
        grossamount +
        additional_charges +
        netampuntongrossamount +
        netamountonadditionalcharges;

      // Discount
      if (ctx.args.data.discount) {
        netamount = netamount - ctx.args.data.discount;
      }

      // push data in tax
      if (GSTOnGrossamount.length > 0) {
        taxdetails["netAmountTax"] = GSTOnGrossamount;
      }

      if (
        additional_chargesData.length > 0 &&
        GSTOnAdditionalCharges.length > 0
      ) {
        taxdetails["additionalChargeTax"] = GSTOnAdditionalCharges;
      }

      // stringify tax
      taxdetails = constants.stringifyJson(taxdetails);
      ctx.args.data.grossamount = grossamount;
      ctx.args.data.netamount = netamount;
      ctx.args.data.tax = taxdetails;
      ctx.args.data.totalproducts = invoicedetails.length;
      ctx.args.data.additional_charges = constants.stringifyJson(
        ctx.args.data.additional_charges
      );
    } catch (error) {
      throw error;
    }
  });

  Invoice.afterRemote(
    "prototype.patchAttributes",
    async (ctx, modelInstance, next) => {
      var invoicedetails;
      var invoicedetailsModel = app.models.invoicedetails;

      try {
        invoicedetails = await invoicedetailsModel.find({
          invoiceId: modelInstance.id,
          masterdetailId: ctx.req.query.where.masterdetailId,
        });
        // attach invoicedetails
        invoicedetails.length > 0
          ? (modelInstance.invoice_details = invoicedetails)
          : (modelInstance.invoice_details = []);
      } catch (error) {
        throw error;
      }
    }
  );

  function calculateGST(amount, getMerchantInfoSetting) {
    var taxdetails = [];

    if (getMerchantInfoSetting) {
      getMerchantInfoSetting = constants.parseJson(getMerchantInfoSetting.text);

      if (getMerchantInfoSetting.enablegst) {
        // calculate gst
        var CGST = (amount * getMerchantInfoSetting.CGST) / 100;
        var SGST = (amount * getMerchantInfoSetting.SGST) / 100;

        taxdetails.push({
          key: "CGST",
          value: CGST,
          percentage: getMerchantInfoSetting.CGST,
        });

        taxdetails.push({
          key: "SGST",
          value: SGST,
          percentage: getMerchantInfoSetting.SGST,
        });
      }
    }

    return taxdetails;
  }
};
