var express = require('express');
var router = express.Router();

var jsts = require('jsts');

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
    "rowSpacing"
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
        } else {
            res.send("Invalid");
        }
        
    } catch (e) {
        console.log(e);
        res.send("Error");
    }
});


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


module.exports = router;