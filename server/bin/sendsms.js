const app = require("../server");
var request = require('request');
var constants = require("../../common/const");

module.exports = {

  sendSms: async (recipientPhone, smsText, options) => {
    console.log("CellNumber API----" + recipientPhone);

    // Get Current Merchant : Manage Sms Limit & Send SMS
    if (options.masterdetailId) {
      var getCurrentSmsCreditLimit = await app.models.masterdetailmeta.findOne({
        where: { masterdetailId: options.masterdetailId }
      });

      // check Plan Commonfunction
      if (getCurrentSmsCreditLimit) {
        var result = await constants.getCurrentMarchantPlan(constants.CURRENT_MERCHANT_PLAN_LABEL, 1, options.masterdetailId);
        var getResultOfSMSKey = await constants.commonCheckPlanCriteriaFeatures(result, options.masterdetailId, constants.SMS_CREDITS_KEY);
        // Do not send any SMS if limit not match
        if (getCurrentSmsCreditLimit.smscredits > getResultOfSMSKey) {
          // constants.createError(404, 'You have rich your maximum limit of sms!');
          return;
        }
      }

      console.log('http://ip.shreesms.net/smsserver/SMS10N.aspx?' + '&Userid=' + constants.user + '&UserPassword=' + constants.password + '&PhoneNumber=' + recipientPhone + '&Text=' + smsText + '&GSM=' + constants.senderid + '&EntityId=' + constants.entityId + '&TemplateId=' + options.templateId)
      // Send SMS
      request('http://ip.shreesms.net/smsserver/SMS10N.aspx?' +
        '&Userid=' + constants.user +
        '&UserPassword=' + constants.password +
        '&PhoneNumber=' + recipientPhone +
        '&Text=' + smsText +
        '&GSM=' + constants.senderid +
        '&EntityId=' + constants.entityId +
        '&TemplateId=' + options.templateId, (err, response, body) => {
          if (err) console.log(err);
          // console.log('SMS Response --', response);
        });

      // Update SMSCredit
      if (getCurrentSmsCreditLimit) {
        await app.models.masterdetailmeta.updateAll({
          id: getCurrentSmsCreditLimit.id,
          masterdetailId: options.masterdetailId
        }, {
          smscredits: getCurrentSmsCreditLimit.smscredits + 1
        });
      }

    }

  }

};
