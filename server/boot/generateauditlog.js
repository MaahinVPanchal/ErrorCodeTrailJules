// var apps = require('../server');
// var constants = require('../../common/const');


// module.exports = function (app) {
//     app.remotes().phases
//         .addBefore('invoke', 'options-from-request')
//         .use(function (ctx, next) {
//             var settingModel = apps.models.setting;

//             settingModel.find().then((settings) => {
//                 var versionObj = JSON.parse(settings[8].registerallow);
//                 var minAPIVerion = versionObj['min_api_version'];
//                 var CurrentVersion = versionObj['current_api_version'];
//                 var req = ctx.req;
//                 var res = ctx.res;

//                 // create object for all audit log data
//                 var obj = {
//                     ip: req.connection.remoteAddress,
//                     method: req.method,
//                     url: req.originalUrl,
//                     request: req.body,
//                     accessToken: req.headers.authorization
//                 };

//                 // check API version
//                 try {
//                     if (req.headers.version < CurrentVersion) { // requested api version is lower than current version

//                         if (req.headers.version < minAPIVerion) { // requested api version is lower then min api verion

//                             // get response of api
//                             res.on('finish', () => {
//                                 var auditlogModel = apps.models.auditlog;

//                                 obj.statusCode = ctx.res.statusCode;
//                                 if (ctx.error) {
//                                     obj.result = {
//                                         error: ctx.error.message,
//                                         stack: ctx.error.stack
//                                     }
//                                 } else {
//                                     obj.result = null;
//                                 }

//                                 // invoke function to generate audit log
//                                 // auditlogModel.generateAuditLog(obj);
//                             });

//                             next(constants.createError(505, 'Your application is running an outdated version ! Please Update the application!'))

//                         } else {  // requested api version is greater than min api version

//                             // get response of api
//                             res.on('finish', () => {
//                                 var auditlogModel = apps.models.auditlog;

//                                 obj.statusCode = ctx.res.statusCode;
//                                 if (ctx.error) {
//                                     obj.result = {
//                                         error: ctx.error.message,
//                                         stack: ctx.error.stack
//                                     }
//                                 } else {
//                                     obj.result = null;
//                                 }

//                                 // invoke function to generate audit log
//                                 // auditlogModel.generateAuditLog(obj);
//                             });
//                             next();
//                         }

//                     } else if (req.headers.version === CurrentVersion) { // Equal api version

//                         // get response of api
//                         res.on('finish', () => {
//                             var auditlogModel = apps.models.auditlog;

//                             obj.statusCode = ctx.res.statusCode;
//                             if (ctx.error) {
//                                 obj.result = {
//                                     error: ctx.error.message,
//                                     stack: ctx.error.stack
//                                 }
//                             } else {
//                                 obj.result = null;
//                             }

//                             // invoke function to generate audit log
//                             // auditlogModel.generateAuditLog(obj);
//                         });
//                         next();

//                     } else if (req.originalUrl.includes('/containers')) { // version exception for Media
//                         // get response of api
//                         res.on('finish', () => {
//                             var auditlogModel = apps.models.auditlog;

//                             obj.statusCode = ctx.res.statusCode;
//                             if (ctx.error) {
//                                 obj.result = {
//                                     error: ctx.error.message,
//                                     stack: ctx.error.stack
//                                 }
//                             } else {
//                                 obj.result = null;
//                             }

//                             // invoke function to generate audit log
//                             // auditlogModel.generateAuditLog(obj);
//                         });
//                         next();

//                     } else if (req.originalUrl.includes('/validateAdmin')) {
//                         // get response of api
//                         res.on('finish', () => {
//                             var auditlogModel = apps.models.auditlog;

//                             obj.statusCode = ctx.res.statusCode;
//                             if (ctx.error) {
//                                 obj.result = {
//                                     error: ctx.error.message,
//                                     stack: ctx.error.stack
//                                 }
//                             } else {
//                                 obj.result = null;
//                             }

//                             // invoke function to generate audit log
//                             // auditlogModel.generateAuditLog(obj);
//                         });
//                         next();
//                     } else {
//                         // get response of api
//                         res.on('finish', () => {
//                             var auditlogModel = apps.models.auditlog;

//                             obj.statusCode = ctx.res.statusCode;
//                             if (ctx.error) {
//                                 obj.result = {
//                                     error: ctx.error.message,
//                                     stack: ctx.error.stack
//                                 }
//                             } else {
//                                 obj.result = null;
//                             }

//                             // invoke function to generate audit log
//                             // auditlogModel.generateAuditLog(obj);
//                         });
//                         next(constants.createError(525, 'API will be unavailable!'))
//                     }

//                 } catch (error) {
//                     throw error;
//                 }

//             });

//         });
// };