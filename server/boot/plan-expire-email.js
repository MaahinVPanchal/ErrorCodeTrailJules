const constants = require("../../common/const");
const app = require("../../server/server");
const moment = require("moment");
var cron = require('node-cron');

// # ┌────────────── second (optional)
// # │ ┌──────────── minute
// # │ │ ┌────────── hour
// # │ │ │ ┌──────── day of month
// # │ │ │ │ ┌────── month
// # │ │ │ │ │ ┌──── day of week
// # │ │ │ │ │ │
// # │ │ │ │ │ │
// # * * * * * *

// Scheduled an event call daily at 11am
cron.schedule('00 00 11 * * *', () => {
  console.log('Expire Plan notifier :: ', new Date());
  // sendPlanExpireEmail();
  // sendExpiryEmailOneTimePayment();
});

async function sendPlanExpireEmail() {

  var notifyModel = app.models.notify;
  var masterdetailmetaModel = app.models.masterdetailmeta;
  var totalDays, configuration, planExpireDate, today, redirectURL, getShortURL, userData;

  try {

    var masterMetaData = await constants.commonFindFunction({
      model: masterdetailmetaModel,
      whereObj: {}
    });

    for (let i = 0; i < masterMetaData.length; i++) {
      const obj = masterMetaData[i];
      configuration = JSON.parse(obj.configuration);

      for (let j = 0; j < configuration.planDetails.length; j++) {
        const e = configuration.planDetails[j];
        if (e.purchaseExpireDate) {
          planExpireDate = moment(moment(e.purchaseExpireDate), 'YYYY-MM-DD').toDate();
          today = moment(moment(), 'YYYY-MM-DD').toDate();
          totalDays = ((planExpireDate.getTime() - today.getTime()) / (1000 * 3600 * 24)).toFixed(0); // Diference in Days
          totalDays = parseInt(totalDays, 0);
          console.log(totalDays + " " + obj.masterdetailId);

          if (totalDays === 1 || totalDays === 2 || totalDays === 3) {

            userData = await constants.commonFindOneFunction({
              model: app.models.user,
              whereObj: {
                roleId: constants.ADMIN_ROLEID,
                masterdetailId: obj.masterdetailId
              }
            });

            // redirectURL = constants.REDIRECT_URL;
            redirectURL = app.get('serverConfig').adminpanel_url;
            getShortURL = await constants.shortUrl(redirectURL);
            userData.redirectURL = getShortURL;
            userData.noofdays = totalDays;
            if (!userData.companyname) {
              userData.companyname = userData.username;
            }

            // Send Email
            await notifyModel.share("EMAIL/EXPIRE_PLAN", userData, {
              masterdetailId: null
            });

          }
        }
      }

    }

  } catch (error) {
    throw error;
  }

}

async function sendExpiryEmailOneTimePayment() {

  var notifyModel = app.models.notify;
  var masterdetailmetaModel = app.models.masterdetailmeta;
  var totalDays, configuration, planExpireDate, today, redirectURL, getShortURL, userData;

  try {
    console.log('sendExpiryEmailOneTimePayment');
    var masterMetaData = await constants.commonFindFunction({
      model: masterdetailmetaModel,
      whereObj: {}
    });

    for (let i = 0; i < masterMetaData.length; i++) {
      const obj = masterMetaData[i];
      configuration = JSON.parse(obj.configuration);

      for (let j = 0; j < configuration.planDetails.length; j++) {
        const e = configuration.planDetails[j];
        if (e.purchaseExpireDate) {
          planExpireDate = moment(moment(e.purchaseExpireDate), 'YYYY-MM-DD').toDate();
          today = moment(moment(), 'YYYY-MM-DD').toDate();
          totalDays = ((planExpireDate.getTime() - today.getTime()) / (1000 * 3600 * 24)).toFixed(0); // Diference in Days
          totalDays = parseInt(totalDays, 0);
          console.log(totalDays + " " + obj.masterdetailId);

          if (totalDays === 7 || totalDays === 4 || totalDays === 1) {
            userData = await constants.commonFindOneFunction({
              model: app.models.user,
              whereObj: {
                roleId: constants.ADMIN_ROLEID,
                masterdetailId: obj.masterdetailId
              }
            });

            // redirectURL = constants.REDIRECT_URL;
            redirectURL = app.get('serverConfig').adminpanel_url;
            getShortURL = await constants.shortUrl(redirectURL);
            userData.redirectURL = getShortURL;
            userData.noofdays = totalDays;
            if (!userData.companyname) {
              userData.companyname = userData.username;
            }

            // Send Email
            await notifyModel.share("EMAIL/ONETIPMEPAYMENT_EXPIRE_PLAN", userData, {
              masterdetailId: null
            });

          }

          if (totalDays < 1) {

            e.isShowRenewPlanPopup = true;

            await masterdetailmetaModel.update({
              id: obj.id,
              masterdetailId: obj.masterdetailId
            }, {
              configuration: JSON.stringify(configuration)
            });

          }
        }
      }
    }
  } catch (error) {
    throw error;
  }

}
