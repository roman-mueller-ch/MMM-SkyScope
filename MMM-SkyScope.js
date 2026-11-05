/* global Module, Path2D */

(function () {
	const KM_PER_DEG_LAT = 110.574;
	const KM_PER_DEG_LON = 111.32;
	const KM_PER_UNIT = { km: 1, nm: 1.852, mi: 1.609344 };
	const MIN_POLL_MS = 10000;
	const MAX_EXTRAPOLATE_S = 60;
	const DROP_AFTER_MS = 60000;
	const NO_DATA_AFTER_MS = 60000;
	const TWO_PI = Math.PI * 2;
	const toRad = (deg) => deg * Math.PI / 180;
	const CATEGORY_SCALE = { A1: 0.75, A2: 0.85, A5: 1.25 };
	const SILHOUETTE = "M0,-1 L.12,-.75 L.12,-.25 L1,.2 L1,.38 L.12,.12 L.1,.62 L.38,.85 L.38,1 L0,.9 "
		+ "L-.38,1 L-.38,.85 L-.1,.62 L-.12,.12 L-1,.38 L-1,.2 L-.12,-.25 L-.12,-.75 Z";

	Module.register("MMM-SkyScope", {
		defaults: {
			lat: null,
			lon: null,
			rangeKm: 50,
			units: "km", // "km", "nm" or "mi", for the distances shown
			rotation: 0, // the compass bearing at the top of the scope
			size: 420,
			color: "#66ffb2",
			updateInterval: 15000,
			sweepSeconds: 6,
			frameRate: 20,
			hideGround: true,
			trailLength: 12,
			labelCount: 6,
			listCount: 5,
			demo: false
		},

		getStyles () {
			return ["MMM-SkyScope.css"];
		},

		start () {
			const { lat, lon, demo } = this.config;
			const hasHome = Number.isFinite(lat) && Number.isFinite(lon);
			this.demo = demo || !hasHome;
			this.home = hasHome ? { lat, lon } : { lat: 0, lon: 0 };
			this.cosHome = Math.cos(toRad(this.home.lat));
			this.units = KM_PER_UNIT[this.config.units] ? this.config.units : "km";
			this.planes = new Map();
			this.source = "";
			this.lastGoodAt = Date.now();
			this.silhouette = new Path2D(SILHOUETTE);
			this.startPolling();
		},

		suspend () {
			clearInterval(this.pollTimer);
			this.pollTimer = null;
			cancelAnimationFrame(this.frameRequest);
			this.frameRequest = null;
		},

		resume () {
			this.startPolling();
			this.startLoop();
		},

		startPolling () {
			if (this.pollTimer) return;
			this.requestPlanes();
			// The demo has nothing to be polite to, and a quick poll keeps its trails short and even.
			const interval = this.demo ? 3000 : Math.max(this.config.updateInterval, MIN_POLL_MS);
			this.pollTimer = setInterval(() => this.requestPlanes(), interval);
		},

		requestPlanes () {
			this.sendSocketNotification("SKYSCOPE_FETCH", {
				id: this.identifier,
				lat: this.home.lat,
				lon: this.home.lon,
				rangeKm: Math.min(this.config.rangeKm, 450),
				demo: this.demo
			});
		},

		socketNotificationReceived (notification, payload) {
			if (notification !== "SKYSCOPE_DATA" || payload.id !== this.identifier) return;
			if (!payload.ok) {
				this.updateText();
				return;
			}
			const now = Date.now();
			this.lastGoodAt = now;
			this.source = payload.source;
			for (const data of payload.planes) {
				const plane = this.planes.get(data.hex) || { trail: [] };
				const last = plane.trail[plane.trail.length - 1];
				if (!last || last.lat !== data.lat || last.lon !== data.lon) {
					plane.trail.push({ lat: data.lat, lon: data.lon });
					if (plane.trail.length > this.config.trailLength) plane.trail.shift();
				}
				plane.data = data;
				plane.receivedAt = now;
				plane.positionAt = now - data.ageMs;
				this.planes.set(data.hex, plane);
			}
			this.updateText();
		},

		getDom () {
			if (this.wrapper) return this.wrapper;
			const { size } = this.config;
			this.wrapper = document.createElement("div");
			this.wrapper.className = "skyscope";
			this.wrapper.style.width = `${size}px`;

			this.canvas = document.createElement("canvas");
			this.dpr = window.devicePixelRatio || 1;
			this.canvas.width = size * this.dpr;
			this.canvas.height = size * this.dpr;
			this.canvas.style.width = `${size}px`;
			this.canvas.style.height = `${size}px`;
			this.ctx = this.canvas.getContext("2d");
			this.wrapper.appendChild(this.canvas);

			this.statusEl = document.createElement("div");
			this.statusEl.className = "skyscope-status xsmall dimmed";
			this.wrapper.appendChild(this.statusEl);

			this.listEl = document.createElement("table");
			this.listEl.className = "skyscope-list xsmall";
			this.wrapper.appendChild(this.listEl);

			this.rgb = this.parseColor(this.config.color);
			this.background = this.renderBackground();
			this.updateText();
			this.startLoop();
			return this.wrapper;
		},

		startLoop () {
			if (this.frameRequest || !this.ctx) return;
			const minFrameMs = 1000 / this.config.frameRate;
			let lastFrame = 0;
			const loop = (time) => {
				this.frameRequest = requestAnimationFrame(loop);
				if (time - lastFrame < minFrameMs) return;
				lastFrame = time;
				this.draw(Date.now());
			};
			this.frameRequest = requestAnimationFrame(loop);
		},

		// Any CSS colour goes in, the canvas hands it back as #rrggbb.
		parseColor (color) {
			this.ctx.fillStyle = "#66ffb2";
			this.ctx.fillStyle = color;
			const value = parseInt(String(this.ctx.fillStyle).slice(1), 16);
			return Number.isNaN(value) ? [102, 255, 178] : [value >> 16 & 255, value >> 8 & 255, value & 255];
		},

		themed (alpha) {
			return `rgba(${this.rgb[0]},${this.rgb[1]},${this.rgb[2]},${alpha})`;
		},

		geometry () {
			const center = this.config.size / 2;
			return { center, radius: center - 22 };
		},

		// The current position of a plane in km from home, carried on along its track since the last report.
		position (plane, now) {
			const { data } = plane;
			let x = (data.lon - this.home.lon) * KM_PER_DEG_LON * this.cosHome;
			let y = (data.lat - this.home.lat) * KM_PER_DEG_LAT;
			if (!data.onGround && data.speedKt !== null && data.track !== null) {
				const seconds = Math.min((now - plane.positionAt) / 1000, MAX_EXTRAPOLATE_S);
				const km = data.speedKt * 1.852 / 3600 * seconds;
				x += Math.sin(toRad(data.track)) * km;
				y += Math.cos(toRad(data.track)) * km;
			}
			return { x, y };
		},

		toScreen ({ x, y }) {
			const { center, radius } = this.geometry();
			const scale = radius / this.config.rangeKm;
			const turn = toRad(this.config.rotation);
			return {
				x: center + (x * Math.cos(turn) - y * Math.sin(turn)) * scale,
				y: center - (x * Math.sin(turn) + y * Math.cos(turn)) * scale
			};
		},

		ringStep () {
			const range = this.config.rangeKm / KM_PER_UNIT[this.units];
			const steps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250];
			return steps.find((step) => range / step <= 5) || 500;
		},

		// Rings, ticks and bearings change only with the config, so they are drawn once.
		renderBackground () {
			const { size, rotation, rangeKm } = this.config;
			const { center, radius } = this.geometry();
			const layer = document.createElement("canvas");
			layer.width = size * this.dpr;
			layer.height = size * this.dpr;
			const ctx = layer.getContext("2d");
			ctx.scale(this.dpr, this.dpr);
			ctx.font = "11px 'Roboto Condensed', sans-serif";
			ctx.textAlign = "center";
			ctx.textBaseline = "middle";

			const step = this.ringStep();
			const kmPerUnit = KM_PER_UNIT[this.units];
			ctx.strokeStyle = this.themed(0.28);
			ctx.lineWidth = 1;
			for (let ring = step; ring * kmPerUnit <= rangeKm * 1.001; ring += step) {
				const r = ring * kmPerUnit / rangeKm * radius;
				ctx.beginPath();
				ctx.arc(center, center, r, 0, TWO_PI);
				ctx.stroke();
				ctx.fillStyle = this.themed(0.6);
				ctx.fillText(`${ring}`, center, center - r + 8);
			}
			ctx.fillStyle = this.themed(0.6);
			ctx.fillText(this.units, center, center + 9);

			ctx.strokeStyle = this.themed(0.5);
			ctx.beginPath();
			ctx.arc(center, center, radius, 0, TWO_PI);
			ctx.stroke();

			for (let bearing = 0; bearing < 360; bearing += 10) {
				const angle = toRad(bearing - rotation) - Math.PI / 2;
				const major = bearing % 30 === 0;
				const inner = radius - (major ? 8 : 4);
				ctx.strokeStyle = this.themed(major ? 0.7 : 0.35);
				ctx.beginPath();
				ctx.moveTo(center + Math.cos(angle) * inner, center + Math.sin(angle) * inner);
				ctx.lineTo(center + Math.cos(angle) * radius, center + Math.sin(angle) * radius);
				ctx.stroke();
			}
			["N", "E", "S", "W"].forEach((name, i) => {
				const angle = toRad(i * 90 - rotation) - Math.PI / 2;
				ctx.fillStyle = this.themed(0.95);
				ctx.fillText(name, center + Math.cos(angle) * (radius + 12), center + Math.sin(angle) * (radius + 12));
			});

			ctx.fillStyle = this.themed(0.95);
			ctx.fillRect(center - 3, center - 0.5, 6, 1);
			ctx.fillRect(center - 0.5, center - 3, 1, 6);
			return layer;
		},

		planeColor (data, now) {
			if (data.emergency) return Math.floor(now / 400) % 2 ? "#ff3b30" : "#ffffff";
			if (data.onGround) return "#8a8a8a";
			if (data.altFt === null) return "#bdbdbd";
			if (data.altFt < 10000) return "#ffb347";
			if (data.altFt < 25000) return this.themed(1);
			return "#ffffff";
		},

		altitudeText (data) {
			if (data.onGround) return "GND";
			if (data.altFt === null) return "---";
			const climb = data.climbFpm > 300 ? "↑" : data.climbFpm < -300 ? "↓" : "";
			return `FL${String(Math.round(data.altFt / 100)).padStart(3, "0")}${climb}`;
		},

		// The planes to draw, nearest first. Also lets go of the ones the feed stopped reporting.
		visiblePlanes (now) {
			const visible = [];
			for (const [hex, plane] of this.planes) {
				if (now - plane.receivedAt > DROP_AFTER_MS) {
					this.planes.delete(hex);
					continue;
				}
				if (this.config.hideGround && plane.data.onGround) continue;
				const position = this.position(plane, now);
				const km = Math.hypot(position.x, position.y);
				if (km > this.config.rangeKm) continue;
				visible.push({ plane, position, km });
			}
			return visible.sort((a, b) => a.km - b.km);
		},

		draw (now) {
			const { ctx, dpr } = this;
			const { size, sweepSeconds, rotation } = this.config;
			const { center, radius } = this.geometry();
			const beam = now / (sweepSeconds * 1000) % 1 * TWO_PI;
			const visible = this.visiblePlanes(now);

			ctx.setTransform(1, 0, 0, 1, 0, 0);
			ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
			ctx.drawImage(this.background, 0, 0);
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

			ctx.save();
			ctx.beginPath();
			ctx.arc(center, center, radius, 0, TWO_PI);
			ctx.clip();
			this.drawSweep(beam);
			if (this.demo) this.drawDemoMark(center);
			for (const entry of visible) this.drawTrail(entry, now);
			for (const entry of visible) {
				const bearing = Math.atan2(entry.position.x, entry.position.y) - toRad(rotation);
				const sinceBeam = ((beam - bearing) % TWO_PI + TWO_PI) % TWO_PI;
				this.drawPlane(entry, now, 0.6 + 0.4 * (1 - sinceBeam / TWO_PI) ** 3);
			}
			ctx.restore();
			this.drawLabels(visible, now, size);
		},

		drawSweep (beam) {
			const { ctx } = this;
			const { center, radius } = this.geometry();
			const angle = beam - Math.PI / 2;
			const glow = ctx.createConicGradient(angle, center, center);
			glow.addColorStop(0, this.themed(0));
			glow.addColorStop(0.82, this.themed(0));
			glow.addColorStop(1, this.themed(0.3));
			ctx.fillStyle = glow;
			ctx.fillRect(center - radius, center - radius, radius * 2, radius * 2);
			ctx.strokeStyle = this.themed(0.85);
			ctx.lineWidth = 1.5;
			ctx.beginPath();
			ctx.moveTo(center, center);
			ctx.lineTo(center + Math.cos(angle) * radius, center + Math.sin(angle) * radius);
			ctx.stroke();
		},

		drawDemoMark (center) {
			const { ctx } = this;
			ctx.save();
			ctx.font = `700 ${this.config.size * 0.2}px 'Roboto Condensed', sans-serif`;
			ctx.textAlign = "center";
			ctx.textBaseline = "middle";
			ctx.fillStyle = "rgba(255,255,255,0.16)";
			ctx.fillText("DEMO", center, center);
			ctx.restore();
		},

		drawTrail ({ plane, position }, now) {
			const { ctx } = this;
			const points = plane.trail.map(({ lat, lon }) => this.toScreen({
				x: (lon - this.home.lon) * KM_PER_DEG_LON * this.cosHome,
				y: (lat - this.home.lat) * KM_PER_DEG_LAT
			}));
			points.push(this.toScreen(position));
			ctx.strokeStyle = this.planeColor(plane.data, now);
			ctx.lineWidth = 1.25;
			for (let i = 1; i < points.length; i++) {
				ctx.globalAlpha = 0.5 * i / points.length;
				ctx.beginPath();
				ctx.moveTo(points[i - 1].x, points[i - 1].y);
				ctx.lineTo(points[i].x, points[i].y);
				ctx.stroke();
			}
			ctx.globalAlpha = 1;
		},

		drawPlane ({ plane, position }, now, brightness) {
			const { ctx } = this;
			const { data } = plane;
			const { x, y } = this.toScreen(position);
			const scale = this.config.size * 0.024 * (CATEGORY_SCALE[data.category] || 1);
			ctx.save();
			ctx.translate(x, y);
			ctx.rotate(toRad((data.track ?? 0) - this.config.rotation));
			ctx.scale(scale, scale);
			ctx.globalAlpha = data.emergency ? 1 : brightness;
			ctx.fillStyle = this.planeColor(data, now);
			ctx.fill(this.silhouette);
			ctx.restore();
		},

		// Emergencies first, then the nearest, skipping any label that would land on one already placed.
		drawLabels (visible, now, size) {
			const { ctx } = this;
			const ordered = [...visible].sort((a, b) => b.plane.data.emergency - a.plane.data.emergency);
			const placed = [];
			let count = 0;
			ctx.textBaseline = "alphabetic";
			for (const { plane, position } of ordered) {
				if (count >= this.config.labelCount) break;
				const { data } = plane;
				const { x, y } = this.toScreen(position);
				const altitude = this.altitudeText(data);
				ctx.font = "600 12px 'Roboto Condensed', sans-serif";
				const width = Math.max(ctx.measureText(data.callsign).width, ctx.measureText(altitude).width);
				const left = x + 12 + width > size - 4 ? x - 12 - width : x + 12;
				const box = { left, right: left + width, top: y - 13, bottom: y + 13 };
				const hit = placed.some((other) => box.left < other.right && box.right > other.left && box.top < other.bottom && box.bottom > other.top);
				if (hit || box.top < 0 || box.bottom > size) continue;
				placed.push(box);
				count += 1;
				ctx.textAlign = "left";
				ctx.fillStyle = this.planeColor(data, now);
				ctx.fillText(data.callsign, left, y - 1);
				ctx.font = "11px 'Roboto Condensed', sans-serif";
				ctx.fillText(altitude, left, y + 11);
			}
		},

		updateText () {
			if (!this.statusEl) return;
			const now = Date.now();
			const visible = this.visiblePlanes(now);
			const noData = !this.demo && now - this.lastGoodAt > NO_DATA_AFTER_MS;
			if (this.demo) {
				this.statusEl.textContent = "DEMO: made-up planes. Set lat and lon for the real sky.";
			} else if (noData) {
				this.statusEl.textContent = "NO DATA: retrying";
			} else if (this.source) {
				this.statusEl.textContent = `${visible.length} planes · ${this.source}`;
			} else {
				this.statusEl.textContent = "Listening…";
			}

			this.listEl.replaceChildren();
			for (const { plane, position, km } of visible.slice(0, this.config.listCount)) {
				const { data } = plane;
				const bearing = (Math.atan2(position.x, position.y) * 180 / Math.PI + 360) % 360;
				const row = this.listEl.insertRow();
				if (data.emergency) row.className = "skyscope-emergency";
				const cells = [
					data.callsign,
					data.type,
					this.altitudeText(data),
					`${Math.round(km / KM_PER_UNIT[this.units])} ${this.units}`,
					`${String(Math.round(bearing) % 360).padStart(3, "0")}°`
				];
				for (const text of cells) row.insertCell().textContent = text;
			}
		}
	});
}());
