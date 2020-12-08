var express = require("express");
var router = express.Router();
var jsts = require("jsts");
var nodeMailer = require("nodemailer");
var bodyParser = require("body-parser");
var { google } = require("googleapis");
var OAuth2 = google.auth.OAuth2;
var fs = require("fs");
let privateKey = require("../private/fakeKey.json");
var path = require("path");
var ejs = require("ejs");
var XMLWriter = require("xml-writer");
var tmp = require("tmp");
const e = require("express");
const PdfPrinter = require("pdfmake");
var sanitize = require("sanitize-filename");

const BUFFER = 0.0000005;

/* GET home page. */
router.get("/", function (req, res, next) {
  res.render("index", {
    title: "Express",
    api_key: process.env.GOOGLE_MAPS_API_KEY
  });
});

router.post("/", function (req, res, next) {
  try {
    // Test Data (req.body)
    var info = req.body;
    var appArea = info["appArea"]["ApplicationArea"][0];
    appArea = jsonToJstsGeom(appArea);
    if (appArea == null) {
      res.send("App area was not simple");
      return;
    }

    var temp = info["appArea"]["Hazards"];
    var tempPoly;
    var hazards = [];
    for (var i = 0; i < temp.length; i++) {
      tempPoly = jsonToJstsGeom(temp[i][0]);
      if (tempPoly != null) {
        hazards.push(tempPoly);
      }
    }

    temp = info["appArea"]["VariableRateAreas"];
    var vras = [];
    for (i = 0; i < temp.length; i++) {
      tempPoly = jsonToJstsGeom(temp[i][0]);
      if (tempPoly != null) {
        vras.push(tempPoly);
      }
    }
    if (validateAndFix(appArea, hazards, vras)) {
      // Start email process
      email(info, function (response) {
        if (response.success) {
          res.json({ alertMessage: "Success" });
        } else {
          res.json({ alertMessage: "Fail" });
        }

        if (response.pdfPath) {
          fs.unlink(response.pdfPath, (err) => {
            if (err) {
              console.log("There was an error deleting the pdf file");
            } else {
              console.log(`${response.pdfPath} deleted successfully`);
            }
          });
        }
        if (response.kmlPath) {
          fs.unlink(response.kmlPath, (err) => {
            if (err) {
              console.log("There was an error deleting the kml file");
            } else {
              console.log(`${response.kmlPath} deleted successfully`);
            }
          });
        }
      });
    } else {
      res.json({ alertMessage: "invalid" });
    }
  } catch (e) {
    console.log(e);
    res.send("Error");
  }
});

/* 
  Checks bug info and returns a parsed, standardized object:
  result = {
    name: STRING or NULL,
    bpa: INT,
    vr: INT
  };
*/
function checkBug(name, bpa, vr, defaultName) {
  let result = {
    name: name,
    bpa: 0,
    vr: 0
  };

  try {
    // bpa (bugs per acre) determines whether or not that bug will be deployed
    if (bpa == null || bpa === "") {
      result.name = null;
    } else {
      // Parse values and set defaults as necessary
      if (name == null || name === "") {
        result.name = defaultName;
      }
      result.bpa = parseInt(bpa, 10);

      // Check if vr is set, if not defaults to bpa
      if (!(vr == null || vr === "")) {
        result.vr = parseInt(vr, 10);
      } else {
        result.vr = result.bpa;
      }
    }
  } catch (e) {
    // Error when parsing values
    console.log(e);
  }
  return result;
}

function deleteNonPolys(polyArr) {
  for (var i = polyArr.length - 1; i >= 0; i--) {
    if (numUniqueCoordinates(polyArr[i]) < 3) {
      polyArr.splice(i, 1);
    }
  }
  return polyArr;
}

function email(info, callback) {
  var email_files = path.join(__dirname, "..", "email_files");
  var return_msg = { success: false };
  let dateTime = new Date().toISOString().slice(0, 19).replace('T','_').replace(/:/g, '-');
  let fileNameBody = info["ranchName"] + "_" + info["contactName"] + "_" + dateTime;
  fileNameBody = sanitize(fileNameBody.replace(/\s+/g,'_').replace(/_{2,}/g, '_'));

  let pdfFileName = 'PDF_' + fileNameBody + '.pdf';
  let kmlFileName = 'KML_' + fileNameBody + '.kml';
  let pdfPath = path.join(email_files, pdfFileName);
  let kmlPath = path.join(email_files, kmlFileName);
  return_msg.pdfPath = pdfPath;
  return_msg.kmlPath = kmlPath;

  try {
    let kmlData = kml(info);
    fs.writeFile(kmlPath, kmlData, (kmlErr) => {
      if (kmlErr) {
        console.log("There was an issue creating the kml");
        callback(return_msg);
        return;
      }
      
      writePDFile(pdfPath, info, function (pdfData) {
        // Returns pdf data for email formatting
        if (pdfData == null) {
          // Error while writing to files, don't send email
          console.log("There was an issue creating the pdf");
          callback(return_msg);
        } else {
          // Atachments were created and written to, send the email
          //NO-REPLY@SENDMAIL.COM METHOD:
          var parabug_email_path = "info@parabug.solutions";

          //set up transporter - OAUTH
          var transporter = nodeMailer.createTransport({
            host: "smtp.gmail.com",
            port: 465,
            secure: true, // use SSL
            auth: {
              type: "OAuth2",
              user: privateKey.user,
              clientId: privateKey.c_id,
              clientSecret: privateKey.c_secret,
              refreshToken: privateKey.refreshToken,
              accessToken: privateKey.accessToken,
              expires: 1484314697598
            }
          });

          //setup second transporter:
          var parabugTransporter = nodeMailer.createTransport({
            host: "smtp.gmail.com",
            port: 465,
            secure: true, // use SSL
            auth: {
              type: "OAuth2",
              user: privateKey.user,
              clientId: privateKey.c_id,
              clientSecret: privateKey.c_secret,
              refreshToken: privateKey.refreshToken,
              accessToken: privateKey.accessToken,
              expires: 1484314697598
            }
          });

          let parabugMailOptions = {
            from:
              '"Requested Parabug Estimate Quote"' +
              "<" +
              parabug_email_path +
              ">", // sender address
            to: " <" + parabug_email_path + ">", // list of receivers
            subject: "Parabug Estimate Request", // Subject line
            text: info.notes, // plain text body
            html: pdfData,
            attachments: [{ filename: kmlFileName, path: kmlPath }, { filename: pdfFileName, path: pdfPath }]
          };

          let mailOptions = {
            from:
              '"Requested Parabug Estimate Quote"' +
              "<" +
              parabug_email_path +
              ">", // sender address
            to: " <" + info.contactEmail + ">", // list of receivers
            subject: "Parabug Estimate Request", // Subject line
            text: info.notes, // plain text body
            html: pdfData,
            attachments: [{ filename: pdfFileName, path: pdfPath }]
          };

          // ************************ For Local Testing (No Emailing) ************************
          // return_msg.success = true;
          // callback(return_msg);
          // transporter.close();
          // parabugTransporter.close();
          // return;
          // *********************************************************************************
          
          // Send user email
          transporter.sendMail(mailOptions, function (err, info) {
            if (err) {
              console.log(err);
              callback(return_msg);
            } else {
              console.log("User Message sent: " + info.response);
              // Send Parabug emal
              parabugTransporter.sendMail(parabugMailOptions, function (
                err,
                info
              ) {
                if (err) {
                  console.log(err);
                  callback(false);
                } else {
                  console.log("Parabug Message sent: " + info.response);
                  return_msg.success = true;
                  callback(return_msg);
                }
              });
            }
          });
          transporter.close();
          parabugTransporter.close();
        }
      });

    });

  } catch (e) {
    callback(return_msg);
  }
}

function getDifference(jstsPoly, jstsPolyRemove) {
  jstsPoly.normalize();
  jstsPolyRemove.normalize();

  var difference = jstsPoly.difference(jstsPolyRemove);
  var result = [];
  if (difference.getNumGeometries() == 1) {
    result.push(difference);
    return result;
  }
  for (var i = 0; i < difference.getNumGeometries(); i++) {
    result.push(difference.getGeometryN(i));
  }
  return result;
}

function jsonToJstsGeom(json) {
  var shell = [];
  var holes = [];
  var temp = json["shell"];
  var temp2;
  var gF = new jsts.geom.GeometryFactory();
  for (var i = 0; i < temp.length; i++) {
    shell.push(new jsts.geom.Coordinate(temp[i]["lat"], temp[i]["lng"]));
  }
  shell = gF.createLinearRing(shell);

  for (i = 0; i < json["holes"].length; i++) {
    temp = json["holes"][i];
    temp2 = [];
    for (var j = 0; j < temp.length; j++) {
      temp2.push(new jsts.geom.Coordinate(temp[j]["lat"], temp[j]["lng"]));
    }
    temp2 = gF.createLinearRing(temp2);
    temp.push(temp2);
  }
  var result = gF.createPolygon(shell, holes);
  // Get rid of self-intersections now
  if (!result.isSimple()) {
    return null;
  }
  return result;
}

function jstsCoordsToShellHoles(coords) {
  let shell = [];
  let holes = [];
  let shellComplete = false;

  for (let i = 0; i < coords.length; i++) {
    if (!shellComplete) {
      shell.push(coords[i]);
      if ((i != 0) && (coords[0].equals(coords[i]))) {
        shellComplete = true;
      }
    } else {
      holes.push(coords[i]);
    }
  }
  return { shell, holes };
}

function kml(info) {
  var appArea = info["appArea"]["ApplicationArea"][0]["shell"];
  var hazardArea = info["appArea"]["Hazards"];
  var vRAArea = info["appArea"]["VariableRateAreas"];

  // Multipliers control the change of rate
  // When going from the standard rate to variable rate
  let bug1Multiplier = 0;
  let bug2Multiplier = 0;

  try {
    let vr = parseInt(info["bugsPerAcre"]);
    let sr = parseInt(info["variableRate"]);
    if (vr > 0) {
      bug1Multiplier = sr / vr;
    }
    if (info["bugsPerAcre2"]) {
      vr = parseInt(info["bugsPerAcre2"]);
      sr = parseInt(info["variableRate2"]);
      if (vr > 0) {
        bug2Multiplier = sr / vr;
      }
    }
  } catch (e) {
    console.log("Error when setting multipliers");
    console.log(e);
  }


  if (info["bugName"] === "") {
    info["bugName"] = "Not Specified";
  }
  if (info["bugName2"] != null && info["bugName2"] === "") {
    info["bugName2"] = "Not Specified";
  }
  if (info["notes"] === "") {
    info["notes"] = "N/A";
  }
  var description = "";
  var i, j, temp;

  var kml = new XMLWriter(true);
  kml
    .startDocument()
    .startElement("kml")
    .writeAttribute("xmlns", "http://www.opengis.net/kml/2.2");
  kml.startElement("Document");

  // ------------------------------------------ App area ------------------------------------------
  kml.startElement("Placemark"); // 1. polygon start
  kml
    .startElement("name")
    // .writeCData("Application Area")
    .text("Application Area")
    .endElement();

  // Set Description
  description =
    "Application Area \n\t\t\t\t\t\tBug: " +
    info["bugName"] +
    ", " +
    info["bugsPerAcre"] +
    " per acre";
  if (info["bugName2"] != null) {
    description +=
      "\n\t\t\t\t\t\tBug2: " +
      info["bugName2"] +
      ", " +
      info["bugsPerAcre2"] +
      " per acre";
  }
  description +=
    "\n\t\t\t\t\t\tCrop: " +
    info["crop"] +
    " with row spacing of " +
    info["rowSpacing"] +
    "ft\n\t\t\t\t\t\tNotes:\n\t\t\t\t\t\t" +
    info["notes"];
  kml
    .startElement("description")
    // .writeCData(description)
    .text(description)
    .endElement();
  kml.writeElement("Multiplier", String(bug1Multiplier) + "," + String(bug2Multiplier));

  kml.startElement("Polygon"); // 2. polygon start
  kml.writeElement("extrude", "1");
  kml.writeElement("altitudeMode", "clampToGround");
  kml.startElement("outerBoundaryIs"); // 3. start 'hole' tag
  kml.startElement("LinearRing"); // 4. linear ring start
  kml.startElement("coordinates"); // 5. coordinate tag start

  // Shell array
  for (j = 0; j < appArea.length; j++) {
    kml.text(
      "\n\t\t\t\t\t\t\t" +
      JSON.stringify(appArea[j]["lng"]) +
      "," +
      JSON.stringify(appArea[j]["lat"]) +
      ",0"
    );
  }
  kml.text("\n\t\t\t\t\t\t");

  kml.endElement(); // 5. end coordinate tag
  kml.endElement(); // 4. end linear ring tag
  kml.endElement(); // 3, end 'hole' tag
  kml.endElement(); // 2, polygon end
  kml.startElement("Style"); // start style tag
  kml.startElement("PolyStyle"); // start polystyle tag
  kml.startElement("color"); // start color tag
  kml.text("#bb00ffff");
  kml.endElement(); // end color tag
  kml.startElement("outline"); // start outline tag
  kml.text("0");
  kml.endElement(); // end outline tag
  kml.endElement(); // end polystyle tag
  kml.endElement(); // end style tag
  kml.endElement(); // 1. polyon end
  // ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ App area ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

  // ----------------------------------------- Hazard area -----------------------------------------
  for (i = 0; i < hazardArea.length; i++) {
    kml.startElement("Placemark"); // 1. polygon start
    kml
      .startElement("name")
      // .writeCData("Hazard Area")
      .text("Hazard Area")
      .endElement();
    kml
      .startElement("description")
      // .writeCData("Hazard Area")
      .text("Hazard Area")
      .endElement();
    kml.startElement("Polygon"); // 2. polygon start
    kml.writeElement("extrude", "1");
    kml.writeElement("altitudeMode", "clampToGround");
    kml.startElement("outerBoundaryIs"); // 3. start 'hole' tag
    kml.startElement("LinearRing"); // 4. linear ring start
    kml.startElement("coordinates"); // 5. coordinate tag start

    temp = info["appArea"]["Hazards"][i][0]["shell"];
    for (j = 0; j < temp.length; j++) {
      kml.text(
        "\n\t\t\t\t\t\t\t" +
        JSON.stringify(temp[j]["lng"]) +
        "," +
        JSON.stringify(temp[j]["lat"]) +
        ",0"
      );
    }
    kml.text("\n\t\t\t\t\t\t");

    kml.endElement(); // 5. end coordinate tag
    kml.endElement(); // 4. end linear ring tag
    kml.endElement(); // 3. end 'hole' tag
    kml.endElement(); // 2. polygon end
    kml.startElement("Style"); // start style tag
    kml.startElement("PolyStyle"); // start polystyle tag
    kml.startElement("color"); // start color tag
    kml.text("990000cc");
    kml.endElement(); // end color tag
    kml.startElement("outline"); // start outline tag
    kml.text("0");
    kml.endElement(); // end outline tag
    kml.endElement(); // end polystyle tag
    kml.endElement(); // end style tag
    kml.endElement(); // 1. polyon end
  }
  // ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ Hazard area ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

  // ------------------------------------- Variable Rate Area -------------------------------------
  for (i = 0; i < vRAArea.length; i++) {
    kml.startElement("Placemark"); // 1. polygon start
    kml
      .startElement("name")
      // .writeCData("Variable Rate Area")
      .text("Variable Rate Area")
      .endElement();

    // Set Description
    description =
      "Variable Rate Area \n\t\t\t\t\t\tBug: " +
      info["bugName"] +
      ", " +
      info["variableRate"] +
      " per acre";
    if (info["bugName2"] != null) {
      description +=
        "\n\t\t\t\t\t\tBug2: " +
        info["bugName2"] +
        ", " +
        info["variableRate2"] +
        " per acre";
    }
    kml
      .startElement("description")
      // .writeCData(description)
      .text(description)
      .endElement();

    kml.startElement("Polygon"); // 2. polygon start
    kml.writeElement("extrude", "1");
    kml.writeElement("altitudeMode", "clampToGround");
    kml.startElement("outerBoundaryIs"); // 3. start 'hole' tag
    kml.startElement("LinearRing"); // 4. linear ring start
    kml.startElement("coordinates"); // 5. coordinate tag start

    temp = info["appArea"]["VariableRateAreas"][i][0]["shell"];
    for (j = 0; j < temp.length; j++) {
      kml.text(
        "\n\t\t\t\t\t\t\t" +
        JSON.stringify(temp[j]["lng"]) +
        "," +
        JSON.stringify(temp[j]["lat"]) +
        ",0"
      );
    }
    kml.text("\n\t\t\t\t\t\t");

    kml.endElement(); // 5. end coordinate tag
    kml.endElement(); // 4. end linear ring tag
    kml.endElement(); // 3. end 'hole' tag
    kml.endElement(); // 2. polygon end
    kml.startElement("Style"); // start style tag
    kml.startElement("PolyStyle"); // start polystyle tag
    kml.startElement("color"); // start color tag
    kml.text("bbA0A0A0");
    kml.endElement(); // end color tag
    kml.startElement("outline"); // start outline tag
    kml.text("0");
    kml.endElement(); // end outline tag
    kml.endElement(); // end polystyle tag
    kml.endElement(); // end style tag
    kml.endElement(); // 1. polyon end
  }
  // ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ Variable Rate Area ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

  kml.endElement();
  return kml.toString();
}

function numUniqueCoordinates(jstsPoly) {
  var coords = jstsPoly.getCoordinates();
  var unique = [];
  var newCoord;
  for (var i = 0; i < coords.length; i++) {
    newCoord = {
      lat: coords[i].x,
      lng: coords[i].y
    };
    if (unique.indexOf(newCoord) == -1) {
      unique.push(newCoord);
    }
  }
  return unique.length;
}

function round(value, decimals) {
  return Number(Math.round(value + "e" + decimals) + "e-" + decimals);
}

function savePDFDocument(data, path, callback) {
  let dd = {
    content: [],
    styles: {
      centerAlign: {alignment: 'center', margin: [0, 2, 0, 0]},
      tableHeader: {fontSize: 14, alignment: 'center', margin: [2, 5]}
    },
    images: {
      logo: require('path').join(__dirname, '..', 'public', 'img', 'logo-lrg.jpg'),
    }
  };
  dd.content.push({
    image: 'logo',
    width: 300,
    style: 'centerAlign'
  });
  dd.content.push({lineHeight: 1, text: ' '});
  dd.content.push('Contact Name: ' + data.contact_name);
  dd.content.push('Contact Email: ' + data.contact_email);
  dd.content.push('Contact Phone: ' + data.contact_phone);
  dd.content.push('Billing Address: ' + data.billing_address);
  dd.content.push({lineHeight: 1, text: ' '});
  dd.content.push('Crop: ' + data.crop);
  dd.content.push('Row Spacing: ' + data.row_spacing + ' ft');
  if (data.ranchName) {
    dd.content.push('Ranch: ' + data.ranchName);
  }
  if (data.applicationDate) {
    dd.content.push('Preferred Application Date: ' + data.applicationDate);
  }
  if (data.operator) {
    dd.content.push('Preferred Operator: ' + data.operator);
  }
  if (data.notes) {
    dd.content.push('Notes: ' + data.notes);
  }

  if (data.correctedAcreage) {
    dd.content.push({lineHeight: 1, text: ' '});
    let tableBody;
    if (data.bug2) {
      tableBody = [
        [ {text: 'Application Area (Corrected Acreage)', colSpan: 4, style: 'tableHeader'}, {}, {}, {}],
        [ 
          {text: 'Size (Acres - Manual)', style: 'centerAlign'},
          {text: data.bug1 +' (Per Acre)', style: 'centerAlign'},
          {text: data.bug2 +' (Per Acre)', style: 'centerAlign'},
          {text: 'Total Bugs', style: 'centerAlign'}
        ],
        [
          {text: data.correctedAcreage, style: 'centerAlign'},
          {text: data.standardBPA1, style: 'centerAlign'},
          {text: data.standardBPA2, style: 'centerAlign'},
          {text: data.sumBugsCorrected, style: 'centerAlign'}
        ]
      ];
    } else {
      tableBody = [
        [ {text: 'Application Area (Corrected Acreage)', colSpan: 3, style: 'tableHeader'}, {}, {}],
        [ 
          {text: 'Size (Acres - Manual)', style: 'centerAlign'},
          {text: data.bug1 +' (Per Acre)', style: 'centerAlign'},
          {text: 'Total Bugs', style: 'centerAlign'}
        ],
        [
          {text: data.correctedAcreage, style: 'centerAlign'},
          {text: data.standardBPA1, style: 'centerAlign'},
          {text: data.sumBugsCorrected, style: 'centerAlign'}
        ]
      ];
    }
    dd.content.push(
      {
        table: {
          headerRows: 2,
          heights: [20, 20, 20],
          body: tableBody
        }
      }
    );
  }

  dd.content.push({lineHeight: 1, text: ' '});
  let tableBody;
  if (data.bug2) {
    tableBody = [
      [ {text: 'Application Area (Raw Map Data)', colSpan: 5, style: 'tableHeader'}, {}, {}, {}, {}],
      [ 
        {text: '', style: 'centerAlign'}, 
        {text: 'Size (Acres)', style: 'centerAlign'},
        {text: data.bug1 +' (Per Acre)', style: 'centerAlign'},
        {text: data.bug2 +' (Per Acre)', style: 'centerAlign'},
        {text: 'Total Bugs', style: 'centerAlign'}
      ],
      [
        {text: 'Standard Rate Area', style: 'centerAlign'},
        {text: data.standardAcres, style: 'centerAlign'},
        {text: data.standardBPA1, style: 'centerAlign'},
        {text: data.standardBPA2, style: 'centerAlign'},
        {text: data.standardBugs, style: 'centerAlign'}
      ],
      [
        {text: 'Variable Rate Area', style: 'centerAlign'},
        {text: data.vraAcres, style: 'centerAlign'},
        {text: data.vraBPA1, style: 'centerAlign'},
        {text: data.vraBPA2, style: 'centerAlign'},
        {text: data.vraBug, style: 'centerAlign'}
      ],
      [
        {text: 'Hazard Area', style: 'centerAlign'},
        {text: data.hazardAcres, style: 'centerAlign'},
        {text: '-', style: 'centerAlign'},
        {text: '-', style: 'centerAlign'},
        {text: '-', style: 'centerAlign'},
      ],
      [
        {text: 'Sum (Non-hazard)', style: 'centerAlign'},
        {text: data.deployableAcres, style: 'centerAlign'},
        {text: '-', style: 'centerAlign'},
        {text: '-', style: 'centerAlign'},
        {text: data.sumBugs, style: 'centerAlign'},
      ]
    ];
  } else {
    tableBody = [
      [ {text: 'Application Area (Raw Map Data)', colSpan: 4, style: 'tableHeader'}, {}, {}, {}],
      [ 
        {text: '', style: 'centerAlign'}, 
        {text: 'Size (Acres)', style: 'centerAlign'},
        {text: data.bug1 +' (Per Acre)', style: 'centerAlign'},
        {text: 'Total Bugs', style: 'centerAlign'}
      ],
      [
        {text: 'Standard Rate Area', style: 'centerAlign'},
        {text: data.standardAcres, style: 'centerAlign'},
        {text: data.standardBPA1, style: 'centerAlign'},
        {text: data.standardBugs, style: 'centerAlign'}
      ],
      [
        {text: 'Variable Rate Area', style: 'centerAlign'},
        {text: data.vraAcres, style: 'centerAlign'},
        {text: data.vraBPA1, style: 'centerAlign'},
        {text: data.vraBug, style: 'centerAlign'}
      ],
      [
        {text: 'Hazard Area', style: 'centerAlign'},
        {text: data.hazardAcres, style: 'centerAlign'},
        {text: '-', style: 'centerAlign'},
        {text: '-', style: 'centerAlign'},
      ],
      [
        {text: 'Sum (Non-hazard)', style: 'centerAlign'},
        {text: data.deployableAcres, style: 'centerAlign'},
        {text: '-', style: 'centerAlign'},
        {text: data.sumBugs, style: 'centerAlign'},
      ]
    ];
  }

  dd.content.push(
    {
      table: {
        headerRows: 2,
        heights: [20, 20, 20, 20, 20, 20],
        body: tableBody
      }
    }
  );

  dd.content.push({lineHeight: 1, text: ' '});
  dd.content.push('Created: ' + new Date());

  const doc = new PdfPrinter({
    Roboto: {normal: Buffer.from(require('pdfmake/build/vfs_fonts.js').pdfMake.vfs['Roboto-Regular.ttf'], 'base64')}
  }).createPdfKitDocument(dd);

  const writeStream = fs.createWriteStream(path);
  doc.pipe(writeStream);
  doc.end();
  writeStream.on('finish', function () {
      callback({success: true});
  });
  writeStream.on('error', function () {
      callback({success: false});
  });
}

function simplifyHazards(hazards) {
  let gF = new jsts.geom.GeometryFactory();

  // Simplify Hazard Areas
  let newHazards = [];
  for (let i = 0; i < hazards.length; i++) {
    let hazard = hazards[i];
    if (hazard) {
      let hazardCoords = jstsCoordsToShellHoles(hazard.getCoordinates());
      for (let j = 1; j < hazardCoords.shell.length - 1; j++) {
        let shellWithPoint = hazardCoords.shell.slice();
        let shellWithoutPoint = shellWithPoint.slice();
        shellWithoutPoint.splice(j, 1);
        if (shellWithPoint.length > 2 && shellWithoutPoint.length > 2) {
          let polygonWithPoint = gF.createPolygon(gF.createLinearRing(shellWithPoint), gF.createLinearRing(hazardCoords.holes));
          let polygonWithoutPoint = gF.createPolygon(gF.createLinearRing(shellWithoutPoint), gF.createLinearRing(hazardCoords.holes));
          let polygonWithPointBuffered = polygonWithPoint.buffer(BUFFER, 1, jsts.operation.buffer.BufferParameters.CAP_SQUARE);
          let polygonWithoutPointBuffered = polygonWithoutPoint.buffer(BUFFER, 1, jsts.operation.buffer.BufferParameters.CAP_SQUARE);
          if (polygonWithPointBuffered.covers(polygonWithoutPoint) && polygonWithoutPointBuffered.covers(polygonWithPoint)) {
            hazardCoords.shell = shellWithoutPoint.slice();
          }
        }
      }
      newHazards.push([].concat(hazardCoords.shell).concat(hazardCoords.holes));
    }
  }
  return newHazards;
}

function simplifyVariableRateAreas(vras) {
  let gF = new jsts.geom.GeometryFactory();

  // Simplify Hazard Areas
  let newVras = [];
  for (let i = 0; i < newVras.length; i++) {
    let vra = vras[i];
    if (vra) {
      let vraCoords = jstsCoordsToShellHoles(vra.getCoordinates());
      for (let j = 1; j < vraCoords.shell.length - 1; j++) {
        let shellWithPoint = vraCoords.shell.slice();
        let shellWithoutPoint = shellWithPoint.slice();
        shellWithoutPoint.splice(j, 1);
        if (shellWithPoint.length > 2 && shellWithoutPoint.length > 2) {
          let polygonWithPoint = gF.createPolygon(gF.createLinearRing(shellWithPoint), gF.createLinearRing(vraCoords.holes));
          let polygonWithoutPoint = gF.createPolygon(gF.createLinearRing(shellWithoutPoint), gF.createLinearRing(vraCoords.holes));
          let polygonWithPointBuffered = polygonWithPoint.buffer(BUFFER, 1, jsts.operation.buffer.BufferParameters.CAP_SQUARE);
          let polygonWithoutPointBuffered = polygonWithoutPoint.buffer(BUFFER, 1, jsts.operation.buffer.BufferParameters.CAP_SQUARE);
          if (polygonWithPointBuffered.covers(polygonWithoutPoint) && polygonWithoutPointBuffered.covers(polygonWithPoint)) {
            vraCoords.shell = shellWithoutPoint.slice();
          }
        }
      }
      newVras.push([].concat(vraCoords.shell).concat(vraCoords.holes));
    }
  }
  return newVras;
}

function trimPolyArray(polyArr, outerPoly, removePolyArr = null) {
  var result;
  for (var i = 0; i < polyArr.length; i++) {
    result = trimPolygon(polyArr[i], outerPoly);
    if (result != null) {
      polyArr.splice(i, 1);
      // Push each new geometry separately
      for (var j = 0; j < result.length; j++) {
        polyArr.push(result[j]);
      }
    }
  }
  if (removePolyArr == null) {
    return polyArr;
  }

  var polyKeep, polyRemove;
  var numKeeps = polyArr.length;
  for (i = 0; i < removePolyArr.length; i++) {
    polyRemove = removePolyArr[i];
    for (var j = 0; j < numKeeps; j++) {
      polyKeep = polyArr[j];
      result = getDifference(polyKeep, polyRemove);
      for (var k = 0; k < result.length; k++) {
        if (k == 0) {
          polyArr[j] = result[k];
        } // Just set first value, insead of removing old
        else {
          polyArr.push(result[k]);
        }
      }
      numKeeps = polyArr.length;
    }
  }
  return polyArr;
}

function trimPolygon(jstsInner, jstsOuter) {
  jstsInner.normalize();
  jstsOuter.normalize();
  if (!jstsInner.intersects(jstsOuter)) {
    return null;
  }
  var intersection = jstsInner.intersection(jstsOuter);

  var result = [];
  if (intersection.getNumGeometries() == 1) {
    result.push(intersection);
    return result;
  }
  for (var i = 0; i < intersection.getNumGeometries(); i++) {
    result.push(intersection.getGeometryN(i));
  }
  return result;
}

function unionPolyArray(polyArr) {
  if (polyArr.length <= 1) {
    return true;
  }

  // Setup variables
  var i = 0;
  var numPolys = polyArr.length;
  var temp1, temp2, result;
  var unionOccured = false;

  while (i < numPolys) {
    // Reset bool which indicates if a union was found
    unionOccured = false;

    // Get first polygon to compare with rest for union
    temp1 = polyArr[i];

    // Loop through polygons and compare
    for (var j = 0; j < numPolys; j++) {
      // If not the same hazard
      if (j != i) {
        // Get the other polygon and find the union of the two
        temp2 = polyArr[j];
        result = unionPolygons(temp1, temp2);

        // Check if the two polygons were actually unioned (they interesected and a new path was made)
        if (result.unioned == 1) {
          // Remove the original polygon at index i
          polyArr.splice(i, 1);

          // Remove the original polygon at index j
          // But adjust for shift from deletion of i
          if (i < j) {
            polyArr.splice(i - 1, 1);
          } else {
            polyArr.splice(i, 1);
          }

          // Add new unioned polygon
          polyArr.push(result.polygon);

          // Set bool to true to indicate a union has occured
          unionOccured = true;

          // Adjust numPolys to reflect new additions and deletions
          numPolys = polyArr.length;
          break;
        }
      }
    }

    // Increment poly index to check
    i++;

    // Indexes have shifted and new paths were added, restart loop
    if (unionOccured) {
      i = 0;
    }

    // Return now if only 1 polygon is left, not necessary but decreases time by one loop
    if (numPolys <= 1) {
      return polyArr;
    }
  }
  return polyArr;
}

function unionPolygons(jstsPoly1, jstsPoly2) {
  jstsPoly1.normalize();
  jstsPoly2.normalize();
  if (!jstsPoly1.intersects(jstsPoly2) || jstsPoly1.touches(jstsPoly2)) {
    return { unioned: 0 };
  }
  var unioned = jstsPoly1.union(jstsPoly2);
  return {
    polyon: unioned,
    unioned: 1
  };
}

function validateAndFix(appArea, hazards, vras) {
  try {
    if (appArea == null || appArea === []) {
      return false;
    }
    if (numUniqueCoordinates(appArea) < 3) {
      return false;
    }
    var newHazards = deleteNonPolys(hazards);
    var newVras = deleteNonPolys(vras);
    newHazards = unionPolyArray(newHazards);
    newVras = unionPolyArray(newVras);
    newHazards = trimPolyArray(newHazards, appArea);
    newVras = trimPolyArray(newVras, appArea, newHazards);
    newHazards = simplifyHazards(newHazards);
    newVras = simplifyVariableRateAreas(newVras);

    // All the values at this point should be valid
    return true;
  } catch (e) {
    console.log("Error during validation:");
    console.log(e);
    return false;
  }
}

// Returns null if fail or pdfData (ejs render from template)
function writePDFile(path, info, callback) {
  var email_template = require("path").join(
    __dirname,
    "..",
    "public",
    "test_files",
    "email_template.ejs"
  );
  // Path.join is not working without module reference here for some reason

  // Parse Numbers
  info["appAcres"] = parseFloat(info["appAcres"], 10);
  info["hazardAcres"] = parseFloat(info["hazardAcres"], 10);
  info["vraAcres"] = parseFloat(info["vraAcres"], 10);

  // Check values, on per bug basis
  let bug1 = checkBug(
    info.bugName,
    info.bugsPerAcre,
    info.variableRate,
    "bug1"
  );
  let bug2 = checkBug(
    info.bugName2,
    info.bugsPerAcre2,
    info.variableRate2,
    "bug2"
  );

  var standardAcres = info["appAcres"] - info["hazardAcres"] - info["vraAcres"];
  var standardBugs = (bug1.bpa + bug2.bpa) * standardAcres;
  var vraBugs = (bug1.vr + bug2.vr) * info.vraAcres;
  var sumBugs = standardBugs + vraBugs;

  var deployableAcres = info["appAcres"] - info["hazardAcres"];

  var data = {
    contact_name: info.contactName,
    contact_email: info.contactEmail,
    contact_phone: info.contactPhone,
    crop: info.crop,
    billing_address: info.billingAddress,
    notes: info.notes,
    row_spacing: info.rowSpacing,
    bug1: bug1.name,
    bug2: bug2.name,
    standardAcres: round(standardAcres, 3),
    standardBPA1: bug1.bpa,
    standardBPA2: bug2.bpa,
    standardBugs: round(standardBugs, 0),
    vraAcres: round(info.vraAcres, 3),
    vraBPA1: bug1.vr,
    vraBPA2: bug2.vr,
    vraBugs: round(vraBugs, 0),
    hazardAcres: round(info.hazardAcres, 3),
    appAcres: round(info.appAcres, 3),
    deployableAcres: round(deployableAcres, 3),
    sumBugs: round(sumBugs, 0),

    ranchName: info.ranchName,
    applicationDate: info.applicationDate,
    operator: info.operator,
    correctedAcreage: info.correctedAcreage
  };

  // Check if corrected acreage was supplied, if so provide additional bug estaimate
  if (info.correctedAcreage != null) {
    let correctedAcreage = parseFloat(info.correctedAcreage);
    let sumBugsCorrected = correctedAcreage * (bug1.bpa + bug2.bpa);
    data.sumBugsCorrected = round(sumBugsCorrected, 0);
  }

  ejs.renderFile(email_template, data, function (err, pdfData) {
    if (err) {
      console.log(err);
      callback(null);
    } else {
      try {
        savePDFDocument(data, path, (result) => {
          if (result.success) {
            callback(pdfData);
          } else {
            callback(null);
          }
        });
      } catch (e) {
        console.log(e);
        callback(null);
      }
    }
  });
}

module.exports = router;
