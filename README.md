<h1><img alt="CCCBib" src=".github/logo.svg" height="34"></h1>

[media.ccc.de](https://media.ccc.de) media library application for webOS.

![Main Screen](https://github.com/volkovmqx/cccbib/blob/main/.github/screenshots/screenshot1.png?raw=true)

![Player Screen](https://github.com/volkovmqx/cccbib/blob/main/.github/screenshots/screenshot2.png?raw=true)


## Background

This app uses the official media.ccc.de/graphql endpoint. It is built using React, Embla and a plain HTML5 video player with the help of a lot of caffeine. ☕

## Features

- Support for conferences lazy loading.
- Preview of the events on scroll.
- Support for language change.
- Smart TV Navigation with React! (Thanks to [this](https://noriginmedia.com/2019/06/24/smart-tv-navigation-with-react/) and [this](https://medium.com/@utkarsh.gupta.316/spatial-navigation-in-react-js-for-smart-tv-3aa6977a94b1).)
- Search functionnality.
- Watchlist and Continue Watching (20 most recent talks in progress).
- Remote control options (see [Remote control](#remote-control)).
- Customizations (Black, Dark, Light and Accent colors and custom fonts).
- 9 app languages.
- Aspect ratio changing for older videos (Auto, Zoom, Stretch).
- Quality of Life Remote Controller Button Mapping (Thanks to [Simon34545](https://github.com/Simon34545) LG Input Keymapping overview!) inspired by Youtube/Jellyfin.
- Configuration page for preferred languages and subtitles.
- Substitles functionnality.
- About Info page (in Settings on the bottom).

## Remote control

CCCBib takes its commands as webOS launch parameters so the TV needs no open port. It is off by default and you turn it on once in Settings (Playback and then Remote Control). A command is a JSON object. If the app is not running it starts and runs the command and if it is running it gets the command as a relaunch and nothing restarts.

<details>
<summary>Commands</summary>

| Command | Parameters |
| --- | --- |
| `play` (or only `link`) | `link` must be a `media.ccc.de/v/...` link (with https://, http:// or without a scheme), nothing else is accepted (no other host, no bare slug or GUID). Optional: `start` (seconds), `aspect` (auto, zoom, stretch), `subtitle` (language code or none), `language` (audio language code) |
| `pause`, `resume`, `toggle`, `stop` | none, `stop` closes the player |
| `seek` | `to` (seconds) or `by` (seconds, negative goes back) |
| `mute` | `value` true or false, without it the state toggles |
| `aspect` | `value`: auto, zoom or stretch |
| `subtitle` | `value`: language code or none |
| `language` | `value`: audio language code |
| `add` | `link`, `links` (list of links) or `items` (list of `{link, position}` or `{link, percent}`). Adds to the watchlist. With a `position` (seconds) or `percent` the talk is also put on the in progress list (Continue Watching) |
| `remove` | `link` or `links`. Removes from the watchlist only, a talk that has progress stays on the in progress list |
| `progress` | `link` with `position` (seconds) or `percent`, or `items` as above. The talk appears on the in progress list, the watchlist is not touched. Under 10 seconds clears the progress, the talk that is playing is moved with a seek |
| `progress-set` | `items` replaces the whole in progress list |
| `progress-clear` | `link` or `links`, removes the progress |

Every link in every command and list is checked the same way and talks that fail the check are skipped. `progress-set` changes nothing if a single link in the list is not valid or cannot be loaded. A command takes up to 50 links and the in progress list never holds more than 20 talks (the most recent ones).

Example, send a whole in progress list:

```json
{"cmd": "progress-set", "items": [
  {"link": "https://media.ccc.de/v/24c3-2303-en-inside_the_macosx_kernel", "position": 1200},
  {"link": "https://media.ccc.de/v/25c3-2874-en-the_ultimate_commodore_64_talk", "percent": 40}
]}
```

</details>

<details>
<summary>Sending commands and reading the state</summary>

From a shell on the TV:

```sh
luna-send -n 1 luna://com.webos.service.applicationmanager/launch \
  '{"id":"org.webosbrew.cccbib","params":{"cmd":"play","link":"https://media.ccc.de/v/24c3-2303-en-inside_the_macosx_kernel","aspect":"zoom"}}'
```

From a computer with the webOS CLI: `ares-launch org.webosbrew.cccbib -p '{"cmd":"pause"}'`.

From Home Assistant (LG webOS TV integration, not tested from Home Assistant yet):

```yaml
service: webostv.command
data:
  entity_id: media_player.lg_tv
  command: system.launcher/launch
  payload:
    id: org.webosbrew.cccbib
    params:
      cmd: play
      link: https://media.ccc.de/v/24c3-2303-en-inside_the_macosx_kernel
```

To read the state use the TV's web inspector (port 9998). `window.cccbib.report()` in the app page returns `state` (playing or paused or idle) and `now` (title and link and position) plus the `watchlist` and the in progress list with `link` and `position` for each. The page title also shows what is playing: `Playing: <talk title>` or `Paused: <talk title>` or `CCCBib` when no talk is open. With the inspector on `curl -s http://<tv-ip>:9998/json/list` lists it as `title`.

</details>

Zoom and Stretch call a TV service which webOS only allows for apps that were installed the normal way (`yarn deploy` or ares-install or the Homebrew Channel). Copying the files onto the TV by hand skips that registration.

## Subtitles

Old `.srt` (from 30c3) and new `.vtt` files both work. Languages that only exist as dead links or placeholder files are hidden and the subtitle button disappears when nothing usable is left. They load from the same CORS enabled hosts as the media.ccc.de website so no proxy is needed.

## Browser support

The target is Chrome 68 (webOS 5). `yarn build` fails if the output contains syntax newer than ES2019. A startup error screen shows the error if the app fails to boot. `yarn test:chrome68` tests the production build with Chromium snapshot `561732` (Chromium 68.0.3440.0).

## Roadmap

- &#9744; Add Speaker page.
- ~~&#9744; Jeopardy Theme song when waiting for too long.~~
- Playback speed is left out on purpose: webOS mutes the audio at any speed except 1x.

##  Contributions

Either you found a bug, optimisation strategy or want something implemented, go ahead and hack your way into the code, PRs are welcome 🌱.

To add a language, copy `src/shared/i18n/locales/de.ts`. Translate it and register it in `src/shared/i18n/translation.ts` and `UI_LANGUAGES` in `src/shared/config/constants.ts`. `yarn build` fails on missing or unused strings.


## Development

### Structure

The application uses TypeScript and Feature-Sliced Design (FSD).

| Layer | Responsibility |
| --- | --- |
| `src/app` | Startup, screen selection, remote command coordination, global styles, and reports. |
| `src/pages` | Home, search, popular, conferences, conference, watchlist, and settings screens. |
| `src/widgets` | The player, talk preview, and sidebar. |
| `src/features` | Watchlist actions, playback history, and remote commands. |
| `src/entities` | Talks, conferences, data conversion, and requests. |
| `src/shared` | Generic UI, configuration, translations, browser helpers, and webOS adapters. |

Import other slices through their `index.ts` public interface with the `@/` alias. Import files inside the same slice with relative paths. A slice can import only lower layers. The conference entity uses a type-only `@x` interface to refer to talks. Keep coordination between features in `app`.

Steiger checks the FSD rules. Knip checks files, exports, and dependencies in normal and production modes. Its production mode excludes test references. The Knip configuration documents the `core-js` exception because Babel injects those imports. Build tools remain CommonJS.

### Tests and quality checks

```sh
yarn typecheck       # Check application and test types.
yarn lint:fsd        # Check FSD rules.
yarn lint:unused     # Run both Knip modes.
yarn test            # Run unit and React tests.
yarn test:watch      # Run tests when files change.
yarn test:coverage   # Check all four coverage thresholds.

# Install the current Chromium browser and its system dependencies.
yarn playwright install --with-deps chromium
yarn build
yarn test:e2e        # Run Playwright against the production build.
yarn test:chrome68   # Run the Chrome 68 smoke test on Linux.
yarn verify          # Run all checks, the build, and both browser runners.
```

Vitest requires at least 95% for statements, branches, functions, and lines across the application total. Coverage includes every application JavaScript and TypeScript file, including files that no test imports. It excludes tests and declaration files. HTML startup scripts have browser tests. Open `coverage/index.html` to inspect coverage.

Browser tests use local REST, GraphQL, image, subtitle, and video fixtures. They reject unexpected external requests. The WebM fixture contains a generated blue test image. Playwright saves reports in `playwright-report/`. Both runners save failure data in `test-results/`.

The Chrome 68 runner downloads its fixed snapshot into `/tmp/cccbib-chrome68`. Set `CHROME68_CACHE` to use another cache directory. Set `CHROME68_EXECUTABLE_PATH` to use an existing binary. The runner checks that the browser reports version 68. Its Linux font configuration requires DejaVu fonts.

The build, release, and Docker workflows run the same quality workflow before they package or publish the application. CI uploads coverage reports, browser reports, and failure data.

### webOS Simulator on Linux

The `webos-simulator` CI job uses GitHub-hosted `ubuntu-24.04` and webOS TV 26 Simulator 1.5.0 for Linux x64. It runs the production files in `dist/`. It does not require a TV, an LG account, or manual input.

The pinned public LG file ID is `RF00021103`. The setup script resolves its temporary download URL through `https://webostv.developer.lge.com/api/downloadSDK`. It records the resolved URL in `test-results/webos-download.json`. LG's download server is `https://gfts.lge.com/fts/gftsFilePathDownload.lge`. The archive SHA-256 is `8668c06503e82a52303e8c31e90c458c1d7c4d6dc74151ae6fc53df37e368d4e`. This checksum was calculated from the LG archive. The setup script verifies it on downloads and cache hits before extraction. The CI cache key contains the version and checksum.

Install `xvfb`, `xauth`, `unzip`, `libnss3`, `libatk-bridge2.0-0`, `libgtk-3-0`, `libgbm1`, and `libasound2t64` on Ubuntu 24.04. Then run:

```sh
yarn setup:webos
yarn build
xvfb-run -a yarn test:webos

# Use the same 1920×1080 display as CI.
xvfb-run -a -s '-screen 0 1920x1080x24' yarn test:webos
```

The fixture starts the extracted Simulator executable directly with `--ozone-platform=x11` and `--no-sandbox`. It connects the installed Playwright package through `chromium.connectOverCDP()`. It selects the exact `file://` application target. It installs fixture interception before the tested reload. DNS resolution stays disabled, and unexpected external requests fail the test.

Each test gets a separate Simulator storage directory. Restart tests reuse that directory. Navigation uses CDP input, including webOS Back keycode `461`. The reports contain application screenshots, Simulator output, console errors, target details, Chromium versions, launch arguments, HTML, and JUnit. CI retains them for 14 days. The fixture stops the Simulator process group after each test. CI also stops remaining Simulator processes after a failure.

The [compatibility CI run](https://github.com/volkovmqx/cccbib/actions/runs/39418673503) passed before the full suite was added. It reported Chromium `120.0.6099.291`. It verified CDP attachment, application target selection, DOM reads, native navigation input, fixture interception, and screenshot capture. The full suite also checks all pages, search, playback, restart persistence, and request failure. Media fixtures support HTTP byte ranges for seeking.

References: [LG installation instructions](https://webostv.developer.lge.com/develop/tools/simulator-installation), [LG Simulator guide](https://webostv.developer.lge.com/develop/tools/simulator-dev-guide), [Electron CI instructions](https://www.electronjs.org/docs/latest/tutorial/testing-on-headless-ci), and [Playwright CDP documentation](https://playwright.dev/docs/api/class-browsertype#browser-type-connect-over-cdp). Playwright documents reduced support for CDP connections. The compatibility test checks the required operations against the pinned runtime.

Before a webOS release, check the installed package on a real TV. Check remote keys, preview-to-player decoder release, audio languages, subtitles, resume after seeking, and Auto/Zoom/Stretch. Browser tests cannot verify the TV hardware decoder or actual webOS services.

### Local deployment

```sh
yarn install

# Serve development build on http://127.0.0.1:3333
yarn start

# Production build (dumped into dist/)
yarn build

# Build production webOS package
yarn package

# Install webOS package
yarn deploy

# Launch
yarn launch
```

### Docker

#### Build image locally: 
```sh
docker build -t ghcr.io/volkovmqx/cccbib:dev .
```

#### Run the container:
```sh
docker run --rm -p 8080:80 ghcr.io/volkovmqx/cccbib:dev
```

This image is built in CI on pushes to `main` (tagged `latest`) and on version tags like `v1.1.0` (tagged `1.1.0`).


## Credit

The Logo ["Voctocat"](https://blinry.org/voctocat/) is kindly provided by [Blinry](https://github.com/blinry) under the CC BY-SA 4.0 License (as stated on the logo page). The animated loader (`src/shared/branding/voctocat.html`) is a modified version of it, where the raised arm is split off into its own shape so it can wave, and it is shared under the same license.

WebOS Project architecture from ["Informatic"](https://github.com/informatic/streamkatze)



## License

Check LICENSE
