var express = require('express');
var router = express.Router();
var jsts = require('jsts');
var nodeMailer = require('nodemailer');
var bodyParser = require('body-parser');
var { google } = require('googleapis');
var OAuth2 = google.auth.OAuth2;
var bodyParser = require('body-parser');
var fs = require('fs');
let privateKey = require('../private/fakeKey.json');
let pk = require('../private/private.json');
var path = require('path');
var pdf = require('html-pdf');
var ejs = require('ejs');
var XMLWriter = require('xml-writer');
var ws = require('fs');

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express', api_key: process.env.GOOGLE_MAPS_API_KEY });
});


// DATA FORMAT
/*
var data = {
    "appArea",
        "ApplicationArea",
            [{
                "shell": [{lat,lng}], <- take first shell (should only have 1)
                "holes": [ [{lat,lng}] ]
            }]
        "Hazards",
            [
                [{
                    "shell",
                    "holes"
                }]
            ]
        "VariableRateAreas"
            [
                [{
                    "shell",
                    "holes"
                }]
            ]
    "acres",
    "bugsPerAcre",
    "variableRate",
    "numBugs",
    "contactName",
    "contactPhone",
    "contactEmail",
    "billingAdress",
    "crop",
    "rowSpacing",
    "notes"
};
*/

router.post('/', function(req, res, next) {
    try {
        // Test Data (req.body)
        // var info = {"appArea":{
        //                 "ApplicationArea":[{"shell":[{"lat":36.688622136096754,"lng":-121.73602835452942},{"lat":36.689413644137105,"lng":-121.71259657657532},{"lat":36.67413265833216,"lng":-121.7075325659552},{"lat":36.67182648020323,"lng":-121.7430664709845},
        //                     {"lat":36.688622136096754,"lng":-121.73602835452942}],"holes":[]}],
        //                 "Hazards":[
        //                     [ {"shell":[{"lat":36.67977733998844,"lng":-121.73469797885804},{"lat":36.68643819838118,"lng":-121.73694352021693},{"lat":36.6835672733297,"lng":-121.73814656372855},{"lat":36.67977733998844,"lng":-121.73469797885804}],"holes":[]} ],
        //                     [ {"shell":[{"lat":36.6850086263356,"lng":-121.72984854495911},{"lat":36.68881517774766,"lng":-121.73031355585488},{"lat":36.688665605696116,"lng":-121.7347414819418},{"lat":36.6850086263356,"lng":-121.72984854495911}],"holes":[]} ]
        //                 ],
        //                 "VariableRateAreas":[
        //                     [{"shell":[{"lat":36.67877922520428,"lng":-121.72590033328919},{"lat":36.681670280731396,"lng":-121.72594324863343},{"lat":36.68170469740463,"lng":-121.72800318515687},{"lat":36.67888247905837,"lng":-121.72813193118958},
        //                     {"lat":36.67877922520428,"lng":-121.72590033328919}],"holes":[]}]]
        //             },
        //             "acres":"228.33","bugsPerAcre":"10000","variableRate":"100","numBugs":"2283300","contactName":"Chris Willials",
        //             "contactPhone":"(831)123-4567","contactEmail":"chris@yahoo.com","billingAdress":"123 Big Road","crop":"Corn","rowSpacing":"5"};
        var info = req.body;
        var appArea = info["appArea"]["ApplicationArea"][0];
        appArea = jsonToJstsGeom(appArea);
        if(appArea==null) {
            res.send("App area was not simple");
            return;
        }
        
        var temp = info["appArea"]["Hazards"];
        var tempPoly;
        var hazards = [];
        for(var i = 0; i < temp.length; i++) { 
            tempPoly = jsonToJstsGeom(temp[i][0]);
            if(tempPoly != null) {
                hazards.push(tempPoly); 
            }
        }
        
        temp = info["appArea"]["VariableRateAreas"];
        var vras = [];
        for(i = 0; i < temp.length; i++) { 
            tempPoly = jsonToJstsGeom(temp[i][0]);
            if(tempPoly != null) {
                vras.push(tempPoly); 
            }
        }
        
        if(validateAndFix(appArea, hazards, vras)) {
            res.send("Valid");
            var txt = kml(info); 
            fileCreate(txt); 
            sendMail(info);
        } else {
            res.send("Invalid");
        }
        
    } catch (e) {
        console.log(e);
        res.send("Error");
    }
});


function sendMail(info){
    

    
    //Mails and Paths:
    var noreply_email = "no-reply@parabug.xyz";
    var email_path = path.join(__dirname,'..','public','test_files','email_template.ejs');
    var parabug_email_path = "parabug.xyz@gmail.com";
    var kml_path = path.join(__dirname,  '..', "KMLMap.kml");
    
    
    //set up transporter - OAUTH
    var transporter = nodeMailer.createTransport({
    host: 'smtp.gmail.com',
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
    host: 'smtp.gmail.com',
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

    console.log(info);
    ejs.renderFile(email_path, {  contact_name: info.contactName, contact_email: info.contactEmail, contact_phone: info.contactPhone, crop: info.crop,
        billing_address: info.billingAddress, notes: info.notes, row_spacing: info.rowSpacing
    }, function (err, data) {
if (err) {
    console.log(err);
} else {
    
        var htmlPDFPath = path.join(__dirname, "..", "public", "test_files", 'clientQuote.pdf');
        pdf.create(data).toFile(htmlPDFPath, function(err, res) {
        if (err) return console.log(err);
        console.log(res);
        });
    
    
        let parabugMailOptions = {
          from: '"Requested Parabug Estimate Quote"' + "<" + parabug_email_path + ">", // sender address
          to: " <" + parabug_email_path + ">", // list of receivers
          subject: "Parabug Estimate Request for: " + info.contactEmail, // Subject line
          text: info.notes, // plain text body
          html: data,
          attachments: [
              {
                  path: kml_path
              },
              {
                  path: htmlPDFPath
              }
              ]
      };
    
    
        let mailOptions = {
          from: '"Requested Parabug Estimate Quote"' + "<" + parabug_email_path + ">", // sender address
          to: " <" + info.contactEmail + ">", // list of receivers
          subject: "Parabug Estimate Request", // Subject line
          text: info.notes, // plain text body
          html: data,
          attachments: [
              {
                  path: htmlPDFPath
              }
              ]
      };
    transporter.sendMail(mailOptions, function (err, info) {
        if (err) {
            console.log(err);
        } else {
            console.log('Message sent: ' + info.response);
            parabugTransporter.sendMail(parabugMailOptions, function (err, info){
                if (err){
                    console.log(err);
                } else {
                    console.log('Parabug Message Sent: ' + info.response);
                }
            })
        }
    });
}

});
 
    transporter.close();
    parabugTransporter.close();
    
    
    //OAUTH METHOD:
    
    
    
    //Set up Transporter:
//     var  serviceTransporter = nodeMailer.createTransport({
//     host: 'smtp.gmail.com',
//     port: 465,
//     secure: true,
//     auth: {
//       type: 'OAuth2',
//       user: privateAcc.client_email,
//       serviceClient: privateAcc.client_id,
//       privateKey: privateAcc.private_key
//   }
// });

    //

    
    
    
    
    
}

function numUniqueCoordinates(jstsPoly) {
    var coords = jstsPoly.getCoordinates();
    var unique = [];
    var newCoord;
    for(var i = 0; i < coords.length; i++) {
        newCoord = {
          'lat':coords[i].x,
          'lng':coords[i].y
        };
        if(unique.indexOf(newCoord) == -1) {
            unique.push(newCoord);
        }
    }
    return unique.length;
}

function deleteNonPolys(polyArr) {
    for(var i = polyArr.length-1; i >= 0; i--) {
        if(numUniqueCoordinates(polyArr[i]) < 3) {
            polyArr.splice(i,1);
        }
    }
    return polyArr;
}

function getDifference(jstsPoly, jstsPolyRemove) {
    jstsPoly.normalize();
    jstsPolyRemove.normalize();
    
    var difference = jstsPoly.difference(jstsPolyRemove);
    var result = [];
    if(difference.getNumGeometries() == 1) {
        result.push(difference);
        return result;
    }
    for(var i = 0; i < difference.getNumGeometries(); i++) {
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
    for(var i = 0; i < temp.length; i++) {
        shell.push( new jsts.geom.Coordinate(temp[i]["lat"], temp[i]["lng"]) );
    }
    shell = gF.createLinearRing(shell);
    
    for(i = 0; i < json["holes"].length; i++) {
        temp = json["holes"][i];
        temp2 = [];
        for(var j = 0; j < temp.length; j++) {
            temp2.push( new jsts.geom.Coordinate(temp[j]["lat"], temp[j]["lng"]) );
        }
        temp2 = gF.createLinearRing(temp2);
        temp.push(temp2);
    }
    var result = gF.createPolygon(shell, holes);
    // Get rid of self-intersections now
    if(!result.isSimple()) {return null;} 
    return result;
}

function trimPolygon(jstsInner, jstsOuter) {
    jstsInner.normalize();
    jstsOuter.normalize();
    if(!jstsInner.intersects(jstsOuter)) {return null;}
    var intersection = jstsInner.intersection(jstsOuter);
    
    var result = [];
    if(intersection.getNumGeometries() == 1) {
        result.push(intersection);
        return result;
    }
    for(var i = 0; i < intersection.getNumGeometries(); i++) {
        result.push(intersection.getGeometryN(i));
    }
    return result;
}

function trimPolyArray(polyArr, outerPoly, removePolyArr=null) {
    var result;
    for(var i = 0; i < polyArr.length; i++) {
        result = trimPolygon(polyArr[i],outerPoly);
        if(result!=null) {
            polyArr.splice(i,1);
            // Push each new geometry separately
            for(var j = 0; j < result.length; j++) {
                polyArr.push(result[j]);
            }
        }
    }
    if(removePolyArr==null) {return polyArr;}
    
    var polyKeep, polyRemove;
    var numKeeps = polyArr.length;
    for(i = 0; i < removePolyArr.length; i++) {
        polyRemove = removePolyArr[i];
        for(var j = 0; j < numKeeps; j++) {
            polyKeep = polyArr[j];
            result = getDifference(polyKeep,polyRemove);
            for(var k = 0; k < result.length; k++){
                if(k == 0) { polyArr[j] = result[k]; } // Just set first value, insead of removing old
                else { polyArr.push(result[k]); }
            }
            numKeeps = polyArr.length;
        }
    }
    return polyArr;
}

function unionPolyArray(polyArr) {
    if(polyArr.length <= 1) {return true;}
    
    // Setup variables
    var i = 0;
    var numPolys = polyArr.length;
    var temp1, temp2, result;
    var unionOccured = false;
    
    while(i < numPolys) {
        // Reset bool which indicates if a union was found
        unionOccured = false;
        
        // Get first polygon to compare with rest for union
        temp1 = polyArr[i];
        
        // Loop through polygons and compare
        for(var j = 0; j < numPolys; j++) {
            
            // If not the same hazard
            if(j!=i) {
                
                // Get the other polygon and find the union of the two
                temp2 = polyArr[j];
                result = unionPolygons(temp1, temp2);
                
                // Check if the two polygons were actually unioned (they interesected and a new path was made)
                if(result.unioned==1) {
                    
                    // Remove the original polygon at index i
                    polyArr.splice(i,1);
                    
                    // Remove the original polygon at index j
                    // But adjust for shift from deletion of i
                    if(i<j) { polyArr.splice(i-1,1);} 
                    else { polyArr.splice(i,1); }
                    
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
        if(unionOccured) {i=0;}
        
        // Return now if only 1 polygon is left, not necessary but decreases time by one loop
        if(numPolys <= 1) {return polyArr;}
    }
    return polyArr;
}

function unionPolygons(jstsPoly1, jstsPoly2) {
    jstsPoly1.normalize();
    jstsPoly2.normalize();
    if(!jstsPoly1.intersects(jstsPoly2) || jstsPoly1.touches(jstsPoly2)) { return {"unioned": 0}; }
    var unioned = jstsPoly1.union(jstsPoly2);
    return {
        "polyon":unioned,
        "unioned":1
    };
}

function validateAndFix(appArea, hazards, vras) {
    try {
        if(appArea==null || appArea===[]){return false;}
        if(numUniqueCoordinates(appArea) < 3){return false;}
        var newHazards = deleteNonPolys(hazards);
        var newVras = deleteNonPolys(vras);
        newHazards = unionPolyArray(newHazards);
        newVras = unionPolyArray(newVras);
        newHazards = trimPolyArray(newHazards,appArea);
        newVras = trimPolyArray(newVras, appArea, newHazards);
        
        // All the values at this point should be valid 
        return true;
    } catch (e) {
        console.log("Error during validation:");
        console.log(e);
        return false;
    }
    
}

function kml(info){
	var kml = new XMLWriter(true);
	kml.startDocument().startElement('kml').writeAttribute('xmlns', 'http://www.opengis.net/kml/2.2');
	
	kml.startElement("Document");
	
// 	var appArea = jsonToJstsGeom(info["appArea"]["ApplicationArea"][0]);
   
// 	var hazard = jsonToJstsGeom(info["appArea"]["Hazards"][0]); 
// 	var vRAs = jsonToJstsGeom(info["appArea"]["VariableRateAreas"]); 
    
	
// 	kml.text(JSON.stringify(appArea["shell"]["lat"])); 
// 	kml.text(JSON.stringify(hazard));
// 	kml.text(JSON.stringify(vRAs));
    var appArea = info["appArea"]["ApplicationArea"][0]["shell"];
    var hazardArea = info["appArea"]["Hazards"];
    var vRAArea = info["appArea"]["VariableRateAreas"]; 
    
    //testing size
    // kml.text(appArea.length + " app area Length \n");
    // kml.text(hazardArea.length + " hazard area Length \n"); 
    // kml.text(vRAArea.length + " vras area Length \n");
    
    // kml.text(JSON.stringify(info)); 
	
	// App area 
	for(var i = 0; i < appArea.length; i++){
	    kml.startElement("Placemark"); // 1. polygon start 
	    
	    kml.startElement("name").writeCData("App Area").endElement();
	    kml.startElement("description").writeCData("Application Area for biologicals").endElement();
	    
	    kml.startElement("Polygon"); // 2. polygon start 
	    kml.writeElement("extrude", "1");
	    kml.writeElement("altitudeMode", "clampToGround"); 
	    
	    kml.startElement("outerBoundaryIs"); // 3. start 'hole' tag
	    kml.startElement("LinearRing"); // 4. linear ring start 
	    kml.startElement("coordinates"); // 5. coordinate tag start 
	   
	   // Shell array 
	    for(var i = 0; i < info["appArea"]["ApplicationArea"]["0"]["shell"].length; i++){
            var appAreaLng = info["appArea"]["ApplicationArea"][0]["shell"][i]["lng"];
            var appAreaLat = info["appArea"]["ApplicationArea"][0]["shell"][i]["lat"];
            
            kml.text("\n\t\t\t\t\t\t\t" + JSON.stringify(appAreaLng) + "," + JSON.stringify(appAreaLat) + ",0");
	    }
	    kml.text("\n\t\t\t\t\t\t"); 
	    // holes array 
	   // for(var i = 0; i < info["appArea"]["ApplicationArea"][0]["holes"].length; i++){
	   //     var appAreaHolesLng = info["appArea"]["ApplicationArea"][0]["holes"][i]["lng"];
    //         var appAreaHolesLat = info["appArea"]["ApplicationArea"][0]["holes"][i]["lat"];
            
    //         kml.text("\n\t\t\t\t\t\t\t" + JSON.stringify(appAreaHolesLng) + "," + JSON.stringify(appAreaHolesLat) + ",0");
	   // }
	   //kml.text("\n\t\t\t\t\t\t"); 
	    
	    kml.endElement(); //5. end coordinate tag 
	    kml.endElement(); // 4. end linear ring tag 
	    kml.endElement(); // 3, end 'hole' tag
	    kml.endElement(); // 2, polygon end 
	    
	    kml.startElement("Style"); // start style tag 
	    kml.startElement("PolyStyle"); // start polystyle tag
	    kml.startElement("color"); // start color tag 
	    kml.text("#ff00ffff"); 
	    kml.endElement(); // end color tag 
	    kml.startElement("outline"); // start outline tag
	    kml.text("0"); 
	    kml.endElement(); // end outline tag 
	    kml.endElement(); // end polystyle tag
	    kml.endElement(); // end style tag
	    
	    kml.endElement(); // 1. polyon end 
	    
	}
	// Hazard Area 
	for(var i = 0; i < hazardArea.length; i++){
	    kml.startElement("Placemark"); // 1. polygon start 
	    
	    kml.startElement("name").writeCData("Hazards").endElement();
	    kml.startElement("description").writeCData("Areas that have hazards in them").endElement();
	    
	    kml.startElement("Polygon"); // 2. polygon start 
	    kml.writeElement("extrude", "1");
	    kml.writeElement("altitudeMode", "clampToGround"); 
	    
	    kml.startElement("outerBoundaryIs"); // 3. start 'hole' tag
	    kml.startElement("LinearRing"); // 4. linear ring start 
	    kml.startElement("coordinates"); // 5. coordinate tag start 
	    
	    for(var j = 0; j < info["appArea"]["Hazards"][0][0]["shell"].length; j++){
            var hazardLng = info["appArea"]["Hazards"][i][0]["shell"][j]["lng"];
            var hazardLat = info["appArea"]["Hazards"][i][0]["shell"][j]["lat"];
            
            kml.text("\n\t\t\t\t\t\t\t" + JSON.stringify(hazardLng) + "," + JSON.stringify(hazardLat) + ",0");
	    }
	    kml.text("\n\t\t\t\t\t\t"); 
	    // holes array 
	   // for(var i = 0; i < info["appArea"]["Hazards"][0]["holes"].length; i++){
	   //     var hazardHolesLng = info["appArea"]["Hazards"][0][0]["holes"][i]["lng"];
    //         var hazarddHolesLat = info["appArea"]["Hazards"][0][0]["holes"][i]["lat"];
            
    //         kml.text("\n\t\t\t\t\t\t\t" + JSON.stringify(hazardHolesLng) + "," + JSON.stringify(hazarddHolesLat) + ",0");
	   // }
	   //kml.text("\n\t\t\t\t\t\t"); 
	    
	    kml.endElement(); //5. end coordinate tag 
	    kml.endElement(); // 4. end linear ring tag 
	    kml.endElement(); // 3, end 'hole' tag
	    kml.endElement(); // 2, polygon end 
	    
	    kml.startElement("Style"); // start style tag 
	    kml.startElement("PolyStyle"); // start polystyle tag
	    kml.startElement("color"); // start color tag 
	    kml.text("ff0000cc"); 
	    kml.endElement(); // end color tag 
	    kml.startElement("outline"); // start outline tag
	    kml.text("0"); 
	    kml.endElement(); // end outline tag 
	    kml.endElement(); // end polystyle tag
	    kml.endElement(); // end style tag
	    
	    kml.endElement(); // 1. polyon end 
	    
	}
	// variable rate area 
	for(var i = 0; i < vRAArea.length; i++){
	    kml.startElement("Placemark"); // 1. polygon start 
	    
	    kml.startElement("name").writeCData("VRA").endElement();
	    kml.startElement("description").writeCData("Variable rate area/s").endElement();
	    
	    kml.startElement("Polygon"); // 2. polygon start 
	    kml.writeElement("extrude", "1");
	    kml.writeElement("altitudeMode", "clampToGround"); 
	    
	    kml.startElement("outerBoundaryIs"); // 3. start 'hole' tag
	    kml.startElement("LinearRing"); // 4. linear ring start 
	    kml.startElement("coordinates"); // 5. coordinate tag start 
	    
	    
	    //object►appArea►VariableRateAreas►0►0►shell►0►lat

	    for(var j = 0; j < info["appArea"]["VariableRateAreas"][0][0]["shell"].length; j++){
            var vRALng = info["appArea"]["VariableRateAreas"][i][0]["shell"][j]["lng"];
            var vRALat = info["appArea"]["VariableRateAreas"][i][0]["shell"][j]["lat"];
            
            kml.text("\n\t\t\t\t\t\t\t" + JSON.stringify(vRALng) + "," + JSON.stringify(vRALat) + ",0");
	    }
	    kml.text("\n\t\t\t\t\t\t"); 
	    // holes array 
	   // for(var i = 0; i < info["appArea"]["Hazards"][0][0]["holes"].length; i++){
	   //     var vRAHolesLng = info["appArea"]["Hazards"][0][0]["holes"][i]["lng"];
    //         var vRAHolesLat = info["appArea"]["Hazards"][0][0]["holes"][i]["lat"];
            
    //         kml.text("\n\t\t\t\t\t\t\t" + JSON.stringify(vRAHolesLng) + "," + JSON.stringify(vRAHolesLat) + ",0");
	   // }
	   //kml.text("\n\t\t\t\t\t\t"); 
	    
	    kml.endElement(); //5. end coordinate tag 
	    kml.endElement(); // 4. end linear ring tag 
	    kml.endElement(); // 3, end 'hole' tag
	    kml.endElement(); // 2, polygon end 
	    
	    kml.startElement("Style"); // start style tag 
	    kml.startElement("PolyStyle"); // start polystyle tag
	    kml.startElement("color"); // start color tag 
	    kml.text("64A0A0A0"); 
	    kml.endElement(); // end color tag 
	    kml.startElement("outline"); // start outline tag
	    kml.text("0"); 
	    kml.endElement(); // end outline tag 
	    kml.endElement(); // end polystyle tag
	    kml.endElement(); // end style tag
	    
	    kml.endElement(); // 1. polyon end 
	    
	}
	
	kml.endElement();
// 	kml.text(info["appArea"]["ApplicationArea"]);
	
    return kml.toString(); 
}

function fileCreate(info){
    
    ws.writeFile('KMLMap.kml', info, (err) => {
      if (err) throw err;
      console.log('The file has been saved!');
    });
}

module.exports = router;