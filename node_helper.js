const NodeHelper = require("node_helper");
const { demoPlanes, fetchPlanes, fetchRoute, isFlightCallsign, requestArea } = require("./lib/feeds");

const CACHE_MS = 5000;
const ROUTE_KEEP_MS = 6 * 60 * 60 * 1000;
const ROUTE_RETRY_MS = 10 * 60 * 1000;
const ROUTE_LOOKUPS_AT_ONCE = 4;
const ROUTE_CACHE_SIZE = 2000;

module.exports = NodeHelper.create({
	start () {
		this.cache = new Map();
		this.routes = new Map();
		this.routeLookups = 0;
	},

	socketNotificationReceived (notification, payload) {
		if (notification === "SKYSCOPE_FETCH") this.update(payload);
	},

	async update ({ id, lat, lon, rangeKm, demo }) {
		if (demo) {
			const planes = demoPlanes(lat, lon, rangeKm, Date.now());
			this.sendSocketNotification("SKYSCOPE_DATA", { id, ok: true, source: "demo", planes });
			return;
		}

		try {
			const { source, planes } = await this.load(requestArea(lat, lon, rangeKm));
			const withRoutes = planes.map((plane) => ({ ...plane, route: this.route(plane.callsign) }));
			this.sendSocketNotification("SKYSCOPE_DATA", { id, ok: true, source, planes: withRoutes });
		} catch (error) {
			console.error(`MMM-SkyScope: no feed answered: ${error.message}`);
			this.sendSocketNotification("SKYSCOPE_DATA", { id, ok: false });
		}
	},

	// The route if it is known. Otherwise it is looked up in the background and goes out with a later update,
	// so a slow route lookup never holds up the planes.
	route (callsign) {
		if (!isFlightCallsign(callsign)) return null;
		const known = this.routes.get(callsign);
		const now = Date.now();
		if (known && (known.pending || now < known.until)) return known.route;
		if (this.routeLookups >= ROUTE_LOOKUPS_AT_ONCE) return known ? known.route : null;

		if (this.routes.size >= ROUTE_CACHE_SIZE) {
			for (const [key, entry] of this.routes) {
				if (!entry.pending && now >= entry.until) this.routes.delete(key);
			}
		}
		const route = known ? known.route : null;
		this.routes.set(callsign, { route, pending: true });
		this.routeLookups += 1;
		fetchRoute(callsign)
			.then((found) => this.routes.set(callsign, { route: found, until: Date.now() + ROUTE_KEEP_MS }))
			.catch((error) => {
				console.warn(`MMM-SkyScope: no route for ${callsign}: ${error.message}`);
				this.routes.set(callsign, { route, until: Date.now() + ROUTE_RETRY_MS });
			})
			.finally(() => { this.routeLookups -= 1; });
		return route;
	},

	// Several mirrors or instances asking for the same area share one request.
	async load (area) {
		const key = `${area.lat},${area.lon},${area.nm}`;
		const cached = this.cache.get(key);
		if (cached && Date.now() - cached.fetchedAt < CACHE_MS) {
			const elapsed = Date.now() - cached.fetchedAt;
			return {
				source: cached.source,
				planes: cached.planes.map((plane) => ({ ...plane, ageMs: plane.ageMs + elapsed }))
			};
		}
		const result = await fetchPlanes(area);
		this.cache.set(key, { ...result, fetchedAt: Date.now() });
		return result;
	}
});
