var express = require('express');
var router = express.Router();
var nodeMailer = require('nodemailer');
var bodyParser = require('body-parser');
var { google } = require('googleapis');
var OAuth2 = google.auth.OAuth2;
var bodyParser = require('body-parser');
var fs = require('fs');
let privateKey = require('../private/fakeKey.json');



//oauth2 information for access:
// var oauth2Client = new OAuth2(
//      process.env.GMAIL_CLIENT_ID, // ClientID
//      process.env.GMAIL_CLIENT_SECRET, // Client Secret
//      "https://developers.google.com/oauthplayground" // Redirect URL
// );

//receive access token for gmail access:
// oauth2Client.setCredentials({
//      refresh_token: process.env.REFRESH_TOKEN
// });

// const tokens =  oauth2Client.refreshAccessToken()
// const accessToken = tokens.access_token;

//setup transport module:

    
/*
LESS - SECURE METHOD FOR SMTP TRANSPORTER:
*/



//AUTH USING A SERVICE ACCCOUNT - SERVER TO SERVER


//Using OAuth Combined:


/* GET home page. */
router.get('/', function(req, res, next) {
      });
      
      
router.post('/', function(req, res, next) {

});

module.exports = router;
