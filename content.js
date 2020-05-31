const PHP = {
    stdClass: function () { },
    stringify(val) {
        const hash = new Map([[Infinity, "d:INF;"], [-Infinity, "d:-INF;"], [NaN, "d:NAN;"], [null, "N;"], [undefined, "N;"]]);
        const utf8length = str => str ? encodeURI(str).match(/(%.)?./g).length : 0;
        const serializeString = (s, delim = '"') => `${utf8length(s)}:${delim[0]}${s}${delim[delim.length - 1]}`;
        let ref = 0;

        function serialize(val, canReference = true) {
            if (hash.has(val)) return hash.get(val);
            ref += canReference;
            if (typeof val === "string") return `s:${serializeString(val)};`;
            if (typeof val === "number") return `${Math.round(val) === val ? "i" : "d"}:${("" + val).toUpperCase().replace(/(-?\d)E/, "$1.0E")};`;
            if (typeof val === "boolean") return `b:${+val};`;
            const a = Array.isArray(val) || val.constructor === Object;
            hash.set(val, `${"rR"[+a]}:${ref};`);
            if (typeof val.serialize === "function") {
                return `C:${serializeString(val.constructor.name)}:${serializeString(val.serialize(), "{}")}`;
            }
            const vals = Object.entries(val).filter(([k, v]) => typeof v !== "function");
            return (a ? "a" : `O:${serializeString(val.constructor.name)}`)
                + `:${vals.length}:{${vals.map(([k, v]) => serialize(a && /^\d{1,16}$/.test(k) ? +k : k, false) + serialize(v)).join("")}}`;
        }
        return serialize(val);
    },
    // Provide in second argument the classes that may be instantiated
    //  e.g.  { MyClass1, MyClass2 }
    parse(str, allowedClasses = {}) {
        allowedClasses.stdClass = PHP.stdClass; // Always allowed.
        let offset = 0;
        const values = [null];
        const specialNums = { "INF": Infinity, "-INF": -Infinity, "NAN": NaN };

        const kick = (msg, i = offset) => { throw new Error(`Error at ${i}: ${msg}\n${str}\n${" ".repeat(i)}^`) }
        const read = (expected, ret) => expected === str.slice(offset, offset += expected.length) ? ret
            : kick(`Expected '${expected}'`, offset - expected.length);

        function readMatch(regex, msg, terminator = ";") {
            read(":");
            const match = regex.exec(str.slice(offset));
            if (!match) kick(`Exected ${msg}, but got '${str.slice(offset).match(/^[:;{}]|[^:;{}]*/)[0]}'`);
            offset += match[0].length;
            return read(terminator, match[0]);
        }

        function readUtf8chars(numUtf8Bytes, terminator = "") {
            const i = offset;
            while (numUtf8Bytes > 0) {
                const code = str.charCodeAt(offset++);
                numUtf8Bytes -= code < 0x80 ? 1 : code < 0x800 || code >> 11 === 0x1B ? 2 : 3;
            }
            return numUtf8Bytes ? kick("Invalid string length", i - 2) : read(terminator, str.slice(i, offset));
        }

        const create = className => !className ? {}
            : allowedClasses[className] ? Object.create(allowedClasses[className].prototype)
                : new { [className]: function () { } }[className]; // Create a mock class for this name
        const readBoolean = () => readMatch(/^[01]/, "a '0' or '1'", ";");
        const readInt = () => +readMatch(/^-?\d+/, "an integer", ";");
        const readUInt = terminator => +readMatch(/^\d+/, "an unsigned integer", terminator);
        const readString = (terminator = "") => readUtf8chars(readUInt(':"'), '"' + terminator);

        function readDecimal() {
            const num = readMatch(/^-?(\d+(\.\d+)?(E[+-]\d+)?|INF)|NAN/, "a decimal number", ";");
            return num in specialNums ? specialNums[num] : +num;
        }

        function readKey() {
            const typ = str[offset++];
            return typ === "s" ? readString(";")
                : typ === "i" ? readUInt(";")
                    : kick("Expected 's' or 'i' as type for a key, but got ${str[offset-1]}", offset - 1);
        }

        function readObject(obj) {
            for (let i = 0, length = readUInt(":{"); i < length; i++) obj[readKey()] = readValue();
            return read("}", obj);
        }

        function readArray() {
            const obj = readObject({});
            return Object.keys(obj).some((key, i) => key != i) ? obj : Object.values(obj);
        }

        function readCustomObject(obj) {
            if (typeof obj.unserialize !== "function") kick(`Instance of ${obj.constructor.name} does not have an "unserialize" method`);
            obj.unserialize(readUtf8chars(readUInt(":{")));
            return read("}", obj);
        }

        function readValue() {
            const typ = str[offset++].toLowerCase();
            const ref = values.push(null) - 1;
            const val = typ === "n" ? read(";", null)
                : typ === "s" ? readString(";")
                    : typ === "b" ? readBoolean()
                        : typ === "i" ? readInt()
                            : typ === "d" ? readDecimal()
                                : typ === "a" ? readArray()                            // Associative array
                                    : typ === "o" ? readObject(create(readString()))       // Object
                                        : typ === "c" ? readCustomObject(create(readString())) // Custom serialized object
                                            : typ === "r" ? values[readInt()]                      // Backreference
                                                : kick(`Unexpected type ${typ}`, offset - 1);
            if (typ !== "r") values[ref] = val;
            return val;
        }

        const val = readValue();
        if (offset !== str.length) kick("Unexpected trailing character");
        return val;
    }
}

// console.log("Chrome extension go");

// Identify type of the page
const pagetype = document.getElementById("heading").innerText.trim();

/*
Expected page types are:

Ranglisten
Galaxieansicht
Profil bearbeiten
Allianz Mitglieder
Allianz Wirtschaft
Allianz Diplomatie
Allianzgeschichte
Allianzforum
Galaxie Taktik
Galaxie Verwaltung
Galaxie Wirtschaft
Galaxieboard
Rohstoffe
Handelsplatz
Produktion
Verteidigung
Kommunikation
Forschungen
Konstruktionen
Aufklärung
Flottenbewegungen

Neuigkeiten

*/

switch (pagetype) {
    case "Ranglisten":
        // contains the list of galaxies, Allies, and players
        break;
    case "Galaxieansicht":
        // contains the general galaxy overview
        break;
    case "Profil bearbeiten":
        // edit players profile
        break;
    case "Allianz Mitglieder":
        // members of the ally
        break;
    case "Allianz Wirtschaft":
        // economics page for the players ally
        break;
    case "Allianz Diplomatie":
        // diplomatic page for the players ally
        break;
    case "Allianzgeschichte":
        // history page for the players ally
        break;
    case "Allianzforum":
        // message board for the players ally
        break;
    case "Galaxie Taktik":
        // tactics page
        break;
    case "Galaxie Verwaltung":
        // administration page
        break;
    case "Galaxie Wirtschaft":
        // economics page for the players galaxy
        break;
    case "Galaxieboard":
        // message board for the players galaxy
        break;
    case "Rohstoffe":
        // commodities
        break;
    case "Handelsplatz":
        // market place
        break;
    case "Produktion":
        // ship production
        break;
    case "Verteidigung":
        // defence production
        break;
    case "Kommunikation":
        // communication
        break;
    case "Forschungen":
        // research
        break;
    case "Konstruktionen":
        // constructions
        break;
    case "Aufklärung":
        // intelligence
        break;
    case "Flottenbewegungen":
        // fleet movements
        break;
    case "Neuigkeiten":
        // news
        break;
    default:
        // this values is not expected... Therefore, I need an exception
        const msg = "Unexpected pagetype: '" + pagetype + "' Please report to gn@foersterfrank.de";
        window.alert(msg);
        throw new Error(msg);
        break;
}

console.log(pagetype);

var nodes = document.getElementsByTagName("input"), x;
for (x = 0; x < nodes.length; x++) {
    //console.log(x+": "); console.log(nodes[x]);
    if (nodes[x].name === "scanresult") {
        console.log(PHP.parse(nodes[x].value));
    }
}



// let tables = document.getElementsByTagName("table");

// for (elt of tables) {
//     elt.style['background-color'] = '#FF00FF';
// }