const assert = require("node:assert/strict");
const { test } = require("node:test");
const { describe, registrationCountry } = require("../lib/names");

const plane = (fields) => describe({ callsign: "", registration: "", type: "", desc: "", category: "", ...fields });

test("an airline flight shows the airline and the aircraft", () => {
	assert.deepEqual(plane({ callsign: "SWR533X", registration: "HB-JDA", type: "A20N", category: "A3" }), {
		operator: "Swiss", label: "Swiss", aircraft: "Airbus A320neo", model: "A320neo", country: "Switzerland"
	});
});

test("a plane flying under its registration is private", () => {
	const balloon = plane({ callsign: "HBQAB", registration: "HB-QAB", type: "BALL", category: "B2" });
	assert.equal(balloon.operator, "Private");
	assert.equal(balloon.label, "HB-QAB");
	assert.equal(balloon.aircraft, "Hot-air balloon");
	assert.equal(balloon.country, "Switzerland");
});

test("an unknown airline keeps its callsign", () => {
	const unknown = plane({ callsign: "XYZ311", registration: "9A-ABC", type: "E195" });
	assert.equal(unknown.operator, "");
	assert.equal(unknown.label, "XYZ311");
	assert.equal(unknown.aircraft, "Embraer E195");
});

test("an unknown type falls back to the feed's description, then the category", () => {
	assert.equal(plane({ type: "ZZZ1", desc: "DIAMOND DA-20" }).aircraft, "Diamond DA-20");
	assert.equal(plane({ category: "A7" }).aircraft, "Helicopter");
	assert.equal(plane({ type: "ZZZ1" }).aircraft, "ZZZ1");
});

test("a model that is only a number keeps its maker", () => {
	assert.equal(plane({ type: "C172" }).model, "Cessna 172");
	assert.equal(plane({ type: "B738" }).model, "Boeing 737-800");
	assert.equal(plane({ type: "GLF5" }).model, "Gulfstream V");
});

test("long models are cut short for the scope labels", () => {
	const model = plane({ type: "ZZZ1", desc: "Balony Kubicek BB 57 Hot Air Balloon" }).model;
	assert.ok(model.length <= 16);
	assert.ok(model.endsWith("…"));
});

test("the country comes from the registration prefix", () => {
	assert.equal(registrationCountry("D-AIBL"), "Germany");
	assert.equal(registrationCountry("N123AB"), "United States");
	assert.equal(registrationCountry("ZZ-ZZZ"), "");
	assert.equal(registrationCountry(""), "");
});
