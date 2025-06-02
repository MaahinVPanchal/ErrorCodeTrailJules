var app = require("../server/server");
const shortUrl = require("node-url-shortener");
const logger = require("./logger");
// const vision = require('@google-cloud/vision');
// const client = new vision.ImageAnnotatorClient();

module.exports = {
  ORDER_PENDING: async (masterdetailId) => {
    var orderstatusModel = app.models.orderstatus;
    var result = await orderstatusModel.findOne({
      where: {
        status: "PENDING",
        masterdetailId: masterdetailId
      }
    });
    return result.id;
  }, // pending
  ORDER_COMFIRMED: async (masterdetailId) => {
    var orderstatusModel = app.models.orderstatus;
    var result = await orderstatusModel.findOne({
      where: {
        status: "CONFIRMED",
        masterdetailId: masterdetailId
      }
    });
    return result.id;
  }, // comfirmed
  ORDER_INPROGRESS: async (masterdetailId) => {
    var orderstatusModel = app.models.orderstatus;
    var result = await orderstatusModel.findOne({
      where: {
        status: "INPROGRESS",
        masterdetailId: masterdetailId
      }
    });
    return result.id;
  }, //inprogress
  ORDER_DELIVERED: async (masterdetailId) => {
    var orderstatusModel = app.models.orderstatus;
    var result = await orderstatusModel.findOne({
      where: {
        status: "DELIVERED",
        masterdetailId: masterdetailId
      }
    });
    return result.id;
  }, // delivered
  ORDER_CANCELLED: async (masterdetailId) => {
    var orderstatusModel = app.models.orderstatus;
    var result = await orderstatusModel.findOne({
      where: {
        status: "CANCELLED",
        masterdetailId: masterdetailId
      }
    });
    return result.id;
  }, // cancelled
  ORDER_REJECTED: async (masterdetailId) => {
    var orderstatusModel = app.models.orderstatus;
    var result = await orderstatusModel.findOne({
      where: {
        status: "REJECTED",
        masterdetailId: masterdetailId
      }
    });
    return result.id;
  }, // rejected

  user: "SufalamTech", //your username
  password: "12345", //your password
  senderid: "Suflam",
  entityId: "1301159159830379832",

  defaultTenantId: "752c80a9-e15f-416a-b79b-a0168ec15402",

  // default image dt_13-04-2021
  noImageFound: "noimagefound.png",
  defaultCategory: "default_category.png",
  defaultUser: "defaultuser.jpeg",
  DEFAULT: "Default",
  DEFAULT_IMAGE_COLLECTION: "noimagefound.png",

  errorReportEmailLive: [
    "akibjavid.dahya@sufalamtech.com",
    "darshak.prajapati@sufalamtech.com",
    "support@sufalamtech.com"
  ],

  commonEmailForTest: [
    // "akibjavid.dahya@sufalamtech.com",
    // 'darshak.prajapati@sufalamtech.com'
  ],

  newMerchantEmailLive: [
    "akibjavid.dahya@sufalamtech.com",
    "darshak.prajapati@sufalamtech.com",
    "pranav@sufalamtech.com",
    "support@sufalamtech.com",
    "omdevsinh@sufalamtech.com",
    "sales+new@sufalamtech.com"
  ],

  // emailTemplate: 'Dear [name], <br><br> [notification] <br><br>Thank You.<br>BizOn Team',

  customdomainEmailLive: [
    "support@sufalamtech.com",
    "akibjavid.dahya@sufalamtech.com",
    "darshak.prajapati@sufalamtech.com",
    "pranav@sufalamtech.com",
    "omdevsinh@sufalamtech.com"
  ],

  ORDERNOTIFICATION: 1,
  ADDTOCARTNOTIFICATION: 2,
  LOGOUTNOTIFICATION: 3,
  ISINQUIRYSTATUSID: 4,
  INSHOPPINGCART: 1,

  ADMIN_ROLEID: 1,
  USER_ROLEID: 2,
  SALESMAN_ROLEID: 3,
  DEALER_ROLEID: 4,
  GUEST_ROLEID: 5,
  SUPER_ADMIN_ROLEID: 6,

  // Admin Panel Theme Color Codes : Parth dt_14-04-2021
  ColorCodes: {
    webapp: [{
      id: 1,
      colorcode: "#ff4c3b",
      selected: true,
    }, {
      id: 2,
      colorcode: "#3fdda7",
      selected: false,
    }, {
      id: 3,
      colorcode: "#f0b54d",
      selected: false,
    }, {
      id: 4,
      colorcode: "#e4604a",
      selected: false,
    }, {
      id: 5,
      colorcode: "#d4b196",
      selected: false,
    }, {
      id: 6,
      colorcode: "#866e6c",
      selected: false,
    }, {
      id: 7,
      colorcode: "#cc2121",
      selected: false,
    }, {
      id: 8,
      colorcode: "#dc457e",
      selected: false,
    }, {
      id: 9,
      colorcode: "#6d7e87",
      selected: false,
    }, {
      id: 10,
      colorcode: "#fa869b",
      selected: false,
    }, {
      id: 11,
      colorcode: "#81ba00",
      selected: false,
    }, {
      id: 12,
      colorcode: "#fe816d",
      selected: false,
    }, {
      id: 13,
      colorcode: "#01effc",
      selected: false,
    }, {
      id: 14,
      colorcode: "#5d7227",
      selected: false,
    }, {
      id: 15,
      colorcode: "#ff9944",
      selected: false,
    }, {
      id: 16,
      colorcode: "#5fcbc4",
      selected: false,
    }, {
      id: 17,
      colorcode: "#e38888",
      selected: false,
    }, {
      id: 18,
      colorcode: "#000000",
      selected: false,
    }]
  },

  REDIRECT_URL: "https://managebizon.sufalam.live/",
  WEBSTORE_DOMAIN: "https://bizon.sufalam.live/",

  SHIPPINGOPTIONS_LABLE: "Shipping_Options",
  MERCHANTINFORMATION_LABLE: "Merchant_Information",
  GROUPWISEGSTCONFIGURATION_LABLE: "Group_Wise_GST_Configuration",
  CURRENCY_LABLE: "CURRENCY",
  CATALOGUEJEWELLARY_LABLE: "Catalogue_Jewellary",
  CATALOGUE_FMCG_LABLE: "Catalogue_FMCG",
  CATALOGUE_FABRIC_LABLE: "Catalogue_FABRIC",
  ORDER_VIA_WHATSAPP_LABLE: "ORDER_VIA_WHATSAPP",
  APP_NAME_LABLE: "App Name",
  ALL_CATALOGUES_LABLE: "ALL_CATALOGUES",
  IS_INQUIRY_LABLE: "IS_INQUIRY",
  ALLOW_LABLE: "ALLOW",
  ADMIN_APPROVE_LABLE: "ADMINAPPROVE",
  ADMIN_LABLE: "ADMIN",
  OFFER_BANNER_LABLE: "Offer_Banners",
  ALL_PLANS_LABLES: "ALL_PLANS_LABLES",
  PACKAGE_DETAILS_LABEL: "PACKAGE_DETAILS",
  CURRENT_MERCHANT_PLAN_LABEL: "CURRENT_MERCHANT_PLAN",
  USER_MANAGEMENT_KEY: "Orders & Customer Management",
  NUMBER_OF_STAFF_ACCOUNT_KEY: "No of Staff Accounts",
  RECEIVE_ORDERS_ON_WHATSAPP_KEY: "Receive Orders on WhatsApp",
  settingModel: app.models.setting,
  SIGNUP_OPTIONS_LABLE: "Signup_Options",
  CUSTOMER_GROUP_KEY: "Customer Groups",
  INQUIRY_MANAGEMENT_KEY: "Inquiry Management",
  ORDER_MANAGEMENT_KEY: "Orders & Customer Management",
  CUSTOMER_MANAGEMENT_KEY: "Orders & Customer Management",
  CATEGORY_MANAGEMENT_KEY: "Catalogue Management",
  NUMBER_OF_USER_ACCOUNT_KEY: "No of Customers",
  UNLIMITED_LABEL: "Unlimited",
  SMS_CREDITS_KEY: "SMS Credits",
  SUFALAM_RAZORPAY_CREDENTIALS_LABEL: "SUFALAM_RAZORPAY_CREDENTIALS",
  DISK_SPACE_KEY: "Disk Space (for product images/brochure)",
  NUMBER_OF_PRODUCT_KEY: "No of Products",
  PRODUCT_UNIT_LABEL: "Product_Unit",
  SETTING_PINCODE_DELIVERY: "PINCODE_DELIVERY",
  INQUIRY_ACTION_KEY: "Inquiry_Action",
  THEME_CONFIG_KEY: "THEME_CONFIG",
  IS_NOTIFY_KEY: "IS_NOTIFY",
  CONTACT_US_KEY: "Contact_US",
  PRODUCT_VARIATION_KEY: "Product_Variation",
  PAYMENT_DETAILS_KEY: "Payment_Details",
  LOGIN_OPTIONS_KEY: "Login_Options",
  COLORCODE_KEY: "Color_Code",
  BARCODE_QRCODE_KEY: "BARCODE_QRCODE",
  FIXED_PRODUCTDETAILS_KEY: "Fixed_Productdetails",
  MANIFEST_DETAILS_KEY: "MANIFEST_DETAILS",
  IS_STOCK_KEY: "IS_STOCK",
  IS_PRICE_KEY: "IS_PRICE",
  SERVICE_CHARGE_KEY: "SERVICE_CHARGE",
  SETTING_TENANT_CONFIG: "TENANT_CONFIG",
  SETTING_NEXT_ACTION: "next_action",
  SETTING_INDUSTRY: "industry",
  SETTING_PAYMENT_GATEWAY_INTEGRATION: "Payment Gateway Integration",
  SETTING_SHIPPING_API_INTEGRATION: "Shipping API Integration",
  SETTING_GENERAL_CONFIG: "GENERAL_CONFIGURATION",
  SETTING_LOCATION_DETAILS: "LOCATION_DETAILS",
  CUSTOM_DOMAIN_MAPPING_KEY: "CUSTOM_DOMAIN_MAPPING",
  SETTING_INSTANCE_CONFIGURATION: "INSTANCE_CONFIGURATION",
  SETTING_OPEN_STORE: "OPEN_STORE",

  // Models Constants
  ORDER_MODEL: app.models.order,
  ORDERSTATUS_MODEL: app.models.orderstatus,
  PRODUCT_MODEL: app.models.product,
  PRODUCTMEDIA_MODEL: app.models.productmedia,
  SETTING_MODEL: app.models.setting,
  USER_MODEL: app.models.user,
  CATEGORY_MODEL: app.models.category,

  INVOICE_PAID: async (masterdetailId) => {
    var invoicestatusModel = app.models.invoicestatus;
    var result = await invoicestatusModel.findOne({
      where: {
        name: "PAID",
        masterdetailId: masterdetailId
      }
    });
    return result.id;
  }, // paid
  INVOICE_UNPAID: async (masterdetailId) => {
    var invoicestatusModel = app.models.invoicestatus;
    var result = await invoicestatusModel.findOne({
      where: {
        name: "UNPAID",
        masterdetailId: masterdetailId
      }
    });
    return result.id;
  }, // unpaid
  INVOICE_DRAFT: async (masterdetailId) => {
    var invoicestatusModel = app.models.invoicestatus;
    var result = await invoicestatusModel.findOne({
      where: {
        name: "DRAFT",
        masterdetailId: masterdetailId
      }
    });
    return result.id;
  }, //inprogress
  INVOICE_PARTIALLY_PAID: async (masterdetailId) => {
    var invoicestatusModel = app.models.invoicestatus;
    var result = await invoicestatusModel.findOne({
      where: {
        name: "PARTIALLY_PAID",
        masterdetailId: masterdetailId
      }
    });
    return result.id;
  }, // partially paid

  // Log Variable
  PATTERN_LOG: "----------------------------------",

  default_groupId: async (masterdetailId) => {
    var groupModel = app.models.group;
    var result = await groupModel.findOne({
      where: {
        name: "Default",
        masterdetailId: masterdetailId
      }
    });
    return result.id;
  },

  executeRawQuery: (query) => {
    return new Promise((resolve, reject) => {
      app.datasources.mysql.connector.execute(query, null, (err, result) => {
        if (err) reject(err);
        resolve(result);
      });
    });
  },

  createError: (errorCode, msg) => {
    var err = new Error(msg);
    err.statusCode = errorCode;
    throw err;
  },

  // Parse JSON
  parseJson: (e) => {
    return JSON.parse(e);
  },

  // stringify JSON
  stringifyJson: (e) => {
    return JSON.stringify(e);
  },

  // User Find Query
  userFind: async (e) => {
    var userModel = app.models.user;
    var result = await userModel.find({
      where: e
    });
    return result;
  },

  // User Find Query
  settingFindQuery: async (e) => {
    var settingModel = app.models.setting;
    var result = await settingModel.find({
      where: e
    });
    return result;
  },

  settingFindOneQuery: async (e) => {
    var result = await app.models.setting.findOne({
      where: e
    });
    return result;
  },

  settingFindByIdQuery: async (e) => {
    var settingModel = app.models.setting;
    var result = await settingModel.findById(e);
    return result;
  },

  getCurrentMarchantPlan: async (registerallow, status, masterdetailId) => {
    var result = await app.models.setting.findOne({
      where: {
        registerallow: registerallow,
        status: status,
        masterdetailId: masterdetailId
      }
    });
    return result;
  },

  commonCheckPlanCriteriaFeatures: async (currentPlanData, masterdetailId, restrictionKey) => {
    currentPlanData = JSON.parse(currentPlanData.text);
    for (let i = 0; i < currentPlanData.features.length; i++) {
      const element = currentPlanData.features[i];
      if (element.key === restrictionKey) {
        return element.value;
      }
    }
  },

  getCredentials: async () => {
    var getRazorpayConfig = await app.models.setting.findOne({
      where: {
        registerallow: "SUFALAM_RAZORPAY_CREDENTIALS"
      }
    });
    return (getRazorpayConfig = JSON.parse(getRazorpayConfig.text));
  },

  checkUrlInPlanConfiguration: async (masterdetailId, restrictionKey, url, method) => {
    var settingModel = app.models.setting;
    var response = {};
    if (
      // Groups
      (url === "/api/groups" && method == "POST") ||
      (url.includes("/api/groups/") && method == "PATCH") ||
      (url.includes("/api/groups/") && method == "DELETE") ||
      (url.includes("/api/groups/") && method == "GET") ||
      (url.includes("/api/groups?") && method == "GET") ||
      (url.includes("/api/groups?isWeb=true&") && method == "GET") ||
      // Inquiries
      (url === "/api/inquiries" && method == "POST") ||
      (url.includes("/api/inquiries/") && method == "PATCH") ||
      (url.includes("/api/inquiries/") && method == "DELETE") ||
      (url.includes("/api/inquiries/") && method == "GET") ||
      (url.includes("/api/inquiries?") && method == "GET") ||
      (url.includes("/api/inquiries?isWeb=true&") && method == "GET") ||
      // Users
      (url === "/api/users" && method == "POST") ||
      (url.includes("/api/users/") && method == "PATCH") ||
      (url.includes("/api/users/") && method == "DELETE") ||
      (url.includes("/api/users/") && method == "GET") ||
      (url.includes("/api/users?") && method == "GET") ||
      (url.includes("/api/users?isWeb=true&") && method == "GET") ||
      // Orders
      (url === "/api/orders" && method == "POST") ||
      (url.includes("/api/orders/") && method == "PATCH") ||
      (url.includes("/api/orders/") && method == "DELETE") ||
      (url.includes("/api/orders/") && method == "GET") ||
      (url.includes("/api/orders?") && method == "GET") ||
      (url.includes("/api/orders?isWeb=true&") && method == "GET") ||
      // Categories
      (url === "/api/categories" && method == "POST") ||
      (url.includes("/api/categories/") && method == "PATCH") ||
      (url.includes("/api/categories/") && method == "DELETE") ||
      (url.includes("/api/categories/") && method == "GET") ||
      (url.includes("/api/categories?") && method == "GET")
      // (url.includes('/api/categories?isWeb=true&') && method == 'GET')
    ) {
      console.log(url);
      var currentPlanData = await settingModel.findOne({
        where: {
          registerallow: "CURRENT_MERCHANT_PLAN",
          status: true,
          masterdetailId: masterdetailId
        }
      });
      // Parse JSON
      currentPlanData = JSON.parse(currentPlanData.text);
      // Find key Match & Return Data
      for (let i = 0; i < currentPlanData.features.length; i++) {
        const element = currentPlanData.features[i];
        if (element.key === restrictionKey) {
          if (element.value === false) {
            return (response = {
              statusCode: 403
            });
          }
        }
      }
    }
  },

  shortUrl: async (originalUrl) => {
    var data = await new Promise((resolve, reject) => {
      shortUrl.short(originalUrl, (err, result) => {
        if (err) reject(err);
        resolve(result);
      });
    });
    return data;
  },

  // common Find query for all models : Parth
  commonFindFunction: async (params) => {
    try {
      return await params.model.find({
        where: params.whereObj
      });
    } catch (error) {
      throw error;
    }
  },

  // common FindOne query for all models : Parth
  commonFindOneFunction: async (params) => {
    try {
      return await params.model.findOne({
        where: params.whereObj
      });
    } catch (error) {
      throw error;
    }
  },

  // common FindById query for all models : Parth
  commonFindByIdFunction: async (params) => {
    try {
      return await params.model.findById({
        where: params.whereObj
      });
    } catch (error) {
      throw error;
    }
  },

  // function to get Android Push Notification sever key  : Parth dt_12-04-2021
  getAndroidPushServerKey: async (deviceToken, masterdetailId) => {
    try {
      // get user id from device token
      var userData = await app.models.usermetaauth.findOne({
        where: {
          devicetoken: deviceToken,
          masterdetailId: masterdetailId
        },
        include: ["user"]
      });

      // get server key.
      var serverKey = await app.models.setting.findOne({
        where: {
          registerallow: "TENANT_CONFIG",
          masterdetailId: masterdetailId
        }
      });
      var text = JSON.parse(serverKey.text); // parse text string into JSON
      // send server key according to roleId.
      if (userData.__data.user.roleId == 2) {
        var key = text.android_customer_app_server_key;
      }
      if (userData.__data.user.roleId == 3) {
        var key = android_salesman_app_server_key;
      }
      return key;
    } catch (error) {
      throw error;
    }
  },

  // function to get IOS Push Notification sever key  : Parth dt_21-04-2021
  getIosPushKeys: async (masterdetailId) => {
    try {
      // get server key.
      var serverKey = await app.models.setting.findOne({
        where: {
          registerallow: "TENANT_CONFIG",
          masterdetailId: masterdetailId
        }
      });
      var text = JSON.parse(serverKey.text); // parse text string into JSON
      return text;
    } catch (error) {
      throw error;
    }
  },

  getFreePlanDetails: async (planDetails, requestedKey, isFeatures) => {
    if (isFeatures) {
      for (let i = 0; i < planDetails.features.length; i++) {
        const element = planDetails.features[i];
        if (element.key === requestedKey) {
          return element.value;
        }
      }
    }
  },

  // for adding logs into log files using winston logger.
  addLog: (functionName, key, value) => {
    logger.commonLog.info({
      functionName: functionName,
      Key: key,
      value: value
      // TODO : Add date time
    });
  },

  // get service charge data
  async getServiceCharge(params) {

    let { setting } = app.models;

    try {
      var serviceChargeData = await setting.findOne({
        where: {
          registerallow: this.SERVICE_CHARGE_KEY,
          masterdetailId: params.masterdetailId,
          status: true
        }
      });

      if (serviceChargeData) {
        var text = JSON.parse(serviceChargeData.text);
        var isPercentage = false;
        var amount, charges, label, typevalue, type = 'isAmount';
        text.forEach(e => {
          console.log(e);
          if (e.key == 'label') {
            label = e.value;
          }

          if (e.key == 'isPercentage' && e.value == true) {
            isPercentage = true;
            type = 'isPercentage'
          }

          if (isPercentage && e.key == 'percentage') {
            typevalue = e.value;
            charges = (params.totalamount * e.value) / 100;
            amount = params.totalamount + charges;
          }

          if (!isPercentage && e.key == 'amount') {
            charges = e.value;
            amount = params.totalamount + charges;
            typevalue = e.value;
          }

        });

        let additionalChargeDetails = { label, type, typevalue, charges }

        return { amount, charges, additionalChargeDetails };
      } else {
        return null;
      }

    } catch (error) {
      throw error;
    }
  },

  /**
   * Calculate GST before placing order
   * */
  async calculateGST(masterdetailId, baseprice, orderAddress) {
    var totalamount = 0;
    var tax = {};
    // Check Jewellery catalogue is not active
    var isJewelleryCatalogueActive = await this.commonFindOneFunction({
      model: app.models.setting,
      whereObj: {
        registerallow: this.CATALOGUEJEWELLARY_LABLE,
        masterdetailId
      }
    });

    if (isJewelleryCatalogueActive && isJewelleryCatalogueActive.status === 0) {
      // Get GST Setting
      var getGSTSetting = await this.commonFindOneFunction({
        model: app.models.setting,
        whereObj: {
          registerallow: this.MERCHANTINFORMATION_LABLE,
          masterdetailId
        }
      });

      if (getGSTSetting) {
        getGSTSetting = JSON.parse(getGSTSetting.text);
        if (getGSTSetting.enablegst === 1) {
          var sgst = (baseprice * getGSTSetting.SGST) / 100;
          var cgst = (baseprice * getGSTSetting.CGST) / 100;
          // Set Tax JSON
          tax.cgst = getGSTSetting.CGST;
          tax.cgstPrice = cgst;
          tax.sgst = getGSTSetting.SGST;
          tax.sgstPrice = sgst;

          // Calculation if IGST
          if (orderAddress) {
            orderAddress = JSON.parse(orderAddress);
            if (Object.keys(orderAddress).length !== 0 && orderAddress.billingaddress) {
              // get order billing
              var billingaddress = orderAddress.billingaddress;
              // Get User country name
              var getCountryName = await this.commonFindOneFunction({
                model: app.models.state,
                whereObj: {
                  id: billingaddress.countryId,
                  masterdetailId
                }
              });
              if (getCountryName.name !== getGSTSetting.countryname) {
                tax = {};
                var igst = (baseprice * getGSTSetting.IGST) / 100;
                // set tax json
                tax.igst = getData.IGST;
                tax.igstPrice = igst;
              }
            }
          }
        } else {
          return;
        }
      }
      return tax;
    } else {
      return;
    }
  },

  // label detection
  // getGCloudAPILable: (imageName, id) => {
  //   var producttagsModel = app.models.producttags;

  //   client
  //     .labelDetection(`./server/containers/productmedia/${imageName}`)
  //     .then((response) => {
  //       var labels = response[0].labelAnnotations;

  //       labels.forEach((label) => {
  //         producttagsModel.create({
  //           productId: id,
  //           label: label.description
  //         });
  //       });

  //     })
  //     .catch(err => {
  //       console.error(err);
  //     });
  // },

  // // text detection
  // getGCloudAPIText: (imageName, id) => {
  //   var producttagsModel = app.models.producttags;

  //   client
  //     .textDetection(`./server/containers/productmedia/${imageName}`)
  //     .then((response) => {
  //       var texts = response[0].textAnnotations;

  //       texts.forEach((label) => {
  //         producttagsModel.create({
  //           productId: id,
  //           text: label.description
  //         });
  //       });

  //     })
  //     .catch(err => {
  //       console.error(err);
  //     });
  // },

  // // logo detection
  // getGCloudAPIText: (imageName, id) => {
  //   var producttagsModel = app.models.producttags;

  //   client
  //     .logoDetection(`./server/containers/productmedia/${imageName}`)
  //     .then((response) => {
  //       var logos = response[0].logoAnnotations;

  //       logos.forEach((label) => {
  //         producttagsModel.create({
  //           productId: id,
  //           logo: label.description
  //         });
  //       });

  //     })
  //     .catch(err => {
  //       console.error(err);
  //     });
  // },
};
