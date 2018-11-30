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


var html_template= fs.readFileSync(__dirname + '/templates/abc.html',{encoding:'utf-8'});

// var transporter = nodeMailer.createTransport({
//     host: 'smtp.gmail.com',
//     port: 465,
//     secure: true, // use SSL
//     auth: {
//         user: process.env.GMAIL_ACC,
//         pass: process.env.GMAIL_P
//     }
// });


//AUTH USING A SERVICE ACCCOUNT - SERVER TO SERVER


//Using OAuth Combined:


/* GET home page. */
router.get('/', function(req, res, next) {
      });
      
      
router.post('/', function(req, res, next) {



//configuring JWT Client:
let JWTClient = new google.auth.JWT(
    privateKey.client_email,
    null,
    privateKey.private_key,
    ['https://www.googleapis.com/auth/gmail.send']);
    
//authorize request:
JWTClient.authorize(function (err, tokens) {
 if (err) {
   console.log(err);
   return;
 } else {
   console.log("Successfully connected!");
   
   
   
   
   //create Transporter:
      var transporter = nodeMailer.createTransport({
        service: "gmail",
     auth: {
          type: "OAuth2",
          serviceClient: privateKey.client_id,
          privateKey: privateKey.private_key,
          accessToken : tokens.access_token,
          expires : tokens.expiry_date
     }
    });

    // Set up Mail:
        let mailOptions = {
          from: '"Parabug Automatic Test Email" <amazingmaxpayne@gmail.com>', // sender address
          to: req.body.contact_email, // list of receivers
          subject: "Parabug Estimate Request", // Subject line
          text: req.body.body, // plain text body
          html: html_template  // html body
      };
     
     //Send the Mail:
      transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
              return console.log(error);
          }
         res.redirect('back')
        console.log("Message Sent: "  + info.response);
          });
   
   
   
   
   
 }
});


});

module.exports = router;
