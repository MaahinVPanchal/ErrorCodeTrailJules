'use strict';

const app = require("../../server/server");
const moment = require("moment");
const constants = require("../../common/const");


module.exports = function (Inquiry) {

    Inquiry.doInquiry = async (req) => {
        try {
            var accesstokenModel = app.models.AccessToken;
            var userModel = app.models.user;
            var salesmancityModel = app.models.salesmancity;
            var productModel = app.models.product;
            var categoryModel = app.models.category;
            var sourceModel = app.models.source;
            var finalInquiry;
            var inquiryDetails = {};
            var product, category;
            var dataProduct = [];
            var dataCategory = [];
            var resData = {};
            var cityOfUser;

            // 1-Pending, 2-In-Progress, 3-On-Hold, 4-Won, 5-Cancelled, 6-Rejected

            if (req.body.userId) {
                cityOfUser = await userModel.findById(req.body.userId);
            } else {
                throw constants.createError(404, 'Sorry, Provided user city not found.');
            }

            if (req.body.inquiryDetails) {
                if (req.body.inquiryDetails.categoryData !== undefined) {
                    // let data = JSON.stringify(req.body.inquiryDetails.categoryData);
                    inquiryDetails.categoryData = req.body.inquiryDetails.categoryData;
                }
                if (req.body.inquiryDetails.productData !== undefined) {
                    // let data = JSON.stringify(req.body.inquiryDetails.productData);
                    inquiryDetails.productData = req.body.inquiryDetails.productData;
                }
                if (req.body.inquiryDetails.files !== undefined) {
                    inquiryDetails.files = req.body.inquiryDetails.files;
                }
            }

            // find user based on accesstoken
            let accessToken = await accesstokenModel.findOne({
                where: {
                    id: req.headers.authorization,
                    masterdetailId: req.body.masterdetailId
                }
            });
            let user = await userModel.findById(accessToken.userId);
            // get salesman which belongs to user city
            let getsalesman = await salesmancityModel.find({ where: { userId: user.id, masterdetailId: req.body.masterdetailId } });

            // if (getsalesman.length > 0) {
            let convertToJSONStringify = JSON.stringify(inquiryDetails);
            let inquiryno = "BB0" + (Math.floor(Math.random() * 900000000000) + 100000000000);
            // create inquiry query
            finalInquiry = await Inquiry.create({
                assignedto: user.id,
                createdby: user.id,
                modifiedby: user.id,
                inquiryno: inquiryno,
                userId: req.body.userId,
                industryId: req.body.industryId,
                sourceId: req.body.sourceId,
                nextactionId: req.body.nextactionId,
                status: 1,
                description: req.body.description,
                date: moment(new Date()).format("DD/MM/YYYY"),
                created: new Date(),
                modified: new Date(),
                inquiryDetails: convertToJSONStringify,
                cityId: cityOfUser.cityId,
                masterdetailId: req.body.masterdetailId
            });
            // } else {
            //     let err = new Error("Sorry! in your city salesman not found!");
            //     err.statusCode = 404;
            //     throw err;
            // }
            if (req.body.productData !== undefined) {
                for (let i = 0; i < req.body.productData.length; i++) {
                    const element = req.body.productData[i].id;
                    // find product
                    product = await productModel.findOne({
                        where: {
                            id: element,
                            masterdetailId: req.body.masterdetailId
                        },
                        deleted: true,
                        include: ["category", "productmedia"]
                    });
                    dataProduct.push(product);
                }
            }

            if (req.body.categoryData) {
                for (let i = 0; i < req.body.categoryData.length; i++) {
                    const element = req.body.categoryData[i].id;
                    // find category
                    category = await categoryModel.findOne({
                        where: {
                            id: element,
                            masterdetailId: req.body.masterdetailId
                        },
                        deleted: true
                    });
                    dataCategory.push(category);
                }
            }
            // attach source data
            // let getSourceData = await sourceModel.findOne({ where: { id: req.body.sourceId } });

            resData.inquiryId = finalInquiry.id;
            resData.date = finalInquiry.date;
            resData.assignedto = finalInquiry.assignedto;
            resData.lastnote = finalInquiry.description;

            return resData;

        } catch (error) {
            throw error;
        }
    }

    Inquiry.afterRemote("findById", async (ctx, modelInstance, next) => {
        var resData = {}
        var data;
        var productModel = app.models.product;
        var categoryModel = app.models.category;
        var dataProduct = [];
        var dataCategory = [];

        try {
            console.log(modelInstance.id);
            data = JSON.parse(modelInstance.inquiryDetails);
            if (data.productData) {
                let parseproduct = data.productData;
                for (let j = 0; j < parseproduct.length; j++) {
                    const elementp = parseproduct[j].id;
                    // find product
                    var product = await productModel.findOne({
                        where: {
                            id: elementp,
                            masterdetailId: ctx.req.query.where.masterdetailId
                        },
                        deleted: true,
                        include: ["category", "productmedia"]
                    });
                    dataProduct.push(product);
                    // getInquiryData[i].productData = dataProduct;

                }
            }

            if (data.categoryData) {
                var parsecategory = data.categoryData;
                for (let j = 0; j < parsecategory.length; j++) {
                    const elementc = parsecategory[j].id;
                    // find category
                    var category = await categoryModel.findOne({
                        where: {
                            id: elementc,
                            masterdetailId: ctx.req.query.where.masterdetailId
                        },
                        deleted: true,
                        include: ["categorymedia"]
                    });
                    dataCategory.push(category);
                }
            }

            if (data.files) {
                modelInstance.filesData = data.files;
            }
            modelInstance.productData = dataProduct;
            modelInstance.categoryData = dataCategory;

        } catch (error) {
            throw error;
        }
    });

    Inquiry.beforeRemote("find", async (ctx, modelInstance, next) => {

        try {

            ctx.req.query = ctx.req.query || {};
            ctx.req.query.filter = ctx.req.query.filter || {};
            ctx.req.query.filter.where = ctx.req.query.filter.where || {};
            ctx.req.query.where.masterdetailId = ctx.req.query.where.masterdetailId;
        } catch (error) {
            throw error;
        }

    });

    Inquiry.afterRemote("find", async (ctx, modelInstance, next) => {
        try {

            var accesstokenModel = app.models.AccessToken;
            var userModel = app.models.user;
            var settingModel = app.models.setting;
            var productModel = app.models.product;
            var categoryModel = app.models.category;
            var salesmancityModel = app.models.salesmancity;
            var cityModel = app.models.city;
            var product, category;
            var dataProduct = [];
            var dataCategory = [];
            var nextArray = [];
            var industryArray = [];
            var nextData = {};
            var indData = {};
            var getInquiryData = [];
            var cityArray = [];
            var temp = [];
            var assignedToArray = [];

            // find user based on accesstoken
            var accessToken = await accesstokenModel.findOne({
                where: {
                    id: ctx.req.headers.authorization,
                    masterdetailId: ctx.req.query.where.masterdetailId
                }
            });
            var user = await userModel.findById(accessToken.userId);

            // check requested user is admin or not
            if (user.roleId === 1) {
                // get all cities
                var getAllCities = await cityModel.find();
                if (getAllCities.length > 0) {
                    for (let i = 0; i < getAllCities.length; i++) {
                        const element = getAllCities[i];
                        cityArray.push(element.id);
                    }
                }
            } else {
                // get salesman which belongs to user city
                var getsalesman = await salesmancityModel.find({ where: { userId: user.id } });
                if (getsalesman.length > 0) {
                    for (let i = 0; i < getsalesman.length; i++) {
                        const element = getsalesman[i];
                        cityArray.push(element.cityId);
                    }
                }
            }


            if (user) {
                // check requested salesman is super salesman of any other salesman
                var userData;
                if (user.roleId === 1) {
                    userData = await userModel.find({
                        where: {
                            roleId: 3,
                            masterdetailId: ctx.req.query.where.masterdetailId
                        }
                    });
                } else {
                    userData = await userModel.find({
                        where: {
                            reportingto: user.id,
                            masterdetailId: ctx.req.query.where.masterdetailId
                        }
                    });
                    assignedToArray.push(user.id);
                }

                if (userData.length > 0) {
                    for (let i = 0; i < userData.length; i++) {
                        const element = userData[i];
                        assignedToArray.push(element.id);
                    }
                }

                if (ctx.req.query.filter) {
                    if (ctx.req.query.filter.order && ctx.req.query.filter.where) {
                        if (ctx.req.query.filter.where.and) {
                            if (ctx.req.query.filter.where.and[0].nextactionId) {
                                getInquiryData = await Inquiry.find({
                                    where: {
                                        and: [{
                                            cityId: { inq: cityArray },
                                        }, {
                                            assignedto: { inq: assignedToArray }
                                        }, {
                                            nextactionId: ctx.req.query.filter.where.and[0].nextactionId
                                        }],
                                        masterdetailId: ctx.req.query.where.masterdetailId
                                    },
                                    order: ctx.req.query.filter.order,
                                    include: ["user", "source"],
                                    skip: ctx.req.query.filter.skip,
                                    limit: ctx.req.query.filter.limit
                                });
                            }
                        } else {
                            getInquiryData = await Inquiry.find({
                                where: {
                                    or: [{
                                        and: [{
                                            cityId: { inq: cityArray },
                                        }],
                                        masterdetailId: ctx.req.query.where.masterdetailId
                                    }, {
                                        assignedto: { inq: assignedToArray }
                                    }]
                                },
                                order: ctx.req.query.filter.order,
                                include: ["user", "source"],
                                skip: ctx.req.query.filter.skip,
                                limit: ctx.req.query.filter.limit
                            });
                        }
                    } else if (ctx.req.query.filter.order) {
                        getInquiryData = await Inquiry.find({
                            where: {
                                or: [{
                                    and: [{
                                        cityId: { inq: cityArray },
                                    }],
                                    masterdetailId: ctx.req.query.where.masterdetailId
                                }, {
                                    assignedto: { inq: assignedToArray }
                                }]
                            },
                            order: ctx.req.query.filter.order,
                            include: ["user", "source"],
                            skip: ctx.req.query.filter.skip,
                            limit: ctx.req.query.filter.limit
                        });
                    } else if (ctx.req.query.filter.where) {
                        if (ctx.req.query.filter.where.and) {
                            if (ctx.req.query.filter.where.and[0].nextactionId) {
                                getInquiryData = await Inquiry.find({
                                    where: {
                                        or: [{
                                            cityId: { inq: cityArray },
                                        }, {
                                            assignedto: { inq: assignedToArray }
                                        }],
                                        nextactionId: ctx.req.query.filter.where.and[0].nextactionId,
                                        masterdetailId: ctx.req.query.where.masterdetailId
                                    },
                                    include: ["user", "source"],
                                    skip: ctx.req.query.filter.skip,
                                    limit: ctx.req.query.filter.limit
                                });
                            } else {
                                getInquiryData = await Inquiry.find({
                                    where: {
                                        or: [{
                                            and: [{
                                                cityId: { inq: cityArray },
                                            }]
                                        }, {
                                            assignedto: { inq: assignedToArray }
                                        }],
                                        masterdetailId: ctx.req.query.where.masterdetailId
                                    },
                                    include: ["user", "source"],
                                    skip: ctx.req.query.filter.skip,
                                    limit: ctx.req.query.filter.limit
                                });
                            }
                        }
                    } else {
                        getInquiryData = [];
                    }

                    if (getInquiryData.length > 0) {
                        for (let i = 0; i < getInquiryData.length; i++) {
                            const element = getInquiryData[i];

                            let data = JSON.parse(element.inquiryDetails);
                            if (data.productData !== undefined) {
                                var parseproduct = data.productData;
                                for (let j = 0; j < parseproduct.length; j++) {
                                    const elementp = parseproduct[j].id;
                                    // find product
                                    product = await productModel.findOne({
                                        where: {
                                            id: elementp,
                                            masterdetailId: ctx.req.query.where.masterdetailId
                                        },
                                        deleted: true,
                                        include: ["category", "productmedia"]
                                    });
                                    dataProduct.push(product);
                                    getInquiryData[i].productData = dataProduct;
                                }
                            }

                            if (data.categoryData !== undefined) {
                                var parsecategory = data.categoryData;
                                for (let j = 0; j < parsecategory.length; j++) {
                                    const elementc = parsecategory[j].id;
                                    // find category
                                    category = await categoryModel.findOne({
                                        where: {
                                            id: elementc,
                                            masterdetailId: ctx.req.query.where.masterdetailId
                                        },
                                        deleted: true
                                    });
                                    dataCategory.push(category);
                                    getInquiryData[i].categoryData = dataCategory;
                                }
                            }

                            if (data.files !== undefined) {
                                getInquiryData[i].filesData = data.files;
                            }

                            var setdata = await settingModel.findOne({
                                where: {
                                    registerallow: 'Inquiry_Action',
                                    masterdetailId: ctx.req.query.where.masterdetailId
                                }
                            });
                            if (setdata) {

                                var setnextandindustry = JSON.parse(setdata.text);

                                nextArray = setnextandindustry[0].next_action;
                                if (getInquiryData[i].nextactionId) {
                                    let nid = getInquiryData[i].nextactionId;
                                    for (let k = 0; k < nextArray.length; k++) {
                                        const elementk = nextArray[k];
                                        if (elementk.id === parseInt(nid)) {
                                            nextData = elementk;
                                        }
                                    }
                                }

                                industryArray = setnextandindustry[0].industry;
                                if (getInquiryData[i].industryId) {
                                    let iid = getInquiryData[i].industryId;
                                    for (let j = 0; j < industryArray.length; j++) {
                                        const elementj = industryArray[j];
                                        if (elementj.id === parseInt(iid)) {
                                            indData = elementj;
                                        }
                                    }
                                }
                            }

                            getInquiryData[i].nextaction = nextData;
                            getInquiryData[i].industry = indData;
                            dataCategory = [];
                            dataProduct = [];
                            nextArray = [];
                            industryArray = [];
                            nextData = {};
                            indData = {};
                        }

                        ctx.res.status(200).send(getInquiryData);

                    } else {
                        ctx.res.status(200).send(temp);
                    }
                }
            } else {
                ctx.res.status(200).send(getInquiryData);
            }

        } catch (error) {
            throw error;
        }
    });

    Inquiry.beforeRemote("prototype.patchAttributes", async (ctx) => {

        try {

            var inquiryDetails = {};
            var getData = await Inquiry.findById(ctx.args.data.id);

            if (getData.inquiryDetails !== '{}') {
                var parseData = JSON.parse(getData.inquiryDetails);
                if (ctx.args.data.inquiryDetails) {
                    if (ctx.args.data.inquiryDetails.categoryData) {
                        parseData.categoryData = ctx.args.data.inquiryDetails.categoryData;
                    }
                    if (ctx.args.data.inquiryDetails.productData) {
                        parseData.productData = ctx.args.data.inquiryDetails.productData;
                    }
                    if (ctx.args.data.inquiryDetails.files) {
                        parseData.files = ctx.args.data.inquiryDetails.files;
                    }
                    if (ctx.args.data.inquiryDetails === '{}') {
                        parseData = ctx.args.data.inquiryDetails;
                    }

                    var convertToJSONStringify = JSON.stringify(parseData);
                    ctx.args.data.inquiryDetails = convertToJSONStringify;
                }
            } else {
                if (ctx.args.data.inquiryDetails) {
                    if (ctx.args.data.inquiryDetails.categoryData) {
                        let data = ctx.args.data.inquiryDetails.categoryData;
                        inquiryDetails.categoryData = data;
                    }
                    if (ctx.args.data.inquiryDetails.productData) {
                        let data = ctx.args.data.inquiryDetails.productData;
                        inquiryDetails.productData = data;
                    }
                    if (ctx.args.data.inquiryDetails.files) {
                        inquiryDetails.files = ctx.args.data.inquiryDetails.files;
                    }
                    if (ctx.args.data.inquiryDetails === '{}') {
                        inquiryDetails = ctx.args.data.inquiryDetails;
                    }
                    let convertToJSONStringify = JSON.stringify(inquiryDetails);
                    ctx.args.data.inquiryDetails = convertToJSONStringify;
                }

            }

        } catch (error) {
            throw error
        }
    });

    Inquiry.adminInquiryListing = async (req) => {

        var resData = {};
        var userModel = app.models.user;
        var sourceModel = app.models.source;
        var settingModel = app.models.setting;
        var inquiryData, inquiryLength
        var dataQuery, lengthQuery;
        var tempQuery = '';

        try {

            var getUserRole = await userModel.findById(req.accessToken.userId);

            if (req.query.filter.where) {
                // inquiryno
                if (req.query.filter.where.inquiryno && req.query.filter.where.inquiryno.like) {
                    tempQuery += " AND inquiryno LIKE  '" + req.query.filter.where.inquiryno.like + "' ";
                }
                // date
                if (req.query.filter.where.date && req.query.filter.where.date.like) {
                    tempQuery += " AND date LIKE  '" + req.query.filter.where.date.like + "' ";
                }
                // nextactionId
                if (req.query.filter.where.nextactionId) {
                    tempQuery += " AND nextactionId =  " + req.query.filter.where.nextactionId + " ";
                }
                // industryId 
                if (req.query.filter.where.industryId) {
                    tempQuery += " AND industryId =  " + req.query.filter.where.industryId + " ";
                }
                // sourceId
                if (req.query.filter.where.sourceId) {
                    tempQuery += " AND sourceId =  " + req.query.filter.where.sourceId + " ";
                }
                // citywise filter
                if (req.query.filter.where.city && req.query.filter.where.city.like) {
                    let citydata = await cityModel.find({
                        where: {
                            name: {
                                like: req.query.filter.where.city.like,
                                masterdetailId: req.query.where.masterdetailId
                            }
                        }
                    });
                    let tempArray = [];
                    if (citydata) {
                        citydata.map(e => tempArray.push(e.id));
                        tempArray = tempArray.map(a => JSON.stringify(a)).join();
                        tempArray = "(" + tempArray + ")";
                        tempQuery += " AND cityId IN " + tempArray;
                    }
                } else if (getUserRole.roleId === constants.SALESMAN_ROLEID || getUserRole.roleId === constants.DEALER_ROLEID) {
                    var cityArray = [];
                    // get cities from salesmancity table
                    var getCityData = await app.models.salesmancity.find({
                        where: {
                            userId: getUserRole.id,
                            masterdetailId: req.query.where.masterdetailId
                        }
                    });

                    if (getCityData) {
                        getCityData.filter(item => cityArray.push(item.cityId));
                    }

                    // get reportinf salesman / dealer details
                    var reportingToDetails = await app.models.user.findOne({
                        where: {
                            reportingto: getUserRole.id,
                            masterdetailId: req.query.where.masterdetailId
                        }
                    });

                    if (reportingToDetails) {
                        var getReportedPersonCities = await app.models.salesmancity.find({
                            where: {
                                userId: reportingToDetails.id,
                                masterdetailId: ctx.req.query.where.masterdetailId
                            }
                        });
                        if (getReportedPersonCities.length > 0) {
                            getReportedPersonCities.filter((e) => {
                                if (!cityArray.includes(e.cityId)) {
                                    cityArray.push(e.cityId);
                                }
                            });
                        }

                    }

                    if (cityArray.length > 0) {
                        cityArray = await cityArray.map(item => JSON.stringify(item)).join();
                        cityArray = "(" + cityArray + ")";
                        tempQuery += " AND cityId IN " + cityArray;
                    } else {
                        tempQuery += " AND cityId IN " + "(" + null + ")";
                    }

                }

            }

            if (req.query.filter.order) {
                if (req.query.filter.order === 'id DESC' || req.query.filter.order === 'id desc') {
                    req.query.filter.order = 'created DESC';
                }
                if (req.query.filter.order === 'id ASC' || req.query.filter.order === 'id asc') {
                    req.query.filter.order = 'created ASC';
                }
                tempQuery += " ORDER BY " + req.query.filter.order + " ";
            }

            dataQuery = "SELECT * FROM `inquiry` WHERE deletedAt IS NULL AND masterdetailId = '" + req.query.where.masterdetailId + "' " + tempQuery + " LIMIT " + req.query.filter.skip + ", " + req.query.filter.limit;
            inquiryData = await new Promise((resolve, reject) => {
                app.datasources.mysql.connector.execute(dataQuery, null, (err, result) => {
                    if (err) reject(err);
                    resolve(result);
                });
            });

            lengthQuery = "SELECT COUNT(id) as count FROM `inquiry` WHERE deletedAt IS NULL  AND masterdetailId = '" + req.query.where.masterdetailId + "' " + tempQuery;
            inquiryLength = await new Promise((resolve, reject) => {
                app.datasources.mysql.connector.execute(lengthQuery, null, (err, result) => {
                    if (err) reject(err);
                    resolve(result);
                });
            });

            console.log(dataQuery);

            for (let i = 0; i < inquiryData.length; i++) {
                const oneInquiry = inquiryData[i];
                let user = await userModel.findById(oneInquiry.userId); // find and attach user data
                let source = await sourceModel.findById(oneInquiry.sourceId); // find and attach sources
                oneInquiry.user = user;
                oneInquiry.source = source;

                // attach nextaction & industry Name
                let data = await settingModel.findOne({
                    where: {
                        registerallow: 'Inquiry_Action',
                        masterdetailId: req.query.where.masterdetailId
                    }
                });
                data = JSON.parse(data.text);
                if (oneInquiry.nextactionId) {
                    data[0].next_action.filter(e => {
                        if (e.id === parseInt(oneInquiry.nextactionId)) {
                            oneInquiry.nextactionname = e.actionname
                        }
                    });
                }
                if (oneInquiry.industryId) {
                    data[0].industry.filter(e => {
                        if (e.id === parseInt(oneInquiry.industryId)) {
                            oneInquiry.industryname = e.industryname
                        }
                    });
                }
            }

            resData.data = inquiryData;
            resData.length = inquiryLength[0].count;
            return resData;

        } catch (error) {
            throw error;
        }
    };

}
