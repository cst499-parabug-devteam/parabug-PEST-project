var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var bodyParser = require('body-parser');
var indexRouter = require('./routes/index');
var nodeMailer = require('nodemailer')
var app = express();
var { google } = require('googleapis');
var OAuth2 = google.auth.OAuth2;

var favicon = require('serve-favicon');


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

var tokenList =  await oauth2Client.refreshAccessToken();
var accessToken = tokenList.credentials.access_token;




// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

//use bodyParser JSON
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use(favicon(path.join(__dirname,'public','img','favicon.jpg')));

app.use('/', indexRouter);

//var port:
var port = 3030;

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

//setUp mailing service:
app.post('/send-email', function (req, res) {
    var transporter = nodeMailer.createTransport("SMTP",{
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
          console.log('Message %s sent: %s', info.messageId, info.response);
              res.render('index');
          });
          
      });
          app.listen(port, function(){
            console.log('Server is running at port: ',port);
          });
          
        

module.exports = app;
