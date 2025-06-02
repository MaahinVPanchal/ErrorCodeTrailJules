var server = require('../server');
var dataSource = server.dataSources.mysql;
var dataSourceAudit = server.dataSources.auditdb;

var builtInModels = ['AccessToken', 'ACL']; // array for built in models
var userDefinedModels = [ // array for userdefined models
  'user',
  'category',
  'city',
  'notification',
  'notificationreceiver',
  'notificationtype',
  'order',
  'orderdetails',
  'product',
  'productmedia',
  'usermetaauth',
  'userrole',
  'notify',
  'setting',
  'productbrand',
  'orderstatus',
  'commoncounter',
  'group',
  'groupcategory',
  'groupprice',
  'role',
  'producttags',
  'salesmancity',
  'state',
  'shorturl',
  'ordernotes',
  'ordernotesmedia',
  'useraddress',
  'producttype',
  'inquiry',
  'source',
  'language',
  'categorymedia',
  'masterdetail',
  'rolemapping',
  'invoice',
  'invoicedetails',
  'invoicestatus',
  'masterdetailmeta',
  'feedback',
  'categorydetail',
  'collection',
  'collectiondetail',
  'finance'
];


var auditModels = [
  'auditlog'
];

// dataSource.autoupdate('rolemapping', function (err, result) {
//   console.log('Datasource Synced: User defined models-----');
// });


// migrate built-in models
dataSource.isActual(builtInModels, function (err, actual) {
  if (!actual) {
    dataSource.autoupdate(builtInModels, function (err, result) {
      if (err) console.log(err);
      console.log('dataSource Synced: Built in models');
    });
  }
});


// migrate userdefined models
dataSource.isActual(userDefinedModels, function (err, actual) {
  if (!actual) {
    dataSource.autoupdate(userDefinedModels, function (err, result) {
      if (err) console.log(err);
      console.log('dataSource Synced: User defined models');
    });
  }
});

// migrate audit models
dataSourceAudit.isActual(auditModels, function (err, actual) {
  if (!actual) {
    dataSourceAudit.autoupdate(auditModels, function (err, result) {
      if (err) console.log(err);
      console.log('dataSourceAudit : Audit Datasource Synced');
    });
  }
});
