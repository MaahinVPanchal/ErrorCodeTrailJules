var app = require('../server');
var constant = require('../../common/const');
var DeviceDetector = require('device-detector-js');

module.exports = function (options) {

  var emailModel = app.models.email;
  var masterdetailId;
  var storeDetails = {};
  var errorReportEmail = [];

  return async function logError(err, req, res, next) {

    const deviceDetector = new DeviceDetector();
    const userAgent = req.headers['user-agent'];
    const device = deviceDetector.parse(userAgent);

    if (app.get('isProduction')) {
      errorReportEmail = constant.errorReportEmailLive;

      if (req.query.where && req.query.where.masterdetailId) {
        masterdetailId = req.query.where.masterdetailId
      } else if (req.query && req.query.masterdetailId) {
        masterdetailId = req.query.masterdetailId
      } else if (req.body && req.body.masterdetailId) {
        masterdetailId = req.body.masterdetailId
      } else {
        masterdetailId = '--';
        storeDetails = {
          codename: '--'
        };
      }

      if (masterdetailId != '--') {
        storeDetails = await constant.commonFindOneFunction({
          model: app.models.masterdetail,
          whereObj: {
            id: masterdetailId
          }
        });
      }

      if (req.method == 'POST' || req.method == 'PATCH') {
        req.body = JSON.stringify(req.body);
      } else {
        req.body = "--";
      }

      if (err && (err.statusCode >= 500 || !err.statusCode)) {
        var baseurl = req.originalUrl.replace(/^\/+/, '');
        baseurl = baseurl.split('/')[0];
        var emailBody = `
          <h3>Instance:</h3>
          <p>${(storeDetails && storeDetails.codename !== undefined) ? storeDetails.codename : '--'}</p >
          <h3>Error Message:</h3>
          <p>${err.message}</p>
          <h3>Error stack:</h3>
          <p>${err.stack}<p>

          <h3>Platform & OS info. </h3>
          <ol>
            <li>OS: ${device.os.name} </li>
            <li>Version: ${device.os.version}</li>
            <li>Platform: ${device.os.platform} </li>
            <li>Device: ${device.device.type}</li>
            <li>IP: ${req.ip}</li>
          </ol>

          <h3>Current request details</h3>
          <ol>
            <li>Master Detail ID: ${masterdetailId}</li>
            <li>Auth User: ${(req.accessToken && req.accessToken.userId !== undefined) ? req.accessToken.userId : undefined}</li>
            <li>Method: ${req.method}</li>
            <li>URL: ${req.originalUrl}</li>
            <li>Request Body: ${req.body}</li>
          </ol>
        `;

        // Manage Header Error
        if (!err.message.includes("headers after they are sent")) {
          emailModel.sendEmail({
            senderEmail: errorReportEmail,
            subject: `${app.get('serverConfig').emailSenderName} - ${(storeDetails && storeDetails.codename !== undefined) ? storeDetails.codename : '--'} Error Report: ${err.message}`,
            messageContent: emailBody
          }, (err, data) => {
            if (err) console.log(err);
            console.log('Error Report email sent');
          });
        }

      }

    }

    //  else {
    //   errorReportEmail = constant.commonEmailForTest;
    // }

    next(err);
  };
};
