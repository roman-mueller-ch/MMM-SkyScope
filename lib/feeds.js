// Free ADS-B feeds and the demo sky. No MagicMirror dependencies, so it can be tested on its own.

const { describe: describePlane } = require("./names");

const KM_PER_NM = 1.852;
const KM_PER_DEG_LAT = 110.574;
const KM_PER_DEG_LON = 111.32;
const MAX_RADIUS_NM = 250;
const MAX_POSITION_AGE_S = 60;
const FETCH_TIMEOUT_MS = 8000;
const ROUTE_URL = "https://api.adsbdb.com/v0/callsign/";
const USER_AGENT = "MMM-SkyScope (MagicMirror module)";

const FEEDS = [
	{ name: "adsb.lol", url: (lat, lon, nm) => `https://api.adsb.lol/v2/point/${lat}/${lon}/${nm}` },
	{ name: "adsb.fi", url: (lat, lon, nm) => `https://opendata.adsb.fi/api/v2/lat/${lat}/lon/${lon}/dist/${nm}` }
];

/**
 * Build the area sent to the feeds. The home is rounded to about a kilometre so the exact
 * location never leaves the mirror, and the radius grows by a little to make up for it.
 * @param {number} lat home latitude
 * @param {number} lon home longitude
 * @param {number} rangeKm scope radius in km
 * @returns {{lat: number, lon: number, nm: number}} the area to ask for
 */
function requestArea (lat, lon, rangeKm) {
	const nm = Math.ceil(rangeKm / KM_PER_NM) + 2;
	return {
		lat: Math.round(lat * 100) / 100,
		lon: Math.round(lon * 100) / 100,
		nm: Math.min(Math.max(nm, 1), MAX_RADIUS_NM)
	};
}

/**
 * Turn one feed record into what the scope draws.
 * @param {object} ac aircraft record in the readsb format both feeds use
 * @returns {object|null} the plane, or null when it has no usable position
 */
function normalizeAircraft (ac) {
	if (typeof ac.lat !== "number" || typeof ac.lon !== "number" || !ac.hex) return null;
	const seenPos = typeof ac.seen_pos === "number" ? ac.seen_pos : 0;
	if (seenPos > MAX_POSITION_AGE_S) return null;

	const onGround = ac.alt_baro === "ground";
	const emergency = (ac.emergency && ac.emergency !== "none") || ["7500", "7600", "7700"].includes(ac.squawk);
	const callsign = (ac.flight || "").trim() || ac.r || ac.hex.toUpperCase();
	const registration = ac.r || "";
	const type = ac.t || "";
	const category = ac.category || "";
	return {
		hex: ac.hex,
		callsign,
		registration,
		type,
		category,
		...describePlane({ callsign, registration, type, desc: ac.desc || "", category }),
		lat: ac.lat,
		lon: ac.lon,
		altFt: typeof ac.alt_baro === "number" ? ac.alt_baro : ac.alt_geom ?? null,
		onGround,
		speedKt: ac.gs ?? null,
		track: ac.track ?? ac.true_heading ?? ac.mag_heading ?? null,
		climbFpm: ac.baro_rate ?? ac.geom_rate ?? 0,
		emergency: Boolean(emergency),
		ageMs: Math.round(seenPos * 1000)
	};
}

/**
 * Parse a feed response. adsb.lol lists the planes under "ac", adsb.fi under "aircraft".
 * @param {object} body the decoded response
 * @returns {object[]} the usable planes
 */
function parseResponse (body) {
	const list = body && (body.ac || body.aircraft);
	if (!Array.isArray(list)) throw new Error("response has no aircraft list");
	return list.map(normalizeAircraft).filter(Boolean);
}

/**
 * Ask the feeds in order until one answers.
 * @param {{lat: number, lon: number, nm: number}} area from requestArea
 * @param {Function} fetchFn fetch, replaceable for the tests
 * @returns {Promise<{source: string, planes: object[]}>} the planes and the feed that gave them
 */
async function fetchPlanes (area, fetchFn = fetch) {
	const errors = [];
	for (const feed of FEEDS) {
		try {
			const response = await fetchFn(feed.url(area.lat, area.lon, area.nm), {
				headers: { "User-Agent": USER_AGENT },
				signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
			});
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			return { source: feed.name, planes: parseResponse(await response.json()) };
		} catch (error) {
			errors.push(`${feed.name}: ${error.message}`);
		}
	}
	throw new Error(errors.join("; "));
}

/**
 * Whether a callsign looks like an airline flight (three letters, then a number), the only kind a route can be found for.
 * @param {string} callsign as the plane reports it
 * @returns {boolean} true for something like SWR262C
 */
function isFlightCallsign (callsign) {
	return /^[A-Z]{3}\d[A-Z0-9]{0,4}$/.test(callsign);
}

/**
 * Turn an adsbdb answer into the flight number and the airports, preferring the IATA codes people know.
 * @param {object} body the decoded response
 * @returns {{flight: string, from: string, to: string}|null} the route, or null when the answer has none
 */
function parseRoute (body) {
	const route = body && body.response && body.response.flightroute;
	if (!route || !route.origin || !route.destination) return null;
	const code = (airport) => airport.iata_code || airport.icao_code || "";
	return {
		flight: route.callsign_iata || route.callsign || "",
		from: code(route.origin),
		to: code(route.destination)
	};
}

/**
 * Look up where a flight goes. Only the callsign is sent, never a position.
 * @param {string} callsign an airline callsign such as SWR262C
 * @param {Function} fetchFn fetch, replaceable for the tests
 * @returns {Promise<object|null>} the route, or null when the callsign is unknown
 */
async function fetchRoute (callsign, fetchFn = fetch) {
	const response = await fetchFn(ROUTE_URL + encodeURIComponent(callsign), {
		headers: { "User-Agent": USER_AGENT },
		signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
	});
	if (response.status === 404) return null;
	if (!response.ok) throw new Error(`HTTP ${response.status}`);
	return parseRoute(await response.json());
}

/**
 * A made-up sky: planes on straight lines across the scope, worked out from the clock alone.
 * @param {number} lat centre latitude
 * @param {number} lon centre longitude
 * @param {number} rangeKm scope radius in km
 * @param {number} nowMs the time
 * @returns {object[]} planes in the same form as a feed gives
 */
function demoPlanes (lat, lon, rangeKm, nowMs) {
	const routes = [
		[20, -0.5, 460, 37000, "A320", "A3", "LHR", "IST"], [75, 0.3, 480, 39000, "B77W", "A5", "JFK", "DXB"],
		[130, -0.2, 300, 14000, "A319", "A3", "CDG", "VIE"], [165, 0.6, 250, 8000, "E190", "A3", "AMS", "FCO"],
		[215, -0.7, 440, 33000, "B738", "A3", "CPH", "MAD"], [250, 0.1, 210, 5500, "AT76", "A2", "LYS", "MXP"],
		[290, 0.45, 470, 41000, "A359", "A5", "SIN", "ORD"], [335, -0.35, 120, 3500, "C172", "A1"],
		[100, -0.8, 340, 21000, "CRJ9", "A3", "BCN", "MUC"]
	];
	const cosLat = Math.cos(lat * Math.PI / 180);
	return routes.map(([track, offset, speedKt, altFt, type, category, from, to], i) => {
		const heading = track * Math.PI / 180;
		const length = rangeKm * 2.4;
		// Speeded up against the range, so a small scope is not crossed in seconds or a large one in hours.
		const kmPerS = speedKt * KM_PER_NM / 3600 * (rangeKm / 50);
		const travelled = nowMs / 1000 * kmPerS + i * length / routes.length;
		const along = travelled % length - length / 2;
		const across = offset * rangeKm;
		const east = Math.sin(heading) * along + Math.cos(heading) * across;
		const north = Math.cos(heading) * along - Math.sin(heading) * across;
		const callsign = `DEMO${String(i + 1).padStart(2, "0")}`;
		return {
			// A new id on each crossing, so the trail does not streak back across the scope.
			hex: `demo${i}-${Math.floor(travelled / length)}`,
			callsign,
			registration: "",
			type,
			category,
			...describePlane({ callsign, registration: "", type, desc: "", category }),
			lat: lat + north / KM_PER_DEG_LAT,
			lon: lon + east / (KM_PER_DEG_LON * cosLat),
			altFt,
			onGround: false,
			speedKt: speedKt * (rangeKm / 50),
			track,
			climbFpm: i % 3 === 0 ? -900 : i % 3 === 1 ? 0 : 1100,
			emergency: i === 2,
			ageMs: 0,
			route: from ? { flight: callsign, from, to } : null
		};
	});
}

module.exports = { demoPlanes, fetchPlanes, fetchRoute, isFlightCallsign, normalizeAircraft, parseResponse, parseRoute, requestArea };
