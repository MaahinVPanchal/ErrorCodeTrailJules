"use strict";

const apn = require('apn');
var constants = require("../../common/const");
var sendIonicPush = require('./ionicPush');


module.exports = {
  sendiOspush: async (deviceToken, pushText, entity, notificationtype, params) => {

    // send push notification to ionic ios
    sendIonicPush.sendiOspush(deviceToken, pushText, entity, notificationtype, params);

    var keys = await constants.getIosPushKeys(params.masterdetailId);

    var alertObject = {};
    let options = {
      token: {
        key: keys.ios_key, //"PLA_AuthKey_GV6R42A9X8.p8",
        // Replace keyID and teamID with the values you've previously saved.
        keyId: keys.ios_keyId, //"GV6R42A9X8",
        teamId: keys.ios_teamId //"4D7WM9KH8K"
      },
      production: true
    };

    alertObject["title"] = "";
    alertObject["body"] = pushText;

    let apnProvider = new apn.Provider(options);

    let notification = new apn.Notification();
    notification.expiry = Math.floor(Date.now() / 1000) + 24 * 3600; // will expire in 24 hours from now
    notification.aps.alert = alertObject
    notification.sound = "ping.aiff";
    notification.aps.entityId = entity;
    notification.aps.notificationType = notificationtype;
    notification.payload = {
      'messageFrom': 'B2B'
    };

    // Replace this with your app bundle ID:
    notification.topic = "com.sufalamtech.b2b";

    // Send the actual notification
    apnProvider.send(notification, deviceToken).then(result => {
      // Show the result of the send operation:
      console.log("sent IOS:", result.sent.length);
      console.log("failed IOS:", result.failed.length);
      console.log("IOS" + result.failed);
    });

    // Close the server
    apnProvider.shutdown();
  }

}
