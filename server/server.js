'use strict';

var path = require('path');
var loopback = require('loopback');
var boot = require('loopback-boot');
var app = module.exports = loopback();
const parser = require('form-parser');
var bodyParser = require('body-parser');
var callCache = require("./config/server-wise-configuration");

// support parsing of application/json type post data
app.use(bodyParser.json({
  limit: '50mb'
}));

// configure view handler
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.get('/pdfdata', function (req, res) {
  res.render('pdfdata', {
    productData: [{
      name: 'Demo Product',
      qrcodeData: 'https://chart.googleapis.com/chart?chs=300x300&cht=qr&chl=eyJpZCI6ImZmNzMyYWEwLTE3ZTQtNDZkYS04OTA5LWJlMzg0ZjI2ZDhiOSJ9'
    }]
  });
});

// Success Response
app.get('/successCheckoutResponse', function (req, res) {
  res.render('successCheckoutResponse', {
    redirectURL: 'http://bizon.secretdemo.com/nutland/orderdetails/' + '8dbb24e3-3725-4f7a-b057-79df96ecdef0',
    orderId: '123',
    paymentType: 'Sadad Pay',
    orderno: 'getOrderDetails.orderno',
    mobile: 'getOrderUserDetails.cellnumber',
    email: 'getOrderUserDetails.email',
    transactionId: '12345678901',
    orderDate: '3 Dec 2021',
    totalItems: '2'
  });
});

// Error Response
app.get('/errorCheckoutResponse', function (req, res) {
  res.render('errorCheckoutResponse', {
    redirectURL: 'http://bizon.secretdemo.com/nutland/orderdetails/' + '8dbb24e3-3725-4f7a-b057-79df96ecdef0'
  });
});

// TODO : Set Dynamic URL of webstore

app.post('/checkoutResponse', async function (req, res) {
  var responseObject = {};
  var parseDescriptionDetails;
  var userModel = app.models.user;
  var orderModel = app.models.order;
  var masterdetailModel = app.models.masterdetail;
  var setRedirectURL = '';

  try {

    // Parse request
    await parser(req, async field => {
      // console.log(field) // { fieldType, fieldName, fieldContent }
      responseObject[field.fieldName] = field.fieldContent;
    });

    // Check OrderId Exist or not
    if (!responseObject || !responseObject.ORDERID) {
      await res.render('errorCheckoutResponse', {
        redirectURL: app.get('serverConfig').webstore_url,
        errorMessage: 'Order not found.'
      });
      return;
    } else {
      // Get Master Id based on OrderId
      var getOrderDetails = await orderModel.findOne({
        where: {
          id: responseObject.ORDERID
        }
      });

      // When order Exist
      if (getOrderDetails) {

        var getInstanceDetails = await masterdetailModel.findOne({
          where: {
            id: getOrderDetails.masterdetailId
          }
        });

        if (getInstanceDetails) {
          var parseDescriptionDetails = JSON.parse(getInstanceDetails.description);
          if (parseDescriptionDetails) {
            var getDomainURLFromDescription = await parseDescriptionDetails.find(item => item.key === 'domainURL');
            if (getDomainURLFromDescription === 'domainURL' && getDomainURLFromDescription.value) {
              setRedirectURL = getDomainURLFromDescription.value;
            } else {
              var getWebstoreURLFromDescription = await parseDescriptionDetails.find(item => item.key === 'webstoreURL');
              setRedirectURL = app.get('serverConfig').webstore_url + getWebstoreURLFromDescription.value;
            }

            if (setRedirectURL && setRedirectURL.length > 0) {
              // Update paymentDetail in the order
              if (responseObject.STATUS === 'TXN_SUCCESS' || responseObject.STATUS === 'TXN_FAILURE') {
                await app.models.order.updateAll({
                  id: getOrderDetails.id
                }, {
                  paymentDetail: JSON.stringify(responseObject)
                });
              } else {
                await res.render('errorCheckoutResponse', {
                  redirectURL: setRedirectURL,
                  errorMessage: 'Transaction Failed'
                });
                return;
              }
            } else {
              await res.render('errorCheckoutResponse', {
                redirectURL: setRedirectURL,
                errorMessage: 'Redirect URL is not valid.'
              });
              return;
            }

            setRedirectURL = setRedirectURL + '/orderdetails/' + responseObject.ORDERID;

            var getOrderUserDetails = await userModel.findOne({
              where: {
                id: getOrderDetails.userId
              }
            });

            // Fail Transaction Response
            if (responseObject.STATUS === 'TXN_FAILURE') {
              await res.render('errorCheckoutResponse', {
                redirectURL: setRedirectURL,
                errorMessage: 'Transaction Failed'
              });
              return;
            }

            // Success Transaction Response
            if (responseObject.STATUS === 'TXN_SUCCESS') {
              await res.render('successCheckoutResponse', {
                orderId: responseObject.ORDERID,
                redirectURL: setRedirectURL,
                paymentType: 'Sadad Pay',
                orderno: getOrderDetails.orderno,
                mobile: getOrderUserDetails.cellnumber,
                email: getOrderUserDetails.email,
                transactionId: responseObject.transaction_number,
                // orderDate: '3 Dec 2021',
                totalItems: getOrderDetails.totalitems
              });
              return;
            }

          } else {
            await res.render('errorCheckoutResponse', {
              redirectURL: app.get('serverConfig').webstore_url + req.query.redirectTo,
              errorMessage: 'Instance details are not valid. please contact your support.'
            });
            return;
          }
        } else {
          await res.render('errorCheckoutResponse', {
            redirectURL: app.get('serverConfig').webstore_url + req.query.redirectTo,
            errorMessage: 'Instance not found.'
          });
          return;
        }

      } else {
        await res.render('errorCheckoutResponse', {
          redirectURL: app.get('serverConfig').webstore_url,
          errorMessage: 'Order not found, Please try again.'
        });
        return;
      }
    }

  } catch (error) {
    throw error;
  }

});

app.start = function () {
  // start the web server
  return app.listen(function () {
    app.emit('started');
    callCache.initDefaultSettings();
    var baseUrl = app.get('url').replace(/\/$/, '');
    // console.clear();
    console.log('Web server listening at: %s', baseUrl);
    if (app.get('loopback-component-explorer')) {
      var explorerPath = app.get('loopback-component-explorer').mountPath;
      console.log('Browse your REST API at %s%s', baseUrl, explorerPath);
    }
  });
};

boot(app, __dirname, function (err) {
  if (err) throw err;

  // start the server if `$ node server.js`
  if (require.main === module)
    app.start();
});
