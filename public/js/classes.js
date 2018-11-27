class Hazard {
    constructor(map, poly) {
        // map is a google maps map object
        this.map = map;
        // initialize the path on the map
        this.poly = poly;
    }
    
    del() {
        this.poly.setMap(null);
        this.poly = null;
        this.map = null;
    }
    
    getCentroid() {
        var gF = new jsts.geom.GeometryFactory();
        var jstsPoly = AppArea.createJstsPolygon(gF, this.getPoly());
        var c = jsts.algorithm.Centroid.getCentroid(jstsPoly);
        return { lat: c.x, lng: c.y };
    }
    
    getPoly() {
        return this.poly;
    }
}

class VariableRateArea {
    constructor(map, poly) {
        // map is a google maps map object
        this.map = map;
        // initialize the path on the map
        this.poly = poly;
    }
    
    del() {
        this.poly.setMap(null);
        this.poly = null;
        this.map = null;
    }
    
    getCentroid() {
        var gF = new jsts.geom.GeometryFactory();
        var jstsPoly = AppArea.createJstsPolygon(gF, this.getPoly());
        var c = jsts.algorithm.Centroid.getCentroid(jstsPoly);
        return { lat: c.x, lng: c.y };
    }
    
    getPoly() {
        return this.poly;
    }
}

class AppArea {
    constructor(map, path, hazards=[], vRAs = []) {
        // map is a google maps map object
        this.map = map;
        // hazards contains an array of inner polygons
        this.hazards = hazards;
        // variable rate areas contain an array of inner polygons
        this.variableRateAreas = vRAs;
        // initialize the path on the map
        this.init(path);
        
        this.subPolyId = 0;
    }
    
    init(path) {
        this.poly = new google.maps.Polygon({
            paths: path,
            strokeColor: '#000000',
            strokeOpacity: 1,
            strokeWeight: 1,
            fillColor: '#FFFF00',
            fillOpacity: 0.6,
            zIndex: 0,
        });
        this.poly.setMap(this.map); 
    }
    
    addHazard(path, holes=[]) {
        var allPaths = holes;
        allPaths.unshift(path);
        
        var identifier = {
            "type" : "hazard",
            "id": this.subPolyId
        };
        this.subPolyId += 1;
        
        var poly = this.createHazardPoly(allPaths, identifier);
        var hazard = new Hazard(this.map, poly);
        this.hazards.push(hazard);
        return true;
    }
    
    addVariableRate(path, holes=[]) {
        var allPaths = holes;
        allPaths.unshift(path);
        
        var identifier = {
            "type" : "variable",
            "id": this.subPolyId
        };
        this.subPolyId += 1;
        
        var poly = this.createVariableRatePoly(allPaths, identifier);
        var vra = new VariableRateArea(this.map, poly);
        this.variableRateAreas.push(vra);
        return true;
    }
    
    clearHazards() {
        var i = this.getNumHazard()-1;
        while(i>=0) {
            this.removeHazard(i); 
            i--;
        }
    }
    
    clearVariableRateAreas() {
        var i = this.getNumVariableRateAreas()-1;
        while(i>=0) {
            this.removeVariableRateArea(i); 
            i--;
        }
    }
    
    createHazardPoly(paths, id) {
        var poly = new google.maps.Polygon({
            paths: paths,
            strokeColor: '#000000',
            strokeOpacity: 0.8,
            strokeWeight: 1,
            fillColor: '#FF0000',
            fillOpacity: 0.7,
            zIndex: 1,
            identifier: id
        });
        poly.setMap(this.map);
        google.maps.event.addListener(poly,"click", function(event) {
            // console.log(this.identifier); 
            promptAndDelete(this.identifier);
        });
        return poly;
    }
    
    createVariableRatePoly(paths, id) {
        var poly = new google.maps.Polygon({
            paths: paths,
            strokeColor: '#000000',
            strokeOpacity: 1,
            strokeWeight: 1,
            fillColor: '#CCCCCC',
            fillOpacity: 0.6,
            zIndex: 2,
            identifier: id
        });
        poly.setMap(this.map);
        google.maps.event.addListener(poly,"click", function(event) {
            // console.log(this.identifier);
            promptAndDelete(this.identifier);
        });
        return poly;
    }
    
    del() {
        this.clearHazards();
        this.clearVariableRateAreas();
        if(this.poly != null) { this.poly.setMap(null); }
        this.poly = null;
        this.map = null;
    }
    
    deleteNonPolys() {
        if(AppArea.numUniqueCoordinates(this.getPoly()) < 3) {
            console.log("Application area is not a polygon");
            this.del();
            return false;
        }
        
        // Check to see if any hazard has less than 3 unique coordinates, if so then delete
        for(var i = this.getNumHazard()-1; i >= 0; i--) {
            if(AppArea.numUniqueCoordinates(this.getHazard(i).getPoly()) < 3) {
                this.removeHazard(i);
            }
        }
        
        // Check to see if any variable rate area has less than 3 unique coordinates, if so then delete
        for(i = this.getNumVariableRateAreas()-1; i >= 0; i--) {
            if(AppArea.numUniqueCoordinates(this.getVariableRateArea(i).getPoly()) < 3) {
                this.removeVariableRateArea(i);
            }
        }
        return true;
    }
    
    deleteSelfIntersections() {
        var gF = new jsts.geom.GeometryFactory();
        
        // Check to see if application area has self intersections, if so then delete
        var jstsPoly = AppArea.createJstsPolygon(gF, this.getPoly());
        if(!jstsPoly.isSimple()) {
            console.log("Application area is not simple, it may have self intersections");
            this.del();
            return false;
        }
        
        // Check to see if any hazard has self intersections, if so then delete
        // Traverse backwards to avoid shifting issue
        for(var i = this.getNumHazard()-1; i >= 0; i--) {
            jstsPoly = AppArea.createJstsPolygon(gF, this.getHazard(i).getPoly());
            if(!jstsPoly.isSimple()) { this.removeHazard(i); }
        }
        
        // Check to see if any variable rate area has self intersections, if so then delete
        // Traverse backwards to avoid shifting issue
        for(i = this.getNumVariableRateAreas()-1; i >= 0; i--) {
            jstsPoly = AppArea.createJstsPolygon(gF, this.getVariableRateArea(i).getPoly());
            if(!jstsPoly.isSimple()) { this.removeVariableRateArea(i); }
        }
        return true;
    }    
    
    
    /*
        Returns the total square acreage of the application area
        Minus the hazard area 
        (Validation should happen first, overlaps are not addressed)
    */
    getArea() {
        var gF = new jsts.geom.GeometryFactory();
        // Get the application area's area
        var appArea = AppArea.createJstsPolygon(gF, this.getPoly());
        var sqAcres = AppArea.caDegreeToSquareAcres(appArea.getArea());
        
        var tempPoly, tempAcres;
        for(var i = 0; i < this.getNumHazard(); i++) {
            tempPoly = AppArea.createJstsPolygon(gF, this.getHazard(i).getPoly());
            tempAcres = AppArea.caDegreeToSquareAcres(tempPoly.getArea());
            sqAcres -= tempAcres;
        }
        if(sqAcres < 0.000001) {return 0;}
        return sqAcres;
    }
    
    getCentroid() {
        if(this.getPoly() == null) {return null;}
        var gF = new jsts.geom.GeometryFactory();
        var jstsPoly = AppArea.createJstsPolygon(gF, this.getPoly());
        var c = jsts.algorithm.Centroid.getCentroid(jstsPoly);
        return { lat: c.x, lng: c.y };

    }
    
    getIndexOfIdentifier(id, type=null) {
        var both = false;
        if(type == null) {
            both = true;
        }
        if((type == "hazard") || both) {
            for(var i = 0; i < this.getNumHazard(); i++) {
                if(this.getHazard(i).getPoly().identifier.id == id) {
                    return i;
                }
            }
        }
        if((type == "variable") || both) {
            for(i = 0; i < this.getNumVariableRateAreas(); i++) {
                if(this.getVariableRateArea(i).getPoly().identifier.id == id) {
                    return i;
                }
            }
        }
        return -1;
    }
    
    getHazard(index) {
        if(index<this.hazards.length) {
            return this.hazards[index];
        }
        return null;
    }
    
    getVariableRateArea(index) {
        if(index<this.variableRateAreas.length) {
            return this.variableRateAreas[index];
        }
        return null;
    }
    
    getMap() {
        return this.map;
    }
    
    getNumHazard() {
        return this.hazards.length;
    }
    
    getNumVariableRateAreas() {
        return this.variableRateAreas.length;
    }
    
    getPoly() {
        return this.poly;
    }
    
    getTotalBugs(standard, variablePercent) {
        if(this.getPoly() == null) {return 0;}
        var mult = variablePercent/100;
        var appArea = this.getArea();
        var tempAcres, tempPoly;
        var vrArea = 0;
        var gF = new jsts.geom.GeometryFactory();
        for(var i = 0; i < this.getNumVariableRateAreas(); i++) {
            tempPoly = AppArea.createJstsPolygon(gF, this.getVariableRateArea(i).getPoly());
            tempAcres = AppArea.caDegreeToSquareAcres(tempPoly.getArea());
            appArea -= tempAcres;
            vrArea += tempAcres;
        }
        return ((appArea*standard)+(vrArea*mult*standard));
    }
    
    removeHazard(index) {
        if(index<this.hazards.length) {
            this.hazards[index].del();
            this.hazards[index] = null;
            this.hazards.splice(index,1);
            return true;
        }
        return false;
    }
    
    removeVariableRateArea(index) {
        if(index<this.variableRateAreas.length) {
            this.variableRateAreas[index].del();
            this.variableRateAreas[index] = null;
            this.variableRateAreas.splice(index,1);
            return true;
        }
        return false;
    }
    
    resetGlobals() {
        if(this.marker!=null) {
            this.marker.setMap(null);
            this.marker = null;
        }
        if(this.infoWindow == null) {
            this.infoWindow.setMap(null);
            this.infoWindow = null;
        }
        this.deleteIdentifier = null;
    }
    
    setVariableRateArea(index, path, holes=[]) {
        if(index<this.variableRateAreas.length) {
            this.variableRateAreas[index].del();
            this.variableRateAreas[index] = null;
            var allPaths = holes;
            allPaths.unshift(path);
            
            var identifier = {
                "type" : "variable",
                "id": this.subPolyId
            };
            this.subPolyId += 1;
            
            var poly = this.createVariableRatePoly(allPaths, identifier);
            var vra = new VariableRateArea(this.map, poly);
            this.variableRateAreas[index] = vra;
            return true;
        }
        return false;
    }
    
    /*
        Converts THIS object into an object which is easily converted to JSON (for sending)
        "ApplicationArea",
            [{
                "shell": [{lat,lng}], <- take first shell (should only have 1)
                "holes": [ [{lat,lng}] ]
            }]
        "Hazards",
            [
                [{ "shell", "holes" }]
            ]
        "VariableRateAreas"
            [
                [{ "shell", "holes" }]
            ]
    */
    toEasyFormat() {
        if(this.getPoly()==null) { return null; }
        var gF = new jsts.geom.GeometryFactory();
        var temp;
        
        temp = AppArea.createJstsPolygon(gF, this.getPoly());
        temp = AppArea.getGeoShellsHoles(temp);
        var appArea = AppArea.shellsHolesToCoords(temp);
        
        var hazards = [];
        for(var i = 0; i < this.getNumHazard(); i++) {
            temp = AppArea.createJstsPolygon(gF, this.getHazard(i).getPoly());
            temp = AppArea.getGeoShellsHoles(temp);
            temp = AppArea.shellsHolesToCoords(temp);
            hazards.push(temp);
        }
        
        var vras = [];
        for(i = 0; i < this.getNumVariableRateAreas(); i++) {
            temp = AppArea.createJstsPolygon(gF, this.getVariableRateArea(i).getPoly());
            temp = AppArea.getGeoShellsHoles(temp);
            temp = AppArea.shellsHolesToCoords(temp);
            vras.push(temp);
        }
        
        var json = {
            "ApplicationArea":appArea,
            "Hazards":hazards,
            "VariableRateAreas":vras
        };
        
        return json;
    }
    
    trimHazards() {
        var outer = this.getPoly();
        var inner, result;
        for(var i = 0; i < this.getNumHazard(); i++) {
            inner = this.getHazard(i).getPoly();
            result = AppArea.trimPolygon(inner, outer);
            this.removeHazard(i);
            if(result != null) {
                for(var j = 0; j < result.length; j++){
                    this.addHazard(result[j].shell, result[j].holes);
                }
            }
        }
    }
    
    trimVariableRateAreas() {
        var outer = this.getPoly();
        var inner, result;
        
        // Trim variable rate ares to be within application area
        for(var i = 0; i < this.getNumVariableRateAreas(); i++) {
            inner = this.getVariableRateArea(i).getPoly();
            result = AppArea.trimPolygon(inner, outer);
            this.removeVariableRateArea(i);
            if(result != null) {
                for(var j = 0; j < result.length; j++){
                    this.addVariableRate(result[j].shell, result[j].holes);
                }
            }
        }
        
        // Trim variable rate ares to not overlap with any hazards
        var vra, haz;
        var numVRAs = this.getNumVariableRateAreas();
        for(i = 0; i < this.getNumHazard(); i++) {
            haz = this.getHazard(i).getPoly();
            for(j = 0; j < numVRAs; j++) {
                vra = this.getVariableRateArea(j).getPoly();
                result = AppArea.getDifference(vra,haz);
                for(var k = 0; k < result.length; k++){
                    if(k == 0) { this.setVariableRateArea(j, result[k].shell, result[k].holes); }
                     else { this.addVariableRate(result[k].shell, result[k].holes); }
                }
                numVRAs = this.getNumVariableRateAreas();
            }
        }
    }
    
    unionHazards() {
        // Return now if only 1 hazard is left, not necessary but decreases time by one loop
        if(this.getNumHazard() <= 1) { return true; }
        
        // Setup variables
        var i = 0;
        var numHazards = this.getNumHazard();
        var temp1, temp2, result;
        var unionOccured = false;
        
        while(i < numHazards) {
            // Reset bool which indicates if a union was found
            unionOccured = false;
            
            // Get first hazard to compare with rest for union
            temp1 = this.getHazard(i);
            
            // Loop through hazards and compare
            for(var j = 0; j < numHazards; j++) {
                
                // If not the same hazard
                if(j!=i) {
                    
                    // Get the other hazard and find the union of the two
                    temp2 = this.getHazard(j);
                    result = AppArea.unionPolygons(temp1.getPoly(), temp2.getPoly());
                    
                    // Check if the two hazards were actually unioned (they interesected and a new path was made)
                    if(result.unioned==1) {
                        
                        // Remove the original hazard at index i
                        this.removeHazard(i);
                        
                        // Remove the original hazard at index j
                        // But adjust for shift from deletion of i
                        if(i<j) { this.removeHazard(j-1); } 
                        else { this.removeHazard(j); }
                        
                        // Add new unioned hazard
                        this.addHazard(result.shell, result.holes);
                        
                        // Set bool to true to indicate a union has occured 
                        unionOccured = true;
                        
                        // Adjust numhazards to reflect new additions and deletions
                        numHazards = this.getNumHazard();
                        break;
                    }
                }
            }
            
            // Increment hazard index to check
            i++;
            
            // Indexes have shifted and new paths were added, restart loop
            if(unionOccured) {i=0;}
            
            // Return now if only 1 hazard is left, not necessary but decreases time by one loop
            if(numHazards <= 1) {return;}
        }
    }
    
    unionVariableRateAreas() {
        // Return now if only 1 variable rate area is left, not necessary but decreases time by one loop
        if(this.getNumVariableRateAreas() <= 1) { return true; }
        
        // Setup variables
        var i = 0;
        var numVRAs = this.getNumVariableRateAreas();
        var temp1, temp2, result;
        var unionOccured = false;
        
        while(i < numVRAs) {
            // Reset bool which indicates if a union was found
            unionOccured = false;
            
            // Get first variable rate area to compare with rest for union
            temp1 = this.getVariableRateArea(i);
            
            // Loop through variable rate areas and compare
            for(var j = 0; j < numVRAs; j++) {
                
                // If not the same variable rate area
                if(j!=i) {
                    
                    // Get the other variable rate area and find the union of the two
                    temp2 = this.getVariableRateArea(j);
                    result = AppArea.unionPolygons(temp1.getPoly(), temp2.getPoly());
                    
                    // Check if the two variable rate areas were actually unioned (they interesected and a new path was made)
                    if(result.unioned==1) {
                        
                        // Remove the original variable rate area at index i
                        this.removeVariableRateArea(i);
                        
                        // Remove the original variable rate area at index j
                        // But adjust for shift from deletion of i
                        if(i<j) { this.removeVariableRateArea(j-1); } 
                        else { this.removeVariableRateArea(j); }
                        
                        // Add new unioned variable rate area
                        this.addVariableRate(result.shell, result.holes);
                        
                        // Set bool to true to indicate a union has occured 
                        unionOccured = true;
                        
                        // Adjust numVRAs to reflect new additions and deletions
                        numVRAs = this.getNumVariableRateAreas();
                        break;
                    }
                }
            }
            
            // Increment variable rate area index to check
            i++;
            
            // Indexes have shifted and new paths were added, restart loop
            if(unionOccured) {i=0;}
            
            // Return now if only 1 hazard is left, not necessary but decreases time by one loop
            if(numVRAs <= 1) {return;}
        }
    }
    
    validateAndFix() {
        try {
            if(this.getPoly() == null) { return false; }
            if(!this.deleteNonPolys()) { return false; }
            if(!this.deleteSelfIntersections()){ return false; }
            this.unionHazards();
            this.trimHazards();
            this.unionVariableRateAreas();
            this.trimVariableRateAreas();
            return true;
        } catch (e) {
            console.log(e);
        }
        return false;
    }
    
    /*
        Returns the square acreage given the square degrees
        Approximation - assumes geo coordinates are on cartesian plane
    */
    static caDegreeToSquareAcres(deg) {
        var radians = deg / Math.PI;
        var sqKm = radians * 6371;
        var sqAcres = sqKm * 247.105;
        return round(sqAcres,2);
    }
    
    /*
        Given a jsts geometry factory and a Google Maps Polygon
        Returns a jsts polygon on mutlipolygon
        Errors on polygon with less than 3 unique points (2d)
    */
    static createJstsPolygon(geometryFactory, polygon) {
        var path = polygon.getPaths();
        
        // Get path of outer shell
        var coordinates = path.getAt(0).getArray().map(function name(coord) {
            return new jsts.geom.Coordinate(coord.lat(), coord.lng());
        });
        if(coordinates[0].compareTo(coordinates[coordinates.length-1]) != 0) {
            coordinates.push(coordinates[0]);
        }
        var shell = geometryFactory.createLinearRing(coordinates);
        
        // Get paths of holes
        var holes = [];
        for(var i = 1; i < path.getLength(); i++) {
            coordinates = path.getAt(i).getArray().map(function name(coord) {
                return new jsts.geom.Coordinate(coord.lat(), coord.lng());
            });
            if(coordinates[0].compareTo(coordinates[coordinates.length-1]) != 0) {
                coordinates.push(coordinates[0]);
            }
            holes.push(geometryFactory.createLinearRing(coordinates));
        }
        
        return geometryFactory.createPolygon(shell, holes);
    }
    
    /*
        Takes in a jsts geometry/linear ring and returns an array of objects:
        {
            lat - latitude coordinate of point
            lng - longitude coordinate of point
        }
    */
    static getCoords(poly) {
        var coords = poly.getCoordinates().map(function (coord) {
            return { lat: coord.x, lng: coord.y };
        });
        return coords;
    }
    
    /*
        Removes area the area of a polygon that overlaps with another
        Takes two google polygons and returns array of objects:
        {
            shell   - (coordinates) the outer path of the difference,
            [holes]   - (coordinates) the inner paths of the difference, representing holes (if any)
        }
    */
    static getDifference(poly, polyRemove) {
        var gF = new jsts.geom.GeometryFactory();
        
        var jstsPoly = AppArea.createJstsPolygon(gF, poly);
        var jstsPolyRemove = AppArea.createJstsPolygon(gF, polyRemove);
        
        jstsPoly.normalize();
        jstsPolyRemove.normalize();
        
        var difference = jstsPoly.difference(jstsPolyRemove);
        // console.log("Trim difference geometry: ");
        // console.log(difference);
        
        
        var shellsHoles = AppArea.getGeoShellsHoles(difference);
        // console.log("Linear Rings Shells and holes from difference: ");
        // console.log(shellsHoles);
        
        var result = AppArea.shellsHolesToCoords(shellsHoles);
        // console.log("Coordinates Shells and holes from difference: ");
        // console.log(result);
        
        return result;
    }
    
    /*
        Takes in a geometry and returns an array of
        {
            shell   - (Google Linear Ring) the outer path
            [holes]   - (Google Linear Ring) the inner paths, representing holes (if any)
        }
    */
    static getGeoShellsHoles(jstsGeom) {
        var result = [];
        var tempHoles;
        var tempGeo;
        var numGeometries = jstsGeom.getNumGeometries();
        // console.log("Number of geometries detected: " + numGeometries);
        
        if(numGeometries<1) {return [];}
        
        if(numGeometries == 1) {
            tempHoles = [];
            for(var j = 0; j < jstsGeom.getNumInteriorRing(); j++) {
                tempHoles.push(jstsGeom.getInteriorRingN(j));
            }
            result.push({
               "shell": jstsGeom.getExteriorRing(),
               "holes": tempHoles
            });
            return result;
        }
        
        for(var i = 0; i < numGeometries; i++) {
            tempHoles = [];
            tempGeo = jstsGeom.getGeometryN(i);
            for(j = 0; j < tempGeo.getNumInteriorRing(); j++) {
                tempHoles.push(tempGeo.getInteriorRingN(j));
            }
            result.push({
               "shell": tempGeo.getExteriorRing(),
               "holes": tempHoles
            });
        }
        return result;
    }

    
    /*
        Given a Google Maps Polygon
        Returns the number of unique coordinates found
        1  -  Indicates a single point
        2  -  A line (2d)
        3+ -  A polygon
    */
    static numUniqueCoordinates(polygon) {
        var path = polygon.getPaths();
        
        // Get path of outer shell
        var coordinates = path.getAt(0);
        var unique = [];
        var coordTemp, newCoord;
        for(var i = 0; i < coordinates.length; i++) {
            coordTemp = coordinates.getAt(i);
            newCoord = {
              'lat': coordTemp.lat(),
              'lng': coordTemp.lng()
            };
            if(unique.indexOf(newCoord) == -1) {
                unique.push(newCoord);
            }
        }
        return unique.length;
    }    
    
    /*
        Create a unioned polygon between two input polygons, if intersection occurs
        Takes two google polygons and returns object:
        {
            shell   - (coordinates) the outer path of the union
            [holes]   - (coordinates) the inner paths of the union, representing holes (if any)
            unioned - Status int 1 (union occured) or 2 (union did not occur)
        }
    */
    static unionPolygons(poly1, poly2) {
        var gF = new jsts.geom.GeometryFactory();
        
        var jstsPoly1 = AppArea.createJstsPolygon(gF, poly1);
        var jstsPoly2 = AppArea.createJstsPolygon(gF, poly2);
        
        jstsPoly1.normalize();
        jstsPoly2.normalize();
        
        if(!jstsPoly1.intersects(jstsPoly2) || jstsPoly1.touches(jstsPoly2)) { return {"unioned": 0}; }
        
        var unioned = jstsPoly1.union(jstsPoly2);
        
        var shellsHoles = AppArea.getGeoShellsHoles(unioned);
        var result = AppArea.shellsHolesToCoords(shellsHoles);
        
        // Union function should always return a polygon (not multi), length 1
        // console.log("Unioned shape object return:");
        // console.log(result);
        
        var shell = result[0].shell;
        var holes = result[0].holes;
        
        return {
            "shell": shell,
            "holes": holes,
            "unioned": 1
        };
    }
  
    /*
        Converts an array of 
        {
            shell   - (Google Linear Ring) the outer path
            [holes]   - (Google Linear Ring) the inner paths, representing holes (if any)
        }
        Into an array of
        {
            shell   - (coordinates) the outer path
            [holes]   - (coordinates) the inner paths, representing holes (if any)
        }
    */
    static shellsHolesToCoords(shellsHoles) {
        var result = [];
        var tempShell;
        var tempHoles;
        for(var i = 0; i < shellsHoles.length; i++) {
            tempShell = AppArea.getCoords(shellsHoles[i].shell);
            tempHoles = [];
            for(var j = 0; j < shellsHoles[i].holes.length; j++) {
                tempHoles.push(AppArea.getCoords(shellsHoles[i].holes[j]));
            }
            result.push({
                "shell":tempShell,
                "holes":tempHoles
            });
        }
        return result;
    }
    
    /*
        Trims the inner polygon to be contained within the outer polygon
        Takes two google polygons and returns array of objects:
        {
            shell   - (coordinates) the outer path of the trim (at most, boundaries of outer polygon),
            [holes]   - (coordinates) the inner paths of the trim, representing holes (if any)
        }
    */
    static trimPolygon(inner, outer) {
        var gF = new jsts.geom.GeometryFactory();
        
        var jstsInner = AppArea.createJstsPolygon(gF, inner);
        var jstsOuter = AppArea.createJstsPolygon(gF, outer);
        
        jstsInner.normalize();
        jstsOuter.normalize();
        
        if(!jstsInner.intersects(jstsOuter)) {return null;}
        
        var intersection = jstsInner.intersection(jstsOuter);
        // console.log("Trim intersection geometry: ");
        // console.log(intersection);
        
        
        var shellsHoles = AppArea.getGeoShellsHoles(intersection);
        // console.log("Linear Rings Shells and holes from trim: ");
        // console.log(shellsHoles);
        
        var result = AppArea.shellsHolesToCoords(shellsHoles);
        // console.log("Coordinates Shells and holes from trim: ");
        // console.log(result);
        
        return result;
    }
}

/*      FUNCTIONS      */

function promptAndDelete(identifier) {
    // Havent found a good way to add event listeners to children polygons, and delete themselves
    // after clicking, so using a named instance variable for now
    // Named instance variable for AppArea is assumed to be appArea
    
    // check if drawing mode is set to delete
    if(drawModeControl.getCurrent()!="Delete") {return;}
    
    if(appArea == null) {return;}
    var index = appArea.getIndexOfIdentifier(identifier.id, identifier.type);
    if(index == -1) {return;}
    var centroid;
    
    if(identifier.type == "hazard") {
        centroid = appArea.getHazard(index).getCentroid();
    } else if (identifier.type == "variable") {
        centroid = appArea.getVariableRateArea(index).getCentroid();
    } else {return;}
    
    // function to clear markers and infowindow
    appArea.resetGlobals();
    
    appArea.deleteIdentifier = identifier;
    
    var marker = new google.maps.Marker({
        position: centroid,
        map: appArea.getMap()
    });
    
    var infoWindow = new google.maps.InfoWindow({content:""});
    
    
    // Couldn't pass values easily in content string, utilizing global variable instead
    infoWindow.setContent('<button type="button" onClick="deleteSubPoly()">Delete</button>');
    google.maps.event.addListener(infoWindow,'closeclick',function(){
        appArea.resetGlobals();
    });
    
    infoWindow.open(appArea.getMap(), marker);
    appArea.marker = marker;
    appArea.infoWindow = infoWindow;
}

function deleteSubPoly() {
    if((appArea!=null) && (appArea.deleteIdentifier!=null)) {
        // console.log(appArea.deleteIdentifier);
        index = appArea.getIndexOfIdentifier(appArea.deleteIdentifier.id, appArea.deleteIdentifier.type);
        if(appArea.deleteIdentifier.type=="hazard") {
            appArea.removeHazard(index);
        } else if (appArea.deleteIdentifier.type="variable") {
            appArea.removeVariableRateArea(index);
        }
        appArea.resetGlobals();
    }
}

// http://www.jacklmoore.com/notes/rounding-in-javascript/
function round(value, decimals) {
  return Number(Math.round(value+'e'+decimals)+'e-'+decimals);
}