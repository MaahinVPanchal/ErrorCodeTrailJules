var gcm = require('node-gcm');
const apn = require('apn');


module.exports = {
    sendAndroidpush: (token, pushText, entity, notificationtype) => {

        // Set up the sender with your GCM/FCM API key (declare this once for multiple messages)

        // ionic
        var sender = new gcm.Sender('AAAAqLjCT5w:APA91bH6fHsxMlawrCh765QWFzG3GKj4PO-ek1YnUOn_JQTec5mBauPxcPSqx5hqrChPbqGjQGdER7Zm8THDe8fdoeE3smfEUjYkJ6gvy-EkUyx9jJuW2HGn8XuFVAukkJtPugE0ZiFD');
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
        console.log("ionic android push ---------------------------------" + JSON.stringify(message));
        // Actually send the message
        sender.send(message, {
            registrationTokens: regTokens
        }, function (err, response) {
            if (err) console.error("Android" + err);
            else console.log("Push notification sent: ionic Android");
            console.log("ionic Android" + JSON.stringify(response));
        });

    },

    sendiOspush: (deviceToken, pushText, entity, notificationtype) => {
        var alertObject = {};
        let options = {
            token: {
                key: "PLA_AuthKey_GV6R42A9X8.p8",
                // Replace keyID and teamID with the values you've previously saved.
                keyId: "GV6R42A9X8",
                teamId: "4D7WM9KH8K"
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
        notification.topic = "com.sufalamtech.B2B";

        // Send the actual notification
        apnProvider.send(notification, deviceToken).then(result => {
            // Show the result of the send operation:
            console.log("sent ionic IOS:", result.sent.length);
            console.log("failed ionic IOS:", result.failed.length);
            console.log("ionic IOS" + result.failed);
        });

        // Close the server
        apnProvider.shutdown();
    }

}

