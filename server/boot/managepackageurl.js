// /**
//           * List The Data what we have to manage
//           * 1. Customer Groups
//           * 2. Inquiry Management
//           * 3. Orders & Customer Management 
//           * 4. Catalogue Management
//           */

// console.log(ctx.req.originalUrl);

// // 1. Customer Groups URLs
// if ((ctx.req.originalUrl === '/api/groups' && ctx.req.method == 'POST') ||
//     (ctx.req.originalUrl.includes('/api/groups/') && ctx.req.method == 'PATCH') ||
//     (ctx.req.originalUrl.includes('/api/groups/') && ctx.req.method == 'DELETE') ||
//     (ctx.req.originalUrl.includes('/api/groups/') && ctx.req.method == 'GET') ||
//     (ctx.req.originalUrl.includes('/api/groups?') && ctx.req.method == 'GET') ||
//     (ctx.req.originalUrl.includes('/api/groups?isWeb=true&') && ctx.req.method == 'GET')) {

//     // Restrict URL Based on Package Specification            
//     var currentMerchantPlan = await constants.getCurrentMarchantPlan(constants.CURRENT_MERCHANT_PLAN_LABEL, 1, requestUser.masterdetailId);

//     //  Customer Groups status of Plan
//     var result = await constants.commonCheckPlanCriteriaFeatures(currentMerchantPlan, null, constants.CUSTOMER_GROUP_KEY)
//     if (!result) {
//         throw constants.createError(404, 'Update Your Plan!');
//     }
// }

// // 2. Inquiry Management
// if ((ctx.req.originalUrl.includes('/api/inquiries/') && ctx.req.method == 'GET') ||
//     (ctx.req.originalUrl.includes('/api/inquiries?isWeb=true&') && ctx.req.method == 'GET')) {

//     // Restrict URL Based on Package Specification            
//     var currentMerchantPlan = await constants.getCurrentMarchantPlan(constants.CURRENT_MERCHANT_PLAN_LABEL, 1, requestUser.masterdetailId);

//     // Then check Customer Groups status of Plan
//     var result = await constants.commonCheckPlanCriteriaFeatures(currentMerchantPlan, null, constants.CUSTOMER_GROUP_KEY)
//     console.log(result);
//     if (!result) {
//         throw constants.createError(404, 'Update Your Plan!');
//     }
// }

// // 2. Order Management
// if ((ctx.req.originalUrl.includes('/api/orders/') && ctx.req.method == 'GET') ||
//     (ctx.req.originalUrl.includes('/api/orders?isWeb=true&') && ctx.req.method == 'GET')) {
//     console.log(ctx.req.originalUrl);

//     // Restrict URL Based on Package Specification            
//     var currentMerchantPlan = await constants.getCurrentMarchantPlan(constants.CURRENT_MERCHANT_PLAN_LABEL, 1, requestUser.masterdetailId);

//     // Then check Customer Groups status of Plan
//     var result = await constants.commonCheckPlanCriteriaFeatures(currentMerchantPlan, null, constants.CUSTOMER_GROUP_KEY)
//     console.log(result);
//     if (!result) {
//         throw constants.createError(404, 'Update Your Plan!');
//     }
// }

// // 1. Customers Management
// if ((ctx.req.originalUrl === '/api/users' && ctx.req.method == 'POST') ||
//     (ctx.req.originalUrl.includes('/api/users/') && ctx.req.method == 'PATCH') ||
//     (ctx.req.originalUrl.includes('/api/users/') && ctx.req.method == 'DELETE') ||
//     (ctx.req.originalUrl.includes('/api/users/') && ctx.req.method == 'GET') ||
//     (ctx.req.originalUrl.includes('/api/users?isWeb=true&') && ctx.req.method == 'GET')
// ) {

// }
