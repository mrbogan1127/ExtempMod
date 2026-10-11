# Extemp Prep Room

A silent prep-room dashboard for Mac browsers and iPad Safari, with saved tournaments and rounds. Speaker numbers identify speakers; no roster entry is needed.

## Start or continue

The app opens to a welcome screen. Name the tournament, choose a saved round or create a new one, and set the event format, speaker count, prep duration, and standard/final spacing. Choose **Continue round** to enter the dashboard. **Tournament & rounds** returns to setup without stopping the clocks.

New rounds inherit speaker count, event format, and default prep duration from the previous round. They start with fresh timers and standard spacing; choose Final when needed. New tournaments keep existing tournaments and rounds available in the selector.

## Plan the tournament schedule

On the welcome screen, use **Your rounds → Add round** to create as many rounds as needed. Each round shows a compact summary. Choose **Edit settings** to change its name, first prep start date/time, speakers per event, event format, prep minutes, and standard/final spacing. Tap **Save settings** for each row. **Open round** saves edits in that row and enters its prep room.

Dates and times use the device’s local timezone. Scheduled starts are reminders, not automatic timer starts. After the first actual start, reminders follow that start and your manual time corrections. US and International each follow their own sequence. Leaving the date/time blank keeps manual-only first starts.

You can edit any saved round without opening it. Prep-duration changes apply only to unstarted speakers; running or paused timers are preserved. Schedule rows are ordered by planned start, with unscheduled rounds last. Schedules are included in automatic saves and backup files.

## Run the room

- Start each speaker manually. Standard reminders follow the last actual start by 8 minutes; final-round reminders use 12 minutes.
- Set time accepts minutes or mm:ss. Correcting the latest speaker’s remaining time adjusts the next-start reminder. Actual recorded start times stay recorded; release estimates change with the correction.
- Next actions orders starts, 15-minute warnings, releases, and returns by time. Every due action and up to four future actions are shown.
- Mark speakers **Released** when they actually leave. A finished timer remains flagged until then. Release confirmation also acknowledges the end-of-prep warning.
- Standard rounds have no return reminders, including after switching a previously final round to standard. Students may leave for lunch after release.
- Final rounds prompt you to send the last speaker with Speaker 1. **Both released** or **Release with last** records that departure and starts the 10-minute return reminder. Confirm when the last speaker is back. Their prep timer is not automatically paused or started by this trip.
- Prep colors change at 15, 10, 5, 2, and 1 minutes, then again when finished. Warning acknowledgments are at 15 minutes and the end of prep.
- Returning to a round or refreshing recalculates countdowns from saved deadlines. A sleeping or background device may not draw warnings until the app is visible again.

## Saving and backups

Each action saves all rounds in this browser on this device. The last complete save is also retained as a recovery copy. Existing single-session saves are migrated into Round 1. Save failures display a notice; use **Backups & device setup → Export backup** before closing if saving fails.

Export creates a JSON file for Files/Downloads. Import adds rounds with new IDs and does not overwrite existing rounds. The round active in the backup is selected after import. For moving to another device, export on the first device and import on the second.

There is no automatic cloud sync. Mac, iPad, different browsers, Safari, and a Home Screen web app can have separate storage. Clearing site data can remove saved rounds. Keep a backup file somewhere safe, such as iCloud Drive. Use one browser window to operate a round at a time.

## Publish on GitHub Pages

No build system or server is required. Keep your existing GitHub Pages address.

Upload these files to the same Pages publishing folder as your current index.html:

- index.html
- styles.css
- rounds.js
- room-tools.js
- script.js
- device.js
- manifest.webmanifest
- sw.js
- icons/icon-192.png
- icons/icon-512.png

The supplied ZIP has these files at its root, plus this guide. Extract and upload its contents, not the ZIP itself. Preserve the icons folder. Existing unrelated repository files may stay. Jeopardy is no longer used.

Open the HTTPS Pages URL after deployment. Under **Backups & device setup**, wait for **Offline app ready on this device** before relying on offline access. The downloaded/local file version supports the prep room but cannot install offline caching.

When publishing future code changes, change the CACHE version in sw.js. An update waits for existing app windows to close so it does not replace the app during a round. Close every window of the app after your round and reopen to activate a waiting update. No round data is stored inside the service-worker cache.

## iPad and Mac

**iPad alone:** Open the hosted HTTPS website in Safari → Share → Add to Home Screen (enable Open as Web App when offered). Open it once online to prepare offline access. Use that same app for subsequent rounds. Export/import if moving a session from Safari to the Home Screen app.

**Mac alone:** Open the same website in your browser. Use a regular browser profile rather than private browsing for ongoing saved rounds.

**Mac with Sidecar:** Run the app on the Mac and move the browser window to the iPad display. The Mac remains the source of the running session and saved data. This avoids transferring or syncing rounds. Sidecar input capabilities depend on the installed system versions; the Mac keyboard/trackpad or a compatible Apple Pencil can operate the display. Keep the Mac awake and the page visible during the round.

Apple guides:
- https://support.apple.com/102597
- https://support.apple.com/guide/ipad/ipad8f1f7a29/ipados

## Checks

Run `node tests/timers.cjs` for timer, warning, release, final-round return, round persistence, backup import/recovery, and welcome-flow checks. Run `node tests/offline.cjs` for offline assets and GitHub Pages subfolder handling.

These are automated state and service-worker checks. Actual iPad Safari rendering, Home Screen installation, offline relaunch, and Sidecar still need a device smoke test before tournament use.
