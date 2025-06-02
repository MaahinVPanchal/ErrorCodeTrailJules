const app = require("../server");
const settingConstants = require("../../common/setting_constants");
var cache = require('memory-cache');

module.exports = {

  initDefaultSettings: async () => {

    if (app.get('serverConfig').updatePaymentGateway) {
      // Update Payment Gateway JSON - When server restarts
      cache.put(settingConstants.ENABLE_SADAD_PAYMENT_WHEN_SERVER_RESTART, settingConstants.setSadadPaymentConfigurationAsDefault());
    }

    if (app.get('serverConfig').whileCreateNewInstanceEnaleSadadPayment) {
      // By Default Keep Sadad Payment Enable While creating new instance
      cache.put(settingConstants.ENABLE_SADAD_PAYMENT_WHEN_CREATE_INSTANCE, true);
    } else {
      cache.put(settingConstants.ENABLE_SADAD_PAYMENT_WHEN_CREATE_INSTANCE, false);
    }

    if (app.get('serverConfig').setStateVisibilitySetting) {
      // Set state as optional & manage zone number, unit number, street number, building number as compulsorry
      cache.put(settingConstants.SET_STATE_NOT_VISIBLE, true);
    } else {
      cache.put(settingConstants.SET_STATE_NOT_VISIBLE, false);
    }

    if (app.get('serverConfig').enableOpenstore) {
      // By Default Enable Open Store
      settingConstants.enableOpenStoreByDefault()
    }

    if (app.get('serverConfig').enableEmailBasedLogin) {
      // By Default Enable Email Based Login
      settingConstants.enableEmailBasedLoginByDefault();

      // Set QAR Currency
      settingConstants.setQARCurrency();

    }

    if (app.get('serverConfig').createFolderUnderS3Bucket) {
      // Create folder under s3 Bucket
      cache.put(settingConstants.IS_CREATE_FOLDER_IN_S3_BUCKET, true);
    } else {
      cache.put(settingConstants.IS_CREATE_FOLDER_IN_S3_BUCKET, false);
    }

  }

};
