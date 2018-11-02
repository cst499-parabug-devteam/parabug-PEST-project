class Hazard {
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
            fillColor: '#FF0000',
            fillOpacity: 0.7
        });
        this.poly.setMap(this.map); 
    }
    
    del() {
        this.poly.setMap(null);
        this.poly = null;
        this.map = null;
    }
    
    getPath() {
        return this.poly.getPath();
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
            fillOpacity: 0.6
        });
        this.poly.setMap(this.map); 
    }
    
    del() {
        this.poly.setMap(null);
        this.poly = null;
        this.map = null;
    }
    
    getPath() {
        return this.poly.getPath();
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
            fillOpacity: 0.6
        });
        this.poly.setMap(this.map); 
    }
    
    add(path) {
        // Perform basic error checking (see if any point is outside this.poly)
        for(var i = 0; i<path.getLength();i++) {
            var coord = new google.maps.LatLng(path.getAt(i).lat(),path.getAt(i).lng());
            if(!google.maps.geometry.poly.containsLocation(coord, this.poly)) {
                return false;
            };
        }
        return true;
    }
    
    addHazard(path) {
        var hazard = new Hazard(this.map,path);
        this.hazards.push(hazard);
        return true;
    }
    
    addVariableRate(path) {
        var variableRateArea = new VariableRateArea(this.map,path);
        this.variableRateAreas.push(variableRateArea);
        return true;
    }
    
    clearHazards() {
        for(var i = 0; i < this.hazards.length; i++) { this.removeHazard(i); }
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
    
    getPath() {
        return this.poly.getPath();
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
    
    setHazard(index, hazardPath) {
        if(this.hazards.length<= index) {return false;}
        this.hazards[index].del();
        this.hazards[index] = new Hazard(this.map, hazardPath);
    }
    
    trimHazards() {
        try {
            // trim hazards to be contained in the application area
            var geometryFactory = new jsts.geom.GeometryFactory();
            var polyOutter = AppArea.createJstsPolygon(geometryFactory, this.getPoly());
            var polyInner;
            var intersection;
            var coords;
            var numHazards = this.getNumHazard()
            for(var i = 0; i < numHazards; i++) {
                polyInner = AppArea.createJstsPolygon(geometryFactory, this.getHazard(i).getPoly());
                
                if(!polyInner.within(polyOutter)) {
                    intersection = polyOutter.intersection(polyInner);
                    var subPolys = intersection.geometries;
                    var subPoly;
                    this.removeHazard(i);
                    numHazards--;
                    i--;
                    if(subPolys == null) {
                        subPoly = geometryFactory.createPolygon(intersection.shell);
                        coords = subPoly.getCoordinates().map(function (coord) {
                            return { lat: coord.x, lng: coord.y };
                        });
                        this.addHazard(coords);
                    } else {
                        for(var j = 0; j < subPolys.length; j++) {
                            subPoly = geometryFactory.createPolygon(subPolys[j].shell);
                            coords = subPoly.getCoordinates().map(function (coord) {
                                return { lat: coord.x, lng: coord.y };
                            });
                            this.addHazard(coords);
                        }
                    }
                }
            }
            return true;
        } catch (e) {
            console.log(e);
            console.log("There was an error trimming the hazards");
        }
    }
    
    unionHazards() {
        try {
            if(this.getNumHazard()<=1) {return true;}
            var geometryFactory = new jsts.geom.GeometryFactory();
            var haz1, haz2;
            var unionedHaz;
            var coords;
            var numHazards = this.getNumHazard()
            var disjointFound;
            
            var i = 0;    
            while(i < numHazards) {
                disjointFound = false;
                haz1 = AppArea.createJstsPolygon(geometryFactory, this.getHazard(i).getPoly());
                
                for(var j = 0; j < numHazards; j++) {
                    if(j != i) {
                        haz2 = AppArea.createJstsPolygon(geometryFactory, this.getHazard(j).getPoly()); 
                        if(!haz1.disjoint(haz2)) {
                            unionedHaz = haz1.union(haz2);
                            coords = unionedHaz.getCoordinates().map(function (coord) {
                                return { lat: coord.x, lng: coord.y };
                            });
                            this.setHazard(i,coords);
                            this.removeHazard(j);
                            disjointFound = true;
                            break;
                        }
                    }
                }
                if(disjointFound) {
                    i = 0;
                    numHazards = this.getNumHazard();
                } else {
                    i++;
                }
            }
        } catch (e) {
            console.log("There was an error unioning the hazards");
        }
    }
    
    // Composite validation function
    // checks application area and hazards 
    // are within certain parameters
    // Requires Jsts library
    //https://cdn.rawgit.com/bjornharrtell/jsts/gh-pages/1.1.2/jsts.min.js
    validateAndFix() {
        if(this.getPath().length<3) { return false; } // Is a line
        
        // Run union function on hazards to get rid of any overlaps
        this.unionHazards();
        
        // Remove any hazard area outside application area
        this.trimHazards();
    }
    
    static createJstsPolygon(geometryFactory, polygon) {
      var path = polygon.getPath();
      var coordinates = path.getArray().map(function name(coord) {
        return new jsts.geom.Coordinate(coord.lat(), coord.lng());
      });
      if(coordinates[0].compareTo(coordinates[coordinates.length-1]) != 0) {
          coordinates.push(coordinates[0]);
      }
      var shell = geometryFactory.createLinearRing(coordinates);
      return geometryFactory.createPolygon(shell);
    }
}