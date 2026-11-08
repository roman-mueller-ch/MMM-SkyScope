# MMM-SkyScope

A MagicMirror² module: a radar scope of the planes around a home point. See `README.md` for what it does and its options.

## Layout

- `MMM-SkyScope.js`: the browser side. Draws the scope on a canvas and fills the status line and list.
- `node_helper.js`: the server side. Answers `SKYSCOPE_FETCH` with `SKYSCOPE_DATA`, sharing identical requests for 5 seconds.
- `lib/feeds.js`: the feeds, record parsing and the demo sky. No MagicMirror dependencies, so `npm test` can load it.
- `lib/names.js`: plain names for airline codes, aircraft type codes and registration countries. adsb.lol sends no aircraft descriptions, so the type table is what names most planes; add to it rather than to the feeds.
- `tools/`: a preview page and scripts for checking the drawing without MagicMirror.

The browser side asks for data on a timer and the helper keeps no timers, so `suspend` and `resume` only have to deal with the browser side. Those timers stop for two separate reasons: `hidden`, when MagicMirror hides the module, and `asleep`, when MMM-PIR-Sensor has the screen off. They restart only when neither applies.

## Commands

```sh
npm test                 # unit tests for lib/feeds.js and the pausing
tools/check-labels.sh    # label placement measured on a busy made-up sky
tools/screenshot.sh      # regenerates docs/demo.png
```

Open `tools/preview.html` in a browser to watch the module fly the demo sky. The scripts need Google Chrome; set `CHROME` if it is not in the usual macOS place.

## Testing

`tools/preview.html` loads the real module code with a small stand-in for MagicMirror's `Module` API. It covers the drawing, not the connection to MagicMirror, so the last check for any change is `git pull` and a restart on a real mirror.

Sparse test skies hide layout problems. Check drawing changes with `tools/check-labels.sh` and by looking at `tools/preview.html?busy`. That sky is deliberately harder than real traffic, so compare its numbers between versions instead of expecting zeros. The current baseline is 3.42 labels on other planes per frame, 16 side switches and 2 nearest planes ever unlabelled.

The scope is three stacked canvases, because a Raspberry Pi 3 in Electron draws them without a GPU and each frame costs real CPU there. The background never changes after `renderBackground`, `drawSweep` runs 12 times a second by default, and `draw` paints the planes and labels twice a second. Keep both cheap, and put static parts in `renderBackground` or `renderSweep`, which run once. Check CPU changes with `top` on a real mirror, as a fast machine hides the cost.

## Rules

- **No personal data in this public repo.** That means no real home coordinates, addresses or town names, including in commit messages. The README example stays on the Zürich placeholder.
- **Screenshots come from demo mode only.** A live screenshot shows distances and bearings from someone's home.
- **The home is rounded before it leaves the mirror.** `requestArea` rounds it to about a kilometre; keep it that way for any new feed.
- **Made-up data is always marked.** The demo keeps its big DEMO label and status line.
- **No runtime dependencies**, so installing stays a plain `git clone`.
- **The module's `lat` and `lon` defaults stay `null`.** That is what triggers the demo.
- **Code style:** tabs, double quotes, and a comment only where the reason is not obvious.

## Decisions

- **Feeds:** adsb.lol first, adsb.fi as the fallback. Both work without a key. airplanes.live answers with a request to contact them first, so it is not used.
- **Name:** SkyScope avoids the OWLOS and Flightradar24 names. The code is original; only the OWLOS README was read, and the README credits it as the inspiration.
- **Controls:** no touch controls, as most mirrors have no touchscreen.
- **Presence:** `followPresence` reads MMM-PIR-Sensor's config and copies its `powerSavingDelay`, so there is no second delay to keep in step. The radar must never sleep while the screen is on, so it stays awake if that module's `powerSaving` is off or an `alwaysOnPin` is set.

## Ideas for later

- A map background. OpenStreetMap's tile usage policy needs checking first.
- A watch list that highlights chosen planes when they come into range.
- A listing in MagicMirror's third-party module directory.
