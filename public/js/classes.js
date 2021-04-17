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

            // Simplifying has current issue where a variable rate can not be made with an internal hazard area, disable for now
            // console.log("Simplifiying");
            // this.simplify();
            // console.log(this.toEasyFormat());
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
        else if (!jstsPoly2) { result = jstsPoly1; }
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


class GMapsOverlayLoader {
    constructor(fileName, fileType) {
        this.fileName = fileName;
        this.fileType = fileType;
        this.layers = [];
        this.updating = false;
    }

    addLayer(name, data) {
        /*
            Data will be in different forms for different overlays:
            - GeoJson, Shapefile, and KML: data = featureCollection
            - KMZ and GeoTiff: data = { bounds, canvas, rotation }
        */
        this.layers.push({
            name: name,
            tileSize: 5,
            colorPaletteSize: 4,
            useColorPalette: false,
            autoColorPalette: true,
            colorPalette: [],
            data: data
        });
    }

    deleteLayer(index) {
        this.layers[index].deleted = true;
    }

    generateModalPrompt() {
        createAlert("Overlay loaded Successfully", 2000, "success", (finished) => {
            const that = this;
            const modal = $('#overlay-loader-modal');
            const header = $('#overlay-loader-header');
            const body = $('#overlay-loader-body');
            header.empty();
            body.empty();
            header.append($(`<div class="row justify-content-center">${this.fileName}.${this.fileType}</div>`));
            this.layers.forEach((layer, index) => {
                body.append(that.layerToHtml(layer, index+1));
            });
            modal.show();
        });
    }

    layerToHtml(layer, index) {
        let isFeatureCollection = layer.data.type && (layer.data.type === "FeatureCollection");
        const that = this;
        /* Create Collapsible Row and Visual Toggle*/        
        const rowContent = $(`<div class="content"></div>`);
        const collapseToggleButton = $(`<button type="button" class="collapsible">${index}: ${layer.name}</button>`);
        collapseToggleButton.on("click", () => {
            collapseToggleButton.toggleClass("active");
            rowContent.toggle();
        });
        const deleteRowButton = $(`<button type="button" class="collapsible-delete">&times;</button>`)
        deleteRowButton.on("click", () => {
            that.deleteLayer(index-1);
            rowContent.empty();
            rowContent.remove();
            collapseToggleButton.remove();
            deleteRowButton.remove();
        });
        
        /* Create Tile Size Input and Display*/
        const tileSizeRow = $(`<div class="modal-row-content"></div>`);
        const tileSizeInput = $(`<input type="number" value="${layer.tileSize}" min=1 max=50>`);
        if (isFeatureCollection) { tileSizeInput.prop("disabled", true); } // Currently disable tile-ization of kml, geojson, and shp files (with featureCollections)

        tileSizeInput.on("keyup input change", function() { layer.tileSize = tileSizeInput.val(); });
        let tileSizeInputEndText = " sq.ft";
        if (isFeatureCollection) {
            tileSizeInputEndText += '<p style="color: red;"> This option is disabled for KML, GeoJson, and SHP files. Dividing into tiles in unnecessary as paths are already defined on import.</p></br>';
        } else {
            tileSizeInputEndText += "</br>";
        }
        tileSizeRow.append(`<span class="helpful-tips" title="The minimum size, in square feet, by which the layer will be broken up into.\nNote: this size is not garaunteed but is used as a starting point. 
                            The max number of tiles is restricted to prevent system crashes.">Tile Size</span>: `, tileSizeInput, tileSizeInputEndText);


        /* Create Color Palette Size Input and Display*/
        const colorPaletteSizeRow = $(`<div class="modal-row-content"></div>`);
        const colorPaletteSizeInput = $(`<input type="range" min="1" max="20" value="${layer.colorPaletteSize}">`);
        const paletteSizeDisplay = $(`<span>${layer.colorPaletteSize}</span>`);        
        colorPaletteSizeInput.on("input change keyup", function() {
            layer.colorPaletteSize = colorPaletteSizeInput.val();
            if (!that.updating) {
                that.updating = true;
                setTimeout(() => {
                    paletteSizeDisplay.text(layer.colorPaletteSize);
                    if (!layer.autoColorPalette) {
                        colorInputs.empty();
                        colorInputs.append(`<span>Color Palette: </span>`);
                        for (let i = 0 ; i < layer.colorPaletteSize; i++) {
                            if (!layer.colorPalette[i]) {
                                layer.colorPalette[i] = "#000000";
                            }
                            const colorInput = $(`<input type="color" value="${layer.colorPalette[i]}">`);
                            colorInput.on("change", function() {
                                layer.colorPalette[i] = colorInput.val();
                            });
                            colorInputs.append(colorInput);
                        }
                    }
                    that.updating = false;
                }, 50);
            }
        });
        colorPaletteSizeRow.append(`<span class="helpful-tips" title="The number of colors that will be used to make up the overlay's color palette">Color Palette Size</span>: `, colorPaletteSizeInput, " ", paletteSizeDisplay, `</br>`);

        /* Create "Use Color Palette" Toggle and Display */
        const useColorPaletteInput =  $(`<input type="checkbox" ${(layer.useColorPalette) ? "checked" : "" }>`);
        const useColorPaletteRow = $(`<div class="modal-row-content"></div>`).append(`<span>Use Color Palette</span>  `, useColorPaletteInput);
        
        /* Create "Auto Generate Color Palette" Toggle and Display */
        const colorInputs = $(`<div></div>`);
        const autoColorPaletteInput = $(`<input type="checkbox" ${(layer.autoColorPalette)?"checked":""}>`);
        autoColorPaletteInput.on("change", function() {
            layer.autoColorPalette = this.checked;
            if (this.checked) {
                colorInputs.empty();
            } else {
                colorInputs.append(`<span>Color Palette: </span>`);
                for (let i = 0 ; i < layer.colorPaletteSize; i++) {
                    layer.colorPalette[i] = (!layer.colorPalette[i]) ? "#000000" : layer.colorPalette[i];
                    const colorInput = $(`<input type="color" value=${layer.colorPalette[i]}>`);
                    colorInput.on("change", function() {
                        layer.colorPalette[i] = colorInput.val();
                    });
                    colorInputs.append(colorInput);
                }
            }
        });
        const autoColorPaletteRow = $(`<div class="modal-row-content"></div>`).append(`<span>Auto Generate Color Palette</span>  `, autoColorPaletteInput);
        const colorPaletteRow = $(`<div class="modal-row-content"></div>`).append(colorInputs);

        /* Set up display toggle based on if a color palette will be used or not */
        useColorPaletteInput.on("change", function() {
            layer.useColorPalette = this.checked;
            if (this.checked) {
                colorPaletteSizeRow.show();
                autoColorPaletteRow.show();
                colorPaletteRow.show();
            } else {
                colorPaletteSizeRow.hide();
                autoColorPaletteRow.hide();
                colorPaletteRow.hide();
            }
        });

        /* Set up intial display state of rows which toggle on and off */
        if (layer.useColorPalette) {
            colorPaletteSizeRow.show();
            autoColorPaletteRow.show();
            colorPaletteRow.show();
        } else {
            colorPaletteSizeRow.hide();
            autoColorPaletteRow.hide();
            colorPaletteRow.hide();
        }

        /* Add all rows to row content element*/
        // rowContent.append(tileSizeRow, useColorPaletteRow, colorPaletteSizeRow, autoColorPaletteRow, colorPaletteRow);
        // Only add tile size input for now, color palette is still experimental
        rowContent.append(tileSizeRow);

        /* Append Collapsible Row and Content*/
        const collapsibleRow = $(`<span></span>`).append(collapseToggleButton, deleteRowButton);
        return $(`<div></div>`).append(collapsibleRow, rowContent);
    }

    setTileSize(index, feet) {
        this.layers[index].tileSize = feet;
    }

    shiftDown(index) {
        if (index > 0) {
            const temp = this.layers[index-1];
            this.layers[index-1] = this.layers[index];
            this.layers[index] = temp;
        }
    }

    shiftUp(index) {
        if (index < this.layers.length-1) {
            const temp = this.layers[index+1];
            this.layers[index+1] = this.layers[index];
            this.layers[index] = temp;
        }
    }
}

class GMapsOverlayLayer {
    constructor(map, polygons, bounds, name="Untitled Layer", description="", isVisible=false, parent) {
        this.map = map;
        this.polygons = polygons;
        this.bounds = bounds;
        this.name = name;
        this.description = description;
        this.isVisible = isVisible;
        this.parent = parent;
        this.polygons.forEach((polygon) => {
            // External Events
            polygon.addListener("click", (event) => autoGenerateVRAsFromSelection(event));
            polygon.addListener("mousemove", (event) => magnifierMove(event));
        });
    }

    applyColorPalette(colorPalette=null) {
        if (!colorPalette) {
            if (!this.colorPalette) {
                this.generateColorPalette();
            }
            colorPalette = this.colorPalette;
        }
        else {
            this.colorPalette = colorPalette;
        }

        let colorMap = {};
        let opacity = null;
        let zIndex = null

        this.polygons.forEach((polygon) => {
            let originalColor = polygon.fillColor;
            let closestPaletteColor;
            colorPalette.forEach((color) => {
                if (!closestPaletteColor) {
                    closestPaletteColor = color;
                } else {
                    let oldDistance = this.getColorDistance(originalColor, closestPaletteColor);
                    let newDistance = this.getColorDistance(originalColor, color);
                    if (newDistance < oldDistance) {
                        closestPaletteColor = color;
                    }
                }
            });
            if (!colorMap[closestPaletteColor]) { colorMap[closestPaletteColor] = []; }
            polygon.getPaths().getArray().forEach((path) => {
                colorMap[closestPaletteColor] = colorMap[closestPaletteColor].concat([path]);
            });
            polygon.setMap(null);
            if (opacity === null) { opacity = polygon.fillOpacity; }
            if (zIndex === null) { zIndex = polygon.zIndex; }
        });
        this.polygons = [];
        const that = this;
        for (const [key, val] of Object.entries(colorMap)) {
            const poly = new google.maps.Polygon({
                paths: val,
                strokeColor: "#000000",
                strokeOpacity: opacity,
                strokeWeight: .05,
                fillColor: key,
                fillOpacity: opacity,
                zIndex: zIndex,
                map: that.map
            });
            // External Events
            poly.addListener("click", (event) => autoGenerateVRAsFromSelection(event));
            poly.addListener("mousemove", (event) => magnifierMove(event));
            that.polygons.push(poly);
        }
    }

    /*
        Gets the frequency of each color found and sorts them into most common to least
        Find the top 'n' most frequent distinct colors and set the color palette with an array of these colors
        A color is considered distinct if it's Euclidean color difference is large enough from the colors already in the palette
    */
    generateColorPalette(n=4) {
        let frequencies = {};
        // Set required distance for colors to be considered distinct for palette
        // Adjustments to calculating required distance may be necessary
        let requiredEuclidianDistance = 441/(n*2);
        this.polygons.forEach((polygon) => {
            let color = polygon.fillColor;
            frequencies[color] = (frequencies[color]) ? frequencies[color]+1 : 1;
        });
        // Get list of frequencies descending order of most commonly found
        let descendingFrequencies = [];
        for (const [color, count] of Object.entries(frequencies)) {
            descendingFrequencies.push({color, count});
        }
        descendingFrequencies.sort((a,b)=> b.count-a.count);

        if (descendingFrequencies.length <= n) {
            this.colorPalette = descendingFrequencies.map((entry) => entry.color);
            return;
        }

        // Get n top distinct colors
        let top = [descendingFrequencies[0].color];
        while(top.length < n) {
            for (let i = 0; i < descendingFrequencies.length && top.length < n; i++) {
                let color = descendingFrequencies[i].color;
                let distinct = true;
                for (let j = 0; j < top.length; j++) {
                    if (this.getColorDistance(color, top[j]) < requiredEuclidianDistance) {
                        distinct = false;
                    }
                }
                if (distinct) {
                    top.push(color);
                }
            }
            requiredEuclidianDistance *= .9;
        }
        this.colorPalette = top;
    }

    getBounds() {
        return this.bounds;
    }
    
    getCenter() {
        return this.bounds.getCenter();
    }

    getColorAtLatLng(latLng) {
        for (let i = this.polygons.length-1; i >= 0 ; i--) {
            if (google.maps.geometry.poly.containsLocation(latLng, this.polygons[i])) {
                return this.polygons[i].fillColor;
            }
        }
        return null;
    }

    getColorDistance(fromHex, toHex) {
        //https://en.wikipedia.org/wiki/Color_difference
        let fromRGB = hexToRgb(fromHex);
        let toRGB = hexToRgb(toHex);
        return Math.sqrt(Math.pow((toRGB.r-fromRGB.r),2) + Math.pow((toRGB.g-fromRGB.g),2) + Math.pow((toRGB.b-fromRGB.b),2));
    }

    getColorPalette() {
        if (!this.colorPalette) {
            this.generateColorPalette();
        }
        return this.colorPalette;
    }

    getID() {
        return this.name.replace(/\0/g, '').replace(/\s+/g, "-").replace('.','').replace('#','');
    }

    getName() {
        return this.name;
    }

    /**
        Assumes opacity of all polygons are the same
    */
    getOpacity() {
        if (this.polygons.length > 0) {
            return this.polygons[0].fillOpacity;
        }
        return -1;
    }

    getPolygonAtLatLng(latLng) {
        for (let i = this.polygons.length-1; i >= 0 ; i--) {
            if (google.maps.geometry.poly.containsLocation(latLng, this.polygons[i])) {
                return this.polygons[i];
            }
        }
        return null;
    }

    removeFromMap() {
        this.polygons.forEach((polygon) => {
            if(!!polygon.getMap()) { polygon.setMap(null); } 
        });
    }

    setOpacity(value) {
        if (value == 0) {
            this.setVisibility(false);
        } else {
            const that = this;
            this.polygons.forEach((polygon) => {
                polygon.setOptions({ fillOpacity: (polygon.fillColor) ? value : 0,  strokeOpacity: value});
                if (!polygon.getMap()) { polygon.setMap(that.map); }
                if (!polygon.getVisible()) { polygon.setVisible(true); }
            });
            this.isVisible = true;
        }
    }

    setVisibility(isVisible) {
        const that = this;
        if (this.isVisible === isVisible) { return; }
        if (!isVisible) {
            if (this.polygons[0].fillOpacity != 0) {
                this.polygons.forEach((polygon) => {
                    polygon.setOptions({ fillOpacity: 0,  strokeOpacity: 0});
                    if (polygon.getVisible()) { polygon.setVisible(false); }
                    // polygon.setMap(null);
                });
            }
        } else {
            this.polygons.forEach((polygon) => {
                polygon.setOptions({ fillOpacity: 1,  strokeOpacity: 1});
                if (!polygon.getMap()) { polygon.setMap(that.map); }
                if (!polygon.getVisible()) { polygon.setVisible(true); }
            });
        }
        this.isVisible = isVisible;
    }

    setZIndex(index) {
        this.polygons.forEach((polygon) => polygon.setOptions({ zIndex: index}));
    }
}

class GMapsOverlay {
    constructor(map) {
        this.map = map;
        this.ftSqrdPerTile = 5;
        this.overlayVisible = false;
        this.menuAndDisplayOptionsVisible = false;
        this.layers = [];

        /* Assumed Element IDs or Classes -> Change Later? */
        // Overlay display settings elements (should only be shown when an overlay is imported)
        this.displaySettingsDivID = 'overlay-settings';
        this.displaySettingsDivContentID = 'overlay-settings-content';
        // Class of menu item elements which should only be shown when an overlay is imported
        this.menuOptionsClass = 'overlay-visible-item';
    }

    addLayer(polygonArray, bounds=null, layerName="Untitled Layer", layerDescription="", isVisible=false) {
        let names = [];
        this.layers.forEach((layer) => names.push(layer.getName()));
        layerName = layerName.replace(/\s+/g,'').replace(/\0/g, '');
        let name = layerName;
        let i = 1;
        while(names.includes(name)) {
            name = layerName + " - " + i;
            i += 1;
        }
        const layer = new GMapsOverlayLayer(this.map, polygonArray, bounds, name, layerDescription, isVisible, this);
        this.layers.push(layer);
        return layer;
    }

    applyDisplaySettings(id) {
        let that = this;
        if (!this.overlayVisible) { return; }
        if (!id) { return; }
        this.layers.forEach((layer) => {
            if (layer.getID() === id) {
                layer.setOpacity($("#" + layer.getID()).val()/100);
            }
        });
    }
    
    canvasToOverlayWithRotation(canvas, tL, bL, bR, tR, rotation = null, isVisible=true) {
        let width = canvas.width;
        let height = canvas.height;
        const context = canvas.getContext("2d");
        if (!rotation) {
            let rotationDegree = .01;
            let totalRotation = 0;
            let cont = true;
            let before = [tL, tR, bR, bL, tL];
            if (coordsAreUpright(before) && latsEqual(before)) { cont = false; rotation = 0; }
            while(cont) {
                let after = rotateCoords(before, rotationDegree, this.map.getProjection());
                totalRotation += rotationDegree;
                if (coordsAreUpright(after)) {
                    if (latsEqual(after)) {
                    let cont = false;
                    // Rotation at this point was to 0, save rotation to get back to original (to be applied later)
                    rotation = -1 * totalRotation;
                    [tL, tR, bR, bL] = after;
                    }
                    if (latsPassed(before, after)) { rotationDegree = rotationDegree * -.5; }
                }
                before = after;
            }
        }

        // At this points the four corner points should correspond with North-west, South-west,...
        // We did this to make sure that the distance west and east correspond with the image width, and north and south correspond with image height
        let nW = tL;
        let sW = bL;
        let sE = bR;
        let nE = tR;
        let boundsCenter = getBoundsCenter([nW, sW, sE, nE, nW]);
        // Get the lat and lng distance in meters
        let latDiff = google.maps.geometry.spherical.computeDistanceBetween(nW, sW);
        let lngDiff = google.maps.geometry.spherical.computeDistanceBetween(nW, nE);
        // Grab original pixels per meter to adjust later (ratio from image height to width isn't 1:1 with Lat to Lng)
        let pixelsPerMeterLng = width / lngDiff;
        let pixelsPerMeterLat = height / latDiff;
        // Apply restrictions to tile size
        if (this.tileSizeFtSqrd < 2) { this.tileSizeFtSqrd = 2; }
        if (this.tileSizeFtSqrd > 10) { this.tileSizeFtSqrd = 10; }
        // Find out tile pixels squared size
        let tilePixels = Math.round(Math.max(pixelsPerMeterLat, pixelsPerMeterLng) * (this.ftSqrdPerTile / 3.28084));
        let numYTiles = Math.ceil(height / tilePixels);
        let numXTiles = Math.ceil(width / tilePixels);
        // Limit the number of tiles to prevent crashing due to lack of memory or cpu power
        // If the resulting overlay would contain more that limiter^2 tiles , downsize
        // let limiter = 500;
        // if ((numYTiles*numXTiles) > (limiter*limiter)) {
        //     tilePixels *= Math.ceil(Math.max(numXTiles, numYTiles) / limiter);
        //     numYTiles = Math.ceil(height / tilePixels);
        //     numXTiles = Math.ceil(width / tilePixels);
        // }
        let tiles = [];
        let colorMap = {};
        for(let y = 0; y < numYTiles; y++) {
            for(let x = 0; x < numXTiles; x++) {
                let tileColor = getMostFrequentColor(context.getImageData(x*tilePixels,y*tilePixels,tilePixels,tilePixels).data);
                if (tileColor != "#000000") {
                    let xFractionBefore = (x / numXTiles);
                    let xFractionAfter = ((x+1) / numXTiles);
                    let yFractionBefore = (y / numYTiles);
                    let yFractionAfter = ((y+1) / numYTiles);
                    let featureNW = new google.maps.LatLng(google.maps.geometry.spherical.interpolate(nW, sW, yFractionBefore).lat(), google.maps.geometry.spherical.interpolate(nW, nE, xFractionBefore).lng());
                    let featureSW = new google.maps.LatLng(google.maps.geometry.spherical.interpolate(nW, sW, yFractionAfter).lat(), google.maps.geometry.spherical.interpolate(nW, nE, xFractionBefore).lng());
                    let featureSE = new google.maps.LatLng(google.maps.geometry.spherical.interpolate(nW, sW, yFractionAfter).lat(), google.maps.geometry.spherical.interpolate(nW, nE, xFractionAfter).lng());
                    let featureNE = new google.maps.LatLng(google.maps.geometry.spherical.interpolate(nW, sW, yFractionBefore).lat(), google.maps.geometry.spherical.interpolate(nW, nE, xFractionAfter).lng());
                    let path = rotateCoords([ featureNW, featureSW, featureSE, featureNE, featureNW ], rotation, this.map.getProjection(), boundsCenter);
                    colorMap[tileColor] = (colorMap[tileColor]) ? colorMap[tileColor] : [];
                    colorMap[tileColor].push(path);
                }
            }
        }
        let that = this;
        for (const [key, val] of Object.entries(colorMap)) {
            tiles.push(new google.maps.Polygon({
                paths: val,
                strokeColor: "#000000",
                strokeOpacity: (isVisible) ? 1 : 0,
                strokeWeight: .05,
                fillColor: key,
                fillOpacity: (isVisible) ? 1 : 0,
                zIndex: that.getTopZIndex(),
                map: that.map
            }));
        }
        return tiles;
    }

    dividePath(path, tileSizeFtSqrd=null) {
        // Transforming geoJson features to thousands of tiles doesn't offer any advantages
        // But it heavily slows down systems when importing files which cover large areas
        // Forgo tile system for now
        return [path];
        if (tileSizeFtSqrd != null) { this.ftSqrdPerTile = tileSizeFtSqrd; }
        // Apply restrictions to tile size
        if (!this.tileSizeFtSqrd) { this.tileSizeFtSqrd = 8; }
        if (this.tileSizeFtSqrd < 2) { this.tileSizeFtSqrd = 2; }
        if (this.tileSizeFtSqrd > 10) { this.tileSizeFtSqrd = 10; }
        // Create polygon for path to utilize "containsLocation" function
        const poly = new google.maps.Polygon({paths: path});
        const tileSizeMetersSqrd = this.tileSizeFtSqrd / 3.28084;
        // Get bounds of path
        const bounds = new google.maps.LatLngBounds();
        path.forEach((latLng) => bounds.extend(latLng));
        const nW = new google.maps.LatLng(bounds.getNorthEast().lat(), bounds.getSouthWest().lng());
        const nE = bounds.getNorthEast();
        const sE = new google.maps.LatLng(bounds.getSouthWest().lat(), bounds.getNorthEast().lng());
        const sW = bounds.getSouthWest();
        // Compute total lat distance and lng distance to cover in meters
        const latDiff = google.maps.geometry.spherical.computeDistanceBetween(bounds.getSouthWest(), nW);
        const lngDiff = google.maps.geometry.spherical.computeDistanceBetween(bounds.getNorthEast(), nW);
        // Calculate how many tiles would fill the bounds in the lat direction and in the lng direction
        let numTilesLat = Math.round(latDiff / tileSizeMetersSqrd);
        let numTilesLng = Math.round(lngDiff / tileSizeMetersSqrd);
        // Create array to store new paths
        let paths = [];
        for (let y = 0; y < numTilesLat; y++) {
            for (let x = 0; x < numTilesLng; x++) {
                let xFractionBefore = (x / numTilesLng);
                let xFractionAfter = ((x+1) / numTilesLng);
                let yFractionBefore = (y / numTilesLat);
                let yFractionAfter = ((y+1) / numTilesLat);
                let pathNW = new google.maps.LatLng(google.maps.geometry.spherical.interpolate(nW, sW, yFractionBefore).lat(), google.maps.geometry.spherical.interpolate(nW, nE, xFractionBefore).lng());
                let pathSW = new google.maps.LatLng(google.maps.geometry.spherical.interpolate(nW, sW, yFractionAfter).lat(), google.maps.geometry.spherical.interpolate(nW, nE, xFractionBefore).lng());
                let pathSE = new google.maps.LatLng(google.maps.geometry.spherical.interpolate(nW, sW, yFractionAfter).lat(), google.maps.geometry.spherical.interpolate(nW, nE, xFractionAfter).lng());
                let pathNE = new google.maps.LatLng(google.maps.geometry.spherical.interpolate(nW, sW, yFractionBefore).lat(), google.maps.geometry.spherical.interpolate(nW, nE, xFractionAfter).lng());
                const tilePath = [pathNW, pathSW, pathSE, pathNE, pathNW];
                // Check to see if the center of this tile is within the original polygon
                const pathBounds = new google.maps.LatLngBounds();
                tilePath.forEach((latLng) => pathBounds.extend(latLng));
                const tileCenter = pathBounds.getCenter();

                if (google.maps.geometry.poly.containsLocation(tileCenter, poly) || google.maps.geometry.poly.isLocationOnEdge(tileCenter, poly)) {
                    paths.push(tilePath);
                }
            }
        }
        return paths;
    }

    generateVRAsFromOverlayLatLngSelection(latLng, appAreaExists) {
        const that = this;
        createAlert("Auto Generating Variable Rate Areas From Color Selection.\nThis May Take Several Seconds", 10000, "info", (finished) => {
            let polygon = this.getPolygonAtLatLng(latLng);
            const simplifiedPaths = this.simplifyPaths(polygon.getPaths().getArray());
            if (!appAreaExists) {
                appArea = new AppArea(that.map, simplifiedPaths.bounds);
            }
            simplifiedPaths.paths.forEach((path) => {
                if (path.length === 1) {
                    appArea.addVariableRate(path[0]);
                } else {
                    appArea.addVariableRate(path[0], path.slice(1));
                }
            });
            appArea.validateAndFix();
            // Update acres measurement
            updateStats();
            createAlert("Variable Rate Area Auto Generation Complete", 5000, "success"); 
        });
    }

    getTopZIndex() {
        return 10 + this.layers.length;
    }

    getColorAtLatLng(latLng) {
        let color;
        for (let i = this.layers.length-1; i >= 0 && !color; i--) {
            if (this.layers[i].getOpacity() > 0) {
                color = this.layers[i].getColorAtLatLng(latLng);
            }
        }
        if (!color) { color = "#000000"; }
        return color;
    }

    getPolygonAtLatLng(latLng) {
        let poly;
        for (let i = this.layers.length-1; i >= 0 && !poly; i--) {
            if (this.layers[i].getOpacity() > 0) {
                poly = this.layers[i].getPolygonAtLatLng(latLng);
            }
        }
        return poly
    }

    hasLayers() {
        return (this.layers.length > 0);
    }

    /**
      *   Given an image, we have its native height and width.
      *   Bounds will be supplied via the coordinates where the 4 corners of the ORIGINAL image will be placed in the geographic space in one of two ways:
      *     + NW (top left of image), SW (bottom left of image), SE (bottom right of image), and NE (top right of image). As well as a ROTATION value to be applied.
      *       - These coordinates are a bounding box BEFORE the desired rotation has been applied. (Assumes bounding box is flat along 2 latitude points and 2 longitude points)
      *     + Top left of image, bottom left of image, bottom right of image, and top right of image. This time without a rotation value to be applied.
      *       - These coordinates are a bounding box AFTER a rotation has been applied. Assumes the user has applied a rotation already.
      */
    imageToOverlayWithRotation(image, tL, bL, bR, tR, rotation = null, isVisible=true) {
        let canvas = document.createElement('canvas');
        canvas.height = image.naturalHeight;
        canvas.width = image.naturalWidth;
        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        return this.canvasToOverlayWithRotation(canvas, tL, bL, bR, tR, rotation, isVisible);
    }

    imageToCanvas(image) {
        let canvas = document.createElement('canvas');
        canvas.height = image.naturalHeight;
        canvas.width = image.naturalWidth;
        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        return canvas;
    }

    importOverlayFromLoader(callback) {
        try {
            switch (this.loader.fileType) {
                case 'kml':
                case 'zip':
                case 'json':
                    for (let i = 0; i < this.loader.layers.length; i++) {
                        const layer = this.loader.layers[i];
                        if (!layer.deleted) {
                            this.ftSqrdPerTile = layer.tileSize;
                            const overlayLayer = this.loadOverlayFromGeoJsonFeatureCollection(layer.data);
                            if (layer.useColorPalette) {
                                if (layer.autoColorPalette) {
                                    overlayLayer.generateColorPalette(layer.colorPaletteSize);
                                    overlayLayer.applyColorPalette();
                                } else {
                                    overlayLayer.applyColorPalette(layer.colorPalette);
                                }
                            }
                            callback(true);
                        }
                    }
                    break;
                case 'kmz':
                case 'tif':
                    for (let i = 0; i < this.loader.layers.length; i++) {
                        const layer = this.loader.layers[i];
                        if (!layer.deleted) {
                            this.ftSqrdPerTile = layer.tileSize;
                            const bounds = layer.data.bounds;
                            const tR = bounds.getNorthEast();
                            const bL = bounds.getSouthWest();
                            const tL = new google.maps.LatLng(tR.lat(), bL.lng());
                            const bR = new google.maps.LatLng(bL.lat(), tR.lng());
                            const polygons = this.canvasToOverlayWithRotation(layer.data.canvas, tL, bL, bR, tR, layer.data.rotation, true);
                            const overlayLayer = this.addLayer(polygons, bounds, layer.name, "", true);
                            if (layer.useColorPalette) {
                                if (layer.autoColorPalette) {
                                    overlayLayer.generateColorPalette(layer.colorPaletteSize);
                                    overlayLayer.applyColorPalette();
                                } else {
                                    overlayLayer.applyColorPalette(layer.colorPalette);
                                }
                            }
                            this.map.fitBounds(bounds);
                        }
                        if (i == this.loader.layers.length-1) {
                            this.updateMenuAndDisplayOptions();
                            callback(true);
                        }
                    }
                    break;
                default:
                    callback(false);
                    return;
            }
        } catch (e) {
            console.log(e);
            callback(false);
        }
    }

    loadOverlay(file, displayWhenFinished) {
        if (!file) { return; }
        this.file = file;
        if (this.fileURL) { URL.revokeObjectURL(this.fileURL); }
        this.fileURL = URL.createObjectURL(file);
        this.fileName = file.name.substr(0, file.name.lastIndexOf('.'))
        this.fileType = file.name.substr(file.name.lastIndexOf('.') + 1);
        this.overlayVisible = displayWhenFinished;

        createAlert(`Loading Overlay From ${this.fileType.toUpperCase()} . . .`, 5000, "info", (finished) => {
            switch (this.fileType) {
                case 'kml':
                    this.loadOverlayFromKML();
                    break;
                case 'kmz':
                    this.loadOverlayFromKMZ();
                    break;
                case 'tif':
                    this.loadOverlayFromGeoTiff();
                    break;
                case 'zip':
                    this.loadOverlayFromShapefileZip();
                    break;
                case 'json':
                    this.loadOverlayFromGeoJson();
                    break;
                default:
                    createAlert("Unsupported File Type", 10000, "error");
                    break;
            }
        });
    }

    loadOverlayFromGeoJson() {
        this.loader = new GMapsOverlayLoader(this.fileName,this.fileType);
        // Save instance of this to prevent issues in file reader
        const that = this;
        const fr = new FileReader();
        fr.onload = function(e) {
            const geoJson = JSON.parse(e.target.result);
            // that.loadOverlayFromGeoJsonFeatureCollection(geoJson);
            that.loader.addLayer("GeoJson Layer", geoJson);
            that.loader.generateModalPrompt();
        };
        fr.onerror = function(e) {
            createAlert("Failed to Load GeoJson File", 10000, "error");
        }
        // Read the JSON file as text to be easily parsed
        fr.readAsText(that.file);
    }

    loadOverlayFromGeoJsonFeatureCollection(featureCollection) {
        // https://tools.ietf.org/html/rfc7946#section-4
        // http://wiki.geojson.org/GeoJSON_draft_version_5
        let that = this;
        let bounds = new google.maps.LatLngBounds();

        // Only polygons or multipolygons should be loaded -> Change later?
        let features = featureCollection.features.filter((feature) => {
            return feature.geometry && ((feature.geometry.type === "Polygon") || (feature.geometry.type === "MultiPolygon"));
        });
        let colorMap = {};
        features.forEach((feature) => {
            // Try to find any kind of fill color and opacity
            let fillColor;
            let fillOpacity;
            Object.keys(feature.properties).forEach((key) => {
                if (key.match(/fill/i) && !fillColor){
                    let temp = feature.properties[key];
                    // Check to see if its a valid string hex value
                    if (typeof(temp) === "string" && temp.charAt(0)==='#') {
                        fillColor = temp;
                    }
                }
                if (key.match(/opacity/i) && !fillOpacity){
                    let temp = feature.properties[key];
                    // Check to see if its a valid string hex value
                    if (typeof(temp) === "number" && temp <= 1) {
                        fillOpacity = Math.round(temp *100)/100;
                    }
                }
            });
            fillColor = (!!fillColor) ? fillColor : "#333333";
            fillOpacity = (!!fillOpacity) ? fillOpacity : 0.7;
            colorMap[fillColor] = (colorMap[fillColor]) ? colorMap[fillColor] : [];
            if (feature.geometry.type === "MultiPolygon") {
                feature.geometry.coordinates.forEach((polygon) => {
                    polygon.forEach((linearRing) => {
                        let path = [];
                        linearRing.forEach((p) => {
                            let latLng = new google.maps.LatLng({ lng: p[0], lat: p[1]});
                            path.push(latLng);
                            bounds.extend(latLng);
                        });
                        colorMap[fillColor] = colorMap[fillColor].concat(that.dividePath(path));
                    });
                });
            } else {
                feature.geometry.coordinates.forEach((linearRing) => {
                    let path = [];
                    linearRing.forEach((p) => {
                        let latLng = new google.maps.LatLng({ lng: p[0], lat: p[1]});
                        path.push(latLng);
                        bounds.extend(latLng);
                    });
                    colorMap[fillColor] = colorMap[fillColor].concat(that.dividePath(path));
                });
            }
        });
        let polygons = [];
        for (const [key, val] of Object.entries(colorMap)) {
            polygons.push(new google.maps.Polygon({
                paths: val,
                strokeColor: "#000000",
                strokeOpacity: 1,
                strokeWeight: .1,
                fillColor: key,
                fillOpacity: 1,
                zIndex: that.getTopZIndex(),
                map: that.map
            }));
        }
        const layer = that.addLayer(polygons, bounds, that.file.name.substr(0, that.file.name.lastIndexOf('.')), "", true);
        that.updateMenuAndDisplayOptions();
        that.map.fitBounds(bounds);
        return layer;
    }

    async loadOverlayFromGeoTiff() {
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
            createAlert("Geokey Missing For GeoTiff File", 10000, "error");
            return;
        }
        sourceGeoKey = parseInt(sourceGeoKey);

        // User Defined Geokey (find out how to deal with these)
        if (sourceGeoKey === 32767) {
            createAlert("Custom Geokey (Projection System) used in GeoTiff file. This feature is not yet supported.", 10000, "error");
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
            createAlert("No transformation information provided in GeoTiff", 10000, "error");
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
                const canvas = new Tiff({buffer: xhr.response}).toCanvas();
                let gBounds = new google.maps.LatLngBounds(
                    new google.maps.LatLng(bounds.lowerLeft[1], bounds.lowerLeft[0]),
                    new google.maps.LatLng(bounds.upperRight[1], bounds.upperRight[0])
                );
                // let tR = gBounds.getNorthEast();
                // let bL = gBounds.getSouthWest();
                // let tL = new google.maps.LatLng(tR.lat(), bL.lng());
                // let bR = new google.maps.LatLng(bL.lat(), tR.lng());
                // const tiles = that.canvasToOverlayWithRotation(canvas, tL, bL, bR, tR);
                // that.addLayer(tiles, gBounds, fd.PageName, fd.ImageDescription, true);
                // that.updateMenuAndDisplayOptions();
                // that.map.fitBounds(gBounds);
                that.loader = new GMapsOverlayLoader(that.fileName,that.fileType);
                that.loader.addLayer(fd.PageName, {bounds: gBounds, canvas, roation: null});
                that.loader.generateModalPrompt();
            }
        };
        xhr.onerror = function() {
            createAlert("Failed to Load GeoTiff File", 10000, "error");
        }
        xhr.responseType = 'arraybuffer';
        xhr.open('GET', that.fileURL);
        xhr.send();
    }

    /**
     * Adds a KML overlay to the current map based on the current file
     * 
     * Required libraries (currently browserified):
     *  - @tmcw/togeojson [https://github.com/tmcw/togeojson]
     */
    loadOverlayFromKML() {
        this.loader = new GMapsOverlayLoader(this.fileName,this.fileType);
        // Save instance of "this" to prevent issues in xhr
        const that = this;
        const xhr = new XMLHttpRequest();
        // Read the current file as an XMLDocument to be used in @tmcw/togeojson library
        xhr.onload = function() {
            if (this.status == 200) {
                const tj = require("@tmcw/togeojson");
                // Read the XMLDocument response, convert it to GeoJson
                const geoJson = tj.kml(xhr.responseXML);
                that.loader.addLayer("KML Layer", geoJson);
                that.loader.generateModalPrompt();
            } else {
                createAlert("Failed to Load KML", 10000, "error");
            }
        }
        xhr.onerror = function() {
            createAlert("Failed to Load KML", 10000, "error");
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
    loadOverlayFromKMZ() {
        const that = this;
        try {
            // Make Local function to use the kmz after it has been parsed
            let kmzParsed = function(docs) {
                that.loader = new GMapsOverlayLoader(that.fileName,that.fileType);
                let doc = docs[0];
                for(let i = 0; i < doc.ggroundoverlays.length; i++) {
                    let layer = doc.ggroundoverlays[i];
                    const bounds = layer.bounds_;
                    let image = new Image();
                    image.onload = function() {
                        const canvas = that.imageToCanvas(image);
                        const name = doc.groundoverlays[i].name;
                        const rotation = layer.rotation_;
                        that.loader.addLayer(name, {bounds, canvas, rotation});
                        if (i == doc.ggroundoverlays.length - 1) {
                            that.loader.generateModalPrompt();
                        }
                    };
                    image.src = layer.url_;
                }
            }
            let geoXML = new geoXML3.parser({
                singleInfoWindow: false,
                suppressInfoWindows : true,
                zoom : true,
                afterParse: (doc) => kmzParsed(doc),
            });
            geoXML.parse(this.fileURL);
        } catch (e) {
            createAlert("Failed to Load KMZ", 10000, "error");
        }
    }

    loadOverlayFromShapefileZip() {
        this.loader = new GMapsOverlayLoader(this.fileName,this.fileType);
        const that = this;
        const JSZip = require("jszip");
        const zip = new JSZip();
        // Using jszip load the zip file asynchronously and get file contents
        zip.loadAsync(that.file).then((zip) => {
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
                            // this.loadOverlayFromGeoJsonFeatureCollection(data);
                            that.loader.addLayer("Shapefile Layer", data);
                            that.loader.generateModalPrompt();
                        })
                        .catch((error) => {
                            createAlert("Error When Reading Shapefile Contents", 10000, "error");
                        });             
                    });
                });
            } else {
                createAlert("Shapefile or Corresponding DBF File Missing in Zip", 10000, "error");
            }
        }, function() {
            createAlert("Invalid Zip File Format", 10000, "error");
        });
    }

    removeAllLayers() {
        this.layers.forEach((layer) => layer.removeFromMap());
        this.layers = [];

        // Clear Attributes
        if (this.fileURL) { URL.revokeObjectURL(this.fileURL); }
        this.file = null;
        this.fileType = null;

        // Clear Menu Options / Overlay-related Display
        $('.'+this.menuOptionsClass).hide();
        $('#' + this.displaySettingsDivContentID).empty();
        $('#' + this.displaySettingsDivID).hide();
        if ($('#mode-selector option:selected').val() == "5") {
            $("#mode-selector option[value='0']").attr("selected", true);
        }
        $('#vra-auto-generation-mode').attr("disabled", true);
    }

    removeLayer(id) {
        let index = -1;
        this.layers.forEach((layer, i) => {
            if (layer.getID() === id && (index === -1)) {
                layer.setVisibility(false);
                layer.removeFromMap();
                layer = null;
                index = i;
            }
        });
        if (index != -1) {
            this.layers.splice(index,1);
        }
        $('#'+id+'-container').empty();
        $('#'+id+'-container').remove();

        if (this.layers.length < 1) {
            this.removeAllLayers();
        }
    }

    setMapBoundsToAllLayers() {
        const bounds = new google.maps.LatLngBounds();
        this.layers.forEach((layer) => {
            const temp = layer.getBounds();
            bounds.extend(temp.getSouthWest());
            bounds.extend(temp.getNorthEast());
        });
        this.map.fitBounds(bounds);
    }

    setMapBoundsToLayer(id) {
        const that = this;
        this.layers.forEach((layer) => {
            if (layer.getID() === id) {
                that.map.fitBounds(layer.getBounds());
            }
        });
    }

    setVisibility(isVisible) {
        this.layers.forEach((layer) => layer.setVisibility(isVisible));
        this.updateMenuAndDisplayOptions();
    }

    simplifyPaths(paths) {
        // let bounds = new google.maps.LatLngBounds();
        // save paths in terms of edges, all paths assumed to contain 5 points
        let groups = [paths.map((path) => path.getArray())];
        const geometryFactory = new jsts.geom.GeometryFactory();
        let unionedGroups = [];
        let allPolys = [];
        groups.forEach((group) => {
            group.forEach((entry) => {
                let path = entry.map((coord) => new jsts.geom.Coordinate(coord.lat(), coord.lng()));
                let poly = geometryFactory.createPolygon(geometryFactory.createLinearRing(path), []);
                allPolys.push(poly);
            });
        });
        
        // let collection = new jsts.geom.GeometryCollection(allPolys, geometryFactory);
        let collection = geometryFactory.createMultiPolygon(allPolys);
        let unionedPoly = new jsts.operation.union.UnaryUnionOp(collection, geometryFactory).union();
        for (let i = 0; i < unionedPoly.getNumGeometries(); i++) {
            let tempPoly = unionedPoly.getGeometryN(i);
            let geoShellHoles = AppArea.getGeoShellsHoles(tempPoly);
            let rings = AppArea.shellsHolesToCoords(geoShellHoles);
            let temp = [];
            for (let j = 0; j < rings[0].holes.length; j++) {
                temp.push(rings[0].holes[j]);
            }
            temp.unshift(rings[0].shell);
            unionedGroups.push(temp);
        }
        return { paths: unionedGroups };
    }

    updateDisplayOption(layer) {
        const that = this;
        const isVisible = layer.isVisible;
        const id = layer.getID();
        let startingOpacity = Math.floor(layer.getOpacity()*100);
        // Check to see if display options for this layer ID already exists
        if( $('#'+id).length ) {
            // If so, update value
            $('#'+id).val(startingOpacity);
            $("#"+id+"-display").text(startingOpacity+"%");
            $(`#${id}-toggle`).prop('checked', isVisible);
        } else {
            // If not, add it
            $('#' + that.displaySettingsDivContentID)
                .append($(`<div id="${id}-container" class="overlay-settings-row"></div>`)
                    .append($(`<div class="row align-items-center pl-2"></div>`)
                        .append($(`<div class="col col-9 btn btn-link overlay-header" title="${layer.name}">${layer.name}</div>`).on("click", function(){
                            that.map.fitBounds(layer.getBounds());
                        }))
                        .append($(`<div class="col col-1 ml-2"></div>`)
                            .append($(`<input id="${id}-toggle" type="checkbox" ${(isVisible) ? "checked" : ""}>`).on("change", function(){
                                layer.setVisibility(this.checked);
                                const val = (this.checked) ? Math.floor(layer.getOpacity()*100) : 0;
                                $('#'+id).val(val);
                                $("#"+id+"-display").text(val+"%");
                            }))
                        )
                        .append($(`<div class="col col-1 btn btn-link">&#10006</div>`).on("click", function(){
                            that.removeLayer(id);
                        }))
                    )
                    .append($(`<div class="row align-items-center pl-2"></div>`)
                        .append($(`<div class="col">Opacity:</div>`))
                        .append($(`<div class="col col-7"></div>`)
                            .append($(`<input type="range" min="0" max="100" style="width: 95%" value="${startingOpacity}" id="${id}">`).on("input", function() {
                                const val = $(this).val();
                                $("#"+id+"-display").text(val+"%");
                                $(`#${id}-toggle`).prop('checked', (val > 0));
                                layer.setOpacity(val/100);
                            }))
                        )
                        .append($(`<div class="col" id="${id+"-display"}">${startingOpacity}%</div>`))
                    )
                );
        }
    }

    updateMenuAndDisplayOptions() {
        for(let i = 0; i < this.layers.length; i++) {
            this.updateDisplayOption(this.layers[i])
        }
        $('#'+this.displaySettingsDivID).show();
        $('.'+this.menuOptionsClass).each((index, option) => { $(option).css("display","block"); });
        $('#vra-auto-generation-mode').attr("disabled", false);
    }
}

/********************** HELPER FUNCTIONS **********************/

/**
 * Converts a number to its hex string
 * @param {Number} c 
 * @return {String} hex
 */
function componentToHex(c) {
    var hex = c.toString(16);
    return hex.length == 1 ? "0" + hex : hex;
}

/**
 * Checks to see if the first two latitude points in the sequence are greater than the second and third points
 * @param {[google.maps.LatLng]} coords [google.maps.LatLng]
 * @return {boolean} boolean
 */
function coordsAreUpright(coords) {
    let topLatMin = Math.min(coords[0].lat(), coords[1].lat());
    let bottomLatMax = Math.max(coords[2].lat(), coords[3].lat());
    return bottomLatMax < topLatMin;
}

/**
 * Transitions an alert in and out for the user 
 * @param {String} message The text to be dispayed in the alert
 * @param {Integer} duration The duration in milliseconds for the alert to be displayed
 * @param {String} type The theme of the message: "success", "info", "error" (set class)
 * @param {Function} callback Function called back after fadeIn has occured
 */
async function createAlert(message, duration, type="success", callback) {
    let alertBox = $('#top-alert');
    switch (type) {
        case "success":
            alertBox.attr("class","alert alert-success");
            break;
        case "info":
            alertBox.attr("class","alert alert-info");
            break;
        case "error": default:
            message = "Error: " + message;
            alertBox.attr("class","alert alert-danger");
            break;
    }
    alertBox.text(message);
    alertBox.fadeIn("slow", function(){
        setTimeout(function(){ alertBox.fadeOut("slow"); }, duration);
        if (callback) { setTimeout(() => { callback(true); }, 500); }
    });
}

/**
 * Calculates the center coordinate from the given coordinates
 * @param {[google.maps.LatLng]} coords [google.maps.LatLng]
 */
function getBoundsCenter(coords) {
    let bounds = new google.maps.LatLngBounds();
    coords.forEach((coord) => bounds.extend(coord));
    return bounds.getCenter();
}

/**
 * Returns the most frequently found color in the RGB array
 * @param {[Number]} rgbaArray [R,G,B,R,G,B,R...]
 * @return {String} (Hex Color Value)
 */
function getMostFrequentColor(rgbaArray) {
    let freq = {};
    for(let k = 0; k+3 < rgbaArray.length; k+=4) {
        if (!!rgbaArray[k] && !!rgbaArray[k+1] && !!rgbaArray[k+2]) {
            let colorKey = ""+rgbaArray[k]+","+rgbaArray[k+1]+","+rgbaArray[k+2];
            freq[colorKey] = (freq[colorKey]) ? freq[colorKey]+1 : 1;
        }
    }
    let keys = Object.keys(freq);
    if (keys.length > 1) {
        let rgb = keys.reduce(function(a, b){ return freq[a] > freq[b] ? a : b }).split(",");
        return rgbToHex(parseInt(rgb[0]),parseInt(rgb[1]),parseInt(rgb[2]));
    } else if (keys.length == 1) {
        let rgb = keys[0].split(",");
        return rgbToHex(parseInt(rgb[0]),parseInt(rgb[1]),parseInt(rgb[2]));
    } else {
        return "#000000";
    }
}

/**
 * Converts a Color from Hex to RGB
 * @param {String} hex (Color Value)
 * @return {Object} ({r: int, g: int, b: int}) 
 */
function hexToRgb(hex) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

/**
 * Checks to see if the latitude value of the first two LatLngs in the array have a nearly equal value
 * @param {[google.maps.LatLng]} coords 
 * @return {boolean}
 */
function latsEqual(coords) {
    return (Math.abs(coords[1].lat() - coords[0].lat()) < .00000000000000001);
}

/**
 * Given an array of LatLngs before and after a rotation has been applied,
 *  this will check to see if the latitudinal direction between the first two points has changed.
 * @param {[google.maps.LatLng]} before 
 * @param {[google.maps.LatLng]} after
 * @return {boolean}
 */
function latsPassed(before, after) {
    let diffBefore = before[1].lat() - before[0].lat();
    let diffAfter = after[1].lat() - after[0].lat();
    if (diffBefore < 0) {
        return (diffAfter > 0)? true : false;
    } else {
        return (diffAfter < 0)? true : false;
    }
}

/**
 * Converts a r,g,b value to its hex value
 * @param {Number} r (0-255)
 * @param {Number} g (0-255)
 * @param {Number} b (0-255)
 * @return {String} hex
 */
function rgbToHex(r, g, b) {
    return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
}

/**
 * Rotates a set of coordinates
 * @param {[google.maps.LatLng]} coords [google.maps.LatLng]
 * @param {Number} angle double
 * @param {google.maps.Projection} prj google.maps.Projection
 * @param {google.maps.LatLng} origin (optional)
 * @return {[google.maps.LatLng]} [google.maps.LatLng]
 */
function rotateCoords(coords, angle, prj, origin = null) {
    if (!origin) {
        origin = prj.fromLatLngToPoint(getBoundsCenter(coords));
    } else {
        origin = prj.fromLatLngToPoint(origin);
    }
    var coords = coords.map(function(latLng){
        var point = prj.fromLatLngToPoint(latLng);
        var rotatedLatLng =  prj.fromPointToLatLng(rotatePoint(point,origin,angle));
        return new google.maps.LatLng(rotatedLatLng.lat(), rotatedLatLng.lng())
    });
    return coords;
}

/**
 * Rotates a single point (google.maps.LatLng) around an origin (google.maps.LatLng)
 * @param {google.maps.LatLng} point 
 * @param {google.maps.LatLng} origin 
 * @param {Number} angle 
 * @return {google.maps.LatLng} google.maps.LatLng
 */
function rotatePoint(point, origin, angle) {
    var angleRad = angle * Math.PI / 180.0;
    return {
        x: Math.cos(angleRad) * (point.x - origin.x) - Math.sin(angleRad) * (point.y - origin.y) + origin.x,
        y: Math.sin(angleRad) * (point.x - origin.x) + Math.cos(angleRad) * (point.y - origin.y) + origin.y
    };
}