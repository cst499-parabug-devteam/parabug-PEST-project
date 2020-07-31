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
    static buffer = .0000005;
    static fill = "#FFFF00";
    static opacity = 0.6;
    static hazardFill = "#FF0000";
    static hazardOpacity = 0.7;
    static vrFill = "#CCCCCC";
    static vrOpacity = 0.6;

    constructor(map, path, hazards = [], vRAs = []) {
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
            fillColor: AppArea.fill,
            fillOpacity: AppArea.opacity,
            zIndex: 0,
        });
        this.poly.setMap(this.map);
    }

    addHazard(path, holes = []) {
        var allPaths = holes;
        allPaths.unshift(path);

        var identifier = {
            "type": "hazard",
            "id": this.subPolyId
        };
        this.subPolyId += 1;

        var poly = this.createHazardPoly(allPaths, identifier);
        var hazard = new Hazard(this.map, poly);
        this.hazards.push(hazard);
        return true;
    }

    addVariableRate(path, holes = []) {
        var allPaths = holes;
        allPaths.unshift(path);

        var identifier = {
            "type": "variable",
            "id": this.subPolyId
        };
        this.subPolyId += 1;

        var poly = this.createVariableRatePoly(allPaths, identifier);
        var vra = new VariableRateArea(this.map, poly);
        this.variableRateAreas.push(vra);
        return true;
    }

    clearHazards() {
        var i = this.getNumHazard() - 1;
        while (i >= 0) {
            this.removeHazard(i);
            i--;
        }
    }

    clearVariableRateAreas() {
        var i = this.getNumVariableRateAreas() - 1;
        while (i >= 0) {
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
            fillColor: AppArea.hazardFill,
            fillOpacity: AppArea.hazardOpacity,
            zIndex: 1,
            identifier: id
        });
        poly.setMap(this.map);
        google.maps.event.addListener(poly, "click", function (event) {
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
            fillColor: AppArea.vrFill,
            fillOpacity: AppArea.vrOpacity,
            zIndex: 2,
            identifier: id
        });
        poly.setMap(this.map);
        google.maps.event.addListener(poly, "click", function (event) {
            // console.log(this.identifier);
            promptAndDelete(this.identifier);
        });
        return poly;
    }

    del() {
        this.clearHazards();
        this.clearVariableRateAreas();
        if (this.poly != null) { this.poly.setMap(null); }
        this.poly = null;
        this.map = null;
    }

    deleteNonPolys() {
        if (AppArea.numUniqueCoordinates(this.getPoly()) < 3) {
            console.log("Application area is not a polygon");
            this.del();
            return false;
        }

        // Check to see if any hazard has less than 3 unique coordinates, if so then delete
        for (var i = this.getNumHazard() - 1; i >= 0; i--) {
            if (AppArea.numUniqueCoordinates(this.getHazard(i).getPoly()) < 3) {
                this.removeHazard(i);
            }
        }

        // Check to see if any variable rate area has less than 3 unique coordinates, if so then delete
        for (i = this.getNumVariableRateAreas() - 1; i >= 0; i--) {
            if (AppArea.numUniqueCoordinates(this.getVariableRateArea(i).getPoly()) < 3) {
                this.removeVariableRateArea(i);
            }
        }
        return true;
    }

    deleteSelfIntersections() {
        var gF = new jsts.geom.GeometryFactory();

        // Check to see if application area has self intersections, if so then delete
        var jstsPoly = AppArea.createJstsPolygon(gF, this.getPoly());
        if (!jstsPoly.isSimple()) {
            console.log("Application area is not simple, it may have self intersections");
            this.del();
            return false;
        }

        // Check to see if any hazard has self intersections, if so then delete
        // Traverse backwards to avoid shifting issue
        for (var i = this.getNumHazard() - 1; i >= 0; i--) {
            jstsPoly = AppArea.createJstsPolygon(gF, this.getHazard(i).getPoly());
            if (!jstsPoly.isSimple()) { this.removeHazard(i); }
        }

        // Check to see if any variable rate area has self intersections, if so then delete
        // Traverse backwards to avoid shifting issue
        for (i = this.getNumVariableRateAreas() - 1; i >= 0; i--) {
            jstsPoly = AppArea.createJstsPolygon(gF, this.getVariableRateArea(i).getPoly());
            if (!jstsPoly.isSimple()) { this.removeVariableRateArea(i); }
        }
        return true;
    }

    /*
        Returns the total square acreage of the application area
    */
    getArea() {
        var sqAcres = AppArea.googlePathToAcreage(this.getPoly().getPath());
        if (sqAcres < 0.00001) { return 0; }
        return sqAcres;
    }

    /*
        Returns the sum of square acreage of the hazard areas
    */
    getHazardArea() {
        var tempArea = 0;
        for (var i = 0; i < this.getNumHazard(); i++) {
            tempArea += AppArea.googlePathToAcreage(this.getHazard(i).getPoly().getPath());
        }
        return tempArea;
    }

    /*
        Returns the sum of square acreage of the variable rate areas
    */
    getVRAArea() {
        var tempArea = 0;
        for (var i = 0; i < this.getNumVariableRateAreas(); i++) {
            tempArea += AppArea.googlePathToAcreage(this.getVariableRateArea(i).getPoly().getPath());
        }
        return tempArea;
    }

    /*
        Returns the total square acreage of the application area
        Minus the hazard area 
        (Validation should happen first, overlaps are not addressed)
    */
    getAdjustedArea() {
        var sqAcres = AppArea.googlePathToAcreage(this.getPoly().getPath());
        sqAcres -= this.getHazardArea();
        if (sqAcres < 0.00001) { return 0; }
        return sqAcres;
    }

    getCentroid() {
        if (this.getPoly() == null) { return null; }
        var gF = new jsts.geom.GeometryFactory();
        var jstsPoly = AppArea.createJstsPolygon(gF, this.getPoly());
        var c = jsts.algorithm.Centroid.getCentroid(jstsPoly);
        return { lat: c.x, lng: c.y };

    }

    getIndexOfIdentifier(id, type = null) {
        var both = false;
        if (type == null) {
            both = true;
        }
        if ((type == "hazard") || both) {
            for (var i = 0; i < this.getNumHazard(); i++) {
                if (this.getHazard(i).getPoly().identifier.id == id) {
                    return i;
                }
            }
        }
        if ((type == "variable") || both) {
            for (i = 0; i < this.getNumVariableRateAreas(); i++) {
                if (this.getVariableRateArea(i).getPoly().identifier.id == id) {
                    return i;
                }
            }
        }
        return -1;
    }

    getHazard(index) {
        if (index < this.hazards.length) {
            return this.hazards[index];
        }
        return null;
    }

    getVariableRateArea(index) {
        if (index < this.variableRateAreas.length) {
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

    getTotalBugs(standard, variableRate) {
        if (this.getPoly() == null) { return 0; }
        var appArea = this.getAdjustedArea(); // get app area in acres
        var vrArea = this.getVRAArea();
        appArea -= vrArea;
        return ((appArea * standard) + (vrArea * variableRate));
    }

    jstsCoordsToShellHoles(coords) {
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

    removeHazard(index) {
        if (index < this.hazards.length) {
            this.hazards[index].del();
            this.hazards[index] = null;
            this.hazards.splice(index, 1);
            return true;
        }
        return false;
    }

    removeVariableRateArea(index) {
        if (index < this.variableRateAreas.length) {
            this.variableRateAreas[index].del();
            this.variableRateAreas[index] = null;
            this.variableRateAreas.splice(index, 1);
            return true;
        }
        return false;
    }

    resetGlobals() {
        if (this.marker != null) {
            this.marker.setMap(null);
            this.marker = null;
        }
        if (this.infoWindow != null) {
            this.infoWindow.setMap(null);
            this.infoWindow = null;
        }
        this.deleteIdentifier = null;
    }

    setVariableRateArea(index, path, holes = []) {
        if (index < this.variableRateAreas.length) {
            this.variableRateAreas[index].del();
            this.variableRateAreas[index] = null;
            var allPaths = holes;
            allPaths.unshift(path);

            var identifier = {
                "type": "variable",
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
        Converts each polygon (Hazard Area, Variable Rate Area) contained within this object to its simplest form.
        A polygon can be simplified if:
            - Its inner and outer boundaries remain the same after removing one of its vertices.
            - The polygon has atleast 4 vertices
        Method:
            - Get path for polygon with and without a given point
            - if (pathWithPoint + buffer).covers(pathWithoutPoint) && (pathWithoutPoint + buffer).covers(pathWithPoint)
                - There are boundaries are the same, continue with the pathWithoutPoint
    */
    simplify() {
        let gF = new jsts.geom.GeometryFactory();
        // Simplify Hazard Areas
        let newHazards = [];
        for (let i = 0; i < this.getNumHazard(); i++) {
            let hazard = AppArea.createJstsPolygon(gF, this.getHazard(i).getPoly());
            if (hazard) {
                let hazardCoords = this.jstsCoordsToShellHoles(hazard.getCoordinates());
                for (let j = 1; j < hazardCoords.shell.length - 1; j++) {
                    let shellWithPoint = hazardCoords.shell.slice();
                    let shellWithoutPoint = shellWithPoint.slice();
                    shellWithoutPoint.splice(j, 1);
                    if (shellWithPoint.length > 3 && shellWithoutPoint.length > 3) {
                        let polygonWithPoint = gF.createPolygon(gF.createLinearRing(shellWithPoint), gF.createLinearRing(hazardCoords.holes));
                        let polygonWithoutPoint = gF.createPolygon(gF.createLinearRing(shellWithoutPoint), gF.createLinearRing(hazardCoords.holes));
                        let polygonWithPointBuffered = polygonWithPoint.buffer(AppArea.buffer, 1, jsts.operation.buffer.BufferParameters.CAP_SQUARE);
                        let polygonWithoutPointBuffered = polygonWithoutPoint.buffer(AppArea.buffer, 1, jsts.operation.buffer.BufferParameters.CAP_SQUARE);
                        if (polygonWithPointBuffered.covers(polygonWithoutPoint) && polygonWithoutPointBuffered.covers(polygonWithPoint)) {
                            hazardCoords.shell = shellWithoutPoint.slice();
                        }
                    }
                }
                hazardCoords.shell = hazardCoords.shell.map((coord) => {
                    return {
                        'lat': coord.x,
                        'lng': coord.y
                    };
                });
                hazardCoords.holes = hazardCoords.holes.map((coord) => {
                    return {
                        'lat': coord.x,
                        'lng': coord.y
                    };
                });
                newHazards.push(hazardCoords);
            }
        }
        while (this.getNumHazard() > 0) { this.removeHazard(0); }
        for (let i = 0; i < newHazards.length; i++) {
            this.addHazard(newHazards[i].shell, newHazards[i].holes);
        }


        // Simplify Variable Rate Areas
        let newVRAs = [];
        for (let i = 0; i < this.getNumVariableRateAreas(); i++) {
            let vra = AppArea.createJstsPolygon(gF, this.getVariableRateArea(i).getPoly());
            if (vra) {
                let vraCoords = this.jstsCoordsToShellHoles(vra.getCoordinates());
                for (let j = 1; j < vraCoords.shell.length - 1; j++) {
                    let shellWithPoint = vraCoords.shell.slice();
                    let shellWithoutPoint = shellWithPoint.slice();
                    shellWithoutPoint.splice(j, 1);
                    if (shellWithPoint.length > 3 && shellWithoutPoint.length > 3) {
                        let polygonWithPoint = gF.createPolygon(gF.createLinearRing(shellWithPoint), gF.createLinearRing(vraCoords.holes));
                        let polygonWithoutPoint = gF.createPolygon(gF.createLinearRing(shellWithoutPoint), gF.createLinearRing(vraCoords.holes));
                        let polygonWithPointBuffered = polygonWithPoint.buffer(AppArea.buffer, 1, jsts.operation.buffer.BufferParameters.CAP_SQUARE);
                        let polygonWithoutPointBuffered = polygonWithoutPoint.buffer(AppArea.buffer, 1, jsts.operation.buffer.BufferParameters.CAP_SQUARE);
                        if (polygonWithPointBuffered.covers(polygonWithoutPoint) && polygonWithoutPointBuffered.covers(polygonWithPoint)) {
                            vraCoords.shell = shellWithoutPoint.slice();
                        }
                    }
                }
                vraCoords.shell = vraCoords.shell.map((coord) => {
                    return {
                        'lat': coord.x,
                        'lng': coord.y
                    };
                });
                vraCoords.holes = vraCoords.holes.map((coord) => {
                    return {
                        'lat': coord.x,
                        'lng': coord.y
                    };
                });
                newVRAs.push(vraCoords);
            }
        }
        while (this.getNumVariableRateAreas() > 0) { this.removeVariableRateArea(0); }
        for (let i = 0; i < newVRAs.length; i++) { this.addVariableRate(newVRAs[i].shell, newVRAs[i].holes); }
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
        try {

            if (this.getPoly() == null) { return null; }
            var gF = new jsts.geom.GeometryFactory();
            var temp;

            temp = AppArea.createJstsPolygon(gF, this.getPoly());
            temp = AppArea.getGeoShellsHoles(temp);
            var appArea = AppArea.shellsHolesToCoords(temp);

            var hazards = [];
            for (var i = 0; i < this.getNumHazard(); i++) {
                temp = AppArea.createJstsPolygon(gF, this.getHazard(i).getPoly());
                temp = AppArea.getGeoShellsHoles(temp);
                temp = AppArea.shellsHolesToCoords(temp);
                hazards.push(temp);
            }

            var vras = [];
            for (i = 0; i < this.getNumVariableRateAreas(); i++) {
                temp = AppArea.createJstsPolygon(gF, this.getVariableRateArea(i).getPoly());
                temp = AppArea.getGeoShellsHoles(temp);
                temp = AppArea.shellsHolesToCoords(temp);
                vras.push(temp);
            }

            var json = {
                "ApplicationArea": appArea,
                "Hazards": hazards,
                "VariableRateAreas": vras
            };

            return json;
        } catch (e) {
            console.log(e);
        }
    }

    trimHazards() {
        var trimmed = [];
        var outer = this.getPoly();
        var inner, result;
        for (var i = 0; i < this.getNumHazard(); i++) {
            inner = this.getHazard(i).getPoly();
            result = AppArea.trimPolygon(inner, outer);
            if (result != null) {
                for (var j = 0; j < result.length; j++) {
                    trimmed.push(result[j]);
                }
            }
        }

        // clear hazards
        for (let i = this.getNumHazard() - 1; i >= 0; i--) {
            this.removeHazard(i);
        }
        // Add trimmed hazards
        for (let i = 0; i < trimmed.length; i++) {
            this.addHazard(trimmed[i].shell, trimmed[i].holes);
        }

    }

    trimVariableRateAreas() {
        var outer = this.getPoly();
        var inner, result;
        var trimmed = [];

        // Trim variable rate ares to be within application area
        for (var i = 0; i < this.getNumVariableRateAreas(); i++) {
            inner = this.getVariableRateArea(i).getPoly();
            result = AppArea.trimPolygon(inner, outer);
            if (result != null) {
                for (var j = 0; j < result.length; j++) { trimmed.push(result[j]); }
            }
        }

        // clear vras
        while (this.getNumVariableRateAreas() > 0) {
            this.removeVariableRateArea(0);
        }

        // Add trimmed vras
        for (let i = 0; i < trimmed.length; i++) {
            this.addVariableRate(trimmed[i].shell, trimmed[i].holes);
        }


        // Trim variable rate ares to not overlap with any hazards
        var vra, haz;
        for (let i = 0; i < this.getNumHazard(); i++) {
            // Reset trimmed
            trimmed = [];
            haz = this.getHazard(i).getPoly();
            for (let j = 0; j < this.getNumVariableRateAreas(); j++) {
                vra = this.getVariableRateArea(j).getPoly();
                result = AppArea.getDifference(vra, haz);
                if (result != null) {
                    for (let k = 0; k < result.length; k++) { trimmed.push(result[k]); }
                }
            }
            // clear hazards
            while (this.getNumVariableRateAreas() > 0) { this.removeVariableRateArea(0); }
            // Add trimmed hazards
            for (let i = 0; i < trimmed.length; i++) { this.addVariableRate(trimmed[i].shell, trimmed[i].holes); }
        }
    }

    unionHazards() {
        // Return now if only 1 hazard is left, not necessary but decreases time by one loop
        if (this.getNumHazard() <= 1) { return true; }

        // Setup variables
        var i = 0;
        var numHazards = this.getNumHazard();
        var temp1, temp2, result;
        var unionOccured = false;

        while (i < numHazards) {
            // Reset bool which indicates if a union was found
            unionOccured = false;

            // Get first hazard to compare with rest for union
            temp1 = this.getHazard(i);

            // Loop through hazards and compare
            for (var j = 0; j < numHazards; j++) {

                // If not the same hazard
                if (j != i) {

                    // Get the other hazard and find the union of the two
                    temp2 = this.getHazard(j);
                    result = AppArea.unionPolygons(temp1.getPoly(), temp2.getPoly());

                    // Check if the two hazards were actually unioned (they interesected and a new path was made)
                    if (result.unioned == 1) {

                        // Remove the original hazard at index i
                        this.removeHazard(i);

                        // Remove the original hazard at index j
                        // But adjust for shift from deletion of i
                        if (i < j) { this.removeHazard(j - 1); }
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
            if (unionOccured) { i = 0; }

            // Return now if only 1 hazard is left, not necessary but decreases time by one loop
            if (numHazards <= 1) { return; }
        }
    }

    unionVariableRateAreas() {
        if (this.getNumVariableRateAreas() <= 1) { return; }
        let unionOccured = false;
        do {
            unionOccured = false;
            for (let i = 0; ((i < this.getNumVariableRateAreas()) && !unionOccured); i++) {
                let temp1 = this.getVariableRateArea(i);
                for (let j = 0; ((j < this.getNumVariableRateAreas()) && !unionOccured); j++) {
                    if (j != i) {
                        let temp2 = this.getVariableRateArea(j);
                        let result = AppArea.unionPolygons(temp1.getPoly(), temp2.getPoly());
                        if (result.unioned == 1) {
                            unionOccured = true;
                            if (i > j) {
                                this.removeVariableRateArea(i);
                                this.removeVariableRateArea(j);
                            } else {
                                this.removeVariableRateArea(j);
                                this.removeVariableRateArea(i);
                            }
                            this.addVariableRate(result.shell, result.holes);
                        }
                    }
                }
            }
        } while (unionOccured);
    }

    validateAndFix() {
        try {
            if (this.getPoly() == null) { return false; }
            if (!this.deleteNonPolys()) { return false; }
            if (!this.deleteSelfIntersections()) { return false; }
            this.unionHazards();
            this.trimHazards();
            this.unionVariableRateAreas();
            this.trimVariableRateAreas();
            this.simplify();
            return true;
        } catch (e) {
            console.log(e);
        }
        return false;
    }

    static covers(outer, inner) {
        var gF = new jsts.geom.GeometryFactory();

        var jstsInner = AppArea.createJstsPolygon(gF, inner);
        var jstsOuter = AppArea.createJstsPolygon(gF, outer);

        jstsInner.normalize();
        jstsOuter.normalize();

        return jstsOuter.covers(jstsInner);
    }

    /*
        Given a jsts geometry factory and a Google Maps Polygon
        Returns a jsts polygon on mutlipolygon
        Errors on polygon with less than 3 unique points (2d)
    */
    static createJstsPolygon(geometryFactory, polygon) {
        if (!polygon) { return null; }
        var path = polygon.getPaths();

        // Get path of outer shell
        var coordinates = path.getAt(0).getArray().map(function name(coord) {
            return new jsts.geom.Coordinate(coord.lat(), coord.lng());
        });
        if (coordinates.length < 3) { return null; }
        if (coordinates[0].compareTo(coordinates[coordinates.length - 1]) != 0) {
            coordinates.push(coordinates[0]);
        }
        var shell = geometryFactory.createLinearRing(coordinates);

        // Get paths of holes
        var holes = [];
        for (var i = 1; i < path.getLength(); i++) {
            coordinates = path.getAt(i).getArray().map(function name(coord) {
                return new jsts.geom.Coordinate(coord.lat(), coord.lng());
            });
            if (coordinates[0].compareTo(coordinates[coordinates.length - 1]) != 0) {
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
        try {
            var gF = new jsts.geom.GeometryFactory();

            var jstsPoly = AppArea.createJstsPolygon(gF, poly);
            var jstsPolyRemove = AppArea.createJstsPolygon(gF, polyRemove)

            if (!jstsPoly) { return null; }
            if (!jstsPolyRemove) { return poly; }

            // jstsPoly.normalize();
            // jstsPolyRemove.normalize();

            let difference = jstsPoly.difference(jstsPolyRemove.buffer(AppArea.buffer, 1, jsts.operation.buffer.BufferParameters.CAP_SQUARE));

            var shellsHoles = AppArea.getGeoShellsHoles(difference);

            var result = AppArea.shellsHolesToCoords(shellsHoles);

            return result;
        } catch (e) {
            console.log(e);
            return null;
        }
    }

    /*
        Takes in a geometry and returns an array of
        {
            shell   - (Google Linear Ring) the outer path
            [holes]   - (Google Linear Ring) the inner paths, representing holes (if any)
        }
    */
    static getGeoShellsHoles(jstsGeom) {
        if (!jstsGeom) { return []; }
        var result = [];
        var tempHoles;
        var tempGeo;
        var numGeometries = jstsGeom.getNumGeometries();

        if (numGeometries < 1) { return []; }

        if (numGeometries == 1) {
            tempHoles = [];
            for (var j = 0; j < jstsGeom.getNumInteriorRing(); j++) {
                tempHoles.push(jstsGeom.getInteriorRingN(j));
            }
            result.push({
                "shell": jstsGeom.getExteriorRing(),
                "holes": tempHoles
            });
            return result;
        }

        for (var i = 0; i < numGeometries; i++) {
            tempHoles = [];
            tempGeo = jstsGeom.getGeometryN(i);
            for (j = 0; j < tempGeo.getNumInteriorRing(); j++) {
                tempHoles.push(tempGeo.getInteriorRingN(j));
            }
            result.push({
                "shell": tempGeo.getExteriorRing(),
                "holes": tempHoles
            });
        }
        return result;
    }

    static googlePathToAcreage(path) {
        var area = google.maps.geometry.spherical.computeArea(path); // square meters
        var sqAcres = area / 4046.8564224; // to square acres 
        if (sqAcres < 0.00001) { return 0; }
        return sqAcres;
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
        for (var i = 0; i < coordinates.length; i++) {
            coordTemp = coordinates.getAt(i);
            newCoord = {
                'lat': coordTemp.lat(),
                'lng': coordTemp.lng()
            };
            if (unique.indexOf(newCoord) == -1) {
                unique.push(newCoord);
            }
        }
        return unique.length;
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
        for (var i = 0; i < shellsHoles.length; i++) {
            tempShell = AppArea.getCoords(shellsHoles[i].shell);
            tempHoles = [];
            for (var j = 0; j < shellsHoles[i].holes.length; j++) {
                tempHoles.push(AppArea.getCoords(shellsHoles[i].holes[j]));
            }
            result.push({
                "shell": tempShell,
                "holes": tempHoles
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

        if (!jstsInner.intersects(jstsOuter)) { return null; }
        var intersection;
        if (jstsOuter.buffer(AppArea.buffer, 1, jsts.operation.buffer.BufferParameters.CAP_BUTT).covers(jstsInner)) {
            intersection = jstsInner;
        } else {
            intersection = jstsInner.intersection(jstsOuter);
        }

        var shellsHoles = AppArea.getGeoShellsHoles(intersection);
        var result = AppArea.shellsHolesToCoords(shellsHoles);
        return result;
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

        if (!jstsPoly1 && !jstsPoly2) { return { "unioned": 0 }; }

        let result;
        if (!jstsPoly1) { result = jstsPoly2; }
        else if (!jstsPoly2) { result - jstsPoly1; }
        else {
            jstsPoly1.normalize();
            jstsPoly2.normalize();
            if (!jstsPoly1.intersects(jstsPoly2) || jstsPoly1.touches(jstsPoly2)) { return { "unioned": 0 }; }
            var unioned = jstsPoly1.union(jstsPoly2);
            var shellsHoles = AppArea.getGeoShellsHoles(unioned);
            result = AppArea.shellsHolesToCoords(shellsHoles);
        }

        var shell = result[0].shell;
        var holes = result[0].holes;

        return {
            "shell": shell,
            "holes": holes,
            "unioned": 1
        };
    }
}

/*      FUNCTIONS      */

function promptAndDelete(identifier) {
    // Havent found a good way to add event listeners to children polygons, and delete themselves
    // after clicking, so using a named instance variable for now
    // Named instance variable for AppArea is assumed to be appArea

    // check if drawing mode is set to delete
    if (drawModeControl.getCurrent() != "Delete") { return; } // also instanced variable (drawModeControl)

    if (appArea == null) { return; }
    var index = appArea.getIndexOfIdentifier(identifier.id, identifier.type);
    if (index == -1) { return; }
    var centroid;

    if (identifier.type == "hazard") {
        centroid = appArea.getHazard(index).getCentroid();
    } else if (identifier.type == "variable") {
        centroid = appArea.getVariableRateArea(index).getCentroid();
    } else { return; }

    // function to clear markers and infowindow
    appArea.resetGlobals();

    appArea.deleteIdentifier = identifier;

    var marker = new google.maps.Marker({
        position: centroid,
        map: appArea.getMap()
    });

    var infoWindow = new google.maps.InfoWindow({ content: "" });


    // Couldn't pass values easily in content string, utilizing global variable instead
    infoWindow.setContent('<button type="button" onClick="deleteSubPoly()">Delete</button>');
    google.maps.event.addListener(infoWindow, 'closeclick', function () {
        appArea.resetGlobals();
    });

    infoWindow.open(appArea.getMap(), marker);
    appArea.marker = marker;
    appArea.infoWindow = infoWindow;
}

function deleteSubPoly() {
    if ((appArea != null) && (appArea.deleteIdentifier != null)) {
        // console.log(appArea.deleteIdentifier);
        index = appArea.getIndexOfIdentifier(appArea.deleteIdentifier.id, appArea.deleteIdentifier.type);
        if (appArea.deleteIdentifier.type == "hazard") {
            appArea.removeHazard(index);
        } else if (appArea.deleteIdentifier.type = "variable") {
            appArea.removeVariableRateArea(index);
        }
        appArea.resetGlobals();
        updateStats();
    }
}

// http://www.jacklmoore.com/notes/rounding-in-javascript/
function round(value, decimals) {
    return Number(Math.round(value + 'e' + decimals) + 'e-' + decimals);
}