/**
 * Follow Links
 * 1.https://github.com/razorpay/razorpay-node/wiki#subscriptions
 * 2.https://razorpay.com/docs/payment-gateway/server-integration/nodejs/usage/
 * 3.https://razorpay.com/docs/api/
 * 4.https://razorpay.com/docs/subscriptions/
 * 5.https://dashboard.razorpay.com/app/plans
 */

const Razorpay = require("razorpay");
const request = require("request");
const merchantId = 'GGksD1GKWqRfFy';
var crypto = require('crypto');
const app = require("../server");
var constants = require("../../common/const");

module.exports = {

  createPlan: async (obj) => {
    console.log('createPlan calls');
    var getRazorpayConfig = await constants.getCredentials();
    console.log(getRazorpayConfig);
    var instance = new Razorpay({
      key_id: getRazorpayConfig.key_id,
      key_secret: getRazorpayConfig.key_secret
    });

    // Using Instance
    return await new Promise((resolve, reject) => {
      instance.plans.create(obj, (err, res) => {
        if (err) {
          reject(err);
        } else if (res) {
          resolve(res);
        }
      });
    });

  },

  getAllPlans: async () => {

    var getRazorpayConfig = await constants.getCredentials();

    var razorpayOptions = {
      url: 'https://api.razorpay.com/v1/plans?count=100',
      auth: {
        user: getRazorpayConfig.key_id,
        password: getRazorpayConfig.key_secret
      }
    }

    // Get All Plans
    var planResponse = await new Promise((resolve, reject) => {
      request(razorpayOptions, (err, result) => {
        if (err) reject(console.log(err));
        resolve(result);
      })
    });

    // Parse Reponse of All Plan
    planResponse = JSON.parse(planResponse.body);

    var planData = [];
    planResponse.items.filter(e => {
      planData.push(e);
    });

    return planData;

  },

  createSubscription: async (obj) => {
    console.log('createSubscription calls');

    var getRazorpayConfig = await constants.getCredentials();

    var instance = new Razorpay({
      key_id: getRazorpayConfig.key_id,
      key_secret: getRazorpayConfig.key_secret
    });

    // Using Instance
    return await new Promise((resolve, reject) => {
      instance.subscriptions.create(obj, (err, res) => {
        if (err) {
          reject(err);
        } else if (res) {
          resolve(res);
        }
      });
    });

  },

  doCheckoutRequest: async (obj) => {
    var getRazorpayConfig = await constants.getCredentials();
    // var getRazorpayConfig = { key_id: 'rzp_test_X4Br9ESeBt5tqG', key_secret: 'Hss3qnqN3XMeS1bJLd9pLtyo' };

    var instance = new Razorpay({
      key_id: getRazorpayConfig.key_id,
      key_secret: getRazorpayConfig.key_secret
    });

    return await new Promise((resolve, reject) => {
      instance.orders.create(obj, (err, order) => {
        if (err) {
          reject(err);
        } else if (order) {
          console.log(order);
          response = {
            value: order,
            key: getRazorpayConfig.key_id
          };
          resolve(response);
        }
      });
    });

  },

  convertToHasg: async (rzp_id, sb_id) => {

    var getRazorpayConfig = await constants.getCredentials();

    //creating hmac object 
    var hmac = crypto.createHmac('sha256', getRazorpayConfig.key_secret);

    //passing the data to be hashed
    data = hmac.update(rzp_id + '|' + sb_id);

    //Creating the hmac in the required format
    gen_hmac = data.digest('hex');

    // //Printing the output on the console
    // console.log('-------------------');
    // console.log('Generated Signature :---- ', gen_hmac);
    // console.log('-------------------');

    return gen_hmac;
  },

  doVerifySignature: async (rzp_id, order_id) => {
    var getRazorpayConfig = await constants.getCredentials();
    // var getRazorpayConfig = { key_id: 'rzp_test_X4Br9ESeBt5tqG', key_secret: 'Hss3qnqN3XMeS1bJLd9pLtyo' };
    //creating hmac object 
    var hmac = crypto.createHmac('sha256', getRazorpayConfig.key_secret);
    //passing the data to be hashed
    data = hmac.update(order_id + '|' + rzp_id);
    //Creating the hmac in the required format
    gen_hmac = data.digest('hex');
    // Return Response
    return gen_hmac;
  }

};
