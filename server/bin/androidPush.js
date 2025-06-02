var gcm = require('node-gcm');
var sendIonicPush = require('./ionicPush');
var constants = require("../../common/const");

module.exports = {
    sendAndroidpush: async (token, pushText, entity, notificationtype, params) => {

        // send push notification to ionic android
        sendIonicPush.sendAndroidpush(token, pushText, entity, notificationtype, params);
        // get server key from db for android push notification : Parth dt_12-04-2021
        var serverKey = await constants.getAndroidPushServerKey(token, params.masterdetailId);
        // Set up the sender with your GCM/FCM API key (declare this once for multiple messages)
        var sender = new gcm.Sender(serverKey);
        // var sender = new gcm.Sender('AAAAavPuGQY:APA91bGPeVnJGK3OS1R7g-cS6yLokHvVUImG1gL3_YIXpD72fWXKvldhWZhqXMOEK-sgeNPTNLsb5uMwJPm87g2YRm7CkT7wBKo5PDCXVsokJO-mgtOtSBIVvnYvUo3bdsiGDoAvXlvS');
        // var sender = new gcm.Sender('AAAAqLjCT5w:APA91bH6fHsxMlawrCh765QWFzG3GKj4PO-ek1YnUOn_JQTec5mBauPxcPSqx5hqrChPbqGjQGdER7Zm8THDe8fdoeE3smfEUjYkJ6gvy-EkUyx9jJuW2HGn8XuFVAukkJtPugE0ZiFD');
        // Prepare a message to be sent

        var message = new gcm.Message({
            data: {
                title: 'B2B',
                key: pushText, //body content
                notificationType: notificationtype,
                entityId: entity
            }
        });


        // Specify which registration IDs to deliver the message to
        var regTokens = [token];
        console.log("A token:  " + regTokens);
        console.log("android push ---------------------------------" + JSON.stringify(message));
        // Actually send the message
        sender.send(message, {
            registrationTokens: regTokens
        }, function (err, response) {
            if (err) console.error("Android" + err);
            else console.log("Push notification sent: Android");
            console.log("Android" + JSON.stringify(response));
        });

    }

}

