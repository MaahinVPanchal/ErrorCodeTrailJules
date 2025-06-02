// Copyright IBM Corp. 2014,2016. All Rights Reserved.
// Node module: loopback-example-ssl
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';

const path = require('path');
const fs = require('fs');

exports.privateKey = fs.readFileSync(path.join(__dirname, './private/192.168.1.22.key')).toString();
exports.certificate = fs.readFileSync(path.join(__dirname, './private/192.168.1.22.crt')).toString();