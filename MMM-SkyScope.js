/* global MM, Module, Path2D */

(function () {
	const KM_PER_DEG_LAT = 110.574;
	const KM_PER_DEG_LON = 111.32;
	const KM_PER_UNIT = { km: 1, nm: 1.852, mi: 1.609344 };
	const MIN_POLL_MS = 10000;
	const MAX_EXTRAPOLATE_S = 60;
	const DROP_AFTER_MS = 60000;
	const NO_DATA_AFTER_MS = 60000;
	const TWO_PI = Math.PI * 2;
	const PLANE_DRAWS_PER_SECOND = 2;
	const LABEL_HEIGHT = 26;
	const LABEL_STICKINESS = 60; // square pixels of overlap a label puts up with before changing sides
	const toRad = (deg) => deg * Math.PI / 180;
	const overlapArea = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
		* Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
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
			frameRate: 12,
			hideGround: true,
			trailLength: 12,
			labelCount: 6,
			listCount: 5,
			followPresence: true,
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
			this.hidden = false; // by MagicMirror
			this.asleep = false; // because the screen is off
			this.sleepDelayMs = null; // null unless a motion sensor controls the screen
			this.startPolling();
		},

		suspend () {
			this.hidden = true;
			this.stopActivity();
		},

		resume () {
			this.hidden = false;
			this.startActivity();
		},

		startActivity () {
			if (this.hidden || this.asleep) return;
			this.startPolling();
			this.startLoop();
		},

		stopActivity () {
			clearInterval(this.pollTimer);
			this.pollTimer = null;
			clearInterval(this.frameTimer);
			this.frameTimer = null;
		},

		notificationReceived (notification, payload) {
			if (notification === "DOM_OBJECTS_CREATED") this.setUpPresence();
			if (this.sleepDelayMs === null) return;
			if (notification === "USER_PRESENCE" && payload) {
				clearTimeout(this.sleepTimer);
				this.wake();
			} else if (notification === "USER_PRESENCE") {
				this.scheduleSleep();
			} else if (notification === "SCREEN_WAKEUP") {
				this.wake();
			}
		},

		// The always-on switch is not announced to other modules, so with one fitted the screen could be on during a sleep.
		setUpPresence () {
			const sensor = this.config.followPresence && MM.getModules().find(({ name }) => name === "MMM-PIR-Sensor");
			if (!sensor || !sensor.config.powerSaving || sensor.config.alwaysOnPin) return;
			this.sleepDelayMs = (sensor.config.powerSavingDelay || 0) * 1000;
			// After a start with nobody around, the sensor turns the screen off without a notification.
			if (!sensor.userPresence) this.scheduleSleep();
		},

		// The sensor reports the end of motion at once and turns the screen off after its delay, so wait as long.
		scheduleSleep () {
			clearTimeout(this.sleepTimer);
			this.sleepTimer = setTimeout(() => this.sleep(), this.sleepDelayMs);
		},

		sleep () {
			this.asleep = true;
			this.stopActivity();
			this.updateText();
		},

		wake () {
			if (!this.asleep) return;
			this.asleep = false;
			this.lastGoodAt = Date.now();
			this.updateText();
			this.startActivity();
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

			this.dpr = window.devicePixelRatio || 1;
			this.canvas = this.createLayer();
			this.ctx = this.canvas.getContext("2d");
			this.rgb = this.parseColor(this.config.color);
			this.sweep = this.renderSweep();
			this.sweepCanvas = this.createLayer();
			this.sweepCtx = this.sweepCanvas.getContext("2d");

			// The beam has a canvas of its own, so most frames leave the planes and labels alone.
			const scope = document.createElement("div");
			scope.className = "skyscope-scope";
			scope.style.height = `${size}px`;
			scope.append(this.renderBackground(), this.sweepCanvas, this.canvas);
			this.wrapper.appendChild(scope);

			this.statusEl = document.createElement("div");
			this.statusEl.className = "skyscope-status xsmall dimmed";
			this.wrapper.appendChild(this.statusEl);

			this.listEl = document.createElement("table");
			this.listEl.className = "skyscope-list xsmall";
			this.wrapper.appendChild(this.listEl);

			this.updateText();
			this.startLoop();
			return this.wrapper;
		},

		createLayer () {
			const { size } = this.config;
			const layer = document.createElement("canvas");
			layer.width = size * this.dpr;
			layer.height = size * this.dpr;
			layer.style.width = `${size}px`;
			layer.style.height = `${size}px`;
			return layer;
		},

		// A timer and not requestAnimationFrame, which would wake the browser for every
		// screen refresh even when no frame is due. That is costly without a GPU.
		startLoop () {
			if (this.frameTimer || !this.ctx) return;
			const frameRate = Math.max(this.config.frameRate, 0.1);
			const framesPerPlaneDraw = Math.max(Math.round(frameRate / PLANE_DRAWS_PER_SECOND), 1);
			let frame = 0;
			const step = () => {
				const now = Date.now();
				this.drawSweep(now);
				if (frame % framesPerPlaneDraw === 0) this.draw(now);
				frame += 1;
			};
			step();
			this.frameTimer = setInterval(step, 1000 / frameRate);
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
			const { rotation, rangeKm } = this.config;
			const { center, radius } = this.geometry();
			const layer = this.createLayer();
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
				// The outermost ring carries the unit, away from the traffic around home.
				const outermost = (ring + step) * kmPerUnit > rangeKm * 1.001;
				ctx.fillText(outermost ? `${ring} ${this.units}` : `${ring}`, center, center - r + 15);
			}

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

		// The glow fades out within a quarter turn behind the beam, so the layer holds only that
		// quarter, with the beam along its bottom edge. Each frame turns it into place.
		renderSweep () {
			const layer = document.createElement("canvas");
			const side = Math.ceil(this.geometry().radius * this.dpr);
			layer.width = side;
			layer.height = side;
			const ctx = layer.getContext("2d");
			ctx.beginPath();
			ctx.arc(0, side, side, 0, TWO_PI);
			ctx.clip();
			const glow = ctx.createConicGradient(0, 0, side);
			glow.addColorStop(0, this.themed(0));
			glow.addColorStop(0.82, this.themed(0));
			glow.addColorStop(1, this.themed(0.3));
			ctx.fillStyle = glow;
			ctx.fillRect(0, 0, side, side);
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

		beamBearing (now) {
			return now / (this.config.sweepSeconds * 1000) % 1 * TWO_PI;
		},

		// The planes and labels, on their own canvas above the beam.
		draw (now) {
			const { ctx, dpr } = this;
			const { size, rotation } = this.config;
			const { center, radius } = this.geometry();
			const beam = this.beamBearing(now);
			const visible = this.visiblePlanes(now);

			ctx.setTransform(1, 0, 0, 1, 0, 0);
			ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

			ctx.save();
			ctx.beginPath();
			ctx.arc(center, center, radius, 0, TWO_PI);
			ctx.clip();
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

		drawSweep (now) {
			const { sweepCtx: ctx, dpr } = this;
			const { center, radius } = this.geometry();
			const side = this.sweep.width / dpr;
			ctx.setTransform(1, 0, 0, 1, 0, 0);
			ctx.clearRect(0, 0, this.sweepCanvas.width, this.sweepCanvas.height);
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			ctx.translate(center, center);
			ctx.rotate(this.beamBearing(now) - Math.PI / 2);
			ctx.drawImage(this.sweep, 0, -side, side, side);
			ctx.strokeStyle = this.themed(0.85);
			ctx.lineWidth = 1.5;
			ctx.beginPath();
			ctx.moveTo(0, 0);
			ctx.lineTo(radius, 0);
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

		planeRadius (data) {
			return this.config.size * 0.024 * (CATEGORY_SCALE[data.category] || 1);
		},

		drawPlane ({ plane, position }, now, brightness) {
			const { ctx } = this;
			const { data } = plane;
			const { x, y } = this.toScreen(position);
			const scale = this.planeRadius(data);
			ctx.save();
			ctx.translate(x, y);
			ctx.rotate(toRad((data.track ?? 0) - this.config.rotation));
			ctx.scale(scale, scale);
			ctx.globalAlpha = data.emergency ? 1 : brightness;
			ctx.fillStyle = this.planeColor(data, now);
			ctx.fill(this.silhouette);
			ctx.restore();
		},

		// Emergencies first, then the nearest. A plane is labelled unless every side of it is off the canvas or on another label.
		drawLabels (visible, now, size) {
			const { ctx } = this;
			const ordered = [...visible].sort((a, b) => b.plane.data.emergency - a.plane.data.emergency);
			const planeBoxes = visible.map(({ plane, position }) => {
				const { x, y } = this.toScreen(position);
				const r = this.planeRadius(plane.data);
				return { plane, left: x - r, right: x + r, top: y - r, bottom: y + r };
			});
			const placed = [];
			let count = 0;
			ctx.textBaseline = "alphabetic";
			ctx.textAlign = "left";
			for (const { plane, position } of ordered) {
				if (count >= this.config.labelCount) break;
				const { data } = plane;
				ctx.font = "600 12px 'Roboto Condensed', sans-serif";
				const nameWidth = ctx.measureText(data.label).width;
				ctx.font = "11px 'Roboto Condensed', sans-serif";
				const width = Math.max(nameWidth, ctx.measureText(data.model).width);
				const box = this.chooseLabelBox(plane, this.toScreen(position), width, planeBoxes, placed, size);
				if (!box) continue;
				placed.push(box);
				count += 1;
				ctx.fillStyle = this.planeColor(data, now);
				ctx.font = "600 12px 'Roboto Condensed', sans-serif";
				ctx.fillText(data.label, box.left, box.top + 12);
				ctx.font = "11px 'Roboto Condensed', sans-serif";
				ctx.fillText(data.model, box.left, box.top + 24);
			}
		},

		// The side of the plane that covers the fewest other planes. A plane keeps its side
		// unless another is clearly better, so labels do not flicker as the planes move.
		chooseLabelBox (plane, { x, y }, width, planeBoxes, placed, size) {
			const gap = this.planeRadius(plane.data) + 2;
			const tops = { right: y - LABEL_HEIGHT / 2, left: y - LABEL_HEIGHT / 2, below: y + gap, above: y - gap - LABEL_HEIGHT };
			const lefts = { right: x + gap, left: x - gap - width, below: x - width / 2, above: x - width / 2 };
			let best = null;
			for (const side of Object.keys(tops)) {
				const box = { side, left: lefts[side], right: lefts[side] + width, top: tops[side], bottom: tops[side] + LABEL_HEIGHT };
				if (box.left < 0 || box.right > size || box.top < 0 || box.bottom > size) continue;
				if (placed.some((other) => overlapArea(box, other) > 0)) continue;
				let cost = side === plane.labelSide ? -LABEL_STICKINESS : 0;
				for (const other of planeBoxes) {
					if (other.plane !== plane) cost += overlapArea(box, other);
				}
				if (!best || cost < best.cost) best = { box, cost };
			}
			if (!best) return null;
			plane.labelSide = best.box.side;
			return best.box;
		},

		updateText () {
			if (!this.statusEl) return;
			const now = Date.now();
			const visible = this.visiblePlanes(now);
			const noData = !this.demo && now - this.lastGoodAt > NO_DATA_AFTER_MS;
			if (this.demo) {
				this.statusEl.textContent = "DEMO: made-up planes. Set lat and lon for the real sky.";
			} else if (this.asleep) {
				this.statusEl.textContent = "Paused until someone is here";
			} else if (noData) {
				this.statusEl.textContent = "NO DATA: retrying";
			} else if (this.source) {
				this.statusEl.textContent = `${visible.length} planes · ${this.source}`;
			} else {
				this.statusEl.textContent = "Listening…";
			}

			this.listEl.replaceChildren();
			for (const { plane } of visible.slice(0, this.config.listCount)) {
				const { data } = plane;
				const row = this.listEl.insertRow();
				if (data.emergency) row.className = "skyscope-emergency";
				// The airline says enough on its own. For anyone else, where the plane is from helps.
				const airline = data.operator && data.operator !== "Private";
				const detail = airline ? data.label : [data.operator, data.country].filter(Boolean).join(", ");
				// An airline flight goes by its flight number, anyone else by the label, which is the registration.
				const flight = data.route ? data.route.flight : airline ? data.callsign : data.label;
				const route = data.route ? `${data.route.from}→${data.route.to}` : "";
				for (const text of [flight, route, data.aircraft, detail]) row.insertCell().textContent = text;
			}
		}
	});
}());
