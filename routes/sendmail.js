var express = require('express');
var router = express.Router();
var nodeMailer = require('nodemailer');
var bodyParser = require('body-parser');
var { google } = require('googleapis');
var OAuth2 = google.auth.OAuth2;
var bodyParser = require('body-parser');


//oauth2 information for access:
var oauth2Client = new OAuth2(
     process.env.GMAIL_CLIENT_ID, // ClientID
     process.env.GMAIL_CLIENT_SECRET, // Client Secret
     "https://developers.google.com/oauthplayground" // Redirect URL
);

//receive access token for gmail access:
oauth2Client.setCredentials({
     refresh_token: process.env.REFRESH_TOKEN
});

const tokens =  oauth2Client.refreshAccessToken()
const accessToken = tokens.access_token;

//setup transport module:
    var transporter = nodeMailer.createTransport({
        service: "gmail",
     auth: {
          type: "OAuth2",
          user: "chrisumartinez@gmail.com", 
          clientId: process.env.GMAIL_CLIENT_ID,
          clientSecret: process.env.GMAIL_CLIENT_SECRET,
          refreshToken: process.env.REFRESH_TOKEN,
          accessToken: accessToken
     }
    });
    
//make sure transporter is verified and functioning
transporter.verify(function (error, success) {
    if (error) {
        console.log(error);
    } else {
        console.log('Server is ready to take our messages');
    }
});

/* GET home page. */
router.get('/', function(req, res, next) {
    //       let mailOptions = {
    //       from: '"Parabug Automatic Test Email" <chrisumartinez@gmail.com>', // sender address
    //       to: req.body.to, // list of receivers
    //       subject: req.body.subject, // Subject line
    //       text: req.body.body, // plain text body
    //       html: '<b>NodeJS Email Tutorial</b>' // html body
    //   };
     
    //   transporter.sendMail(mailOptions, (error, info) => {
    //       if (error) {
    //           return console.log(error);
    //       }
    //     console.log("Message Sent: "  + info.response);
    //       });
      });
      
      
router.post('/', function(req, res, next) {
            let mailOptions = {
          from: '"Parabug Automatic Test Email" <chrisumartinez@gmail.com>', // sender address
          to: req.body.to, // list of receivers
          subject: req.body.subject, // Subject line
          text: req.body.body, // plain text body
          html: '<b>NodeJS Email Tutorial</b>' // html body
      };
     
      transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
              return console.log(error);
          }
        console.log("Message Sent: "  + info.response);
          });
   var info = req.body;
   console.log(info);
});

module.exports = router;
