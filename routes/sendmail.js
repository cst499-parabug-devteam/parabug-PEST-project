var express = require('express');
var router = express.Router();
var nodeMailer = require('nodemailer');
var bodyParser = require('body-parser');
var { google } = require('googleapis');
var OAuth2 = google.auth.OAuth2;
var bodyParser = require('body-parser');
var fs = require('fs');
let privateKey = require('../private/fakeKey.json');
var path = require('path');

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

var p = path.join(__dirname,'..','public','test_files','email_template.ejs');
// var html_template= fs.readFileSync('../public/test_files/email_template.html',{encoding:'utf-8'});
var html_template= fs.readFile(p,{encoding:'utf-8'});


//AUTH USING A SERVICE ACCCOUNT - SERVER TO SERVER


//Using OAuth Combined:


/* GET home page. */
router.get('/', function(req, res, next) {
      });
      
      
router.post('/', function(req, res, next) {

            let mailOptions = {
          from: '"Parabug Automatic Test Email" <amazingmaxpayne@gmail.com>', // sender address
          to: req.body.contact_email, // list of receivers
          subject: "Parabug Estimate Request", // Subject line
          text: req.body.body, // plain text body
          html: html_template,  // html body
          attachments :
          [
              {
                  filename: 'test_attachment.txt',
                  path: '/parabug-PEST-project/public/test_files/test_attachment.txt'
              }
        ]
      };
     
      transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
              return console.log(error);
          }
         res.redirect('back')
        console.log("Message Sent: "  + info.response);
          });
   var info = req.body;
   console.log(info);

});

module.exports = router;
