'use strict';

const fs = require('fs');
const path = require('path');
const Constants = require("../const");
const filePath = 'server/containers/tempmedia/currency.json';

module.exports = function (Currency) {

  Currency.getCurrencyJSON = async () => {
    try {

      var getCurrencyFromFile = fs.readFileSync(filePath);
      var getCurrencyJSON = JSON.parse(getCurrencyFromFile);
      return getCurrencyJSON;

    } catch (error) {
      throw error;
    }
  };

  Currency.saveCurrencyJSON = async (req) => {
    try {

      console.log('H');

      const stringifyPostObject = JSON.stringify(req.body.currencyDetails);
      fs.writeFile(filePath, stringifyPostObject, function (err) {
        if (err) {
          return console.log(err);
        } else {
          return req.body.currencyDetails;
        }
      });

    } catch (error) {
      throw error;
    }
  };

  Currency.getBaseCurrencies = async () => {
    try {

      var baseCurrency = [];
      var getCurrencyFromFile = fs.readFileSync(filePath);
      var getCurrencyJSON = JSON.parse(getCurrencyFromFile);

      if (getCurrencyJSON.length > 0) {
        getCurrencyJSON.filter(item => {
          item.currencyValue.filter(subItem => {
            if (subItem.currencyLabel === item.currencyLabel) {
              baseCurrency.push({
                id: item.id,
                currencyStatus: item.currencyStatus,
                currencyLabel: subItem.currencyLabel,
                currencySymbol: subItem.currencySymbol,
                currencyName: subItem.currencyName
              });
            }
          });
        });
      }
      return baseCurrency;

    } catch (error) {
      throw error;
    }
  };

};
