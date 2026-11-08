// Plain names for the codes the feeds send: airlines, aircraft types and registration countries.

// ICAO airline codes, the first three letters of an airline's callsign.
const AIRLINES = {
	AAL: "American", AAR: "Asiana", ABY: "Air Arabia", ACA: "Air Canada", ADB: "Antonov", AEA: "Air Europa",
	AEE: "Aegean", AFL: "Aeroflot", AFR: "Air France", AHO: "Air Hamburg", AIC: "Air India", ANA: "ANA",
	ASL: "Air Serbia", AUA: "Austrian", BAW: "British Airways", BCS: "DHL", BCY: "CityJet", BEL: "Brussels Airlines",
	BOX: "AeroLogic", BTI: "airBaltic", CAI: "Corendon", CAL: "China Airlines", CCA: "Air China", CES: "China Eastern",
	CFG: "Condor", CHH: "Hainan Airlines", CLH: "Lufthansa CityLine", CLX: "Cargolux", CND: "Corendon", CPA: "Cathay Pacific",
	CSA: "Czech Airlines", CSN: "China Southern", CTN: "Croatia Airlines", DAH: "Air Algérie", DAL: "Delta", DHK: "DHL",
	DLA: "Air Dolomiti", DLH: "Lufthansa", EDW: "Edelweiss", EIN: "Aer Lingus", EJU: "easyJet", ELY: "El Al",
	ENT: "Enter Air", ETD: "Etihad", ETH: "Ethiopian", EVA: "EVA Air", EWG: "Eurowings", EXS: "Jet2",
	EZS: "easyJet", EZY: "easyJet", FDB: "flydubai", FDX: "FedEx", FIN: "Finnair", GAF: "German Air Force",
	GEC: "Lufthansa Cargo", GFA: "Gulf Air", GIA: "Garuda", GTI: "Atlas Air", HOP: "Air France Hop", HVN: "Vietnam Airlines",
	IBE: "Iberia", IBS: "Iberia Express", ICE: "Icelandair", ITY: "ITA Airways", JAF: "TUI", JAL: "Japan Airlines",
	KAC: "Kuwait Airways", KAL: "Korean Air", KLM: "KLM", KQA: "Kenya Airways", KZR: "Air Astana", LDM: "Lauda",
	LGL: "Luxair", LOG: "Loganair", LOT: "LOT", MAS: "Malaysia Airlines", MAY: "Malta Air", MEA: "Middle East Airlines",
	MSR: "EgyptAir", NAX: "Norwegian", NJE: "NetJets", NOZ: "Norwegian", OAL: "Olympic", OAW: "Helvetic",
	OCN: "Discover", OMA: "Oman Air", PAL: "Philippine Airlines", PGT: "Pegasus", QFA: "Qantas", QTR: "Qatar Airways",
	RAM: "Royal Air Maroc", RCH: "US Air Force", RJA: "Royal Jordanian", ROT: "TAROM", RUK: "Ryanair", RYR: "Ryanair",
	SAA: "South African", SAS: "SAS", SAZ: "Rega", SIA: "Singapore Airlines", SVA: "Saudia", SWR: "Swiss",
	SXS: "SunExpress", TAP: "TAP Air Portugal", TAR: "Tunisair", TFL: "TUI", THA: "Thai", THY: "Turkish Airlines",
	TOM: "TUI", TRA: "Transavia", TSC: "Air Transat", TUI: "TUI", TVF: "Transavia", TVS: "Smartwings",
	UAE: "Emirates", UAL: "United", UPS: "UPS", UZB: "Uzbekistan Airways", VIR: "Virgin Atlantic", VJT: "VistaJet",
	VLG: "Vueling", VOE: "Volotea", WAZ: "Wizz Air", WMT: "Wizz Air", WUK: "Wizz Air", WZZ: "Wizz Air"
};

// ICAO type codes as [maker, model]. The scope labels leave out the maker where the model says enough.
const TYPES = {
	A306: ["Airbus", "A300"], A310: ["Airbus", "A310"], A318: ["Airbus", "A318"], A319: ["Airbus", "A319"],
	A320: ["Airbus", "A320"], A321: ["Airbus", "A321"], A19N: ["Airbus", "A319neo"], A20N: ["Airbus", "A320neo"],
	A21N: ["Airbus", "A321neo"], A332: ["Airbus", "A330-200"], A333: ["Airbus", "A330-300"], A338: ["Airbus", "A330-800"],
	A339: ["Airbus", "A330-900"], A343: ["Airbus", "A340-300"], A346: ["Airbus", "A340-600"], A359: ["Airbus", "A350-900"],
	A35K: ["Airbus", "A350-1000"], A388: ["Airbus", "A380"], A400: ["Airbus", "A400M"], BCS1: ["Airbus", "A220-100"],
	BCS3: ["Airbus", "A220-300"], B712: ["Boeing", "717"], B733: ["Boeing", "737-300"], B734: ["Boeing", "737-400"],
	B735: ["Boeing", "737-500"], B736: ["Boeing", "737-600"], B737: ["Boeing", "737-700"], B738: ["Boeing", "737-800"],
	B739: ["Boeing", "737-900"], B37M: ["Boeing", "737 MAX 7"], B38M: ["Boeing", "737 MAX 8"], B39M: ["Boeing", "737 MAX 9"],
	B3XM: ["Boeing", "737 MAX 10"], B744: ["Boeing", "747-400"], B748: ["Boeing", "747-8"], B752: ["Boeing", "757-200"],
	B753: ["Boeing", "757-300"], B762: ["Boeing", "767-200"], B763: ["Boeing", "767-300"], B764: ["Boeing", "767-400"],
	B772: ["Boeing", "777-200"], B77L: ["Boeing", "777-200LR"], B773: ["Boeing", "777-300"], B77W: ["Boeing", "777-300ER"],
	B778: ["Boeing", "777-8"], B779: ["Boeing", "777-9"], B788: ["Boeing", "787-8"], B789: ["Boeing", "787-9"],
	B78X: ["Boeing", "787-10"], MD11: ["McDonnell Douglas", "MD-11"], E135: ["Embraer", "ERJ 135"], E145: ["Embraer", "ERJ 145"],
	E170: ["Embraer", "E170"], E75L: ["Embraer", "E175"], E75S: ["Embraer", "E175"], E190: ["Embraer", "E190"],
	E195: ["Embraer", "E195"], E290: ["Embraer", "E190-E2"], E295: ["Embraer", "E195-E2"], E50P: ["Embraer", "Phenom 100"],
	E55P: ["Embraer", "Phenom 300"], E35L: ["Embraer", "Legacy 600"], E545: ["Embraer", "Praetor 500"], E550: ["Embraer", "Praetor 600"],
	CRJ2: ["Bombardier", "CRJ200"], CRJ7: ["Bombardier", "CRJ700"], CRJ9: ["Bombardier", "CRJ900"], CRJX: ["Bombardier", "CRJ1000"],
	CL30: ["Bombardier", "Challenger 300"], CL35: ["Bombardier", "Challenger 350"], CL60: ["Bombardier", "Challenger 600"],
	GLEX: ["Bombardier", "Global Express"], GL5T: ["Bombardier", "Global 5000"], GL7T: ["Bombardier", "Global 7500"],
	LJ45: ["Learjet", "45"], LJ60: ["Learjet", "60"], AT43: ["ATR", "42"], AT45: ["ATR", "42"], AT46: ["ATR", "42"],
	AT72: ["ATR", "72"], AT75: ["ATR", "72"], AT76: ["ATR", "72"], DH8A: ["De Havilland", "Dash 8"], DH8B: ["De Havilland", "Dash 8"],
	DH8C: ["De Havilland", "Dash 8"], DH8D: ["De Havilland", "Dash 8-400"], DHC6: ["De Havilland", "Twin Otter"],
	SB20: ["Saab", "2000"], SF34: ["Saab", "340"], F70: ["Fokker", "70"], F100: ["Fokker", "100"], RJ85: ["Avro", "RJ85"],
	RJ1H: ["Avro", "RJ100"], D228: ["Dornier", "228"], D328: ["Dornier", "328"], J328: ["Dornier", "328 Jet"],
	C130: ["Lockheed", "Hercules"], C30J: ["Lockheed", "Super Hercules"], GLF4: ["Gulfstream", "IV"], GLF5: ["Gulfstream", "V"],
	GLF6: ["Gulfstream", "G650"], F2TH: ["Dassault", "Falcon 2000"], F900: ["Dassault", "Falcon 900"], FA50: ["Dassault", "Falcon 50"],
	FA7X: ["Dassault", "Falcon 7X"], FA8X: ["Dassault", "Falcon 8X"], H25B: ["Hawker", "800"], HDJT: ["Honda", "HondaJet"],
	C150: ["Cessna", "150"], C152: ["Cessna", "152"], C172: ["Cessna", "172"], C182: ["Cessna", "182"], C206: ["Cessna", "206"],
	C208: ["Cessna", "Caravan"], C210: ["Cessna", "210"], C510: ["Cessna", "Citation Mustang"], C525: ["Cessna", "Citation CJ1"],
	C25A: ["Cessna", "Citation CJ2"], C25B: ["Cessna", "Citation CJ3"], C25C: ["Cessna", "Citation CJ4"], C560: ["Cessna", "Citation V"],
	C56X: ["Cessna", "Citation Excel"], C680: ["Cessna", "Citation Sovereign"], C68A: ["Cessna", "Citation Latitude"],
	C700: ["Cessna", "Citation Longitude"], C750: ["Cessna", "Citation X"], P28A: ["Piper", "Cherokee"], P28R: ["Piper", "Arrow"],
	P28B: ["Piper", "Dakota"], P28T: ["Piper", "Arrow"], P32R: ["Piper", "Saratoga"], PA18: ["Piper", "Super Cub"], PA31: ["Piper", "Navajo"],
	C177: ["Cessna", "Cardinal"], C77R: ["Cessna", "Cardinal"], M20P: ["Mooney", "M20"], DR40: ["Robin", "DR400"],
	PA34: ["Piper", "Seneca"], PA46: ["Piper", "Malibu"], PC6T: ["Pilatus", "Porter"],
	PC7: ["Pilatus", "PC-7"], PC9: ["Pilatus", "PC-9"], PC12: ["Pilatus", "PC-12"], PC21: ["Pilatus", "PC-21"], PC24: ["Pilatus", "PC-24"],
	DV20: ["Diamond", "DA20"], DA40: ["Diamond", "DA40"], DA42: ["Diamond", "DA42"], DA62: ["Diamond", "DA62"],
	SR20: ["Cirrus", "SR20"], SR22: ["Cirrus", "SR22"], SF50: ["Cirrus", "Vision Jet"], BE20: ["Beechcraft", "King Air 200"],
	BE9L: ["Beechcraft", "King Air 90"], B350: ["Beechcraft", "King Air 350"], BE36: ["Beechcraft", "Bonanza"], BE58: ["Beechcraft", "Baron"],
	TBM7: ["Daher", "TBM 700"], TBM8: ["Daher", "TBM 850"], TBM9: ["Daher", "TBM 900"], BN2P: ["Britten-Norman", "Islander"],
	RV7: ["Van's", "RV-7"], RV8: ["Van's", "RV-8"], RV9: ["Van's", "RV-9"], RV10: ["Van's", "RV-10"],
	EC20: ["Airbus", "H120 helicopter"], EC30: ["Airbus", "H130 helicopter"], EC35: ["Airbus", "H135 helicopter"],
	EC45: ["Airbus", "H145 helicopter"], EC55: ["Airbus", "H155 helicopter"], AS50: ["Airbus", "H125 helicopter"],
	AS55: ["Airbus", "AS355 helicopter"], AS32: ["Airbus", "Super Puma"], AS65: ["Airbus", "Dauphin helicopter"],
	A109: ["Leonardo", "AW109 helicopter"], A119: ["Leonardo", "AW119 helicopter"], A139: ["Leonardo", "AW139 helicopter"],
	A169: ["Leonardo", "AW169 helicopter"], R22: ["Robinson", "R22 helicopter"], R44: ["Robinson", "R44 helicopter"],
	R66: ["Robinson", "R66 helicopter"], B06: ["Bell", "206 helicopter"], B407: ["Bell", "407 helicopter"], B429: ["Bell", "429 helicopter"],
	S76: ["Sikorsky", "S-76 helicopter"], NH90: ["NH90", "helicopter"], H47: ["Boeing", "Chinook"],
	BALL: ["", "Hot-air balloon"], GLID: ["", "Glider"], ULAC: ["", "Ultralight"]
};

// What kind of aircraft, from the ADS-B emitter category, for types not in the list above.
const CATEGORIES = {
	A1: "Light aircraft", A2: "Small aircraft", A3: "Airliner", A4: "Airliner", A5: "Large airliner", A6: "Fast jet",
	A7: "Helicopter", B1: "Glider", B2: "Balloon", B4: "Ultralight", B6: "Drone"
};

// Registration prefixes, the letters before the dash, or the first letter for US and a few others with no dash.
const COUNTRIES = {
	"2": "Guernsey", "4X": "Israel", "5B": "Cyprus", "9A": "Croatia", "9H": "Malta", A6: "UAE", A7: "Qatar",
	B: "China", C: "Canada", CS: "Portugal", D: "Germany", EC: "Spain", EI: "Ireland", ES: "Estonia",
	F: "France", G: "United Kingdom", HA: "Hungary", HB: "Switzerland", HL: "South Korea", I: "Italy", JA: "Japan",
	LN: "Norway", LX: "Luxembourg", LY: "Lithuania", LZ: "Bulgaria", M: "Isle of Man", N: "United States",
	OE: "Austria", OH: "Finland", OK: "Czechia", OM: "Slovakia", OO: "Belgium", OY: "Denmark", PH: "Netherlands",
	S5: "Slovenia", SE: "Sweden", SP: "Poland", SX: "Greece", T7: "San Marino", TC: "Türkiye", VH: "Australia",
	VP: "Bermuda", VQ: "Bermuda", VT: "India", YL: "Latvia", YR: "Romania", YU: "Serbia", ZS: "South Africa"
};

const LABEL_MAX_CHARS = 16;

/**
 * The country an aircraft is registered in.
 * @param {string} registration such as "HB-QAB" or "N123AB"
 * @returns {string} the country, or "" when unknown
 */
function registrationCountry (registration) {
	if (!registration) return "";
	const prefix = registration.includes("-") ? registration.split("-")[0] : registration[0];
	return COUNTRIES[prefix] || "";
}

// The feeds' descriptions shout the maker: "AIRBUS A-320neo" reads better as "Airbus A-320neo".
function tidyDescription (desc) {
	return desc.trim().split(/\s+/)
		.map((word) => /^[A-Z]{3,}$/.test(word) ? word[0] + word.slice(1).toLowerCase() : word)
		.join(" ");
}

function shorten (text) {
	return text.length > LABEL_MAX_CHARS ? `${text.slice(0, LABEL_MAX_CHARS - 1).trimEnd()}…` : text;
}

/**
 * Plain words for who flies a plane and what it is.
 * @param {{callsign: string, registration: string, type: string, desc: string, category: string}} plane from a feed
 * @returns {{operator: string, label: string, aircraft: string, model: string, country: string}}
 *   operator: the airline, or "Private" when the plane flies under its registration, or "" when unknown;
 *   label: the airline, else the registration for a plane flying under it, else the callsign;
 *   aircraft and model: the full and short type names
 */
function describe ({ callsign, registration, type, desc, category }) {
	const airline = /^[A-Z]{3}\d/.test(callsign) ? AIRLINES[callsign.slice(0, 3)] : undefined;
	const flatRegistration = (registration || "").replace("-", "");
	const underRegistration = Boolean(registration) && callsign.replace("-", "") === flatRegistration;
	const operator = airline || (underRegistration ? "Private" : "");

	const known = TYPES[type];
	let aircraft;
	let model;
	if (known) {
		aircraft = known[0] ? `${known[0]} ${known[1]}` : known[1];
		// "172", "737-800" or "V" means little without the maker.
		model = /^\d/.test(known[1]) || known[1].length <= 3 ? aircraft : known[1];
	} else if (desc) {
		aircraft = tidyDescription(desc);
		model = aircraft;
	} else {
		aircraft = CATEGORIES[category] || type || "Unknown aircraft";
		model = aircraft;
	}

	return {
		operator,
		label: airline || (underRegistration ? registration : callsign),
		aircraft,
		model: shorten(model),
		country: registrationCountry(registration)
	};
}

module.exports = { describe, registrationCountry };
