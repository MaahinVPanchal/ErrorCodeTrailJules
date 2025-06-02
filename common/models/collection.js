"use strict";

var app = require("../../server/server");

const TINYURL = require("tinyurl");
const CONSTANTS = require("../const");
const TITLE_CASE = require("title-case");
const SETTING_CONSTANTS = require("../setting_constants");

const MANUAL_COLLECTION = 1;
const AUTOMATED_COLLECTION = 2;
const PUBLIC_VISIBILITY = 1;
const PRIVATE_VISIBILITY = 2;
const AND_COLLECTION_MAIN_CONDITION = 1;
const OR_COLLECTION_MAIN_CONDITION = 2;

module.exports = function (Collection) {
  Collection.beforeRemote("create", async (ctx, modelInstance, next) => {
    var PRODUCT_MODEL = app.models.product;

    try {
      if (ctx.args.data.collection_name) {
        ctx.args.data.collection_name = ctx.args.data.collection_name.trim();
        if (ctx.args.data.collection_name.length === 0) {
          throw CONSTANTS.createError(
            400,
            "Please enter valid collection name"
          );
        }
      } else {
        throw CONSTANTS.createError(404, "Collection name not found");
      }

      // Check Collection name already exist or not?
      var checkCollectionNameExist = await Collection.findOne({
        where: {
          collection_name: ctx.args.data.collection_name,
          masterdetailId: ctx.args.data.masterdetailId,
        },
      });

      // Check Name Validation
      if (checkCollectionNameExist) {
        throw CONSTANTS.createError(
          409,
          "Name already exist, Please try with another"
        );
      }

      //Captalizing name
      ctx.args.data.collection_name = TITLE_CASE.titleCase(
        ctx.args.data.collection_name
      );

      if (!ctx.args.data.collection_image) {
        ctx.args.data.collection_image = CONSTANTS.DEFAULT_IMAGE_COLLECTION;
      }

      if (ctx.args.data.collection_type === MANUAL_COLLECTION) {
        // Same Item should not exist twice in Item Array
        if (ctx.args.data.collection_filters.products.length > 0) {
          for (
            let i = 0;
            i < ctx.args.data.collection_filters.products.length;
            i++
          ) {
            const item = ctx.args.data.collection_filters.products[i];

            var isValidProduct = await PRODUCT_MODEL.findOne({
              where: {
                id: item.id,
                masterdetailId: ctx.args.data.masterdetailId,
              },
            });
            if (!isValidProduct) {
              throw CONSTANTS.createError(400, "Bad Request");
            }

            const count = ctx.args.data.collection_filters.products.filter(
              (obj) => obj.id === item.id
            ).length;
            if (count > 1) {
              throw CONSTANTS.createError(
                400,
                "Please add unique product to collection"
              );
            }
          }
        } else {
          throw CONSTANTS.createError(
            400,
            "Please add some product to collection"
          );
        }
      }

      if (ctx.args.data.collection_type === AUTOMATED_COLLECTION) {
        // Check category not passed multiple time
        // Check Category actually exist in system
        // Same for Subcategory + Variation
      }

      ctx.args.data.createdby = ctx.req.accessToken.userId;
      ctx.args.data.modifiedby = ctx.req.accessToken.userId;
      ctx.args.data.userId = ctx.req.accessToken.userId;

      if (ctx.args.data.collection_condition_config) {
        ctx.args.data.collection_condition_config = JSON.stringify(
          ctx.args.data.collection_condition_config
        );
      }
    } catch (error) {
      throw error;
    }
  });

  Collection.afterRemote("create", async (ctx, modelInstance, next) => {
    var PRODUCT_MODEL = app.models.product;
    var CATEGORY_MODEL = app.models.category;
    var COLLECTION_DETAILS_MODEL = app.models.collectiondetail;

    var isVariationCriteriaInCollection = false;

    var variationConfigList = [];
    var variationList = [];
    var getSubCriteria = {};
    var getSubCondition = {};

    var CONDITION_ARRAY = [];
    var getAutomatedCollectionProducts = [];
    var getCollectionCriteriaSettingArray = [];
    var getCollectionConditionSettingArray = [];

    try {
      if (ctx.args.data.collection_condition_config) {
        ctx.args.data.collection_condition_config = JSON.parse(
          ctx.args.data.collection_condition_config
        );
      }

      // When Manual Collection
      if (ctx.args.data.collection_type === MANUAL_COLLECTION) {
        if (ctx.args.data.collection_filters.products.length > 0) {
          ctx.args.data.collection_filters.products.filter(async (item) => {
            await COLLECTION_DETAILS_MODEL.create({
              collectionId: modelInstance.id,
              productId: item.id,
              masterdetailId: ctx.req.query.where.masterdetailId,
            });
          });
        }
        // Update Collection No Of Products
        await Collection.updateAll(
          {
            id: ctx.result.id,
            masterdetailId: ctx.req.query.where.masterdetailId,
          },
          {
            collection_noofproducts:
              ctx.args.data.collection_filters.products.length,
          }
        );
      }

      // When Automated Collection
      if (ctx.args.data.collection_type === AUTOMATED_COLLECTION) {
        // find collection condtion
        getCollectionConditionSettingArray = await getCollectionSetting({
          registerallow: SETTING_CONSTANTS.COLLECTION,
          label: SETTING_CONSTANTS.COLLECTION_CONDITION,
        });
        getCollectionConditionSettingArray =
          getCollectionConditionSettingArray.value;

        // find collection criteria
        getCollectionCriteriaSettingArray = await getCollectionSetting({
          registerallow: SETTING_CONSTANTS.COLLECTION,
          label: SETTING_CONSTANTS.COLLECTION_CRITERIA,
        });
        getCollectionCriteriaSettingArray =
          getCollectionCriteriaSettingArray.value;

        if (
          ctx.args.data.collection_condition_config &&
          ctx.args.data.collection_condition_config.length > 0
        ) {
          for (
            let i = 0;
            i < ctx.args.data.collection_condition_config.length;
            i++
          ) {
            const element = ctx.args.data.collection_condition_config[i];
            getSubCondition = getCollectionConditionSettingArray.find(
              (obj) => obj.id === element.condtion_id
            );
            getSubCriteria = getCollectionCriteriaSettingArray.find(
              (obj) => obj.id === element.condition_criteria_id
            );

            if (getSubCriteria && getSubCriteria.id === 5) {
              isVariationCriteriaInCollection = true;
              variationList = [];
              const elemValue = element.condition_value.toLowerCase();
              variationList.push(elemValue);
              variationConfigList.push({
                condition: getSubCondition,
                value: variationList,
              });
              continue;
            }

            if (getSubCondition && getSubCriteria && element.condition_value) {
              const getObjectKey = Object.values(getSubCriteria)[2];

              // is_equal_to
              if (getSubCondition.id === 1) {
                if (getSubCriteria.id === 2) {
                  // Category
                  // Get Subcategories which belong to categoryList Array
                  var subcategoryList = [];
                  var getSubcategories = await CATEGORY_MODEL.find({
                    where: {
                      parentId: element.condition_value,
                      masterdetailId: ctx.req.query.where.masterdetailId,
                    },
                  });
                  if (getSubcategories && getSubcategories.length > 0) {
                    getSubcategories.filter((item) =>
                      subcategoryList.push(item.id)
                    );
                  }
                  if (subcategoryList.length > 0) {
                    CONDITION_ARRAY.push({
                      [getObjectKey]: {
                        inq: subcategoryList,
                      },
                    });
                  }
                }

                if (getSubCriteria.id === 3) {
                  // SubCategory
                  CONDITION_ARRAY.push({
                    [getObjectKey]: element.condition_value,
                  });
                }

                if (getSubCriteria.id === 4 || getSubCriteria.id === 1) {
                  // Price + Name
                  CONDITION_ARRAY.push(
                    JSON.stringify({
                      [getObjectKey]: element.condition_value,
                    })
                  );
                }

                continue;
              }

              // is_not_equal_to
              if (getSubCondition.id === 2) {
                if (
                  getSubCriteria.id === 4 ||
                  getSubCriteria.id === 1 ||
                  getSubCriteria.id === 3
                ) {
                  // Price + Name + Subcategory
                  CONDITION_ARRAY.push(
                    JSON.stringify({
                      [getObjectKey]: {
                        neq: element.condition_value,
                      },
                    })
                  );
                }

                if (getSubCriteria.id === 2) {
                  // Category
                  var getAllSubcategoryList = [];
                  var getRequestedSubcategoriesOfCategoryList = [];

                  var getAllSubcategories = await CATEGORY_MODEL.find({
                    where: {
                      parentId: {
                        neq: null,
                      },
                      masterdetailId: ctx.req.query.where.masterdetailId,
                    },
                  });

                  if (getAllSubcategories && getAllSubcategories.length > 0) {
                    getAllSubcategories.filter((item) =>
                      getAllSubcategoryList.push(item.id)
                    );
                  }

                  var getRequestedSubcategoriesOfCategory =
                    await CATEGORY_MODEL.find({
                      where: {
                        parentId: element.condition_value,
                        masterdetailId: ctx.req.query.where.masterdetailId,
                      },
                    });

                  if (
                    getRequestedSubcategoriesOfCategory &&
                    getRequestedSubcategoriesOfCategory.length > 0
                  ) {
                    getRequestedSubcategoriesOfCategory.filter((item) =>
                      getRequestedSubcategoriesOfCategoryList.push(item.id)
                    );
                  }

                  if (getRequestedSubcategoriesOfCategoryList.length > 0) {
                    getRequestedSubcategoriesOfCategoryList.filter((item) => {
                      const index = getAllSubcategoryList.indexOf(item);
                      if (index > -1) {
                        getAllSubcategoryList.splice(index, 1);
                      }
                    });
                  }

                  if (getAllSubcategoryList.length > 0) {
                    CONDITION_ARRAY.push({
                      [getObjectKey]: {
                        inq: getAllSubcategoryList,
                      },
                    });
                  }
                }

                continue;
              }

              // is_greatet_than
              if (getSubCondition.id === 3) {
                CONDITION_ARRAY.push(
                  JSON.stringify({
                    [getObjectKey]: {
                      gt: element.condition_value,
                    },
                  })
                );
                continue;
              }

              // is_less_than
              if (getSubCondition.id === 4) {
                CONDITION_ARRAY.push(
                  JSON.stringify({
                    [getObjectKey]: {
                      lt: element.condition_value,
                    },
                  })
                );
                continue;
              }

              // TODO ends_with
              if (getSubCondition.id === 5) {
                CONDITION_ARRAY.push({
                  [getObjectKey]: {
                    like: "%" + element.condition_value, // Need to pass in body i.e. '%abc'
                  },
                });
                continue;
              }

              // TODO contains
              if (getSubCondition.id === 6) {
                if (getSubCriteria.id === 2) {
                  // Category
                  // Get Subcategories which belong to categoryList Array
                  var subcategoryList = [];
                  for (let j = 0; j < element.condition_value.length; j++) {
                    const categoryElement = element.condition_value[j];
                    var getSubcategories = await CATEGORY_MODEL.find({
                      where: {
                        parentId: categoryElement.id,
                        masterdetailId: ctx.req.query.where.masterdetailId,
                      },
                    });
                    if (getSubcategories && getSubcategories.length > 0) {
                      getSubcategories.filter((item) =>
                        subcategoryList.push(item.id)
                      );
                    }
                  }
                  if (subcategoryList.length > 0) {
                    CONDITION_ARRAY.push({
                      [getObjectKey]: {
                        inq: subcategoryList,
                      },
                    });
                  }
                }

                if (getSubCriteria.id === 3) {
                  // SubCategory
                  // Get Subcategories which belong to subCategoryList Array
                  var subcategoryList = [];
                  if (element.condition_value.length > 0) {
                    for (let j = 0; j < element.condition_value.length; j++) {
                      const subcategoryElement = element.condition_value[j];
                      subcategoryList.push(subcategoryElement.id);
                    }
                  }
                  if (subcategoryList.length > 0) {
                    CONDITION_ARRAY.push({
                      [getObjectKey]: {
                        inq: subcategoryList,
                      },
                    });
                  }
                }

                if (getSubCriteria.id === 1 || getSubCriteria.id === 4) {
                  CONDITION_ARRAY.push({
                    [getObjectKey]: {
                      like: "%" + element.condition_value + "%",
                    },
                  });
                }

                continue;
              }

              // TODO does_not_contain
              if (getSubCondition.id === 7) {
                if (getSubCriteria.id === 2) {
                  // Category
                  var getAllSubcategoryList = [];
                  var getRequestedSubcategoriesOfCategoryList = [];

                  var getAllSubcategories = await CATEGORY_MODEL.find({
                    where: {
                      parentId: {
                        neq: null,
                      },
                      masterdetailId: ctx.req.query.where.masterdetailId,
                    },
                  });

                  if (getAllSubcategories && getAllSubcategories.length > 0) {
                    getAllSubcategories.filter((item) =>
                      getAllSubcategoryList.push(item.id)
                    );
                  }

                  for (let j = 0; j < element.condition_value.length; j++) {
                    const categoryElement = element.condition_value[j];
                    var getRequestedSubcategoriesOfCategory =
                      await CATEGORY_MODEL.find({
                        where: {
                          parentId: categoryElement.id,
                          masterdetailId: ctx.req.query.where.masterdetailId,
                        },
                      });
                    if (
                      getRequestedSubcategoriesOfCategory &&
                      getRequestedSubcategoriesOfCategory.length > 0
                    ) {
                      getRequestedSubcategoriesOfCategory.filter((item) =>
                        getRequestedSubcategoriesOfCategoryList.push(item.id)
                      );
                    }
                  }

                  if (getRequestedSubcategoriesOfCategoryList.length > 0) {
                    getRequestedSubcategoriesOfCategoryList.filter((item) => {
                      const index = getAllSubcategoryList.indexOf(item);
                      if (index > -1) {
                        getAllSubcategoryList.splice(index, 1);
                      }
                    });
                  }

                  if (getAllSubcategoryList.length > 0) {
                    CONDITION_ARRAY.push({
                      [getObjectKey]: {
                        inq: getAllSubcategoryList,
                      },
                    });
                  }
                }

                if (getSubCriteria.id === 3) {
                  // SubCategory
                  var getAllSubcategoryList = [];
                  var getRequestedSubcategoriesOfCategoryList = [];

                  var getAllSubcategories = await CATEGORY_MODEL.find({
                    where: {
                      parentId: {
                        neq: null,
                      },
                      masterdetailId: ctx.req.query.where.masterdetailId,
                    },
                  });

                  if (getAllSubcategories && getAllSubcategories.length > 0) {
                    getAllSubcategories.filter((item) =>
                      getAllSubcategoryList.push(item.id)
                    );
                  }

                  for (let j = 0; j < element.condition_value.length; j++) {
                    const categoryElement = element.condition_value[j];
                    getRequestedSubcategoriesOfCategoryList.push(
                      categoryElement.id
                    );
                  }

                  if (getRequestedSubcategoriesOfCategoryList.length > 0) {
                    getRequestedSubcategoriesOfCategoryList.filter((item) => {
                      const index = getAllSubcategoryList.indexOf(item);
                      if (index > -1) {
                        getAllSubcategoryList.splice(index, 1);
                      }
                    });
                  }

                  if (getAllSubcategoryList.length > 0) {
                    CONDITION_ARRAY.push({
                      [getObjectKey]: {
                        inq: getAllSubcategoryList,
                      },
                    });
                  }
                }

                if (getSubCriteria.id === 1 || getSubCriteria.id === 4) {
                  CONDITION_ARRAY.push({
                    [getObjectKey]: {
                      like: "%" + element.condition_value + "%",
                    },
                  });
                }

                continue;
              }
            }
          }

          // Manage Variation Config Here
          // variationConfigList.push({
          //   condition: getSubCondition,
          //   value: variationList
          // });

          var copyOfConditionArray = [];

          if (CONDITION_ARRAY && CONDITION_ARRAY.length > 0) {
            for (let i = 0; i < CONDITION_ARRAY.length; i++) {
              var item = CONDITION_ARRAY[i];
              if (typeof item === "string") {
                item = JSON.parse(item);
              }
              copyOfConditionArray.push(item);
            }
          }

          // For OR condition
          if (
            ctx.args.data.collection_condition_type ===
            OR_COLLECTION_MAIN_CONDITION
          ) {
            getAutomatedCollectionProducts = await PRODUCT_MODEL.find({
              where: {
                and: [
                  {
                    or: copyOfConditionArray,
                  },
                  {
                    masterdetailId: ctx.req.query.where.masterdetailId,
                  },
                  {
                    productstatus: 1,
                  },
                ],
              },
            });

            var getAllProducts = [];
            getAllProducts = await PRODUCT_MODEL.find({
              where: {
                masterdetailId: ctx.req.query.where.masterdetailId,
              },
            });

            if (isVariationCriteriaInCollection) {
              // When AND Condition filter product which have particular variation
              var filterProductWithVariationCondition = [];

              if (variationConfigList.length > 0) {
                var isEqualConditionArray = [];
                var isNotEqualConditionArray = [];

                if (variationConfigList.length > 0) {
                  if (variationConfigList.length) {
                    // variationConfigList = variationConfigList.sort((a, b) => {
                    //   return a.condition.id - b.condition.id;
                    // });

                    variationConfigList.filter((item) =>
                      item.condition.id === 1
                        ? isEqualConditionArray.push(item)
                        : isNotEqualConditionArray.push(item)
                    );
                  }

                  if (isEqualConditionArray.length > 0) {
                    for (let m = 0; m < isEqualConditionArray.length; m++) {
                      const variationConfigListElement =
                        isEqualConditionArray[m];

                      for (
                        let j = 0;
                        j < getAutomatedCollectionProducts.length;
                        j++
                      ) {
                        const item = getAutomatedCollectionProducts[j];
                        const itemVariation = JSON.parse(item.variationconfig);
                        var itemProductVariation = [];

                        if (itemVariation && itemVariation.length > 0) {
                          for (let k = 0; k < itemVariation.length; k++) {
                            const subItem = itemVariation[k];
                            if (Object.entries(subItem).length > 2) {
                              var getParticularVariationArray =
                                Object.values(subItem)[2];
                              if (getParticularVariationArray.length > 0) {
                                getParticularVariationArray =
                                  getParticularVariationArray.find((obj) => {
                                    var elemValue = obj.itemname.toLowerCase();
                                    itemProductVariation.push(elemValue);
                                  });
                              }
                            }
                          }
                        }

                        if (
                          itemProductVariation.length > 0 &&
                          variationConfigListElement
                        ) {
                          var isContainSameVariation = 0;

                          for (
                            let n = 0;
                            n < variationConfigListElement.value.length;
                            n++
                          ) {
                            const checkContainElement =
                              variationConfigListElement.value[n];
                            const elemValue = checkContainElement.toLowerCase();
                            const getResult =
                              itemProductVariation.includes(elemValue);
                            if (getResult) {
                              isContainSameVariation++;
                            }
                          }

                          if (variationConfigListElement.condition.id === 1) {
                            // Is Equal To
                            if (
                              variationConfigListElement.value.length ===
                              isContainSameVariation
                            ) {
                              filterProductWithVariationCondition.push(item);
                            }
                          }

                          if (variationConfigListElement.condition.id === 2) {
                            // // Is Not Equal To
                            if (
                              variationConfigListElement.value.length !==
                              isContainSameVariation
                            ) {
                              filterProductWithVariationCondition.push(item);
                            }
                          }
                        }
                      }
                    }

                    getAutomatedCollectionProducts = [
                      ...new Map(
                        filterProductWithVariationCondition.map((item) => [
                          item["id"],
                          item,
                        ])
                      ).values(),
                    ];
                  }

                  if (isNotEqualConditionArray.length > 0) {
                    for (let m = 0; m < isNotEqualConditionArray.length; m++) {
                      const variationConfigListElement =
                        isNotEqualConditionArray[m];

                      for (
                        let j = 0;
                        j < getAutomatedCollectionProducts.length;
                        j++
                      ) {
                        const item = getAutomatedCollectionProducts[j];
                        const itemVariation = JSON.parse(item.variationconfig);
                        var itemProductVariation = [];

                        if (itemVariation && itemVariation.length > 0) {
                          for (let k = 0; k < itemVariation.length; k++) {
                            const subItem = itemVariation[k];
                            if (Object.entries(subItem).length > 2) {
                              var getParticularVariationArray =
                                Object.values(subItem)[2];
                              if (getParticularVariationArray.length > 0) {
                                getParticularVariationArray =
                                  getParticularVariationArray.find((obj) => {
                                    var elemValue = obj.itemname.toLowerCase();
                                    itemProductVariation.push(elemValue);
                                  });
                              }
                            }
                          }
                        }

                        if (
                          itemProductVariation.length > 0 &&
                          variationConfigListElement
                        ) {
                          var isContainSameVariation = 0;

                          for (
                            let n = 0;
                            n < variationConfigListElement.value.length;
                            n++
                          ) {
                            const checkContainElement =
                              variationConfigListElement.value[n];
                            const elemValue = checkContainElement.toLowerCase();
                            const getResult =
                              itemProductVariation.includes(elemValue);
                            if (getResult) {
                              isContainSameVariation++;
                            }
                          }

                          if (variationConfigListElement.condition.id === 1) {
                            // Is Equal To
                            if (
                              variationConfigListElement.value.length ===
                              isContainSameVariation
                            ) {
                              filterProductWithVariationCondition.push(item);
                            }
                          }

                          if (variationConfigListElement.condition.id === 2) {
                            // // Is Not Equal To
                            if (
                              variationConfigListElement.value.length !==
                              isContainSameVariation
                            ) {
                              filterProductWithVariationCondition.push(item);
                            }
                          }
                        }
                      }
                    }

                    getAutomatedCollectionProducts = [
                      ...new Map(
                        filterProductWithVariationCondition.map((item) => [
                          item["id"],
                          item,
                        ])
                      ).values(),
                    ];
                  }
                }
              }

              const mergeArray = getAutomatedCollectionProducts.concat(
                filterProductWithVariationCondition
              );
              const distinct = [...new Set(mergeArray.map((item) => item.id))];
              getAutomatedCollectionProducts = distinct;
              var attachProductData = [];
              if (
                getAutomatedCollectionProducts &&
                getAutomatedCollectionProducts.length > 0
              ) {
                for (
                  let index = 0;
                  index < getAutomatedCollectionProducts.length;
                  index++
                ) {
                  const item = getAutomatedCollectionProducts[index];
                  const getSingleProduct = await PRODUCT_MODEL.findOne({
                    where: {
                      id: item,
                    },
                  });
                  attachProductData.push(getSingleProduct);
                }
              }
              getAutomatedCollectionProducts = attachProductData;
            }
          }

          // For AND condition
          if (
            ctx.args.data.collection_condition_type ===
            AND_COLLECTION_MAIN_CONDITION
          ) {
            copyOfConditionArray.push(
              {
                masterdetailId: ctx.req.query.where.masterdetailId,
              },
              {
                productstatus: 1,
              }
            );
            getAutomatedCollectionProducts = await PRODUCT_MODEL.find({
              where: {
                and: copyOfConditionArray,
              },
            });

            if (isVariationCriteriaInCollection) {
              // When AND Condition filter product which have particular variation
              var filterProductWithVariationCondition = [];

              // if (variationConfigList.length) {
              //   variationConfigList.filter(item => {
              //     console.log(item);
              //   });
              // }

              if (variationConfigList.length > 0) {
                var isEqualConditionArray = [];
                var isNotEqualConditionArray = [];

                if (variationConfigList.length > 0) {
                  if (variationConfigList.length) {
                    // variationConfigList = variationConfigList.sort((a, b) => {
                    //   return a.condition.id - b.condition.id;
                    // });

                    variationConfigList.filter((item) =>
                      item.condition.id === 1
                        ? isEqualConditionArray.push(item)
                        : isNotEqualConditionArray.push(item)
                    );
                  }

                  if (isEqualConditionArray.length > 0) {
                    for (let m = 0; m < isEqualConditionArray.length; m++) {
                      const variationConfigListElement =
                        isEqualConditionArray[m];

                      for (
                        let j = 0;
                        j < getAutomatedCollectionProducts.length;
                        j++
                      ) {
                        const item = getAutomatedCollectionProducts[j];
                        const itemVariation = JSON.parse(item.variationconfig);
                        var itemProductVariation = [];

                        if (itemVariation && itemVariation.length > 0) {
                          for (let k = 0; k < itemVariation.length; k++) {
                            const subItem = itemVariation[k];
                            if (Object.entries(subItem).length > 2) {
                              var getParticularVariationArray =
                                Object.values(subItem)[2];
                              if (getParticularVariationArray.length > 0) {
                                getParticularVariationArray =
                                  getParticularVariationArray.find((obj) => {
                                    var elemValue = obj.itemname.toLowerCase();
                                    itemProductVariation.push(elemValue);
                                  });
                              }
                            }
                          }
                        }

                        if (
                          itemProductVariation.length > 0 &&
                          variationConfigListElement
                        ) {
                          var isContainSameVariation = 0;

                          for (
                            let n = 0;
                            n < variationConfigListElement.value.length;
                            n++
                          ) {
                            const checkContainElement =
                              variationConfigListElement.value[n];
                            const elemValue = checkContainElement.toLowerCase();
                            const getResult =
                              itemProductVariation.includes(elemValue);
                            if (getResult) {
                              isContainSameVariation++;
                            }
                          }

                          if (variationConfigListElement.condition.id === 1) {
                            // Is Equal To
                            if (
                              variationConfigListElement.value.length ===
                              isContainSameVariation
                            ) {
                              filterProductWithVariationCondition.push(item);
                            }
                          }

                          if (variationConfigListElement.condition.id === 2) {
                            // // Is Not Equal To
                            if (
                              variationConfigListElement.value.length !==
                              isContainSameVariation
                            ) {
                              filterProductWithVariationCondition.push(item);
                            }
                          }
                        }
                      }
                    }

                    getAutomatedCollectionProducts = [
                      ...new Map(
                        filterProductWithVariationCondition.map((item) => [
                          item["id"],
                          item,
                        ])
                      ).values(),
                    ];
                  }

                  if (isNotEqualConditionArray.length > 0) {
                    for (let m = 0; m < isNotEqualConditionArray.length; m++) {
                      const variationConfigListElement =
                        isNotEqualConditionArray[m];

                      for (
                        let j = 0;
                        j < getAutomatedCollectionProducts.length;
                        j++
                      ) {
                        const item = getAutomatedCollectionProducts[j];
                        const itemVariation = JSON.parse(item.variationconfig);
                        var itemProductVariation = [];

                        if (itemVariation && itemVariation.length > 0) {
                          for (let k = 0; k < itemVariation.length; k++) {
                            const subItem = itemVariation[k];
                            if (Object.entries(subItem).length > 2) {
                              var getParticularVariationArray =
                                Object.values(subItem)[2];
                              if (getParticularVariationArray.length > 0) {
                                getParticularVariationArray =
                                  getParticularVariationArray.find((obj) => {
                                    var elemValue = obj.itemname.toLowerCase();
                                    itemProductVariation.push(elemValue);
                                  });
                              }
                            }
                          }
                        }

                        if (
                          itemProductVariation.length > 0 &&
                          variationConfigListElement
                        ) {
                          var isContainSameVariation = 0;

                          for (
                            let n = 0;
                            n < variationConfigListElement.value.length;
                            n++
                          ) {
                            const checkContainElement =
                              variationConfigListElement.value[n];
                            const elemValue = checkContainElement.toLowerCase();
                            const getResult =
                              itemProductVariation.includes(elemValue);
                            if (getResult) {
                              isContainSameVariation++;
                            }
                          }

                          if (variationConfigListElement.condition.id === 1) {
                            // Is Equal To
                            if (
                              variationConfigListElement.value.length ===
                              isContainSameVariation
                            ) {
                              filterProductWithVariationCondition.push(item);
                            }
                          }

                          if (variationConfigListElement.condition.id === 2) {
                            // // Is Not Equal To
                            if (
                              variationConfigListElement.value.length !==
                              isContainSameVariation
                            ) {
                              filterProductWithVariationCondition.push(item);
                            }
                          }
                        }
                      }
                    }

                    getAutomatedCollectionProducts = [
                      ...new Map(
                        filterProductWithVariationCondition.map((item) => [
                          item["id"],
                          item,
                        ])
                      ).values(),
                    ];
                  }
                }
              }

              const mergeArray = getAutomatedCollectionProducts.concat(
                filterProductWithVariationCondition
              );
              const distinct = [...new Set(mergeArray.map((item) => item.id))];
              getAutomatedCollectionProducts = distinct;
              var attachProductData = [];
              if (
                getAutomatedCollectionProducts &&
                getAutomatedCollectionProducts.length > 0
              ) {
                for (
                  let index = 0;
                  index < getAutomatedCollectionProducts.length;
                  index++
                ) {
                  const item = getAutomatedCollectionProducts[index];
                  const getSingleProduct = await PRODUCT_MODEL.findOne({
                    where: {
                      id: item,
                    },
                  });
                  attachProductData.push(getSingleProduct);
                }
              }
              getAutomatedCollectionProducts = attachProductData;
            }
          }

          //Compare New Found Data(using Query) with Exist Data and Add the New Records which not exist in collection
          if (
            getCurrenctCollectionDetails &&
            getAutomatedCollectionProducts &&
            getAutomatedCollectionProducts.length > 0
          ) {
            var newDiffrentProducts = [];

            for (
              let index = 0;
              index < getAutomatedCollectionProducts.length;
              index++
            ) {
              const element = getAutomatedCollectionProducts[index];

              var isProductExist = getCurrenctCollectionDetails.find(
                (obj) => obj.productId === element.id
              );
              if (!isProductExist) {
                newDiffrentProducts.push(element);
              }
            }

            if (newDiffrentProducts && newDiffrentProducts.length > 0) {
              for (let i = 0; i < newDiffrentProducts.length; i++) {
                const element = newDiffrentProducts[i];

                // Add the Records
                await COLLECTION_DETAILS_MODEL.create({
                  collectionId: ctx.req.params.id,
                  productId: element.id,
                  masterdetailId: ctx.req.query.where.masterdetailId,
                });
              }
            }
          }

          //Compare Exist Data with New Found Data(using Query) and Remove the Records from collection which not exist in New Data
          if (
            getAutomatedCollectionProducts &&
            getCurrenctCollectionDetails &&
            getCurrenctCollectionDetails.length > 0
          ) {
            var deleteProducts = [];

            for (
              let index = 0;
              index < getCurrenctCollectionDetails.length;
              index++
            ) {
              const element = getCurrenctCollectionDetails[index];

              var isProductExist = getAutomatedCollectionProducts.find(
                (obj) => obj.id === element.productId
              );
              if (!isProductExist) {
                deleteProducts.push(element);
              }
            }

            if (deleteProducts && deleteProducts.length > 0) {
              for (let i = 0; i < deleteProducts.length; i++) {
                const element = deleteProducts[i];

                // delete the records
                await COLLECTION_DETAILS_MODEL.updateAll(
                  {
                    collectionId: ctx.req.params.id,
                    id: element.id,
                    masterdetailId: ctx.req.query.where.masterdetailId,
                  },
                  {
                    deletedAt: new Date(),
                  }
                );
              }
            }
          }

          // Update Collection No Of Products
          await Collection.updateAll(
            {
              id: ctx.req.params.id,
              masterdetailId: ctx.req.query.where.masterdetailId,
            },
            {
              collection_noofproducts: getAutomatedCollectionProducts.length,
            }
          );
        }

        // }
      }
    } catch (error) {
      throw error;
    }
  });

  Collection.beforeRemote("findById", async (ctx, modelInstance, next) => {
    // When Collection Id Not Exist
    var isCollectionExist = await Collection.findOne({
      where: {
        id: ctx.args.id,
      },
    });

    if (!isCollectionExist) {
      throw CONSTANTS.createError(404, "Collection not found");
    }

    // Change %20 into Space
    if (
      ctx &&
      ctx.req &&
      ctx.req.query &&
      ctx.req.query.filter &&
      ctx.req.query.filter.where
    ) {
      if (
        ctx.req.query.filter.where.getTinyURL &&
        typeof ctx.req.query.filter.where.getTinyURL === "string"
      ) {
        ctx.req.query.filter.where.getTinyURL === "false"
          ? (ctx.req.query.filter.where.getTinyURL = false)
          : (ctx.req.query.filter.where.getTinyURL = true);
      }
      if (
        ctx.req.query.filter.where.manageCollectionConditionConfig &&
        typeof ctx.req.query.filter.where.manageCollectionConditionConfig ===
          "string"
      ) {
        ctx.req.query.filter.where.manageCollectionConditionConfig === "false"
          ? (ctx.req.query.filter.where.manageCollectionConditionConfig = false)
          : (ctx.req.query.filter.where.manageCollectionConditionConfig = true);
      }
      if (
        ctx.req.query.filter.where.name &&
        ctx.req.query.filter.where.name.like
      ) {
        ctx.req.query.filter.where.name.like =
          ctx.req.query.filter.where.name.like.split("%20").join(" ");
        ctx.req.query.filter.where.name.like =
          ctx.req.query.filter.where.name.like.toLowerCase();
      }
    }
  });

  Collection.afterRemote("findById", async (ctx, modelInstance, next) => {
    var resultOfCollection = [];
    var collectionProducts = [];
    var getOrderProductArray = [];
    var getCollectionDetails = [];
    var setPaginitionIntoResponseArray = [];

    var getOrderOfUser;
    var getorderDetailsOfUser;

    var USER_MODEL = app.models.user;
    var ORDER_MODEL = app.models.order;
    var GROUP_MODEL = app.models.group;
    var PRODUCT_MODEL = app.models.product;
    var CATEGORY_MODEL = app.models.category;
    var GROUP_PRICE_MODEL = app.models.groupprice;
    var MASTERDETAIL_MODEL = app.models.masterdetail;
    var PRODUCTMEDIA_MODEL = app.models.productmedia;
    var ORDER_DETAILS_MODEL = app.models.orderdetails;
    var GROUP_CATEGORY_MODEL = app.models.groupcategory;
    var COLLECTION_DETAILS_MODEL = app.models.collectiondetail;

    try {
      getCollectionDetails = await COLLECTION_DETAILS_MODEL.find({
        where: {
          collectionId: modelInstance.id,
        },
      });

      // find user details
      var userDetails = await USER_MODEL.findById(ctx.req.accessToken.userId);

      if (
        userDetails.roleId !== SETTING_CONSTANTS.ADMIN_ROLEID &&
        userDetails.groupId
      ) {
        // Create copy of Collection Details
        const copyOfGetCollectionDetails = [...getCollectionDetails];

        // Get Product From Collection & Attach Productmedia + Attach Category
        // for (const key in copyOfGetCollectionDetails) {
        //   if (Object.hasOwnProperty.call(copyOfGetCollectionDetails, key)) {
        //     const element = copyOfGetCollectionDetails[key];
        //     var productData = await PRODUCT_MODEL.findOne({
        //       where: {
        //         id: element.productId
        //       },
        //       include: ['productmedia', 'category']
        //     });
        //     collectionProducts.push(productData);
        //   }
        // }

        for (let i = 0; i < copyOfGetCollectionDetails.length; i++) {
          const element = copyOfGetCollectionDetails[i];
          var getSingleProduct = await PRODUCT_MODEL.findOne({
            where: {
              id: element.productId,
            },
            include: ["productmedia", "category"],
          });
          collectionProducts.push(getSingleProduct);
        }

        // Get Requested User group
        var groupDetail = await GROUP_MODEL.findById(userDetails.groupId);

        if (
          ctx &&
          ctx.req &&
          ctx.req.query &&
          ctx.req.query.filter &&
          ctx.req.query.filter.where &&
          ctx.req.query.filter.where
        ) {
          // Search Product
          if (
            ctx.req.query.filter.where.name &&
            ctx.req.query.filter.where.name.like
          ) {
            var filteredArray = collectionProducts.filter((item) =>
              item.name
                .toLowerCase()
                .includes(ctx.req.query.filter.where.name.like)
            );
            collectionProducts = filteredArray;
          }

          // Category
          if (ctx.req.query.filter.where.maincategory) {
            var filteredArray = [];
            for (let i = 0; i < collectionProducts.length; i++) {
              const element = collectionProducts[i];
              var getSubcategoryDetailsOfProduct = await CATEGORY_MODEL.findOne(
                {
                  where: {
                    id: element.categoryId,
                  },
                }
              );
              if (
                getSubcategoryDetailsOfProduct.parentId ===
                ctx.req.query.filter.where.maincategory
              ) {
                filteredArray.push(element);
              }
            }
            collectionProducts = filteredArray;
          }

          // Sub Category
          if (ctx.req.query.filter.where.categoryId) {
            var filteredArray = collectionProducts.filter(
              (item) =>
                item.categoryId === ctx.req.query.filter.where.categoryId
            );
            collectionProducts = filteredArray;
          }
        }

        resultOfCollection = collectionProducts;

        // Attach Counter of Particular Product in Cart
        getOrderOfUser = await ORDER_MODEL.findOne({
          where: {
            inshoppingcart: SETTING_CONSTANTS.ORDER_CART,
            userId: userDetails.id,
          },
        });

        if (getOrderOfUser) {
          getorderDetailsOfUser = await ORDER_DETAILS_MODEL.find({
            where: {
              orderId: getOrderOfUser.id,
            },
          });
          if (getorderDetailsOfUser && getorderDetailsOfUser.length > 0) {
            getorderDetailsOfUser.filter((item) =>
              getOrderProductArray.push(item.productId)
            );
          }
        }

        // Create copy of Collection Details
        var copyOfResultOfCollection = [...resultOfCollection];

        if (copyOfResultOfCollection && copyOfResultOfCollection.length > 0) {
          var getInquirySetting = await getSetting({
            registerallow: SETTING_CONSTANTS.IS_INQUIRY,
            masterdetailId: ctx.req.query.where.masterdetailId,
          });

          for (let i = 0; i < copyOfResultOfCollection.length; i++) {
            const element = copyOfResultOfCollection[i];

            // If Inquiry Mode is enable set pricemode false
            getInquirySetting.status === 0
              ? (element.pricemode = true)
              : (element.pricemode = false);
            element.inInquiry
              ? (element.inInquiry = true)
              : (element.inInquiry = false);

            // find newprice is availabe or not
            var groupprice = await GROUP_PRICE_MODEL.findOne({
              where: {
                groupId: userDetails.groupId,
                productId: element.id,
                masterdetailId: ctx.req.query.where.masterdetailId,
              },
            });

            if (groupprice) {
              element.price = groupprice.newprice;
              if (groupprice.minimumorderquantity) {
                element.minimumorderquantity = groupprice.minimumorderquantity;
              } else {
                element.minimumorderquantity = 1;
              }
            } else {
              element.minimumorderquantity = 1;
            }

            // Attach Counter of Particular Product
            if (
              getOrderOfUser &&
              getorderDetailsOfUser &&
              getorderDetailsOfUser.length > 0 &&
              getOrderProductArray.length > 0
            ) {
              if (getOrderProductArray.includes(element.id)) {
                var getProductDetailsFromOrderDetails =
                  await ORDER_DETAILS_MODEL.findOne({
                    where: {
                      orderId: getOrderOfUser.id,
                      productId: element.id,
                    },
                  });
                if (getProductDetailsFromOrderDetails) {
                  element.totalCartCounter =
                    getProductDetailsFromOrderDetails.quantity;
                } else {
                  element.totalCartCounter = 0;
                }
              } else {
                element.totalCartCounter = 0;
              }
            }

            // Attach Next Product Id
            if (i === copyOfResultOfCollection.length - 1) {
              element.nextProductId = copyOfResultOfCollection[0].id;
            } else {
              element.nextProductId = copyOfResultOfCollection[i + 1].id;
            }

            // Attach Previous Product Id
            if (i === 0) {
              element.previousProductId =
                copyOfResultOfCollection[
                  copyOfResultOfCollection.length - 1
                ].id;
            } else {
              element.previousProductId = copyOfResultOfCollection[i - 1].id;
            }
          }
        }

        resultOfCollection = [...copyOfResultOfCollection];

        // Best Selling (Sell Counter Order) + Created (Order) + Price (Order)
        if (
          ctx &&
          ctx.req &&
          ctx.req.query &&
          ctx.req.query.filter &&
          ctx.req.query.filter.order
        ) {
          var getOrderType;
          var getOrderKey = Object.getOwnPropertyNames(
            ctx.req.query.filter.order
          )[0];
          var getOrderValue = Object.values(ctx.req.query.filter.order)[0];

          if (resultOfCollection.length > 0) {
            getOrderType = typeof resultOfCollection[0][getOrderKey];
            if (getOrderValue === "desc" || getOrderValue === "DESC") {
              if (getOrderType === "string") {
                resultOfCollection.sort(
                  (a, b) => a[getOrderKey] < b[getOrderKey]
                );
              }
              if (getOrderType === "number") {
                resultOfCollection.sort(
                  (a, b) => a[getOrderKey] - b[getOrderKey]
                );
              }
              if (getOrderKey === "created") {
                resultOfCollection.sort(
                  (a, b) =>
                    Date.parse(b[getOrderKey]) - Date.parse(a[getOrderKey])
                );
              }
            }
            if (getOrderValue === "asc" || getOrderValue === "ASC") {
              if (getOrderType === "string") {
                resultOfCollection.sort(
                  (a, b) => b[getOrderKey] < a[getOrderKey]
                );
              }
              if (getOrderType === "number") {
                resultOfCollection.sort(
                  (a, b) => b[getOrderKey] - a[getOrderKey]
                );
              }
              if (getOrderKey === "created") {
                resultOfCollection.sort(
                  (a, b) =>
                    Date.parse(a[getOrderKey]) - Date.parse(b[getOrderKey])
                );
              }
            }
          }
        }

        // When Price Filter is in Request, Need to manage With Group Price
        if (
          ctx &&
          ctx.req &&
          ctx.req.query &&
          ctx.req.query.filter &&
          ctx.req.query.filter.order &&
          ctx.req.query.filter.order.price
        ) {
          var getOrderType;
          var getOrderKey = Object.getOwnPropertyNames(
            ctx.req.query.filter.order
          )[0];
          var getOrderValue = Object.values(ctx.req.query.filter.order)[0];

          if (getOrderValue === "asc" || getOrderValue === "ASC") {
            resultOfCollection.sort(
              (a, b) => parseFloat(a[getOrderKey]) - parseFloat(b[getOrderKey])
            );
          }

          if (getOrderValue === "desc" || getOrderValue === "DESC") {
            resultOfCollection.sort(
              (a, b) => parseFloat(b[getOrderKey]) - parseFloat(a[getOrderKey])
            );
          }
        }

        // When Price Max & Min Filter in Request
        if (
          ctx &&
          ctx.req &&
          ctx.req.query &&
          ctx.req.query.filter &&
          ctx.req.query.filter.where
        ) {
          if (
            ctx.req.query.filter.where.maxPrice ||
            ctx.req.query.filter.where.minPrice
          ) {
            if (
              ctx.req.query.filter.where.maxPrice &&
              ctx.req.query.filter.where.minPrice
            ) {
              var filteredArray = resultOfCollection.filter(
                (item) =>
                  item.price >= ctx.req.query.filter.where.minPrice &&
                  item.price <= ctx.req.query.filter.where.maxPrice
              );
              resultOfCollection = filteredArray;
            } else if (ctx.req.query.filter.where.minPrice) {
              var filteredArray = resultOfCollection.filter(
                (item) => item.price >= ctx.req.query.filter.where.minPrice
              );
              resultOfCollection = filteredArray;
            } else if (ctx.req.query.filter.where.maxPrice) {
              var filteredArray = resultOfCollection.filter(
                (item) => item.price <= ctx.req.query.filter.where.maxPrice
              );
              resultOfCollection = filteredArray;
            }
          }
        }

        if (
          ctx.req.query &&
          ctx.req.query.filter &&
          ctx.req.query.filter.limit &&
          (ctx.req.query.filter.skip === 0 || ctx.req.query.filter.skip)
        ) {
          // SKIP + LIMIT
          var limit = parseInt(ctx.req.query.filter.limit);
          var skip = parseInt(ctx.req.query.filter.skip);

          if (
            ctx &&
            ctx.req &&
            ctx.req.query &&
            ctx.req.query.filter &&
            ctx.req.query.filter.limit &&
            (ctx.req.query.filter.skip === 0 || ctx.req.query.filter.skip)
          ) {
            for (let i = 0; i < resultOfCollection.length; i++) {
              if (i >= skip && setPaginitionIntoResponseArray.length < limit) {
                const element = resultOfCollection[i];
                setPaginitionIntoResponseArray.push(element);
              }
            }
          }
        } else {
          setPaginitionIntoResponseArray = resultOfCollection;
        }

        var activeProductCount = 0;
        var deactiveProductCount = 0;

        if (setPaginitionIntoResponseArray.length > 0) {
          setPaginitionIntoResponseArray.filter((item) => {
            if (item.productstatus === 1) {
              activeProductCount += 1;
            } else {
              deactiveProductCount += 1;
            }
          });
        }

        modelInstance.products = setPaginitionIntoResponseArray;
        modelInstance.activeProductCount = activeProductCount;
        modelInstance.deactiveProductCount = deactiveProductCount;
      }

      // Attach collection type value
      modelInstance.collection_type === 1
        ? (modelInstance.collection_type_value = "Manual")
        : (modelInstance.collection_type_value = "Automated");
      // Attach visibility value
      modelInstance.visibility === 1
        ? (modelInstance.visibility_value = "Public")
        : (modelInstance.visibility_value = "Private");
      // Attach status value
      modelInstance.collection_status === 1
        ? (modelInstance.collection_status_value = "Active")
        : (modelInstance.collection_status_value = "Deactive");

      if (
        ctx &&
        ctx.req &&
        ctx.req.query &&
        ctx.req.query.filter &&
        ctx.req.query.filter.where &&
        ctx.req.query.filter.where.getTinyURL
      ) {
        var getInstanceDetails = await MASTERDETAIL_MODEL.findOne({
          where: {
            id: ctx.req.query.where.masterdetailId,
          },
        });

        var getInstanceName = "";

        if (getInstanceDetails) {
          var descriptionData = JSON.parse(getInstanceDetails.description);
          if (descriptionData && descriptionData.length > 0) {
            // Get Wenstore Name
            getInstanceName = descriptionData.find(
              (item) => item.key === "webstoreURL"
            );
          }
        }

        // Attach tiny URL
        if (getInstanceName && getInstanceName.value.trim().length > 0) {
          var generateURL =
            app.get("serverConfig").webstore_url +
            getInstanceName.value +
            "/collection/" +
            modelInstance.id;
          var generatedTinyURL = await new Promise((resolve, reject) => {
            TINYURL.shorten(generateURL, (result, err) => {
              if (err) {
                reject(err);
              } else {
                resolve(result);
              }
            });
          });
          modelInstance.tinyUrl = generatedTinyURL;
        }
      }

      // Manage Collection Condition Config
      if (
        ctx &&
        ctx.req &&
        ctx.req.query &&
        ctx.req.query.filter &&
        ctx.req.query.filter.where &&
        ctx.req.query.filter.where.manageCollectionConditionConfig &&
        modelInstance.collection_type === AUTOMATED_COLLECTION
      ) {
        var getCollectionCriteriaSettingArray = [];
        var getCollectionConditionSettingArray = [];

        // find collection condtion
        getCollectionConditionSettingArray = await getCollectionSetting({
          registerallow: SETTING_CONSTANTS.COLLECTION,
          label: SETTING_CONSTANTS.COLLECTION_CONDITION,
        });
        getCollectionConditionSettingArray =
          getCollectionConditionSettingArray.value;

        // find collection criteria
        getCollectionCriteriaSettingArray = await getCollectionSetting({
          registerallow: SETTING_CONSTANTS.COLLECTION,
          label: SETTING_CONSTANTS.COLLECTION_CRITERIA,
        });
        getCollectionCriteriaSettingArray =
          getCollectionCriteriaSettingArray.value;

        var collectionConditionConfigArray = JSON.parse(
          modelInstance.collection_condition_config
        );
        for (let i = 0; i < collectionConditionConfigArray.length; i++) {
          const element = collectionConditionConfigArray[i];
          var getSubCondition = getCollectionConditionSettingArray.find(
            (obj) => obj.id === element.condtion_id
          );
          var getSubCriteria = getCollectionCriteriaSettingArray.find(
            (obj) => obj.id === element.condition_criteria_id
          );
          if (getSubCriteria) {
            element.condition_criteria_id_value = getSubCriteria.title;
          }
          if (getSubCondition) {
            element.condtion_id_value = getSubCondition.title;
          }
          // Equal To + Not Equal To Condition
          if (getSubCondition.id === 1 || getSubCondition.id === 2) {
            // Category + Subcategory
            if (getSubCriteria.id === 2 || getSubCriteria.id === 3) {
              var getSingleCategoryDetails = await CATEGORY_MODEL.findOne({
                where: {
                  id: element.condition_value,
                  masterdetailId: ctx.req.query.where.masterdetailId,
                },
              });
              element.condition_value = getSingleCategoryDetails.name;
            }
            // // Variation
            // if (getSubCriteria.id === 5) {
            //   var getVariationSetting = await getSetting({
            //     registerallow: SETTING_CONSTANTS.PRODUCT_VARIATION, masterdetailId: ctx.req.query.where.masterdetailId
            //   });
            //   if (getVariationSetting && getVariationSetting.text) {
            //     const getVariations = JSON.parse(getVariationSetting.text);
            //     const getSingleVariation = getVariations.find(item => item.id === element.condition_value);
            //     element.condition_value = getSingleVariation.name;
            //   }
            // }
          }
          // Contains + Does Contains Not Contains Condition
          if (getSubCondition.id === 6 || getSubCondition.id === 7) {
            // Category + Subcategory
            if (getSubCriteria.id === 2) {
              if (
                element.condition_value &&
                element.condition_value.length > 0
              ) {
                var categoryArray = [];
                for (let j = 0; j < element.condition_value.length; j++) {
                  const subElement = element.condition_value[j];
                  var getSingleCategoryDetails = await CATEGORY_MODEL.findOne({
                    where: {
                      id: subElement.id,
                      masterdetailId: ctx.req.query.where.masterdetailId,
                    },
                  });
                  if (getSingleCategoryDetails) {
                    categoryArray.push(getSingleCategoryDetails.name);
                  }
                }
                categoryArray = categoryArray.join(", ");
                element.condition_value = categoryArray;
              }
            }
            // Variation
            if (getSubCriteria.id === 5) {
              if (
                element.condition_value &&
                element.condition_value.length > 0
              ) {
                var variationArray = [];
                var getVariationSetting = await getSetting({
                  registerallow: SETTING_CONSTANTS.PRODUCT_VARIATION,
                  masterdetailId: ctx.req.query.where.masterdetailId,
                });
                if (getVariationSetting && getVariationSetting.text) {
                  const getVariations = JSON.parse(getVariationSetting.text);
                  for (let j = 0; j < element.condition_value.length; j++) {
                    const subElement = element.condition_value[j];
                    const getSingleVariation = getVariations.find(
                      (item) => item.id === subElement.id
                    );
                    if (getSingleVariation) {
                      variationArray.push(getSingleVariation.name);
                    }
                  }
                }
                variationArray = variationArray.join(", ");
                element.condition_value = variationArray;
              }
            }
          }
        }
        modelInstance.collection_condition_config = JSON.stringify(
          collectionConditionConfigArray
        );
      }
    } catch (error) {
      throw error;
    }
  });

  Collection.beforeRemote("find", async (ctx, modelInstance, next) => {
    // Change %20 into Space
    if (
      ctx &&
      ctx.req &&
      ctx.req.query &&
      ctx.req.query.filter &&
      ctx.req.query.filter.where
    ) {
      if (
        ctx.req.query.filter.where.collection_name &&
        ctx.req.query.filter.where.collection_name.like
      ) {
        ctx.req.query.filter.where.collection_name.like =
          ctx.req.query.filter.where.collection_name.like
            .split("%20")
            .join(" ");
        ctx.req.query.filter.where.collection_name.like =
          "%" + ctx.req.query.filter.where.collection_name.like + "%";
      }
    }
  });

  Collection.afterRemote("find", async (ctx, modelInstance, next) => {
    var responseData = {
      data: [],
      length: 0,
    };

    try {
      // Data-table Listing
      var tempQuery = " ";
      var dataQuery;
      var lengthQuery;

      if (
        ctx &&
        ctx.req &&
        ctx.req.query &&
        ctx.req.query.filter &&
        ctx.req.query.filter.where &&
        ctx.req.query.filter.where.and
      ) {
        if (
          ctx.req.query.filter.where.and[0].collection_name &&
          ctx.req.query.filter.where.and[0].collection_name.like
        ) {
          // Collection Name
          tempQuery +=
            " AND collection_name LIKE  '" +
            ctx.req.query.filter.where.and[0].collection_name.like +
            "' ";
        }

        if (
          ctx.req.query.filter.where.and[0].collection_noofproducts &&
          ctx.req.query.filter.where.and[0].collection_noofproducts.like
        ) {
          // No Of Products
          tempQuery +=
            " AND collection_noofproducts LIKE  '" +
            ctx.req.query.filter.where.and[0].collection_noofproducts.like +
            "' ";
        }

        if (ctx.req.query.filter.where.and[0].collection_type === 1) {
          // MANUAL_COLLECTION
          tempQuery += " AND collection_type =  1 ";
        }

        if (ctx.req.query.filter.where.and[0].collection_type === 2) {
          // AUTOMATED_COLLECTION
          tempQuery += " AND collection_type =  2 ";
        }

        if (ctx.req.query.filter.where.and[0].visibility === 1) {
          // PUBLIC_VISIBILITY
          tempQuery += " AND visibility =  1 ";
        }

        if (ctx.req.query.filter.where.and[0].visibility === 2) {
          // PRIVATE_VISIBILITY
          tempQuery += " AND visibility =  2 ";
        }

        if (ctx.req.query.filter.where.and[0].collection_status === 1) {
          // ACTIVE_STATUS
          tempQuery += " AND collection_status =  1 ";
        }

        if (ctx.req.query.filter.where.and[0].collection_status === 2) {
          // DEACTIVE_STATUS
          tempQuery += " AND collection_status =  2 ";
        }

        if (ctx.req.query.isWeb) {
          dataQuery =
            "SELECT * FROM `collection` WHERE deletedAt IS NULL AND masterdetailId = '" +
            ctx.req.query.where.masterdetailId +
            "' " +
            tempQuery +
            " ORDER BY `created` DESC LIMIT " +
            ctx.req.query.filter.skip +
            "," +
            ctx.req.query.filter.limit;
        } else {
          if (
            ctx.req.query.filter.where &&
            ctx.req.query.filter.where.and &&
            ctx.req.query.filter.where.and[0] &&
            ctx.req.query.filter.where.and[0].id
          ) {
            dataQuery =
              "SELECT * FROM `collection` WHERE id = '" +
              ctx.req.query.filter.where.and[0].id +
              "' AND collection_status = 1 AND deletedAt IS NULL AND masterdetailId = '" +
              ctx.req.query.where.masterdetailId +
              "' " +
              tempQuery +
              " ORDER BY `created` DESC LIMIT " +
              ctx.req.query.filter.skip +
              "," +
              ctx.req.query.filter.limit;
          } else {
            dataQuery =
              "SELECT * FROM `collection` WHERE collection_status = 1 AND deletedAt IS NULL AND masterdetailId = '" +
              ctx.req.query.where.masterdetailId +
              "' " +
              tempQuery +
              " ORDER BY `created` DESC LIMIT " +
              ctx.req.query.filter.skip +
              "," +
              ctx.req.query.filter.limit;
          }
        }

        lengthQuery =
          "SELECT COUNT(id) as count FROM `collection` WHERE deletedAt IS NULL AND masterdetailId = '" +
          ctx.req.query.where.masterdetailId +
          "' " +
          tempQuery;
      } else {
        if (
          ctx &&
          ctx.req &&
          ctx.req.query &&
          ctx.req.query.filter &&
          ctx.req.query.filter.limit &&
          (ctx.req.query.filter.skip === 0 || ctx.req.query.filter.skip)
        ) {
          if (ctx.req.query.isWeb) {
            dataQuery =
              "SELECT * FROM `collection` WHERE deletedAt IS NULL AND masterdetailId = '" +
              ctx.req.query.where.masterdetailId +
              "' " +
              " ORDER BY `created` DESC LIMIT " +
              ctx.req.query.filter.skip +
              "," +
              ctx.req.query.filter.limit;
          } else {
            if (
              ctx.req.query.filter.where &&
              ctx.req.query.filter.where.and &&
              ctx.req.query.filter.where.and[0] &&
              ctx.req.query.filter.where.and[0].id
            ) {
              dataQuery =
                "SELECT * FROM `collection` WHERE id = '" +
                ctx.req.query.filter.where.and[0].id +
                "' AND collection_status = 1 AND deletedAt IS NULL AND masterdetailId = '" +
                ctx.req.query.where.masterdetailId +
                "' " +
                " ORDER BY `created` DESC LIMIT " +
                ctx.req.query.filter.skip +
                "," +
                ctx.req.query.filter.limit;
            } else {
              dataQuery =
                "SELECT * FROM `collection` WHERE collection_status = 1 AND deletedAt IS NULL AND masterdetailId = '" +
                ctx.req.query.where.masterdetailId +
                "' " +
                " ORDER BY `created` DESC LIMIT " +
                ctx.req.query.filter.skip +
                "," +
                ctx.req.query.filter.limit;
            }
          }
        } else {
          if (ctx.req.query.isWeb) {
            dataQuery =
              "SELECT * FROM `collection` WHERE deletedAt IS NULL AND masterdetailId = '" +
              ctx.req.query.where.masterdetailId +
              "' ORDER BY `created` DESC ";
          } else {
            if (
              ctx.req &&
              ctx.req.query &&
              ctx.req.query.filter &&
              ctx.req.query.filter.where &&
              ctx.req.query.filter.where.and &&
              ctx.req.query.filter.where.and[0] &&
              ctx.req.query.filter.where.and[0].id
            ) {
              dataQuery =
                "SELECT * FROM `collection` WHERE id = '" +
                ctx.req.query.filter.where.and[0].id +
                "' AND collection_status = 1 AND deletedAt IS NULL AND masterdetailId = '" +
                ctx.req.query.where.masterdetailId +
                "' ORDER BY `created` DESC ";
            } else {
              dataQuery =
                "SELECT * FROM `collection` WHERE collection_status = 1 AND deletedAt IS NULL AND masterdetailId = '" +
                ctx.req.query.where.masterdetailId +
                "' ORDER BY `created` DESC ";
            }
          }
        }

        lengthQuery =
          "SELECT COUNT(id) as count FROM `collection` WHERE deletedAt IS NULL AND masterdetailId = '" +
          ctx.req.query.where.masterdetailId +
          "' ";
      }

      var collectionData = await new Promise((resolve, reject) => {
        app.datasources.mysql.connector.execute(
          dataQuery,
          null,
          (err, result) => {
            if (err) reject(err);
            resolve(result);
          }
        );
      });
      var collectionLength = await new Promise((resolve, reject) => {
        app.datasources.mysql.connector.execute(
          lengthQuery,
          null,
          (err, result) => {
            if (err) reject(err);
            resolve(result);
          }
        );
      });

      if (collectionData.length > 0) {
        collectionData.filter((item) => {
          item.collection_type === 1
            ? (item.collection_type_name = "Manual")
            : (item.collection_type_name = "Automated");
          item.visibility === 1
            ? (item.visibility_name = "Public")
            : (item.visibility_name = "Private");
          item.collection_status === 1
            ? (item.collection_status_name = "Active")
            : (item.collection_status_name = "Deactive");
        });
      }

      responseData.data = collectionData;
      responseData.length = collectionLength[0].count;
      ctx.res.status(200).send(responseData);
      return;
    } catch (error) {
      throw error;
    }
  });

  Collection.afterRemote("deleteById", async (ctx, modelInstance, next) => {
    var COLLECTION_DETAILS_MODEL = app.models.collectiondetail;

    try {
      // Delete Entries from collection details table
      await COLLECTION_DETAILS_MODEL.updateAll(
        {
          collectionId: ctx.req.params.id,
        },
        {
          deletedAt: new Date(),
        }
      );
    } catch (error) {
      throw error;
    }
  });

  Collection.beforeRemote(
    "prototype.patchAttributes",
    async (ctx, modelInstance, next) => {
      try {
        if (ctx.args.data.collection_condition_config) {
          ctx.args.data.collection_condition_config = JSON.stringify(
            ctx.args.data.collection_condition_config
          );
        }

        if (!ctx.args.data.collection_image) {
          ctx.args.data.collection_image = CONSTANTS.DEFAULT_IMAGE_COLLECTION;
        }

        if (ctx.args.data.collection_condition_config) {
          var configCollectionJson = ctx.args.data.collection_condition_config;
          var getCurrenctCollection = await Collection.findOne({
            where: {
              id: ctx.req.params.id,
              masterdetailId: ctx.req.query.where.masterdetailId,
            },
          });
          var currenctConditionConfig =
            getCurrenctCollection.collection_condition_config;
          if (configCollectionJson !== currenctConditionConfig) {
            ctx.args.data.isCollectionConfigNotEqual = true;
          } else {
            ctx.args.data.isCollectionConfigNotEqual = false;
          }
        }
      } catch (error) {
        throw error;
      }
    }
  );

  Collection.afterRemote(
    "prototype.patchAttributes",
    async (ctx, modelInstance, next) => {
      var PRODUCT_MODEL = app.models.product;
      var CATEGORY_MODEL = app.models.category;
      var COLLECTION_DETAILS_MODEL = app.models.collectiondetail;

      var isVariationCriteriaInCollection = false;

      var variationConfigList = [];

      var getSubCriteria = {};
      var getSubCondition = {};

      var variationList = [];
      var CONDITION_ARRAY = [];
      var getCurrenctCollectionDetails = [];
      var getAutomatedCollectionProducts = [];
      var getCollectionCriteriaSettingArray = [];
      var getCollectionConditionSettingArray = [];

      try {
        // When Manual Collection
        if (ctx.args.data.collection_type === MANUAL_COLLECTION) {
          if (ctx.args.data.collection_filters.deleteProductIDs.length > 0) {
            for (
              let i = 0;
              i < ctx.args.data.collection_filters.deleteProductIDs.length;
              i++
            ) {
              var element =
                ctx.args.data.collection_filters.deleteProductIDs[i];

              // delete the records
              await COLLECTION_DETAILS_MODEL.updateAll(
                {
                  productId: element.id,
                  masterdetailId: ctx.req.query.where.masterdetailId,
                },
                {
                  deletedAt: new Date(),
                }
              );
            }
          }

          if (
            ctx.args.data.collection_filters.addNewProductIDs &&
            ctx.args.data.collection_filters.addNewProductIDs.length > 0
          ) {
            for (
              let i = 0;
              i < ctx.args.data.collection_filters.addNewProductIDs.length;
              i++
            ) {
              const element =
                ctx.args.data.collection_filters.addNewProductIDs[i];

              // add records
              await COLLECTION_DETAILS_MODEL.create({
                collectionId: ctx.result.id,
                productId: element.id,
                masterdetailId: ctx.req.query.where.masterdetailId,
              });
            }
          }

          // Find Total Collection Products
          var getTotalCollectionDetails = await COLLECTION_DETAILS_MODEL.find({
            where: {
              collectionId: ctx.result.id,
              masterdetailId: ctx.req.query.where.masterdetailId,
            },
          });

          await Collection.updateAll(
            {
              id: ctx.result.id,
              masterdetailId: ctx.req.query.where.masterdetailId,
            },
            {
              collection_noofproducts: getTotalCollectionDetails.length,
            }
          );
        }

        // When Automated Collection
        if (ctx.args.data.collection_type === AUTOMATED_COLLECTION) {
          //When Config not Equal
          // if (ctx.args.data.isCollectionConfigNotEqual) {

          getCurrenctCollectionDetails = await COLLECTION_DETAILS_MODEL.find({
            where: {
              collectionId: ctx.req.params.id,
              masterdetailId: ctx.req.query.where.masterdetailId,
            },
          });

          if (ctx.args.data.collection_condition_config) {
            ctx.args.data.collection_condition_config = JSON.parse(
              ctx.args.data.collection_condition_config
            );
          }

          // find collection condtion
          getCollectionConditionSettingArray = await getCollectionSetting({
            registerallow: SETTING_CONSTANTS.COLLECTION,
            label: SETTING_CONSTANTS.COLLECTION_CONDITION,
          });
          getCollectionConditionSettingArray =
            getCollectionConditionSettingArray.value;

          // find collection criteria
          getCollectionCriteriaSettingArray = await getCollectionSetting({
            registerallow: SETTING_CONSTANTS.COLLECTION,
            label: SETTING_CONSTANTS.COLLECTION_CRITERIA,
          });
          getCollectionCriteriaSettingArray =
            getCollectionCriteriaSettingArray.value;

          if (
            ctx.args.data.collection_condition_config &&
            ctx.args.data.collection_condition_config.length > 0
          ) {
            for (
              let i = 0;
              i < ctx.args.data.collection_condition_config.length;
              i++
            ) {
              const element = ctx.args.data.collection_condition_config[i];
              getSubCondition = getCollectionConditionSettingArray.find(
                (obj) => obj.id === element.condtion_id
              );
              getSubCriteria = getCollectionCriteriaSettingArray.find(
                (obj) => obj.id === element.condition_criteria_id
              );

              if (getSubCriteria && getSubCriteria.id === 5) {
                isVariationCriteriaInCollection = true;
                variationList = [];
                const elemValue = element.condition_value.toLowerCase();
                variationList.push(elemValue);
                variationConfigList.push({
                  condition: getSubCondition,
                  value: variationList,
                });
                continue;
              }

              if (
                getSubCondition &&
                getSubCriteria &&
                element.condition_value
              ) {
                const getObjectKey = Object.values(getSubCriteria)[2];

                // is_equal_to
                if (getSubCondition.id === 1) {
                  if (getSubCriteria.id === 2) {
                    // Category
                    // Get Subcategories which belong to categoryList Array
                    var subcategoryList = [];
                    var getSubcategories = await CATEGORY_MODEL.find({
                      where: {
                        parentId: element.condition_value,
                        masterdetailId: ctx.req.query.where.masterdetailId,
                      },
                    });
                    if (getSubcategories && getSubcategories.length > 0) {
                      getSubcategories.filter((item) =>
                        subcategoryList.push(item.id)
                      );
                    }
                    if (subcategoryList.length > 0) {
                      CONDITION_ARRAY.push({
                        [getObjectKey]: {
                          inq: subcategoryList,
                        },
                      });
                    }
                  }

                  if (getSubCriteria.id === 3) {
                    // SubCategory
                    CONDITION_ARRAY.push({
                      [getObjectKey]: element.condition_value,
                    });
                  }

                  if (getSubCriteria.id === 4 || getSubCriteria.id === 1) {
                    // Price + Name
                    CONDITION_ARRAY.push(
                      JSON.stringify({
                        [getObjectKey]: element.condition_value,
                      })
                    );
                  }

                  continue;
                }

                // is_not_equal_to
                if (getSubCondition.id === 2) {
                  if (
                    getSubCriteria.id === 4 ||
                    getSubCriteria.id === 1 ||
                    getSubCriteria.id === 3
                  ) {
                    // Price + Name + Subcategory
                    CONDITION_ARRAY.push(
                      JSON.stringify({
                        [getObjectKey]: {
                          neq: element.condition_value,
                        },
                      })
                    );
                  }

                  if (getSubCriteria.id === 2) {
                    // Category
                    var getAllSubcategoryList = [];
                    var getRequestedSubcategoriesOfCategoryList = [];

                    var getAllSubcategories = await CATEGORY_MODEL.find({
                      where: {
                        parentId: {
                          neq: null,
                        },
                        masterdetailId: ctx.req.query.where.masterdetailId,
                      },
                    });

                    if (getAllSubcategories && getAllSubcategories.length > 0) {
                      getAllSubcategories.filter((item) =>
                        getAllSubcategoryList.push(item.id)
                      );
                    }

                    var getRequestedSubcategoriesOfCategory =
                      await CATEGORY_MODEL.find({
                        where: {
                          parentId: element.condition_value,
                          masterdetailId: ctx.req.query.where.masterdetailId,
                        },
                      });

                    if (
                      getRequestedSubcategoriesOfCategory &&
                      getRequestedSubcategoriesOfCategory.length > 0
                    ) {
                      getRequestedSubcategoriesOfCategory.filter((item) =>
                        getRequestedSubcategoriesOfCategoryList.push(item.id)
                      );
                    }

                    if (getRequestedSubcategoriesOfCategoryList.length > 0) {
                      getRequestedSubcategoriesOfCategoryList.filter((item) => {
                        const index = getAllSubcategoryList.indexOf(item);
                        if (index > -1) {
                          getAllSubcategoryList.splice(index, 1);
                        }
                      });
                    }

                    if (getAllSubcategoryList.length > 0) {
                      CONDITION_ARRAY.push({
                        [getObjectKey]: {
                          inq: getAllSubcategoryList,
                        },
                      });
                    }
                  }

                  continue;
                }

                // is_greatet_than
                if (getSubCondition.id === 3) {
                  CONDITION_ARRAY.push(
                    JSON.stringify({
                      [getObjectKey]: {
                        gt: element.condition_value,
                      },
                    })
                  );
                  continue;
                }

                // is_less_than
                if (getSubCondition.id === 4) {
                  CONDITION_ARRAY.push(
                    JSON.stringify({
                      [getObjectKey]: {
                        lt: element.condition_value,
                      },
                    })
                  );
                  continue;
                }

                // TODO ends_with
                if (getSubCondition.id === 5) {
                  CONDITION_ARRAY.push({
                    [getObjectKey]: {
                      like: "%" + element.condition_value, // Need to pass in body i.e. '%abc'
                    },
                  });
                  continue;
                }

                // TODO contains
                if (getSubCondition.id === 6) {
                  if (getSubCriteria.id === 2) {
                    // Category
                    // Get Subcategories which belong to categoryList Array
                    var subcategoryList = [];
                    for (let j = 0; j < element.condition_value.length; j++) {
                      const categoryElement = element.condition_value[j];
                      var getSubcategories = await CATEGORY_MODEL.find({
                        where: {
                          parentId: categoryElement.id,
                          masterdetailId: ctx.req.query.where.masterdetailId,
                        },
                      });
                      if (getSubcategories && getSubcategories.length > 0) {
                        getSubcategories.filter((item) =>
                          subcategoryList.push(item.id)
                        );
                      }
                    }
                    if (subcategoryList.length > 0) {
                      CONDITION_ARRAY.push({
                        [getObjectKey]: {
                          inq: subcategoryList,
                        },
                      });
                    }
                  }

                  if (getSubCriteria.id === 3) {
                    // SubCategory
                    // Get Subcategories which belong to subCategoryList Array
                    var subcategoryList = [];
                    if (element.condition_value.length > 0) {
                      for (let j = 0; j < element.condition_value.length; j++) {
                        const subcategoryElement = element.condition_value[j];
                        subcategoryList.push(subcategoryElement.id);
                      }
                    }
                    if (subcategoryList.length > 0) {
                      CONDITION_ARRAY.push({
                        [getObjectKey]: {
                          inq: subcategoryList,
                        },
                      });
                    }
                  }

                  if (getSubCriteria.id === 1 || getSubCriteria.id === 4) {
                    CONDITION_ARRAY.push({
                      [getObjectKey]: {
                        like: "%" + element.condition_value + "%",
                      },
                    });
                  }

                  continue;
                }

                // TODO does_not_contain
                if (getSubCondition.id === 7) {
                  if (getSubCriteria.id === 2) {
                    // Category
                    var getAllSubcategoryList = [];
                    var getRequestedSubcategoriesOfCategoryList = [];

                    var getAllSubcategories = await CATEGORY_MODEL.find({
                      where: {
                        parentId: {
                          neq: null,
                        },
                        masterdetailId: ctx.req.query.where.masterdetailId,
                      },
                    });

                    if (getAllSubcategories && getAllSubcategories.length > 0) {
                      getAllSubcategories.filter((item) =>
                        getAllSubcategoryList.push(item.id)
                      );
                    }

                    for (let j = 0; j < element.condition_value.length; j++) {
                      const categoryElement = element.condition_value[j];
                      var getRequestedSubcategoriesOfCategory =
                        await CATEGORY_MODEL.find({
                          where: {
                            parentId: categoryElement.id,
                            masterdetailId: ctx.req.query.where.masterdetailId,
                          },
                        });
                      if (
                        getRequestedSubcategoriesOfCategory &&
                        getRequestedSubcategoriesOfCategory.length > 0
                      ) {
                        getRequestedSubcategoriesOfCategory.filter((item) =>
                          getRequestedSubcategoriesOfCategoryList.push(item.id)
                        );
                      }
                    }

                    if (getRequestedSubcategoriesOfCategoryList.length > 0) {
                      getRequestedSubcategoriesOfCategoryList.filter((item) => {
                        const index = getAllSubcategoryList.indexOf(item);
                        if (index > -1) {
                          getAllSubcategoryList.splice(index, 1);
                        }
                      });
                    }

                    if (getAllSubcategoryList.length > 0) {
                      CONDITION_ARRAY.push({
                        [getObjectKey]: {
                          inq: getAllSubcategoryList,
                        },
                      });
                    }
                  }

                  if (getSubCriteria.id === 3) {
                    // SubCategory
                    var getAllSubcategoryList = [];
                    var getRequestedSubcategoriesOfCategoryList = [];

                    var getAllSubcategories = await CATEGORY_MODEL.find({
                      where: {
                        parentId: {
                          neq: null,
                        },
                        masterdetailId: ctx.req.query.where.masterdetailId,
                      },
                    });

                    if (getAllSubcategories && getAllSubcategories.length > 0) {
                      getAllSubcategories.filter((item) =>
                        getAllSubcategoryList.push(item.id)
                      );
                    }

                    for (let j = 0; j < element.condition_value.length; j++) {
                      const categoryElement = element.condition_value[j];
                      getRequestedSubcategoriesOfCategoryList.push(
                        categoryElement.id
                      );
                    }

                    if (getRequestedSubcategoriesOfCategoryList.length > 0) {
                      getRequestedSubcategoriesOfCategoryList.filter((item) => {
                        const index = getAllSubcategoryList.indexOf(item);
                        if (index > -1) {
                          getAllSubcategoryList.splice(index, 1);
                        }
                      });
                    }

                    if (getAllSubcategoryList.length > 0) {
                      CONDITION_ARRAY.push({
                        [getObjectKey]: {
                          inq: getAllSubcategoryList,
                        },
                      });
                    }
                  }

                  if (getSubCriteria.id === 1 || getSubCriteria.id === 4) {
                    CONDITION_ARRAY.push({
                      [getObjectKey]: {
                        like: "%" + element.condition_value + "%",
                      },
                    });
                  }

                  continue;
                }
              }
            }

            // Manage Variation Config Here
            // variationConfigList.push({
            //   condition: getSubCondition,
            //   value: variationList
            // });

            var copyOfConditionArray = [];

            if (CONDITION_ARRAY && CONDITION_ARRAY.length > 0) {
              for (let i = 0; i < CONDITION_ARRAY.length; i++) {
                var item = CONDITION_ARRAY[i];
                if (typeof item === "string") {
                  item = JSON.parse(item);
                }
                copyOfConditionArray.push(item);
              }
            }

            // For OR condition
            if (
              ctx.args.data.collection_condition_type ===
              OR_COLLECTION_MAIN_CONDITION
            ) {
              getAutomatedCollectionProducts = await PRODUCT_MODEL.find({
                where: {
                  and: [
                    {
                      or: copyOfConditionArray,
                    },
                    {
                      masterdetailId: ctx.req.query.where.masterdetailId,
                    },
                    {
                      productstatus: 1,
                    },
                  ],
                },
              });

              var getAllProducts = [];
              getAllProducts = await PRODUCT_MODEL.find({
                where: {
                  masterdetailId: ctx.req.query.where.masterdetailId,
                },
              });

              if (isVariationCriteriaInCollection) {
                // When AND Condition filter product which have particular variation
                var filterProductWithVariationCondition = [];

                if (variationConfigList.length > 0) {
                  var isEqualConditionArray = [];
                  var isNotEqualConditionArray = [];

                  if (variationConfigList.length > 0) {
                    if (variationConfigList.length) {
                      // variationConfigList = variationConfigList.sort((a, b) => {
                      //   return a.condition.id - b.condition.id;
                      // });

                      variationConfigList.filter((item) =>
                        item.condition.id === 1
                          ? isEqualConditionArray.push(item)
                          : isNotEqualConditionArray.push(item)
                      );
                    }

                    if (isEqualConditionArray.length > 0) {
                      for (let m = 0; m < isEqualConditionArray.length; m++) {
                        const variationConfigListElement =
                          isEqualConditionArray[m];

                        for (
                          let j = 0;
                          j < getAutomatedCollectionProducts.length;
                          j++
                        ) {
                          const item = getAutomatedCollectionProducts[j];
                          const itemVariation = JSON.parse(
                            item.variationconfig
                          );
                          var itemProductVariation = [];

                          if (itemVariation && itemVariation.length > 0) {
                            for (let k = 0; k < itemVariation.length; k++) {
                              const subItem = itemVariation[k];
                              if (Object.entries(subItem).length > 2) {
                                var getParticularVariationArray =
                                  Object.values(subItem)[2];
                                if (getParticularVariationArray.length > 0) {
                                  getParticularVariationArray =
                                    getParticularVariationArray.find((obj) => {
                                      var elemValue =
                                        obj.itemname.toLowerCase();
                                      itemProductVariation.push(elemValue);
                                    });
                                }
                              }
                            }
                          }

                          if (
                            itemProductVariation.length > 0 &&
                            variationConfigListElement
                          ) {
                            var isContainSameVariation = 0;

                            for (
                              let n = 0;
                              n < variationConfigListElement.value.length;
                              n++
                            ) {
                              const checkContainElement =
                                variationConfigListElement.value[n];
                              const elemValue =
                                checkContainElement.toLowerCase();
                              const getResult =
                                itemProductVariation.includes(elemValue);
                              if (getResult) {
                                isContainSameVariation++;
                              }
                            }

                            if (variationConfigListElement.condition.id === 1) {
                              // Is Equal To
                              if (
                                variationConfigListElement.value.length ===
                                isContainSameVariation
                              ) {
                                filterProductWithVariationCondition.push(item);
                              }
                            }

                            if (variationConfigListElement.condition.id === 2) {
                              // // Is Not Equal To
                              if (
                                variationConfigListElement.value.length !==
                                isContainSameVariation
                              ) {
                                filterProductWithVariationCondition.push(item);
                              }
                            }
                          }
                        }
                      }

                      getAutomatedCollectionProducts = [
                        ...new Map(
                          filterProductWithVariationCondition.map((item) => [
                            item["id"],
                            item,
                          ])
                        ).values(),
                      ];
                    }

                    if (isNotEqualConditionArray.length > 0) {
                      for (
                        let m = 0;
                        m < isNotEqualConditionArray.length;
                        m++
                      ) {
                        const variationConfigListElement =
                          isNotEqualConditionArray[m];

                        for (
                          let j = 0;
                          j < getAutomatedCollectionProducts.length;
                          j++
                        ) {
                          const item = getAutomatedCollectionProducts[j];
                          const itemVariation = JSON.parse(
                            item.variationconfig
                          );
                          var itemProductVariation = [];

                          if (itemVariation && itemVariation.length > 0) {
                            for (let k = 0; k < itemVariation.length; k++) {
                              const subItem = itemVariation[k];
                              if (Object.entries(subItem).length > 2) {
                                var getParticularVariationArray =
                                  Object.values(subItem)[2];
                                if (getParticularVariationArray.length > 0) {
                                  getParticularVariationArray =
                                    getParticularVariationArray.find((obj) => {
                                      var elemValue =
                                        obj.itemname.toLowerCase();
                                      itemProductVariation.push(elemValue);
                                    });
                                }
                              }
                            }
                          }

                          if (
                            itemProductVariation.length > 0 &&
                            variationConfigListElement
                          ) {
                            var isContainSameVariation = 0;

                            for (
                              let n = 0;
                              n < variationConfigListElement.value.length;
                              n++
                            ) {
                              const checkContainElement =
                                variationConfigListElement.value[n];
                              const elemValue =
                                checkContainElement.toLowerCase();
                              const getResult =
                                itemProductVariation.includes(elemValue);
                              if (getResult) {
                                isContainSameVariation++;
                              }
                            }

                            if (variationConfigListElement.condition.id === 1) {
                              // Is Equal To
                              if (
                                variationConfigListElement.value.length ===
                                isContainSameVariation
                              ) {
                                filterProductWithVariationCondition.push(item);
                              }
                            }

                            if (variationConfigListElement.condition.id === 2) {
                              // // Is Not Equal To
                              if (
                                variationConfigListElement.value.length !==
                                isContainSameVariation
                              ) {
                                filterProductWithVariationCondition.push(item);
                              }
                            }
                          }
                        }
                      }

                      getAutomatedCollectionProducts = [
                        ...new Map(
                          filterProductWithVariationCondition.map((item) => [
                            item["id"],
                            item,
                          ])
                        ).values(),
                      ];
                    }
                  }
                }

                const mergeArray = getAutomatedCollectionProducts.concat(
                  filterProductWithVariationCondition
                );
                const distinct = [
                  ...new Set(mergeArray.map((item) => item.id)),
                ];
                getAutomatedCollectionProducts = distinct;
                var attachProductData = [];
                if (
                  getAutomatedCollectionProducts &&
                  getAutomatedCollectionProducts.length > 0
                ) {
                  for (
                    let index = 0;
                    index < getAutomatedCollectionProducts.length;
                    index++
                  ) {
                    const item = getAutomatedCollectionProducts[index];
                    const getSingleProduct = await PRODUCT_MODEL.findOne({
                      where: {
                        id: item,
                      },
                    });
                    attachProductData.push(getSingleProduct);
                  }
                }
                getAutomatedCollectionProducts = attachProductData;
              }
            }

            //Compare New Found Data(using Query) with Exist Data and Add the New Records which not exist in collection
            if (
              getCurrenctCollectionDetails &&
              getAutomatedCollectionProducts &&
              getAutomatedCollectionProducts.length > 0
            ) {
              var newDiffrentProducts = [];

              for (
                let index = 0;
                index < getAutomatedCollectionProducts.length;
                index++
              ) {
                const element = getAutomatedCollectionProducts[index];

                var isProductExist = getCurrenctCollectionDetails.find(
                  (obj) => obj.productId === element.id
                );
                if (!isProductExist) {
                  newDiffrentProducts.push(element);
                }
              }

              if (newDiffrentProducts && newDiffrentProducts.length > 0) {
                for (let i = 0; i < newDiffrentProducts.length; i++) {
                  const element = newDiffrentProducts[i];

                  // Add the Records
                  await COLLECTION_DETAILS_MODEL.create({
                    collectionId: ctx.req.params.id,
                    productId: element.id,
                    masterdetailId: ctx.req.query.where.masterdetailId,
                  });
                }
              }
            }

            //Compare Exist Data with New Found Data(using Query) and Remove the Records from collection which not exist in New Data
            if (
              getAutomatedCollectionProducts &&
              getCurrenctCollectionDetails &&
              getCurrenctCollectionDetails.length > 0
            ) {
              var deleteProducts = [];

              for (
                let index = 0;
                index < getCurrenctCollectionDetails.length;
                index++
              ) {
                const element = getCurrenctCollectionDetails[index];

                var isProductExist = getAutomatedCollectionProducts.find(
                  (obj) => obj.id === element.productId
                );
                if (!isProductExist) {
                  deleteProducts.push(element);
                }
              }

              if (deleteProducts && deleteProducts.length > 0) {
                for (let i = 0; i < deleteProducts.length; i++) {
                  const element = deleteProducts[i];

                  // delete the records
                  await COLLECTION_DETAILS_MODEL.updateAll(
                    {
                      collectionId: ctx.req.params.id,
                      id: element.id,
                      masterdetailId: ctx.req.query.where.masterdetailId,
                    },
                    {
                      deletedAt: new Date(),
                    }
                  );
                }
              }
            }

            // Update Collection No Of Products
            await Collection.updateAll(
              {
                id: ctx.req.params.id,
                masterdetailId: ctx.req.query.where.masterdetailId,
              },
              {
                collection_noofproducts: getAutomatedCollectionProducts.length,
              }
            );
          }

          // }
        }
      } catch (error) {
        throw error;
      }
    }
  );

  Collection.getCollectionCriteria = async (req) => {
    try {
      return await getCollectionSetting({
        registerallow: SETTING_CONSTANTS.COLLECTION,
        label: SETTING_CONSTANTS.COLLECTION_CRITERIA,
      });
    } catch (error) {
      throw error;
    }
  };

  Collection.getCollectionCondition = async (req) => {
    try {
      return await getCollectionSetting({
        registerallow: SETTING_CONSTANTS.COLLECTION,
        label: SETTING_CONSTANTS.COLLECTION_CONDITION,
      });
    } catch (error) {
      throw error;
    }
  };

  Collection.getCollectionProgress = async (req) => {
    try {
      const totalCollection = await Collection.count({
        masterdetailId: req.query.where.masterdetailId,
      });

      return {
        totalCollection,
      };
    } catch (error) {
      throw error;
    }
  };

  Collection.getManualCollectionProductListing = async (req) => {
    var tempQuery = "";
    var getSubcategories;
    var CATEGORY_MODEL = app.models.category;
    var PRODUCTMEDIA_MODEL = app.models.productmedia;

    try {
      if (
        req.query.filter.where &&
        req.query.filter.where.name &&
        req.query.filter.where.name.like
      ) {
        req.query.filter.where.name.like = req.query.filter.where.name.like
          .split("%20")
          .join(" ");
        tempQuery +=
          " AND `name` LIKE  '" + req.query.filter.where.name.like + "' ";
      }

      if (req.query.filter.where && req.query.filter.where.categoryId) {
        getSubcategories = await CATEGORY_MODEL.find({
          where: {
            parentId: req.query.filter.where.categoryId,
            masterdetailId: req.query.where.masterdetailId,
          },
        });
        if (getSubcategories && getSubcategories.length > 0) {
          getSubcategories = await getSubcategories.map(
            (oneCategory) => oneCategory.id
          );
          getSubcategories = await getSubcategories
            .map((item) => JSON.stringify(item))
            .join();
          getSubcategories = "(" + getSubcategories + ")";
        }
      }

      if (req.query.filter.where && req.query.filter.where.subCategoryId) {
        getSubcategories =
          "(" + JSON.stringify(req.query.filter.where.subCategoryId) + ")";
      }

      var productQuery;
      if (getSubcategories) {
        // getSubcategories = JSON.stringify(getSubcategories);
        productQuery =
          "SELECT * FROM `product` WHERE `categoryId` IN " +
          getSubcategories +
          " AND `productstatus` = 1 AND `availablequantity` > 0 AND `deletedAt` IS NULL AND `masterdetailId` = '" +
          req.query.where.masterdetailId +
          "' " +
          tempQuery +
          " ORDER BY `name` LIMIT " +
          req.query.filter.skip +
          "," +
          req.query.filter.limit;
      } else {
        productQuery =
          "SELECT * FROM `product` WHERE `productstatus` = 1 AND `availablequantity` > 0 AND `deletedAt` IS NULL AND `masterdetailId` = '" +
          req.query.where.masterdetailId +
          "' " +
          tempQuery +
          " ORDER BY `name` LIMIT " +
          req.query.filter.skip +
          "," +
          req.query.filter.limit;
      }

      var productData = await new Promise((resolve, reject) => {
        app.datasources.mysql.connector.execute(
          productQuery,
          null,
          (err, result) => {
            if (err) reject(err);
            resolve(result);
          }
        );
      });

      if (productData && productData.length > 0) {
        for (let i = 0; i < productData.length; i++) {
          const element = productData[i];

          // attach product media
          var media = await PRODUCTMEDIA_MODEL.find({
            where: {
              productId: element.id,
              masterdetailId: req.query.where.masterdetailId,
            },
          });
          element.productmedia = media;

          // attach category data
          var categoryOfProduct = await CATEGORY_MODEL.findOne({
            where: {
              id: element.categoryId,
              masterdetailId: req.query.where.masterdetailId,
            },
          });
          element.category = categoryOfProduct;
        }
      }

      return productData;
    } catch (error) {
      throw error;
    }
  };

  Collection.getCollectionProducts = async (req) => {
    var PRODUCT_MODEL = app.models.product;
    var CATEGORY_MODEL = app.models.category;
    var PRODUCTMEDIA_MODEL = app.models.productmedia;
    var COLLECTION_DETAILS_MODEL = app.models.collectiondetail;

    var productData = [];

    try {
      var activeProductCount = 0;
      var deactiveProductCount = 0;

      var collectionProducts = await COLLECTION_DETAILS_MODEL.find({
        where: {
          collectionId: req.query.filter.where.id,
          masterdetailId: req.query.where.masterdetailId,
        },
      });

      if (collectionProducts && collectionProducts.length > 0) {
        for (let i = 0; i < collectionProducts.length; i++) {
          const element = collectionProducts[i];

          var getSingleProduct = await PRODUCT_MODEL.findOne({
            where: {
              id: element.productId,
              masterdetailId: req.query.where.masterdetailId,
            },
            include: ["productmedia", "category"],
          });

          if (getSingleProduct) {
            getSingleProduct.productstatus === 1
              ? activeProductCount++
              : deactiveProductCount++;

            // // attach product media
            // var media = await PRODUCTMEDIA_MODEL.find({
            //   where: {
            //     productId: getSingleProduct.id,
            //     masterdetailId: req.query.where.masterdetailId
            //   }
            // });
            // getSingleProduct.productMediaDetails = media;

            // // attach category data
            // var categoryOfProduct = await CATEGORY_MODEL.findOne({
            //   where: {
            //     id: getSingleProduct.categoryId,
            //     masterdetailId: req.query.where.masterdetailId
            //   }
            // });
            // getSingleProduct.categoryDetails = categoryOfProduct;

            productData.push(getSingleProduct);
          }
        }
      }

      return {
        products: productData,
        activeProductCount,
        deactiveProductCount,
      };
    } catch (error) {
      throw error;
    }
  };

  async function getCollectionSetting(params) {
    const SETTING_MODEL = app.models.setting;
    var getSetting;
    getSetting = await SETTING_MODEL.findOne({
      where: {
        registerallow: params.registerallow,
      },
    });
    getSetting = JSON.parse(getSetting.text);
    return getSetting.find((item) => item.label === params.label);
  }

  async function getSetting(params) {
    const SETTING_MODEL = app.models.setting;
    return await SETTING_MODEL.findOne({
      where: {
        registerallow: params.registerallow,
        masterdetailId: params.masterdetailId,
      },
    });
  }

  function equalsIgnoreOrder(a, b) {
    if (a.length !== b.length) return false;
    const uniqueValues = new Set([...a, ...b]);
    for (const v of uniqueValues) {
      const aCount = a.filter((e) => e === v).length;
      const bCount = b.filter((e) => e === v).length;
      if (aCount !== bCount) return false;
    }
    return true;
  }
};
