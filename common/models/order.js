"use strict";

var fs = require('fs');
var path = require('path');
var jsSHA = require("jssha");
var pdf = require('html-pdf');
var moment = require("moment");
var request = require("request");
var loopback = require('loopback');
var titlecase = require("title-case");
var buffer = require('buffer/').Buffer;
var app = require("../../server/server");
var PaytmChecksum = require("paytmchecksum");
var constants = require("../../common/const");
const settingConstants = require("../setting_constants");

module.exports = function (Order) {
  // Add to cart
  Order.addtocart = async (req) => {
    var userModel = app.models.user;
    var orderModel = app.models.order;
    var productModel = app.models.product;
    var settingModel = app.models.setting;
    var grouppriceModel = app.models.groupprice;
    var orderdetailsModel = app.models.orderdetails;
    var commonCounterModel = app.models.commoncounter;
    var product, orderdetails, commoncounter;
    var expdate = [];
    var productData = [];
    var totalamountData = [];
    var isPincode = false;
    var isFMCGMode = false;
    var isFABRICMode = false;
    var isStockModeOn = false;

    try {

      // Get Open store Setting & set userId
      var getOpenStoreSetting = await getSetting({
        registerallow: constants.SETTING_OPEN_STORE,
        masterdetailId: req.query.where.masterdetailId
      });
      if (getOpenStoreSetting && getOpenStoreSetting.status === 1 && req.headers.openstoreid) {
        req.body.userId = req.headers.openstoreid;
      } else {
        var getRequestedUserDetails = await userModel.findById(req.accessToken.userId);
        // Set userId
        if (getRequestedUserDetails.roleId === constants.USER_ROLEID || getRequestedUserDetails.roleId === constants.GUEST_ROLEID) {
          req.body.userId = req.accessToken.userId;
        }
      }

      // Check StockMode Setting
      var getStockMode = await settingModel.findOne({
        where: {
          registerallow: constants.IS_STOCK_KEY,
          masterdetailId: req.body.masterdetailId
        }
      });
      if (getStockMode && getStockMode.status === 1) {
        isStockModeOn = true;
      }

      // Check FMCGMode Setting
      var getFmCGData = await settingModel.findOne({
        where: {
          registerallow: constants.CATALOGUE_FMCG_LABLE,
          masterdetailId: req.body.masterdetailId
        }
      });
      if (getFmCGData && getFmCGData.status === 1) {
        isFMCGMode = true;
      }

      // Check FABRIC Mode Setting
      var getFABRICData = await settingModel.findOne({
        where: {
          registerallow: constants.CATALOGUE_FABRIC_LABLE,
          masterdetailId: req.body.masterdetailId
        }
      });
      if (getFABRICData && getFABRICData.status === 1) {
        isFABRICMode = true;
      }

      // check product mode add to cart or inquiry
      var settingDetail = await settingModel.findOne({
        where: {
          registerallow: constants.IS_INQUIRY_LABLE,
          masterdetailId: req.body.masterdetailId
        }
      });

      if (!req.body.orderId) {
        // When Add to cart mode is Active
        if (settingDetail.status === 0 && req.body.inshoppingcart != 1 && req.body.inshoppingcart != 3) {
          throw constants.createError(400, 'This product is in add to cart mode. Please refresh the page');
        }
        // When Inquiry mode is Active
        if (settingDetail.status === 1 && req.body.inshoppingcart != 2 && req.body.inshoppingcart != 3) {
          throw constants.createError(400, 'This product is in inquiry mode. Please refresh the page');
        }
      }

      // check that same user have the cart
      var shoppingcart = await orderModel.findOne({
        where: {
          userId: req.body.userId,
          inshoppingcart: 1,
          masterdetailId: req.body.masterdetailId
        },
        include: "orderdetails"
      });

      // when inshopping cart is 1 and orderdetails is 0 then delete order
      if (shoppingcart) {
        var orderdetailsDatacounter = await orderdetailsModel.findOne({
          where: {
            orderId: shoppingcart.id,
            masterdetailId: req.body.masterdetailId
          }
        });
        if (orderdetailsDatacounter <= 0) {
          await orderModel.updateAll({
            id: shoppingcart.id
          }, {
            deletedAt: new Date()
          });
        }
      }

      // product already exist in cart
      if (shoppingcart && shoppingcart.inshoppingcart === 1 && req.body.inshoppingcart === 1) {
        //check the product is there or not
        for (let i = 0; i < req.body.orderdetails.length; i++) {

          product = await productModel.findOne({
            where: {
              id: req.body.orderdetails[i].productId,
              masterdetailId: req.body.masterdetailId
            }
          });

          // check prodct is exist in system or not
          if (!product) {
            throw constants.createError(400, 'The product is not exists in the system');
          }

          // check that product is available or not
          if (isStockModeOn) {
            if (product.availablequantity <= 0) {
              throw constants.createError(400, 'Sorry! Product is out of stock');
            }
            // Check quantity against product quantity
            if (product.availablequantity < req.body.orderdetails[i].quantity) {
              throw constants.createError(400, 'Sorry! Product is not availble as per given quantity');
            }
            // Check variation exist in Product
            if (req.body.orderdetails[i].variation && product && product.productvariation) {
              var getProductVariations = JSON.parse(product.productvariation);
              if (getProductVariations.length > 0) {
                var getMatchVarivation = await checkVariationQuantity(getProductVariations, req.body.orderdetails[i].variation.variation);
                // Requested variation quantity exists?
                if (getMatchVarivation.variation.quantity && getMatchVarivation.variation.quantity <= 0) {
                  throw constants.createError(400, 'Sorry, This variation is out of stock');
                }
                // Check requested quantity against variation quantity
                if (getMatchVarivation.variation.quantity < req.body.orderdetails[i].quantity) {
                  throw constants.createError(400, 'Sorry! Variation not availble as per requested quantity');
                }
              }
            }
          }

          /**
           * check user in which group
           * check different price is available or not for product and
           * minimum order quantity check
           */
          var userDetail = await userModel.findOne({
            where: {
              id: req.body.userId
            }
          });

          var groupPrice = await grouppriceModel.findOne({
            where: {
              groupId: userDetail.groupId,
              productId: req.body.orderdetails[i].productId,
              masterdetailId: req.body.masterdetailId
            }
          });

          if (groupPrice) {
            product.price = groupPrice.newprice;
            if (groupPrice.minimumorderquantity != null) {
              if (groupPrice.minimumorderquantity > req.body.orderdetails[i].quantity) {
                throw constants.createError(400, 'Minimum order quantity for ' + product.name + ' is ' + groupPrice.minimumorderquantity);
              }
            }
          }

          // orderdetails data of one order
          var orderdertailsData;

          if (req.body.orderdetails[i].variation) {
            orderdertailsData = await orderdetailsModel.find({
              where: {
                productId: product.id,
                orderId: shoppingcart.id,
                masterdetailId: req.body.masterdetailId
              }
            });

            if (orderdertailsData.length > 0) {
              let isOperationDone = false;
              for (let j = 0; j < orderdertailsData.length; j++) {
                const element = orderdertailsData[j];
                var parseJson = JSON.parse(element.variation);
                var isMatch = 0;
                for (let m = 0; m < parseJson.variation.length; m++) {
                  if (element.variation) {
                    const elementJKey = parseJson.variation[m].key;
                    const elementJValue = parseJson.variation[m].value;
                    for (let k = 0; k < req.body.orderdetails[i].variation.variation.length; k++) {
                      const elementKKey = req.body.orderdetails[i].variation.variation[k].key;
                      const elementKValue = req.body.orderdetails[i].variation.variation[k].value;
                      if (elementJKey === elementKKey && elementJValue === elementKValue) {
                        isMatch++;
                        break;
                      }
                    }
                    if (m === parseJson.variation.length - 1) {
                      if (isMatch === parseJson.variation.length) {
                        isOperationDone = true;
                        orderdetails = await orderdetailsModel.updateAll({
                          id: orderdertailsData[j].id,
                          orderId: shoppingcart.id,
                          productId: req.body.orderdetails[i].productId,
                          masterdetailId: req.body.masterdetailId
                        }, {
                          quantity: orderdertailsData[j].quantity + req.body.orderdetails[i].quantity,
                        });
                        break;
                      }
                    }
                  }
                }
                if (!isOperationDone && j === orderdertailsData.length - 1) {
                  // create orderdetails
                  orderdetails = await orderdetailsModel.create({
                    quantity: req.body.orderdetails[i].quantity,
                    amount: parseFloat(req.body.orderdetails[i].variation.price),
                    orderId: shoppingcart.id,
                    createdby: shoppingcart.userId,
                    productId: req.body.orderdetails[i].productId,
                    variation: JSON.stringify(req.body.orderdetails[i].variation),
                    masterdetailId: req.body.masterdetailId
                  });
                  commoncounter = await commonCounterModel.findOne({
                    where: {
                      userId: req.body.userId,
                      masterdetailId: req.body.masterdetailId
                    }
                  });
                  commonCounterModel.updateCounters(shoppingcart.userId, "+", 1, "cart", req.baseUrl);
                }
              }
            } else {
              // create orderdetails
              orderdetails = await orderdetailsModel.create({
                quantity: req.body.orderdetails[i].quantity,
                amount: parseFloat(req.body.orderdetails[i].variation.price),
                orderId: shoppingcart.id,
                createdby: shoppingcart.userId,
                productId: req.body.orderdetails[i].productId,
                variation: JSON.stringify(req.body.orderdetails[i].variation),
                masterdetailId: req.body.masterdetailId
              });
              commoncounter = await commonCounterModel.findOne({
                where: {
                  userId: req.body.userId,
                  masterdetailId: req.body.masterdetailId
                }
              });
              commonCounterModel.updateCounters(shoppingcart.userId, "+", 1, "cart", req.baseUrl);
            }
          } else {
            orderdertailsData = await orderdetailsModel.findOne({
              where: {
                productId: product.id,
                orderId: shoppingcart.id,
                masterdetailId: req.body.masterdetailId
              }
            });
            if (orderdertailsData) {
              orderdetails = await orderdetailsModel.updateAll({
                id: orderdertailsData.id,
                orderId: orderdertailsData.orderId,
                productId: product.id,
                masterdetailId: req.body.masterdetailId
              }, {
                quantity: orderdertailsData.quantity + req.body.orderdetails[i].quantity,
              });
            } else {
              orderdetails = await orderdetailsModel.create({
                quantity: req.body.orderdetails[i].quantity,
                amount: product.price,
                orderId: shoppingcart.id,
                createdby: shoppingcart.userId,
                productId: req.body.orderdetails[i].productId,
                masterdetailId: req.body.masterdetailId
              });
              commoncounter = await commonCounterModel.findOne({
                where: {
                  userId: req.body.userId,
                  masterdetailId: req.body.masterdetailId
                }
              });
              commonCounterModel.updateCounters(shoppingcart.userId, "+", 1, "cart", req.baseUrl);
            }
          }

          // find order details
          var allorderdetails = await orderdetailsModel.find({
            where: {
              orderId: shoppingcart.id,
              masterdetailId: req.body.masterdetailId
            }
          });

          if (allorderdetails.length != 0) {
            var curentproduct = product.expecteddays;

            for (let j = 0; j < allorderdetails.length; j++) {
              var productt = await productModel.findOne({
                where: {
                  id: allorderdetails[j].productId,
                  masterdetailId: req.body.masterdetailId
                },
                deleted: true
              });
              expdate.push(curentproduct);
              expdate.push(productt.expecteddays);
            }
            expdate.sort(function (a, b) {
              return b - a;
            });
            req.body.expecteddelivery = expdate[0];
          }

          // Calculate Here Shipping Price / Base Price & Total Amount

          // update order total items
          await Order.updateAll({
            userId: req.body.userId,
            inshoppingcart: true,
            masterdetailId: req.body.masterdetailId
          }, {
            totalitems: shoppingcart.totalitems + req.body.orderdetails.length
          });

          // order amount
          productData.push(orderdetails);
          shoppingcart.orderdetail = productData;

          // product reduce from available quantity
          // here in orderAmount the key value is productid and the value is amount
          if (isStockModeOn) {
            if (req.body.orderdetails[i].variation) {
              var productVariation = JSON.parse(product.productvariation);
              var getMatchVarivation = await checkVariationQuantity(productVariation, req.body.orderdetails[i].variation.variation);
              getMatchVarivation.variation.quantity = getMatchVarivation.variation.quantity - req.body.orderdetails[i].quantity;
              productVariation[getMatchVarivation.index] = getMatchVarivation.variation;
              await productModel.updateAll({
                id: product.id
              }, {
                availablequantity: product.availablequantity - req.body.orderdetails[i].quantity,
                productvariation: JSON.stringify(productVariation)
              });
            } else {
              await productModel.updateAll({
                id: product.id
              }, {
                availablequantity: product.availablequantity - req.body.orderdetails[i].quantity
              });
            }
          }
        }

        // generate random number for order
        req.body.orderno = "BB0" + (Math.floor(Math.random() * 900000000000) + 100000000000);

        var currentDate = moment(new Date()).format("DD/MM/YYYY");
        var new_date = moment(currentDate, "DD/MM/YYYY").add(req.body.expecteddelivery, "days");
        req.body.deliverydate = new_date._d;
        shoppingcart.deliverydate = new_date._d;
        shoppingcart.createdby = shoppingcart.userId;

        return shoppingcart;

      } else {

        // get user's data
        var userDate = await userModel.findOne({
          where: {
            id: req.accessToken.userId,
            masterdetailId: req.body.masterdetailId
          }
        });

        // check PINCODE DELIVERY is active or not.
        var getPincodeDelivery = await constants.commonFindOneFunction({
          model: app.models.setting,
          whereObj: {
            registerallow: constants.SETTING_PINCODE_DELIVERY,
            masterdetailId: req.body.masterdetailId
          }
        });

        if (getPincodeDelivery && getPincodeDelivery.status === 1) {
          var pincodeData = JSON.parse(getPincodeDelivery.text);

          if (req.body.shippingaddress && req.body.shippingaddress.zipcode) {
            pincodeData.find(obj => {
              if (obj.pincode == req.body.shippingaddress.zipcode) {
                return req.body.shippingprice = obj.charges;
              }
            });
          } else if (userDate.shippingaddress) {
            var shippingAddress = JSON.parse(userDate.shippingaddress);
            for (let i = 0; i < pincodeData.length; i++) {
              const element = pincodeData[i];
              if (element.pincode == shippingAddress.zipcode) {
                req.body.shippingprice = element.charges;
                break;
              }
            }
          }
        }

        // first product in cart
        req.body.orderno = "BB0" + (Math.floor(Math.random() * 900000000000) + 100000000000);

        //check the product is there or not
        for (let i = 0; i < req.body.orderdetails.length; i++) {
          product = await productModel.findOne({
            where: {
              id: req.body.orderdetails[i].productId
            }
          });

          if (!product) {
            throw constants.createError(400, 'The Product is not exists in the system');
          }

          if (isStockModeOn) {
            // check that product is available or not
            if (product.availablequantity <= 0) {
              throw constants.createError(400, 'Sorry! Product is out of stock');
            }
            // check against quantity and total stoke
            if (product.availablequantity < req.body.orderdetails[i].quantity) {
              throw constants.createError(400, 'Sorry! Product is not availble as per given quantity');
            }
            // Check variation exist in Product
            if (req.body.orderdetails[i].variation && product && product.productvariation) {
              var getProductVariations = JSON.parse(product.productvariation);
              if (getProductVariations.length > 0) {
                var getMatchVarivation = await checkVariationQuantity(getProductVariations, req.body.orderdetails[i].variation.variation);
                // Requested variation quantity exists?
                if (getMatchVarivation.variation.quantity && getMatchVarivation.variation.quantity <= 0) {
                  throw constants.createError(400, 'Sorry, This variation is out of stock');
                }
                // Check requested quantity against variation quantity
                if (getMatchVarivation.variation.quantity < req.body.orderdetails[i].quantity) {
                  throw constants.createError(400, 'Sorry! Variation not availble as per requested quantity');
                }
              }
            }
          }

          /**
           * check user in which group
           * check different price is available or not for product and
           * minimum order quantity check
           */

          var userDetail = await userModel.findOne({
            where: {
              id: req.body.userId
            }
          });

          if (userDetail) {
            var groupPrice = await grouppriceModel.findOne({
              where: {
                groupId: userDetail.groupId,
                productId: req.body.orderdetails[i].productId,
                masterdetailId: req.body.masterdetailId
              }
            });
            if (groupPrice) {
              product.price = groupPrice.newprice;
              if (groupPrice.minimumorderquantity != null) {
                if (groupPrice.minimumorderquantity > req.body.orderdetails[i].quantity) {
                  throw constants.createError(400, "Minimum order quantity for " + product.name + " is " + groupPrice.minimumorderquantity);
                }
              }
            }
          }

          // totalamount
          if (req.body.orderId) {
            if (req.body.orderdetails[i].variation) {
              totalamountData.push(req.body.orderdetails[i].quantity * req.body.orderdetails[i].variation.price);
            } else {
              totalamountData.push(req.body.orderdetails[i].quantity * product.price);
            }
          }

          // if orderstatus cancelled or rejected pass then
          if (
            req.body.orderstatus === await constants.ORDER_COMFIRMED(req.body.masterdetailId) ||
            req.body.orderstatus === await constants.ORDER_DELIVERED(req.body.masterdetailId) ||
            req.body.orderstatus === await constants.ORDER_CANCELLED(req.body.masterdetailId) ||
            req.body.orderstatus === await constants.ORDER_REJECTED(req.body.masterdetailId)
          ) {
            throw constants.createError(400, 'Order Fail!');
          }

          if (req.body.orderstatus) {
            // Get Pendinng Order Status Tenant Wise
            req.body.orderstatus = await constants.ORDER_PENDING(req.body.masterdetailId);
          }

          // expected delivery
          if (req.body.orderdetails.length === 1) {
            req.body.expecteddelivery = product.expecteddays;
          } else {
            // find product detail
            product = await productModel.findOne({
              where: {
                id: req.body.orderdetails[i].productId
              }
            });

            expdate.push(product.expecteddays);
            expdate.sort(function (a, b) {
              return b - a;
            });
            req.body.expecteddelivery = expdate[0];
          }
        }

        if (req.body.orderId) {
          req.body.totalamount = totalamountData.reduce(getSum);
        }

        var currentDate = moment(new Date()).format("DD/MM/YYYY");
        var new_date = moment(currentDate, "DD/MM/YYYY").add(req.body.expecteddelivery, "days");
        req.body.deliverydate = new_date._d;

        var commoncounter = await commonCounterModel.findOne({
          where: {
            userId: req.body.userId,
            masterdetailId: req.body.masterdetailId
          }
        });

        if (!req.body.orderId) {
          if (commoncounter) {
            req.body.cartCounter = commoncounter.cart + req.body.orderdetails.length;
            if (req.body.inshoppingcart != 2) {
              // in inquiry mode
              commonCounterModel.updateCounters(req.body.userId, "+", req.body.orderdetails.length, "cart", req.baseUrl);
            }
          }
        }
      }

      // find username
      var user = await userModel.findOne({
        where: {
          id: req.body.userId
        }
      });

      user.username ? user.username : user.companyname;

      // create order table entry
      await Order.create({
        orderno: req.body.orderno,
        // expecteddelivery: req.body.expecteddelivery,
        orderstatus: req.body.orderstatus,
        totalamount: req.body.totalamount,
        inshoppingcart: req.body.inshoppingcart,
        deliverydate: req.body.deliverydate,
        createdby: req.body.userId,
        date: req.body.date,
        customername: user.username ? titlecase.titleCase(user.username) : null,
        totalitems: req.body.orderdetails.length,
        additionalcharge: req.body.additionalcharge,
        additionalchargedetails: (req.body.additionalchargedetails) ? JSON.stringify(req.body.additionalchargedetails) : null,
        userId: req.body.userId,
        cityId: user.cityId,
        created: new Date(),
        modified: new Date(),
        shippingprice: req.body.shippingprice,
        masterdetailId: req.body.masterdetailId
      });

      // find order
      var finalOrder = await Order.findOne({
        where: {
          orderno: req.body.orderno,
          masterdetailId: req.body.masterdetailId
        }
      });

      if (req.body.orderdetails && req.body.inshoppingcart === 1) {
        // loop through the array of orderdetails and save each product
        for (let i = 0; i < req.body.orderdetails.length; i++) {
          var product = await productModel.findOne({
            where: {
              id: req.body.orderdetails[i].productId
            }
          });

          if (req.body.orderdetails[i].variation) {
            var productVariation = JSON.parse(product.productvariation);
            var getMatchVarivation = await checkVariationQuantity(productVariation, req.body.orderdetails[i].variation.variation);
            if (getMatchVarivation && getMatchVarivation.variation && getMatchVarivation.variation.groupVariationPrice && getMatchVarivation.variation.groupVariationPrice.length > 0) {
              var getGroupPrice = getMatchVarivation.variation.groupVariationPrice.find(item => item.group_id === userDetail.groupId);
              if (getGroupPrice) {
                req.body.orderdetails[i].variation.price = getGroupPrice.groupprice;
                product.price = getGroupPrice.groupprice;
              }
            }
          } else {
            // Find Group Price
            var groupPrice = await grouppriceModel.findOne({
              where: {
                groupId: userDetail.groupId,
                productId: req.body.orderdetails[i].productId,
                masterdetailId: req.body.masterdetailId
              }
            });
            // If groupprice Exist then set new price
            if (groupPrice) {
              product.price = groupPrice.newprice;
              if (groupPrice.minimumorderquantity != null) {
                if (groupPrice.minimumorderquantity > req.body.orderdetails[i].quantity) {
                  throw constants.createError(400, "Minimum order quantity for " + product.name + " is " + groupPrice.minimumorderquantity);
                }
              }
            }
          }

          //when product is inquiry
          if (product.inInquiry === false) {
            if (req.body.orderdetails[i].variation) {
              orderdetails = await orderdetailsModel.create({
                quantity: req.body.orderdetails[i].quantity,
                amount: parseFloat(req.body.orderdetails[i].variation.price),
                orderId: finalOrder.id,
                createdby: finalOrder.userId,
                productId: req.body.orderdetails[i].productId,
                variation: JSON.stringify(req.body.orderdetails[i].variation),
                masterdetailId: req.body.masterdetailId
              });
            } else {
              orderdetails = await orderdetailsModel.create({
                quantity: req.body.orderdetails[i].quantity,
                amount: product.price,
                orderId: finalOrder.id,
                createdby: finalOrder.userId,
                productId: req.body.orderdetails[i].productId,
                masterdetailId: req.body.masterdetailId
              });
            }

            if (finalOrder.inshoppingcart === 1) {
              var orderdertailsData = await orderdetailsModel.find({
                where: {
                  orderId: finalOrder.id,
                  productId: product.id,
                  masterdetailId: req.body.masterdetailId
                }
              });

              var commoncounter = await commonCounterModel.findOne({
                where: {
                  userId: finalOrder.userId
                }
              });

              if (!orderdertailsData) {
                finalOrder.cartCounter = commoncounter.cart + req.body.orderdetails.length;
                commonCounterModel.updateCounters(finalOrder.userId, "+", req.body.orderdetails.length, "cart", req.baseUrl);
              }
            }
          } else {
            if (req.body.orderdetails[i].variation) {
              orderdetails = await orderdetailsModel.create({
                quantity: req.body.orderdetails[i].quantity,
                amount: parseFloat(req.body.orderdetails[i].variation.price),
                orderId: finalOrder.id,
                createdby: finalOrder.userId,
                productId: req.body.orderdetails[i].productId,
                variation: JSON.stringify(req.body.orderdetails[i].variation),
                masterdetailId: req.body.masterdetailId
              });
            } else {
              orderdetails = await orderdetailsModel.create({
                quantity: req.body.orderdetails[i].quantity,
                amount: product.price,
                orderId: finalOrder.id,
                createdby: finalOrder.userId,
                productId: req.body.orderdetails[i].productId,
                masterdetailId: req.body.masterdetailId
              });
            }
          }

          // product reduce from available quantity
          // here in orderAmount the key value is productid and the value is amount
          if (isStockModeOn) {
            if (req.body.orderdetails[i].variation) {
              var productVariation = JSON.parse(product.productvariation);
              var getMatchVarivation = await checkVariationQuantity(productVariation, req.body.orderdetails[i].variation.variation);
              getMatchVarivation.variation.quantity = getMatchVarivation.variation.quantity - req.body.orderdetails[i].quantity;
              productVariation[getMatchVarivation.index] = getMatchVarivation.variation;
              await productModel.updateAll({
                id: product.id
              }, {
                availablequantity: product.availablequantity - req.body.orderdetails[i].quantity,
                productvariation: JSON.stringify(productVariation)
              });
            } else {
              await productModel.updateAll({
                id: product.id
              }, {
                availablequantity: product.availablequantity - req.body.orderdetails[i].quantity
              });
            }
          }
          productData.push(product);
        }
        finalOrder.product = productData;
      }
      return finalOrder;
    } catch (error) {
      throw error;
    }
  };

  // product inquiry
  Order.productInquiry = async (req) => {

    var productModel = app.models.product;
    var orderdetailsModel = app.models.orderdetails;
    var commonCounterModel = app.models.commoncounter;
    var settingModel = app.models.setting;
    var userModel = app.models.user;
    var notifyModel = app.models.notify;
    var grouppriceModel = app.models.groupprice;

    var shoppingcart;
    var product, orderdetailsdata, commoncounter, expdate = [],
      username;
    var isStockModeOn = false;
    var productData = [];
    req.body.userId = req.accessToken.userId;
    var orderdetails;

    try {
      // check stock mode is active or not
      var getStockMode = await settingModel.findOne({
        where: {
          registerallow: constants.IS_STOCK_KEY,
          masterdetailId: req.body.masterdetailId
        }
      });
      if (getStockMode && getStockMode.status === 1) {
        isStockModeOn = true;
      }

      // generate random number for order
      req.body.orderno = "BB0" + (Math.floor(Math.random() * 900000000000) + 100000000000);

      //check the product is there or not
      for (let i = 0; i < req.body.orderdetails.length; i++) {
        // const element = array[i];
        product = await productModel.findOne({
          where: {
            id: req.body.orderdetails[i].productId,
            masterdetailId: req.body.masterdetailId
          }
        });

        if (!product) {
          throw constants.createError(400, 'The Product is not exists in the system!');
        }
        // check that product is available or not
        if (isStockModeOn) {
          if (product.availablequantity <= 0) {
            throw constants.createError(400, 'Sorry! Product is out of stock.');
          }
        }

        // if orderstatus cancelled or rejected pass then
        if (
          req.body.orderstatus === await constants.ORDER_COMFIRMED(req.body.masterdetailId) ||
          req.body.orderstatus === await constants.ORDER_DELIVERED(req.body.masterdetailId) ||
          req.body.orderstatus === await constants.ORDER_CANCELLED(req.body.masterdetailId) ||
          req.body.orderstatus === await constants.ORDER_REJECTED(req.body.masterdetailId)) {
          throw constants.createError(400, 'Order Fail!');
        }

      }

      var currentDate = moment(new Date()).format("DD/MM/YYYY");
      var new_date = moment(currentDate, "DD/MM/YYYY").add(req.body.expecteddelivery, "days");
      req.body.deliverydate = new_date._d;

      shoppingcart = await Order.findOne({
        where: {
          userId: req.body.userId,
          inshoppingcart: 1,
          masterdetailId: req.body.masterdetailId
        },
        include: "orderdetails"
      });

      // when inshopping cart is 1 and orderdetails is 0 then delete order
      if (shoppingcart) {
        var orderdetailsDatacounter = await orderdetailsModel.findOne({
          where: {
            orderId: shoppingcart.id,
            masterdetailId: req.body.masterdetailId
          }
        });

        if (orderdetailsDatacounter <= 0) {
          await orderModel.updateAll({
            id: shoppingcart.id
          }, {
            deletedAt: new Date()
          });
        }
      }

      // product already exist in cart
      if (shoppingcart && shoppingcart.inshoppingcart === 1 && req.body.inshoppingcart === 1) {
        //check the product is there or not
        for (let i = 0; i < req.body.orderdetails.length; i++) {
          product = await productModel.findOne({
            where: {
              id: req.body.orderdetails[i].productId,
              masterdetailId: req.body.masterdetailId
            }
          });

          // check prodct is exist in system or not
          if (!product) {
            throw constants.createError(400, 'The product is not exists in the system');
          }

          // check that product is available or not
          if (isStockModeOn === true) {
            if (product.availablequantity <= 0) {
              throw constants.createError(400, 'Sorry! Product is out of stock');
            }
            // check against quantity and total stoke
            if (product.availablequantity < req.body.orderdetails[i].quantity) {
              throw constants.createError(400, 'Sorry! Product is not availble as per given quantity');
            }
          }

          /**
           * check user in which group
           * check different price is available or not for product and
           * minimum order quantity check
           */
          var userDetail = await userModel.findOne({
            where: {
              id: req.body.userId
            }
          });

          var groupPrice = await grouppriceModel.findOne({
            where: {
              groupId: userDetail.groupId,
              productId: req.body.orderdetails[i].productId,
              masterdetailId: req.body.masterdetailId
            }
          });

          if (groupPrice) {
            product.price = groupPrice.newprice;
            if (groupPrice.minimumorderquantity != null) {
              if (groupPrice.minimumorderquantity > req.body.orderdetails[i].quantity) {
                throw constants.createError(400, 'Minimum order quantity for ' + product.name + ' is ' + groupPrice.minimumorderquantity);
              }
            }
          }

          // orderdetails data of one order
          var orderdertailsData;

          if (req.body.orderdetails[i].variation) {
            orderdertailsData = await orderdetailsModel.find({
              where: {
                productId: product.id,
                orderId: shoppingcart.id,
                masterdetailId: req.body.masterdetailId
              }
            });

            if (orderdertailsData.length > 0) {
              let isOperationDone = false;
              for (let j = 0; j < orderdertailsData.length; j++) {
                const element = orderdertailsData[j];
                let parseJson = JSON.parse(element.variation);
                let isMatch = 0;
                for (let m = 0; m < parseJson.variation.length; m++) {
                  if (element.variation) {
                    const elementJKey = parseJson.variation[m].key;
                    const elementJValue = parseJson.variation[m].value;
                    for (let k = 0; k < req.body.orderdetails[i].variation.variation.length; k++) {
                      const elementKKey = req.body.orderdetails[i].variation.variation[k].key;
                      const elementKValue = req.body.orderdetails[i].variation.variation[k].value;
                      if (elementJKey === elementKKey && elementJValue === elementKValue) {
                        isMatch++;
                        break;
                      }
                    }
                    if (m === parseJson.variation.length - 1) {
                      if (isMatch === parseJson.variation.length) {
                        isOperationDone = true;
                        orderdetails = await orderdetailsModel.updateAll({
                          id: orderdertailsData[j].id,
                          orderId: shoppingcart.id,
                          productId: req.body.orderdetails[i].productId,
                          masterdetailId: req.body.masterdetailId
                        }, {
                          quantity: orderdertailsData[j].quantity + req.body.orderdetails[i].quantity,
                        });
                        break;
                      }
                    }
                  }
                }
                if (!isOperationDone && j === orderdertailsData.length - 1) {
                  // create orderdetails
                  orderdetails = await orderdetailsModel.create({
                    quantity: req.body.orderdetails[i].quantity,
                    amount: parseFloat(req.body.orderdetails[i].variation.price),
                    orderId: shoppingcart.id,
                    createdby: shoppingcart.userId,
                    productId: req.body.orderdetails[i].productId,
                    variation: JSON.stringify(req.body.orderdetails[i].variation),
                    masterdetailId: req.body.masterdetailId
                  });
                  commoncounter = await commonCounterModel.findOne({
                    where: {
                      userId: req.body.userId,
                      masterdetailId: req.body.masterdetailId
                    },
                  });
                  commonCounterModel.updateCounters(shoppingcart.userId, "+", 1, "cart", req.baseUrl);
                }
              }
            } else {
              // create orderdetails
              orderdetails = await orderdetailsModel.create({
                quantity: req.body.orderdetails[i].quantity,
                amount: parseFloat(req.body.orderdetails[i].variation.price),
                orderId: shoppingcart.id,
                createdby: shoppingcart.userId,
                productId: req.body.orderdetails[i].productId,
                variation: JSON.stringify(req.body.orderdetails[i].variation),
                masterdetailId: req.body.masterdetailId
              });
              commoncounter = await commonCounterModel.findOne({
                where: {
                  userId: req.body.userId,
                  masterdetailId: req.body.masterdetailId
                }
              });
              commonCounterModel.updateCounters(shoppingcart.userId, "+", 1, "cart", req.baseUrl);
            }
          } else {
            orderdertailsData = await orderdetailsModel.findOne({
              where: {
                productId: product.id,
                orderId: shoppingcart.id,
                masterdetailId: req.body.masterdetailId
              }
            });
            if (orderdertailsData) {
              orderdetails = await orderdetailsModel.updateAll({
                id: orderdertailsData.id,
                orderId: orderdertailsData.orderId,
                productId: product.id,
                masterdetailId: req.body.masterdetailId
              }, {
                quantity: orderdertailsData.quantity + req.body.orderdetails[i].quantity,
              });
            } else {
              orderdetails = await orderdetailsModel.create({
                quantity: req.body.orderdetails[i].quantity,
                amount: product.price,
                orderId: shoppingcart.id,
                createdby: shoppingcart.userId,
                productId: req.body.orderdetails[i].productId,
                masterdetailId: req.body.masterdetailId
              });
              commoncounter = await commonCounterModel.findOne({
                where: {
                  userId: req.body.userId,
                  masterdetailId: req.body.masterdetailId
                }
              });
              commonCounterModel.updateCounters(shoppingcart.userId, "+", 1, "cart", req.baseUrl);
            }
          }

          // find order details
          var allorderdetails = await orderdetailsModel.find({
            where: {
              orderId: shoppingcart.id,
              masterdetailId: req.body.masterdetailId
            }
          });

          if (allorderdetails.length != 0) {
            var curentproduct = product.expecteddays;

            for (let j = 0; j < allorderdetails.length; j++) {
              var productt = await productModel.findOne({
                where: {
                  id: allorderdetails[j].productId,
                  masterdetailId: req.body.masterdetailId
                },
                deleted: true
              });
              expdate.push(curentproduct);
              expdate.push(productt.expecteddays);
            }
            expdate.sort(function (a, b) {
              return b - a;
            });
            req.body.expecteddelivery = expdate[0];
          }

          // Calculate Here Shipping Price / Base Price & Total Amount

          // update order total items
          await Order.updateAll({
            userId: req.body.userId,
            inshoppingcart: true,
            masterdetailId: req.body.masterdetailId
          }, {
            totalitems: shoppingcart.totalitems + req.body.orderdetails.length
          });

          // order amount
          productData.push(orderdetails);
          shoppingcart.orderdetail = productData;

          // product reduce from available quantity
          // here in orderAmount the key value is productid and the value is amount
          if (isStockModeOn === true) {
            await productModel.updateAll({
              id: product.id
            }, {
              availablequantity: product.availablequantity - req.body.orderdetails[i].quantity
            });
          }
        }

        // generate random number for order
        req.body.orderno = "BB0" + (Math.floor(Math.random() * 900000000000) + 100000000000);

        var currentDate = moment(new Date()).format("DD/MM/YYYY");
        var new_date = moment(currentDate, "DD/MM/YYYY").add(req.body.expecteddelivery, "days");
        req.body.deliverydate = new_date._d;
        shoppingcart.deliverydate = new_date._d;
        shoppingcart.createdby = shoppingcart.userId;

        return shoppingcart;

      } else {

        var commoncounter = await commonCounterModel.findOne({
          where: {
            userId: req.body.userId,
            masterdetailId: req.body.masterdetailId
          }
        });

        if (!req.body.orderId) {
          req.body.cartCounter = commoncounter.cart + req.body.orderdetails.length;
        }

        commonCounterModel.updateCounters(req.body.userId, "+", req.body.cartCounter, "cart", req.baseUrl);

        // find username
        var user = await userModel.findOne({
          where: {
            id: req.body.userId,
            masterdetailId: req.body.masterdetailId
          }
        });
        user.username ? user.username : user.companyname;

        // product inquiry
        await Order.create({
          orderno: req.body.orderno,
          // expecteddelivery: req.body.expecteddelivery,
          orderstatus: req.body.orderstatus,
          totalamount: req.body.totalamount,
          inshoppingcart: req.body.inshoppingcart,
          // deliverydate: req.body.deliverydate,
          createdby: req.body.userId,
          date: req.body.date,
          customername: user.username ? titlecase.titleCase(user.username) : null,
          userId: req.body.userId,
          cityId: user.cityId,
          created: new Date(),
          modified: new Date(),
          masterdetailId: req.body.masterdetailId
        });

        // find order
        var finalOrder = await Order.findOne({
          where: {
            orderno: req.body.orderno,
            masterdetailId: req.body.masterdetailId
          }
        });

        for (let i = 0; i < req.body.orderdetails.length; i++) {
          var product = await productModel.findOne({
            where: {
              id: req.body.orderdetails[i].productId,
              masterdetailId: req.body.masterdetailId
            }
          });

          if (req.body.orderdetails[i].variation) {

            // create orderdetails
            await orderdetailsModel.create({
              quantity: req.body.orderdetails[i].quantity,
              orderId: finalOrder.id,
              createdby: finalOrder.userId,
              productId: req.body.orderdetails[i].productId,
              variation: JSON.stringify(req.body.orderdetails[i].variation),
              masterdetailId: req.body.masterdetailId
            });

            productData.push(product);
          }

          if (req.body.orderdetails && !req.body.orderdetails[i].variation) {
            await orderdetailsModel.create({
              // amount: finalOrder.totalamount,
              orderId: finalOrder.id,
              createdby: finalOrder.userId,
              productId: req.body.orderdetails[i].productId,
              quantity: req.body.orderdetails[i].quantity,
              masterdetailId: req.body.masterdetailId
            });
            productData.push(product);
          }

        }

        var orderdetailsdata = await orderdetailsModel.find({
          where: {
            orderId: finalOrder.id,
            masterdetailId: req.body.masterdetailId
          }
        });
        finalOrder.orderdetailsData = orderdetailsdata;
        finalOrder.product = productData;

        await Order.updateAll({
          id: finalOrder.id,
          inshoppingcart: true,
          masterdetailId: req.body.masterdetailId
        }, {
          totalitems: req.body.orderdetails.length
        });
        finalOrder.totalitems = req.body.orderdetails.length;

        // product = await productModel.findOne({
        //   where: {
        //     id: req.body.orderdetails[0].productId,
        //     masterdetailId: req.body.masterdetailId
        //   },
        // });
        // product.userId = req.body.userId;
        // product.tenant = req.baseUrl;
        // notifyModel.share("ORDER/SAMPLEREQUEST", product, { masterdetailId: req.body.masterdetailId });

        return finalOrder;
      }

    } catch (error) {
      throw error;
    }
  };

  // request product
  Order.requestProduct = async (req) => {
    var userModel = app.models.user;
    var productmediaModel = app.models.productmedia;
    req.body.userId = req.accessToken.userId;

    try {

      // Manage Dynamic Order Status
      if (req.body.orderstatus) {
        req.body.orderstatus = await constants.ORDER_PENDING(req.body.masterdetailId);
      }

      req.body.orderno = "BB0" + (Math.floor(Math.random() * 900000000000) + 100000000000);
      req.body.date = moment(new Date()).format("YYYY-MM-DD");
      req.body.createdby = req.body.userId;
      req.body.totalamount = 0;

      // find username
      var user = await userModel.findOne({
        where: {
          id: req.body.userId,
          masterdetailId: req.body.masterdetailId
        }
      });
      user.username ? user.username : user.companyname;

      // save request product
      await Order.create({
        orderno: req.body.orderno,
        orderstatus: req.body.orderstatus,
        totalamount: req.body.totalamount,
        inshoppingcart: req.body.inshoppingcart,
        createdby: req.body.userId,
        date: req.body.date,
        description: req.body.description ? req.body.description : null,
        customername: titlecase.titleCase(user.username),
        categoryId: req.body.categoryId ? req.body.categoryId : null,
        userId: req.body.userId,
        created: new Date(),
        modified: new Date(),
        masterdetailId: req.body.masterdetailId
      });

      // find request product
      var finalOrder = await Order.findOne({
        where: {
          orderno: req.body.orderno,
          masterdetailId: req.body.masterdetailId
        }
      });

      // if productmedia exist
      if (req.body.productmedia) {
        for (var i in req.body.productmedia) {
          await productmediaModel.create({
            productname: req.body.productmedia[i].productname,
            orderId: finalOrder.id,
            createdby: req.body.userId,
            masterdetailId: req.body.masterdetailId
          });
        }
      }

      return finalOrder;
    } catch (error) {
      throw error;
    }
  };

  // cancel order after placed
  Order.cancelOrder = async (req) => {

    var orderdetailsModel = app.models.orderdetails;
    var productModel = app.models.product;
    var notifyModel = app.models.notify;
    let isStockModeOn = false;
    let settingModel = app.models.setting;
    var isInquiryMode = false;

    try {

      // check status of inquiry mode
      var getInquiryMode = await settingModel.findOne({
        where: {
          registerallow: constants.IS_INQUIRY_LABLE,
          masterdetailId: req.query.where.masterdetailId
        }
      });
      if (getInquiryMode && getInquiryMode.status === 1) {
        isInquiryMode = true;
      }

      // check stock mode is active or not
      let getStockMode = await settingModel.findOne({
        where: {
          registerallow: 'IS_STOCK',
          masterdetailId: req.body.masterdetailId
        }
      });
      if (getStockMode && getStockMode.status === 1) {
        isStockModeOn = true;
      }

      // find order details
      var orderdetails = await orderdetailsModel.find({
        where: {
          orderId: req.body.orderId,
          masterdetailId: req.body.masterdetailId
        }
      });

      for (let i = 0; i < orderdetails.length; i++) {
        // find product detail
        var productD = await productModel.findOne({
          where: {
            id: orderdetails[i].productId,
            masterdetailId: req.body.masterdetailId
          },
          deleted: true
        });
        // update product quantity
        if (isStockModeOn) {
          await productModel.updateAll({
            id: orderdetails[i].productId,
            masterdetailId: req.body.masterdetailId
          }, {
            availablequantity: productD.availablequantity + orderdetails[i].quantity
          });
        }
      }

      // Get Cancel Order Dynamic Status
      if (req.body.orderstatus) {
        req.body.orderstatus = await constants.ORDER_CANCELLED(req.body.masterdetailId);
      }

      // update order status
      await Order.updateAll({
        id: req.body.orderId,
        masterdetailId: req.body.masterdetailId
      }, {
        orderstatus: req.body.orderstatus
      });

      // find order
      var order = await Order.findOne({
        where: {
          id: req.body.orderId,
          masterdetailId: req.body.masterdetailId
        }
      });

      // send orderdetail name object required for Notification
      let orderdetail = await orderdetailsModel.find({
        where: {
          orderId: order.id,
          masterdetailId: req.body.masterdetailId
        }
      });
      if (orderdetail) {
        order.orderdetail = orderdetail;
      }

      order.ORDER_CANCEL_BY = 'SELF';

      order.tenant = req.baseUrl;
      if (!isInquiryMode) {
        await notifyModel.share("ORDER/CANCELLED", order, {
          masterdetailId: req.body.masterdetailId
        });
        await notifyModel.share("ORDERSTATUS/ADMIN", order, {
          masterdetailId: null
        });
      }
      if (isInquiryMode) {
        await notifyModel.share("INQUIRY/CANCELLED", order, {
          masterdetailId: null
        });
        await notifyModel.share("INQUIRYSTATUS/ADMIN", order, {
          masterdetailId: null
        });
      }

      return order;

    } catch (error) {
      throw error;
    }
  };

  Order.repeatOrder = async (req) => {

    var productModel = app.models.product;
    var orderModel = app.models.order;
    var orderdetailsModel = app.models.orderdetails;
    var userModel = app.models.user;
    var grouppriceModel = app.models.groupprice;
    var settingModel = app.models.setting;
    var stateModel = app.models.state;
    var isShippingOptionEnable = false;
    var product, expdate = [],
      totalamountData = [],
      username;
    let isStockModeOn = false;
    let totaltaxprice = 0;
    let tax = {};
    let isCatalogueJewellery = true;
    var finalBasePriceWithCharges, finaladditionalcharge, additionalchargedetails,
      finalOrderGSTPrice, chargesPlusGST, totalActualBasePrice;

    try {

      var getStockMode = await settingModel.findOne({
        where: {
          registerallow: 'IS_STOCK',
          masterdetailId: req.body.masterdetailId
        }
      });
      if (getStockMode) {
        if (getStockMode.status === 1) {
          isStockModeOn = true;
        }
      }

      var getData = await settingModel.findOne({
        where: {
          registerallow: 'Catalogue_Jewellary',
          masterdetailId: req.body.masterdetailId
        }
      });
      if (getData && getData.status === 1) {
        isCatalogueJewellery = false;
      }

      var oldOrder = await orderModel.findOne({
        where: {
          id: req.body.orderId,
          masterdetailId: req.body.masterdetailId
        },
        include: ["orderdetails"]
      });

      req.body.userId = oldOrder.userId;
      req.body.address = oldOrder.address;

      var oldorderdetails = await orderdetailsModel.find({
        where: {
          orderId: oldOrder.id,
          masterdetailId: req.body.masterdetailId
        }
      });

      // find username
      var user = await userModel.findOne({
        where: {
          id: req.body.userId,
          masterdetailId: req.body.masterdetailId
        }
      });
      user.username ? user.username : user.companyname;

      req.body.orderstatus = await constants.ORDER_PENDING(req.body.masterdetailId);
      req.body.shippingprice = oldOrder.shippingprice;
      req.body.inshoppingcart = 0;
      req.body.date = moment(new Date()).format("YYYY-MM-DD");
      req.body.createdby = req.body.userId;
      req.body.totalitems = oldorderdetails.length;

      if (oldorderdetails) {
        req.body.orderdetails = oldorderdetails;
      }

      // check the product availability
      for (let i = 0; i < oldorderdetails.length; i++) {
        const element = oldorderdetails[i];

        // find product detail
        product = await productModel.findOne({
          where: {
            id: oldorderdetails[i].productId,
            masterdetailId: req.body.masterdetailId
          }
        });

        if (!product) {
          throw constants.createError(400, 'The Product is not exists in the system');
        }

        if (isStockModeOn === true) {
          // check that product is available or not
          if (product.availablequantity <= 0) {
            throw constants.createError(400, 'Sorry! Product is out of stock');
          }

          // check against quantity and total stoke
          if (product.availablequantity < oldorderdetails[i].quantity) {
            throw constants.createError(400, 'Sorry! Product is not availble as per given quantity');
          }
        }

        // Check Whether Variation Exist Or Not
        if (element.variation) {
          var currentOrderVariation = await constants.parseJson(element.variation);

          if (product.productvariation) {
            var currentProductvariation = JSON.parse(product.productvariation);

            if (currentProductvariation.length > 0) {
              for (let j = 0; j < currentProductvariation.length; j++) {
                const elementProductVariation = currentProductvariation[j];
                if (elementProductVariation.variation[0].key === currentOrderVariation.variation[0].key &&
                  elementProductVariation.variation[0].value === currentOrderVariation.variation[0].value) {

                  totalamountData.push(element.quantity * elementProductVariation.price);

                  // Check Flow With Variation Group Price

                  // if (elementProductVariation.variationGroupPrice) {
                  //   const getGroupPrice = elementProductVariation.variationGroupPrice.find(item => item.group_id === user.groupId);
                  //   if (getGroupPrice) {
                  //     console.log('getGroupPrice.groupprice', getGroupPrice.groupprice);
                  //     // product.price = getGroupPrice.groupprice;
                  //     totalamountData.push(element.quantity * getGroupPrice.groupprice);
                  //   }
                  // } else {
                  //   // product.price = elementProductVariation.price;
                  //   totalamountData.push(element.quantity * elementProductVariation.price);
                  // }

                  break;
                }
              }
            }

          }
        } else {
          /**
           * check user in which group
           * check different price is available or not for product and
           * minimum order quantity check
           */
          var userDetail = await userModel.findOne({
            where: {
              id: req.body.userId,
              masterdetailId: req.body.masterdetailId
            }
          });

          var groupPrice = await grouppriceModel.findOne({
            where: {
              groupId: userDetail.groupId,
              productId: product.id,
              masterdetailId: req.body.masterdetailId
            }
          });

          if (groupPrice) {
            product.price = groupPrice.newprice;
            if (groupPrice.minimumorderquantity != null) {
              if (groupPrice.minimumorderquantity > oldorderdetails[i].quantity) {
                throw constants.createError(400, "Minimum order quantity for " + product.name + " is " + groupPrice.minimumorderquantity)
              }
            }
          }

          totalamountData.push(element.quantity * product.price);

        }

        if (oldorderdetails.length === 1) {
          req.body.expecteddelivery = product.expecteddays;
        } else {
          product = await productModel.findOne({
            where: {
              id: oldorderdetails[i].productId,
              masterdetailId: req.body.masterdetailId
            }
          });
          expdate.push(product.expecteddays);

          expdate.sort(function (a, b) {
            return b - a;
          });

          req.body.expecteddelivery = expdate[0];
        }
      }

      if (req.body.orderId) {
        req.body.totalamount = totalamountData.reduce(getSum);
        // Set Base Price
        req.body.baseprice = req.body.totalamount;
        totalActualBasePrice = req.body.totalamount;
      }

      var totalAmount = await constants.getServiceCharge({ masterdetailId: req.body.masterdetailId, totalamount: req.body.totalamount });
      if (totalAmount) {
        finalBasePriceWithCharges = totalAmount.amount;
        req.body.baseprice = totalAmount.amount;
        req.body.additionalcharge = totalAmount.charges;
        req.body.additionalchargedetails = JSON.stringify(totalAmount.additionalChargeDetails);
      }

      var currentDate = moment(new Date()).format("DD/MM/YYYY");
      req.body.orderno = "BB0" + (Math.floor(Math.random() * 900000000000) + 100000000000);
      var new_date = moment(currentDate, "DD/MM/YYYY").add(req.body.expecteddelivery, "Days");
      req.body.deliverydate = new_date._d;

      /** Set Total Amount with shipping charges */
      // Get Shipping_Options Status
      let getShippingData = await settingModel.findOne({
        where: {
          registerallow: constants.SHIPPINGOPTIONS_LABLE,
          masterdetailId: req.body.masterdetailId
        }
      });

      if (getShippingData && getShippingData.status === 1) {
        isShippingOptionEnable = true;
      }

      // when Shipping_Options is enable
      if (isShippingOptionEnable) {
        getShippingData = JSON.parse(getShippingData.text);
        getShippingData = getShippingData.find(e => e.status === 1);
        // when Flat Price Shipping is active from setting
        if (getShippingData && getShippingData.id === 3) {
          getShippingData = getShippingData.options;
          // set shippingprice
          for (let i = 0; i < getShippingData.length; i++) {
            const element = getShippingData[i];
            if (element.maxCondition) {
              if (req.body.baseprice >= element.minValue) {
                req.body.shippingprice = element.charges
                break;
              }
            } else if (req.body.baseprice >= element.minValue && req.body.baseprice <= element.maxValue) {
              req.body.shippingprice = element.charges
              break;
            }
          }
          // set baseprice with shippingprice
          req.body.totalamount = req.body.baseprice + req.body.shippingprice;
        } else {
          req.body.shippingprice = 0;
        }
      }

      // when jewellery catalogue is active then do not calculate tax
      if (isCatalogueJewellery) {
        // calculation of GST
        let getData = await settingModel.findOne({
          where: {
            registerallow: constants.MERCHANTINFORMATION_LABLE,
            masterdetailId: req.body.masterdetailId
          }
        });
        if (getData) {
          getData = JSON.parse(getData.text);
          if (getData.enablegst === 1) {
            var sgst = (req.body.baseprice * getData.SGST) / 100;
            var cgst = (req.body.baseprice * getData.CGST) / 100;

            // set totalamount
            req.body.totalamount = req.body.totalamount + sgst + cgst;

            // set tax json
            tax.cgst = getData.CGST;
            tax.cgstPrice = cgst;
            tax.sgst = getData.SGST;
            tax.sgstPrice = sgst;

            // calculation if IGST
            var address = JSON.parse(req.body.address);
            if (address.billingaddress) {
              // get order billing
              var billingaddress = address.billingaddress;

              // match country
              var getCountryName = await stateModel.findOne({
                where: {
                  id: billingaddress.countryId,
                  masterdetailId: req.body.masterdetailId
                }
              });

              if (getCountryName.name !== getData.countryname) {
                var igst = (req.body.baseprice * getData.IGST) / 100;
                // set totalamount
                req.body.totalamount = req.body.totalamount + igst;
                // set tax json
                tax.igst = getData.IGST;
                tax.igstPrice = igst;
              }

            }
          }
        }
        // tax to stringify
        req.body.tax = JSON.stringify(tax);
        // req.body.totalamount = totaltaxprice + req.body.totalamount;
      }

      var getPincodeDelivery = await constants.commonFindOneFunction({
        model: app.models.setting,
        whereObj: {
          registerallow: constants.SETTING_PINCODE_DELIVERY,
          masterdetailId: req.body.masterdetailId
        }
      });

      if (getPincodeDelivery && getPincodeDelivery.status === 1) {

        var pincodeData = JSON.parse(getPincodeDelivery.text);
        var oldOrder = await constants.commonFindOneFunction({
          model: app.models.order,
          whereObj: {
            id: req.body.orderId,
            masterdetailId: req.body.masterdetailId
          }
        });

        if (oldOrder && oldOrder.address) {
          var address = JSON.parse(oldOrder.address);
          var isPincode = false;
          if (address.shippingaddress && address.shippingaddress.zipcode) {
            pincodeData.find(obj => {
              if (obj.pincode == address.shippingaddress.zipcode) {
                isPincode = true;
                return req.body.shippingprice = obj.charges;
              }
            });
            if (!isPincode) {
              throw constants.createError(404, 'Sorry! Delivery is not available at your area. Please change your Shipping Address.');
            }
          }
        }

      }

      var getInquirySetting = await settingModel.findOne({
        where: {
          registerallow: constants.IS_INQUIRY_LABLE,
          masterdetailId: req.body.masterdetailId
        }
      });

      if (getInquirySetting && getInquirySetting.status == 1) {
        req.body.inshoppingcart = 2;
      }

      // create order
      if (req.body.inshoppingcart == 0) {
        await Order.create({
          orderno: req.body.orderno,
          // expecteddelivery: req.body.expecteddelivery,
          orderstatus: req.body.orderstatus,
          totalamount: req.body.totalamount,
          inshoppingcart: req.body.inshoppingcart,
          deliverydate: req.body.deliverydate,
          createdby: req.body.userId,
          date: req.body.date,
          customername: titlecase.titleCase(user.username),
          totalitems: req.body.orderdetails.length,
          userId: req.body.userId,
          cityId: user.cityId,
          created: new Date(),
          modified: new Date(),
          baseprice: (totalAmount) ? totalActualBasePrice : req.body.baseprice,
          tax: req.body.tax,
          additionalcharge: req.body.additionalcharge,
          additionalchargedetails: (req.body.additionalchargedetails && typeof req.body.additionalchargedetails == 'object') ? JSON.stringify(req.body.additionalchargedetails) : req.body.additionalchargedetails,
          address: req.body.address,
          shippingprice: req.body.shippingprice,
          masterdetailId: req.body.masterdetailId
          // paymentDetail: oldOrder.paymentDetail
        });
      }

      if (req.body.inshoppingcart == 2) {
        await Order.create({
          orderno: req.body.orderno,
          orderstatus: req.body.orderstatus,
          inshoppingcart: req.body.inshoppingcart,
          createdby: req.body.userId,
          date: req.body.date,
          customername: titlecase.titleCase(user.username),
          totalitems: req.body.orderdetails.length,
          userId: req.body.userId,
          cityId: user.cityId,
          created: new Date(),
          modified: new Date(),
          address: req.body.address,
          masterdetailId: req.body.masterdetailId
        });
      }


      // find order
      var finalOrder = await Order.findOne({
        where: {
          orderno: req.body.orderno,
          masterdetailId: req.body.masterdetailId
        }
      });

      if (req.body.orderdetails) {
        for (let i = 0; i < req.body.orderdetails.length; i++) {
          const element = req.body.orderdetails[i];

          var product = await productModel.findOne({
            where: {
              id: element.productId,
              masterdetailId: req.body.masterdetailId
            }
          });

          if (finalOrder.inshoppingcart === 0) {

            if (element.variation) {
              var currentOrderVariation = await constants.parseJson(element.variation);
              if (product.productvariation) {
                var currentProductvariation = JSON.parse(product.productvariation);
                if (currentProductvariation.length > 0) {
                  for (let j = 0; j < currentProductvariation.length; j++) {
                    const elementProductVariation = currentProductvariation[j];
                    if (elementProductVariation.variation[0].key === currentOrderVariation.variation[0].key &&
                      elementProductVariation.variation[0].value === currentOrderVariation.variation[0].value) {
                      var currentOrderDetailsVariation = elementProductVariation
                      // if (elementProductVariation.variationGroupPrice) {
                      //   const getGroupPrice = elementProductVariation.variationGroupPrice.find(item => item.group_id === user.groupId);
                      //   if (getGroupPrice) {
                      //     product.price = getGroupPrice.groupprice;
                      //   }
                      // }
                      await orderdetailsModel.create({
                        amount: elementProductVariation.price,
                        orderId: finalOrder.id,
                        quantity: element.quantity,
                        createdby: finalOrder.userId,
                        productId: element.productId,
                        masterdetailId: req.body.masterdetailId,
                        variation: JSON.stringify(currentOrderDetailsVariation)
                      });
                      break;
                    }
                  }
                }
              }
            } else {
              await orderdetailsModel.create({
                amount: product.price,
                orderId: finalOrder.id,
                quantity: element.quantity,
                createdby: finalOrder.userId,
                productId: element.productId,
                masterdetailId: req.body.masterdetailId
              });
            }

          }

          if (finalOrder.inshoppingcart === 2) {

            if (element.variation) {
              var currentOrderVariation = await constants.parseJson(element.variation);
              if (product.productvariation) {
                var currentProductvariation = JSON.parse(product.productvariation);
                if (currentProductvariation.length > 0) {
                  for (let j = 0; j < currentProductvariation.length; j++) {
                    const elementProductVariation = currentProductvariation[j];
                    if (elementProductVariation.variation[0].key === currentOrderVariation.variation[0].key &&
                      elementProductVariation.variation[0].value === currentOrderVariation.variation[0].value) {
                      var currentOrderDetailsVariation = elementProductVariation
                      // if (elementProductVariation.variationGroupPrice) {
                      //   const getGroupPrice = elementProductVariation.variationGroupPrice.find(item => item.group_id === user.groupId);
                      //   if (getGroupPrice) {
                      //     product.price = getGroupPrice.groupprice;
                      //   }
                      // }
                      await orderdetailsModel.create({
                        orderId: finalOrder.id,
                        quantity: element.quantity,
                        createdby: finalOrder.userId,
                        productId: element.productId,
                        masterdetailId: req.body.masterdetailId,
                        variation: JSON.stringify(currentOrderDetailsVariation)
                      });
                      break;
                    }
                  }
                }
              }
            } else {
              await orderdetailsModel.create({
                orderId: finalOrder.id,
                quantity: element.quantity,
                createdby: finalOrder.userId,
                productId: element.productId,
                masterdetailId: req.body.masterdetailId
              });
            }

          }

        }
      }

      return finalOrder;
    } catch (error) {
      throw error;
    }
  };

  Order.beforeRemote("findById", async (ctx, modelInstance, next) => {
    var userModel = app.models.user;

    // manual authentication
    try {
      // find user role
      var userRole = await userModel.findOne({
        where: {
          id: ctx.req.accessToken.userId,
          masterdetailId: ctx.req.query.where.masterdetailId
        },
      });

      // find userId from order detail
      var orderDetail = await Order.findOne({
        where: {
          id: ctx.req.params.id,
          masterdetailId: ctx.req.query.where.masterdetailId
        }
      });

      if (userRole.roleId == 2) {
        // if user is not admin and salesman

        if (orderDetail) {
          if (ctx.req.accessToken.userId != orderDetail.userId) {
            throw constants.createError(401, 'Authorization Required');
          }
        }
      }
    } catch (error) {
      throw error;
    }
  });

  Order.afterRemote("findById", async (ctx, modelInstance, next) => {
    var orderdetailsModel = app.models.orderdetails;
    var orderModel = app.models.order;
    var productModel = app.models.product;
    var userModel = app.models.user;
    var cityModel = app.models.city;
    var groupModel = app.models.group;
    var grouppriceModel = app.models.groupprice;
    var totalquantity = 0;
    var orderuser;

    try {
      if (modelInstance.userId) {
        var userDetail = await userModel.findOne({
          where: {
            id: modelInstance.userId,
            masterdetailId: ctx.req.query.where.masterdetailId
          },
          deleted: true
        });

        if (modelInstance) {
          orderuser = await userModel.findOne({
            where: {
              id: modelInstance.userId,
              masterdetailId: ctx.req.query.where.masterdetailId
            },
            deleted: true
          });

          // add city name
          if (orderuser && orderuser.cityId) {
            var cityname = await cityModel.findOne({
              where: {
                id: orderuser.cityId,
                masterdetailId: ctx.req.query.where.masterdetailId
              },
              deleted: true
            });
            orderuser.cityname = cityname.name;
          } else {
            if (orderuser) orderuser.cityname = null;
          }

          modelInstance.orderuser = orderuser;

          if (ctx.args.filter) {
            if (ctx.args.filter.iseditable && modelInstance.inshoppingcart === 0 && modelInstance.orderstatus === await constants.ORDER_INPROGRESS(ctx.req.query.where.masterdetailId)) {
              throw constants.createError(400, 'Your order is in-progress, so you can not edit this order.');
            } else if (ctx.args.filter.iseditable && modelInstance.inshoppingcart === 0 && modelInstance.orderstatus === await constants.ORDER_COMFIRMED(ctx.req.query.where.masterdetailId)) {
              throw constants.createError(400, '"Your order is confirmed, so you can not edit this order."');
            } else if (ctx.args.filter.iseditable && modelInstance.inshoppingcart === 0 && modelInstance.orderstatus === await constants.ORDER_DELIVERED(ctx.req.query.where.masterdetailId)) {
              throw constants.createError(400, 'Your order is delivered, so you can not edit this order.');
            } else if (ctx.args.filter.iseditable && modelInstance.inshoppingcart === 0 && modelInstance.orderstatus === await constants.ORDER_REJECTED(ctx.req.query.where.masterdetailId)) {
              throw constants.createError(400, 'Your order is rejected,so you can not edit this order.');
            }
          }


          if (ctx.args.filter) {
            if (ctx.args.filter.iseditable && modelInstance.inshoppingcart === 2 && modelInstance.orderstatus === await constants.ORDER_INPROGRESS(ctx.req.query.where.masterdetailId)) {
              throw constants.createError(400, 'Your inquiry is in-progress, so you can not edit this inquiry.');
            } else if (ctx.args.filter.iseditable && modelInstance.inshoppingcart === 2 && modelInstance.orderstatus === await constants.ORDER_COMFIRMED(ctx.req.query.where.masterdetailId)) {
              throw constants.createError(400, 'Your inquiry is confirmed, so you can not edit this inquiry.')
            } else if (ctx.args.filter.iseditable && modelInstance.inshoppingcart === 2 && modelInstance.orderstatus === await constants.ORDER_DELIVERED(ctx.req.query.where.masterdetailId)) {
              throw constants.createError(400, 'Your inquiry is delivered, so you can not edit this inquiry.');
            } else if (ctx.args.filter.iseditable && modelInstance.inshoppingcart === 2 && modelInstance.orderstatus === await constants.ORDER_REJECTED(ctx.req.query.where.masterdetailId)) {
              throw constants.createError(400, 'Your inquiry is rejected,so you can not edit this inquiry.');
            }
          }

          // if (ctx.req.query) {
          //   if (modelInstance.inshoppingcart === 2 && modelInstance.orderstatus === await constants.ORDER_PENDING(ctx.req.query.where.masterdetailId)) {
          //   } else if (modelInstance.inshoppingcart === 2 && modelInstance.orderstatus === constants.ORDER_INPROGRESS(ctx.req.query.where.masterdetailId)) {
          //     throw constants.createError(400, 'Your inquiry is in-progress, so you can not cancel this inquiry.');
          //   } else if (modelInstance.inshoppingcart === 2 && modelInstance.orderstatus === await constants.ORDER_COMFIRMED(ctx.req.query.where.masterdetailId)) {
          //     throw constants.createError(400, 'Your inquiry is confirmed,so you can not cancel this inquiry.');
          //   } else if (modelInstance.inshoppingcart === 2 && modelInstance.orderstatus === await constants.ORDER_DELIVERED(ctx.req.query.where.masterdetailId)) {
          //     throw constants.createError(400, 'Your inquiry is delivered, so you can not cancel this inquiry.');
          //   } else if (modelInstance.inshoppingcart === 2 && modelInstance.orderstatus === await constants.ORDER_REJECTED(ctx.req.query.where.masterdetailId)) {
          //     throw constants.createError(400, 'Your order is rejected, so you are can cancel this inquiry.');
          //   }
          // }

          // find orderdetails of order
          var orderdetailsdata = await orderdetailsModel.find({
            where: {
              orderId: modelInstance.id,
              masterdetailId: ctx.req.query.where.masterdetailId
            }
          });

          for (const key in orderdetailsdata) {
            if (orderdetailsdata.hasOwnProperty(key)) {
              const element = orderdetailsdata[key];

              // find product
              var product = await productModel.findOne({
                where: {
                  id: element.productId,
                  masterdetailId: ctx.req.query.where.masterdetailId
                },
                deleted: true,
                include: ["category", "productmedia"]
              });

              // check price mode and new price
              // find group of user
              if (userDetail.groupId && userDetail.roleId != 1) {
                var group = await groupModel.findOne({
                  where: {
                    id: userDetail.groupId,
                    masterdetailId: ctx.req.query.where.masterdetailId
                  }
                });

                // check price mode
                if (group.isprice === false) {
                  product.pricemode = false;
                } else {
                  product.pricemode = true;
                }

                // check new price
                var newpriceDetail = await grouppriceModel.findOne({
                  where: {
                    groupId: userDetail.groupId,
                    productId: product.id,
                    masterdetailId: ctx.req.query.where.masterdetailId
                  }
                });

                if (newpriceDetail) {
                  product.price = newpriceDetail.newprice;
                }

                element.products = product;
              } else {
                product.pricemode = true;
                element.products = product;
              }
              totalquantity = totalquantity + element.quantity;
            }
          }

          modelInstance.orderdetail = orderdetailsdata;
          modelInstance.totalquantity = totalquantity;

          // Find and attach paymentstatus details
          if (modelInstance.paymentstatus) {
            if (typeof modelInstance.paymentstatus === 'string') {
              modelInstance.paymentstatus = parseInt(modelInstance.paymentstatus);
            }
            // Based on paymentstatus get value of it
            var getPaymentStatusSetting = await getSetting({
              registerallow: settingConstants.PAYMENT_STATUS,
              masterdetailId: modelInstance.masterdetailId
            });
            getPaymentStatusSetting = JSON.parse(getPaymentStatusSetting.text);
            getPaymentStatusSetting = getPaymentStatusSetting.find(item => item.id === modelInstance.paymentstatus);
            modelInstance.paymentstatusDetails = getPaymentStatusSetting;
          }
        }
      }
    } catch (error) {
      throw error;
    }
  });

  Order.beforeRemote("find", async (ctx, modelInstance, next) => {
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
    } catch (error) {
      throw error;
    }
  });

  Order.afterRemote("find", async (ctx, modelInstance, next) => {
    var productModel = app.models.product;
    var orderdetailsModel = app.models.orderdetails;
    var productmediaModel = app.models.productmedia;
    var groupModel = app.models.group;
    var grouppriceModel = app.models.groupprice;
    var userModel = app.models.user;
    var accesstokenModel = app.models.AccessToken;
    var cityModel = app.models.city;
    var orderdetailsdata, ordersData = [],
      product, orderuser = {},
      resData = {},
      arrayDta = [];
    var getorders, query;

    var tenant_new = ctx.req.baseUrl.substring(1);
    tenant_new = tenant_new.split("/")[0];

    try {
      var accessToken = await accesstokenModel.findOne({
        where: {
          id: ctx.req.headers.authorization,
          masterdetailId: ctx.req.query.where.masterdetailId
        }
      });

      if (ctx.args.filter.where && ctx.args.filter.where.and && ctx.args.filter.where.and[0] && ctx.args.filter.where.and[0].userId) {
        var userDetail = await userModel.findOne({
          where: {
            id: ctx.args.filter.where.and[0].userId,
            masterdetailId: ctx.req.query.where.masterdetailId
          }
        });
      } else {
        var userDetail = await userModel.findOne({
          where: {
            id: accessToken.userId,
            masterdetailId: ctx.req.query.where.masterdetailId
          }
        });
      }

      // find user role
      var userrole = await userModel.findById(accessToken.userId);

      if (modelInstance) {
        for (let i = 0; i < modelInstance.length; i++) {
          if (ctx.args.filter.where && ctx.args.filter.where.and && ctx.args.filter.where.and[0].inshoppingcart === 3) {
            var productmedia = await productmediaModel.find({
              where: {
                orderId: modelInstance[i].id,
                masterdetailId: ctx.req.query.where.masterdetailId
              }
            });

            modelInstance[i].orderproductmedia = productmedia;

            resData.data = modelInstance[i];
            resData.length = modelInstance.length;
          } else {
            // add to cart listing
            // find order details
            orderdetailsdata = await orderdetailsModel.find({
              where: {
                orderId: modelInstance[i].id,
                masterdetailId: ctx.req.query.where.masterdetailId
              },
              order: "modified DESC"
            });

            ordersData = orderdetailsdata;

            for (const key in ordersData) {
              if (ordersData.hasOwnProperty(key)) {
                const element = ordersData[key];

                // find product
                product = await productModel.findOne({
                  where: {
                    id: element.productId,
                    masterdetailId: ctx.req.query.where.masterdetailId
                  },
                  deleted: true,
                  include: ["category", "productmedia"]
                });

                // check price mode and new price
                // find group of user
                if (userDetail.groupId) {
                  var group = await groupModel.findOne({
                    where: {
                      id: userDetail.groupId,
                      masterdetailId: ctx.req.query.where.masterdetailId
                    }
                  });
                  // check price mode
                  if (group.isprice === false) {
                    product.pricemode = false;
                  } else {
                    product.pricemode = true;
                  }

                  // check new price
                  var newpriceDetail = await grouppriceModel.findOne({
                    where: {
                      groupId: userDetail.groupId,
                      productId: product.id,
                      masterdetailId: ctx.req.query.where.masterdetailId
                    }
                  });

                  if (newpriceDetail) {
                    product.price = newpriceDetail.newprice;
                    if (newpriceDetail.minimumorderquantity != null) {
                      product.minimumorderquantity = newpriceDetail.minimumorderquantity;
                    }
                  } else {
                    product.minimumorderquantity = 1;
                  }
                  element.products = product;
                } else {
                  product.pricemode = false;
                  product.minimumorderquantity = 1;
                  element.products = product;
                }
              }
            }
            modelInstance[i].orderdetail = ordersData;

            // Find and attach paymentstatus details
            if (modelInstance[i].paymentstatus) {
              if (typeof modelInstance[i].paymentstatus === 'string') {
                modelInstance[i].paymentstatus = parseInt(modelInstance[i].paymentstatus);
              }
              // Based on paymentstatus get value of it
              var getPaymentStatusSetting = await getSetting({
                registerallow: settingConstants.PAYMENT_STATUS,
                masterdetailId: modelInstance[i].masterdetailId
              });
              getPaymentStatusSetting = JSON.parse(getPaymentStatusSetting.text);
              getPaymentStatusSetting = getPaymentStatusSetting.find(item => item.id === modelInstance[i].paymentstatus);
              modelInstance[i].paymentstatusDetails = getPaymentStatusSetting;
            }

            // check PINCODE DELIVERY is active or not.
            var getPincodeDelivery = await constants.commonFindOneFunction({
              model: app.models.setting,
              whereObj: {
                registerallow: constants.SETTING_PINCODE_DELIVERY,
                masterdetailId: ctx.req.query.where.masterdetailId
              }
            });

            if (getPincodeDelivery && getPincodeDelivery.status === 1) {
              var pincodeData = JSON.parse(getPincodeDelivery.text);

              var getOrder = await app.models.order.findOne({
                where: {
                  userId: ctx.args.filter.where.and[0].userId,
                  inshoppingcart: 1,
                  masterdetailId: ctx.req.query.where.masterdetailId
                }
              });

              if (ctx.args.filter.where.and[0].pincode) {
                var charges = 0;
                for (let i = 0; i < pincodeData.length; i++) {
                  const element = pincodeData[i];
                  if (element.pincode == ctx.args.filter.where.and[0].pincode) {
                    charges = element.charges;
                    break;
                  }
                }

                // When picode does not match in our list Then set shipping price as 0.
                if (getOrder) {
                  await app.models.order.update({
                    id: getOrder.id,
                    userId: ctx.args.filter.where.and[0].userId,
                    inshoppingcart: 1,
                    masterdetailId: ctx.req.query.where.masterdetailId
                  }, {
                    shippingprice: charges
                  });
                }

                modelInstance[i].shippingprice = charges;
              }
            }


            // add orderuser in orderlisting for admin
            if (userrole.roleId === 1) {
              orderuser = await userModel.findOne({
                where: {
                  id: modelInstance[i].userId,
                  masterdetailId: ctx.req.query.where.masterdetailId
                },
                deleted: true
              });
              // add city name
              if (orderuser && orderuser.cityId) {
                var cityname = await cityModel.findOne({
                  where: {
                    id: orderuser.cityId,
                    masterdetailId: ctx.req.query.where.masterdetailId
                  },
                  deleted: true
                });
                orderuser.cityname = cityname.name;
              } else {
                orderuser = {};
                orderuser.cityname = null;
              }
              modelInstance[i].orderuser = orderuser;
            }
          }
        }


        if (ctx.req.query.isWeb) {
          let tempQuery = "";
          if (ctx.req.query.filter && ctx.req.query.filter.where) {
            if (ctx.req.query.filter.where.and) {
              // Price BETWEEN 10 AND 20;
              if (ctx.req.query.filter.where.and[0]) {
                // orderno filter
                if (ctx.req.query.filter.where.and[0].orderno && ctx.req.query.filter.where.and[0].orderno.like) {
                  tempQuery += " AND orderno LIKE  '" + ctx.req.query.filter.where.and[0].orderno.like + "' ";
                }
                // user-wise filter
                if (ctx.req.query.filter.where.and[0].userId) {
                  tempQuery += " AND userId = '" + ctx.req.query.filter.where.and[0].userId + "' ";
                }
                // totalamount filter
                if (ctx.req.query.filter.where.and[0].totalamount && ctx.req.query.filter.where.and[0].totalamount.like) {
                  tempQuery += " AND totalamount = '" + ctx.req.query.filter.where.and[0].totalamount.like + "' ";
                }
                // totalitems filter
                if (ctx.req.query.filter.where.and[0].totalitems && ctx.req.query.filter.where.and[0].totalitems.like) {
                  tempQuery += " AND totalitems = '" + ctx.req.query.filter.where.and[0].totalitems.like + "' ";
                }
                // date filter
                if (ctx.req.query.filter.where.and[0].date && ctx.req.query.filter.where.and[0].date.like) {
                  tempQuery += " AND date LIKE  '" + ctx.req.query.filter.where.and[0].date.like + "' ";
                }
                // inshoppingcart filter
                if (ctx.req.query.filter.where.and[0].inshoppingcart !== undefined) {
                  tempQuery += " AND inshoppingcart = '" + ctx.req.query.filter.where.and[0].inshoppingcart + "' ";
                }

                // orderstatus filter
                if (ctx.req.query.filter.where.and[0].orderstatus && ctx.req.query.filter.where.and[0].orderstatus.like) {
                  tempQuery += " AND orderstatus LIKE  '" + ctx.req.query.filter.where.and[0].orderstatus.like + "' ";
                }
                // in between filter
                if (ctx.req.query.filter.where.and[0].totalamount && ctx.req.query.filter.where.and[0].totalamount.between) {
                  tempQuery += " AND totalamount BETWEEN  " + ctx.req.query.filter.where.and[0].totalamount.between[0] +
                    " AND " + ctx.req.query.filter.where.and[0].totalamount.between[1] + " ";
                }

                // citywise filter
                if (ctx.req.query.filter.where.and[0].city && ctx.req.query.filter.where.and[0].city.like) {
                  let citydata = await cityModel.find({
                    where: {
                      name: {
                        like: ctx.req.query.filter.where.and[0].city.like,
                        masterdetailId: ctx.req.query.where.masterdetailId
                      }
                    }
                  });

                  let tempArray = [];
                  if (citydata.length > 0) {
                    citydata.map((e) => tempArray.push(e.__data.id));
                    tempArray = tempArray.map((a) => JSON.stringify(a)).join();
                    tempArray = "(" + tempArray + ")";
                    tempQuery += " AND cityId IN " + tempArray;
                  } else {
                    resData.data = [];
                    resData.length = 0;
                    ctx.res.status(200).send(resData);
                  }
                } else if (userrole.roleId === constants.SALESMAN_ROLEID || userrole.roleId === constants.DEALER_ROLEID) {
                  var cityArray = [];
                  // get cities from salesmancity table
                  var getCityData = await app.models.salesmancity.find({
                    where: {
                      userId: userrole.id,
                      masterdetailId: ctx.req.query.where.masterdetailId
                    }
                  });

                  if (getCityData) {
                    getCityData.filter(item => cityArray.push(item.cityId));
                  }

                  // get reportinf salesman / dealer details
                  var reportingToDetails = await app.models.user.findOne({
                    where: {
                      reportingto: userrole.id,
                      masterdetailId: ctx.req.query.where.masterdetailId
                    }
                  });

                  if (reportingToDetails) {
                    var getReportedPersonCities = await app.models.salesmancity.find({
                      where: {
                        userId: reportingToDetails.id,
                        masterdetailId: ctx.req.query.where.masterdetailId
                      }
                    });
                    if (getReportedPersonCities.length > 0) {
                      getReportedPersonCities.filter((e) => {
                        if (!cityArray.includes(e.cityId)) {
                          cityArray.push(e.cityId);
                        }
                      });
                    }

                  }

                  if (cityArray.length > 0) {
                    cityArray = await cityArray.map(item => JSON.stringify(item)).join();
                    cityArray = "(" + cityArray + ")";
                    tempQuery += " AND cityId IN " + cityArray;
                  } else {
                    tempQuery += " AND cityId IN " + "(" + null + ")";
                  }

                }

                // createdBy filter || For Salesman & Dealer distributor listing (Admin Panel)
                if (ctx.req.query.filter.where.and[0].createdby) {
                  tempQuery += " OR createdby = '" + ctx.req.query.filter.where.and[0].createdby + "' ";
                }
              }
            }
          }

          if (ctx.req.query.filter && ctx.req.query.filter.order) {

            if (ctx.req.query.filter.order === 'id DESC' || ctx.req.query.filter.order === 'id desc' || ctx.req.query.filter.order === 'id ASC' || ctx.req.query.filter.order === 'id asc') {
              ctx.req.query.filter.order = 'created DESC';
            }

            if (ctx.req.query.filter.order) {
              // created DESC wise order
              tempQuery += " ORDER BY " + ctx.req.query.filter.order + " ";
            }

            if (ctx.req.query.filter.order.totalamount) {
              // totalamount wise order
              tempQuery += " ORDER BY " + ctx.req.query.filter.order.totalamount + " ";
            }

          }

          query = "SELECT * FROM `order` WHERE   deletedAt IS NULL AND masterdetailId = '" + ctx.req.query.where.masterdetailId + "' " + tempQuery + " LIMIT " + ctx.req.query.filter.skip + "," + ctx.req.query.filter.limit;
          getorders = await new Promise((resolve, reject) => {
            app.datasources.mysql.connector.execute(query, null, (err, result) => {
              if (err) reject(err);
              resolve(result);
            });
          });

          var lengthQuery = "SELECT COUNT(id) as count FROM `order` WHERE deletedAt IS NULL AND masterdetailId = '" + ctx.req.query.where.masterdetailId + "' " + tempQuery;
          var orderLength = await new Promise((resolve, reject) => {
            app.datasources.mysql.connector.execute(lengthQuery, null, (err, result) => {
              if (err) reject(err);
              resolve(result);
            });
          });

          for (let i = 0; i < getorders.length; i++) {
            const oneOrder = getorders[i];
            if (oneOrder.cityId) {
              var city = await cityModel.findById(oneOrder.cityId); // find & attach citydata
              oneOrder.city = city;
            } else {
              oneOrder.city = null;
            }

            let orderdetails = await orderdetailsModel.find({
              where: {
                orderId: oneOrder.id,
                masterdetailId: ctx.req.query.where.masterdetailId
              },
              order: "modified DESC"
            });
            oneOrder.orderdetails = orderdetails;

            let orderuser = await userModel.findById(oneOrder.userId); // find & attach orderuser
            oneOrder.orderuser = orderuser;
          }

          resData.data = getorders;
          resData.length = orderLength[0].count;
          ctx.res.status(200).send(resData);
        }
      }
    } catch (err) {
      throw err;
    }
  });

  // Place Order
  Order.placeOrder = async (req) => {

    var productModel = app.models.product;
    var orderdetailsModel = app.models.orderdetails;
    var commonCounterModel = app.models.commoncounter;
    var userModel = app.models.user;
    var notifyModel = app.models.notify;
    var stateModel = app.models.state;
    var cityModel = app.models.city;
    var addressData = {};
    var isShippingOptionEnable = false;
    var settingModel = app.models.setting;
    var isPincode = false;

    try {

      // find user role
      var userRole = await userModel.findOne({
        where: {
          id: req.accessToken.userId,
          masterdetailId: req.body.masterdetailId
        }
      });

      // check whether city exists or not
      if (userRole && userRole.roleId !== constants.SALESMAN_ROLEID && !userRole.cityId) {
        throw constants.createError(400, 'Please update your city');
      }

      var getPincodeDelivery = await constants.commonFindOneFunction({
        model: app.models.setting,
        whereObj: {
          registerallow: constants.SETTING_PINCODE_DELIVERY,
          masterdetailId: req.body.masterdetailId
        }
      });

      if (getPincodeDelivery && getPincodeDelivery.status === 1) {
        var pincodeData = JSON.parse(getPincodeDelivery.text);

        if (req.body.shippingaddress.zipcode) {
          pincodeData.find(obj => {
            if (obj.pincode == req.body.shippingaddress.zipcode) {
              isPincode = true;
              return req.body.shippingprice = obj.charges;
            }
          });
        } else {
          var shippingAddress = JSON.parse(userRole.shippingaddress);
          for (let i = 0; i < pincodeData.length; i++) {
            const element = pincodeData[i];
            if (element.pincode == shippingAddress.zipcode) {
              isPincode = true;
              req.body.shippingprice = element.charges
              break;
            }
          }
        }
        if (isPincode != true) {
          throw constants.createError(404, 'Sorry! Delivery is not available at your area. Please change your Shipping Address.');
        }
      }

      // find order detail
      var order = await Order.findOne({
        where: {
          id: req.body.orderId,
          masterdetailId: req.body.masterdetailId
        }
      });


      if (userRole.roleId == 2) {
        // if api requested user is not admin and salesman
        if (req.accessToken.userId != order.userId) {
          throw constants.createError(401, 'Authorization Required');
        }
      }

      // Get Pendinng Order Status Tenant Wise
      order.orderstatus = await constants.ORDER_PENDING(req.body.masterdetailId);
      req.body.orderstatus = order.orderstatus;

      if (userRole.roleId != 1 && order.orderstatus != order.orderstatus) {
        throw constants.createError(400, 'Sorry ! Currently you can not change the order');
      }

      // product details
      var orderdetails = await orderdetailsModel.find({
        where: {
          orderId: order.id,
          masterdetailId: req.body.masterdetailId
        }
      });

      for (let i = 0; i < orderdetails.length; i++) {
        const element = orderdetails[i];

        // find product is available or not
        var productFind = await productModel.findOne({
          where: {
            id: element.productId,
            masterdetailId: req.body.masterdetailId
          }
        });

        if (element) {
          if (!element.deletedAt) {
            if (!productFind) {
              var productFind = await productModel.findOne({
                where: {
                  id: element.productId,
                  masterdetailId: req.body.masterdetailId
                },
                deleted: true,
              });
              throw constants.createError(400, productFind.name + ' is not available');
            }

            if (productFind && productFind.productstatus === 0) {
              throw constants.createError(400, productFind.name + ' is not active in the system');
            }
          }
        }
      }

      commonCounterModel.updateAll({
        userId: order.userId,
        masterdetailId: req.body.masterdetailId
      }, {
        cart: 0
      });

      // when from add to cart to go into order
      var finalOrderDetails = await orderdetailsModel.find({
        where: {
          orderId: req.body.orderId,
          masterdetailId: req.body.masterdetailId
        }
      });

      // Store tax Price
      if (req.body.tax) {
        req.body.tax = JSON.stringify(req.body.tax);
      }

      if (req.body.billingaddress) {
        // Set Country name
        let setCountryName = await stateModel.findOne({
          where: {
            id: req.body.billingaddress.countryId,
            masterdetailId: req.body.masterdetailId
          }
        });

        if (setCountryName) {
          req.body.billingaddress.countryname = setCountryName.name;
        } else {
          throw constants.createError(400, 'Sorry, Country not exist');
        }

        // Set State name
        let setStateName = await stateModel.findOne({
          where: {
            id: req.body.billingaddress.stateId,
            masterdetailId: req.body.masterdetailId
          }
        });

        if (setStateName) {
          req.body.billingaddress.statename = setStateName.name;
        } else {
          throw constants.createError(400, 'Sorry, State not exist');
        }

        // Set City Name
        let setCityName = await cityModel.findOne({
          where: {
            id: req.body.billingaddress.cityId,
            masterdetailId: req.body.masterdetailId
          }
        });

        if (setCityName) {
          req.body.billingaddress.cityname = setCityName.name;
        } else {
          throw constants.createError(400, 'Sorry, City not exist');
        }

        addressData.billingaddress = req.body.billingaddress;

      }
      if (req.body.shippingaddress) {
        // Set Country name
        let setCountryName = await stateModel.findOne({
          where: {
            id: req.body.shippingaddress.countryId,
            masterdetailId: req.body.masterdetailId
          }
        });

        if (setCountryName) {
          req.body.shippingaddress.countryname = setCountryName.name;
        } else {
          throw constants.createError(400, 'Sorry, Country not exist');
        }

        // Set State name
        let setStateName = await stateModel.findOne({
          where: {
            id: req.body.shippingaddress.stateId,
            masterdetailId: req.body.masterdetailId
          }
        });

        if (setStateName) {
          req.body.shippingaddress.statename = setStateName.name;
        } else {
          throw constants.createError(400, 'Sorry, State not exist');
        }

        // Set City Name
        let setCityName = await cityModel.findOne({
          where: {
            id: req.body.shippingaddress.cityId,
            masterdetailId: req.body.masterdetailId
          }
        });

        if (setCityName) {
          req.body.shippingaddress.cityname = setCityName.name;
        } else {
          throw constants.createError(400, 'Sorry, City not exist');
        }

        addressData.shippingaddress = req.body.shippingaddress;

      }

      if (req.body.gstin) {
        addressData.gstin = req.body.gstin;
      }

      var convertToJSONStringify = JSON.stringify(addressData);

      //for adding discount by dealer/salesman
      if (req.body.discountDetails) {
        var userData = await app.models.user.findOne({
          where: {
            id: order.createdby, // to check if order created by salesman or dealer
            masterdetailId: req.body.masterdetailId
          }
        });

        if (userData && (userData.roleId == constants.SALESMAN_ROLEID || userData.roleId == constants.DEALER_ROLEID)) {
          if (userData.discount < req.body.discountDetails.percentage) {
            throw constants.createError(400, "Maximum discount limit is " + userData.discount + "%");
          }
        }
      }

      // place order
      await Order.updateAll({
        id: req.body.orderId,
        masterdetailId: req.body.masterdetailId
      }, {
        totalamount: req.body.totalamount,
        inshoppingcart: req.body.inshoppingcart,
        description: req.body.description,
        totalitems: finalOrderDetails.length,
        address: convertToJSONStringify,
        tax: req.body.tax,
        additionalcharge: req.body.additionalcharge,
        additionalchargedetails: (req.body.additionalchargedetails) ? JSON.stringify(req.body.additionalchargedetails) : null,
        baseprice: req.body.baseprice,
        shippingprice: req.body.shippingprice,
        date: moment(new Date()).format("YYYY-MM-DD"),
        orderstatus: req.body.orderstatus,
        discount: constants.stringifyJson(req.body.discountDetails),
        createdby: req.accessToken.userId
      });

      order = await Order.findOne({
        where: {
          id: req.body.orderId,
          masterdetailId: req.body.masterdetailId
        }
      });

      order.orderdetail = orderdetails;
      order.cartCounter = 0;
      order.tenant = req.baseUrl;

      if (order.inshoppingcart == 0) {
        await notifyModel.share("ORDER/PENDING", order, {
          masterdetailId: req.body.masterdetailId
        });

        await notifyModel.share("PLACEORDER/ADMIN", order, {
          masterdetailId: null
        });
      }

      if (order.inshoppingcart == 2) {
        await notifyModel.share("INQUIRY/PENDING", order, {
          masterdetailId: null
        });
        await notifyModel.share("PLACEINQUIRY/ADMIN", order, {
          masterdetailId: null
        });
      }

      // when we ger totalamount 0 then delete the order
      if (order.totalamount === 0 && req.body.inshoppingcart === 0) {
        await Order.updateAll({
          id: req.body.orderId,
          masterdetailId: req.body.masterdetailId
        }, {
          deletedAt: new Date()
        });
      }

      return order;

    } catch (error) {
      throw error;
    }
  };

  Order.beforeRemote("prototype.patchAttributes", async (ctx, modelInstance, next) => {

    var userModel = app.models.user;
    var orderModel = app.models.order;
    var productModel = app.models.product;
    var settingModel = app.models.setting;
    var grouppriceModel = app.models.groupprice;
    var orderdetailsModel = app.models.orderdetails;
    var commonCounterModel = app.models.commoncounter;

    var isStockModeOn = false;
    var isShippingOptionEnable = false;

    var product, order, setting;
    var userRole;

    try {
      // check stock mode is active or not
      var getStockMode = await settingModel.findOne({
        where: {
          registerallow: "IS_STOCK",
          masterdetailId: ctx.req.query.where.masterdetailId
        }
      });
      if (getStockMode && getStockMode.status === 1) {
        isStockModeOn = true;
      }

      // find which user try to edit order based on userId
      if (ctx.args.data.userId) {
        userRole = await userModel.findOne({
          where: {
            id: ctx.args.data.userId,
            masterdetailId: ctx.req.query.where.masterdetailId
          }
        });
      } else {
        userRole = await userModel.findOne({
          where: {
            id: ctx.req.accessToken.userId,
            masterdetailId: ctx.req.query.where.masterdetailId
          }
        });
      }

      // Get Pendinng Order Status Tenant Wise
      if (ctx.instance.orderstatus) {
        ctx.instance.orderstatus = await constants.ORDER_PENDING(ctx.req.query.where.masterdetailId);
      }

      if (userRole.roleId != 1 && ctx.instance.orderstatus != ctx.instance.orderstatus) {
        throw constants.createError(400, 'Sorry, Currently you can not change the order.');
      }

      setting = await settingModel.findOne({
        where: {
          registerallow: constants.IS_INQUIRY_LABLE,
          masterdetailId: ctx.req.query.where.masterdetailId
        }
      });

      order = await orderModel.findOne({
        where: {
          id: ctx.req.params.id,
          masterdetailId: ctx.req.query.where.masterdetailId
        }
      });

      /**
       * check user in which group
       * check different price is available or not for product and
       * minimum order quantity check
       */

      if (ctx.req.query.adminchange) {
        if (order.inshoppingcart === 0 &&
          order.orderstatus === await constants.ORDER_PENDING(ctx.req.query.where.masterdetailId) &&
          ctx.args.data.orderstatus === await constants.ORDER_PENDING(ctx.req.query.where.masterdetailId)) {
        } else if (order.inshoppingcart === 0 &&
          order.orderstatus === await constants.ORDER_INPROGRESS(ctx.req.query.where.masterdetailId) &&
          (ctx.args.data.orderstatus === await constants.ORDER_PENDING(ctx.req.query.where.masterdetailId) ||
            ctx.args.data.orderstatus === await constants.ORDER_COMFIRMED(ctx.req.query.where.masterdetailId))) {
          throw constants.createError(400, 'Your order is in-progress,so you can not change the order status.');
        } else if (order.inshoppingcart === 0 &&
          order.orderstatus === await constants.ORDER_COMFIRMED(ctx.req.query.where.masterdetailId) &&
          ctx.args.data.orderstatus === await constants.ORDER_PENDING(ctx.req.query.where.masterdetailId)) {
          throw constants.createError(400, 'Your order is confirmed, so you can not cancel this order status.');
        } else if (order.inshoppingcart === 0 &&
          order.orderstatus === await constants.ORDER_DELIVERED &&
          (ctx.args.data.orderstatus === await constants.ORDER_PENDING(ctx.req.query.where.masterdetailId) ||
            ctx.args.data.orderstatus === await constants.ORDER_INPROGRESS(ctx.req.query.where.masterdetailId) ||
            ctx.args.data.orderstatus === await constants.ORDER_COMFIRMED(ctx.req.query.where.masterdetailId))) {
          throw constants.createError(400, 'Your order is delivered, so you can not change the order status.');
        } else if (order.inshoppingcart === 0 &&
          order.orderstatus === await constants.ORDER_REJECTED(ctx.req.query.where.masterdetailId) &&
          (ctx.args.data.orderstatus === await constants.ORDER_PENDING(ctx.req.query.where.masterdetailId) ||
            ctx.args.data.orderstatus === await constants.ORDER_INPROGRESS(ctx.req.query.where.masterdetailId) ||
            ctx.args.data.orderstatus === await constants.ORDER_COMFIRMED(ctx.req.query.where.masterdetailId) ||
            ctx.args.data.orderstatus === await constants.ORDER_DELIVERED(ctx.req.query.where.masterdetailId) ||
            ctx.args.data.orderstatus === await constants.ORDER_CANCELLED(ctx.req.query.where.masterdetailId))) {
          throw constants.createError(400, 'Your order is rejected, so you can not change the order status.');
        } else if (order.inshoppingcart === 0 &&
          order.orderstatus === await constants.ORDER_CANCELLED(ctx.req.query.where.masterdetailId) &&
          (ctx.args.data.orderstatus === await constants.ORDER_PENDING(ctx.req.query.where.masterdetailId) ||
            ctx.args.data.orderstatus === await constants.ORDER_INPROGRESS(ctx.req.query.where.masterdetailId) ||
            ctx.args.data.orderstatus === await constants.ORDER_COMFIRMED(ctx.req.query.where.masterdetailId) ||
            ctx.args.data.orderstatus === await constants.ORDER_DELIVERED(ctx.req.query.where.masterdetailId))) {
          throw constants.createError(400, 'Your order is already cancelled, so you can not change the order status.');
        }

        // When order delivered change status of payment
        if (order.orderstatus === await constants.ORDER_DELIVERED) {
          order.paymentstatus = 2;
        }

      }

      if (ctx.req.query.adminchange && setting.status === 1) {
        //  inquiry
        if (order.inshoppingcart === 2 &&
          order.orderstatus === await constants.ORDER_PENDING(ctx.req.query.where.masterdetailId) &&
          ctx.args.data.orderstatus === await constants.ORDER_PENDING(ctx.req.query.where.masterdetailId)) {
        } else if (order.inshoppingcart === 2 &&
          order.orderstatus === await constants.ORDER_INPROGRESS(ctx.req.query.where.masterdetailId) &&
          (ctx.args.data.orderstatus === await constants.ORDER_PENDING(ctx.req.query.where.masterdetailId) ||
            ctx.args.data.orderstatus === await constants.ORDER_COMFIRMED(ctx.req.query.where.masterdetailId))) {
          throw constants.createError(400, 'Your inquiry is in-progress,so you can not change the inquiry status.');
        } else if (order.inshoppingcart === 2 &&
          order.orderstatus === await constants.ORDER_COMFIRMED(ctx.req.query.where.masterdetailId) &&
          ctx.args.data.orderstatus === await constants.ORDER_PENDING(ctx.req.query.where.masterdetailId)) {
          throw constants.createError(400, 'Your inquiry is confirmed, so you can not cancel this inquiry status.');
        } else if (order.inshoppingcart === 2 &&
          order.orderstatus === await constants.ORDER_DELIVERED(ctx.req.query.where.masterdetailId) &&
          (ctx.args.data.orderstatus === await constants.ORDER_PENDING(ctx.req.query.where.masterdetailId) ||
            ctx.args.data.orderstatus === await constants.ORDER_INPROGRESS(ctx.req.query.where.masterdetailId) ||
            ctx.args.data.orderstatus === await constants.ORDER_COMFIRMED(ctx.req.query.where.masterdetailId))) {
          throw constants.createError(400, 'Your inquiry is delivered, so you can not change the inquiry status.');
        } else if (order.inshoppingcart === 2 &&
          order.orderstatus === await constants.ORDER_REJECTED(ctx.req.query.where.masterdetailId) &&
          (ctx.args.data.orderstatus === await constants.ORDER_PENDING(ctx.req.query.where.masterdetailId) ||
            ctx.args.data.orderstatus === await constants.ORDER_INPROGRESS(ctx.req.query.where.masterdetailId) ||
            ctx.args.data.orderstatus === await constants.ORDER_COMFIRMED(ctx.req.query.where.masterdetailId) ||
            ctx.args.data.orderstatus === await constants.ORDER_DELIVERED(ctx.req.query.where.masterdetailId) ||
            ctx.args.data.orderstatus === await constants.ORDER_CANCELLED(ctx.req.query.where.masterdetailId))) {
          throw constants.createError(400, 'Your inquiry is rejected, so you can not change the inquiry status.');
        } else if (order.inshoppingcart === 2 &&
          order.orderstatus === await constants.ORDER_CANCELLED(ctx.req.query.where.masterdetailId) &&
          (ctx.args.data.orderstatus === await constants.ORDER_PENDING(ctx.req.query.where.masterdetailId) ||
            ctx.args.data.orderstatus === await constants.ORDER_INPROGRESS(ctx.req.query.where.masterdetailId) ||
            ctx.args.data.orderstatus === await constants.ORDER_COMFIRMED(ctx.req.query.where.masterdetailId) ||
            ctx.args.data.orderstatus === await constants.ORDER_DELIVERED(ctx.req.query.where.masterdetailId))) {
          throw constants.createError(400, 'Your inquiry is already cancelled, so you can not change the inquiry status.');
        }
      }

      if (ctx.args.data.orderdetails && ctx.args.data.orderdetails.length > 0) {
        //check the product is there or not
        for (let i = 0; i < ctx.args.data.orderdetails.length; i++) {

          // find orderdetails
          var getOrderDetails = await orderdetailsModel.findOne({
            where: {
              id: ctx.args.data.orderdetails[i].id,
              masterdetailId: ctx.req.query.where.masterdetailId
            }
          });

          if (getOrderDetails) {
            product = await productModel.findOne({
              where: {
                id: getOrderDetails.productId,
                masterdetailId: ctx.req.query.where.masterdetailId
              },
              deleted: true
            });

            var groupPrice = await grouppriceModel.findOne({
              where: {
                groupId: userRole.groupId,
                productId: product.id,
                masterdetailId: ctx.req.query.where.masterdetailId
              }
            });

            if (groupPrice && groupPrice.minimumorderquantity != null && groupPrice.minimumorderquantity > ctx.args.data.orderdetails[i].quantity) {
              throw constants.createError(400, 'Minimum order quantity for ' + product.name + ' is ' + groupPrice.minimumorderquantity);
            }

            if (!ctx.args.data.orderdetails[i].deletedAt) {
              if (!product) {
                throw constants.createError(400, 'The Product is not exists in the system');
              }
              if (product && product.productstatus === 0) {
                throw constants.createError(400, 'This Product is not active in the system.');
              }
              if (isStockModeOn) {
                if (getOrderDetails.quantity < ctx.args.data.orderdetails[i].quantity) {
                  if (getOrderDetails.variation) {
                    // Check quantity against total available product variation stock
                    var orderDetailsVariation = JSON.parse(getOrderDetails.variation)
                    var productVariation = JSON.parse(product.productvariation);
                    var getMatchVarivation = await checkVariationQuantity(productVariation, orderDetailsVariation.variation);
                    // Check quantity against total available stock
                    if (ctx.args.data.orderdetails[i].quantity - getOrderDetails.quantity > getMatchVarivation.variation.quantity) {
                      throw constants.createError(400, 'Sorry, Only ' + getMatchVarivation.variation.quantity + ' variation quantity is available.');
                    }
                  } else {
                    // Check quantity against total available stock
                    if (ctx.args.data.orderdetails[i].quantity - getOrderDetails.quantity > product.availablequantity) {
                      throw constants.createError(400, 'Sorry, Only ' + product.availablequantity + ' quantity is available.');
                    }
                  }
                }
              }
            }

            if (getOrderDetails.quantity < ctx.args.data.orderdetails[i].quantity) {
              //  check is stock mode is Active or not for change quantity
              if (isStockModeOn) {
                if (getOrderDetails.variation) {
                  var orderDetailsVariation = JSON.parse(getOrderDetails.variation)
                  var productVariation = JSON.parse(product.productvariation);
                  var getMatchVarivation = await checkVariationQuantity(productVariation, orderDetailsVariation.variation);
                  getMatchVarivation.variation.quantity = getMatchVarivation.variation.quantity - (ctx.args.data.orderdetails[i].quantity - getOrderDetails.quantity);
                  productVariation[getMatchVarivation.index] = getMatchVarivation.variation;
                  await productModel.updateAll({
                    id: product.id
                  }, {
                    availablequantity: product.availablequantity - (ctx.args.data.orderdetails[i].quantity - getOrderDetails.quantity),
                    productvariation: JSON.stringify(productVariation)
                  });
                } else {
                  await productModel.updateAll({
                    id: product.id,
                    masterdetailId: ctx.req.query.where.masterdetailId
                  }, {
                    availablequantity: product.availablequantity - (ctx.args.data.orderdetails[i].quantity - getOrderDetails.quantity)
                  });
                }
              }
              await orderdetailsModel.updateAll({
                id: ctx.args.data.orderdetails[i].id,
                masterdetailId: ctx.req.query.where.masterdetailId
              }, {
                quantity: getOrderDetails.quantity + (ctx.args.data.orderdetails[i].quantity - getOrderDetails.quantity),
                modified: new Date()
              });
            }

            if (getOrderDetails.quantity > ctx.args.data.orderdetails[i].quantity) {
              if (isStockModeOn) {
                if (getOrderDetails.variation) {
                  var orderDetailsVariation = JSON.parse(getOrderDetails.variation)
                  var productVariation = JSON.parse(product.productvariation);
                  var getMatchVarivation = await checkVariationQuantity(productVariation, orderDetailsVariation.variation);
                  getMatchVarivation.variation.quantity = getMatchVarivation.variation.quantity - (ctx.args.data.orderdetails[i].quantity - getOrderDetails.quantity);
                  productVariation[getMatchVarivation.index] = getMatchVarivation.variation;
                  await productModel.updateAll({
                    id: product.id
                  }, {
                    availablequantity: product.availablequantity + (ctx.args.data.orderdetails[i].quantity - getOrderDetails.quantity),
                    productvariation: JSON.stringify(productVariation)
                  });
                } else {
                  await productModel.updateAll({
                    id: product.id,
                    masterdetailId: ctx.req.query.where.masterdetailId
                  }, {
                    availablequantity: product.availablequantity + (ctx.args.data.orderdetails[i].quantity - getOrderDetails.quantity)
                  });
                }
              }
              await orderdetailsModel.updateAll({
                id: ctx.args.data.orderdetails[i].id,
                masterdetailId: ctx.req.query.where.masterdetailId
              }, {
                quantity: getOrderDetails.quantity - (getOrderDetails.quantity - ctx.args.data.orderdetails[i].quantity),
                modified: new Date()
              });
            }
          }
        }
      }

      // Convert to stringify
      if (ctx.args.data.paymentDetail) {
        ctx.args.data.paymentDetail = await constants.stringifyJson(ctx.args.data.paymentDetail);
      }

      // Store tax Price
      if (ctx.args.data.tax) {
        ctx.args.data.tax = JSON.stringify(ctx.args.data.tax);
      }

      // additional Charge Details
      if (ctx.args.data.additionalchargedetails) {
        ctx.args.data.additionalchargedetails = JSON.stringify(ctx.args.data.additionalchargedetails);
      }

      //for adding discount by dealer/salesman
      if (ctx.args.data.discountDetails) {
        var userData = await app.models.user.findOne({
          where: {
            id: order.createdby, // to check if order created by salesman or dealer
            masterdetailId: ctx.req.query.where.masterdetailId
          }
        });

        if (userData && (userData.roleId == constants.SALESMAN_ROLEID || userData.roleId == constants.DEALER_ROLEID)) {
          if (userData.discount < ctx.args.data.discountDetails.percentage) {
            throw constants.createError(400, "Maximum discount limit is " + userData.discount + "%");
          }
        }
      } else {
        ctx.args.data.discountDetails = JSON.parse(order.discount);
      }

    } catch (error) {
      throw error;
    }
  });

  Order.afterRemote("prototype.patchAttributes", async (ctx, modelInstance, next) => {

    var userModel = app.models.user;
    var cityModel = app.models.city;
    var orderModel = app.models.order;
    var notifyModel = app.models.notify;
    var settingModel = app.models.setting;
    var productModel = app.models.product;
    var grouppriceModel = app.models.groupprice;
    var orderdetailsModel = app.models.orderdetails;
    var productmediaModel = app.models.productmedia;
    var commonCounterModel = app.models.commoncounter;
    var commoncounter, orderedit, ordereditby, orderData, orderuser, product, isStockModeOn, inputQuantity, finalBasePrice, totalAmount, finalOrderGSTPrice;
    var amountData = [];
    var deleteamountData = [];
    var isInquiryMode = false;
    var isShippingOptionEnable = false;

    try {

      // check status of inquiry mode
      var getInquiryMode = await settingModel.findOne({
        where: {
          registerallow: constants.IS_INQUIRY_LABLE,
          masterdetailId: ctx.req.query.where.masterdetailId
        }
      });

      if (getInquiryMode && getInquiryMode.status === 1) {
        isInquiryMode = true;
      }

      // check stock mode is active or not
      var getStockMode = await settingModel.findOne({
        where: {
          registerallow: "IS_STOCK",
          masterdetailId: ctx.req.query.where.masterdetailId
        }
      });
      if (getStockMode && getStockMode.status === 1) {
        isStockModeOn = true;
      }

      if (ctx.args.data.paymentDetail) {
        var getorder = await Order.findOne({
          where: {
            id: ctx.ctorArgs.id,
            masterdetailId: ctx.req.query.where.masterdetailId
          },
          include: "orderdetails"
        });
        let obj = JSON.parse(getorder.paymentDetail);
        getorder.paymentDetail = obj;

        // find order details
        orderdetailsdata = await orderdetailsModel.find({
          where: {
            orderId: getorder.id,
            masterdetailId: ctx.req.query.where.masterdetailId
          }
        });
        orderData = orderdetailsdata;
        // include product and productmedia in order
        for (const key in orderData) {
          if (orderData.hasOwnProperty(key)) {
            const element = orderData[key];
            // find product
            product = await productModel.findOne({
              where: {
                id: element.productId,
                masterdetailId: ctx.req.query.where.masterdetailId
              },
              deleted: true,
              include: ["category", "productmedia"]
            });
            product.pricemode = true;
            product.minimumorderquantity = 1;
            element.products = product;
          }
        }
        // include orderuser
        orderuser = await userModel.findOne({
          where: {
            id: getorder.userId,
            masterdetailId: ctx.req.query.where.masterdetailId
          }
        });
        // add city name
        if (orderuser.cityId) {
          var cityname = await cityModel.findOne({
            where: {
              id: orderuser.cityId,
              masterdetailId: ctx.req.query.where.masterdetailId
            },
            deleted: true
          });
          orderuser.cityname = cityname.name;
        } else {
          orderuser.cityname = null;
        }

        getorder.orderdetail = orderData;
        getorder.orderuser = orderuser;

        return getorder;
      }

      // check for product
      if (modelInstance) {
        //find order details
        var orderDetailsData = await orderdetailsModel.find({
          where: {
            orderId: modelInstance.id,
            masterdetailId: ctx.req.query.where.masterdetailId
          }
        });
      }

      if (ctx.args.data.orderdetails) {
        for (let i = 0; i < ctx.args.data.orderdetails.length; i++) {
          orderData = await orderdetailsModel.findOne({
            where: {
              id: ctx.args.data.orderdetails[i].id,
              masterdetailId: ctx.req.query.where.masterdetailId
            },
            deleted: true
          });

          ctx.args.data.orderdetails[i].quantity = orderData.quantity;

          commoncounter = await commonCounterModel.findOne({
            where: {
              userId: modelInstance.userId,
              masterdetailId: ctx.req.query.where.masterdetailId
            }
          });

          // if isshopping cart is false means its a order then care counter is decrease
          if (modelInstance.inshoppingcart === 0 && ctx.args.data.orderstatus) {
            modelInstance.cartCounter = commoncounter.cart - ctx.args.data.orderdetails.length;
            commonCounterModel.updateCounters(modelInstance.userId, "-", ctx.args.data.orderdetails.length, "cart", req.baseUrl);
          }
        }
      }

      // product details
      var orderdetails = await orderdetailsModel.find({
        where: {
          orderId: modelInstance.id,
          masterdetailId: ctx.req.query.where.masterdetailId
        },
      });

      modelInstance.orderdetail = orderdetails;

      // edit the request product image - when it passed for delete the img
      if (ctx.args.data.inshoppingcart === 3 && ctx.args.data.productmedia && ctx.args.data.productmedia[0].isdelete === true) {
        await productmediaModel.updateAll({
          id: ctx.args.data.productmedia[0].id,
          masterdetailId: ctx.req.query.where.masterdetailId
        }, {
          deletedAt: new Date()
        });
      }

      // request product
      if (ctx.args.data.inshoppingcart === 3 && ctx.args.data.productmedia && ctx.args.data.productmedia[0].productname) {
        for (var i in ctx.args.data.productmedia) {
          await productmediaModel.create({
            productname: ctx.args.data.productmedia[i].productname,
            orderId: modelInstance.id,
            createdby: modelInstance.userId,
            masterdetailId: ctx.req.query.where.masterdetailId
          });
        }
      }

      // filter
      if (ctx.req.query.filter) {
        orderedit = ctx.req.query.filter.orderedit;
        if (ctx.req.query.filter.editby) {
          ordereditby = ctx.req.query.filter.editby;
        } else {
          ordereditby = "false";
        }
      } else {
        ordereditby = "false";
      }

      var userrole = await userModel.findById(ctx.req.accessToken.userId);
      if (userrole.roleId === 3) {
        ordereditby = "admin";
      }

      // when order status update
      if (modelInstance.orderstatus === await constants.ORDER_INPROGRESS(ctx.req.query.where.masterdetailId)) {
        // inprogress
        modelInstance.tenant = ctx.req.baseUrl;
        if (!isInquiryMode) {
          await notifyModel.share("ORDER/INPROGRESS", modelInstance, {
            masterdetailId: ctx.req.query.where.masterdetailId
          });

          await notifyModel.share("ORDERSTATUS/ADMIN", modelInstance, {
            masterdetailId: null
          });
        }

        if (isInquiryMode) {
          await notifyModel.share("INQUIRY/INPROGRESS", modelInstance, {
            masterdetailId: null
          });
          await notifyModel.share("INQUIRYSTATUS/ADMIN", modelInstance, {
            masterdetailId: null
          });
        }
      } else if (modelInstance.orderstatus === await constants.ORDER_COMFIRMED(ctx.req.query.where.masterdetailId)) {
        // confirmed
        for (let i = 0; i < orderdetails.length; i++) {
          var productD = await productModel.findOne({
            where: {
              id: orderdetails[i].productId
            },
            deleted: true
          });
          await productModel.updateAll({
            id: orderdetails[i].productId,
            masterdetailId: ctx.req.query.where.masterdetailId
          }, {
            sellcounter: productD.sellcounter + 1
          });
        }
        modelInstance.tenant = ctx.req.baseUrl;
        if (!isInquiryMode) {
          await notifyModel.share("ORDER/COMFIRMED", modelInstance, {
            masterdetailId: ctx.req.query.where.masterdetailId
          });

          await notifyModel.share("ORDERSTATUS/ADMIN", modelInstance, {
            masterdetailId: null
          });
        }
        if (isInquiryMode) {
          await notifyModel.share("INQUIRY/COMFIRMED", modelInstance, {
            masterdetailId: null
          });
          await notifyModel.share("INQUIRYSTATUS/ADMIN", modelInstance, {
            masterdetailId: null
          });
        }
      } else if (modelInstance.orderstatus === await constants.ORDER_PENDING(ctx.req.query.where.masterdetailId) &&
        ctx.args.data.inshoppingcart === 0 && orderedit === "false") {
        // pending
        modelInstance.tenant = ctx.req.baseUrl;
        if (!isInquiryMode) {
          await notifyModel.share("ORDER/PENDING", modelInstance, {
            masterdetailId: ctx.req.query.where.masterdetailId
          });
          await notifyModel.share("ORDERSTATUS/ADMIN", modelInstance, {
            masterdetailId: null
          });
        }

        if (isInquiryMode) {
          await notifyModel.share("INQUIRY/PENDING", modelInstance, {
            masterdetailId: null
          });
          await notifyModel.share("INQUIRYSTATUS/ADMIN", modelInstance, {
            masterdetailId: null
          });
        }
      } else if (modelInstance.orderstatus === await constants.ORDER_DELIVERED(ctx.req.query.where.masterdetailId)) {
        // delivered
        modelInstance.tenant = ctx.req.baseUrl;
        if (!isInquiryMode) {
          await notifyModel.share("ORDER/DELIVERED", modelInstance, {
            masterdetailId: ctx.req.query.where.masterdetailId
          });
          await notifyModel.share("ORDERSTATUS/ADMIN", modelInstance, {
            masterdetailId: null
          });
        }
        if (isInquiryMode) {
          await notifyModel.share("INQUIRY/DELIVERED", modelInstance, {
            masterdetailId: null
          });
          await notifyModel.share("INQUIRYSTATUS/ADMIN", modelInstance, {
            masterdetailId: null
          });
        }
      } else if (modelInstance.orderstatus === await constants.ORDER_CANCELLED(ctx.req.query.where.masterdetailId)) {
        // cancelled

        for (let i = 0; i < orderdetails.length; i++) {
          var productD = await productModel.findOne({
            where: {
              id: orderdetails[i].productId,
              masterdetailId: ctx.req.query.where.masterdetailId
            },
            deleted: true,
          });

          if (isStockModeOn === true) {
            await productModel.updateAll({
              id: orderdetails[i].productId,
              masterdetailId: ctx.req.query.where.masterdetailId
            }, {
              availablequantity: productD.availablequantity + orderdetails[i].quantity,
              deliverydate: new Date(),
            });
          }
        }
        modelInstance.tenant = ctx.req.baseUrl;
        if (!isInquiryMode) {
          await notifyModel.share("ORDER/CANCELLED", modelInstance, {
            masterdetailId: ctx.req.query.where.masterdetailId
          });
          await notifyModel.share("ORDERSTATUS/ADMIN", modelInstance, {
            masterdetailId: null
          });
        }

        if (isInquiryMode) {
          await notifyModel.share("INQUIRY/CANCELLED", modelInstance, {
            masterdetailId: null
          });

          await notifyModel.share("INQUIRYSTATUS/ADMIN", modelInstance, {
            masterdetailId: null
          });
        }
      } else if (modelInstance.orderstatus === await constants.ORDER_REJECTED(ctx.req.query.where.masterdetailId)) {
        // rejected

        for (let i = 0; i < orderdetails.length; i++) {
          var productD = await productModel.findOne({
            where: {
              id: orderdetails[i].productId,
              masterdetailId: ctx.req.query.where.masterdetailId
            },
            deleted: true,
          });
          if (isStockModeOn === true) {
            await productModel.updateAll({
              id: productD.id,
              masterdetailId: ctx.req.query.where.masterdetailId
            }, {
              availablequantity: productD.availablequantity + orderdetails[i].quantity,
            });
          }
        }
        modelInstance.tenant = ctx.req.baseUrl;
        if (!isInquiryMode) {
          await notifyModel.share("ORDER/REJECTED", modelInstance, {
            masterdetailId: ctx.req.query.where.masterdetailId
          });
          await notifyModel.share("ORDERSTATUS/ADMIN", modelInstance, {
            masterdetailId: null
          });
        }
        if (isInquiryMode) {
          await notifyModel.share("INQUIRY/REJECTED", modelInstance, {
            masterdetailId: null
          });
          await notifyModel.share("INQUIRYSTATUS/ADMIN", modelInstance, {
            masterdetailId: null
          });
        }
      }

      /**
       * add to cart update - quantity,
       * can change the status of the cart to order,
       * can delete the order from the cart
       */
      if (ctx.args.data.orderdetails) {
        if (ctx.args.data.orderdetails.length > 0 || ctx.args.data.orderdetails) {
          // 1. change the quantity or new product add in order/cart
          ctx.args.data.orderdetails.map((oneObject) => {
            oneObject.created = new Date();
            oneObject.modified = new Date();
            oneObject.masterdetailId = ctx.req.query.where.masterdetailId
            orderdetailsModel.patchOrCreate(oneObject);
          });

          for (let i = 0; i < ctx.args.data.orderdetails.length; i++) {
            var productData = await app.models.product.findOne({
              where: {
                id: ctx.args.data.orderdetails[i].productId,
                masterdetailId: ctx.req.query.where.masterdetailId
              }
            });
            if (ctx.args.data.orderdetails[i].quantity && ctx.args.data.orderdetails[i].id) {
              if (ordereditby === "admin") {
                // When Order Edited By Admin
                isInquiryMode ? modelInstance.inshoppingcart = 2 : modelInstance.inshoppingcart = 0;
                var itemdelAmount = modelInstance.orderdetail[modelInstance.orderdetail.length - 1];
                var itemdata = itemdelAmount.amount * ctx.args.data.orderdetails[ctx.args.data.orderdetails.length - 1].quantity;
                inputQuantity = ctx.args.data.orderdetails[ctx.args.data.orderdetails.length - 1].quantity;
                ctx.args.data.orderdetails[0].quantity = modelInstance.orderdetail[modelInstance.orderdetail.length - 1].quantity;

                var orderItemData = await app.models.order.findOne({
                  where: {
                    id: modelInstance.id,
                    masterdetailId: ctx.req.query.where.masterdetailId
                  }
                });
                await app.models.order.updateAll({
                  id: ctx.req.params.id
                }, {
                  totalamount: itemdata,
                  totalitems: orderItemData.totalitems + 1,
                  inshoppingcart: isInquiryMode ? 2 : 0
                });
                // send notification to user
                modelInstance.tenant = ctx.req.baseUrl;
                await notifyModel.share("ORDER/UPDATE/ADMIN", modelInstance, {
                  masterdetailId: ctx.req.query.where.masterdetailId
                });
              }
            }

            // When product need to Delete
            if (ctx.args.data.orderdetails[i].deletedAt && ctx.args.data.orderdetails[i].id) {
              var orderItemData = await orderModel.findOne({
                where: {
                  id: modelInstance.id,
                  masterdetailId: ctx.req.query.where.masterdetailId
                }
              });
              // Decrease the totalItem of Order
              await orderModel.updateAll({
                id: ctx.req.params.id,
                masterdetailId: ctx.req.query.where.masterdetailId
              }, {
                totalitems: orderItemData.totalitems - 1
              });

              var orderdetailsdata = await orderdetailsModel.find({
                where: {
                  orderId: ctx.req.params.id,
                  masterdetailId: ctx.req.query.where.masterdetailId
                }
              });
              // When Order Quantity is 0 Delete the Order
              if (ctx.args.data.inshoppingcart === 1 && orderdetailsdata.length === 0) {
                await orderModel.updateAll({
                  id: ctx.req.params.id
                }, {
                  deletedAt: new Date()
                });
              }

              // When deleted by Admin
              if (ordereditby === "admin") {
                for (let k = 0; k < orderdetailsdata.length; k++) {
                  deleteamountData.push(orderdetailsdata[k].amount * orderdetailsdata[k].quantity);
                }
              }

              // Update the Counter of cart
              modelInstance.cartCounter = commoncounter.cart - ctx.args.data.orderdetails.length;
              commonCounterModel.updateCounters(modelInstance.userId, "-", ctx.args.data.orderdetails.length, "cart", ctx.req.baseUrl);

              // Check the Stock Setting and Accordingly update the Quantity of product
              if (isStockModeOn) {
                var getProductDetailsBasedOnRequest = await orderdetailsModel.findOne({
                  where: {
                    id: ctx.args.data.orderdetails[i].id,
                    orderId: ctx.req.params.id
                  },
                  deleted: true
                });

                // Get Delete Order Product
                var getProductDetails = await productModel.findOne({
                  where: {
                    id: getProductDetailsBasedOnRequest.productId
                  },
                  deleted: true
                });

                if (getProductDetailsBasedOnRequest.variation) {
                  var orderDetailsVariation = JSON.parse(getProductDetailsBasedOnRequest.variation)
                  var productVariation = JSON.parse(getProductDetails.productvariation);
                  var getMatchVarivation = await checkVariationQuantity(productVariation, orderDetailsVariation.variation);
                  getMatchVarivation.variation.quantity = getMatchVarivation.variation.quantity + getProductDetailsBasedOnRequest.quantity;
                  productVariation[getMatchVarivation.index] = getMatchVarivation.variation;
                  await productModel.updateAll({
                    id: getProductDetails.id,
                    masterdetailId: ctx.req.query.where.masterdetailId
                  }, {
                    availablequantity: getProductDetails.availablequantity + getProductDetailsBasedOnRequest.quantity,
                    productvariation: JSON.stringify(productVariation)
                  });
                } else {
                  await productModel.updateAll({
                    id: getProductDetails.id,
                    masterdetailId: ctx.req.query.where.masterdetailId
                  }, {
                    availablequantity: getProductDetails.availablequantity + getProductDetailsBasedOnRequest.quantity
                  });
                }
              }

            }

            if (ctx.args.data.orderdetails[i].productId && isStockModeOn) {
              await productModel.updateAll({
                id: ctx.args.data.orderdetails[i].productId,
                masterdetailId: ctx.req.query.where.masterdetailId
              }, {
                availablequantity: productData.availablequantity - ctx.args.data.orderdetails[i].quantity
              });
            }

          }
          // total amount update
          if (modelInstance.orderdetail && ordereditby === "admin") {

            for (let i = 0; i < modelInstance.orderdetail.length; i++) {
              const element = modelInstance.orderdetail[i];
              var getProductDetails = await productModel.findOne({
                where: {
                  id: element.productId,
                  masterdetailId: ctx.req.query.where.masterdetailId
                }, deleted: true
              });

              var getUserDetails = await userModel.findOne({
                where: {
                  id: modelInstance.userId
                },
                deleted: true
              });

              if (element.variation) {
                var productVariation = JSON.parse(getProductDetails.productvariation);
                var orderDetailsVariation = JSON.parse(element.variation);
                var getMatchVarivation = await checkVariationQuantity(productVariation, orderDetailsVariation.variation);
                if (getMatchVarivation && getMatchVarivation.variation.variationGroupPrice.length > 0) {
                  var getGroupPrice = getMatchVarivation.variation.variationGroupPrice.find(item => item.group_id === getUserDetails.groupId);
                  if (getGroupPrice) {
                    getProductDetails.price = getGroupPrice.groupprice;
                  }
                }
              } else {
                // Find Group Price
                var groupPrice = await grouppriceModel.findOne({
                  where: {
                    groupId: getUserDetails.groupId,
                    productId: element.productId,
                    masterdetailId: ctx.req.query.where.masterdetailId
                  }
                });
                // If groupprice Exist then set new price
                if (groupPrice) {
                  getProductDetails.price = groupPrice.newprice;
                  if (groupPrice.minimumorderquantity != null) {
                    if (groupPrice.minimumorderquantity > element.quantity) {
                      throw constants.createError(400, "Minimum order quantity for " + product.name + " is " + groupPrice.minimumorderquantity);
                    }
                  }
                }
              }
              await orderdetailsModel.updateAll({
                id: element.id,
                masterdetailId: ctx.req.query.where.masterdetailId
              }, {
                quantity: element.quantity,
                amount: getProductDetails.price,
                modified: new Date()
              });
              amountData.push(element.quantity * getProductDetails.price);
            }
          }

          if (!ctx.args.data.orderdetails[0].deletedAt && ordereditby === "admin") {
            modelInstance.totalamount = amountData.reduce(getSum);
          }
          if (ctx.args.data.orderdetails[0].deletedAt && ordereditby === "admin") {
            if (deleteamountData.length > 0) {
              modelInstance.totalamount = deleteamountData.reduce(getSum);
            } else {
              modelInstance.totalamount = 0;
            }
          }

          // additional charges - Dt: 01-07-2022
          if (ordereditby === "admin") {
            finalBasePrice = modelInstance.totalamount
            totalAmount = await constants.getServiceCharge({ masterdetailId: ctx.req.query.where.masterdetailId, totalamount: modelInstance.totalamount });
            if (totalAmount) {
              modelInstance.totalamount = totalAmount.amount;
              modelInstance.additionalcharge = totalAmount.charges;
              modelInstance.additionalchargedetails = JSON.stringify(totalAmount.additionalChargeDetails);

              // Calculate GST
              var getGSTDetails = await constants.calculateGST(ctx.req.query.where.masterdetailId, modelInstance.totalamount, modelInstance.address)

              if (getGSTDetails) {
                var getObjectLength = Object.keys(getGSTDetails);
                if (getObjectLength.length === 2) {
                  finalOrderGSTPrice = getGSTDetails.igstPrice;
                }
                if (getObjectLength.length === 4) {
                  finalOrderGSTPrice = getGSTDetails.cgstPrice + getGSTDetails.sgstPrice;
                }
                modelInstance.totalamount += finalOrderGSTPrice;
                modelInstance.tax = JSON.stringify(getGSTDetails);
              }

            }
          }

          if (ordereditby === "admin") {
            modelInstance.baseprice = modelInstance.totalamount;
            // Get Shipping_Options Status
            let getShippingData = await settingModel.findOne({
              where: {
                registerallow: 'Shipping_Options',
                masterdetailId: ctx.req.query.where.masterdetailId
              }
            });
            if (getShippingData) {
              if (getShippingData.status === 1) {
                isShippingOptionEnable = true;
              }
            }

            // when Shipping_Options is enable
            if (isShippingOptionEnable) {
              getShippingData = JSON.parse(getShippingData.text);
              getShippingData = getShippingData.find(e => e.status === 1);
              // when Flat Price Shipping is active from setting
              if (getShippingData && getShippingData.id === 3) {
                getShippingData = getShippingData.options;
                // set shippingprice
                for (let i = 0; i < getShippingData.length; i++) {
                  const element = getShippingData[i];
                  if (element.maxCondition) {
                    if (modelInstance.baseprice >= element.minValue) {
                      modelInstance.shippingprice = element.charges
                      break;
                    }
                  } else if (modelInstance.baseprice >= element.minValue && modelInstance.baseprice <= element.maxValue) {
                    modelInstance.shippingprice = element.charges
                    break;
                  }
                }
                // set totalamount with shippingprice
                modelInstance.totalamount = modelInstance.baseprice + modelInstance.shippingprice;
              } else {
                modelInstance.shippingprice = 0;
              }
            }
          }

          if (modelInstance.discount === 'null') {
            modelInstance.discount = null;
          }

          if (modelInstance.discount) {
            var discountprice = (modelInstance.totalamount * JSON.parse(modelInstance.discount).percentage) / 100;
            modelInstance.discountDetails = {
              percentage: JSON.parse(modelInstance.discount).percentage,
              price: discountprice
            }
            modelInstance.totalamount = modelInstance.totalamount - discountprice;
          }

          await orderModel.updateAll({
            id: modelInstance.id
          }, {
            totalamount: modelInstance.totalamount,
            baseprice: (totalAmount && finalBasePrice != 'null') ? finalBasePrice : modelInstance.baseprice,
            additionalcharge: modelInstance.additionalcharge,
            additionalchargedetails: (modelInstance.additionalchargedetails && typeof modelInstance.additionalchargedetails == 'object') ? JSON.stringify(modelInstance.additionalchargedetails) : modelInstance.additionalchargedetails,
            shippingprice: modelInstance.shippingprice,
            tax: modelInstance.tax,
            discount: modelInstance.discount ? constants.stringifyJson(modelInstance.discountDetails) : null
          });
        }
      }
      // when from add to cart to go into order
      if (ctx.args.data.inshoppingcart === 0) {
        commonCounterModel.updateAll({
          userId: modelInstance.userId
        }, {
          cart: 0
        });
        modelInstance.cartCounter = 0;

        var finalOrderDetails = await orderdetailsModel.find({
          where: {
            orderId: ctx.instance.id
          }
        });

        await orderModel.updateAll({
          id: modelInstance.id
        }, {
          totalitems: finalOrderDetails.length
        });
      }

      // when we get totalamount 0 then delete the order
      if (modelInstance.totalamount === 0 && ctx.args.data.inshoppingcart === 0) {
        await orderModel.updateAll({
          id: ctx.req.params.id
        }, {
          deletedAt: new Date()
        });
      }

    } catch (error) {
      throw error;
    }
  });

  // Find Current Month Starting & Ending Date Data (Month Wise Order Stats)
  Order.monthwiseorder = async (ctx) => {
    // Find Current Month
    const startOfMonth = moment().startOf("month").format("YYYY-MM-DD");
    const endOfMonth = moment().endOf("month").format("YYYY-MM-DD");
    var order;
    try {
      // If orderstatus is there then
      if (ctx.req.query.orderstatus) {
        order = await Order.find({
          where: {
            date: {
              between: [startOfMonth, endOfMonth]
            },
            orderstatus: ctx.req.query.orderstatus,
            inshoppingcart: 0,
            masterdetailId: ctx.req.query.where.masterdetailId
          }
        });
      } else {
        order = await Order.find({
          where: {
            date: {
              between: [startOfMonth, endOfMonth]
            },
            inshoppingcart: 0,
            masterdetailId: ctx.req.query.where.masterdetailId
          }
        });
      }

      return order.length;

    } catch (error) {
      throw error;
    }
  };

  Order.orderprogress = async (ctx) => {

    var inShoppingCart = 0;
    var cityArray = [];
    var statistics;

    try {

      // check status of inquiry mode
      var getInquiryMode = await app.models.setting.findOne({
        where: {
          registerallow: constants.IS_INQUIRY_LABLE,
          masterdetailId: ctx.req.query.where.masterdetailId
        }
      });
      if (getInquiryMode && getInquiryMode.status === 1) {
        inShoppingCart = 2;
      } else {
        inShoppingCart = 0;
      }

      if (ctx.req.accessToken.userId) {
        // Get role
        var userRole = await app.models.user.findById(ctx.req.accessToken.userId);

        if (userRole.roleId === constants.SALESMAN_ROLEID || userRole.roleId === constants.DEALER_ROLEID) {
          inShoppingCart = 0;
          // get cities from salesmancity table
          var getCityData = await app.models.salesmancity.find({
            where: {
              userId: userRole.id,
              masterdetailId: ctx.req.query.where.masterdetailId
            }
          });

          if (getCityData) {
            getCityData.filter(item => cityArray.push(item.cityId));
          }

          // get reportinf salesman / dealer details
          var reportingToDetails = await app.models.user.findOne({
            where: {
              reportingto: userRole.id,
              masterdetailId: ctx.req.query.where.masterdetailId
            }
          });

          if (reportingToDetails) {
            var getReportedPersonCities = await app.models.salesmancity.find({
              where: {
                userId: reportingToDetails.id,
                masterdetailId: ctx.req.query.where.masterdetailId
              }
            });
            if (getReportedPersonCities.length > 0) {
              getReportedPersonCities.filter((e) => {
                if (!cityArray.includes(e.cityId)) {
                  cityArray.push(e.cityId);
                }
              });
            }

          }

        }

        var query = "SELECT COUNT(*) AS TOTAL, COUNT(CASE WHEN `orderstatus` = " +
          await constants.ORDER_PENDING(ctx.req.query.where.masterdetailId) +
          " THEN 1 END) AS PENDING, COUNT(CASE WHEN `orderstatus` = " +
          await constants.ORDER_COMFIRMED(ctx.req.query.where.masterdetailId) +
          " THEN 1 END) AS CONFIRM, COUNT(CASE WHEN `orderstatus` = " +
          await constants.ORDER_INPROGRESS(ctx.req.query.where.masterdetailId) +
          " THEN 1 END) AS INRPOGRESS, COUNT(CASE WHEN `orderstatus` = " +
          await constants.ORDER_DELIVERED(ctx.req.query.where.masterdetailId) +
          " THEN 1 END) AS DELIVERED,  COUNT(CASE WHEN `orderstatus` = " +
          await constants.ORDER_CANCELLED(ctx.req.query.where.masterdetailId) +
          " THEN 1 END) AS CANCEL,  COUNT(CASE WHEN `orderstatus` = " +
          await constants.ORDER_REJECTED(ctx.req.query.where.masterdetailId) +
          " THEN 1 END) AS REJECT  FROM `order` WHERE `deletedAt` IS NULL AND `masterdetailId` = '" + ctx.req.query.where.masterdetailId +
          "' AND `inshoppingcart` = " + inShoppingCart + " ";

        if ((userRole.roleId === constants.SALESMAN_ROLEID || userRole.roleId === constants.DEALER_ROLEID)) {
          if (cityArray.length > 0) {
            cityArray = await cityArray.map(item => JSON.stringify(item)).join();
            cityArray = "(" + cityArray + ")";
            query += " AND cityId IN " + cityArray;
          } else {
            query += " AND cityId IN " + "(" + null + ")";
          }
        }

        if (ctx.req && ctx.req.query && ctx.req.query.filter && ctx.req.query.filter.where && ctx.req.query.filter.where.userId) {
          query += " AND `userId` = '" + ctx.req.query.filter.where.userId + "'";
        }

        statistics = await new Promise((resolve, reject) => {
          app.datasources.mysql.connector.execute(query, null, (err, result) => {
            if (err) reject(err);
            resolve(result);
          });
        });

        statistics = JSON.stringify(statistics); // Convert the statistics object to a string, remove RowDataPacket
        statistics = JSON.parse(statistics); // Convert the results string to a json object
        statistics = statistics[0];

      }
      return {
        totalordersCount: statistics.TOTAL,
        pendingData: (statistics.PENDING * 100) / statistics.TOTAL,
        confirmData: (statistics.CONFIRM * 100) / statistics.TOTAL,
        inprogressData: (statistics.INRPOGRESS * 100) / statistics.TOTAL,
        deliveredData: (statistics.DELIVERED * 100) / statistics.TOTAL,
        cancelledData: (statistics.CANCEL * 100) / statistics.TOTAL,
        rejectData: (statistics.REJECT * 100) / statistics.TOTAL,
        pendingCount: statistics.PENDING,
        confirmCount: statistics.CONFIRM,
        inprogressCount: statistics.INRPOGRESS,
        deliveredCount: statistics.DELIVERED,
        cancelCount: statistics.CANCEL,
        rejectCount: statistics.REJECT
      };

    } catch (err) {
      throw err;
    }
  };

  Order.salesmanOrderListingWithFilter = async (req) => {

    var accesstokenModel = app.models.AccessToken;
    var userModel = app.models.user;
    var salesmancityModel = app.models.salesmancity;
    var orderdetailsModel = app.models.orderdetails;
    var cityModel = app.models.city;
    var productModel = app.models.product;
    var getorders;
    var orderdetailsdata, ordersData = [],
      product, orderuser, query;
    var cityArray = [];
    var tenant = req.baseUrl.substring(1);
    tenant = tenant.split("/")[0];
    var tempQuery = "";

    try {

      // find user based on accesstoken
      var accessToken = await accesstokenModel.findOne({
        where: {
          id: req.headers.authorization,
          masterdetailId: req.query.where.masterdetailId
        }
      });
      // get user
      var user = await userModel.findById(accessToken.userId);
      if (user) {
        // Salesman Order Listing
        if (user.roleId === constants.SALESMAN_ROLEID || user.roleId === constants.DEALER_ROLEID) {
          if (req.query.filter && req.query.filter.where) {
            // inshoppingcart filter
            if (req.query.filter.where.inshoppingcart) {
              tempQuery += " AND inshoppingcart = '" + req.query.filter.where.inshoppingcart + "' ";
            }
            // orderstatus filter
            if (req.query.filter.where.orderstatus) {
              tempQuery += " AND orderstatus = '" + req.query.filter.where.orderstatus + "' ";
            }
            // citywise filter
            if (req.query.filter.where.cityId) {
              tempQuery += " AND cityId = '" + req.query.filter.where.cityId + "' ";
            }
          }

          if (user.roleId === constants.SALESMAN_ROLEID) {
            // reportingTo
            var reportingToSalesmanData = await userModel.findOne({
              where: {
                reportingto: user.id,
                masterdetailId: req.query.where.masterdetailId
              }
            });
            if (reportingToSalesmanData) {
              // get city data of user from salesmancity
              var getReportSalesmanCityData = await salesmancityModel.find({
                where: {
                  userId: reportingToSalesmanData.id,
                  masterdetailId: req.query.where.masterdetailId
                }
              });
              if (getReportSalesmanCityData.length > 0) {
                getReportSalesmanCityData.filter((e) => cityArray.push(e.cityId));
              }
            }

            // get city data of user from salesmancity
            var salesmancitydata = await salesmancityModel.find({
              where: {
                userId: user.id,
                masterdetailId: req.query.where.masterdetailId
              }
            });
            if (salesmancitydata.length > 0) {
              salesmancitydata.filter((e) => {
                if (!cityArray.includes(e.cityId)) {
                  cityArray.push(e.cityId);
                }
              });
            }

            // add salesmancitydata parameter in tempquery
            salesmancitydata = cityArray.map((a) => JSON.stringify(a)).join();
            if (salesmancitydata.length > 0) {
              salesmancitydata = "(" + salesmancitydata + ")";
            } else {
              salesmancitydata = "(null)";
            }
            tempQuery += " AND cityId IN " + salesmancitydata;
          }

          // if (user.roleId === constants.DEALER_ROLEID) {
          //   // Get Dealer Reporting to whom
          //   var getReportingToDetails = await userModel.findOne({
          //     where: {
          //       id: user.reportingto,
          //       masterdetailId: req.query.where.masterdetailId
          //     }
          //   });
          //   var dealerReportingToArray = [];
          //   if (getReportingToDetails) {
          //     dealerReportingToArray.push(getReportingToDetails.id);
          //   }
          //   dealerReportingToArray.push(user.id);
          //   dealerReportingToArray = dealerReportingToArray.map((a) => JSON.stringify(a)).join();
          //   dealerReportingToArray.length > 0
          //     ? dealerReportingToArray = "(" + dealerReportingToArray + ")"
          //     : dealerReportingToArray = "(null)";
          //   tempQuery += " OR createdby IN " + dealerReportingToArray;
          // }

          if (req.query.filter && req.query.filter.order) {
            //  if both order filte totalamount & Date
            if (req.query.filter.order.totalamount && req.query.filter.order.date) {
              tempQuery += " ORDER BY " + req.query.filter.order.totalamount + ", " + req.query.filter.order.date + " ";
            } else if (req.query.filter.order.date) {
              // date wise order
              tempQuery += " ORDER BY " + req.query.filter.order.date + " ";
            } else if (req.query.filter.order.totalamount) {
              // totalamount wise order
              tempQuery += " ORDER BY " + req.query.filter.order.totalamount + " ";
            }
          }

          query = "SELECT * FROM `order` WHERE   deletedAt IS NULL AND masterdetailId = '" + req.query.where.masterdetailId + "' " +
            tempQuery + " LIMIT " + req.query.filter.skip + "," + req.query.filter.limit;

        } else if (user.roleId === constants.ADMIN_ROLEID) {

          if (req.query.filter && req.query.filter.where) {
            // inshoppingcart filter
            if (req.query.filter.where.inshoppingcart) {
              tempQuery += " AND inshoppingcart = '" + req.query.filter.where.inshoppingcart + "' ";
            }
            // orderstatus filter
            if (req.query.filter.where.orderstatus) {
              tempQuery += " AND orderstatus = '" + req.query.filter.where.orderstatus + "' ";
            }
            // citywise filter
            if (req.query.filter.where.cityId) {
              tempQuery += " AND cityId = '" + req.query.filter.where.cityId + "' ";
            }
          }

          // get city data of user from salesmancity
          let citydata = await cityModel.find();
          if (citydata.length > 0) {
            for (let i = 0; i < citydata.length; i++) {
              const element = citydata[i];
              cityArray.push(element.id);
            }
          }
          // add salesmancitydata parameter in tempquery
          citydata = cityArray.map(a => JSON.stringify(a)).join();
          if (citydata.length > 0) {
            citydata = "(" + citydata + ")";
          } else {
            citydata = "(null)";
          }

          tempQuery += " AND cityId IN " + citydata;

          if (req.query.filter && req.query.filter.order) {
            //  if both order filte totalamount & Date
            if ((req.query.filter.order.totalamount) && (req.query.filter.order.date)) {
              tempQuery += " ORDER BY " + req.query.filter.order.totalamount + ", " + req.query.filter.order.date + " ";
            } else if (req.query.filter.order.date) {
              // date wise order
              tempQuery += " ORDER BY " + req.query.filter.order.date + " ";
            } else if (req.query.filter.order.totalamount) {
              // totalamount wise order
              tempQuery += " ORDER BY " + req.query.filter.order.totalamount + " ";
            } else { }
          }
          query = "SELECT * FROM `order` WHERE   deletedAt IS NULL AND masterdetailId = '" + req.query.where.masterdetailId + "' " + tempQuery + " LIMIT " + req.query.filter.skip + "," + req.query.filter.limit;
        } else {
          return (getorders = []);
        }

        getorders = await new Promise((resolve, reject) => {
          app.datasources.mysql.connector.execute(query, null, (err, result) => {
            if (err) reject(err);
            resolve(result);
          });
        });
      } else {
        throw constants.createError(404, 'Sorry, User not found');
      }

      // include product and productmedia in order
      // include orderuser
      if (getorders.length > 0) {
        for (let i = 0; i < getorders.length; i++) {
          const element = getorders[i];
          // find order details
          orderdetailsdata = await orderdetailsModel.find({
            where: {
              orderId: element.id,
              masterdetailId: req.query.where.masterdetailId
            }
          });
          ordersData = orderdetailsdata;

          for (const key in ordersData) {
            if (ordersData.hasOwnProperty(key)) {
              const element = ordersData[key];
              // find product
              product = await productModel.findOne({
                where: {
                  id: element.productId,
                  masterdetailId: req.query.where.masterdetailId
                },
                deleted: true,
                include: ["category", "productmedia"],
              });
              product.pricemode = true;
              product.minimumorderquantity = 1;
              element.products = product;
            }
          }

          orderuser = await userModel.findOne({
            where: {
              id: getorders[i].userId,
              masterdetailId: req.query.where.masterdetailId
            },
            deleted: true
          });

          // add city name
          if (orderuser && orderuser.cityId) {
            var cityname = await cityModel.findOne({
              where: {
                id: orderuser.cityId,
                masterdetailId: req.query.where.masterdetailId
              },
              deleted: true
            });
            orderuser.cityname = cityname.name;
          } else {
            if (orderuser) orderuser.cityname = null;
          }

          getorders[i].orderdetail = ordersData;
          getorders[i].orderuser = orderuser;

        }
      } else {
        getorders = [];
      }

      return getorders;

    } catch (error) {
      throw error;
    }
  };

  // UserWiseOrderListing
  Order.UserWiseOrderListing = async (req) => {
    try {
      var userModel = app.models.user;
      var orderdetailsModel = app.models.orderdetails;
      var cityModel = app.models.city;
      var productModel = app.models.product;
      var getorders;
      var orderdetailsdata,
        ordersData = [],
        product,
        orderuser,
        query;

      var tenant = req.baseUrl.substring(1);
      tenant = tenant.split("/")[0];

      let tempQuery = "";
      if (req.query.filter && req.query.filter.where) {
        // orderstatus filter
        if (req.query.filter.where.orderstatus) {
          tempQuery += " AND orderstatus = '" + req.query.filter.where.orderstatus + "' ";
        }
        // userId filter
        if (req.query.filter.where.userId) {
          tempQuery += " AND userId = '" + req.query.filter.where.userId + "' ";
        }
      }

      query = "SELECT * FROM `order` WHERE   deletedAt IS NULL AND masterdetailId = '" + req.query.where.masterdetailId + "' " + tempQuery + " LIMIT " + req.query.filter.skip + "," + req.query.filter.limit;

      getorders = await new Promise((resolve, reject) => {
        app.datasources.mysql.connector.execute(query, null, (err, result) => {
          if (err) reject(err);
          resolve(result);
        });
      });

      // include product and productmedia in order
      // include orderuser
      if (getorders.length > 0) {
        for (let i = 0; i < getorders.length; i++) {
          const element = getorders[i];
          // find order details
          orderdetailsdata = await orderdetailsModel.find({
            where: {
              orderId: element.id,
              masterdetailId: req.query.where.masterdetailId
            }
          });
          ordersData = orderdetailsdata;

          for (const key in ordersData) {
            if (ordersData.hasOwnProperty(key)) {
              const element = ordersData[key];
              // find product
              product = await productModel.findOne({
                where: {
                  id: element.productId,
                  masterdetailId: req.query.where.masterdetailId
                },
                deleted: true,
                include: ["category", "productmedia"]
              });
              // product.pricemode = true;
              // product.minimumorderquantity = 1;
              element.products = product;
            }
          }

          orderuser = await userModel.findOne({
            where: {
              id: getorders[i].userId,
              masterdetailId: req.query.where.masterdetailId
            },
            deleted: true
          });
          // add city name
          if (orderuser.cityId) {
            var cityname = await cityModel.findOne({
              where: {
                id: orderuser.cityId,
                masterdetailId: req.query.where.masterdetailId
              },
              deleted: true
            });
            orderuser.cityname = cityname.name;
          } else {
            orderuser.cityname = null;
          }

          getorders[i].orderdetail = ordersData;
          getorders[i].orderuser = orderuser;
        }
      } else {
        getorders = [];
      }

      return getorders;
    } catch (error) {
      throw error;
    }
  };

  // cancel order after placed
  Order.changeOrderStatus = async (req) => {
    var orderdetailsModel = app.models.orderdetails;
    var productModel = app.models.product;
    var notifyModel = app.models.notify;
    var order;
    var isStockModeOn = false;
    var settingModel = app.models.setting;

    try {

      var getStockMode = await settingModel.findOne({
        where: {
          registerallow: constants.IS_STOCK_KEY,
          masterdetailId: req.query.where.masterdetailId
        }
      });
      if (getStockMode && getStockMode.status === 1) {
        isStockModeOn = true;
      }

      // find order
      var getorder = await Order.findById(req.body.orderId);

      if (getorder.id) {
        // find order data details
        var orderdetails = await orderdetailsModel.find({
          where: {
            orderId: getorder.id,
            masterdetailId: req.query.where.masterdetailId
          }
        });

        for (let i = 0; i < orderdetails.length; i++) {
          // find product detail
          var productD = await productModel.findOne({
            where: {
              id: orderdetails[i].productId,
              masterdetailId: req.query.where.masterdetailId
            }
          });

          if ((req.body.orderstatus == await constants.ORDER_PENDING(req.query.where.masterdetailId) ||
            req.body.orderstatus == await constants.ORDER_COMFIRMED(req.query.where.masterdetailId) ||
            req.body.orderstatus == await constants.ORDER_INPROGRESS(req.query.where.masterdetailId) ||
            req.body.orderstatus == await constants.ORDER_DELIVERED(req.query.where.masterdetailId)) &&
            (getorder.orderstatus == await constants.ORDER_CANCELLED(req.query.where.masterdetailId) ||
              getorder.orderstatus == await constants.ORDER_REJECTED(req.query.where.masterdetailId))
          ) {
            // increase Product quantity
            if (isStockModeOn) {
              await productModel.updateAll({
                id: orderdetails[i].productId,
                masterdetailId: req.query.where.masterdetailId
              }, {
                availablequantity: productD.availablequantity - orderdetails[i].quantity
              });
            }
          }

          if ((req.body.orderstatus == await constants.ORDER_CANCELLED(req.query.where.masterdetailId) ||
            req.body.orderstatus == await constants.ORDER_REJECTED(req.query.where.masterdetailId)) &&
            (getorder.orderstatus == await constants.ORDER_PENDING(req.query.where.masterdetailId) ||
              getorder.orderstatus == await constants.ORDER_COMFIRMED(req.query.where.masterdetailId) ||
              getorder.orderstatus == await constants.ORDER_INPROGRESS(req.query.where.masterdetailId) ||
              getorder.orderstatus == await constants.ORDER_DELIVERED(req.query.where.masterdetailId))
          ) {
            // decrease Product quantity
            if (isStockModeOn) {
              await productModel.updateAll({
                id: orderdetails[i].productId,
                masterdetailId: req.query.where.masterdetailId
              }, {
                availablequantity: productD.availablequantity + orderdetails[i].quantity,
              });
            }
          }
        }

        // update order status
        var changedStatus = await Order.updateAll({
          id: getorder.id,
          masterdetailId: req.query.where.masterdetailId
        }, {
          orderstatus: req.body.orderstatus
        });

        if (changedStatus) {
          // find order
          order = await Order.findOne({
            where: {
              id: req.body.orderId,
              masterdetailId: req.query.where.masterdetailId
            }
          });

          // send orderdetail name object required for Notification
          var orderdetail = await orderdetailsModel.find({
            where: {
              orderId: order.id,
              masterdetailId: req.query.where.masterdetailId
            }
          })
          if (orderdetail) {
            order.orderdetail = orderdetail;
          }

          if (order.orderstatus == await constants.ORDER_PENDING(req.query.where.masterdetailId)) {
            order.tenant = req.baseUrl;
            notifyModel.share("ORDER/PENDING", order, {
              masterdetailId: req.query.where.masterdetailId
            });
          }
          if (order.orderstatus == await constants.ORDER_COMFIRMED(req.query.where.masterdetailId)) {
            order.tenant = req.baseUrl;
            notifyModel.share("ORDER/COMFIRMED", order, {
              masterdetailId: req.query.where.masterdetailId
            });
          }
          if (order.orderstatus == await constants.ORDER_INPROGRESS(req.query.where.masterdetailId)) {
            order.tenant = req.baseUrl;
            notifyModel.share("ORDER/INPROGRESS", order, {
              masterdetailId: req.query.where.masterdetailId
            });
          }
          if (order.orderstatus == await constants.ORDER_DELIVERED(req.query.where.masterdetailId)) {
            order.tenant = req.baseUrl;
            notifyModel.share("ORDER/DELIVERED", order, {
              masterdetailId: req.query.where.masterdetailId
            });
          }
          if (order.orderstatus == await constants.ORDER_CANCELLED(req.query.where.masterdetailId)) {
            order.tenant = req.baseUrl;
            notifyModel.share("ORDER/CANCELLED", order, {
              masterdetailId: req.query.where.masterdetailId
            });
          }
          if (order.orderstatus == await constants.ORDER_REJECTED(req.query.where.masterdetailId)) {
            order.tenant = req.baseUrl;
            notifyModel.share("ORDER/REJECTED", order, {
              masterdetailId: req.query.where.masterdetailId
            });
          }
        }
      } else {
        throw constants.createError(400, 'Sorry, Order not found.');
      }
      return order;
    } catch (error) {
      throw error;
    }
  };

  Order.exportOrders = async (req) => {
    var orderModel = app.models.order;
    var getCityName = {
      name: "--"
    };
    var orderstatus;
    var isInquiryMode = false;

    try {

      // check status of inquiry mode
      var getInquiryMode = await app.models.setting.findOne({
        where: {
          registerallow: constants.IS_INQUIRY_LABLE,
          masterdetailId: req.req.query.where.masterdetailId
        }
      });
      if (getInquiryMode && getInquiryMode.status === 1) {
        isInquiryMode = true;
      }

      var tempArray = [];
      // get All Order Data
      var getOrders = await orderModel.find({
        where: {
          inshoppingcart: isInquiryMode ? 2 : 0,
          masterdetailId: req.req.query.where.masterdetailId
        },
        include: "orderdetails"
      });
      if (getOrders) {
        for (let i = 0; i < getOrders.length; i++) {
          const element = getOrders[i];

          // find order status
          if (element.orderstatus) {
            orderstatus = await constants.commonFindOneFunction({
              model: app.models.orderstatus,
              whereObj: {
                id: element.orderstatus,
                masterdetailId: req.req.query.where.masterdetailId
              }
            });
          } else {
            orderstatus = "--";
          }

          // find city name
          if (element.cityId) {
            getCityName = await constants.commonFindOneFunction({
              model: app.models.city,
              whereObj: {
                id: element.cityId,
                masterdetailId: req.req.query.where.masterdetailId
              }
            });
          }

          // find user
          var getUser = await app.models.user.findOne({
            where: {
              id: element.userId,
              masterdetailId: req.req.query.where.masterdetailId
            },
            deleted: true
          });

          if (getUser) {
            getUser.cellnumber === null ? getUser.cellnumber = "--" : getUser.cellnumber;
            getUser.address1 === null ? getUser.address1 = "--" : getUser.address1;
          }

          // to find item / product name, quantity and price

          // find order details from order Id
          var getorderDetails = await constants.commonFindFunction({
            model: app.models.orderdetails,
            whereObj: {
              orderId: element.id,
              masterdetailId: req.req.query.where.masterdetailId
            }
          });
          var resdata = {};
          for (let i = 0; i < getorderDetails.length; i++) {
            const element = getorderDetails[i];
            // find product details on the basis of product Id obtained from orderdetails.
            var productDetails = await constants.commonFindOneFunction({
              model: app.models.product,
              whereObj: {
                id: element.productId,
                masterdetailId: req.req.query.where.masterdetailId
              }
            });
            if (productDetails !== null) {
              resdata["Item " + [i + 1]] = productDetails.name, resdata["Item " + [i + 1] + " Quantity"] = element.quantity, resdata["Item " + [i + 1] + " Price per Unit"] = productDetails.price;
            } else {
              resdata["Item " + [i + 1]] = "--", resdata["Item " + [i + 1] + " Quantity"] = "--", resdata["Item " + [i + 1] + " Price per Unit"] = "--";
            }
          }

          tempArray.push({
            "Customer Name": element.customername,
            "Order Number": element.orderno,
            "Cell Number": getUser.cellnumber,
            "Address": getUser.address1,
            "Order Status": orderstatus.status,
            "Total Items": element.totalitems,
            "Total Amount": element.totalamount,
            "Shipping Charges": element.shippingprice,
            "City": getCityName.name,
            "Date": element.date,
          });

        }
      } else {
        if (isInquiryMode) {
          throw constants.createError(404, 'Sorry, No inquiries available!');
        } else {
          throw constants.createError(404, 'Sorry, No orders available!');
        }
      }

      return tempArray;
    } catch (error) {
      throw error;
    }
  };


  Order.genratepaytmchecksum = async (req, res) => {
    let settingModel = app.models.setting;
    let paytm_config;
    let paytmParams = {};
    var body = req.body;
    let finalResponse;
    let userModel = app.models.user;
    let user = await userModel.findById(req.accessToken.userId);

    try {

      var getPayTMConfig = await settingModel.findOne({
        where: {
          registerallow: "Payment_Details",
          masterdetailId: req.query.where.masterdetailId
        }
      });
      getPayTMConfig = await constants.parseJson(getPayTMConfig.text);

      for (let i = 0; i < getPayTMConfig.length; i++) {
        const element = getPayTMConfig[i];
        if (element.name === "Paytm") {
          paytm_config = element;
        }
      }

      paytmParams.body = {
        requestType: "Payment",
        mid: paytm_config.config.PaytmMerchantID,
        websiteName: "WEBSTAGING",
        orderId: body.orderId,
        // callbackUrl: body.callbackUrl,
        txnAmount: {
          value: body.amount,
          currency: "INR"
        },
        userInfo: {
          custId: user.id
        },
      };

      /*
       * Generate checksum by parameters we have in body
       * Find your Merchant Key in your Paytm Dashboard at https://dashboard.paytm.com/next/apikeys
       */
      var checksum = await PaytmChecksum.generateSignature(JSON.stringify(paytmParams.body), paytm_config.config.MERCHANT_KEY);

      paytmParams.head = {
        signature: checksum
      };

      finalResponse = await new Promise((resolve, reject) => {
        request.post({
          /* for Staging */
          url: `https://securegw-stage.paytm.in/theia/api/v1/initiateTransaction?mid=${paytm_config.config.PaytmMerchantID}&orderId=${body.orderId}`,
          /* for Production */
          // hostname: 'securegw.paytm.in',
          body: paytmParams,
          json: true
        }, (error, body) => {
          if (error) reject(error);
          resolve(body);
        });
      });

      return finalResponse.body;

    } catch (error) {
      throw error;
    }
  };

  Order.genratepayumoneyhash = async (req) => {
    var settingModel = app.models.setting;
    var payu_money_config;
    var body = req.body;
    var userModel = app.models.user;
    var user = await userModel.findById(req.accessToken.userId);

    try {

      if (!body.txnId || !body.amount || !body.productinfo || !body.firstname || !body.email) {
        return {
          error: {
            message: "Name and Email Address is mandatory!"
          }
        };
      }

      let getPaymentConfig = await settingModel.findOne({
        where: {
          registerallow: "Payment_Details",
          masterdetailId: req.query.where.masterdetailId
        },
      });
      getPaymentConfig = await constants.parseJson(getPaymentConfig.text);

      for (let i = 0; i < getPaymentConfig.length; i++) {
        const element = getPaymentConfig[i];
        if (element.name === "PayU") {
          payu_money_config = element;
        }
      }

      var hashString = payu_money_config.config.PayUMerchantKey + // Merchant Key
        "|" + body.txnId + "|" + body.amount + "|" + body.productinfo + "|" + body.firstname + "|" + body.email + "|" + "||||||||||" +
        payu_money_config.config.PayUMerchantSalt; // Your salt value
      var sha = new jsSHA("SHA-512", "TEXT");
      sha.update(hashString);
      var hash = sha.getHash("HEX");
      return {
        hash: hash
      };

    } catch (error) {
      throw error;
    }
  };

  Order.googlepay = async (req) => {
    let settingModel = app.models.setting;
    let userModel = app.models.user;

    try {

      // Step 1: Define your Google Pay API version
      const baseRequest = {
        apiVersion: 2,
        apiVersionMinor: 0
      };

      // Step 2: Request a payment token for your payment provider
      const tokenizationSpecification = {
        type: 'PAYMENT_GATEWAY',
        parameters: {
          "gateway": "payu",
          "gatewayMerchantId": "YOUR_GATEWAY_MERCHANT_ID"
        }
      };

      // Step 3: Define supported payment card networks
      const allowedCardNetworks = ["AMEX", "DISCOVER", "INTERAC", "JCB", "MASTERCARD", "VISA"];

      // Step 4: Describe your allowed payment methods
      const allowedCardAuthMethods = ["PAN_ONLY", "CRYPTOGRAM_3DS"];

      // Step 4: Describe your allowed payment methods
      // 1
      const baseCardPaymentMethod = {
        type: 'CARD',
        parameters: {
          allowedAuthMethods: allowedCardAuthMethods,
          allowedCardNetworks: allowedCardNetworks
        }
      };
      // 2
      const cardPaymentMethod = Object.assign({
        tokenizationSpecification: tokenizationSpecification
      },
        baseCardPaymentMethod
      );

      // Step 5: Load the Google Pay API JavaScript library


      /**
       * Pradip Sir Payment5 Object
       *
       * {
        "transaction_no": "examplePaymentMethodToken",
        "other_transaction_details": {
          "apiVersionMinor": 0,
          "apiVersion": 2,
          "paymentMethodData": {
            "description": "Visa •••• 2283",
            "tokenizationData": {
              "type": "PAYMENT_GATEWAY",
              "token": "examplePaymentMethodToken"
            },
            "type": "CARD",
            "info": {
              "cardNetwork": "VISA",
              "cardDetails": "2283"
            }
          }
        },
        "pay_via": "GooglePay"
      }

       */


    } catch (error) {
      throw error;
    }
  };

  Order.getrecentorders = async (req) => {
    try {

      return await Order.find({
        where: {
          inshoppingcart: 0,
          orderstatus: await constants.ORDER_PENDING(req.query.where.masterdetailId),
          masterdetailId: req.query.where.masterdetailId
        },
        include: ["orderdetails", "user"],
        order: "created DESC",
        limit: 6
      });

    } catch (error) {
      throw error;
    }
  };

  function validDescription(desc) {
    const re = /^[a-zA-Z0-9_ ]*$/;
    return re.test(desc);
  }

  function getSum(total, num) {
    return total + num;
  }

  // validate pincode API : Parth dt_05-05-2021
  Order.validatePincode = async (req) => {
    var getPincodeDelivery;

    try {

      getPincodeDelivery = await constants.commonFindOneFunction({
        model: app.models.setting,
        whereObj: {
          registerallow: constants.SETTING_PINCODE_DELIVERY,
          masterdetailId: req.query.where.masterdetailId
        }
      });

      if (getPincodeDelivery && getPincodeDelivery.status === 1) {
        var pincodeData = JSON.parse(getPincodeDelivery.text);
        for (let i = 0; i < pincodeData.length; i++) {
          const element = pincodeData[i];
          if (element.pincode == req.query.pincode) {
            return true;
          }
        }
      }

      throw constants.createError(404, 'Sorry! Delivery is not available at your area.  Please change your Shipping Address.');

    } catch (error) {
      throw error;
    }
  }

  Order.generateInvoice = async (req, res) => {

    var orderData, pdfBuffer, accesstoken, userData;
    var notifyModel = app.models.notify;

    try {

      var getCode = await app.models.masterdetail.findOne({
        where: {
          id: req.query.where.masterdetailId
        }
      });

      var getProfileImageValue = await settingConstants.getMarchantSetting('profilepic', req.query.where.masterdetailId);

      accesstoken = await app.models.AccessToken.findOne({
        where: {
          id: req.query.accesstoken,
          masterdetailId: req.query.where.masterdetailId
        }
      });

      if (accesstoken) {
        userData = await app.models.user.findOne({
          where: {
            id: accesstoken.userId,
            masterdetailId: req.query.where.masterdetailId
          }
        });
        if (!userData) {
          throw constants.createError(400, "User not found");
        }
      } else {
        throw constants.createError(400, "Invalid Token");
      }

      var adminData = await app.models.user.findOne({
        where: {
          masterdetailId: userData.masterdetailId,
          roleId: constants.ADMIN_ROLEID
        }
      });

      orderData = await Order.findOne({
        where: {
          id: req.query.orderId,
          masterdetailId: req.query.where.masterdetailId
        },
        include: [{
          "relation": "orderdetails",
          "scope": {
            "include": {
              "relation": "product",
              "scope": {
                "deleted": "true"
              }
            }
          }
        }],
      });

      var customerData = await app.models.user.findOne({
        where: {
          id: orderData.userId,
          roleId: constants.USER_ROLEID,
          masterdetailId: req.query.where.masterdetailId
        }
      });

      var currency = await app.models.setting.findOne({
        where: {
          registerallow: constants.CURRENCY_LABLE,
          masterdetailId: req.query.where.masterdetailId
        }
      });

      // service charge data
      if (orderData.additionalchargedetails) {
        var chargesData;
        if (orderData.additionalchargedetails && typeof orderData.additionalchargedetails == 'string')
          chargesData = JSON.parse(orderData.additionalchargedetails);
        else
          chargesData = orderData.additionalchargedetails;

        orderData.label = chargesData.label
        orderData.type = chargesData.type
        orderData.typevalue = chargesData.typevalue
        orderData.charges = chargesData.charges
        orderData.symbol = (chargesData.type == 'isPercentage') ? "%" : "₹";
      }


      orderData.appname = adminData.companyname;
      orderData.gstin = adminData.gstin;
      orderData.currency = currency.text;
      orderData.customeremail = customerData.email;
      orderData.imagePath = app.get('serverConfig').API_URL + 'api/containers/profilepic-' + getCode.codename + '/download/' + getProfileImageValue;
      console.log(orderData.imagePath);

      if (!orderData.baseprice) {
        orderData.baseprice = orderData.totalamount;
        // discount
        if (orderData.discount) {
          let discount = JSON.parse(orderData.discount);
          orderData.baseprice = orderData.baseprice - discount.price;
        }
        // shippingprice
        if (orderData.shippingprice) orderData.baseprice = orderData.baseprice - orderData.shippingprice;
        //charges
        if (orderData.charges) orderData.baseprice = orderData.baseprice - orderData.charges;
        // gst
        if (orderData.tax) {
          let tax = JSON.parse(orderData.tax);
          if (tax.sgstPrice) orderData.baseprice = orderData.baseprice - tax.sgstPrice;
          if (tax.cgstPrice) orderData.baseprice = orderData.baseprice - tax.cgstPrice;
          if (tax.igstPrice) orderData.baseprice = orderData.baseprice - tax.igstPrice;
        }
        orderData.baseprice = orderData.baseprice.toFixed(2);
      }

      pdfBuffer = await createPDF({
        template: 'invoicepdf.ejs',
        dataToRender: {
          orderData
        },
        timeout: 1000000
      });

      res.setHeader('Content-Type', 'application/force-download');
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Type', 'application/download');
      res.setHeader('Content-Disposition', 'attachment;filename=Data.pdf');
      res.setHeader('Content-Transfer-Encoding', 'binary');

      var masterDetailsData = await app.models.masterdetail.findOne({
        where: {
          id: userData.masterdetailId
        }
      });

      var filename, timestamp;

      // Create Folders As Per Tenant name
      if (masterDetailsData) {
        var dir = 'server/containers/ordermedia-'
        if (!fs.existsSync(dir + masterDetailsData.codename)) {
          fs.mkdirSync(dir + masterDetailsData.codename);
        }
      }

      timestamp = moment().unix();
      // timestamp = moment().format("DD_MM_YYYY_HH_mm_ss_a");
      filename = "./server/containers/ordermedia-" + masterDetailsData.codename + "/" + orderData.orderno + "_" + timestamp + ".pdf"

      fs.writeFile(filename, pdfBuffer, "binary", async function (err) {
        if (err) {
          console.log(err);
        } else {
          console.log("The file was saved!");
          orderData.filename = filename;
          orderData.adminEmail = adminData.email;
          await notifyModel.share("INVOICE/EMAIL", orderData, {
            masterdetailId: null
          });
        }
      });
      res.send(pdfBuffer);
    } catch (error) {
      throw error;
    }

  }

  Order.uploadOrderInvoice = async (req, res) => {

    var orderData, pdfBuffer, userData;
    var notifyModel = app.models.notify;
    try {

      orderData = await Order.findOne({
        where: {
          id: req.body.orderId,
          masterdetailId: req.query.where.masterdetailId
        },
        include: [{
          "relation": "orderdetails",
          "scope": {
            "include": {
              "relation": "product",
              "scope": {
                "deleted": "true"
              }
            }
          }
        }]
      });

      var adminData = await app.models.user.findOne({
        where: {
          masterdetailId: req.query.where.masterdetailId,
          roleId: constants.ADMIN_ROLEID
        }
      });

      // Update Ordermedia
      await Order.updateAll({
        id: req.body.orderId
      }, {
        ordermedia: req.body.invoice
      });

      var customerData = await app.models.user.findOne({
        where: {
          id: orderData.userId,
          roleId: constants.USER_ROLEID,
          masterdetailId: req.query.where.masterdetailId
        }
      });

      var currency = await app.models.setting.findOne({
        where: {
          registerallow: constants.CURRENCY_LABLE,
          masterdetailId: req.query.where.masterdetailId
        }
      });
      orderData.appname = adminData.companyname;
      orderData.gstin = adminData.gstin;
      orderData.currency = currency.text;
      orderData.customeremail = customerData.email;

      var masterDetailsData = await app.models.masterdetail.findOne({
        where: {
          id: req.query.where.masterdetailId
        }
      });

      var filename, timestamp;
      timestamp = moment().unix();
      filename = "./server/containers/ordermedia-" + masterDetailsData.codename + "/" + req.body.invoice

      orderData.filename = filename;
      orderData.adminEmail = adminData.email;
      await notifyModel.share("INVOICE/EMAIL", orderData, {
        masterdetailId: null
      });

      return {
        status: 200,
        msg: 'File sent successfully.'
      }

    } catch (error) {
      throw error;
    }

  }

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
      // "format": "A4",
      "timeout": options.timeout
    }

    return new Promise((resolve, reject) => {
      pdf.create(html_body, config).toBuffer((err, buffer) => {
        if (err) reject(err);
        resolve(buffer);
      });
    });

  };

  async function getSetting(params) {
    return await app.models.setting.findOne({
      where: {
        registerallow: params.registerallow,
        masterdetailId: params.masterdetailId
      }
    });
  }

  async function checkVariationQuantity(productVariation, currentVariation) {
    if (productVariation.length > 0) {
      var returnVariation;
      var returnIndex;
      for (let j = 0; j < productVariation.length; j++) {
        const element = productVariation[j];
        if (element.variation.length > 0) {
          var elementVariation = element.variation;
          for (let k = 0; k < elementVariation.length; k++) {
            const elementKey = elementVariation[k].key;
            const elementKValue = elementVariation[k].value;
            if (elementKey === currentVariation[k].key && elementKValue === currentVariation[k].value) {
              returnVariation = element;
              returnIndex = j;
              return { variation: returnVariation, index: returnIndex };
            }
          }
        }
      }

    }
  }

};


