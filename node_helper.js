const NodeHelper = require("node_helper");
const { demoPlanes, fetchPlanes, requestArea } = require("./lib/feeds");

const CACHE_MS = 5000;

module.exports = NodeHelper.create({
	start () {
		this.cache = new Map();
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
			this.sendSocketNotification("SKYSCOPE_DATA", { id, ok: true, source, planes });
		} catch (error) {
			console.error(`MMM-SkyScope: no feed answered: ${error.message}`);
			this.sendSocketNotification("SKYSCOPE_DATA", { id, ok: false });
		}
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
