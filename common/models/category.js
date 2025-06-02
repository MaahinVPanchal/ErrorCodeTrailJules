"use strict";
var app = require("../../server/server");
var constants = require("../const");
var titlecase = require("title-case");
const SETTING_CONSTANTS = require("../setting_constants");

module.exports = function (Category) {

  Category.beforeRemote("create", async (ctx, modelInstance, next) => {
    try {

      if (ctx.args.data.name) {
        ctx.args.data.name = ctx.args.data.name.trim();
        if (ctx.args.data.name.length === 0) {
          if (ctx.args.data.parentId) {
            throw constants.createError(400, 'Please enter valid subcategory name');
          } else {
            throw constants.createError(400, 'Please enter valid category name');
          }
        }
      } else {
        throw constants.createError(404, 'Category name not found');
      }

      // Check Collection name already exist or not?
      var checkCategoryNameExist = await Category.findOne({
        where: {
          name: ctx.args.data.name,
          masterdetailId: ctx.args.data.masterdetailId
        }
      });

      // Check Name Validation
      if (checkCategoryNameExist) {
        if (ctx.args.data.parentId) {
          throw constants.createError(409, 'Subcategory with this name already exist, Please try with another');
        } else {
          throw constants.createError(409, 'Category with this name already exist, Please try with another');
        }
      }

      //Captalizing name
      ctx.args.data.name = titlecase.titleCase(ctx.args.data.name);

    } catch (err) {
      throw err;
    }
  });

  Category.afterRemote("create", async (ctx, modelInstance) => {

    var groupcategoryModel = app.models.groupcategory;
    var categorymediaModel = app.models.categorymedia;
    var categoryDetailsModel = app.models.categorydetail;

    try {

      // categorymedia entry in categorymedia table
      if (ctx.args.data.categorymedia) {
        await categorymediaModel.create({
          categoryname: ctx.args.data.categorymedia.name,
          categoryId: modelInstance.id,
          createdby: modelInstance.createdby,
          modifiedby: modelInstance.createdby,
          masterdetailId: ctx.req.query.where.masterdetailId
        });
      } else {
        await categorymediaModel.create({
          categoryname: constants.defaultCategory,
          categoryId: modelInstance.id,
          createdby: modelInstance.createdby,
          modifiedby: modelInstance.createdby,
          masterdetailId: ctx.req.query.where.masterdetailId
        });
      }

      if (ctx && ctx.args && ctx.args.data && ctx.args.data.parentId) {
        var getParentCategoryData = await Category.findOne({
          where: {
            id: modelInstance.parentId,
            masterdetailId: ctx.req.query.where.masterdetailId
          }
        });
        // Add subcategory count into main category
        await Category.updateAll({
          id: getParentCategoryData.id,
          masterdetailId: ctx.req.query.where.masterdetailId
        }, {
          totalsubcategories: getParentCategoryData.totalsubcategories + 1,
        });
      }

      // add category to default group
      await groupcategoryModel.create({
        groupId: await constants.default_groupId(ctx.req.query.where.masterdetailId),
        categoryId: modelInstance.id,
        created: new Date(),
        masterdetailId: ctx.req.query.where.masterdetailId
      });

      // Check need to add categorydetails
      if (ctx.args.data.categorydetails) {
        ctx.args.data.categorydetails.filter(async (item) => {
          await categoryDetailsModel.create({
            name: item.key,
            categoryId: modelInstance.id,
            masterdetailId: ctx.req.query.where.masterdetailId
          });
        });
      }

    } catch (error) {
      throw error;
    }
  });

  Category.beforeRemote("prototype.patchAttributes", async (ctx, modelInstance, next) => {

    var productModel = app.models.product;
    var categoryModel = app.models.category;
    var categorymediaModel = app.models.categorymedia;

    try {

      if (ctx.args.data.name) {
        ctx.args.data.name = titlecase.titleCase(ctx.args.data.name);
      }

      if (ctx.args.data.categorymedia) {
        var categorymedia = await categorymediaModel.findOne({
          where: {
            categoryId: ctx.args.data.id,
            masterdetailId: ctx.req.query.where.masterdetailId
          }
        });
        if (categorymedia && ctx.args.data.categorymedia.name) {
          await categorymediaModel.updateAll({
            id: categorymedia.id,
            masterdetailId: ctx.req.query.where.masterdetailId
          }, {
            categoryname: ctx.args.data.categorymedia.name
          });
        } else if (categorymedia && ctx.args.data.categorymedia.deletedAt) {
          await categorymediaModel.updateAll({
            id: categorymedia.id,
            masterdetailId: ctx.req.query.where.masterdetailId
          }, {
            categoryname: constants.defaultCategory
          });
        } else {
          await categorymediaModel.create({
            categoryname: ctx.args.data.categorymedia.name,
            categoryId: ctx.args.data.id,
            masterdetailId: ctx.req.query.where.masterdetailId
          });
        }
      }

      // when category status is deactive[false] pass - then deactive the all the product
      if (ctx.args.data.categorystatus === 0 || ctx.args.data.categorystatus === '0') {
        var getCat = await Category.findOne({
          where: {
            id: ctx.args.data.id,
            masterdetailId: ctx.req.query.where.masterdetailId
          }
        });

        if (getCat) {
          // When Request for Deactivate Category
          await categoryModel.updateAll({
            id: ctx.args.data.id,
            masterdetailId: ctx.req.query.where.masterdetailId
          }, {
            categorystatus: 0
          });

          // deactive subcategories of Deactived category
          var deactiveSub = await categoryModel.find({
            where: {
              parentId: ctx.args.data.id,
              masterdetailId: ctx.req.query.where.masterdetailId
            }
          });

          if (deactiveSub.length > 0) {
            for (var i = 0; i < deactiveSub.length; i++) {
              const element = deactiveSub[i].parentId;
              // Get Subcategories
              var getSubDeactive = await categoryModel.find({
                where: {
                  parentId: element,
                  masterdetailId: ctx.req.query.where.masterdetailId
                }
              });
              // subcategories
              await categoryModel.updateAll({
                parentId: element,
                masterdetailId: ctx.req.query.where.masterdetailId
              }, {
                categorystatus: 0
              });

              for (var j = 0; j < getSubDeactive.length; j++) {
                const element = getSubDeactive[j].id;

                // product
                await productModel.updateAll({
                  categoryId: element,
                  masterdetailId: ctx.req.query.where.masterdetailId
                }, {
                  productstatus: 0
                });
              }
            }
          }
        }

        // Deactivate products of Category
        await productModel.updateAll({
          categoryId: ctx.instance.id,
          masterdetailId: ctx.req.query.where.masterdetailId
        }, {
          productstatus: false
        });

      }

      if (ctx.args.data.categorystatus === 1 || ctx.args.data.categorystatus === '1') {
        var getCat = await categoryModel.find({
          where: {
            id: ctx.args.data.id,
            masterdetailId: ctx.req.query.where.masterdetailId
          }
        });


        if (getCat.length > 0) {
          // When Request for Deactivate Category
          await Category.updateAll({
            id: ctx.args.data.id,
            deletedAt: null,
            masterdetailId: ctx.req.query.where.masterdetailId
            // categorystatus: 1
          }, {
            categorystatus: 1
          });

          // deactive subcategories of Deactived category
          var deactiveSub = await categoryModel.find({
            where: {
              parentId: ctx.args.data.id,
              deletedAt: null,
              masterdetailId: ctx.req.query.where.masterdetailId
            }
          });

          if (deactiveSub.length > 0) {
            for (var i = 0; i < deactiveSub.length; i++) {
              const element = deactiveSub[i].parentId;
              // Get Subcategories
              var getSubDeactive = await categoryModel.find({
                where: {
                  parentId: element,
                  deletedAt: null,
                  masterdetailId: ctx.req.query.where.masterdetailId
                }
              });
              // subcategories
              await categoryModel.updateAll({
                parentId: element,
                deletedAt: null,
                masterdetailId: ctx.req.query.where.masterdetailId
              }, {
                categorystatus: 1
              });

              for (var j = 0; j < getSubDeactive.length; j++) {
                const element = getSubDeactive[j].id;

                // product
                await productModel.updateAll({
                  categoryId: element,
                  deletedAt: null,
                  masterdetailId: ctx.req.query.where.masterdetailId
                }, {
                  productstatus: 1
                });
              }
            }
          } else {
            // update products of subcategory
            await productModel.updateAll({
              categoryId: ctx.args.data.id,
              deletedAt: null,
              masterdetailId: ctx.req.query.where.masterdetailId
            }, {
              productstatus: 1
            });
          }
        }

      }

    } catch (error) {
      throw error;
    }
  });
  Category.beforeRemote("prototype.patchAttributes", async (ctx, modelInstance, next) => {

    var categoryDetailsModel = app.models.categorydetail;

    try {

      // Check need to add / edit categorydetails
      if (ctx.args.data.categorydetails && ctx.args.data.categorydetails.length > 0) {
        // Add keys
        ctx.args.data.categorydetails.filter(async (item) => {
          // Find item exist or not if not exist than create new one
          const isKeyExist = await categoryDetailsModel.findOne({
            where: {
              name: item.key,
              categoryId: ctx.args.data.id,
              masterdetailId: ctx.req.query.where.masterdetailId
            }
          });
          if (!isKeyExist) {
            await categoryDetailsModel.create({
              name: item.key,
              categoryId: ctx.args.data.id,
              masterdetailId: ctx.req.query.where.masterdetailId
            });
          }
        });

        // Map all keys
        var getKeysArrayOfDetails = ctx.args.data.categorydetails.map((item) => item.key);

        // Get All Keys
        var getAllKeyDetails = await categoryDetailsModel.find({
          where: {
            categoryId: ctx.args.data.id,
            masterdetailId: ctx.req.query.where.masterdetailId
          }
        });

        if (getAllKeyDetails && getAllKeyDetails.length > 0) {
          getAllKeyDetails.filter(async item => {
            // If key not exist delete it
            const isExist = getKeysArrayOfDetails.includes(item.name);
            if (!isExist) {
              await categoryDetailsModel.updateAll({
                id: item.id,
                categoryId: ctx.args.data.id,
                masterdetailId: ctx.req.query.where.masterdetailId
              }, {
                deletedAt: new Date()
              });
            }
          });
        }

      }
    } catch (error) {
      throw error;
    }
  });

  Category.beforeRemote("deleteById", async (ctx, modelInstance, next) => {
    var productModel = app.models.product;

    // update product
    // await productModel.updateAll({
    //   categoryId: ctx.args.id
    // }, {
    //   productstatus: false
    // });

    // 1. check the deleted item id category or subcategory
    // -> If Category
    //         then delete all category with their products of main category

    // -> If subcategory
    //        then delete all products of that category


    // when Deleted item is Category
    var isCategory = await Category.findOne({
      where: {
        id: ctx.args.id,
        deletedAt: null,
        parentId: null,
        masterdetailId: ctx.req.query.where.masterdetailId
      }
    });

    if (isCategory) {
      // Deactivate Deleted Category
      await Category.updateAll({
        id: ctx.args.id,
        masterdetailId: ctx.req.query.where.masterdetailId
      }, {
        categorystatus: 0
      });

      // if Yes the delete products of category
      await productModel.updateAll({
        categoryId: ctx.args.id,
        masterdetailId: ctx.req.query.where.masterdetailId
      }, {
        productstatus: false,
        deletedAt: new Date()
      });

      // find the subcategories of category & Delete them too
      var deactiveSubcategoryfind = await Category.find({
        where: {
          parentId: ctx.args.id,
          masterdetailId: ctx.req.query.where.masterdetailId
        }
      });

      for (var i = 0; i < deactiveSubcategoryfind.length; i++) {
        const element = deactiveSubcategoryfind[i].id;
        await productModel.updateAll({
          categoryId: element,
          masterdetailId: ctx.req.query.where.masterdetailId
        }, {
          productstatus: 0,
          deletedAt: new Date()
        });
      }

      // deactivate subcategoris of deleted Category & Delete them too
      await Category.updateAll({
        parentId: ctx.args.id,
        masterdetailId: ctx.req.query.where.masterdetailId
      }, {
        categorystatus: 0,
        deletedAt: new Date()
      });
    }


    // when Deleted item is Subcategory
    var getSubCategoryData = await Category.find({
      where: {
        id: ctx.args.id,
        deletedAt: null,
        masterdetailId: ctx.req.query.where.masterdetailId
      }
    });

    if (getSubCategoryData[0].parentId) {
      var findCategory = await Category.find({
        where: {
          id: getSubCategoryData[0].parentId,
          deletedAt: null,
          masterdetailId: ctx.req.query.where.masterdetailId
        }
      });

      if (findCategory.length > 0) {
        //  when subcategory deleted deactivate products
        await productModel.updateAll({
          categoryId: ctx.args.id,
          productstatus: 1,
          masterdetailId: ctx.req.query.where.masterdetailId
        }, {
          productstatus: 0,
          deletedAt: new Date(),
        });

        await Category.updateAll({
          id: ctx.args.id,
          masterdetailId: ctx.req.query.where.masterdetailId
        }, {
          categorystatus: 0,
          deletedAt: new Date()
        });

        var getTotalSubCategories = await Category.find({
          where: {
            id: findCategory[0].id,
            deletedAt: null,
            masterdetailId: ctx.req.query.where.masterdetailId
          }
        });

        if (getTotalSubCategories.length > 0) {
          //  decrease count of category
          await Category.updateAll({
            id: getTotalSubCategories[0].id,
            masterdetailId: ctx.req.query.where.masterdetailId
          }, {
            totalsubcategories: getTotalSubCategories[0].totalsubcategories - 1
          });
        }
      }
    }

  });

  Category.afterRemote("deleteById", async (ctx, modelInstance, next) => {
    var groupcategoryModel = app.models.groupcategory;
    // delete category from groupcategory
    await groupcategoryModel.updateAll({
      categoryId: ctx.args.id,
      masterdetailId: ctx.req.query.where.masterdetailId
    }, {
      deletedAt: new Date(),
    });
  });


  Category.beforeRemote("find", async (ctx, modelInstance, next) => {

    try {

      ctx.req.query = ctx.req.query || {};
      ctx.req.query.filter = ctx.req.query.filter || {};
      ctx.req.query.filter.where = ctx.req.query.filter.where || {};
      ctx.req.query.filter.where.masterdetailId = ctx.req.query.where.masterdetailId;

      if (!ctx.req.query.filter.order) {
        ctx.req.query.filter.order = "name asc"
      }
    } catch (error) {
      throw error;
    }

  });

  Category.afterRemote("find", async (ctx, modelInstance) => {

    var resData = {};

    try {
      // data table of main category and sub category
      if (ctx.req.query.isWeb) {

        var category = await Category.find({
          where: {
            masterdetailId: ctx.req.query.where.masterdetailId
          }
        });
        resData.data = modelInstance;
        resData.length = category.length;

        if (ctx.req.query.filter.where && ctx.req.query.filter.where.and) {
          // Search For SubCategory
          if ((ctx.req.query.filter.where.and[0].name || ctx.req.query.filter.where.and[0].totalproducts) && ctx.req.query.filter.where.and[0].isCategory === "0") {

            // Search For SubCategory Name
            if (ctx.req.query.filter.where.and[0].name && ctx.req.query.filter.where.and[0].isCategory === "0") {
              var categorySearchDataSub = await Category.find({
                where: {
                  name: ctx.req.query.filter.where.and[0].name,
                  deletedAt: null,
                  categorystatus: 1,
                  parentId: ctx.req.query.filter.where.and[0].parentId,
                  masterdetailId: ctx.req.query.where.masterdetailId
                },
                include: ['categorymedia', 'categorydetail'],
                limit: ctx.req.query.filter.limit,
                skip: ctx.req.query.filter.skip,
                order: ctx.req.query.filter.order
              });
            }

            // Search For totalproducts
            if (ctx.req.query.filter.where.and[0].totalproducts && ctx.req.query.filter.where.and[0].isCategory === "0") {
              var categorySearchDataSub = await Category.find({
                where: {
                  totalproducts: ctx.req.query.filter.where.and[0].totalproducts,
                  deletedAt: null,
                  categorystatus: 1,
                  parentId: ctx.req.query.filter.where.and[0].parentId,
                  masterdetailId: ctx.req.query.where.masterdetailId
                },
                include: ['categorymedia', 'categorydetail'],
                limit: ctx.req.query.filter.limit,
                skip: ctx.req.query.filter.skip
              });
            }

            resData.data = categorySearchDataSub;
            if (categorySearchDataSub) {
              resData.length = categorySearchDataSub.length;
            }
            ctx.res.status(200).send(resData);
          }

          // Search For Category
          if ((ctx.req.query.filter.where.and[0].name || ctx.req.query.filter.where.and[0].totalsubcategories) && ctx.req.query.filter.where.and[0].isCategory === "1") {

            // Search For Category Name
            if (ctx.req.query.filter.where.and[0].name && ctx.req.query.filter.where.and[0].isCategory === "1") {
              var categorySearchData = await Category.find({
                where: {
                  name: ctx.req.query.filter.where.and[0].name,
                  totalsubcategories: ctx.req.query.filter.where.and[0].totalsubcategories,
                  deletedAt: null,
                  categorystatus: 1,
                  parentId: null,
                  masterdetailId: ctx.req.query.where.masterdetailId
                },
                include: 'categorymedia',
                limit: ctx.req.query.filter.limit,
                skip: ctx.req.query.filter.skip,
                order: ctx.req.query.filter.order
              });
            }

            // Search For totalsubcategories
            if (ctx.req.query.filter.where.and[0].totalsubcategories && ctx.req.query.filter.where.and[0].isCategory === "1") {
              var categorySearchData = await Category.find({
                where: {
                  totalsubcategories: ctx.req.query.filter.where.and[0].totalsubcategories,
                  deletedAt: null,
                  categorystatus: 1,
                  parentId: null,
                  masterdetailId: ctx.req.query.where.masterdetailId
                },
                include: 'categorymedia',
                limit: ctx.req.query.filter.limit,
                skip: ctx.req.query.filter.skip,
                order: ctx.req.query.filter.order
              });
            }

            resData.data = categorySearchData;
            if (categorySearchData) {
              resData.length = categorySearchData.length;
            }
            ctx.res.status(200).send(resData);
          }

          // Category With Active Data
          if (ctx.req.query.filter.where.and[0].categorystatus === 1 && ctx.req.query.filter.where.and[0].isCategory === "1") {
            var categoryData = await Category.find({
              where: {
                and: [{
                  parentId: null
                }, {
                  categorystatus: 1
                }, {
                  deletedAt: null
                }],
                masterdetailId: ctx.req.query.where.masterdetailId
              },
              include: 'categorymedia',
              limit: ctx.req.query.filter.limit,
              skip: ctx.req.query.filter.skip, order: ctx.req.query.filter.order
            });
            var categoryLength = await Category.find({
              where: {
                and: [{
                  parentId: null,
                }, {
                  categorystatus: 1,
                }, {
                  deletedAt: null,
                }],
                masterdetailId: ctx.req.query.where.masterdetailId
              }
            });

            resData.data = categoryData;
            resData.length = categoryLength.length;
            ctx.res.status(200).send(resData);
          }

          // Category With DeActive Data
          if (ctx.req.query.filter.where.and[0].categorystatus === 0 && ctx.req.query.filter.where.and[0].isCategory === "1") {
            var categoryData = await Category.find({
              where: {
                and: [{
                  parentId: null,
                }, {
                  categorystatus: 0,
                }, {
                  deletedAt: null,
                }],
                masterdetailId: ctx.req.query.where.masterdetailId
              },
              include: 'categorymedia',
              limit: ctx.req.query.filter.limit,
              skip: ctx.req.query.filter.skip,
              order: ctx.req.query.filter.order
            });
            var categoryLength = await Category.find({
              where: {
                and: [{
                  parentId: null,
                }, {
                  categorystatus: 0,
                }, {
                  deletedAt: null,
                }],
                masterdetailId: ctx.req.query.where.masterdetailId
              }
            });

            resData.data = categoryData;
            resData.length = categoryLength.length;
            ctx.res.status(200).send(resData);
          }

          // SubCategory With Active Data
          if (ctx.req.query.filter.where.and[0].categorystatus === 1 && ctx.req.query.filter.where.and[0].isCategory === "0") {
            var categoryData = await Category.find({
              where: {
                and: [{
                  parentId: ctx.req.query.filter.where.and[0].parentId,
                }, {
                  categorystatus: 1,
                }, {
                  deletedAt: null,
                }],
                masterdetailId: ctx.req.query.where.masterdetailId
              },
              include: ['categorymedia', 'categorydetail'],
              limit: ctx.req.query.filter.limit,
              skip: ctx.req.query.filter.skip,
              order: ctx.req.query.filter.order
            });
            var categoryLength = await Category.find({
              where: {
                and: [{
                  parentId: ctx.req.query.filter.where.and[0].parentId,
                }, {
                  categorystatus: 1,
                }, {
                  deletedAt: null,
                }],
                masterdetailId: ctx.req.query.where.masterdetailId
              }
            });
            resData.data = categoryData;
            resData.length = categoryLength.length;
            ctx.res.status(200).send(resData);
          }

          // SubCategory With DeActive Data
          if (ctx.req.query.filter.where.and[0].categorystatus === 0 && ctx.req.query.filter.where.and[0].isCategory === "0") {
            var categoryData = await Category.find({
              where: {
                and: [{
                  parentId: ctx.req.query.filter.where.and[0].parentId,
                }, {
                  categorystatus: 0,
                }, {
                  deletedAt: null,
                }],
                masterdetailId: ctx.req.query.where.masterdetailId
              },
              include: ['categorymedia', 'categorydetail'],
              limit: ctx.req.query.filter.limit,
              skip: ctx.req.query.filter.skip,
              order: ctx.req.query.filter.order
            });
            var categoryLength = await Category.find({
              where: {
                and: [{
                  parentId: ctx.req.query.filter.where.and[0].parentId,
                }, {
                  categorystatus: 0,
                }, {
                  deletedAt: null,
                }],
                masterdetailId: ctx.req.query.where.masterdetailId
              }
            });
            resData.data = categoryData;
            resData.length = categoryLength.length;
            ctx.res.status(200).send(resData);
          }

          // Get Subcategories
          if (ctx.req.query && ctx.req.query.filter && ctx.req.query.filter.where && ctx.req.query.filter.where.and && ctx.req.query.filter.where.and[0].isCategory === "0") {
            // sub category
            var categoryData = await Category.find({
              where: {
                and: [{
                  parentId: ctx.req.query.filter.where.and[0].parentId
                }, {
                  categorystatus: 1
                }, {
                  deletedAt: null
                }],
                masterdetailId: ctx.req.query.where.masterdetailId
              },
              include: ['categorymedia', 'categorydetail'],
              limit: ctx.req.query.filter.limit,
              skip: ctx.req.query.filter.skip,
              order: ctx.req.query.filter.order
            });
            var categoryLength = await Category.find({
              where: {
                and: [{
                  parentId: ctx.req.query.filter.where.and[0].parentId,
                },
                {
                  categorystatus: 1,
                },
                {
                  deletedAt: null,
                },
                ],
                masterdetailId: ctx.req.query.where.masterdetailId
              },
            });
            resData.data = categoryData;
            resData.length = categoryLength.length;
            ctx.res.status(200).send(resData);
          }
          // Get Categopries
          if (ctx.req.query && ctx.req.query.filter && ctx.req.query.filter.where && ctx.req.query.filter.where.and && ctx.req.query.filter.where.and[0].isCategory === "1") {
            // main category
            var categoryData = await Category.find({
              where: {
                and: [{
                  parentId: null
                }, {
                  categorystatus: 1
                }, {
                  deletedAt: null
                }],
                masterdetailId: ctx.req.query.where.masterdetailId
              },
              limit: ctx.req.query.filter.limit,
              skip: ctx.req.query.filter.skip,
              order: ctx.req.query.filter.order,
              include: 'categorymedia',
              order: ctx.req.query.filter.order
            });
            var categoryLength = await Category.find({
              where: {
                and: [{
                  parentId: null,
                },
                {
                  categorystatus: 1,
                },
                {
                  deletedAt: null,
                },
                ],
                masterdetailId: ctx.req.query.where.masterdetailId
              },
            });

            resData.data = categoryData;
            resData.length = categoryLength.length;
            ctx.res.status(200).send(resData);
          }
        } else {
          // ctx.res.status(200).send(resData);
        }
      }

      if (
        ctx.req.query &&
        ctx.req.query.filter &&
        ctx.req.query.filter.where &&
        ctx.req.query.filter.where.and
      ) {
        // Get Total Categories Count (Total Count)
        if (ctx.req.query.filter.where.and[0].isTotal === "1") {
          var category = await Category.find({
            where: {
              and: [{
                parentId: null
              }, {
                deletedAt: null
              }],
              masterdetailId: ctx.req.query.where.masterdetailId
            }
          });

          resData.data = category;
          resData.length = category.length;
          ctx.res.status(200).send(resData);
        }

        // Get Total Deactivate Categories Count
        if (ctx.req.query.filter.where.and[0].isDeactivateTotal === "1") {
          var category = await Category.find({
            where: {
              and: [{
                categorystatus: 0
              }, {
                parentId: null
              }, {
                deletedAt: null
              }],
              masterdetailId: ctx.req.query.where.masterdetailId
            }
          });

          resData.data = category;
          resData.length = category.length;
          ctx.res.status(200).send(resData);
        }

        // Get Total Activate Categories Count
        if (ctx.req.query.filter.where.and[0].isActivateTotal === "1") {
          var category = await Category.find({
            where: {
              and: [{
                categorystatus: 1
              }, {
                parentId: null
              }, {
                deletedAt: null
              }],
              masterdetailId: ctx.req.query.where.masterdetailId
            }
          });

          resData.data = category;
          resData.length = category.length;
          ctx.res.status(200).send(resData);
        }

        // Get All Subcategories For Groups
        if (ctx.req.query.filter.where.and[0].isSubCategoryData === "1") {
          var category = await Category.find({
            where: {
              and: [{
                categorystatus: 1
              }, {
                parentId: {
                  neq: null
                }
              }, {
                deletedAt: null
              }],
              masterdetailId: ctx.req.query.where.masterdetailId
            }
          });

          resData.data = category;
          resData.length = category.length;
          ctx.res.status(200).send(resData);
        }

        // Get All Categories For Groups
        if (ctx.req.query.filter.where.and[0].isCategoryData === "1") {
          var category = await Category.find({
            where: {
              and: [{
                categorystatus: 1
              }, {
                parentId: null
              },
              {
                deletedAt: null
              }],
              masterdetailId: ctx.req.query.where.masterdetailId
            }
          });

          resData.data = category;
          resData.length = category.length;
          ctx.res.status(200).send(resData);
        }
        // Get All SubCategories For Groups
        if (ctx.req.query.filter.where.and[0].isCategoryData === "0") {
          var getAllSubcategories = await Category.find({
            where: {
              and: [{
                categorystatus: 1
              }, {
                parentId: {
                  neq: null
                }
              }],
              masterdetailId: ctx.req.query.where.masterdetailId
            }
          });
          resData.data = getAllSubcategories;
          resData.length = getAllSubcategories.length;
          ctx.res.status(200).send(resData);
        }
      }
    } catch (error) {
      throw error;
    }
  });

  Category.categoryprogress = async (req) => {
    var categoryModel = app.models.category;

    // find all product
    var allcategory = await categoryModel.count({
      where: {
        masterdetailId: req.query.where.masterdetailId
      }
    });

    // active product count
    var activecategory = await categoryModel.find({
      where: {
        categorystatus: 1,
        masterdetailId: req.query.where.masterdetailId
      },
    });

    var deactivecategory = await categoryModel.find({
      where: {
        categorystatus: 0,
        masterdetailId: req.query.where.masterdetailId
      },
    });

    var activeData = (activecategory.length * 100) / allcategory;
    var deactiveData = (deactivecategory.length * 100) / allcategory;

    var obj = {
      activeData: activeData,
      deactiveData: deactiveData,
    };
    return obj;
    // return order.length;
  };

  // Edited By Akib Dahya Based On Category TotalCount, ActiveCategoryCount, DeActiveCategoryCount
  Category.categorycount = async (req) => {
    var categoryModel = app.models.category;

    // Total Category
    // var allcategory = await categoryModel.count({});

    var allcategory = await categoryModel.find({
      where: {
        parentId: null,
        deletedAt: null,
        masterdetailId: req.query.where.masterdetailId
      },
    });

    // Active Category Count
    var activecategory = await categoryModel.find({
      where: {
        categorystatus: 1,
        deletedAt: null,
        parentId: null,
        masterdetailId: req.query.where.masterdetailId
      },
    });
    // DeActive Category Count
    var deactivecategory = await categoryModel.find({
      where: {
        categorystatus: 0,
        deletedAt: null,
        parentId: null,
        masterdetailId: req.query.where.masterdetailId
      },
    });

    // var activeData = (activecategory.length * 100) / allcategory;
    // var deactiveData = (deactivecategory.length * 100) / allcategory;

    var activeData = activecategory.length;
    var deactiveData = deactivecategory.length;


    var obj = {
      activeData: activeData,
      deactiveData: deactiveData,
    };
    return obj;
    // return order.length;
  };

  Category.getcategory = async (req) => {
    try {
      var categoryModel = app.models.category;
      var subcatId = req.body.subcatId;

      var subcategory = await categoryModel.findOne({
        where: {
          id: subcatId,
          masterdetailId: req.query.where.masterdetailId
        },
      });

      if (subcategory) {
        var catId = subcategory.parentId;

        var category = await categoryModel.findOne({
          where: {
            id: catId,
            masterdetailId: req.query.where.masterdetailId
          },
        });
      } else {
        var err = new Error("Sorry! SubCategory not found");
        err.statusCode = 404;
        throw err;
      }

      if (category) {
        return category;
      } else {
        var err = new Error("Sorry! Category not found");
        err.statusCode = 404;
        throw err;
      }
    } catch (error) {
      throw error;
    }
  };

  Category.exportCategory = async (req) => {
    var tempArray = [];
    var getcategory;

    try {
      getcategory = await Category.find({
        where: {
          and: [{
            parentId: null
          }, {
            deletedAt: null
          }],
          masterdetailId: req.query.where.masterdetailId
        }
      });

      if (getcategory.length > 0) {
        for (var i = 0; i < getcategory.length; i++) {
          const element = getcategory[i];
          var status = '';
          if (element.categorystatus === 0) {
            status = "Deacvtive"
          } else if (element.categorystatus === 1) {
            status = "Active"
          } else {
            status = "--"
          }
          tempArray.push({
            'Category Name': element.name,
            'Category Status': status,
            'Total Number of Subcategories': element.totalsubcategories
          });
        }
      } else {
        throw constants.createError(404, 'Sorry! data not available!');
      }
      return tempArray;
    } catch (error) {
      throw error;
    }
  };

  Category.exportSubcategory = async (req) => {
    var tempArray = [];
    var getcategory;
    var status = '';

    try {

      getcategory = await Category.find({
        where: {
          and: [{
            parentId: req.query.filter.where.id,
          }, {
            deletedAt: null,
          }],
          masterdetailId: req.query.where.masterdetailId
        }
      });

      if (getcategory.length > 0) {
        for (var i = 0; i < getcategory.length; i++) {
          const element = getcategory[i];

          // get Category name
          var getcatname = await Category.findOne({
            where: {
              id: element.parentId,
              masterdetailId: req.query.where.masterdetailId
            }
          });

          if (element.categorystatus === 0) {
            status = "Deactive";
          } else if (element.categorystatus === 1) {
            status = "Active";
          } else {
            status = "--";
          }

          tempArray.push({
            'Subcategory Name': element.name,
            'Subcategory Status': status,
            'Category Name': getcatname.name,
            'Total Number of Products': element.totalproducts
          });

        }
      } else {
        throw constants.createError(404, 'Sorry! data not available!');
      }

      return tempArray;

    } catch (error) {
      throw error;
    }
  };

  // Import Category Data
  Category.importCategory = async (req) => {
    var createdCategory;
    var createdSubcategory;
    var tempArray = [];

    try {

      // check that the required field names are present
      for (var i = 0; i < req.body.length; i++) {
        const element = req.body[i];
        if (!"Category Name" in element === true) {
          throw constants.createError(404, 'Please upload file in proper format!');
        }
      }

      if (req.body.length > 0) {
        // check any property is not empty
        req.body.filter((element) => {
          var result = Object.entries(element);
          result.filter((r) => {
            if (r[1] === '' || r[1] === null) {
              throw constants.createError(404, 'Sorry! " + r[0] + " Cannot be blank or null in selected file!');
            }
          });
        });

        for (var i = 0; i < req.body.length; i++) {
          const element = req.body[i];

          var subCategoryArray = [];
          if ("Subcategory Name" in element) {
            subCategoryArray = element["Subcategory Name"].split(", ");
          }

          // create category
          createdCategory = await Category.create({
            name: element["Category Name"],
            categorystatus: 1,
            totalsubcategories: subCategoryArray.length === 0 ? 0 : subCategoryArray.length,
            createdby: req.accessToken.userId,
            modifiedby: req.accessToken.userId,
            masterdetailId: req.query.where.masterdetailId
          });


          if (subCategoryArray && subCategoryArray.length > 0) {
            for (let j = 0; j < subCategoryArray.length; j++) {
              const elementOfSub = subCategoryArray[j];
              createdSubcategory = await Category.create({
                name: elementOfSub,
                categorystatus: 1,
                parentId: createdCategory.id,
                createdby: req.accessToken.userId,
                modifiedby: req.accessToken.userId,
                masterdetailId: req.query.where.masterdetailId
              });
              await createCategoryMedia({
                categoryname: constants.defaultCategory,
                createdby: req.accessToken.userId,
                categoryId: createdSubcategory.id,
                masterdetailId: req.query.where.masterdetailId
              });
            }
          }

          tempArray.push(createdCategory);
          // add image in category media
          if (element["Image Name"]) {
            await createCategoryMedia({
              categoryname: element["Image Name"],
              createdby: req.accessToken.userId,
              categoryId: createdCategory.id,
              masterdetailId: req.query.where.masterdetailId
            });
          } else {
            await createCategoryMedia({
              categoryname: constants.defaultCategory,
              createdby: req.accessToken.userId,
              categoryId: createdCategory.id,
              masterdetailId: req.query.where.masterdetailId
            });
          }
        }
        return tempArray;
      } else {
        throw constants.createError(404, 'Sorry! data not available!');
      }

    } catch (error) {
      throw error
    }
  };

  // Import SubCategory Data
  Category.importSubcategory = async (req) => {

    var createdSubcategory;
    var tempArray = [];

    try {
      // check that the required field names are present
      for (var i = 0; i < req.body.length; i++) {
        const element = req.body[i];
        if ("Category Name" in element === true && "Subcategory Name" in element === true) {
          // console.log("true");
        } else {
          // console.log("false");
          throw constants.createError(404, 'Please upload file in proper format!');
        }
      }

      if (req.body.length > 0) {
        // check any property is not empty
        req.body.filter((element) => {
          var result = Object.entries(element);
          result.filter((r) => {
            if (r[1] === '' || r[1] === null) {
              throw constants.createError(404, 'Sorry! " + r[0] + " cannot be blank or null in selected file!');
            }
          });
        });

        for (var i = 0; i < req.body.length; i++) {
          const element = req.body[i];

          // Get category Name
          var getCat = await Category.findOne({
            where: {
              name: element["Category Name"],
              masterdetailId: req.query.where.masterdetailId
            }
          });

          if (getCat != null) {
            // create sub category
            createdSubcategory = await Category.create({
              name: element["Subcategory Name"],
              categorystatus: 1,
              parentId: getCat.id,
              createdby: req.accessToken.userId,
              modifiedby: req.accessToken.userId,
              masterdetailId: req.query.where.masterdetailId
            });
            tempArray.push(createdSubcategory)
            // add image in category media
            if (element["Image Name"]) {
              await createCategoryMedia({
                categoryname: element["Image Name"],
                createdby: req.accessToken.userId,
                categoryId: createdSubcategory.id,
                masterdetailId: req.query.where.masterdetailId
              });
            } else {
              await createCategoryMedia({
                categoryname: constants.defaultCategory,
                createdby: req.accessToken.userId,
                categoryId: createdSubcategory.id,
                masterdetailId: req.query.where.masterdetailId
              });
            }
            // Increase Counter of category in total subcategories
            await Category.updateAll({
              id: getCat.id,
              masterdetailId: req.query.where.masterdetailId
            }, {
              totalsubcategories: getCat.totalsubcategories + 1
            });
          } else {
            throw constants.createError(404, 'Sorry! Data with selected category name " + element["Category Name"] + " is not available!');
          }
        }
        return tempArray;
      } else {
        throw constants.createError(404, 'Sorry! no data available');
      }

    } catch (error) {
      throw error
    }
  };


  Category.topCategories = async (req) => {
    try {
      var categorymediaModel = app.models.categorymedia;

      var query = "SELECT sum(product.sellcounter) as soldcounter, product.categoryId, category.parentId FROM `product` JOIN category ON category.id = product.categoryId GROUP BY WHERE  masterdetailId = '" + req.query.where.masterdetailId + "' category.parentId ORDER BY soldcounter DESC  LIMIT " + req.query.filter.skip + "," + req.query.filter.limit;
      var category = await new Promise((resolve, reject) => {
        app.datasources.mysql.connector.execute(query, null, (err, result) => {
          if (err) reject(err);
          resolve(result);
        });
      });

      for (const key in category) {
        if (category.hasOwnProperty(key)) {
          const element = category[key];
          // attach categoryData
          var categoryData = await Category.findOne({
            where: {
              id: element.parentId,
              masterdetailId: req.query.where.masterdetailId
            }
          });
          element.category = categoryData;
          // attach categorymedia
          var media = await categorymediaModel.find({
            where: {
              categoryId: element.parentId,
              masterdetailId: req.query.where.masterdetailId
            }
          });
          element.categorymedia = media;
        }
      }

      return category;

    } catch (error) {
      throw error;
    }
  };

  Category.createmedia = async (req) => {

    var categorymediaModel = app.models.categorymedia;

    try {

      var allcategory = await Category.find({
        where: {
          masterdetailId: req.query.where.masterdetailId
        }
      });

      for (var i = 0; i < allcategory.length; i++) {
        const element = allcategory[i];

        await categorymediaModel.create({
          categoryname: constants.noImageFound,
          createdby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91',
          modifiedby: 'a11d6df9-19f7-4f9e-849a-de60c78f0b91',
          categoryId: element.id,
          masterdetailId: req.query.where.masterdetailId
        });

      }

    } catch (error) {
      throw error;
    }

  };

  Category.titleCaseCategory = async (req) => {

    var productModel = app.models.product;
    var cityModel = app.models.city
    var userModel = app.models.user;
    var stateModel = app.models.state;
    var groupModel = app.models.group;
    try {

      // category
      var allcategory = await Category.find({
        where: {
          masterdetailId: req.query.where.masterdetailId
        }
      });
      // products
      var allproduct = await productModel.find({
        where: {
          masterdetailId: req.query.where.masterdetailId
        }
      });
      // city
      var allcity = await cityModel.find({
        where: {
          masterdetailId: req.query.where.masterdetailId
        }
      });
      // state & country
      var allstateandcountry = await stateModel.find({
        where: {
          masterdetailId: req.query.where.masterdetailId
        }
      });
      // users
      var allusers = await userModel.find({
        where: {
          masterdetailId: req.query.where.masterdetailId
        }
      });
      // groups
      var allgroups = await groupModel.find({
        where: {
          masterdetailId: req.query.where.masterdetailId
        }
      });

      // category
      for (var i = 0; i < allcategory.length; i++) {
        const element = allcategory[i];
        await Category.updateAll({
          id: element.id
        }, {
          name: titlecase.titleCase(element.name)
        });
      }

      // products
      for (var i = 0; i < allproduct.length; i++) {
        const element = allproduct[i];
        await productModel.updateAll({
          id: element.id
        }, {
          name: titlecase.titleCase(element.name)
        });
      }

      // city
      for (var i = 0; i < allcity.length; i++) {
        const element = allcity[i];
        await cityModel.updateAll({
          id: element.id
        }, {
          name: titlecase.titleCase(element.name)
        });
      }

      // state & country
      for (var i = 0; i < allstateandcountry.length; i++) {
        const element = allstateandcountry[i];
        var nameTitleCase = titlecase.titleCase(element.name);
        element.name = nameTitleCase;
        await stateModel.updateAll({
          id: element.id
        }, {
          name: element.name
        });
      }

      // group
      for (var i = 0; i < allgroups.length; i++) {
        const element = allgroups[i];
        var nameTitleCase = titlecase.titleCase(element.name);
        element.name = nameTitleCase;
        await groupModel.updateAll({
          id: element.id
        }, {
          name: element.name
        });
      }

      // user
      for (var i = 0; i < allusers.length; i++) {
        const element = allusers[i];
        //Captalizing companyname
        if (element.companyname) {
          element.companyname = titlecase.titleCase(element.companyname);
        }
        //Captalizing name
        if (element.firstname) {
          element.firstname = titlecase.titleCase(element.firstname);
        }
        if (element.lastname) {
          element.lastname = titlecase.titleCase(element.lastname);
        }
        if (element.username) {
          element.username = titlecase.titleCase(element.username);
        }
        //Captalizing address
        if (element.address) {
          element.address = titlecase.titleCase(element.address);
        }
        await userModel.updateAll({
          id: element.id
        }, {
          firstname: element.firstname,
          lastname: element.lastname,
          username: element.username,
          companyname: element.companyname
        });
      }

    } catch (error) {
      throw error;
    }

  };

  Category.getCategoryListWithSubcatogories = async (req) => {

    var tempQuery = '';
    var categoryQuery = '';

    var categoryData;
    var getSubcategories;

    var SETTING_MODEL = app.models.setting;
    var COLLECTION_MODEL = app.models.collection;
    var CATEGORY_MEDIA_MODEL = app.models.categorymedia;

    try {

      var getMenuCategoriesSetting = await SETTING_MODEL.findOne({
        where: {
          registerallow: SETTING_CONSTANTS.MENU_CATEGORIES,
          masterdetailId: req.query.where.masterdetailId
        }
      });

      if (getMenuCategoriesSetting) {
        getMenuCategoriesSetting = JSON.parse(getMenuCategoriesSetting.text);
      }

      if (getMenuCategoriesSetting && getMenuCategoriesSetting.length > 0) {
        categoryData = [];
        for (let i = 0; i < getMenuCategoriesSetting.length; i++) {
          const element = getMenuCategoriesSetting[i];
          var getSingleCategory = await Category.findOne({
            where: {
              id: element.id,
              categorystatus: 1,
              masterdetailId: req.query.where.masterdetailId
            }
          });
          if (categoryData.length <= req.query.filter.limit) {
            categoryData.push(getSingleCategory.id);
          } else {
            break;
          }
        }
        if (categoryData.length > 0) {
          categoryData = await categoryData.map(item => JSON.stringify(item)).join();
          categoryData = "(" + categoryData + ")";
          categoryQuery = "SELECT * FROM `category` WHERE `id` IN " + categoryData
            + " AND `categorystatus` = 1 AND `deletedAt` IS NULL AND `parentId` IS NULL AND `masterdetailId` = '"
            + req.query.where.masterdetailId + "' ORDER BY `created` DESC LIMIT " + req.query.filter.skip + "," + req.query.filter.limit;
        } else {
          categoryQuery = "SELECT * FROM `category` WHERE `categorystatus` = 1 AND `deletedAt` IS NULL AND `parentId` IS NULL AND `masterdetailId` = '"
            + req.query.where.masterdetailId + "' ORDER BY `created` DESC LIMIT " + req.query.filter.skip + "," + req.query.filter.limit;
        }
      } else {
        categoryQuery = "SELECT * FROM `category` WHERE `categorystatus` = 1 AND `deletedAt` IS NULL AND `parentId` IS NULL AND `masterdetailId` = '"
          + req.query.where.masterdetailId + "' ORDER BY `created` DESC LIMIT " + req.query.filter.skip + "," + req.query.filter.limit;
      }
      categoryData = await new Promise((resolve, reject) => {
        app.datasources.mysql.connector.execute(categoryQuery, null, (err, result) => {
          if (err) reject(err);
          resolve(result);
        });
      });

      if (categoryData && categoryData.length > 0) {
        for (let i = 0; i < categoryData.length; i++) {
          const element = categoryData[i];

          // Attach Categorymedia
          var media = await CATEGORY_MEDIA_MODEL.find({
            where: {
              categoryId: element.id,
              masterdetailId: req.query.where.masterdetailId
            },
            skip: 0,
            limit: 1
          });
          element.categorymedia = media;

          // Attach Subcategories
          getSubcategories = await Category.find({
            where: {
              categorystatus: 1,
              parentId: element.id,
              masterdetailId: req.query.where.masterdetailId
            },
            skip: 0,
            limit: 10,
            order: 'created DESC',
            include: ["categorymedia"]
          });
          element.subcategories = getSubcategories;

        }
      }

      var getCollectionCount = await COLLECTION_MODEL.count({
        masterdetailId: req.query.where.masterdetailId,
        collection_status: 1,
        visibility: 1
      });

      var isShowCollectionMenu = true;
      getCollectionCount > 0 ? isShowCollectionMenu = true : isShowCollectionMenu = false;

      return {
        isShowCollectionMenu,
        categories: categoryData
      };

    } catch (error) {
      throw error;
    }

  };

  // Create function for Category Media
  async function createCategoryMedia(params) {
    var categoryMedia = await app.models.categorymedia.create({
      categoryname: params.categoryname,
      createdby: params.createdby,
      modifiedby: params.createdby,
      categoryId: params.categoryId,
      masterdetailId: params.masterdetailId
    });
    return categoryMedia;
  }

};


