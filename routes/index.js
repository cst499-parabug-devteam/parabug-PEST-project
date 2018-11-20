var express = require('express');
var router = express.Router();
var nodeMailer = require('nodemailer');
var bodyParser = require('body-parser');







/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express', api_key: process.env.GOOGLE_MAPS_API_KEY });
});


router.post('/', function(req, res, next) {
   var info = req.body;
   console.log(info);
});




module.exports = router;
