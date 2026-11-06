const assert = require("node:assert/strict");
const { beforeEach, test } = require("node:test");

let definition;
global.Module = { register: (name, value) => { definition = value; } };
global.Path2D = class {};
require("../MMM-SkyScope");

const DELAY_S = 60;
const FETCH_MS = 15000;

function setUp ({ sensor = { powerSaving: true, powerSavingDelay: DELAY_S, alwaysOnPin: false }, userPresence = false, config = {} } = {}) {
	global.MM = { getModules: () => (sensor ? [{ name: "clock", config: {} }, { name: "MMM-PIR-Sensor", config: sensor, userPresence }] : [{ name: "clock", config: {} }]) };
	const mod = Object.create(definition);
	const counts = { fetches: 0, beams: 0 };
	mod.identifier = "test";
	mod.config = { ...definition.defaults, lat: 1, lon: 2, ...config };
	mod.sendSocketNotification = () => { counts.fetches += 1; };
	mod.ctx = {};
	mod.draw = () => {};
	mod.drawSweep = () => { counts.beams += 1; };
	mod.statusEl = { textContent: "" };
	mod.listEl = { replaceChildren () {} };
	mod.start();
	mod.startLoop();
	mod.notificationReceived("DOM_OBJECTS_CREATED");
	mod.counts = counts;
	return mod;
}

// How much it fetches and draws over the next minute.
function activity (t, mod) {
	const before = { ...mod.counts };
	t.mock.timers.tick(60000);
	return { fetches: mod.counts.fetches - before.fetches, beams: mod.counts.beams - before.beams };
}

const running = (t, mod) => {
	const { fetches, beams } = activity(t, mod);
	assert.equal(fetches, 60000 / FETCH_MS);
	assert.ok(beams >= 700, `${beams} beams in a minute`);
};

const stopped = (t, mod) => assert.deepEqual(activity(t, mod), { fetches: 0, beams: 0 });

let t;
beforeEach((context) => {
	t = context;
	t.mock.timers.enable({ apis: ["setTimeout", "setInterval", "Date"], now: 1800000000000 });
});

test("it keeps running without a sensor module, whatever is announced", () => {
	const mod = setUp({ sensor: null });
	mod.notificationReceived("USER_PRESENCE", false);
	t.mock.timers.tick(DELAY_S * 2000);
	running(t, mod);
});

for (const [name, options] of Object.entries({
	"the option is off": { config: { followPresence: false } },
	"the sensor does not control the screen": { sensor: { powerSaving: false, powerSavingDelay: DELAY_S, alwaysOnPin: false } },
	"an always-on switch is fitted": { sensor: { powerSaving: true, powerSavingDelay: DELAY_S, alwaysOnPin: 17 } }
})) {
	test(`it keeps running when ${name}`, () => {
		const mod = setUp(options);
		mod.notificationReceived("USER_PRESENCE", false);
		t.mock.timers.tick(DELAY_S * 2000);
		running(t, mod);
	});
}

test("it runs until the screen goes off, then stops drawing and fetching", () => {
	const mod = setUp({ userPresence: true });
	mod.notificationReceived("USER_PRESENCE", false);
	t.mock.timers.tick(DELAY_S * 1000 - 1);
	assert.equal(mod.asleep, false);
	t.mock.timers.tick(1);
	assert.equal(mod.asleep, true);
	stopped(t, mod);
});

test("motion before the delay is up cancels the sleep", () => {
	const mod = setUp({ userPresence: true });
	mod.notificationReceived("USER_PRESENCE", false);
	t.mock.timers.tick(DELAY_S * 500);
	mod.notificationReceived("USER_PRESENCE", true);
	t.mock.timers.tick(DELAY_S * 2000);
	assert.equal(mod.asleep, false);
});

test("a new end of motion starts the delay again", () => {
	const mod = setUp({ userPresence: true });
	mod.notificationReceived("USER_PRESENCE", false);
	t.mock.timers.tick(DELAY_S * 500);
	mod.notificationReceived("USER_PRESENCE", false);
	t.mock.timers.tick(DELAY_S * 500 + 1000);
	assert.equal(mod.asleep, false);
	t.mock.timers.tick(DELAY_S * 500);
	assert.equal(mod.asleep, true);
});

test("a delay of zero sleeps as soon as motion ends", () => {
	const mod = setUp({ userPresence: true, sensor: { powerSaving: true, powerSavingDelay: 0, alwaysOnPin: false } });
	mod.notificationReceived("USER_PRESENCE", false);
	t.mock.timers.tick(0);
	assert.equal(mod.asleep, true);
});

test("after a start with nobody around it sleeps along with the screen", () => {
	const mod = setUp();
	assert.equal(mod.asleep, false);
	t.mock.timers.tick(DELAY_S * 1000);
	assert.equal(mod.asleep, true);
});

test("after a start with someone there it stays awake", () => {
	const mod = setUp({ userPresence: true });
	t.mock.timers.tick(DELAY_S * 2000);
	assert.equal(mod.asleep, false);
});

test("motion wakes it with a fetch straight away", () => {
	const mod = setUp();
	t.mock.timers.tick(DELAY_S * 1000);
	stopped(t, mod);
	const before = mod.counts.fetches;
	mod.notificationReceived("USER_PRESENCE", true);
	assert.equal(mod.counts.fetches, before + 1);
	running(t, mod);
});

test("waking repeatedly does not start extra timers", () => {
	const mod = setUp();
	t.mock.timers.tick(DELAY_S * 1000);
	mod.notificationReceived("USER_PRESENCE", true);
	mod.notificationReceived("USER_PRESENCE", true);
	mod.notificationReceived("SCREEN_WAKEUP");
	running(t, mod);
});

test("a screen wake-up wakes it, and leaves a sleep already on its way alone", () => {
	const mod = setUp({ userPresence: true });
	mod.notificationReceived("USER_PRESENCE", false);
	mod.notificationReceived("SCREEN_WAKEUP");
	t.mock.timers.tick(DELAY_S * 1000);
	assert.equal(mod.asleep, true);
	mod.notificationReceived("SCREEN_WAKEUP");
	assert.equal(mod.asleep, false);
	running(t, mod);
});

test("motion does not restart a module MagicMirror has hidden", () => {
	const mod = setUp();
	t.mock.timers.tick(DELAY_S * 1000);
	mod.suspend();
	mod.notificationReceived("USER_PRESENCE", true);
	stopped(t, mod);
	mod.resume();
	running(t, mod);
});

test("showing the module does not restart it during a sleep", () => {
	const mod = setUp();
	mod.suspend();
	t.mock.timers.tick(DELAY_S * 1000);
	mod.resume();
	stopped(t, mod);
	mod.notificationReceived("USER_PRESENCE", true);
	running(t, mod);
});

test("the status says it is paused, and a long sleep does not read as no data", () => {
	const mod = setUp();
	t.mock.timers.tick(DELAY_S * 1000);
	assert.match(mod.statusEl.textContent, /Paused/);
	t.mock.timers.tick(3600000);
	mod.notificationReceived("USER_PRESENCE", true);
	assert.doesNotMatch(mod.statusEl.textContent, /Paused|NO DATA/);
});

test("the demo stays marked during a sleep", () => {
	const mod = setUp({ config: { demo: true } });
	t.mock.timers.tick(DELAY_S * 1000);
	assert.equal(mod.asleep, true);
	assert.match(mod.statusEl.textContent, /^DEMO/);
});
