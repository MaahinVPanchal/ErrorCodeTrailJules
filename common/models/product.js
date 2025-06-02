"use strict";
const app = require("../../server/server");
const constants = require("../../common/const");
const titlecase = require("title-case");
const shortUrl = require('node-url-shortener');
const e = require("cors");
const buffer = require('buffer/').Buffer
var pdf = require('html-pdf');
var path = require('path');
var loopback = require('loopback');
var JsBarcode = require('jsbarcode');
var TinyURL = require('tinyurl');
const SettingConstants = require("../setting_constants");

// const vision = require('@google-cloud/vision');
// const client = new vision.ImageAnnotatorClient();

module.exports = function (Product) {

  Product.beforeRemote("create", async (ctx, modelInstance, next) => {
    var settingModel = app.models.setting;
    try {

      ctx.args.data.lastModifiedPriceDate = new Date();

      // check Plan Commonfunction
      var result = await constants.getCurrentMarchantPlan(constants.CURRENT_MERCHANT_PLAN_LABEL, 1, ctx.args.data.masterdetailId);

      // Check Restriction Total Product Limit
      var totalProductLimit = await constants.commonCheckPlanCriteriaFeatures(result, ctx.args.data.masterdetailId, constants.NUMBER_OF_PRODUCT_KEY);
      // Check Product Limit
      var lengthQuery = "SELECT COUNT(id) as count FROM `product` WHERE deletedAt IS NULL AND masterdetailId = '" + ctx.args.data.masterdetailId + "'";
      var productLength = await new Promise((resolve, reject) => {
        app.datasources.mysql.connector.execute(lengthQuery, null, (err, result) => {
          if (err) reject(err);
          resolve(result);
        });
      });

      if (productLength[0].count >= totalProductLimit) {
        throw constants.createError(404, 'You have rich your maximum limit of product!');
      }

      // stringify Product variation data
      if (ctx.args.data.productvariation) {
        ctx.args.data.productvariation = JSON.stringify(ctx.args.data.productvariation);
      }

      if (ctx.args.data.variationconfig) {
        ctx.args.data.variationconfig = JSON.stringify(ctx.args.data.variationconfig);
      }

      // stringify productdetails object
      if (ctx.args.data.productdetails) {
        ctx.args.data.productdetails = JSON.stringify(ctx.args.data.productdetails);
      }

      // stringify other object for jewellary || bundlepurchase
      if (ctx.args.data.other) {
        // if (ctx.args.data.other.jewelleryData || ctx.args.data.other.bundlepurchase) {
        ctx.args.data.other = JSON.stringify(ctx.args.data.other);
        // }
      }

      //Captalizing name
      var nameCapitalize = titlecase.titleCase(ctx.args.data.name);
      ctx.args.data.name = nameCapitalize;

      if (!ctx.args.data.productno) {
        ctx.args.data.productno = Math.floor(10000 + Math.random() * 90000);
      }

      var setting = await settingModel.findOne({
        where: {
          registerallow: constants.IS_INQUIRY_LABLE,
          masterdetailId: ctx.req.query.where.masterdetailId
        }
      });
      ctx.args.data.inInquiry = setting.status;

      // Get Price Setting
      var getPriceModeSetting = await getSetting({
        registerallow: constants.IS_PRICE_KEY,
        masterdetailId: ctx.req.query.where.masterdetailId
      });
      if (getPriceModeSetting && getPriceModeSetting.status === 1 && ctx.args.data.price <= 0) {
        throw constants.createError(400, 'Please enter price greater than zero');
      }

      // Get Quantity Setting
      var getStockModeSetting = await getSetting({
        registerallow: constants.IS_STOCK_KEY,
        masterdetailId: ctx.req.query.where.masterdetailId
      });
      if (getStockModeSetting && getStockModeSetting.status === 1 && ctx.args.data.availablequantity <= 0) {
        throw constants.createError(400, 'Please enter quantity greater than zero');
      }

      if (ctx.args.data.productIds) {
        await Product.updateAll({
          id: {
            inq: ctx.args.data.productIds,
            masterdetailId: ctx.req.query.where.masterdetailId
          }
        }, {
          deletedAt: new Date()
        });
        return next(ctx.res.status(200).send({
          count: ctx.args.data.productIds.length
        }));
      }
    } catch (err) {
      throw err;
    }
  });

  Product.afterRemote("create", async (ctx, modelInstance, next) => {
    var productmediaModel = app.models.productmedia;
    var categoryModel = app.models.category;
    var settingModel = app.models.setting;
    var grouppriceModel = app.models.groupprice;

    var COLLECTION_MODEL = app.models.collection;
    var COLLECTION_DETAILS_MODEL = app.models.collectiondetail;

    try {

      if (ctx.args.data.mainGroupPrice) {
        for (var i = 0; i < ctx.args.data.mainGroupPrice.length; i++) {
          const e = ctx.args.data.mainGroupPrice[i];
          await grouppriceModel.create({
            newprice: e.groupprice,
            price: e.groupprice,
            groupId: e.group_id,
            productId: modelInstance.id,
            masterdetailId: ctx.req.query.where.masterdetailId,
            minimumorderquantity: ctx.args.data.minimumorderquantity ? ctx.args.data.minimumorderquantity : 1
          });
        }
      }

      // get all setting
      var setting = await settingModel.find({
        where: {
          masterdetailId: ctx.req.query.where.masterdetailId
        }
      });
      // var is_AI_enabled = setting[12].status;

      // category is there then update the catetgory counter
      if (modelInstance.categoryId) {
        var category = await categoryModel.findOne({
          where: {
            id: modelInstance.categoryId,
            masterdetailId: ctx.req.query.where.masterdetailId
          }
        });

        await categoryModel.updateAll({
          id: category.id,
          deletedAt: null,
          categorystatus: true,
          masterdetailId: ctx.req.query.where.masterdetailId
          // parentId: null
        }, {
          totalproducts: category.totalproducts + 1
        });
      }

      if (ctx.args.data.productmedia) {
        // loop through the array of productdetails and save each product
        for (let index = 0; index < ctx.args.data.productmedia.length; index++) {
          const elementProductMedia = ctx.args.data.productmedia[index];
          await productmediaModel.create({
            productname: ctx.args.data.productmedia[index].name,
            productId: modelInstance.id,
            createdby: modelInstance.userId,
            modifiedby: modelInstance.userId,
            sequence: elementProductMedia.sequence,
            masterdetailId: ctx.req.query.where.masterdetailId
          });
        }
      } else {
        await productmediaModel.create({
          productname: constants.noImageFound,
          productId: modelInstance.id,
          createdby: modelInstance.userId,
          modifiedby: modelInstance.userId,
          sequence: 1,
          masterdetailId: ctx.req.query.where.masterdetailId
        });
      }

      // Collection Module
      if (ctx.args.data.collectionsToJoin && ctx.args.data.collectionsToJoin.length > 0) {

        var collectionsToJoin = ctx.args.data.collectionsToJoin;

        for (let i = 0; i < collectionsToJoin.length; i++) {

          const element = collectionsToJoin[i];

          // 1. Find data in collection table
          var getCollection = await COLLECTION_MODEL.findOne({
            where: {
              id: element.id,
              masterdetailId: ctx.req.query.where.masterdetailId
            }
          });

          // 2. If collection exist than create entry in collection details table
          if (getCollection) {
            await COLLECTION_DETAILS_MODEL.create({
              collectionId: element.id,
              productId: ctx.result.id,
              masterdetailId: ctx.req.query.where.masterdetailId
            });
          }

          // 3. Increase the counter of no of product in particular collection
          await COLLECTION_MODEL.updateAll({
            id: element.id,
            masterdetailId: ctx.req.query.where.masterdetailId
          }, {
            collection_noofproducts: getCollection.collection_noofproducts + 1
          });

        }

      }


    } catch (err) {
      throw err;
    }
  });

  Product.beforeRemote("prototype.patchAttributes", async (ctx, modelInstance, next) => {
    var categoryModel = app.models.category;
    var grouppriceModel = app.models.groupprice;

    try {

      if (ctx.args.data.lastModifiedPriceDate) {
        ctx.args.data.lastModifiedPriceDate = new Date();
      }

      var product = await Product.findById(ctx.args.data.id);

      // check Plan Commonfunction
      var result = await constants.getCurrentMarchantPlan(constants.CURRENT_MERCHANT_PLAN_LABEL, 1, ctx.args.data.masterdetailId);

      // Check Restriction Total Product Limit
      var totalProductLimit = await constants.commonCheckPlanCriteriaFeatures(result, ctx.args.data.masterdetailId, constants.NUMBER_OF_PRODUCT_KEY);

      // Check Product Limit
      var lengthQuery = "SELECT COUNT(id) as count FROM `product` WHERE deletedAt IS NULL AND productstatus = 1 AND masterdetailId = '" + ctx.args.data.masterdetailId + "'";

      var productLength = await new Promise((resolve, reject) => {
        app.datasources.mysql.connector.execute(lengthQuery, null, (err, result) => {
          if (err) reject(err);
          resolve(result);
        });
      });

      if (ctx.args.data.productstatus === 1 && ctx.args.data.productstatus !== product.productstatus) {
        console.log(productLength[0].count >= totalProductLimit);
        if (productLength[0].count >= totalProductLimit) {
          throw constants.createError(404, 'Sorry, You cannot change status of this product, you have already rich your maximum limit!');
        }
      }

      if (ctx.args.data.mainGroupPrice) {
        for (var i = 0; i < ctx.args.data.mainGroupPrice.length; i++) {
          const e = ctx.args.data.mainGroupPrice[i];
          let isGroupPriceExist = await grouppriceModel.findOne({
            where: {
              groupId: e.group_id,
              productId: ctx.args.data.id,
              masterdetailId: ctx.req.query.where.masterdetailId
            }
          });
          if (isGroupPriceExist) {
            await grouppriceModel.updateAll({
              id: isGroupPriceExist.id,
              masterdetailId: ctx.req.query.where.masterdetailId
            }, {
              newprice: e.groupprice,
              price: e.groupprice,
              minimumorderquantity: ctx.args.data.minimumorderquantity ? ctx.args.data.minimumorderquantity : 1
            });
          } else {
            await grouppriceModel.create({
              newprice: e.groupprice,
              price: e.groupprice,
              groupId: e.group_id,
              productId: product.id,
              masterdetailId: ctx.req.query.where.masterdetailId,
              minimumorderquantity: ctx.args.data.minimumorderquantity ? ctx.args.data.minimumorderquantity : 1
            });
          }
        }
      }

      // stringify Product variation data
      if (ctx.args.data.productvariation) {
        ctx.args.data.productvariation = JSON.stringify(ctx.args.data.productvariation);
      }

      if (ctx.args.data.variationconfig) {
        ctx.args.data.variationconfig = JSON.stringify(ctx.args.data.variationconfig);
      }

      // stringify productdetails object
      if (ctx.args.data.productdetails) {
        ctx.args.data.productdetails = JSON.stringify(ctx.args.data.productdetails);
      }

      if (ctx.args.data.other) {
        // stringify other object for jewellary || bundlepurchase
        // if (ctx.args.data.other.jewelleryData || ctx.args.data.other.bundlepurchase) {
        ctx.args.data.other = JSON.stringify(ctx.args.data.other);
        // }
      }

      // get Old SubCategory
      var categorydata = await categoryModel.findOne({
        where: {
          id: product.categoryId,
          masterdetailId: ctx.req.query.where.masterdetailId
        }
      });
      // get New SubCategory
      var newcat = await categoryModel.findOne({
        where: {
          id: ctx.args.data.categoryId,
          masterdetailId: ctx.req.query.where.masterdetailId
        }
      });
      // if old Subcategory not match with new Subcategory
      if (ctx.args.data.categoryId !== categorydata.id) {
        // add product count in new Subcategory
        await categoryModel.updateAll({
          id: ctx.args.data.categoryId,
          masterdetailId: ctx.req.query.where.masterdetailId
        }, {
          totalproducts: newcat.totalproducts + 1
        });
        // decrease product count in old Subcategory
        await categoryModel.updateAll({
          id: categorydata.id,
          masterdetailId: ctx.req.query.where.masterdetailId
        }, {
          totalproducts: categorydata.totalproducts - 1
        });
      }

      if (ctx.instance.productstatus === ctx.args.data.productstatus) {
        delete ctx.args.data.productstatus;
      }

    } catch (error) {
      throw error;
    }

  });

  Product.afterRemote("prototype.patchAttributes", async (ctx, modelInstance, next) => {
    var productmediaModel = app.models.productmedia;
    var producttagsModel = app.models.producttags;
    var settingModel = app.models.setting;
    var grouppriceModel = app.models.groupprice;
    var categoryModel = app.models.category;

    var COLLECTION_MODEL = app.models.collection;
    var COLLECTION_DETAILS_MODEL = app.models.collectiondetail;

    try {

      var setting = await settingModel.find({
        where: {
          masterdetailId: ctx.req.query.where.masterdetailId
        }
      });
      // var is_AI_enabled = setting[12].status;
      // if (is_AI_enabled) {
      //   // delete old tags
      //   await producttagsModel.updateAll({
      //     productId: modelInstance.id
      //   }, {
      //     deletedAt: new Date()
      //   });

      //   constants.getGCloudAPILable(ctx.args.data.productmedia, modelInstance.id); // lable detection
      //   constants.getGCloudAPIText(ctx.args.data.productmedia, modelInstance.id); // text detection
      //   constants.getGCloudAPILable(ctx.args.data.productmedia, modelInstance.id); // logo detection
      // }

      if (ctx.args.data.productmedia) {
        // loop through the array of productdetails and save each product
        for (var i in ctx.args.data.productmedia) {
          await productmediaModel.create({
            productname: ctx.args.data.productmedia[i].name,
            productId: modelInstance.id,
            createdby: modelInstance.userId,
            masterdetailId: ctx.req.query.where.masterdetailId,
            sequence: ctx.args.data.productmedia[i].sequence
          }).catch((err) => {
            next("User product details saved, please check the product media.. ");
          });
        }
      }

      if (ctx.args.data.deletedProductMediaIDs) {

        for (var i = 0; i < ctx.args.data.deletedProductMediaIDs.length; i++) {
          var element = ctx.args.data.deletedProductMediaIDs[i];
          var finadProductmedia = await productmediaModel.findOne({
            where: {
              id: element.id,
              productId: modelInstance.id,
              masterdetailId: ctx.req.query.where.masterdetailId
            },
            deleted: true
          });
          // delete the records
          await productmediaModel.updateAll({
            id: finadProductmedia.id,
            masterdetailId: ctx.req.query.where.masterdetailId
          }, {
            deletedAt: new Date()
          });
        }

      }

      var productData = await Product.findById(ctx.args.data.id);
      var categoryData = await categoryModel.findById(ctx.args.data.categoryId);

      if (ctx.args.data.productstatus === productData.productstatus) {
        // when product status Deactivated Then Decrease counter of Sub-Category(Total Products)
        if (ctx.args.data.productstatus === 0) {
          // product Deactiavated
          await categoryModel.updateAll({
            id: productData.categoryId,
            masterdetailId: ctx.req.query.where.masterdetailId
          }, {
            totalproducts: categoryData.totalproducts - 1
          });
        } else {
          // product Actiavated
          await categoryModel.updateAll({
            id: productData.categoryId,
            masterdetailId: ctx.req.query.where.masterdetailId
          }, {
            totalproducts: categoryData.totalproducts + 1
          });
        }
      }

      // New Added Collection
      if (ctx.args.data.collectionsToJoin && ctx.args.data.collectionsToJoin.length > 0) {

        var collectionsToJoin = ctx.args.data.collectionsToJoin;
        for (let i = 0; i < collectionsToJoin.length; i++) {
          const element = collectionsToJoin[i];
          // 1. Find data in collection table
          var getCollection = await COLLECTION_MODEL.findOne({
            where: {
              id: element.id,
              masterdetailId: ctx.req.query.where.masterdetailId
            }
          });

          // 2. If collection exist than create entry in collection details table
          if (getCollection) {

            // 3. if Entry exist in collection details table go ahead else create entry in collection details table
            var check_collection_details = await COLLECTION_DETAILS_MODEL.findOne({
              where: {
                collectionId: element.id,
                productId: ctx.args.data.id,
                masterdetailId: ctx.req.query.where.masterdetailId
              }
            });

            // create entry in collection_details table
            if (!check_collection_details) {
              var createdCollection = await COLLECTION_DETAILS_MODEL.create({
                collectionId: element.id,
                productId: ctx.args.data.id,
                masterdetailId: ctx.req.query.where.masterdetailId
              });

              if (createdCollection) {
                var collectionData = await COLLECTION_MODEL.findById(element.id);

                // Update counter in perticular product
                await COLLECTION_MODEL.updateAll({
                  id: collectionData.id,
                  masterdetailId: ctx.req.query.where.masterdetailId
                }, {
                  collection_noofproducts: getCollection.collection_noofproducts + 1
                });
              }
            }
          }
        }
      }

      // Delete Collections
      if (ctx.args.data.collectionsToRemove && ctx.args.data.collectionsToRemove.length > 0) {

        var collectionsToRemove = ctx.args.data.collectionsToRemove;

        for (let i = 0; i < collectionsToRemove.length; i++) {
          const element = collectionsToRemove[i];
          // 1. Find data in collection table
          var getCollection = await COLLECTION_MODEL.findOne({
            where: {
              id: element.id,
              masterdetailId: ctx.req.query.where.masterdetailId
            }
          });

          // 2. If collection exist than create entry in collection details table
          if (getCollection) {

            // 3. if Entry exist in collection details table go ahead else create entry in collection details table
            var checkExistInCollection = await COLLECTION_DETAILS_MODEL.findOne({
              where: {
                collectionId: element.id,
                productId: ctx.args.data.id,
                masterdetailId: ctx.req.query.where.masterdetailId
              }
            });

            // create entry in collection_details table
            if (checkExistInCollection) {
              await COLLECTION_DETAILS_MODEL.updateAll({
                collectionId: element.id,
                productId: ctx.args.data.id,
                masterdetailId: ctx.req.query.where.masterdetailId
              }, {
                deletedAt: new Date()
              });
              // Update counter in perticular product
              await COLLECTION_MODEL.updateAll({
                id: element.id,
                masterdetailId: ctx.req.query.where.masterdetailId
              }, {
                collection_noofproducts: getCollection.collection_noofproducts - 1
              });
            }
          }
        }
      }

    } catch (error) {
      throw error;
    }
  });

  Product.afterRemote("findById", async (ctx, modelInstance, next) => {

    var groupPriceModel = app.models.groupprice;
    var userModel = app.models.user;
    var userDetails, groupPriceDetails;
    var orderModel = app.models.order;
    var orderdetailsModel = app.models.orderdetails;
    var COLLECTION_MODEL = app.models.collection;
    var getOrderOfUser, getorderDetailsOfUser
    var COLLECTION_DETAILS_MODEL = app.models.collectiondetail;

    try {

      // Get customer details
      userDetails = await userModel.findById(ctx.req.accessToken.userId);

      // find group price availabe or not
      groupPriceDetails = await groupPriceModel.findOne({
        where: {
          groupId: userDetails.groupId,
          productId: ctx.req.params.id,
          masterdetailId: ctx.req.query.where.masterdetailId
        }
      });
      if (groupPriceDetails) {
        modelInstance.price = groupPriceDetails.newprice;
        if (groupPriceDetails.minimumorderquantity) {
          modelInstance.minimumorderquantity = groupPriceDetails.minimumorderquantity;
        } else {
          modelInstance.minimumorderquantity = 1;
        }

      } else {
        modelInstance.minimumorderquantity = 1;
        modelInstance.pricemode = true;
      }

      // Attach Counter of Particular Product
      getOrderOfUser = await orderModel.findOne({
        where: {
          inshoppingcart: SettingConstants.ORDER_CART,
          userId: ctx.req.accessToken.userId
        }
      });

      if (getOrderOfUser) {
        getorderDetailsOfUser = await orderdetailsModel.find({
          where: {
            orderId: getOrderOfUser.id
          }
        });
        if (getorderDetailsOfUser && getorderDetailsOfUser.length > 0) {
          var getProductDetailsFromOrderDetails = await orderdetailsModel.findOne({
            where: {
              orderId: getOrderOfUser.id,
              productId: modelInstance.id
            }
          });
          if (getProductDetailsFromOrderDetails) {
            modelInstance.totalCartCounter = getProductDetailsFromOrderDetails.quantity;
          } else {
            modelInstance.totalCartCounter = 0;
          }
        }
      } else {
        modelInstance.totalCartCounter = 0;
      }

      // Get All Collection in Which Product Exist
      var getCollections = await COLLECTION_DETAILS_MODEL.find({
        where: {
          productId: ctx.req.params.id,
          masterdetailId: ctx.req.query.where.masterdetailId
        }
      });

      var collectionDetails = [];
      if (getCollections && getCollections.length > 0) {
        for (let i = 0; i < getCollections.length; i++) {
          const element = getCollections[i];
          var getCollection = await COLLECTION_MODEL.findOne({
            where: {
              id: element.collectionId
            }
          });

          collectionDetails.push({
            id: getCollection.id,
            name: getCollection.collection_name
          });
        }
      }

      modelInstance.collectionsToJoin = collectionDetails;

      // modelInstance.productmedia = modelInstance.productmedia.sort((a, b) => Date.parse(a.sequence) - Date.parse(b.sequence));

    } catch (error) {
      throw error;
    }
  });


  Product.beforeRemote("find", async (ctx, modelInstance, next) => {
    try {
      ctx.req.query = ctx.req.query || {};
      ctx.req.query.filter = ctx.req.query.filter || {};
      ctx.req.query.filter.where = ctx.req.query.filter.where || {};
      ctx.req.query.filter.where.masterdetailId = ctx.req.query.where.masterdetailId;
      if (ctx && ctx.req && ctx.req.query && ctx.req.query.filter && ctx.req.query.filter.where) {
        if (ctx.req.query.filter.where.name && ctx.req.query.filter.where.name.like) {
          ctx.req.query.filter.where.name.like = ctx.req.query.filter.where.name.like.split('%20').join(' ');
        }
        if (ctx.req.query.filter.where.name && ctx.req.query.filter.where.name.like) {
          ctx.req.query.filter.where.name.like = ctx.req.query.filter.where.name.like.split('%20').join(' ');
        }
        if (ctx.req.query.filter.where.subcategory && ctx.req.query.filter.where.subcategory.like) {
          ctx.req.query.filter.where.subcategory.like = ctx.req.query.filter.where.subcategory.like.split('%20').join(' ');
        }
        if (ctx.req.query.filter.where.maincategory && ctx.req.query.filter.where.maincategory.like) {
          ctx.req.query.filter.where.maincategory.like = ctx.req.query.filter.where.maincategory.like.split('%20').join(' ');
        }
        // if (ctx.req.query.filter.order) {
        //   for (var i = 0; i < ctx.req.query.filter.order.length; i++) {
        //     const element = ctx.req.query.filter.order[i];
        //     element = element.split('%20').join(' ');
        //   }
        // }
      }
    } catch (error) {
      throw error;
    }
  });

  Product.afterRemote("find", async (ctx, modelInstance, next) => {
    var productModel = app.models.product;
    var accesstokenModel = app.models.AccessToken;
    var userModel = app.models.user;
    var groupcategoryModel = app.models.groupcategory;
    var groupModel = app.models.group;
    var grouppriceModel = app.models.groupprice;
    var productmediaModel = app.models.productmedia;
    var categoryModel = app.models.category;
    var orderModel = app.models.order;
    var orderdetailsModel = app.models.orderdetails;

    var resData = {};
    var tenant = ctx.req.baseUrl.substring(1);
    tenant = tenant.split('/')[0];

    var getorderDetailsOfUser;
    var getOrderOfUser;
    var getOrderProductArray = [];

    try {
      await productModel.updateAll({
        availablequantity: {
          lt: 0
        },
        masterdetailId: ctx.req.query.where.masterdetailId
      }, {
        availablequantity: 0
      });

      var accessToken = await accesstokenModel.findOne({
        where: {
          id: ctx.req.headers.authorization,
          masterdetailId: ctx.req.query.where.masterdetailId
        }
      });

      // find user role
      var userrole = await userModel.findById(accessToken.userId);

      // datatable listing
      if (ctx.req.query.isWeb) {

        if (
          ctx.req.query.filter.where &&
          ctx.req.query.filter.where.and &&
          Object.keys(ctx.req.query.filter.where.and[0]).length > 1
        ) {
          var tempQuery = ' ';

          if (ctx.req.query.filter.where.and[0].name && ctx.req.query.filter.where.and[0].name.like) { // name
            tempQuery += " AND name LIKE  '" + ctx.req.query.filter.where.and[0].name.like + "' ";
          }

          if (ctx.req.query.filter.where.and[0].productno && ctx.req.query.filter.where.and[0].productno.like) { // Product Number
            tempQuery += " AND productno LIKE  '" + ctx.req.query.filter.where.and[0].productno.like + "' ";
          }

          if (ctx.req.query.filter.where.and[0].price && ctx.req.query.filter.where.and[0].price.like) { // Price
            tempQuery += " AND price LIKE  '" + ctx.req.query.filter.where.and[0].price.like + "' ";
          }

          if (ctx.req.query.filter.where.and[0].availablequantity === 0) { // availablequantity
            tempQuery += " AND availablequantity =  0 ";
          }

          if (ctx.req.query.filter.where.and[0].outofstock) { // availablequantity
            tempQuery += " AND availablequantity = 0 ";
          }

          if (ctx.req.query.filter.where.and[0].availablequantity) { // availablequantity
            tempQuery += " AND availablequantity =  " + ctx.req.query.filter.where.and[0].availablequantity + " ";
          }

          if (ctx.req.query.filter.where.and[0].productstatus === 0) { // productstatus
            tempQuery += " AND productstatus =  0 ";
          }

          if (ctx.req.query.filter.where.and[0].productstatus === 1) { // productstatus
            tempQuery += " AND productstatus =  1 ";
          }

          if (ctx.req.query.filter.where.and[0].subcategory) { // subcategory

            // find all subcategory like
            var subcategorylike = await categoryModel.find({
              where: {
                name: {
                  like: "%" + ctx.req.query.filter.where.and[0].subcategory.like + "%"
                },
                parentId: {
                  neq: null
                },
                masterdetailId: ctx.req.query.where.masterdetailId
              }
            });

            if (subcategorylike.length > 0) {
              subcategorylike = await subcategorylike.map((oneCategory) => oneCategory.id);
              subcategorylike = await subcategorylike.map(a => JSON.stringify(a)).join();
              subcategorylike = "(" + subcategorylike + ")";
              tempQuery += " AND categoryId IN " + subcategorylike;
            } else {
              resData.data = 0;
              resData.length = 0;
              ctx.res.status(200).send(resData);
            }

          }

          if (ctx.req.query.filter.where.and[0].maincategory) { // main category

            // find all main category like
            var maincategorylike = await categoryModel.find({
              where: {
                name: {
                  like: "%" + ctx.req.query.filter.where.and[0].maincategory.like + "%"
                },
                parentId: {
                  eq: null
                },
                masterdetailId: ctx.req.query.where.masterdetailId
              }
            });

            if (maincategorylike.length > 0) {
              maincategorylike = await maincategorylike.map((oneCategory) => {
                return oneCategory.id;
              });

              // find all subcategory like
              var subcategorylike = await categoryModel.find({
                where: {
                  parentId: {
                    inq: maincategorylike
                  },
                  masterdetailId: ctx.req.query.where.masterdetailId
                }
              });
              subcategorylike = await subcategorylike.map((oneCategory) => {
                return oneCategory.id;
              });

              subcategorylike = await subcategorylike.map(a => JSON.stringify(a)).join();
              subcategorylike = "(" + subcategorylike + ")";
              tempQuery += " AND categoryId IN " + subcategorylike;

            } else {
              resData.data = 0;
              resData.length = 0;
              ctx.res.status(200).send(resData);
            }

          }

          if (ctx.req.query.filter.order) {
            tempQuery += " ORDER BY " + ctx.req.query.filter.order + " ";
          }

          var dataQuery = "SELECT * FROM `product` WHERE deletedAt IS NULL AND masterdetailId = '" + ctx.req.query.where.masterdetailId + "' " + tempQuery + " LIMIT " + ctx.req.query.filter.skip + "," + ctx.req.query.filter.limit;
          console.log(dataQuery);
          var productsData = await new Promise((resolve, reject) => {
            app.datasources.mysql.connector.execute(dataQuery, null, (err, result) => {
              if (err) reject(err);
              resolve(result);
            });
          });

          var lengthQuery = "SELECT COUNT(id) as count FROM `product` WHERE deletedAt IS NULL AND masterdetailId = '" + ctx.req.query.where.masterdetailId + "' " + tempQuery;
          var productLength = await new Promise((resolve, reject) => {
            app.datasources.mysql.connector.execute(lengthQuery, null, (err, result) => {
              if (err) reject(err);
              resolve(result);
            });
          });

          for (var i = 0; i < productsData.length; i++) {
            const oneProduct = productsData[i];
            var subcategory = await categoryModel.findById(oneProduct.categoryId); // find and attach subcategory
            var category = await categoryModel.findById(subcategory.parentId); // find and attach category name
            oneProduct.categoryName = category.name;
            oneProduct.category = subcategory;

            var productmedia = await productmediaModel.find({
              where: {
                productId: oneProduct.id,
                masterdetailId: ctx.req.query.where.masterdetailId
              },
              order: 'sequence ASC'
            });
            oneProduct.productmedia = productmedia;
          }
          resData.data = productsData;
          resData.length = productLength[0].count;
          ctx.res.status(200).send(resData);

        } else {

          if (ctx.req.query.filter.order === 'id DESC' || ctx.req.query.filter.order === 'id desc') {
            ctx.req.query.filter.order = 'created DESC';
          }
          if (ctx.req.query.filter.order === 'id ASC' || ctx.req.query.filter.order === 'id asc') {
            ctx.req.query.filter.order = 'created ASC';
          }

          var dataQuery = "SELECT * FROM `product` WHERE deletedAt IS NULL AND masterdetailId = '" + ctx.req.query.where.masterdetailId + "' "
            + " ORDER BY " + ctx.req.query.filter.order + " LIMIT " + ctx.req.query.filter.skip + "," + ctx.req.query.filter.limit;
          var productsData = await new Promise((resolve, reject) => {
            app.datasources.mysql.connector.execute(dataQuery, null, (err, result) => {
              if (err) reject(err);
              resolve(result);
            });
          });

          var lengthQuery = "SELECT COUNT(id) as count FROM `product` WHERE deletedAt IS NULL AND masterdetailId = '" + ctx.req.query.where.masterdetailId + "'";
          var productLength = await new Promise((resolve, reject) => {
            app.datasources.mysql.connector.execute(lengthQuery, null, (err, result) => {
              if (err) reject(err);
              resolve(result);
            });
          });

          for (var i = 0; i < productsData.length; i++) {
            const oneProduct = productsData[i];
            // var subcategory = await categoryModel.find(oneProduct.categoryId, {deleted : true});
            var subcategory = await categoryModel.find({
              where: {
                id: oneProduct.categoryId,
                masterdetailId: ctx.req.query.where.masterdetailId
              },
              deleted: true
            });
            // var category = await categoryModel.findById(subcategory.parentId, {deleted: true}); // find and attach category name
            var category = await categoryModel.find({
              where: {
                id: subcategory[0].parentId,
                masterdetailId: ctx.req.query.where.masterdetailId
              },
              deleted: true
            });
            oneProduct.categoryName = category[0].name;
            oneProduct.category = subcategory[0];

            var productmedia = await productmediaModel.find({
              where: {
                productId: oneProduct.id,
                masterdetailId: ctx.req.query.where.masterdetailId
              },
              order: 'sequence ASC'
            });
            oneProduct.productmedia = productmedia;
          }

          resData.data = productsData;
          resData.length = productLength[0].count;
          ctx.res.status(200).send(resData);

        }

      } else if (!ctx.req.query.isWeb && (userrole.roleId === 2 || userrole.roleId === 5)) {
        // Code changed for best selling product in app at 26 08 2020
        var user = await userModel.findById(accessToken.userId);
        if (user.groupId) {
          var groupcategory = await groupcategoryModel.find({
            where: {
              groupId: user.groupId,
              masterdetailId: ctx.req.query.where.masterdetailId
            }
          });

          var groupDetail = await groupModel.findById(user.groupId);
          groupcategory = await groupcategory.map((groupcategory) => groupcategory.categoryId);
          var groupCategoryArray = groupcategory;
          groupcategory = groupcategory.map(a => JSON.stringify(a)).join();
          if (groupcategory.length) {
            groupcategory = "(" + groupcategory + ")";
          } else {
            groupcategory = "(" + null + ")";
          }

          var tempQuery = '';

          if (
            ctx.req.query.filter.where && ctx.req.query.filter.where.and &&
            ctx.req.query.filter.where.and[0].name && ctx.req.query.filter.where.and[0].name.like
          ) {
            tempQuery += " AND name LIKE  '" + ctx.req.query.filter.where.and[0].name.like + "' ";
          }

          if (ctx.req.query.filter.where && ctx.req.query.filter.where.and && ctx.req.query.filter.where.and[0].categoryId) {
            tempQuery += " AND categoryId = '" + ctx.req.query.filter.where.and[0].categoryId + "' ";

            if (!groupCategoryArray.includes(ctx.req.query.filter.where.and[0].categoryId)) {
              groupCategoryArray.push(ctx.req.query.filter.where.and[0].categoryId);
            }

            groupcategory = groupCategoryArray.map(a => JSON.stringify(a)).join();
            if (groupcategory && groupcategory.length > 0) {
              groupcategory = "(" + groupcategory + ")";
            } else {
              groupcategory = "(" + null + ")";
            }
          }

          if (ctx.req.query.filter.where && ctx.req.query.filter.where.and && ctx.req.query.filter.where.and[0].maincategory) { // main category

            // find all main category like
            var maincategorylike = await categoryModel.find({
              where: {
                // name: {
                //   like: "%" + ctx.req.query.filter.where.and[0].maincategory + "%"
                // },
                id: ctx.req.query.filter.where.and[0].maincategory,
                parentId: {
                  eq: null
                },
                masterdetailId: ctx.req.query.where.masterdetailId
              }
            });

            maincategorylike = await maincategorylike.map(oneCategory => oneCategory.id);
            // find all subcategory like
            var subcategorylike = await categoryModel.find({
              where: {
                parentId: {
                  inq: maincategorylike
                },
                masterdetailId: ctx.req.query.where.masterdetailId
              }
            });
            if (subcategorylike.length > 0) {
              var subcategoryArray = subcategorylike;
              subcategorylike = await subcategorylike.map(oneCategory => oneCategory.id);
              subcategorylike = await subcategorylike.map(a => JSON.stringify(a)).join();
              subcategorylike = "(" + subcategorylike + ")";
              // tempQuery += " AND categoryId IN " + subcategorylike;

              // Step 1 - Check Subcategory Id Exist In Group Array?
              // Step 2 - If Exist push in new Array
              // Step 3 - Log New Array
              // Step 4 - Convert in SQL Format
              // Step 5 - replace with groupcategory

              var newGroupCategoryArray = [];
              for (let s = 0; s < subcategoryArray.length; s++) {
                const element = subcategoryArray[s];
                if (groupCategoryArray.includes(element.id)) {
                  newGroupCategoryArray.push(element.id)
                }
              }

              groupcategory = newGroupCategoryArray.map(a => JSON.stringify(a)).join();
              if (groupcategory && groupcategory.length > 0) {
                groupcategory = "(" + groupcategory + ")";
              } else {
                groupcategory = "(" + null + ")";
              }

            } else {
              groupcategory = "(" + null + ")";
            }

          }

          // in between filter
          if (ctx.req.query.filter.where.and[0].maxPrice || ctx.req.query.filter.where.and[0].minPrice) {
            if (ctx.req.query.filter.where.and[0].maxPrice && ctx.req.query.filter.where.and[0].minPrice) {
              tempQuery += " AND price BETWEEN  " + ctx.req.query.filter.where.and[0].minPrice +
                " AND " + ctx.req.query.filter.where.and[0].maxPrice + " ";
            } else if (ctx.req.query.filter.where.and[0].minPrice) {
              tempQuery += " AND price >=  " + ctx.req.query.filter.where.and[0].minPrice + " ";
            } else if (ctx.req.query.filter.where.and[0].maxPrice) {
              tempQuery += " AND price <=  " + ctx.req.query.filter.where.and[0].maxPrice + " ";
            }

          }

          // Order by manage best selling products & latest created products
          if (ctx.req.query.filter && ctx.req.query.filter.order) {
            for (var i = 0; i < ctx.req.query.filter.order.length; i++) {
              const element = ctx.req.query.filter.order[i];
              if (i === 0) {
                tempQuery += " ORDER BY " + element;
              } else {
                tempQuery += ", " + element;
              }
            }
          }

          if (ctx.req.query && ctx.req.query.filter && ctx.req.query.filter.limit && (ctx.req.query.filter.skip === 0 || ctx.req.query.filter.skip)) {
            query = "SELECT * FROM `product` WHERE `categoryId` IN " + groupcategory + " AND productstatus = 1 AND deletedAt IS NULL AND masterdetailId = '" + ctx.req.query.where.masterdetailId + "' " + tempQuery + " LIMIT " + ctx.req.query.filter.skip + "," + ctx.req.query.filter.limit;
          } else {
            query = "SELECT * FROM `product` WHERE `categoryId` IN " + groupcategory + " AND productstatus = 1 AND deletedAt IS NULL AND masterdetailId = '" + ctx.req.query.where.masterdetailId + "' " + tempQuery;
          }
          console.log(query);

          var product = await new Promise((resolve, reject) => {
            app.datasources.mysql.connector.execute(query, null, (err, result) => {
              if (err) reject(err);
              resolve(result);
            });
          });

          // Attach Counter of Particular Product in Cart
          // Step 1 : Get Order of Customer / Guest
          // Step 2 : Get Order Details Of That Particular Order
          // From Product Array find That particular product & Attach Quantity into it
          getOrderOfUser = await orderModel.findOne({
            where: {
              inshoppingcart: SettingConstants.ORDER_CART,
              userId: user.id
            }
          });

          if (getOrderOfUser) {
            getorderDetailsOfUser = await orderdetailsModel.find({
              where: {
                orderId: getOrderOfUser.id
              }
            });
            if (getorderDetailsOfUser && getorderDetailsOfUser.length > 0) {
              getorderDetailsOfUser.filter(item => getOrderProductArray.push(item.productId));
            }
          }

          if (product && product.length > 0) {
            for (let i = 0; i < product.length; i++) {
              const element = product[i];

              // attach product media
              var media = await productmediaModel.find({
                where: {
                  productId: element.id,
                  masterdetailId: ctx.req.query.where.masterdetailId
                },
                order: 'sequence ASC'
              });
              element.productmedia = media;

              // attach category data
              var categoryOfProduct = await categoryModel.findOne({
                where: {
                  id: element.categoryId,
                  masterdetailId: ctx.req.query.where.masterdetailId
                }
              });
              element.category = categoryOfProduct;

              // remove price if price mode off for the group
              if (groupDetail.isprice === false) {
                element.pricemode = false;
              } else {
                element.pricemode = true;
              }

              if (element.inInquiry) {
                element.inInquiry = true;
              } else {
                element.inInquiry = false;
              }

              // find newprice is availabe or not
              var groupprice = await grouppriceModel.findOne({
                where: {
                  groupId: user.groupId,
                  productId: element.id,
                  masterdetailId: ctx.req.query.where.masterdetailId
                }
              });

              if (groupprice) {
                element.price = groupprice.newprice;
                if (groupprice.minimumorderquantity) {
                  element.minimumorderquantity = groupprice.minimumorderquantity;
                } else {
                  element.minimumorderquantity = 1;
                }
              } else {
                element.minimumorderquantity = 1;
              }

              // Attach Counter of Particular Product
              if (getOrderOfUser && getorderDetailsOfUser && getorderDetailsOfUser.length > 0 && getOrderProductArray.length > 0) {
                if (getOrderProductArray.includes(element.id)) {
                  var getProductDetailsFromOrderDetails = await orderdetailsModel.findOne({
                    where: {
                      orderId: getOrderOfUser.id,
                      productId: element.id
                    }
                  });
                  if (getProductDetailsFromOrderDetails) {
                    element.totalCartCounter = getProductDetailsFromOrderDetails.quantity;
                  } else {
                    element.totalCartCounter = 0;
                  }
                } else {
                  element.totalCartCounter = 0;
                }
              }

              // Attach Next Product Id
              if (i === product.length - 1) {
                element.nextProductId = product[0].id;
              } else {
                element.nextProductId = product[i + 1].id;
              }

              // Attach Previous Product Id
              if (i === 0) {
                element.previousProductId = product[product.length - 1].id;
              } else {
                element.previousProductId = product[i - 1].id;
              }

            }
          }

          // When Price Filter is in Request, Need to manage With Group Price
          if (ctx && ctx.req && ctx.req.query && ctx.req.query.filter && ctx.req.query.filter.order) {
            for (var i = 0; i < ctx.req.query.filter.order.length; i++) {
              const element = ctx.req.query.filter.order[i];
              if (element === 'price ASC') {
                product.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
              }
              if (element === 'price DESC') {
                product.sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
              }
            }
          }

          return ctx.res.status(200).send(product);

        } else {
          var product = await productModel.find({
            where: {
              masterdetailId: ctx.req.query.where.masterdetailId
            },
            include: ["productmedia", "category"]
          });

          // When Price Filter is in Request, Need to manage With Group Price
          if (ctx && ctx.req && ctx.req.query && ctx.req.query.filter && ctx.req.query.filter.order) {
            for (var i = 0; i < ctx.req.query.filter.order.length; i++) {
              const element = ctx.req.query.filter.order[i];
              if (element === 'price ASC') {
                console.log('ASC');
                product.sort(function (a, b) {
                  return parseFloat(a.price) - parseFloat(b.price);
                });
              }
              if (element === 'price DESC') {
                console.log('DESC');
                product.sort(function (a, b) {
                  return parseFloat(b.price) - parseFloat(a.price);
                });
              }
            }
          }

          ctx.res.status(200).send(product);
        }
      } else if (!ctx.req.query.isWeb && userrole.roleId === 3) {


        var user = await userModel.findById(accessToken.userId);

        var tempQuery = '';
        if (ctx.req.query.filter.where && ctx.req.query.filter.where.and && ctx.req.query.filter.where.and[0].name && ctx.req.query.filter.where.and[0].name.like) {
          tempQuery += " AND name LIKE  '" + ctx.req.query.filter.where.and[0].name.like + "' ";
        }

        if (ctx.req.query.filter.where && ctx.req.query.filter.where.and && ctx.req.query.filter.where.and[0].categoryId) {
          tempQuery += " AND categoryId = '" + ctx.req.query.filter.where.and[0].categoryId + "' ";
        }

        if (ctx.req.query.filter.where && ctx.req.query.filter.where.and && ctx.req.query.filter.where.and[0].maincategory) { // main category

          // find all main category like
          var maincategorylike = await categoryModel.find({
            where: {
              // name: {
              //   like: "%" + ctx.req.query.filter.where.and[0].maincategory + "%"
              // },
              id: ctx.req.query.filter.where.and[0].maincategory,
              parentId: {
                eq: null
              },
              masterdetailId: ctx.req.query.where.masterdetailId
            }
          });

          maincategorylike = await maincategorylike.map((oneCategory) => {
            return oneCategory.id;
          });

          // find all subcategory like
          var subcategorylike = await categoryModel.find({
            where: {
              parentId: {
                inq: maincategorylike
              },
              masterdetailId: ctx.req.query.where.masterdetailId
            }
          });

          if (subcategorylike.length > 0) {
            subcategorylike = await subcategorylike.map((oneCategory) => {
              return oneCategory.id;
            });

            subcategorylike = await subcategorylike.map(a => JSON.stringify(a)).join();
            subcategorylike = "(" + subcategorylike + ")";
            tempQuery += " AND categoryId IN " + subcategorylike;
          }

        }

        // Order by manage best selling products & latest created products
        if (ctx.req.query.filter && ctx.req.query.filter.order) {
          for (var i = 0; i < ctx.req.query.filter.order.length; i++) {
            const element = ctx.req.query.filter.order[i];
            if (i === 0) {
              tempQuery += " ORDER BY " + element;
            } else {
              tempQuery += ", " + element;
            }
          }
        }

        var query = "SELECT * FROM `product` WHERE  productstatus = 1 AND deletedAt IS NULL AND masterdetailId = '" + ctx.req.query.where.masterdetailId + "' " + tempQuery + " LIMIT " + ctx.req.query.filter.skip + "," + ctx.req.query.filter.limit;
        var product = await new Promise((resolve, reject) => {
          app.datasources.mysql.connector.execute(query, null, (err, result) => {
            if (err) reject(err);
            resolve(result);
          });
        });

        for (const key in product) {
          if (product.hasOwnProperty(key)) {
            const element = product[key];
            // attach product media and category
            var media = await productmediaModel.find({
              where: {
                productId: element.id,
                masterdetailId: ctx.req.query.where.masterdetailId
              },
              order: 'sequence ASC'
            });

            element.productmedia = media;

            var categoryOfProduct = await categoryModel.findOne({
              where: {
                id: element.categoryId,
                masterdetailId: ctx.req.query.where.masterdetailId
              }
            });

            element.category = categoryOfProduct;

            if (element.inInquiry) {
              element.inInquiry = true;
            } else {
              element.inInquiry = false;
            }

            // passed static params
            element.pricemode = true;
            element.minimumorderquantity = 1;

          }
        }

        return ctx.res.status(200).send(product);

      }
    } catch (error) {
      throw error;
    }
  });

  Product.beforeRemote("deleteById", async (ctx, modelInstance, next) => {
    var categoryModel = app.models.category;
    var productModel = app.models.product;
    var COLLECTION_DETAILS_MODEL = app.models.collectiondetail;
    var COLLECTION = app.models.collection;

    try {
      var product = await productModel.findOne({
        where: {
          id: ctx.req.params.id,
          masterdetailId: ctx.req.query.where.masterdetailId
        }
      });

      var category = await categoryModel.findOne({
        where: {
          id: product.categoryId,
          masterdetailId: ctx.req.query.where.masterdetailId
        }
      });

      if (category) {
        await categoryModel.updateAll({
          id: category.id,
          masterdetailId: ctx.req.query.where.masterdetailId
        }, {
          totalproducts: category.totalproducts - 1
        });
      }

      // Get Collection Details using product id
      var collectionProducts = await COLLECTION_DETAILS_MODEL.find({
        where: {
          productId: ctx.req.params.id,
          masterdetailId: ctx.req.query.where.masterdetailId
        }
      });

      if (collectionProducts && collectionProducts.length > 0) {

        // Delete Products from collection details
        for (let index = 0; index < collectionProducts.length; index++) {
          const element = collectionProducts[index];
          await COLLECTION_DETAILS_MODEL.updateAll({
            id: element.id
          }, {
            deletedAt: new Date()
          });
        }

        // Get Collection Products and set counts in collection
        var getcollectionProducts = await COLLECTION_DETAILS_MODEL.find({
          where: {
            collectionId: collectionProducts[0].collectionId
          }
        });
        console.log("getcollectionProducts", getcollectionProducts.length);

        // Update Collection No Of Products
        await COLLECTION.updateAll({
          id: collectionProducts[0].collectionId
        }, {
          collection_noofproducts: getcollectionProducts.length
        });

      }

    } catch (error) {
      throw error;
    }
  });

  Product.productprogress = async (req) => {
    var productModel = app.models.product;
    try {
      // find all product
      var allprodcut = await productModel.count({
        masterdetailId: req.query.where.masterdetailId
      });

      // active product count
      var activeProduct = await productModel.find({
        where: {
          productstatus: true,
          masterdetailId: req.query.where.masterdetailId
        }
      });

      var deactiveProduct = await productModel.find({
        where: {
          productstatus: false,
          masterdetailId: req.query.where.masterdetailId
        }
      });

      var outofstock = await productModel.find({
        where: {
          availablequantity: 0,
          masterdetailId: req.query.where.masterdetailId
        }
      });

      var activeData = (activeProduct.length * 100) / allprodcut;
      var deactiveData = (deactiveProduct.length * 100) / allprodcut;
      var outofstockData = (outofstock.length * 100) / allprodcut;

      var obj = {
        activeData: activeData,
        deactiveData: deactiveData,
        outofstockData: outofstockData,
        activeProduct: activeProduct.length,
        dectiveProduct: deactiveProduct.length,
        outofstock: outofstock.length,
        allprodcut: allprodcut

      };
      return obj;
    } catch (error) {
      throw error;
    }

    // return order.length;
  };

  Product.productTopSelling = async (req) => {
    try {
      return await Product.find({
        where: {
          masterdetailId: req.query.where.masterdetailId
        },
        skip: 0,
        limit: 5,
        order: 'sellcounter DESC',
        include: ["productmedia"]
      });
    } catch (error) {
      throw error;
    }
  };

  // product category filter : Akib
  Product.productCategoryFilter = async (req) => {
    try {

      var categoryModel = app.models.category;
      var productModel = app.models.product;
      var tempArray = [];
      var getProducts;
      var result;
      var resData = {};

      // based on categoryId get all categories of it
      var getSubcategory = await categoryModel.find({
        where: {
          parentId: req.query.categoryId,
          masterdetailId: req.query.where.masterdetailId
        }
      });

      for (var i = 0; i < getSubcategory.length; i++) {
        const element = getSubcategory[i].__data.id;
        getProducts = await productModel.find({
          where: {
            categoryId: element,
            masterdetailId: req.query.where.masterdetailId
          },
          limit: req.query.filter.limit,
          skip: req.query.filter.skip,
          include: ["productmedia", "category"]
        });

        if (getProducts.length > 0) {
          resData.data = getProducts.__data
          for (var j = 0; j < getProducts.length; j++) {
            const element = getProducts[j].__data;
            tempArray.push(element)
          }
        }
      }
      resData.length = tempArray.length
      return resData;

    } catch (error) {
      throw error
    }
  };

  // get single product data based on request
  Product.getSingleProduct = async (req) => {
    try {

      var categoryModel = app.models.category
      var userModel = app.models.user
      var groupModel = app.models.group
      var grouppriceModel = app.models.groupprice
      var accesstokenModel = app.models.AccessToken;
      var getProduct = {};

      if (!req.query.id) {
        var err = new Error("Sorry! Your Requested Product Not Found");
        err.statusCode = 400;
        throw err;
      }

      getProduct = await Product.findOne({
        where: {
          id: req.query.id,
          productstatus: true,
          masterdetailId: req.query.where.masterdetailId
          // availablequantity: { gt: 0 }
        },
        include: ["productmedia", "category", "groupprices"]
      });

      if (getProduct) {
        var category = await categoryModel.findById(getProduct.categoryId);

        // attach category name
        let getCatName = await categoryModel.findOne({
          where: {
            id: category.parentId,
            masterdetailId: req.query.where.masterdetailId
          }
        });

        getProduct.categoryName = getCatName.name;

        var accessToken = await accesstokenModel.findOne({
          where: {
            id: req.headers.authorization,
            masterdetailId: req.query.where.masterdetailId
          }
        });

        // find user based on accesstoken
        var user = await userModel.findById(accessToken.userId);
        if (user.groupId) {
          // pricemode
          var groupDetail = await groupModel.findById(user.groupId);
          // remove price if price mode off for the group
          if (groupDetail) {
            if (groupDetail.isprice === false) {
              getProduct.pricemode = false;
            } else {
              getProduct.pricemode = true;
            }
          } else {
            getProduct.pricemode = true;
          }

          // find newprice is availabe or not
          var groupprice = await grouppriceModel.findOne({
            where: {
              groupId: user.groupId,
              productId: req.query.id,
              masterdetailId: req.query.where.masterdetailId
            }
          });

          if (groupprice) {
            getProduct.price = groupprice.newprice;
            if (groupprice.minimumorderquantity) {
              getProduct.minimumorderquantity =
                groupprice.minimumorderquantity;
            } else {
              getProduct.minimumorderquantity = 1;
            }
          } else {
            getProduct.minimumorderquantity = 1;
          }
        } else {
          getProduct.minimumorderquantity = 1;
          getProduct.pricemode = true;
        }

      }

      return getProduct;

    } catch (error) {
      throw error
    }
  };

  Product.shortnewURL = async (req) => {

    var shorturlModel = app.models.shorturl;
    var accesstokenModel = app.models.AccessToken;
    var userModel = app.models.user;

    try {

      // find user based on accesstoken
      var accessToken = await accesstokenModel.findOne({
        where: {
          id: req.headers.authorization,
          masterdetailId: req.query.where.masterdetailId
        }
      });

      var user = await userModel.findById(accessToken.userId);

      if (req.body.url) {
        let splitUrl = req.body.url.split("/");
        if (splitUrl[2] == "managebizon.sufalam.live") {
          splitUrl[2] = app.get('serverConfig').webstore_url
          splitUrl[2] = splitUrl[2].slice(0, -1);
          splitUrl.splice(0, 2);
          req.body.url = splitUrl.join("/");
          console.log(req.body.url);
        }
      }

      var data = await new Promise((resolve, reject) => {
        TinyURL.shorten(req.body.url, (result, err) => {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        });
      });

      var getInsertedData = await shorturlModel.create({
        longurl: req.body.url,
        shortUrl: data,
        userId: user.id,
        masterdetailId: req.query.where.masterdetailId
      });

      return getInsertedData;

    } catch (error) {
      throw error
    }

  };

  Product.exportProducts = async (req) => {

    try {
      var productModel = app.models.product
      var categoryModel = app.models.category
      var tempArray = []

      // get All products Data
      var getProducts = await productModel.find({
        where: {
          masterdetailId: req.query.where.masterdetailId
        },
        include: ["productmedia"],
      });

      if (getProducts.length > 0) {
        for (var i = 0; i < getProducts.length; i++) {
          const element = getProducts[i].__data;

          if (element.productstatus === 0) {
            element.productstatus = "Deactive"
          } else if (element.productstatus === 1) {
            element.productstatus = "Active"
          } else {
            element.productstatus = "--"
          }

          // get subcatagoryName
          var subcategorydata = await categoryModel.findOne({
            where: {
              id: element.categoryId,
              masterdetailId: req.query.where.masterdetailId
            }
          });

          // get catagoryName
          var categorydata = await categoryModel.findOne({
            where: {
              id: subcategorydata.parentId,
              masterdetailId: req.query.where.masterdetailId
            }
          });

          // Qr Code
          var qrcodeData = buffer.from(constants.stringifyJson(element.id)).toString('base64');
          qrcodeData = 'https://chart.googleapis.com/chart?chs=300x300&cht=qr&chl=' + qrcodeData

          tempArray.push({
            'Name': element.name,
            'Status': element.productstatus,
            'Subcategory Name': subcategorydata.name,
            'Category Name': categorydata.name,
            'Amount': element.price,
            'Available Quantity': element.availablequantity,
            'Total Sold': element.sellcounter,
            'Product Number': element.productno,
            // 'Expected Days': element.expecteddays,
            'Product Image': element.productmedia[0].__data.productname,
            'QR Code': qrcodeData
          });
        }
      } else {
        var err = new Error("Sorry! Data not Available");
        err.statusCode = 404;
        throw err;
      }

      return tempArray;

    } catch (error) {
      throw error;
    }
  };

  // Import Product Data through Excel
  Product.importProducts = async (req) => {

    var createProduct;
    var tempArray = [];
    var categoryModel = app.models.category;
    var grouppriceModel = app.models.groupprice;

    try {

      // check that the required field names are present
      for (let i = 0; i < req.body.length; i++) {
        const element = req.body[i];
        if ("Name" in element === true && "Subcategory Name" in element === true && "Price" in element === true && "Available Quantity" in element === true && "Description" in element === true) {
          // console.log("true");
        } else {
          throw constants.createError(404, 'Please upload file in proper format');
        }
      }

      if (req.body.length > 0) {

        // check any property is not empty
        req.body.filter((element) => {
          var result = Object.entries(element)
          result.filter((r) => {
            if (r[1] === '' || r[1] === null) {
              throw constants.createError(404, 'Sorry! ' + r[0] + ' Cannot be blank or null in selected file.');
            }
            if (r[0] === 'Price') {
              r[1] = parseInt(r[1])
              if (r[1] <= 0) {
                throw constants.createError(404, 'Sorry, ' + r[0] + ' cannot be minus or less than 0.');
              }
            }
          });
        });

        var getVariationSetting = await getSetting({
          registerallow: constants.PRODUCT_VARIATION_KEY,
          masterdetailId: req.query.where.masterdetailId
        });

        if (getVariationSetting && getVariationSetting.text) {
          getVariationSetting = JSON.parse(getVariationSetting.text);
        } else {
          getVariationSetting = [];
        }

        var getGroupList = await app.models.group.find({
          where: {
            masterdetailId: req.query.where.masterdetailId
          }
        });

        for (var i = 0; i < req.body.length; i++) {
          const element = req.body[i];
          // Get category Name
          var getCat = await categoryModel.findOne({
            where: {
              name: element["Subcategory Name"],
              masterdetailId: req.query.where.masterdetailId
            }
          })
          if (!getCat) {
            throw constants.createError(404, 'Sorry, Subcategory does not exist, Please change or add first.');
          }
          createProduct = await Product.create({
            name: element["Name"],
            productstatus: 1,
            categoryId: getCat.id,
            createdby: req.accessToken.userId,
            userId: req.accessToken.userId,
            price: element["Price"],
            availablequantity: element["Available Quantity"],
            description: element["Description"],
            masterdetailId: req.query.where.masterdetailId,
            variationconfig: getVariationSetting.length > 0 ? JSON.stringify(getVariationSetting) : null,
            created: new Date(),
            modified: new Date(),
            productno: Math.floor(10000 + Math.random() * 90000) + i
          });

          for (let j = 0; j < getGroupList.length; j++) {
            const elementOfGroup = getGroupList[j];

            await grouppriceModel.create({
              newprice: element["Price"],
              price: element["Price"],
              groupId: elementOfGroup.id,
              productId: createProduct.id,
              created: new Date(),
              modified: new Date(),
              masterdetailId: req.query.where.masterdetailId,
              minimumorderquantity: 1
            });

          }


          // Upload image in productmedia
          if (element["Product Image"]) {
            await createProductMedia({
              productname: element["Product Image"],
              productId: createProduct.id,
              created: new Date(),
              modified: new Date(),
              createdby: req.accessToken.userId,
              modifiedby: req.accessToken.userId,
              sequence: 1,
              masterdetailId: req.query.where.masterdetailId
            });
          } else {
            await createProductMedia({
              productname: "noimagefound.png",
              productId: createProduct.id,
              created: new Date(),
              modified: new Date(),
              createdby: req.accessToken.userId,
              modifiedby: req.accessToken.userId,
              masterdetailId: req.query.where.masterdetailId
            });
          }
          // Add Each Product In Array
          tempArray.push(createProduct);
          // increase counter of product in subcaegories
          await categoryModel.updateAll({
            id: createProduct.__data.categoryId,
            masterdetailId: req.query.where.masterdetailId
          }, {
            totalproducts: getCat.__data.totalproducts + 1
          });

        }
        return tempArray;
      } else {
        throw constants.createError(404, 'Sorry! Data not Available.');
      }

    } catch (error) {
      throw error;
    }

  };

  Product.exportpdfqrcode = async (req, res) => {

    var productData;
    var pdfBuffer;
    var qrcodeData;

    try {

      productData = await Product.find({
        where: {
          availablequantity: {
            gt: 0
          },
          productstatus: 1,
          masterdetailId: req.query.where.masterdetailId
        }
      });

      await productData.forEach(element => {
        qrcodeData = {
          id: element.id
        };
        qrcodeData = buffer.from(constants.stringifyJson(qrcodeData)).toString('base64');
        element.qrcodeData = qrcodeData;
      });

      pdfBuffer = await createPDF({
        template: 'pdfdata.ejs',
        dataToRender: {
          productData
        },
        timeout: 1000000
      });

      res.setHeader('Content-Type', 'application/force-download');
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Type', 'application/download');
      res.setHeader('Content-Disposition', 'attachment;filename=Data.pdf');
      res.setHeader('Content-Transfer-Encoding', 'binary');
      res.send(pdfBuffer);

    } catch (error) {
      throw error;
    }

  }

  Product.generaterandomproductno = async (req, res) => {

    var productData;
    var code;
    var dataQuery;

    try {

      dataQuery = "SELECT * FROM `product` where masterdetailId = '" + req.query.masterdetailId + "'";

      productData = await new Promise((resolve, reject) => {
        app.datasources.mysql.connector.execute(dataQuery, null, (err, result) => {
          if (err) reject(err);
          resolve(result);
        });
      });

      code = Math.floor(10000 + Math.random() * 90000);

      for (var i = 0; i < productData.length; i++) {
        const element = productData[i];
        await Product.updateAll({
          id: element.id,
          masterdetailId: req.query.masterdetailId
        }, {
          productno: code + i
        });
      }

      console.log('Productno Generated for all products : ---> ', productData.length);

    } catch (error) {
      throw error;
    }

  }

  Product.exportpdfbarcode = async (req, res) => {

    var productData;
    var pdfBuffer;
    var barcodeData;

    try {

      console.log('😄');

      productData = await Product.find({
        where: {
          availablequantity: {
            gt: 0
          },
          productstatus: 1,
          masterdetailId: req.query.where.masterdetailId
        },
        limit: 1
      });

      await productData.forEach(element => {
        barcodeData = {
          id: element.id
        };
        barcodeData = buffer.from(constants.stringifyJson(barcodeData)).toString('base64');
        element.barcodeData = barcodeData;
      });

      pdfBuffer = await createPDFBarcode({
        template: 'pdfdata_barcode.ejs',
        dataToRender: {
          productData
        },
        timeout: 1000000
      });

      JsBarcode("#barcode", "1234", {
        format: "pharmacode",
        lineColor: "#0aa",
        width: 4,
        height: 40,
        displayValue: false
      });

      res.setHeader('Content-Type', 'application/force-download');
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Type', 'application/download');
      res.setHeader('Content-Disposition', 'attachment;filename=Data.pdf');
      res.setHeader('Content-Transfer-Encoding', 'binary');
      res.send(pdfBuffer);

    } catch (error) {
      throw error;
    }

  }

  Product.importKapasiProducts = async (req) => {

    try {

      var VARIATION_CONFIG = [{
        id: 1, name: "Size"
      }, {
        id: 2, name: "Color"
      }];

      for (let i = 0; i < req.body.productData.length; i++) {
        const element = req.body.productData[i];

        var getInsertedProduct = await Product.create({
          inInquiry: 0,
          sellcounter: 0,
          productstatus: 1,
          name: element.name,
          created: new Date(),
          modified: new Date(),
          categoryId: element.categoryId,
          userId: req.accessToken.userId,
          description: element.description,
          createdby: req.accessToken.userId,
          modifiedby: req.accessToken.userId,
          productvariation: JSON.stringify([]),
          availablequantity: element.availablequantity,
          masterdetailId: req.query.where.masterdetailId,
          productvariation: JSON.stringify(VARIATION_CONFIG),
          productdetails: JSON.stringify(element.productdetails)
        });

        await app.models.productmedia.create({
          created: new Date(),
          modified: new Date(),
          productname: "noimagefound.png",
          productId: getInsertedProduct.id,
          createdby: req.accessToken.userId,
          modifiedby: req.accessToken.userId,
          masterdetailId: req.query.where.masterdetailId
        });

      }

    } catch (error) {
      throw error;
    }

  };

  function createPDFBarcode(options) {

    var renderer = loopback.template(path.resolve(__dirname, '../../server/views/' + options.template));
    var html_body = renderer(options.dataToRender);
    var config = {
      "border": {
        "top": "10px", // default is 0, units: mm, cm, in, px
        "right": "10px",
        "bottom": "10px",
        "left": "10px"
      },
      "format": "A4",
      "timeout": 100000
    }

    return new Promise((resolve, reject) => {
      pdf.create(html_body, config).toBuffer((err, buffer) => {
        if (err) reject(err);
        resolve(buffer);
      });
    });

  };

  function createPDF(options) {

    var renderer = loopback.template(path.resolve(__dirname, '../../server/views/' + options.template));
    var html_body = renderer(options.dataToRender);
    var config = {
      "border": {
        "top": "10px", // default is 0, units: mm, cm, in, px
        "right": "10px",
        "bottom": "10px",
        "left": "10px"
      },
      "format": "A4",
      "timeout": options.timeout
    }

    JsBarcode({
      format: "pharmacode",
      lineColor: "#0aa",
      width: 4,
      height: 40,
      displayValue: false
    });

    return new Promise((resolve, reject) => {
      pdf.create(html_body, config).toBuffer((err, buffer) => {
        if (err) reject(err);
        resolve(buffer);
      });
    });

  };

  function compare(a, b) {
    if (a.pricelable < b.pricelable) {
      return -1;
    }
    if (a.pricelable > b.pricelable) {
      return 1;
    }
    return 0;
  }

  // Create function for Product Media
  async function createProductMedia(params) {
    var productMedia = await app.models.productmedia.create({
      productname: params.productname,
      createdby: params.createdby,
      productId: params.productId,
      masterdetailId: params.masterdetailId
    });
    return productMedia;
  }

  async function getSetting(params) {
    return await app.models.setting.findOne({
      where: {
        registerallow: params.registerallow,
        masterdetailId: params.masterdetailId
      }
    });
  }

};

