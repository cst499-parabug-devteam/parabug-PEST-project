"use strict";
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
    constructor(map, path, hazards, vRAs) {
        hazards = (hazards) ? hazards : [];
        vRAs = (vRAs) ? vRAs : [];
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
            zIndex: 1,
        });
        this.poly.setMap(this.map);
    }

    addHazard(path, holes) {
        holes = (holes) ? holes : [];
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

    addVariableRate(path, holes) {
        holes = (holes) ? holes : [];
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

    createVariableRatePoly(paths, id) {
        var poly = new google.maps.Polygon({
            paths: paths,
            strokeColor: '#000000',
            strokeOpacity: 1,
            strokeWeight: 1,
            fillColor: AppArea.vrFill,
            fillOpacity: AppArea.vrOpacity,
            zIndex: 3,
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
        type = (type) ? type : null;
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
        let appArea = this.getAdjustedArea(); // get app area in acres
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

    setVariableRateArea(index, path, holes) {
        holes = (holes) ? holes : [];
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
            let appArea = AppArea.shellsHolesToCoords(temp);

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
            // Simplify currently bugged: vra's made with hazards internally get deleted
            // this.simplify();
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

AppArea.buffer = 0.0000005;
AppArea.fill = "#FFFF00";
AppArea.opacity = 0.6;
AppArea.hazardFill = "#FF0000";
AppArea.hazardOpacity = 0.7;
AppArea.vrFill = "#CCCCCC";
AppArea.vrOpacity = 0.6;


class CustomOverlay extends google.maps.OverlayView {
    constructor(corners, image, name = "Unnamed Layer", description = "") {
        super();
        this.corners_ = corners;
        this.image_ = image;
        this.div_ = null;
        this.opacity_ = 100;
        this.bounds_ = new google.maps.LatLngBounds(
            new google.maps.LatLng(corners.lowerLeft[1], corners.lowerLeft[0]),
            new google.maps.LatLng(corners.upperRight[1], corners.upperRight[0])
        );
        this.name_ = name;
        this.description_ = description;
        this.center_ = this.bounds_.getCenter();
    }

    draw() {
        // We use the south-west and north-east
        // coordinates of the overlay to peg it to the correct position and size.
        // To do this, we need to retrieve the projection from the overlay.
        const overlayProjection = this.getProjection();
        // Retrieve the south-west and north-east coordinates of this overlay
        // in LatLngs and convert them to pixel coordinates.
        // We'll use these coordinates to resize the div.
        const sw = overlayProjection.fromLatLngToDivPixel(
            this.bounds_.getSouthWest()
        );
        const ne = overlayProjection.fromLatLngToDivPixel(
            this.bounds_.getNorthEast()
        );

        // Resize the image's div to fit the indicated dimensions.
        if (this.div_) {
            this.div_.style.left = sw.x + "px";
            this.div_.style.top = ne.y + "px";
            this.div_.style.width = ne.x - sw.x + "px";
            this.div_.style.height = sw.y - ne.y + "px";
        }
    }

    getCenter() {
        return this.center_;
    }

    getName() {
        return this.name_;
    }

    getOpacity() {
        return this.opacity_;
    }

    /**
     * onAdd is called when the map's panes are ready and the overlay has been
     * added to the map.
     */
    onAdd() {
        this.div_ = document.createElement("div");
        this.div_.style.borderStyle = "none";
        this.div_.style.borderWidth = "0px";
        this.div_.style.position = "absolute";
        // this.div_.style.opacity = "0.5";
        // Create the img element and attach it to the div.
        const img = document.createElement("img");
        img.src = this.image_;
        img.style.width = "100%";
        img.style.height = "100%";
        img.style.position = "absolute";
        this.div_.appendChild(img);
        // Add the element to the "overlayLayer" pane.
        const panes = this.getPanes();
        panes.overlayLayer.appendChild(this.div_);
    }

    /**
     * The onRemove() method will be called automatically from the API if
     * we ever set the overlay's map property to 'null'.
     */
    onRemove() {
        if (this.div_) {
            this.div_.parentNode.removeChild(this.div_);
            this.div_ = null;
        }
    }

    setOpacity(percent) {
        this.div_.style.opacity = (percent/100);
        this.opacity_ = percent;
    }
}

class OverlayManager {
    constructor(map) {
        // Google Maps map to display overlays on
        this.map = map;
        // Variable to hold various data used for different types of overlays
        this.data = {};
        // Variable to manage display state of overlays
        this.overlayVisible = false;

        /* Assumed Element IDs or Classes -> Change Later? */
        // Div used for createAlert function
        this.alertDivID = 'top-alert';
        // Overlay display settings elements (should only be shown when an overlay is imported)
        this.displaySettingsDivID = 'overlay-settings';
        this.displaySettingsDivContentID = 'overlay-settings-content';
        // Class of menu item elements which should only be shown when an overlay is imported
        this.menuOptionsClass = 'overlay-visible-item';
    }

    addFeatureDisplayOptions() {
        const that = this;
        const id = "feature-layer-opacity";
        $('#' + that.displaySettingsDivContentID).append("<h6>Features</h6>").append(
            $("<div>Opacity: </div>").append(
                $('<input type="range" min="0" max="100" value="60" id="'+id+'">').on("input", function() {
                    $("#"+id+"-display").text($(this).val()+"%");
                    that.applyDisplaySettings();
                })
            ).append('<span id="'+id+"-display"+'">60%</span>')
        ).append('<hr>');
    }

    /**
     * Adds a JSON (GeoJson) overlay to the current map based on the current file
     */
    addGeoJson() {
        this.createAlert("Loading GeoJson File", 10000, "info");
        // Save instance of this to prevent issues in file reader
        const that = this;
        const fr = new FileReader();
        fr.onload = function(e) {
            const geoJson = JSON.parse(e.target.result);
            // Save the geoJson features
            that.data.features = geoJson.features;
            // Parse the JSON text and add it directly to the map
            that.map.data.addGeoJson(geoJson);
            // Add general display settings inputs for features
            that.addFeatureDisplayOptions();
            // Cycle through features added to the map and manually set their display settings
            that.setMapFeatureDisplay();
            // Overlay has been imported, so display overlay-related menu options
            that.setOverlayMenuOptionDisplay();
            $('#' + that.displaySettingsDivID).show();
            that.createAlert("Loading Complete", 3000, "success");
            // Center map display on the newly added overlay
            that.centerMapOnOverlay();
        };
        fr.onerror = function(e) {
          that.createAlert("Failed to import GeoJson overlay", 10000, "error");
          // Overlay failed to import, make sure overlay-related menu options are hidden
          that.setOverlayMenuOptionDisplay(false);
        }
        // Read the JSON file as text to be easily parsed
        fr.readAsText(that.file);
    }

    /**
     * Adds a Tif (GeoTiff) overlay to the current map based on the current file
     * Format Specification: http://duff.ess.washington.edu/data/raster/drg/docs/geotiff.txt
     * 
     * @param {String} clearPixel the "R,G,B" String specifying the color to be removed
     * from the image on import. This is useful to remove pixels which were added unintentionally
     * to fill in areas of the image that were meant to be completely transparent, but weren't saved
     * as such in the GeoTiff format. clearPixel Format: "integer,integer,integer" where 0 <= integer <= 255
     * 
     * Required libraries (currently browserified):
     *  - geotiff.js [https://github.com/geotiffjs/geotiff.js/]
     *  - tiff.js [https://github.com/seikichi/tiff.js]
     *  - @esri/proj-codes [https://github.com/Esri/projection-engine-db-doc]
     *  - proj4 [https://github.com/proj4js/proj4js]
     */
    async addGeoTiff(clearPixel) {
        // Retrieve a GeoTiff object from the current file and retrieve its image data
        const tiff = await GeoTIFF.fromBlob(this.file);
        const image = await tiff.getImage();
        // Convinience variables used to access projection information
        const fd = image.getFileDirectory();
        const gk = image.getGeoKeys();

        // Obtain the GeoKey which specifies the projection or coordinate system the source file uses
        // (We need to convert to a system which can be used on Google Maps -> EPSG:4326)
        let sourceGeoKey = gk.ProjectedCSTypeGeoKey;
        sourceGeoKey = (!sourceGeoKey) ? gk.GeographicTypeGeoKey : sourceGeoKey;
        if (!sourceGeoKey) {
            // If this metadata is not found we cannot convert the file, error
            this.createAlert("Geokey Missing For GeoTiff File", 3000, "error");
            this.reset();
            return;
        }
        sourceGeoKey = parseInt(sourceGeoKey);

        // User Defined Geokey (find out how to deal with these)
        if (sourceGeoKey === 32767) {
          createAlert("Custom Geokey (Projection System) used in GeoTiff file. This feature is not yet supported.", 10000, "error");
          this.reset();
          return;
        }

        // Import libraries through which we can get all the coordinate reference system (crs) info for our GeoKey
        const codes = require('@esri/proj-codes');
        const crs = codes.lookup(sourceGeoKey);
        const targetProjection = proj4('EPSG:4326');
        const sourceProjection = proj4(crs.wkt); // use the well-known text (wkt)

        // We now need to get what the boundaries of our image would be in the old projection / coordinate system
        // This process will vary based on what metadata was supplied (refer to Format Specification)
        let cw, cs, ce, cn;
        if (fd.ModelTiepoint && fd.ModelPixelScale) {
            let mt = fd.ModelTiepoint, mp = fd.ModelPixelScale;
            let ih = fd.ImageLength, iw = fd.ImageWidth;
            cw = mt[3] - mt[0] * mp[0];
            cs = mt[4] - (ih - mt[1]) * mp[1];
            ce = mt[3] + (iw - mt[0]) * mp[0];
            cn = mt[4] + mt[1] * mp[1];
        } else if (fd.ModelTransformation) {
            let md = fd.ModelTransformation;
            let ih = fd.ImageLength, iw = fd.ImageWidth;
            cw = md[3];
            cn = md[7];
            ce = md[0]*iw + md[3];
            cs = md[5]*ih + md[7];      
        } else {
            // Bounds cannot be determined becasue transformation information is missing, error
            createAlert("No transformation information provided in GeoTiff", 3000, "error");
            this.reset();
            return;
        }

        // Using proj4, convert the old image boundaries to our target projection system
        let bounds = {
          upperLeft: proj4(sourceProjection, targetProjection, [cw,cn]),
          lowerLeft: proj4(sourceProjection, targetProjection, [cw,cs]),
          upperRight: proj4(sourceProjection,targetProjection, [ce,cn]),
          lowerRight: proj4(sourceProjection, targetProjection, [ce,cs]),
          center: proj4(sourceProjection, targetProjection, [(cw+ce)/2,(cn+cs)/2])
        }

        // Using tiff.js we will generate a html canvas element from our tiff image data
        // Which we can convert to png and overlay on our map
        let Tiff = require('tiff.js');
        // Save instance of "this" to prevent issues in xhr
        const that = this;
        let xhr = new XMLHttpRequest();
        xhr.onload = function (e) {
            if (xhr.readyState==4 && xhr.status==200){
                try {
                    // Create Tiff object from current file as array buffer
                    let tiff = new Tiff({buffer: xhr.response});
                    // Convert Tiff object to canvas element
                    const canvas = tiff.toCanvas();
                    // If a pixel was selected to be cleared, remove any instance of that pixel on the canvas
                    if (clearPixel !== "") {
                        clearPixel = clearPixel.split(",");
                        const context = canvas.getContext("2d");
                        for(let x = 0; x < canvas.width; x++) {
                            for(let y = 0; y < canvas.height; y++) {
                                const pD = context.getImageData(x, y, 1, 1);
                                if ((pD.data[0]==clearPixel[0])&&(pD.data[1]==clearPixel[1])&&(pD.data[2]==clearPixel[2])) {
                                    context.clearRect( x, y, 1, 1 );
                                }
                            }
                        }
                    }
                    // Create a CustomOverlay using the converted bounds and the image data as a png
                    that.data.customOverlay = new CustomOverlay(bounds, canvas.toDataURL("image/png", 1), fd.PageName, fd.ImageDescription);
                    that.data.customOverlay.setMap(map);
                    // Get the viewing bounds
                    const view = new google.maps.LatLngBounds();
                    for (const [key, value] of Object.entries(bounds)) { view.extend({lat: value[1], lng: value[0]}); }
                    // Set the map view to the calculated viewing bounds
                    that.map.fitBounds(view);
                    // Add section in display settings for newly added tiff overlay layer
                    const id = "tiff-layer-opacity";
                    $('#' + that.displaySettingsDivContentID).append("<h6>"+that.data.customOverlay.getName()+"</h6>").append(
                        $("<div>Opacity: </div>").append(
                            $('<input type="range" min="0" max="100" value="100" id="'+id+'">').on("input", function() {
                                $("#"+id+"-display").text($(this).val()+"%");
                                that.applyDisplaySettings();
                            })
                        ).append('<span id="'+id+"-display"+'">100%</span>')
                    ).append('<hr>');
                    // Overlay has been imported, so display overlay-related menu options and prompt user
                    that.setOverlayMenuOptionDisplay(true);
                    $('#' + that.displaySettingsDivID).show();
                    that.createAlert("Loading Complete", 3000, "success");
                } catch (err) {
                    that.createAlert("Error When Parsing GeoTiff File", 3000, "error");
                    that.reset();
                }
            }
        };
        xhr.onerror = function() {
          this.createAlert("Error When Loading GeoTiff File", 3000, "error");
          this.reset();
        }
        xhr.responseType = 'arraybuffer';
        xhr.open('GET', that.fileURL);
        xhr.send();
    }

    /**
     * Before adding GeoTiff to map, prompt user to check if a filler pixel of a specified color 
     * should be removed from the image
     */
    addGeoTiffPromptAndDelay() {
        let clearPixel = prompt('Remove filler pixels for areas intended to be transparent? \n*Note: This can take minutes for large files and is not recommended on mobile devices. \n\n'
                                        + 'Enter the color (Red,Green,Blue) to be removed.\n0,0,0 - Black (Default Filler)\nEmpty Input - Leave Filler Pixels', "0,0,0");
        if (clearPixel === null) { this.reset(); return; }
        this.createAlert("Loading GeoTiff File", 10000, "info");
        // adding tiff is resource intensive, delay by 1 second to allow loading alert to come up first. (Find alternative)
        setTimeout(() => {this.addGeoTiff(clearPixel)}, 1000);
    }

    /**
     * Adds a KML overlay to the current map based on the current file
     * 
     * Required libraries (currently browserified):
     *  - @tmcw/togeojson [https://github.com/tmcw/togeojson]
     */
    addKML() {
        // Save instance of "this" to prevent issues in xhr
        const that = this;
        const xhr = new XMLHttpRequest();
        // Read the current file as an XMLDocument to be used in @tmcw/togeojson library
        xhr.onload = function() {
            try {
                if (this.status == 200) {
                    const tj = require("@tmcw/togeojson");
                    // Read the XMLDocument response, convert it to GeoJson
                    const geoJson = tj.kml(xhr.responseXML);
                    // Save the geoJson features
                    that.data.features = geoJson.features;
                    // Add the GeoJson to the map
                    that.map.data.addGeoJson(geoJson);
                    that.centerMapOnOverlay();
                    // Add general display settings inputs for features
                    that.addFeatureDisplayOptions();
                    // Cycle through features added to the map and manually set their display settings
                    that.setMapFeatureDisplay();
                    $('#' + that.displaySettingsDivID).show();
                    that.createAlert("Loading Complete", 3000, "success");
                    // Overlay has been imported, so display overlay-related menu options
                    that.setOverlayMenuOptionDisplay(true);
                } else {
                    that.createAlert("KML Failed to Load", 10000, "error");
                    that.reset();
                }
            } catch (e) {
                that.createAlert("KML Format Error", 10000, "error");
                that.reset();
            }
        }
        xhr.onerror = function() {
            that.createAlert("Error When Loading KML", 10000, "error");
            that.reset();
        }
        xhr.open("GET", that.fileURL);
        xhr.responseType = "document";
        xhr.send();
    }

    /**
     * Adds a KMZ overlay to the current map based on the current file
     * 
     * Required libraries:
     *  - geoxml3 [https://github.com/ChristopherLeeWilliams/geoxml3]
     */
    addKMZ() {
        this.createAlert("Loading KMZ File", 10000, "info");
        try {
            this.data.geoXML = new geoXML3.parser({
                map: this.map,
                singleInfoWindow: false,
                suppressInfoWindows : true,
                zoom : true,
                afterParse: (doc) => this.kmzFileParsed(doc), // Preserve "this" with arrow function
            });
            this.data.geoXML.parse(this.fileURL);
        } catch (e) {
            this.createAlert("Error When Loading KMZ", 10000, "error");
            this.reset();
        }
    }

    /**
     * Adds a Shapefile overlay to the current map based on the current file (zip)
     * Format Specification: https://www.esri.com/library/whitepapers/pdfs/shapefile.pdf
     * 
     * Required libraries:
     *  - jszip [https://github.com/Stuk/jszip]
     *  - shapefile [https://github.com/mbostock/shapefile]
     */
    addShapefileZip() {
        const that = this;
        this.createAlert("Loading Shapefile", 10000, "info");
        const JSZip = require("jszip");
        const zip = new JSZip();
        // Using jszip load the zip file asynchronously and get file contents
        zip.loadAsync(this.file).then((zip) => {
            // For shapefiles to be loaded correctly we need the SHP file and the DBF file
            // They should have the same file name, just with different extensions (.shp & .dbf)
            // Loop through the files in the zip and make sure they both exist
            let baseFileName = null;
            let hasSHP = false;
            let hasDBF = false;
            for (const [key, value] of Object.entries(zip.files)) {
              if (!baseFileName) { baseFileName = key.substr(0, key.lastIndexOf('.')); }
              if (key === baseFileName+'.shp') { hasSHP = true; } 
              else if (key === baseFileName+'.dbf') { hasDBF = true; }
            }
            if (hasSHP && hasDBF) {
                // Read both file asynchronously into arraybuffers, to be used by shapefile
                zip.file(baseFileName+'.shp').async("arraybuffer").then((shpArrayBuffer) => {
                    zip.file(baseFileName+'.dbf').async("arraybuffer").then((dbfArrayBuffer) => {
                        // Using shapefile read both buffers and generate a GeoJson object with the data
                        require("shapefile").read(shpArrayBuffer, dbfArrayBuffer).then((data) => {
                            // Save the geoJson features
                            that.data.features = data.features;
                            // Add the GeoJson to the map and update overlay display settings
                            that.map.data.addGeoJson(data);
                            // Add general display settings inputs for features
                            that.addFeatureDisplayOptions();
                            that.setMapFeatureDisplay();
                            // Get the bounds of the GeoJson and use this as the viewing bounds on Google Maps
                            const bbox = data.bbox;
                            const bounds = new google.maps.LatLngBounds({lng: bbox[0], lat: bbox[1]}, {lng: bbox[2], lat: bbox[3]});
                            that.map.fitBounds(bounds);
                            $('#' + that.displaySettingsDivID).show();
                            that.createAlert("Loading Complete", 3000, "success");
                            that.setOverlayMenuOptionDisplay();
                        })
                        .catch((error) => {
                            console.log(error);
                            that.createAlert("Error When Reading Shapefile Contents", 10000, "error");
                            that.reset();
                        });             
                    });
                });
            } else {
                this.createAlert("Shapefile or Corresponding DBF File Missing in Zip", 10000, "error");
                this.reset();
            }
        }, function() {
            this.createAlert("Invalid Zip File Format", 10000, "error");
            this.reset();
        });
    }

    /**
     * Update display of specified overlays (kmz, tif) with values from display settings inputs
     */
    applyDisplaySettings() {
        if (!this.overlayVisible) { return; }
        try {
            if (this.fileType === "kml" || this.fileType === "json" || this.fileType === "zip") {
                // Limit the rate at which geojson features can be updated (once every 1/10 second)
                if (!this.data.updatingFeatureDisplay) {
                    this.data.updatingFeatureDisplay = true;
                    setTimeout(() => {
                        this.setMapFeatureDisplay();
                        this.data.updatingFeatureDisplay = false;
                    }, 100);
                }
            } else if (this.fileType === "kmz") {
                this.updateKMZDisplay();
            } else if (this.fileType === "tif") {
                this.data.customOverlay.setOpacity($("#tiff-layer-opacity").val());
                this.overlayVisible = true;
            }
        } catch (e) {
          this.createAlert("Error when applying overlay display settings", 10000, "error");
        }
    }

    /**
     * Center the map viewing bounds on an overlay if present
     * May focus on one point of overlay
     */
    centerMapOnOverlay() {
        if (!this.file) { return; }
        try {
            if (this.fileType === 'kml' || this.fileType === 'zip' || this.fileType === 'json') {
                let center = null;
                // If data was added to the map in the form of GeoJson, get the first Lat,Lng point
                // Among the features and jump to that point on the map
                this.map.data.forEach(function(feature) {
                    if (!center) {
                        feature.getGeometry().forEachLatLng(function(latLng) {
                            if (!center) { center = latLng; }
                        });
                    }
                });
                this.map.setCenter(center);
            } else if (this.fileType === 'kmz') {
                // For kmz's get the center of the bounds of the first ground overlay
                // Currently referencing internal variable, may need to change
                this.map.setCenter(this.data.geoXML.docs[0].ggroundoverlays[0].bounds_.getCenter());
            } else if (this.fileType === "tif") {
                // For tif's use the custom overlay get center function
                this.map.setCenter(this.data.customOverlay.getCenter());
            }
        } catch (e) {
            this.createAlert("Failed to center on overlay", 10000, "error");
        }
    }

    /**
     * Transitions an alert in and out for the user 
     * @param {String} message The text to be dispayed in the alert
     * @param {Integer} duration The duration in milliseconds for the alert to be displayed
     * @param {String} type The theme of the message: "success", "info", "error" (set class)
     */
    createAlert(message, duration, type="success") {
        if (!this.alertDivID) { return; }
        let alertBox = $('#'+this.alertDivID);
        switch (type) {
            case "success":
                alertBox.attr("class","alert alert-success");
                break;
            case "info":
                alertBox.attr("class","alert alert-info");
                break;
            case "error": default:
                alertBox.attr("class","alert alert-danger");
                break;
        }
        alertBox.text(message);
        alertBox.fadeIn("slow");
        setTimeout(function(){ alertBox.fadeOut("slow"); }, duration);
    }

    /**
     * Function called after parsing of KMZ is complete (from GeoXML3)
     * Updates display settings menu with names and display settings of layers found in kml
     * @param {Array} doc Array of documents (kml files) sent afte kmz was parsed (currently not used)
     */
    kmzFileParsed(doc) {
        const that = this;
        this.createAlert("Loading Complete", 3000, "success");
        doc = this.data.geoXML.docs[0];
        // Generate and show overlay settings in display settings menu
        const overlaySettingsDiv = $('#' + this.displaySettingsDivContentID);
        // Populate the menu with an input for each of the different ground overlays found
        for (let i = 0; i < doc.ggroundoverlays.length ; i++) {
          const id = "kmz-layer-opacity-" + i;
          doc.ggroundoverlays[i].id_ = doc.groundoverlays[i].name + "-" + i;
          overlaySettingsDiv.append("<h6>"+doc.groundoverlays[i].name+"</h6>").append(
            $("<div>Opacity: </div>").append(
              $('<input type="range" min="0" max="100" value="100" id="'+id+'">').on("input", function() {
                $("#"+id+"-display").text($(this).val()+"%");
                that.applyDisplaySettings();
              })
            ).append('<span id="'+id+"-display"+'">100%</span>')
          ).append('<hr>');
        }
        $('#' + this.displaySettingsDivID).show();
        this.setOverlayMenuOptionDisplay();
        this.updateKMZDisplay();
    }

    /**
     * Clears the map of any overlays
     * Resets all internal variables of this instance
     * Hides overlay-related menu options
     */
    reset() {
        const that = this;
        // Clear Any Existing Overlays on the Map
        if (this.fileType) {
            switch (this.fileType) {
                case 'kml':
                case 'zip':
                case 'json':
                    this.map.data.forEach((feature) => this.map.data.remove(feature));
                    break;
                case 'kmz':
                    try {
                        const doc = this.data.geoXML.docs[0];
                        this.data.geoXML.docs = [];
                        for (let i = 0; i < doc.ggroundoverlays.length; i++) {
                          doc.ggroundoverlays[i].setMap(null);
                          doc.ggroundoverlays[i] = null;
                        }
                      } catch (e) {
                        // Continue
                      }
                    break;
                case 'tif':
                    if (this.data.customOverlay) {
                        this.data.customOverlay.setMap(null);
                        this.data.customOverlay = null;
                    }
                    break;
                default:
                    // Unknown file type, ignore.
                    break;
            }
        }

        // Clear Attributes
        if (this.fileURL) { URL.revokeObjectURL(this.fileURL); }
        this.file = null;
        this.fileType = null;
        this.data = {};

        // Clear Menu Options / Overlay-related Display
        this.setOverlayMenuOptionDisplay(false);
        $('#' + this.displaySettingsDivContentID).empty();
        $('#' + this.displaySettingsDivID).hide();
    }

    /**
     * Resets an existing overlay to its original display settings
     */
    resetDisplaySettings() {
        try {
          // Overlay Settings
          if (this.fileType === "kml" || this.fileType === "json" || this.fileType === "zip") {
            $('#feature-layer-opacity').val(60);
            $("#feature-layer-opacity-display").text("60%");
            this.setMapFeatureDisplay();
          } else if (this.fileType === "kmz") {
            const doc = this.data.geoXML.docs[0];
            for (let i = 0; i < doc.ggroundoverlays.length; i++) {
              const gO = doc.ggroundoverlays[i];
              try {
                gO.setMap(map);
                gO.setOpacity(100);
              } catch (e) {
                gO.percentOpacity_ = 100;
                gO.setMap(map);
              }
              const id = "kmz-layer-opacity-" + i;
              $("#"+id).val(100);
              $("#"+id+"-display").text("100%");
            }
            this.overlayVisible = true;
            this.updateKMZDisplay();
          } else if (this.fileType === "tif") {
            $("#tiff-layer-opacity").val(100);
            $("#tiff-layer-opacity-display").text("100%");
            this.data.customOverlay.setOpacity(100);
          }
        } catch (e) {
          this.createAlert("Error when resetting overlay display settings", 10000, "error");
        } 
    }

    /**
     * Manually sets the display settings of any overlays added to the map by way of GeoJson (kml, shapefile, and json)
     * @param {Boolean} visible Whether or not map GeoJson features should be visible (for toggling display)
     */
    setMapFeatureDisplay(visible = true) {
        const that = this;
        // This input will be a multiplier of the original opacity
        // E.g. If original opacity is .6 and the input is at 50% (.5) the resulting opacity is .3
        let opacityInput = $('#feature-layer-opacity').val()/100;
        let i = 0;
        if (visible) {
            this.map.data.setStyle((feature) => {
                let opacity, strokeWeight;
                if (that.data.features[i]) {
                    // Get property value from raw feature
                    const baseOpacity = that.data.features[i].properties["fill-opacity"];
                    opacity = (baseOpacity) ? opacityInput * baseOpacity : opacityInput;
                    strokeWeight = that.data.features[i].properties["stroke-width"];
                    strokeWeight = (strokeWeight) ? strokeWeight : 2;
                } else {
                    opacity = opacityInput;
                    strokeWeight = 2;
                }
                i++;
                return ({
                    visible: true,
                    fillColor: (feature.getProperty('fill')) ? feature.getProperty('fill') : "#000000",
                    fillOpacity: opacity,
                    strokeColor: (feature.getProperty('fill')) ? feature.getProperty('fill') : "#000000",
                    strokeWeight: (opacity == 0) ? 0 : strokeWeight
                });
            });
        } else {
            this.map.data.setStyle((feature) => { return {visible: false}; });
        }
    }

    /**
     * Clears all internal variables and overlays and sets them based on new File input
     * Currently supported formats are KML, KMZ, TIF, ZIP (ShapeFile), and JSON (GeoJson)
     */
    setOverlay(file) {
        this.reset();
        if (!file) { return; }
        this.file = file;
        this.fileURL = URL.createObjectURL(file);
        this.fileType = file.name.substr(file.name.lastIndexOf('.') + 1);
        switch (this.fileType) {
            case 'kml':
                this.addKML();
                break;
            case 'kmz':
                this.addKMZ();
                break;
            case 'tif':
                this.addGeoTiffPromptAndDelay();
                break;
            case 'zip':
                this.addShapefileZip();
                break;
            case 'json':
                this.addGeoJson();
                break;
            default:
                // Alert "Uknown File Type"
                this.reset();
                break;
        }
    }

    /**
     * @param {Booelan} visible Whether or not overlay settings should display in dropup menu
     */
    setOverlayMenuOptionDisplay(visible = true) {
        const elements = document.getElementsByClassName(this.menuOptionsClass);
        if (visible) {
          for (let i = 0; i < elements.length; i++) { elements[i].style.display = "block"; }
        } else {
          for (let i = 0; i < elements.length; i++) { elements[i].style.display = "none"; }
        }
        this.overlayVisible = visible;
      }

    /**
     * Toggles visibility of GeoJson-related overlay features on map
     */
    toggleFeatures() {
        try {
            if (this.overlayVisible) {
                this.setMapFeatureDisplay(false);
                this.overlayVisible = false;
            } else {
                this.setMapFeatureDisplay();
                this.overlayVisible = true;
            }
        } catch (e) {
            this.createAlert("Error when toggling overlay display", 10000, "error");
        }
    }

    /**
     * Toggles KMZ overlay visibility
     */
    toggleKMZOverlay() {
        try {
          const doc = this.data.geoXML.docs[0];
          if (this.overlayVisible) {
            doc.ggroundoverlays.forEach((gO) => gO.setMap(null));
            this.overlayVisible = false;
          } else {
            for (let i = 0; i < doc.ggroundoverlays.length; i++) {
              let id = "kmz-layer-opacity-" + i;
              let opacity = $('#'+id).val();
              let gO = doc.ggroundoverlays[i];
              if (opacity > 0) {
                // Set opacity before overlaying on map
                gO.percentOpacity_ = opacity;
                gO.setMap(this.map);
              } else {
                gO.setMap(null);
              }
            }
            this.overlayVisible = true;
            this.updateKMZDisplay();
          }
        } catch (e) {
          console.log("Error when toggling KMZ overlay display: " + e.message);
        }
    }

    /**
     * General function for toggling current overlay display
     */
    toggleOverlay() {
        if (this.fileType === 'kml' || this.fileType === 'zip' || this.fileType === 'json') {
            this.toggleFeatures();
        } else if (this.fileType === 'kmz') {
            this.toggleKMZOverlay();
        } else if (this.fileType === 'tif') {
            this.toggleTIFFOverlay();
        } else {
          // Unknown file type
        }
    }

    /**
     * Toggles GeoTiff overlay visibility
     */
    toggleTIFFOverlay() {
        this.overlayVisible = !this.overlayVisible;
        let current = this.data.customOverlay.getOpacity();
        if (current === 0) {
            this.data.customOverlay.setOpacity($("#tiff-layer-opacity").val());
        } else {
            this.data.customOverlay.setOpacity(0);
        }
    }

    /**
     * Manually sets the display settings of KMZ overlay
     */
    updateKMZDisplay() {
        const doc = this.data.geoXML.docs[0];
        for (let i = 0; i < doc.ggroundoverlays.length; i++) {
            const gO = doc.ggroundoverlays[i];
            const id = "kmz-layer-opacity-" + i;
            const opacity = $('#'+id).val();
            if (opacity > 0 && this.overlayVisible) {
                try {
                    gO.setMap(map);
                    gO.setOpacity(opacity);
                } catch (e) {
                    // Not yet initialized on map, edit style directly
                    gO.percentOpacity_ = opacity;
                    gO.setMap(map);
                }
                setTimeout(() => {
                    try { 
                        document.getElementById(gO.id_).style.zIndex = 10-i; 
                    } catch (e) { /* Ignore */ }
                }, 1000);
            } else {
                gO.setMap(null);
            }
        }
    }
}
