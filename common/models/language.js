'use strict';

var app = require("../../server/server");

module.exports = function (Language) {

    Language.beforeRemote("create", async (ctx) => {
        var userModel = app.models.user;
        try {
            var user = await userModel.findById(ctx.req.accessToken.userId);
            if (user) {
                // store userId in createdby & modifiedby 
                ctx.args.data.createdby = user.id;
                ctx.args.data.modifiedby = user.id;
            }
            // Captalizing Key 1st Character
            ctx.args.data.key = ctx.args.data.key.charAt(0).toUpperCase() + ctx.args.data.key.slice(1);
            if (ctx.args.data.value) {
                ctx.args.data.value = JSON.stringify(ctx.args.data.value);
            }
        } catch (error) {
            throw error;
        }
    });

    Language.beforeRemote("prototype.patchAttributes", async (ctx) => {
        try {
            ctx.args.data.value = JSON.stringify(ctx.args.data.value);
        } catch (error) {
            throw error;
        }
    });

    Language.getLanguage = async (req) => {
        var resData;
        try {
            if (req.query.filter && req.query.filter.key == 'Android_Language') {
                resData = await Language.findOne({
                    where: {
                        key: 'Android_Language',
                        masterdetailId: req.query.where.masterdetailId
                    }
                });
            } else if (req.query.filter && req.query.filter.key == 'ADMINPANEL_LANGUAGE') {
                resData = await Language.findOne({
                    where: {
                        key: 'ADMINPANEL_LANGUAGE',
                        masterdetailId: null
                    }
                });
            } else {
                resData = await Language.findOne({
                    where: {
                        key: 'Language',
                        masterdetailId: req.query.where.masterdetailId
                    }
                });
            }
            resData = JSON.parse(resData.value);
            return resData;
        } catch (error) {
            throw error;
        }
    }

    Language.editLanguage = async (req) => {

        try {

            let getLanguage;
            if (req) {
                if (req.query) {
                    if (req.query.filter) {
                        getLanguage = await Language.findOne({
                            where: {
                                key: 'Android_Language',
                                masterdetailId: req.query.where.masterdetailId
                            }
                        });
                    } else {
                        getLanguage = await Language.findOne({
                            where: {
                                key: 'Language',
                                masterdetailId: req.query.where.masterdetailId
                            }
                        });
                    }
                }
            }

            let parseObject = JSON.parse(getLanguage.value);

            if (req.body.ar) {
                parseObject.ar = req.body.ar;
            }
            if (req.body.ch) {
                parseObject.ch = req.body.ch;
            }
            if (req.body.en) {
                parseObject.en = req.body.en;
            }

            // convert json into stringify
            let stringifiedData = JSON.stringify(parseObject);

            let updateData;

            if (req) {
                if (req.query) {
                    if (req.query.filter) {
                        updateData = await Language.updateAll({
                            key: 'Android_Language',
                            masterdetailId: req.query.where.masterdetailId
                        }, {
                            value: stringifiedData
                        });
                    } else {
                        updateData = await Language.updateAll({
                            key: 'Language',
                            masterdetailId: req.query.where.masterdetailId
                        }, {
                            value: stringifiedData
                        });
                    }
                }
            }

            return updateData;

        } catch (error) {
            throw error;
        }
    }

};
