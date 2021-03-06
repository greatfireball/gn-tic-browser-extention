const PHP = {
    stdClass: function() {},
    stringify(val) {
        const hash = new Map([
            [Infinity, "d:INF;"],
            [-Infinity, "d:-INF;"],
            [NaN, "d:NAN;"],
            [null, "N;"],
            [undefined, "N;"]
        ]);
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
            return (a ? "a" : `O:${serializeString(val.constructor.name)}`) +
                `:${vals.length}:{${vals.map(([k, v]) => serialize(a && /^\d{1,16}$/.test(k) ? +k : k, false) + serialize(v)).join("")}}`;
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
        const read = (expected, ret) => expected === str.slice(offset, offset += expected.length) ? ret :
            kick(`Expected '${expected}'`, offset - expected.length);

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

        const create = className => !className ? {} :
            allowedClasses[className] ? Object.create(allowedClasses[className].prototype) :
            new {
                [className]: function() {}
            }[className]; // Create a mock class for this name
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
            return typ === "s" ? readString(";") :
                typ === "i" ? readUInt(";") :
                kick("Expected 's' or 'i' as type for a key, but got ${str[offset-1]}", offset - 1);
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
            const val = typ === "n" ? read(";", null) :
                typ === "s" ? readString(";") :
                typ === "b" ? readBoolean() :
                typ === "i" ? readInt() :
                typ === "d" ? readDecimal() :
                typ === "a" ? readArray() // Associative array
                :
                typ === "o" ? readObject(create(readString())) // Object
                :
                typ === "c" ? readCustomObject(create(readString())) // Custom serialized object
                :
                typ === "r" ? values[readInt()] // Backreference
                :
                kick(`Unexpected type ${typ}`, offset - 1);
            if (typ !== "r") values[ref] = val;
            return val;
        }

        const val = readValue();
        if (offset !== str.length) kick("Unexpected trailing character");
        return val;
    }
}

// console.log("Chrome extension go");

function getdate() {
    const heute = new Date();

    var str = heute.getFullYear();
    str += "-"
    if (heute.getMonth() + 1 < 10) {
        str += "0";
    }
    str += (heute.getMonth() + 1);
    str += "-"
    if (heute.getDate() < 10) {
        str += "0";
    }
    str += heute.getDate();

    return str;
}

const get_basic_info = function() {
    var content = {
        "basic": {
            "time": document.getElementById("uhrzeit").innerText.trim(),
            "last_tick": /(\d+:\d+:\d+)\s+Uhr/.test(document.getElementsByClassName("lasttick")[0].innerText.trim()) ? RegExp.$1 : null,
            "place": /Rang:\s+(\S+)/.test(document.getElementsByClassName("rang")[0].innerText.trim()) ? parseInt(RegExp.$1.replace(/\./g, ""), 10) : null,
            "cristal": /Kristall:\s+(\S+)/.test(document.getElementsByClassName("kristall")[0].innerText.trim()) ? parseInt(RegExp.$1.replace(/\./g, ""), 10) : null,
            "metal": /Metall:\s+(\S+)/.test(document.getElementsByClassName("metall")[0].innerText.trim()) ? parseInt(RegExp.$1.replace(/\./g, ""), 10) : null,
            "points": /Punkte:\s+(\S+)/.test(document.getElementsByClassName("punkte")[0].innerText.trim()) ? parseInt(RegExp.$1.replace(/\./g, ""), 10) : null,
            "date": getdate()
        },
        "data": [],
        "version": "1.7.6"
    }

    if (/Willkommen\s+(.+)\s+.(\d+):(\d+).*zu Tag (\d+) der Runde (\d+)/.test(document.getElementsByClassName("welcometext")[0].innerText)) {
        content.basic.day = parseInt(RegExp.$4, 10);
        content.basic.player = RegExp.$1;
        content.basic.galaxy = parseInt(RegExp.$2, 10);
        content.basic.planet = parseInt(RegExp.$3, 10);
    }

    return content;
}

const parse_galaxy = function() {
    var content = get_basic_info();

    var nodes = document.getElementsByTagName("tr");

    let membertable, diplotable;
    for (var x = 0; x < nodes.length; x++) {
        if (/Allianzangehörigkeit/.test(nodes[x].innerText)) {
            console.log("Found diplotable");
            diplotable = nodes[x].parentElement;
        }
    }
    for (var x = 0; x < nodes.length; x++) {
        if (/ID\s+Rang\s+Nick\s+Punkte\s+Größe\s+Scans/.test(nodes[x].innerText)) {
            console.log("Found member table");
            membertable = nodes[x].parentElement;
        }
    }

    var galaxy_view = {
        'id': null,
        'member': [],
        'diplo': {
            'ally': null,
            'allies': null,
            'nonattack': null,
            'warwith': null
        }
    };

    galaxy_view.id = parseInt(document.getElementById('uniId').value.trim(), 10);

    if (diplotable) {
        for (var x = 0; x < diplotable.childElementCount; x++) {
            if (/Allianzangehörigkeit:/.test(diplotable.children[x].children[0].innerText)) {
                console.log(diplotable.children[x].children[1].innerText.trim());
                galaxy_view.diplo.ally = diplotable.children[x].children[1].innerText.trim();
                continue;
            } else if (/Verbündet mit:/.test(diplotable.children[x].children[0].innerText)) {
                galaxy_view.diplo.allies = diplotable.children[x].children[1].innerText.trim().split(' | ');
                continue;
            } else if (/Nicht-Angriffs-Pakt mit:/.test(diplotable.children[x].children[0].innerText)) {
                galaxy_view.diplo.nonattack = diplotable.children[x].children[1].innerText.trim().split(' | ');
                continue;
            } else if (/Im Krieg mit:/.test(diplotable.children[x].children[0].innerText)) {
                galaxy_view.diplo.warwith = diplotable.children[x].children[1].innerText.trim().split(' | ');
                continue;
            }
        }
        content.need2upload = true;
    }

    if (membertable) {
        for (var x = 1; x < membertable.childElementCount; x++) {
            const coords = membertable.children[x].children[0].innerText.split(":", 2);

            galaxy_view.member.push({
                "galaxy": parseInt(coords[0], 10),
                "planet": parseInt(coords[1], 10),
                "place": parseInt(membertable.children[x].children[1].innerText.trim(), 10),
                "name": membertable.children[x].children[2].innerText.trim(),
                "points": parseInt(membertable.children[x].children[3].innerText.replace(/\./g, ""), 10),
                "astros": parseInt(membertable.children[x].children[4].innerText.trim(), 10)
            });
        }
        content.need2upload = true;
    }

    content.data.push(galaxy_view);
    return content;
}

const gn_scan_name_to_type = function(gntypestring) {
    if (gntypestring === "sektor") {
        return 0;
    } else if (gntypestring === "mili") {
        return 2;
    } else if (gntypestring === "einheit") {
        return 1;
    } else if (gntypestring === "gesch") {
        return 3;
    } else if (gntypestring === "news") {
        return 4;
    } else {
        return -1;
    }
}

const parse_news = function(news) {
    // get general information
    var returnval = { 'typ': 'news' };
    returnval.entries = Array();

    var tablerows = news.getElementsByTagName("table")[0].firstElementChild.children;
    if (/^Newsscan.+Ergebnis.+Genauigkeit:\s+(\d+)/.test(tablerows[0].innerText.trim())) {
        returnval.wahr = parseInt(RegExp.$1, 10);
    }
    if (/^Name:\s+(.+)/.test(tablerows[1].innerText.trim())) {
        returnval.nick = RegExp.$1;
    }
    if (/Koordinaten:\s*(\d+):(\d+)/.test(tablerows[2].innerText.trim())) {
        returnval.galid = parseInt(RegExp.$1, 10);
        returnval.placeid = parseInt(RegExp.$2, 10);
    }

    var tablerows = news.getElementsByTagName("table")[1].firstElementChild.children;

    for (var i = 0; i < tablerows.length; i += 2) {
        var newseintrag = { t: null, title: null, content: null };
        var txt = tablerows[i].innerText.trim();
        newseintrag.t = txt.substr(1, 19); //[03/05-2016 09:15:13]
        newseintrag.title = txt.substr(22, txt.length);
        newseintrag.content = tablerows[i + 1].innerText.trim();

        returnval.entries.push(newseintrag);
    }
    return returnval;
}

const parse_intelligence = function() {
    console.log("Starting to parse scan page...");
    var content = get_basic_info();
    content.data = [];

    // get the number of scan amplifier
    let svs = [0, 0];
    var nodes = document.getElementsByTagName("tr"),
        x;
    for (x = 0; x < nodes.length; x++) {
        // console.log(nodes[x].innerText);
        if (/Anzahl\s+eigener\s+Scanverst.+rker:\s+(\d+)\s*\(*\s*\+*\s*(\d*)/.test(nodes[x].innerText)) {
            svs[0] = parseInt(RegExp.$1, 10);
            svs[1] = parseInt(RegExp.$2, 10);
            svs[0] = (isNaN(svs[0])) ? 0 : svs[0];
            svs[1] = (isNaN(svs[1])) ? 0 : svs[1];
            break;
        }
    }
    content.svs = {
        "own": svs[0],
        "ally": svs[1],
        "total": svs[0] + svs[1]
    };

    // do I have a News?
    content.scantype = null;
    nodes = document.getElementsByTagName("td");
    for (x = 0; x < nodes.length; x++) {
        // console.log(nodes[x].innerText);
        if (/^\s*(\S+scan) Ergebnis \(Genauigkeit: (\d+)%\)/.test(nodes[x].innerText)) {
            content.scantype = RegExp.$1;
            break;
        }
    }

    // check for scanblock
    content.block = false;
    nodes = document.getElementsByClassName("msgred");
    for (x = 0; x < nodes.length; x++) {
        // console.log(nodes[x].innerText);
        if (/Leider konnten unsere Scanner keine brauchbaren Resultate liefern, Kommandant./.test(nodes[x].innerText)) {
            content.block = true;

            var urlParams;
            if (top["mainFrame"] === undefined) {
                urlParams = new URLSearchParams(document.URL);
            } else {
                urlParams = new URLSearchParams(top["mainFrame"].location.href);
            }
            var blockdata = {
                'galaxy': null,
                'planet': null,
                'type': null
            };
            blockdata.galaxy = parseInt(urlParams.get('c1'), 10);
            blockdata.planet = parseInt(urlParams.get('c2'), 10);
            blockdata.type = gn_scan_name_to_type(urlParams.get('typ'));

            console.log("Found block" + JSON.stringify({
                'document-URL': document.URL,
                'node': nodes[x],
                'urlparam': urlParams.entries(),
                'blockdata': blockdata
            }));

            content.data.push(blockdata);
            content.need2upload = true;
            break;
        }
    }

    if (content.scantype != null && content.block === false) {
        nodes = document.getElementsByTagName("input");
        for (x = 0; x < nodes.length; x++) {
            //console.log(x+": "); console.log(nodes[x]);
            if (nodes[x].name === "scanresult") {
                if (content.scantype === "Newsscan" && content.data.length == 0) {
                    var el = document.createElement('html');
                    el.innerHTML = nodes[x].value;
                    content.data.push(parse_news(el));
                    content.need2upload = true;
                    break;
                } else {
                    content.data.push(PHP.parse(nodes[x].value));
                    content.need2upload = true;
                }
            }
        }
    }

    return content;
}

function parse_tactics() {
    var content = get_basic_info();

    const parseFlotten = function(dat) {
        var y = [];
        for (var j = 0; j < dat.length; j++) {
            var div = document.createElement("div");
            div.innerHTML = dat[j];
            var txt = div.textContent.trim();
            if (txt.length > 0)
                y.push(txt);
        }
        return y;
    }

    const convertRemainingTime = function(input) {
        var result;
        //minute format
        if (input.includes('Min')) {
            result = Math.ceil(parseInt(input.replaceAll('Min').trim()) / 15.0);
        } else if (input.includes(':')) {
            input = input.split(':');
            if (input.length == 3) {
                //with seconds
                result = Math.ceil((parseInt(input[0]) * 60 + parseInt(input[1]) + Math.ceil(parseInt(input[2]))) / 15.0);
            } else {
                //without seconds
                result = Math.ceil((parseInt(input[0]) * 60 + parseInt(input[1])) / 15.0);
            }
            //roundet to 0, this is wrong.
            if (result === 0) {
                result = 1;
            }
        } else {
            //tick format
            result = parseInt(input);
        }

        return result;
    }

    const tables = document.getElementsByTagName("tbody");

    for (var x = 0; x < tables.length; x++) {
        if (/^Sektor\s+Kommandant\s+Greift\s+an\s+Zeit\s+Verteidigt\s+Zeit\s+Wird\s+angegriffen\s+von\s+Zeit\s+Wird\s+verteidigt\s+von\s+Zeit$/.test(tables[x].children[0].innerText.trim())) {
            fleettable = tables[x];
            break;
        }
    }

    const rows = fleettable.getElementsByTagName("tr");
    for (var x = 1; x < rows.length - 1; x++) {
        var cells = rows[x].getElementsByTagName("td");

        var member = {
            koords: cells[0].textContent.trim().split(':'),
            name: cells[1].textContent.replace('*', '').trim(),
            greift_an: parseFlotten(cells[2].innerHTML.split('<br>')),
            greift_an_zeit: parseFlotten(cells[3].innerHTML.split('<br>')),
            verteidigt: parseFlotten(cells[4].innerHTML.split('<br>')),
            verteidigt_zeit: parseFlotten(cells[5].innerHTML.split('<br>')),
            angegriffen_von: parseFlotten(cells[6].innerHTML.split('<br>')),
            angegriffen_von_zeit: parseFlotten(cells[7].innerHTML.split('<br>')),
            verteidigt_von: parseFlotten(cells[8].innerHTML.split('<br>')),
            verteidigt_von_zeit: parseFlotten(cells[9].innerHTML.split('<br>')),
        };

        //time conversion
        for (var j = 0; j < member.verteidigt_zeit.length; j++) {
            member.verteidigt_zeit[j] = convertRemainingTime(member.verteidigt_zeit[j]);
            send = true;
        }
        for (var j = 0; j < member.verteidigt_von_zeit.length; j++) {
            member.verteidigt_von_zeit[j] = convertRemainingTime(member.verteidigt_von_zeit[j]);
            send = true;
        }
        for (var j = 0; j < member.angegriffen_von_zeit.length; j++) {
            member.angegriffen_von_zeit[j] = convertRemainingTime(member.angegriffen_von_zeit[j]);
            send = true;
        }
        for (var j = 0; j < member.greift_an_zeit.length; j++) {
            member.greift_an_zeit[j] = convertRemainingTime(member.greift_an_zeit[j]);
            send = true;
        }

        content.data.push(member);
    }

    content.need2upload = true;
    return content;
}

// Identify type of the page
const heading = document.getElementById("heading");
var pagetype;
if (heading) {
    pagetype = heading.innerText.trim();
}

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
var pagecontent = {};
if (pagetype) {
    switch (pagetype) {
        case "Ranglisten":
            // contains the list of galaxies, Allies, and players
            break;
        case "Galaxieansicht":
            // contains the general galaxy overview
            pagecontent = parse_galaxy();
            pagecontent.type = "galaxyoverview";
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
            pagecontent = parse_tactics();
            pagecontent.type = "galaxytactics";
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
            pagecontent = parse_intelligence();
            pagecontent.type = "intelligence";
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

    console.log(JSON.stringify(pagecontent));

    if (pagecontent.need2upload) {
        chrome.storage.sync.get(['location', 'apikey'], function(results) {
            const req = new XMLHttpRequest();

            apikey = results.apikey;
            baseUrl = results.location + "/addtodb.php";

            pagecontent.apikey = apikey;
            console.log("Pagecontent API-Key: " + pagecontent.apikey + " baseUrl: " + baseUrl);
            const urlParams = "json=" + encodeURIComponent(JSON.stringify(pagecontent));

            req.open("POST", baseUrl, true);
            req.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
            req.send(urlParams);

            req.onreadystatechange = function() { // Call a function when the state changes.
                if (this.readyState === XMLHttpRequest.DONE && this.status === 200) {
                    console.log("Got response 200!");
                    console.log(this.responseText);
                }
            }
        });
    }
}

// let tables = document.getElementsByTagName("table");

// for (elt of tables) {
//     elt.style['background-color'] = '#FF00FF';
// }