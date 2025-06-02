"use strict";
var app = require("../../server/server");
var constants = require("../const");
let titlecase = require("title-case");

module.exports = function (Group) {
  Group.beforeRemote("create", async (ctx, modelInstance, next) => {
    try {
      //Captalizing the groupname
      ctx.args.data.name = titlecase.titleCase(ctx.args.data.name);
    } catch (err) {
      throw err;
    }
  });

  Group.afterRemote("create", async (ctx, modelInstance, next) => {
    var userModel = app.models.user;
    var settingModel = app.models.setting;
    var categoryModel = app.models.category;
    var groupcategoryModel = app.models.groupcategory;

    try {
      // data add in group category
      if (ctx.args.data.categoryData) {
        for (let i = 0; i < ctx.args.data.categoryData.length; i++) {
          const element = ctx.args.data.categoryData[i].id;
          let findSub = await categoryModel.find({
            where: {
              parentId: element,
              masterdetailId: ctx.req.query.where.masterdetailId,
            },
          });
          for (let j = 0; j < findSub.length; j++) {
            const element = findSub[j].id;
            await groupcategoryModel
              .create({
                categoryId: element,
                groupId: modelInstance.id,
                createdby: modelInstance.userId,
                masterdetailId: ctx.req.query.where.masterdetailId,
              })
              .catch((err) => {
                next("group created");
              });
          }
        }
      }

      // user add in group
      if (ctx.args.data.userData) {
        for (let i = 0; i < ctx.args.data.userData.length; i++) {
          await userModel.patchOrCreate({
            id: ctx.args.data.userData[i].id,
            groupId: modelInstance.id,
            masterdetailId: ctx.req.query.where.masterdetailId,
          });
        }
      }
      // get JSON From Setting
      var getGroupsFromSetting = await settingModel.findOne({
        where: {
          registerallow: constants.GROUPWISEGSTCONFIGURATION_LABLE,
          masterdetailId: ctx.req.query.where.masterdetailId,
        },
      });
      // if setting true & isgst true
      if (
        getGroupsFromSetting &&
        getGroupsFromSetting.status &&
        ctx.args.data.isgst
      ) {
        getGroupsFromSetting = constants.parseJson(getGroupsFromSetting.text);
        // check id exist or not : if not then add
        if (!getGroupsFromSetting.includes(modelInstance.id)) {
          getGroupsFromSetting.push(modelInstance.id);
          getGroupsFromSetting = constants.stringifyJson(getGroupsFromSetting);
          await settingModel.updateAll(
            {
              registerallow: constants.GROUPWISEGSTCONFIGURATION_LABLE,
              masterdetailId: ctx.req.query.where.masterdetailId,
            },
            {
              text: getGroupsFromSetting,
            }
          );
        }
      }
    } catch (error) {
      throw error;
    }
  });

  Group.beforeRemote("deleteById", async (ctx, modelInstance, next) => {
    var userModel = app.models.user;

    try {
      // find total users of deleted group
      var group = await Group.findOne({
        where: {
          id: ctx.req.params.id,
          masterdetailId: ctx.req.query.where.masterdetailId,
        },
      });

      // find total users of default group
      var defaultgroup = await Group.findOne({
        where: {
          id: await constants.default_groupId(
            ctx.req.query.where.masterdetailId
          ),
          masterdetailId: ctx.req.query.where.masterdetailId,
        },
      });

      // transfer user to default group
      await userModel.updateAll(
        {
          groupId: ctx.req.params.id,
          masterdetailId: ctx.req.query.where.masterdetailId,
        },
        {
          groupId: await constants.default_groupId(
            ctx.req.query.where.masterdetailId
          ),
        }
      );

      // udpate no of users in default group
      await Group.updateAll(
        {
          id: await constants.default_groupId(
            ctx.req.query.where.masterdetailId
          ),
          masterdetailId: ctx.req.query.where.masterdetailId,
        },
        {
          noofusers: defaultgroup.noofusers + group.noofusers,
        }
      );
    } catch (error) {
      throw error;
    }
  });

  Group.afterRemote("findById", async (ctx, modelInstance, next) => {
    let settingData;
    let settingModel = app.models.setting;
    var userModel = app.models.user;
    try {
      ctx.req.query = ctx.req.query || {};
      ctx.req.query.filter = ctx.req.query.filter || {};
      ctx.req.query.filter.where = ctx.req.query.filter.where || {};
      ctx.req.query.filter.where.masterdetailId =
        ctx.req.query.where.masterdetailId;

      // search user by username
      if (ctx.req.query.filter.where.username) {
        var getGroupUsers = await userModel.find({
          where: {
            groupId: ctx.args.id,
            masterdetailId: ctx.req.query.where.masterdetailId,
            username: {
              like: "%" + ctx.req.query.filter.where.username + "%",
            },
            roleId: 2,
          },
          include: ["city"],
        });
      } else {
        var getGroupUsers = await userModel.find({
          where: {
            groupId: ctx.args.id,
            masterdetailId: ctx.req.query.where.masterdetailId,
            roleId: 2,
          },
          include: ["city"],
        });
      }

      modelInstance.userdata = getGroupUsers;
    } catch (error) {
      throw error;
    }
  });

  Group.afterRemote("findById", async (ctx, modelInstance, next) => {
    let settingData;
    let settingModel = app.models.setting;
    try {
      settingData = await settingModel.findOne({
        where: {
          registerallow: constants.GROUPWISEGSTCONFIGURATION_LABLE,
          masterdetailId: ctx.req.query.where.masterdetailId,
        },
      });
      if (settingData && settingData.status) {
        settingData = constants.parseJson(settingData.text);
        // find id in setting
        const data = settingData.find((e) => e === modelInstance.id);
        data ? (modelInstance.isgst = true) : (modelInstance.isgst = false);
      }
    } catch (error) {
      throw error;
    }
  });

  Group.beforeRemote("find", async (ctx, modelInstance, next) => {
    try {
      ctx.req.query = ctx.req.query || {};
      ctx.req.query.filter = ctx.req.query.filter || {};
      ctx.req.query.filter.where = ctx.req.query.filter.where || {};
      ctx.req.query.filter.where.masterdetailId =
        ctx.req.query.where.masterdetailId;

      if (
        ctx &&
        ctx.req &&
        ctx.req.query &&
        ctx.req.query.filter &&
        ctx.req.query.filter.where
      ) {
        if (
          ctx.req.query.filter.where.name &&
          ctx.req.query.filter.where.name.like
        ) {
          ctx.req.query.filter.where.name.like =
            ctx.req.query.filter.where.name.like.split("%20").join(" ");
        }
        if (
          ctx.req.query.filter.where.noofusers &&
          ctx.req.query.filter.where.noofusers.like
        ) {
          ctx.req.query.filter.where.noofusers.like =
            ctx.req.query.filter.where.noofusers.like.split("%20").join(" ");
        }
      }
    } catch (error) {
      throw error;
    }
  });

  Group.afterRemote("find", async (ctx, modelInstance) => {
    var resData = {};

    try {
      if (ctx.req.query.isWeb) {
        var group = await Group.find({
          where: {
            masterdetailId: ctx.req.query.where.masterdetailId,
          },
        });
        resData.data = modelInstance;
        resData.length = group.length;
        var Activegroup = await Group.find({
          where: {
            status: 1,
            masterdetailId: ctx.req.query.where.masterdetailId,
          },
        });

        var Deactivegroup = await Group.find({
          where: {
            status: 0,
            masterdetailId: ctx.req.query.where.masterdetailId,
          },
        });

        if (ctx.req.query.filter.where && ctx.req.query.filter.where.and) {
          if (ctx.req.query.filter.where.and[0].status === true) {
            resData.data = modelInstance;
            resData.length = Activegroup.length;
            ctx.res.status(200).send(resData);
            return;
          } else if (ctx.req.query.filter.where.and[0].status === 0) {
            resData.data = modelInstance;
            resData.length = Deactivegroup.length;
            ctx.res.status(200).send(resData);
            return;
          } else {
            resData.data = modelInstance;
            resData.length = modelInstance.length;
            ctx.res.status(200).send(resData);
            return;
          }
        } else {
          ctx.res.status(200).send(resData);
          return;
        }
      }
    } catch (error) {
      throw error;
    }
  });

  Group.afterRemote(
    "prototype.patchAttributes",
    async (ctx, modelInstance, next) => {
      var categoryModel = app.models.category;
      var userModel = app.models.user;
      var groupcategoryModel = app.models.groupcategory;
      let settingModel = app.models.setting;
      try {
        // if group activated
        // activate all users
        if (ctx.args.data.status === true) {
          await userModel.updateAll(
            {
              groupId: ctx.instance.id,
              masterdetailId: ctx.req.query.where.masterdetailId,
            },
            {
              userstatus: "Active",
            }
          );
        }

        // if group deactivated
        // Deactivate all users
        if (ctx.args.data.status === false) {
          await userModel.updateAll(
            {
              groupId: ctx.instance.id,
              masterdetailId: ctx.req.query.where.masterdetailId,
            },
            {
              userstatus: "Deactive",
            }
          );
        }

        // when category added (While Only Categories in TextBox)
        if (
          ctx.args.data.newSelectedCategory &&
          ctx.args.data.newSelectedCategory.length > 0
        ) {
          for (let i = 0; i < ctx.args.data.newSelectedCategory.length; i++) {
            const element = ctx.args.data.newSelectedCategory[i].id;
            var findSub = await categoryModel.find({
              where: {
                parentId: element,
                masterdetailId: ctx.req.query.where.masterdetailId,
              },
            });
            for (let j = 0; j < findSub.length; j++) {
              const element = findSub[j];
              await groupcategoryModel.create({
                categoryId: element.id,
                groupId: ctx.req.params.id,
                masterdetailId: ctx.req.query.where.masterdetailId,
              });
            }
          }
        }

        // when category is deleted
        if (
          ctx.args.data.categoryData &&
          ctx.args.data.categoryData.length > 0
        ) {
          for (let i = 0; i < ctx.args.data.categoryData.length; i++) {
            const element = ctx.args.data.categoryData[i].id;
            // get subcategories for delete
            var findSub = await categoryModel.find({
              where: {
                parentId: element,
                masterdetailId: ctx.req.query.where.masterdetailId,
              },
            });
            if (findSub.length > 0) {
              for (let j = 0; j < findSub.length; j++) {
                const element = findSub[j];
                await groupcategoryModel.updateAll(
                  {
                    groupId: ctx.req.params.id,
                    categoryId: element.id,
                    masterdetailId: ctx.req.query.where.masterdetailId,
                  },
                  {
                    deletedAt: new Date(),
                  }
                );
              }
            }
          }
        }

        // when user deleted from group
        if (ctx.args.data.userData && ctx.args.data.userData.length > 0) {
          for (const key in ctx.args.data.userData) {
            if (ctx.args.data.userData.hasOwnProperty(key)) {
              const element = ctx.args.data.userData[key];
              await userModel.updateAll(
                {
                  id: element.id,
                  masterdetailId: ctx.req.query.where.masterdetailId,
                },
                {
                  groupId: await constants.default_groupId(
                    ctx.req.query.where.masterdetailId
                  ),
                }
              );
            }
          }

          var groupdetail = await Group.findOne({
            where: {
              id: ctx.instance.id,
              masterdetailId: ctx.req.query.where.masterdetailId,
            },
          });

          await Group.updateAll(
            {
              id: ctx.instance.id,
              masterdetailId: ctx.req.query.where.masterdetailId,
            },
            {
              noofusers: groupdetail.noofusers - ctx.args.data.userData.length,
            }
          );
        }

        // group wise gst configuration Update in Setting Table
        let getGroupsFromSetting = await settingModel.findOne({
          where: {
            registerallow: constants.GROUPWISEGSTCONFIGURATION_LABLE,
            masterdetailId: ctx.req.query.where.masterdetailId,
          },
        });

        if (getGroupsFromSetting) {
          var settingStatus = getGroupsFromSetting.status;
          getGroupsFromSetting = constants.parseJson(getGroupsFromSetting.text);
          if (settingStatus) {
            if (ctx.args.data.isgst) {
              if (!getGroupsFromSetting.includes(modelInstance.id)) {
                getGroupsFromSetting.push(modelInstance.id);
                getGroupsFromSetting =
                  constants.stringifyJson(getGroupsFromSetting);
                await settingModel.updateAll(
                  {
                    registerallow: constants.GROUPWISEGSTCONFIGURATION_LABLE,
                    masterdetailId: ctx.req.query.where.masterdetailId,
                  },
                  {
                    text: getGroupsFromSetting,
                  }
                );
              }
            } else {
              if (getGroupsFromSetting.length > 0) {
                const index = getGroupsFromSetting.findIndex(
                  (e) => e === ctx.args.data.id
                );
                getGroupsFromSetting.splice(index, 1);

                getGroupsFromSetting =
                  constants.stringifyJson(getGroupsFromSetting);
                await settingModel.updateAll(
                  {
                    registerallow: constants.GROUPWISEGSTCONFIGURATION_LABLE,
                    masterdetailId: ctx.req.query.where.masterdetailId,
                  },
                  {
                    text: getGroupsFromSetting,
                  }
                );
              }
            }
          }
        }
      } catch (error) {
        throw error;
      }
    }
  );

  // Get all details of group, category, products
  Group.getgrouppricing = async (req, groupId) => {
    var groupcategoryModel = app.models.groupcategory;
    var productModel = app.models.product;
    var grouppriceModel = app.models.groupprice;
    var categoryModel = app.models.category;

    // find group detail
    var group = await Group.findOne({
      where: {
        id: groupId,
        masterdetailId: req.query.where.masterdetailId,
      },
    });

    if (group) {
      // find categories of group
      var groupcategory = await groupcategoryModel.find({
        where: {
          groupId: groupId,
          masterdetailId: req.query.where.masterdetailId,
        },
      });

      for (const key in groupcategory) {
        if (groupcategory.hasOwnProperty(key)) {
          const oneCategory = groupcategory[key];

          // find all products of category
          var products = await productModel.find({
            where: {
              categoryId: oneCategory.categoryId,
              masterdetailId: req.query.where.masterdetailId,
            },
            include: "productmedia",
          });

          if (products.length > 0) {
            // find price for group
            for (const k in products) {
              if (products.hasOwnProperty(k)) {
                const oneProduct = products[k];

                var groupprice = await grouppriceModel.findOne({
                  where: {
                    productId: oneProduct.id,
                    groupId: groupId,
                    masterdetailId: req.query.where.masterdetailId,
                  },
                });

                if (groupprice) {
                  oneProduct.groupprice = groupprice;
                } else {
                  oneProduct.groupprice = null;
                }
              }
            }

            // find category detail
            var category = await categoryModel.findOne({
              where: {
                id: oneCategory.categoryId,
                masterdetailId: req.query.where.masterdetailId,
              },
            });
            oneCategory.name = category.name;

            oneCategory.products = products;
          } else {
            oneCategory.products = [];
            // find category detail
            var category = await categoryModel.findOne({
              where: {
                id: oneCategory.categoryId,
                masterdetailId: req.query.where.masterdetailId,
              },
            });

            if (category) {
              oneCategory.name = category.name;
            } else {
              oneCategory.name = null;
            }
          }
        }
      }

      group.category = groupcategory;
      return group;
    } else {
      return null;
    }
  };

  Group.remoteMethod("getgrouppricing", {
    accepts: [
      {
        arg: "req",
        type: "object",
        http: {
          source: "req",
        },
      },
      {
        arg: "groupId",
        type: "string",
        http: {
          source: "query",
        },
      },
    ],
    returns: {
      arg: "result",
      type: "Object",
      root: true,
    },
    http: {
      path: "/getgrouppricing",
      verb: "get",
    },
  });
};
