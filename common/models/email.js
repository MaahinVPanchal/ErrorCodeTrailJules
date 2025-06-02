"use strict";

var app = require("../../server/server");
var entities = require("html-entities").AllHtmlEntities;
var nodemailer = require("nodemailer");

module.exports = function (Email) {
  // create transporter for nodemailer : Parth dt_16-04-2021
  var transporter = nodemailer.createTransport({
    type: "smtp",
    // name: "bizon365.com",
    host: "smtp.gmail.com",
    // secure: false,
    // port: 587,
    // secure: true, // working with both secure: true & secure: false
    port: 465,
    // pool: true,
    tls: {
      rejectUnauthorized: false,
    },
    auth: {
      user: "maahinpanchal@gmail.com",
      pass: "rlnhldyatgvepvqk",
    },
  });

  // create transporter for nodemailer : Parth dt_16-04-2021
  var transporter = nodemailer.createTransport({
    type: "smtp",
    // name: "bizon365.com",
    host: "smtp.gmail.com",
    // secure: false,
    // port: 587,
    // secure: true, // working with both secure: true & secure: false
    port: 465,
    // pool: true,
    tls: {
      rejectUnauthorized: false,
    },
    auth: {
      user: "maahinpanchal@gmail.com",
      pass: "rlnhldyatgvepvqk",
    },
  });

  // send an email
  Email.sendEmail = function (params, cb) {
    var mailOptions = {
      from:
        app.get("serverConfig").emailSenderName + " maahinpanchal@gmail.com",
      to: "maahin.panchal@sufalamtech.com",
      subject: params.subject,
      html: params.messageContent,
      attachments: params.attachment,
    };

    // console.log('Email params ::');
    // console.log(params);
    // if (app.get('isProduction')) {
    transporter.sendMail(mailOptions, function (error, info) {
      if (error) {
        console.log("Email Error :: " + error);
      } else {
        console.log("Email sent: " + info.response);
      }
    });
    // }
  };
};
