class Hazard {
    constructor(map, path) {
        // map is a google maps map object
        this.map = map;
        // initialize the path on the map
        this.init(path,map);
    }
    
    init(path,map) {
        this.poly = new google.maps.Polygon({
            paths: path,
            strokeColor: '#000000',
            strokeOpacity: 0.8,
            strokeWeight: 1,
            fillColor: '#FF0000',
            fillOpacity: 0.7,
            zIndex: 1,
        });
        this.poly.setMap(map); 
    }
    
    del() {
        this.poly.setMap(null);
        this.poly = null;
        this.map = null;
    }
    
    getPoly() {
        return this.poly;
    }
}

class VariableRateArea {
    constructor(map, path) {
        // map is a google maps map object
        this.map = map;
        // initialize the path on the map
        this.init(path);
    }
    
    init(path) {
        this.poly = new google.maps.Polygon({
            paths: path,
            strokeColor: '#000000',
            strokeOpacity: 0.8,
            strokeWeight: 1,
            fillColor: '#CCCCCC',
            fillOpacity: 0.6,
            zIndex: 2,
        });
        this.poly.setMap(this.map); 
    }
    
    del() {
        this.poly.setMap(null);
        this.poly = null;
        this.map = null;
    }
    
    setDescription(description) {
        this.description = description;
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
    }
    
    init(path) {
        this.poly = new google.maps.Polygon({
            paths: path,
            strokeColor: '#000000',
            strokeOpacity: 0.8,
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
        
        var hazard = new Hazard(this.map,allPaths);
        this.hazards.push(hazard);
        return true;
    }
    
    addVariableRate(path) {
        var variableRateArea = new VariableRateArea(this.map,path);
        this.variableRateAreas.push(variableRateArea);
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
        for(var i = 0; i < this.variableRateAreas.length; i++) { this.removeVariableRateArea(i); }
    }
    
    del() {
        this.clearHazards();
        this.clearVariableRateAreas();
        this.poly.setMap(null);
        this.poly = null;
        this.map = null;
    }
    
    getHazard(index) {
        if(index<this.hazards.length) {
            return this.hazards[index];
        }
        return null;
    }
    
    getNumHazard() {
        return this.hazards.length;
    }
    
    getPoly() {
        return this.poly;
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
    
    trimHazards() {
        var outer = this.getPoly();
        var inner, result;
        for(var i = 0; i < this.getNumHazard(); i++) {
            inner = this.getHazard(i).getPoly();
            result = AppArea.trimPolygon(inner, outer);
            this.removeHazard(i);
            for(var j = 0; j < result.length; j++){
                this.addHazard(result[j].shell, result[j].holes);
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
    
    validateAndFix() {
        this.unionHazards();
        this.trimHazards();
        // console.log(this);
    }
    
    /*
        Trims the inner polygon to be contained within the outer polygon
        Takes two google polygons and returns array of objects:
        {
            shell   - the outer path of the trim (at most, boundaries of outer polygon),
            [holes]   - the inner paths of the trim, representing holes (if any)
        }
    */
    static trimPolygon(inner, outer) {
        var gF = new jsts.geom.GeometryFactory();
        
        var jstsInner = AppArea.createJstsPolygon(gF, inner);
        var jstsOuter = AppArea.createJstsPolygon(gF, outer);
        
        jstsInner.normalize();
        jstsOuter.normalize();
        
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
    
    /*
        Create a unioned polygon between two input polygons, if intersection occurs
        Takes two google polygons and returns object:
        {
            shell   - the outer path of the union
            [holes]   - the inner paths of the union, representing holes (if any)
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
    
    static getCoords(poly) {
        var coords = poly.getCoordinates().map(function (coord) {
            return { lat: coord.x, lng: coord.y };
        });
        return coords;
    }
    
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
}