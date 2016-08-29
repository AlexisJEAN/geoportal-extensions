define([
    "woodman",
    "ol"
], function (
    woodman,
    ol
) {

    "use strict";

    var logger = woodman.getLogger("extended KML format");

    /**
    * @classdesc
    *
    * Extended Styles KML format to export (internal use only !)
    *
    * INFO
    * only ol.Control is a user-extendable class.
    * Everything else requires integration with the original ol3 source and a new ol.js
    * to be built with your new classes incorporated.
    *
    * ISSUES
    * cf. https://github.com/openlayers/ol3/issues/4829
    * cf. https://github.com/openlayers/ol3/issues/4460
    * cf. https://github.com/openlayers/ol3/pull/5590
    *
    * @constructor
    * @extends {ol.format.KML}
    * @param {Object} options - Options
    */
    function KML (options) {

        if (!(this instanceof KML)) {
            throw new TypeError("ERROR CLASS_CONSTRUCTOR");
        }

        // call constructor
        ol.format.KML.call(this,
            options
        );

    }

    // Inherits
    ol.inherits(KML, ol.format.KML);

    /*
    * @lends module:KML
    */
    KML.prototype = Object.create(ol.format.KML.prototype, {});

    /**
    * Constructor (alias)
    */
    KML.prototype.constructor = KML;

    /**
    * Fonction d'indentation d'une chaine de caractères KML ou XML
    * cf. https://stackoverflow.com/questions/376373/pretty-printing-xml-with-javascript/
    */
    function _kmlIndentedToString (xml) {
        var reg = /(>)\s*(<)(\/*)/g; // updated Mar 30, 2015
        var wsexp = / *(.*) +\n/g;
        var contexp = /(<.+>)(.+\n)/g;
        xml = xml.replace(reg, '$1\n$2$3').replace(wsexp, '$1\n').replace(contexp, '$1\n$2');
        var pad = 0;
        var formatted = '';
        var lines = xml.split('\n');
        var indent = 0;
        var lastType = 'other';
        // 4 types of tags - single, closing, opening, other (text, doctype, comment) - 4*4 = 16 transitions
        var transitions = {
            'single->single': 0,
            'single->closing': -1,
            'single->opening': 0,
            'single->other': 0,
            'closing->single': 0,
            'closing->closing': -1,
            'closing->opening': 0,
            'closing->other': 0,
            'opening->single': 1,
            'opening->closing': 0,
            'opening->opening': 1,
            'opening->other': 1,
            'other->single': 0,
            'other->closing': -1,
            'other->opening': 0,
            'other->other': 0
        };

        for (var i = 0; i < lines.length; i++) {
            var ln = lines[i];
            var single = Boolean(ln.match(/<.+\/>/)); // is this line a single tag? ex. <br />
            var closing = Boolean(ln.match(/<\/.+>/)); // is this a closing tag? ex. </a>
            var opening = Boolean(ln.match(/<[^!].*>/)); // is this even a tag (that's not <!something>)
            var type = single ? 'single' : closing ? 'closing' : opening ? 'opening' : 'other';
            var fromTo = lastType + '->' + type;
            lastType = type;
            var padding = '';

            indent += transitions[fromTo];
            for (var j = 0; j < indent; j++) {
                padding += '\t';
            }
            if (fromTo == 'opening->closing') {
                formatted = formatted.substr(0, formatted.length - 1) + ln + '\n'; // substr removes line break (\n) from prev loop
            } else {
                formatted += padding + ln + '\n';
            }
        }

        logger.trace(formatted);
        return formatted;
    };

    /**
    * Fonction de parsing d'une chaine de caractères KML
    */
    function _kmlParse (kmlString) {
        var kmlDoc = null;
        var parser = null;
        var scope  = typeof window !== "undefined" ? window : null;

        if ( typeof exports === "object" && window === null) {
            // code for nodejs
            var DOMParser = require("xmldom").DOMParser;
            parser = new DOMParser();
            kmlDoc = parser.parseFromString(kmlString, "text/xml");
        } else if (scope.DOMParser) {
            // code for modern browsers
            parser = new scope.DOMParser();
            kmlDoc = parser.parseFromString(kmlString, "text/xml");
        } else if (scope.ActiveXObject) {
            // code for old IE browsers
            kmlDoc = new scope.ActiveXObject("Microsoft.XMLDOM");
            kmlDoc.async = false;
            kmlDoc.loadXML(kmlString);
        } else {
            console.log("Incompatible environment for DOM Parser !");
        }

        logger.trace(kmlDoc);
        return kmlDoc;
    };

    /**
    * Fonction de convertion en chaine de caractères.
    */
    function _kmlToString (kmlDoc) {
        var oSerializer = new XMLSerializer();
        var kmlStringExtended = oSerializer.serializeToString(kmlDoc);

        logger.trace(kmlStringExtended);
        return kmlStringExtended;
    };

    /**
    * write Extend Styles for Features.
    * This function is overloaded...
    *
    * @see ol.format.KML.prototype.writeFeatures
    * @param {Array.<Object>} features - Features.
    * @param {Object} options - Options.
    * @return {String} Result.
    */
    KML.prototype.writeExtendStylesFeatures = function (features, options) {

        var kmlString = ol.format.KML.prototype.writeFeatures.call(this, features, options);

        // On met en place un Parser sur le KML
        // (Dommage que le parser XML des services ne soit pas disponible !)
        var kmlDoc = _kmlParse(kmlString);

        if (kmlDoc === null) {
            // au cas où...
            return kmlString;
        }

        var root  = kmlDoc.documentElement;
        var firstNodeLevel = root.childNodes;

        // Si le DOM contient un seul objet, le noeud est directement un PlaceMark
        // sinon, c'est un ensemble de noeuds PlaceMark contenus dans le noeud Document.
        var placemarks = firstNodeLevel;
        if (firstNodeLevel.length === 1 && firstNodeLevel[0].nodeName === "Document") {
            placemarks = firstNodeLevel[0].childNodes;
        }

        // On recherche uniquement les PlaceMark de type Point ayant un Style...
        for (var idx = 0; idx < placemarks.length; idx++) {
            var placemark = placemarks[idx];
            var types = placemark.childNodes; // Point, LineString, Polygon, Style, ...
            var point  = false;
            var styles = null;
            for (var j = 0; j < types.length; j++) {
                switch (types[j].nodeName) {
                    case "Point":
                        point = true;
                        break;
                    case "Style":
                        styles = types[j].childNodes; // liste de styles
                        break;
                    default:
                    // on ne traite pas les autres informations ...
                }
            }

            // On a un Marker ou un Label avec un Style
            if (point && styles) {
                // Le Style ne peut être vide !
                if (styles.length) {
                    var labelStyle = null;
                    var iconStyle  = null;
                    // On recherche le type de Style
                    for (var k = 0; k < styles.length; k++) {
                        switch (styles[k].nodeName) {
                            case "LabelStyle":
                                labelStyle = styles[k];
                                break;
                            case "IconStyle":
                                iconStyle = styles[k];
                                break;
                            default:
                            // on ne traite pas les autres informations ...
                        }
                    }

                    // C'est un Label !
                    // On va donc y ajouter qq styles (police, halo, ...) :
                    // PlaceMark>Style>LabelStyle
                    //  Ex.
                    //      <LabelStyleSimpleExtensionGroup fontFamily="Arial" haloColor="16777215" haloRadius="2" haloOpacity="1"/>
                    if (labelStyle) {
                        // FIXME humm..., est ce que ca marche vraiment ?
                        logger.trace("label with style :", labelStyle);

                        var color  = "#FFFFFF";
                        var font   = "Sans";
                        var radius = "3";

                        var fTextStyle = features[idx].getStyle().getText().getStroke();
                        color  = fTextStyle.color_;
                        radius = fTextStyle.width_;

                        var labelextend = kmlDoc.createElement("LabelStyleSimpleExtensionGroup");
                        labelextend.setAttribute("fontFamily", font);
                        labelextend.setAttribute("haloColor", color);
                        labelextend.setAttribute("haloRadius", radius);
                        labelextend.setAttribute("haloOpacity", "1");
                        labelStyle.appendChild(labelextend);
                    }

                    // C'est un marker !
                    // On va donc ajouter la balise hotspot :
                    //  Traiter le cas où les unités sont de type
                    //   - FRACTION
                    //   - PIXELS
                    //  PlaceMark>Style>IconStyle
                    //  Ex.
                    //      <Style><IconStyle>
                    //      (...)
                    //      <hotSpot x="0.5"  y="1" xunits="fraction" yunits="fraction"/>
                    //      </IconStyle></Style>
                    //
                    else if (iconStyle) {
                        // FIXME BUG de lecture OL3 sur origin, anchor et entre bottom-left et top-left,
                        // et la propriété 'y' ne semble pas être correctement intérprétée !?
                        logger.trace("marker with style :", iconStyle);

                        var x = 0.5;
                        var y = 1; // cf. fixme !
                        var xunits = "fraction";
                        var yunits = "fraction";

                        var fImageStyle = features[idx].getStyle().getImage();
                        xunits = fImageStyle.anchorXUnits_;
                        yunits = fImageStyle.anchorYUnits_;

                        var size   = fImageStyle.getSize();
                        var anchor = fImageStyle.anchor_;
                        if (anchor.length) {
                            x = anchor[0];
                            y = anchor[1];
                            y = (yunits === "fraction" && anchor[1] === 1) ? 0 : 1 - anchor[1]; // cf. fixme !
                            y = (yunits === "pixels" && anchor[1] === size[1]) ? 0 : size[1] - anchor[1]; // cf. fixme !

                        }

                        if (iconStyle.getElementsByTagName("hotSpot").length === 0) {
                            var hotspot = kmlDoc.createElement("hotSpot");
                            hotspot.setAttribute("x", x);
                            hotspot.setAttribute("y", y);
                            hotspot.setAttribute("xunits", xunits);
                            hotspot.setAttribute("yunits", yunits);
                            iconStyle.appendChild(hotspot);
                        }
                    }
                }
            }
        }

        // On convertit le DOM en String...
        var kmlStringExtended = _kmlToString(kmlDoc);

        // au cas où...
        if (kmlStringExtended === null) {
            kmlStringExtended = kmlString;
        }

        // On realise un formattage du KML
        var kmlStringFormatted = _kmlIndentedToString(kmlStringExtended);

        // au cas où...
        if (kmlStringFormatted === null) {
            kmlStringFormatted = kmlString;
        }

        return kmlStringFormatted;
    };

    return KML;

});
