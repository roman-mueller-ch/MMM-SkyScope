const assert = require("node:assert/strict");
const { test } = require("node:test");
const { demoPlanes, fetchPlanes, normalizeAircraft, parseResponse, requestArea } = require("../lib/feeds");

const record = { hex: "abc123", flight: "SWR12   ", r: "HB-JCA", t: "BCS3", category: "A3", lat: 47.4, lon: 8.5, alt_baro: 36000, gs: 450, track: 90, baro_rate: -64, squawk: "2777", emergency: "none", seen_pos: 1.5 };

test("the home is rounded before it goes to a feed", () => {
	assert.deepEqual(requestArea(47.37689, 8.54169, 50), { lat: 47.38, lon: 8.54, nm: 29 });
});

test("the radius stays within what the feeds accept", () => {
	assert.equal(requestArea(0, 0, 5000).nm, 250);
});

test("a record becomes a plane", () => {
	const plane = normalizeAircraft(record);
	assert.equal(plane.callsign, "SWR12");
	assert.equal(plane.altFt, 36000);
	assert.equal(plane.ageMs, 1500);
	assert.equal(plane.emergency, false);
	assert.equal(plane.onGround, false);
	assert.equal(plane.label, "Swiss");
	assert.equal(plane.aircraft, "Airbus A220-300");
});

test("a plane on the ground has no altitude", () => {
	const plane = normalizeAircraft({ ...record, alt_baro: "ground" });
	assert.equal(plane.onGround, true);
	assert.equal(plane.altFt, null);
});

test("a missing callsign falls back to the registration, then the hex", () => {
	assert.equal(normalizeAircraft({ ...record, flight: "   " }).callsign, "HB-JCA");
	assert.equal(normalizeAircraft({ ...record, flight: undefined, r: undefined }).callsign, "ABC123");
});

test("emergencies come from the status or the squawk", () => {
	assert.equal(normalizeAircraft({ ...record, emergency: "general" }).emergency, true);
	assert.equal(normalizeAircraft({ ...record, squawk: "7700" }).emergency, true);
});

test("planes without a position or with an old one are dropped", () => {
	assert.equal(normalizeAircraft({ ...record, lat: undefined }), null);
	assert.equal(normalizeAircraft({ ...record, seen_pos: 120 }), null);
});

test("both response shapes parse, anything else throws", () => {
	assert.equal(parseResponse({ ac: [record] }).length, 1);
	assert.equal(parseResponse({ aircraft: [record] }).length, 1);
	assert.throws(() => parseResponse({ error: "nope" }));
});

test("the second feed answers when the first fails", async () => {
	const urls = [];
	const fakeFetch = async (url) => {
		urls.push(url);
		if (url.includes("adsb.lol")) return { ok: false, status: 503 };
		return { ok: true, json: async () => ({ aircraft: [record] }) };
	};
	const result = await fetchPlanes({ lat: 47.38, lon: 8.54, nm: 29 }, fakeFetch);
	assert.equal(result.source, "adsb.fi");
	assert.equal(result.planes.length, 1);
	assert.equal(urls.length, 2);
});

test("an error names every feed when all fail", async () => {
	const fakeFetch = async () => {
		throw new Error("offline");
	};
	await assert.rejects(fetchPlanes({ lat: 0, lon: 0, nm: 1 }, fakeFetch), /adsb\.lol: offline; adsb\.fi: offline/u);
});

test("the demo sky moves along each plane's track", () => {
	const [first] = demoPlanes(47, 8, 50, 1000000);
	const [later] = demoPlanes(47, 8, 50, 1001000);
	assert.equal(first.track, 20);
	assert.ok(later.lat > first.lat, "a plane on track 020 goes north");
	assert.ok(later.lon > first.lon, "a plane on track 020 goes east");
});
