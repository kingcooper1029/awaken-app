AWAKEN — first prototype

FILES
- index.html: app layout
- style.css: dark blue holographic appearance
- app.js: quests, XP, levels, stats, focus timer, local save, backup/restore
- manifest.json: home-screen app metadata
- service-worker.js: offline caching

RUN ON YOUR COMPUTER
1. Open the AWAKEN folder in Visual Studio Code.
2. Install the free "Live Server" extension (Ritwick Dey).
3. Right-click index.html and choose "Open with Live Server".
4. It opens in your browser.

IMPORTANT: Service workers and PWA installation require HTTPS or localhost. Opening index.html directly as a file won't enable offline caching or installation.

PUT IT ON YOUR ANDROID PHONE FOR FREE
Recommended: publish the files as a public repository on GitHub, then enable GitHub Pages.
1. Create/sign in to GitHub.
2. Create a new public repository named awaken-app.
3. Upload all five files to the repository root.
4. Open repository Settings > Pages.
5. Under Build and deployment, choose "Deploy from a branch".
6. Choose the main branch and /(root), then Save.
7. Wait for the published URL shown on the Pages settings page.
8. Open that URL in Chrome on your Android phone.
9. Chrome menu (three dots) > "Install app" or "Add to Home screen".

Use your actual published URL. Do not type a guessed URL.

DATA / LIMITATIONS
- Progress is stored in browser localStorage on the device and browser origin.
- Export a backup regularly from Settings. Import it if needed.
- Clearing browser/app data can erase saved progress.
- This first version uses self-reported quests; it does not automatically read Android screen time, block apps, verify food, or automatically detect workouts.
- The screen-time quest uses the minutes entered in Settings.
- The focus timer only measures a timer and does not lock the phone.
- No accounts, server, subscription, or paid API are required.
