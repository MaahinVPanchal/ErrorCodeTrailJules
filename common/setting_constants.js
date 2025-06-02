var app = require('../server/server');
var constants = require('../common/const')

module.exports = {
  ADDRESS_CONFIGURATION: 'ADDRESS_CONFIGURATION',
  PAYMENT_DETAILS: 'Payment_Details',
  OPEN_STORE: 'OPEN_STORE',
  TENANT_CONFIG: 'TENANT_CONFIG',
  PRODUCT_VARIATION: "Product_Variation",
  PAYMENT_STATUS: 'PAYMENT_STATUS',
  PRIVACYPOLICY: 'privacypolicy',
  ORDER_VIA_WHATSAPP: "ORDER_VIA_WHATSAPP",
  FIXED_PRODUCT_DETAILS: "Fixed_Productdetails",
  CATALOGUE_JEWELLARY: "Catalogue_Jewellary",
  INQUIRY_ACTION: "Inquiry_Action",
  COLLECTION: "COLLECTION",
  COLLECTION_CRITERIA: "CRITERIA",
  COLLECTION_CONDITION: "CONDITION",
  IS_INQUIRY: 'IS_INQUIRY',
  SHIPPING_OPTIONS: 'Shipping_Options',
  PRODUCT_VARIATION: "Product_Variation",
  MENU_CATEGORIES: 'MENU_CATEGORIES',
  // Notification Types
  ORDER_INPROGRESS: 'ORDER/INPROGRESS',
  ORDER_PENDING: 'ORDER/PENDING',
  ORDER_CONFIRMED: 'ORDER/COMFIRMED',
  ORDER_CANCELLED: 'ORDER/CANCELLED',
  ORDER_REJECTED: 'ORDER/REJECTED',
  ORDER_DELIVERED: 'ORDER/DELIVERED',

  // Orderstatus
  ORDERSTATUS_INPROGRESS: 'INPROGRESS',
  ORDERSTATUS_PENDING: 'PENDING',
  ORDERSTATUS_CONFIRMED: 'CONFIRMED',
  ORDERSTATUS_CANCELLED: 'CANCELLED',
  ORDERSTATUS_REJECTED: 'REJECTED',
  ORDERSTATUS_DELIVERED: 'DELIVERED',

  ORDER_CART: 1,

  ANDROID_LANGUAGE_KEY: 'Android_Language',
  IOS_LANGUAGE_KEY: 'Language',

  FILE_UPLOAD_KEY: 'uploadFilePlatform',
  FILE_UPLOAD_TO_S3: 'S3',

  ADMIN_ROLEID: 1,

  // Server Setting Keys
  ENABLE_SADAD_PAYMENT_WHEN_SERVER_RESTART: 'isSadadDefaultPaymentGateway',
  ENABLE_SADAD_PAYMENT_WHEN_CREATE_INSTANCE: 'isKeepSadadPaymentGatewayEnable',
  ENABLE_OPEN_STORE: 'enableOpenstore',
  SET_STATE_NOT_VISIBLE: 'setStateNOTVisible',
  IS_CREATE_FOLDER_IN_S3_BUCKET: 'isCreateFolderUnderS3',

  PAYMENT_DETAILS_JSON: [{
    name: "Paytm",
    paymenttype: "",
    status: 0,
    config: {
      id: "",
      PaytmMerchantID: "",
      MERCHANT_KEY: ""
    }
  }, {
    name: "Paypal",
    paymenttype: "",
    status: 0,
    config: {
      id: "",
      PaypalClientToken: "",
      merchantId: "",
      publicKey: "",
      privateKey: ""
    }
  }, {
    name: "RazorPay",
    paymenttype: "razorpay_config",
    status: 0,
    config: {
      id: "",
      RazorPaykey: "",
      key_id: "",
      key_secret: ""
    }
  }, {
    name: "Sadad",
    paymenttype: "",
    status: 1,
    config: {
      id: ""
    }
  }, {
    name: "PayU",
    paymenttype: "",
    status: 0,
    config: {
      id: "",
      PayUMerchantID: "",
      PayUMerchantSalt: "",
      PayUMerchantKey: ""
    }
  }, {
    name: "GooglePay",
    paymenttype: "",
    status: 0,
    config: {
      id: ""
    }
  }, {
    name: "Apple",
    paymenttype: "",
    status: 0,
    config: {
      id: ""
    }
  }, {
    name: "COD",
    paymenttype: "Cash",
    status: 1,
    config: {}
  }],

  ADDRESS_CONFIGURATION_JSON: [{
    id: 1,
    field_name: "name",
    visible: 1,
    mandatory: 1,
    display_text: "Name"
  }, {
    id: 2,
    field_name: "mobile_number",
    visible: 1,
    mandatory: 1,
    display_text: "Mobile Number"
  }, {
    id: 3,
    field_name: "email_address",
    visible: 1,
    mandatory: 1,
    display_text: "Email Address"
  }, {
    id: 4,
    field_name: "company_name",
    visible: 1,
    mandatory: 0,
    display_text: "Company Name"
  }, {
    id: 5,
    field_name: "gstin",
    visible: 1,
    mandatory: 0,
    display_text: "GSTIN"
  }, {
    id: 6,
    field_name: "address_line_1",
    visible: 1,
    mandatory: 1,
    display_text: "Address Line 1"
  }, {
    id: 7,
    field_name: "address_line_2",
    visible: 1,
    mandatory: 1,
    display_text: "Address Line 2"
  }, {
    id: 8,
    field_name: "landmark",
    visible: 1,
    mandatory: 1,
    display_text: "Landmark"
  }, {
    id: 9,
    field_name: "pincode",
    visible: 1,
    mandatory: 1,
    display_text: "Pincode"
  }, {
    id: 10,
    field_name: "country",
    visible: 1,
    mandatory: 1,
    display_text: "Country"
  }, {
    id: 11,
    field_name: "state",
    visible: 0,
    mandatory: 0,
    display_text: "State"
  }, {
    id: 12,
    field_name: "city",
    visible: 1,
    mandatory: 1,
    display_text: "City"
  }, {
    id: 13,
    field_name: "zone_number",
    visible: 1,
    mandatory: 1,
    display_text: "Zone Number"
  }, {
    id: 14,
    field_name: "street Number",
    visible: 1,
    mandatory: 1,
    display_text: "Street Number"
  }, {
    id: 15,
    field_name: "building_number",
    visible: 1,
    mandatory: 1,
    display_text: "Building Number"
  }, {
    id: 16,
    field_name: "unit_number",
    visible: 1,
    mandatory: 0,
    display_text: "Unit Number"
  }],

  // QATAR_ARABIC: "دولة قطر",
  // QATAR_CITY_LIST: ["الخور", "الوكرة", "مسيعيد", "الزبارة", "الريان", "خور العديد", "أم صلال محمد", "الشمال", "الرويس", "الجميل", "الركيات", "الدوحة"],
  QATAR_ARABIC: "Qatar",
  QATAR_CITY_LIST: ["Doha", "Ar Rayyan", "Umm Salal Muhammad", "Al Wakrah", "Al Khawr", "Ash Shihaniyah", "MusayId", "Madinat ash Shamal", "Al Wukayr", "Az ZaAyin", "Umm Salal Ali", "Duhail", "Dukhan"],

  settingFindOneQuery: async (e) => {
    return await app.models.setting.findOne({
      where: e
    });
  },

  setSadadPaymentConfigurationAsDefault: async () => {

    var settingModel = app.models.setting;
    var masterdetailModel = app.models.masterdetail;
    var getPaymentDetailsSetting;
    var parseText;

    /**
     * 1. Get All Masterdetail (Instances)
     * 2. Get All Payment Gateway Instance wise
     * 3. Update Status Of Sadad Payment
     */

    var masterdetailData = await masterdetailModel.find();

    if (masterdetailData.length > 0) {
      for (let i = 0; i < masterdetailData.length; i++) {

        const element = masterdetailData[i];

        getPaymentDetailsSetting = await settingModel.findOne({
          where: {
            masterdetailId: element.id,
            registerallow: 'Payment_Details'
          }
        });

        if (getPaymentDetailsSetting && getPaymentDetailsSetting.text) {
          parseText = JSON.parse(getPaymentDetailsSetting.text);

          if (parseText.length > 0) {
            parseText.filter(async item => item.name === 'Sadad' ? item.status = 1 : item.status = 0);
            await settingModel.updateAll({
              masterdetailId: element.id,
              registerallow: 'Payment_Details'
            }, {
              text: JSON.stringify(parseText)
            });
            constants.addLog('setSadadPaymentConfigurationAsDefault', 'PAYMENT_DETAILS', 'Business Name - ' + element.fullname + ' , Master Id - ' + element.id);
          }

        }

      }
    }

  },

  enableOpenStoreByDefault: async () => {

    var settingModel = app.models.setting;
    var masterdetailModel = app.models.masterdetail;
    var getOpenstoreSetting;

    /**
     * 1. Get All Masterdetail (Instances)
     * 2. Get All Openstore Instance wise
     * 3. Update Status
     */

    var masterdetailData = await masterdetailModel.find();

    if (masterdetailData.length > 0) {
      for (let i = 0; i < masterdetailData.length; i++) {

        const element = masterdetailData[i];

        getOpenstoreSetting = await settingModel.findOne({
          where: {
            masterdetailId: element.id,
            registerallow: 'OPEN_STORE'
          }
        });

        if (getOpenstoreSetting) {
          await settingModel.updateAll({
            masterdetailId: element.id,
            registerallow: 'OPEN_STORE',
            id: getOpenstoreSetting.id
          }, {
            status: 1
          });
          constants.addLog('By Default Enable Openstore', 'OPEN_STORE', 'Business Name - ' + element.fullname + ' , Master Id - ' + element.id);
        }

      }

    }

  },

  enableEmailBasedLoginByDefault: async () => {
    var settingModel = app.models.setting;
    var masterdetailModel = app.models.masterdetail;
    var getTenantConfigSetting;
    var masterdetailData = await masterdetailModel.find();
    var parseText;

    if (masterdetailData.length > 0) {
      for (let i = 0; i < masterdetailData.length; i++) {
        const element = masterdetailData[i];
        getTenantConfigSetting = await settingModel.findOne({
          where: {
            masterdetailId: element.id,
            registerallow: 'TENANT_CONFIG'
          }
        });
        if (getTenantConfigSetting && getTenantConfigSetting.text) {
          parseText = JSON.parse(getTenantConfigSetting.text)
          parseText.isEmailBasedLogin = true;
          parseText.maxCellnumberDigitLimit = 8;
          parseText.defaultLanguage = 'ar';

          await settingModel.updateAll({
            masterdetailId: element.id,
            registerallow: 'TENANT_CONFIG',
            id: getTenantConfigSetting.id
          }, {
            text: JSON.stringify(parseText)
          });

          constants.addLog('By Default Enable Email Based Login ', 'TENANT_CONFIG', 'Business Name - ' + element.fullname + ' , Master Id - ' + element.id);
        }
      }
    }
  },

  getTenantSettingValueBasedOnKey: async (key, masterdetailId) => {
    var settingModel = app.models.setting;
    var getTenantConfigSetting;

    getTenantConfigSetting = await settingModel.findOne({
      where: {
        masterdetailId: masterdetailId,
        registerallow: 'TENANT_CONFIG'
      }
    });
    if (getTenantConfigSetting && getTenantConfigSetting.text) {
      getTenantConfigSetting = JSON.parse(getTenantConfigSetting.text);
      return getTenantConfigSetting[key];
    }

  },

  setQARCurrency: async () => {
    var settingModel = app.models.setting;
    var masterdetailModel = app.models.masterdetail;
    var masterdetailData = await masterdetailModel.find();
    var getCurrencySetting;

    if (masterdetailData.length > 0) {
      for (let i = 0; i < masterdetailData.length; i++) {
        const element = masterdetailData[i];
        getCurrencySetting = await settingModel.findOne({
          where: {
            masterdetailId: element.id,
            registerallow: 'CURRENCY'
          }
        });
        if (getCurrencySetting) {
          await settingModel.updateAll({
            masterdetailId: element.id,
            id: getCurrencySetting.id
          }, {
            text: 'QAR'
          });
          constants.addLog('Set QAR Currency ', 'CURRENCY', 'Business Name - ' + element.fullname + ' , Master Id - ' + element.id);
        }
      }
    }

  },

  getPrivacyPolictText: async (companyName) => {
    return '<p class="ql-align-justify"> Sufalam Technologies Pvt Ltd. built the ' + companyName + ' application. </p> <p class="ql-align-justify"> If you choose to use our service, then you agree to the collection and use of information in relation to this policy. The personal information that we collect is used for providing and improving the service. We will not use or share your information with anyone except as described in this privacy policy. </p> <p class="ql-align-justify"> The terms used in this privacy policy have the same meanings as in our Terms and Conditions, which is accessible at ' + companyName + ' unless otherwise defined in this privacy policy. </p> <p class="ql-align-justify"><strong>Information Collection and Use</strong></p> <p class="ql-align-justify"> For a better experience, while using our service, we may require you to provide us with certain personally identifiable information. The information that we request will be retained by us and used as described in this privacy policy. </p> <p class="ql-align-justify"> The app does use third party services that may collect information used to identify you. </p> <p class="ql-align-justify"> Link to privacy policy of third party service providers used by the app. </p> <ul> <li> <a href="https://www.google.com/policies/privacy/\" target="_blank\" style="color: rgb(0, 122, 217);"> Google Play Services </a> </li> </ul> <p class="ql-align-justify"><strong>Log Data</strong></p> <p class="ql-align-justify"> We want to inform you that whenever you use our service, in a case of an error in the app we collect data and information (through third party products) on your phone called Log Data. This Log Data may include information such as your device Internet Protocol (“IP”) address, device name, operating system version, the configuration of the app when utilizing our service, the time and date of your use of the service, and other statistics. </p> <p class="ql-align-justify"><strong>Cookies</strong></p> <p class="ql-align-justify">Cookies are files with a small amount of data that are commonly used as anonymous unique identifiers. These are sent to your browser from the websites that you visit and are stored on your devices internal memory.</p> <p class="ql-align-justify">This service does not use these “cookies” explicitly. However, the app may use third party code and libraries that use “cookies” to collect information and improve their services. You have the option to either accept or refuse these cookies and know when a cookie is being sent to your device. If you choose to refuse our cookies, you may not be able to use some portions of this service.</p> <p class="ql-align-justify"><strong>service Providers</strong></p> <p class="ql-align-justify">We may employ third-party companies and individuals due to the following reasons:</p> <ul> <li>To facilitate our service;</li> <li>To provide the service on our behalf;</li> <li>To perform service-related services; or</li> <li>To assist us in analyzing how our service is used.</li> </ul> <p class="ql-align-justify">We want to inform users of this service that these third parties have access to your personal information. The reason is to perform the tasks assigned to them on our behalf. However, they are obligated not to disclose or use the information for any other purpose.</p> <p class="ql-align-justify"><strong>Security</strong></p> <p class="ql-align-justify"> We value your trust in providing us your personal information, thus we are striving to use commercially acceptable means of protecting it. But remember that no method of transmission over the internet, or method of electronic storage is 100% secure and reliable, and we cannot guarantee its absolute security. </p> <p class="ql-align-justify"><strong>Links to Other Sites</strong></p> <p class="ql-align-justify"> This service may contain links to other sites. If you click on a third-party link, you will be directed to that site. Note that these external sites are not operated by us. Therefore, we strongly advise you to review the privacy policy of these websites. We have no control over and assume no responsibility for the content, privacy policies, or practices of any third-party sites or services. </p> <p class="ql-align-justify"><strong>Children’s Privacy</strong></p> <p class="ql-align-justify"> These services do not address anyone under the age of 13. We do not knowingly collect personally identifiable information from children under 13. In the case we discover that a child under 13 has provided us with personal information, we immediately delete this from our servers. If you are a parent or guardian and you are aware that your child has provided us with personal information, please contact us so that we will be able to do necessary actions. </p> <p class="ql-align-justify"><strong>Changes to this privacy policy</strong></p> <p class="ql-align-justify"> We may update our privacy policy from time to time. Thus, you are advised to review this page periodically for any changes. We will notify you of any changes by posting the new privacy policy on this page. These changes are effective immediately after they are posted on this page. </p> <p class="ql-align-justify"><strong>Contact Us</strong></p> <p class="ql-align-justify"> If you have any questions or suggestions about our privacy policy, do not hesitate to contact us. </p> <p class="ql-align-justify"><br></p>';
  },

  getMarchantSetting: async (key, masterdetailId) => {
    var settingModel = app.models.setting;
    var getMarchantSetting;

    getMarchantSetting = await settingModel.findOne({
      where: {
        masterdetailId: masterdetailId,
        registerallow: 'Merchant_Information'
      }
    });
    if (getMarchantSetting && getMarchantSetting.text) {
      getMarchantSetting = JSON.parse(getMarchantSetting.text);
      return getMarchantSetting[key];
    }

  }

}



