var express = require('express');
const fileUpload = require('express-fileupload');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var indexRouter = require('./routes/index');
var app = express();

var favicon = require('serve-favicon');


// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(fileUpload({
  createParentPath: true,
  abortOnLimit: true,
  limits: { fileSize: 10 * 1024 * 1024 }
}));
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use('/vendor/jsts', express.static(path.join(__dirname, 'node_modules', 'jsts', 'dist')));
app.use('/vendor/terra-draw', express.static(path.join(__dirname, 'node_modules', 'terra-draw', 'dist')));
app.use('/vendor/terra-draw-google-maps-adapter', express.static(path.join(__dirname, 'node_modules', 'terra-draw-google-maps-adapter', 'dist')));
app.use(express.static(path.join(__dirname, 'public')));

app.use(favicon(path.join(__dirname, 'public', 'img', 'favicon.jpg')));
app.use('/', indexRouter);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
