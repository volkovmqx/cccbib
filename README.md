<h1><img alt="CCCBib" src=".github/logo.svg" height="34"></h1>

[![CI](https://img.shields.io/github/actions/workflow/status/volkovmqx/cccbib/main.yml?branch=main&label=CI)](https://github.com/volkovmqx/cccbib/actions/workflows/main.yml)
[![Version](https://img.shields.io/github/package-json/v/volkovmqx/cccbib?label=version)](https://github.com/volkovmqx/cccbib/blob/main/package.json)
[![License](https://img.shields.io/github/license/volkovmqx/cccbib)](LICENSE)
[![LG Homebrew](https://img.shields.io/badge/LG%20Homebrew-install-ff69b4)](https://repo.webosbrew.org/apps/org.webosbrew.cccbib/)

[media.ccc.de](https://media.ccc.de) media library application for webOS.

![Home screen](.github/screenshots/screenshot1.png)

![Player screen](.github/screenshots/screenshot2.png)


## Background

This app uses the official media.ccc.de GraphQL endpoint. It uses TypeScript, React, Embla, and an HTML5 video player.

## Features

- Browse conferences with a preview picture of the selected talk, or a short video (with or without sound, switch it in Settings), and search for talks. In a browser, a click on a conference name on the home page opens that conference with all its videos.
- Use the TV remote to navigate and control playback. The Magic Remote pointer selects and its wheel scrolls lists like a page.
- Save talks to the Watchlist and resume the 20 most recent talks in Continue Watching.
- Select audio languages and subtitles when a talk provides them.
- Choose from 9 app languages.
- Choose from 18 themes, accent colors, 24 fonts, 27 loading animations, line, filled or pixel art icons, eight screen filters (Lines, Grille, Trinitron, Pixel Grid, Dots and Tube are still and cost the TV nothing, Pulse sends one light line down the screen every half minute), and the size of the scrollbars.
- Select Auto, Zoom, or Stretch for the video aspect ratio.
- Change the playback speed from 0.5x to 2x with the speed button or the green key, or set the speed a talk starts at in Settings > Playback. The sound keeps playing at every speed on webOS 5.
- Play videos from the CDN mirror that ranks best for your location and stay on it.
- Show technical details of the playback with Stats for Nerds (mirror, resolution, buffer and connection).
- Send commands through webOS launch parameters (see [Remote control](#remote-control)).
- Publish what is playing to MQTT for Home Assistant (see [Home Assistant over MQTT](#home-assistant-over-mqtt)).
- Use it in a browser on a phone: below 900 px the menu becomes a bar at the top (or at the bottom with the Menu Position setting) or, with Menu Layout set to Dock, a floating rounded dock that takes the look of the menu Style (Plain, Panel or Glass), Settings stacks and the text scales with the screen width and your text size setting. On a real phone or tablet the player turns the screen to landscape while a talk plays and gives it back when you leave (browsers that can lock the orientation, not iOS Safari).
- Menu Layout (Settings > Appearance > Side Menu) can make the menu a Dock on any screen size: on the TV a rounded pill floating on the left that opens to show the names when it has the focus.

## Remote control

CCCBib takes its commands as webOS launch parameters so the TV needs no open port. It is off by default and you turn it on once in Settings (Playback and then Remote Control). A command is a JSON object. If the app is not running it starts and runs the command and if it is running it gets the command as a relaunch and nothing restarts. A running app that sits behind another app stays there: only `play` brings it to the front (and an app that is not running always starts in front).

<details>
<summary>Commands</summary>

| Command | Parameters |
| --- | --- |
| `play` (or only `link`) | `link` must be a `media.ccc.de/v/...` link (with https://, http:// or without a scheme), nothing else is accepted (no other host, no bare slug or GUID). Optional: `start` (seconds), `aspect` (auto, zoom, stretch), `subtitle` (language code or none), `language` (audio language code). If that talk is already open it is resumed |
| `pause`, `resume`, `toggle`, `stop` | none, `stop` closes the player |
| `seek` | `to` (seconds) or `by` (seconds, negative goes back) |
| `mute` | `value` true or false, without it the state toggles |
| `aspect` | `value`: auto, zoom or stretch |
| `speed` | `value`: 0.5, 0.75, 1, 1.25, 1.5, 1.75 or 2 |
| `subtitle` | `value`: language code or none |
| `language` | `value`: audio language code |
| `add` | `link`, `links` (list of links) or `items` (list of `{link, position}` or `{link, percent}`). Adds to the watchlist. With a `position` (seconds) or `percent` the talk is also put on the in progress list (Continue Watching) |
| `remove` | `link` or `links`. Removes from the watchlist only, a talk that has progress stays on the in progress list |
| `progress` | `link` with `position` (seconds) or `percent`, or `items` as above. The talk appears on the in progress list, the watchlist is not touched. Under 10 seconds clears the progress, the talk that is playing is moved with a seek |
| `progress-set` | `items` replaces the whole in progress list |
| `progress-clear` | `link` or `links`, removes the progress |

Every link in every command and list is checked the same way and talks that fail the check are skipped. `progress-set` changes nothing if a single link in the list is not valid or cannot be loaded. It gives the items the time of the command, so earlier times of last watching are lost. A command takes up to 50 links and the in progress list never holds more than 20 talks (the most recent ones).

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

From Home Assistant (core LG webOS TV integration):

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

To read the state use the TV's web inspector (port 9998). `window.cccbib.report()` in the app page returns `state` (playing or paused or idle) and `now` (title and link and position), `focused` (title and link of the talk the remote or pointer is on in a list or grid, or null on the menu, in the player or on a talk without a link) plus the `watchlist` and the in progress list with `link` and `position` for each. The page title is `CCCBib - <talk title>` while a talk is open and `CCCBib` otherwise. With the inspector on, `curl -s http://<tv-ip>:9998/json/list` lists it as `title`.

</details>

Zoom and Stretch call a TV service which webOS only allows for apps that were installed the normal way (`yarn deploy` or ares-install or the Homebrew Channel). Copying the files onto the TV by hand skips that registration.

## Integrations

CCCBib offers launch commands and an MQTT status and leaves the integration to you. Tried on a real TV: `luna-send`, any MQTT client, and Home Assistant (the MQTT discovery sensor and, through the core LG webOS TV integration, every command and waking the TV from standby with Wake-on-LAN).

## Home Assistant over MQTT

CCCBib can publish what is playing to your MQTT broker and Home Assistant picks it up through MQTT discovery. It publishes over a WebSocket, so the broker needs a WebSocket listener (Mosquitto: `listener 9001` and `protocol websockets`). Give it the address and the login once with a launch command (Remote Control must be on):

```
luna-send -n 1 luna://com.webos.service.applicationmanager/launch \
  '{"id":"org.webosbrew.cccbib","params":{"cmd":"mqtt","url":"ws://<broker>:9001","username":"<user>","password":"<password>"}}'
```

From Home Assistant send the same params with the `system.launcher/launch` command of `webostv.command`. `username` and `password` are optional, a password needs a username. `{"cmd": "mqtt"}` without a `url` forgets the broker. Only `ws://` and `wss://` addresses are accepted. The login is kept in the app's storage on the TV, so give it a broker user that may only write `cccbib/#` and `homeassistant/sensor/cccbib/config`.

| Topic | Content |
| --- | --- |
| `cccbib/availability` | `online` when connected and `offline` when the app closes (retained, the broker sends it as the last will) |
| `cccbib/state` | JSON, retained: `state` (`playing`, `paused` or `idle`) and for a talk `title`, `link`, `conference`, `speakers` (list), `thumb`, `position` and `duration` in seconds (the position with milliseconds), `rate` (the speed set in the app) and `ts` (when it was sent, in seconds since 1970 with milliseconds). `playing` means the video really runs, a talk that is still jumping to its saved position or that webOS paused in the background says `paused` |
| `homeassistant/sensor/cccbib/config` | Discovery for one sensor, CCCBib, with the state as its value and the rest as attributes |

CCCBib publishes when it connects and whenever a talk starts, pauses, plays on, is sought, changes speed, goes to the background or ends, and it checks every few seconds that `playing` or `paused` is still right. The position is the one at the moment of the change, there is no periodic update. It only publishes while the app runs and it receives nothing, commands still go through the launch parameters. Turning Remote Control off disconnects it.

<details>
<summary>Setting it up, removing it and adding it again</summary>

The app only needs two things from the outside: Remote Control On and the broker address from the `mqtt` launch command. An integration that pairs for you sends that same command, so everything below works with or without one.

**1. Broker.** The user only writes two topic trees. With Mosquitto:

```
# mosquitto.conf
listener 9001
protocol websockets

# acl file
user cccbib
topic write cccbib/#
topic write homeassistant/sensor/cccbib/config
```

Create the user with `mosquitto_passwd`. The Home Assistant Mosquitto add-on already has a WebSocket port (1884 by default, see its [documentation](https://github.com/home-assistant/addons/blob/master/mosquitto/DOCS.md)). Home Assistant itself needs to read `cccbib/#` and `homeassistant/#`, which it does with its own login.

**2. Turn Remote Control on** (Settings, Playback). Without it every command is dropped without a message, including the pairing and the unpairing, the stored login is kept and the app does not connect to the broker at all.

**3. Pair.** Send the `mqtt` command from above. A toast says `MQTT broker saved` or `Invalid MQTT broker address`. The app connects at once and publishes `online`, the discovery message and the state, so Home Assistant shows a device CCCBib with one sensor. To look from the outside: `mosquitto_sub -h <broker> -u <user> -P <password> -t 'cccbib/#' -v`.

**4. Remove.** Removing an integration in Home Assistant may not tell the app (check the documentation of the integration). If it does not, the app stays paired and keeps publishing, so unpair first. Send `{"cmd": "mqtt"}` without a `url`. The app publishes `offline`, disconnects and forgets address and login (a toast says `MQTT broker cleared`). The retained discovery message and the last state stay on the broker, so the sensor remains in Home Assistant as unavailable. If a talk was playing, the retained state still says `playing` and the talk keeps playing on the TV. To remove it completely, delete the retained messages and then the device in Home Assistant:

```
mosquitto_pub -h <broker> -u <admin> -P <password> -r -n -t homeassistant/sensor/cccbib/config
mosquitto_pub -h <broker> -u <admin> -P <password> -r -n -t cccbib/state
mosquitto_pub -h <broker> -u <admin> -P <password> -r -n -t cccbib/availability
```

**5. Add it again.** Send the same pairing command. The app connects, publishes `online`, the discovery message and the current state, and the sensor comes back. A refused login does not retry on its own, so after fixing the user or the rights on the broker send the same command again and it connects. Turning Remote Control off and on, or restarting the app, does the same.

| Symptom | Cause |
| --- | --- |
| Nothing happens after the command | Remote Control is off, or the TV is off (a command to a TV in standby does not arrive) |
| `Invalid MQTT broker address` | The address is not `ws://` or `wss://`, has a login or `#` in it, or a password was sent without a username |
| `MQTT broker saved` but no sensor | The broker has no WebSocket listener on that port, the login is refused, or Home Assistant's MQTT integration is not set up |
| Sensor `unavailable` while the app is open | The connection dropped and the app is trying again (2, 4, 8, up to 60 seconds) |
| Sensor `available` but the app is not connected | The broker user was deleted or changed while the app was connected. Mosquitto drops the client without sending the last will. Fix the user and send the pairing command again |
| Sensor `unavailable` after leaving the app | webOS closed the app, the broker sent the last will. The last talk stays in the attributes. After a crash webOS starts the app again by itself and the sensor is back within about a second |
| State is `paused` right after starting a talk | The talk is still jumping to its saved position |

The address and the login are kept in the app's storage on the TV as plain text and `ws://` is not encrypted, so use a broker user that cannot do more than the two writes above and a password you use nowhere else. `wss://` works if the TV trusts the certificate.

</details>

## Subtitles

Old `.srt` (from 30c3) and new `.vtt` files both work. Languages that only exist as dead links or placeholder files are hidden and the subtitle button disappears when nothing usable is left. They load from the same CORS enabled hosts as the media.ccc.de website so no proxy is needed.

## Browser support

The target is Chrome 68 (webOS 5). The production build uses ES2019 syntax or older syntax. A startup error screen shows the error if the app fails to start. CI tests the production build in current Chromium, Chrome 68, and LG’s Simulator. See the [testing guide](CONTRIBUTING.md#tests-and-quality-checks).

## Roadmap

- &#9744; Add Speaker page.
- ~~&#9744; Jeopardy Theme song when waiting for too long.~~
- Playback speed on webOS goes through the TV's media service (`com.webos.media/setPlayRate`), because the web view mutes the sound at any other `playbackRate`.

## Contributing

Contributions are welcome. You can report bugs, add translations, improve documentation, write tests, or submit code changes.

The application now uses strict TypeScript (`.ts` and `.tsx`) and Feature-Sliced Design (FSD). The [contribution guide](CONTRIBUTING.md) explains FSD, development setup, testing, the coverage requirements, the coverage bot, and deployment.

## Contributors

[![Contributors to CCCBib](https://contrib.rocks/image?repo=volkovmqx/cccbib)](https://github.com/volkovmqx/cccbib/graphs/contributors)

## Credit

The Logo ["Voctocat"](https://blinry.org/voctocat/) is kindly provided by [Blinry](https://github.com/blinry) under the CC BY-SA 4.0 License (as stated on the logo page). The animated loader (`src/shared/branding/voctocat.html`) is a modified version of it, where the raised arm is split off into its own shape so it can wave, and it is shared under the same license.

The animation ["Fairy Dust"](https://media.metaebene.me/media/fairydust/index.html) is based on the Fairy Dust logo of the Chaos events, developed in 1999 by Tim Pritlove and Marten Suhr and released under the [CC BY 4.0 License](https://creativecommons.org/licenses/by/4.0/).

The Pixelated icon variant uses icons from [pixelarticons](https://github.com/halfmage/pixelarticons) ([website](https://pixelarticons.com/)) by Gerrit Halfmann under the [MIT License](https://github.com/halfmage/pixelarticons/blob/v2.4.2/LICENSE) (a copy is in `src/shared/branding/pixelarticons-LICENSE.txt`). The icons in use are [search](https://github.com/halfmage/pixelarticons/blob/v2.4.2/svg/search.svg), [home](https://github.com/halfmage/pixelarticons/blob/v2.4.2/svg/home.svg), [trending up](https://github.com/halfmage/pixelarticons/blob/v2.4.2/svg/trending-up.svg), [grid](https://github.com/halfmage/pixelarticons/blob/v2.4.2/svg/grid-2x2-2.svg), [bookmark](https://github.com/halfmage/pixelarticons/blob/v2.4.2/svg/bookmark.svg), [settings](https://github.com/halfmage/pixelarticons/blob/v2.4.2/svg/settings-cog.svg), [palette](https://github.com/halfmage/pixelarticons/blob/v2.4.2/svg/colors-swatch.svg), [text size](https://github.com/halfmage/pixelarticons/blob/v2.4.2/svg/a-arrow-up.svg), [play](https://github.com/halfmage/pixelarticons/blob/v2.4.2/svg/play.svg), [pause](https://github.com/halfmage/pixelarticons/blob/v2.4.2/svg/pause.svg), [captions](https://github.com/halfmage/pixelarticons/blob/v2.4.2/svg/badge-captions.svg), [info](https://github.com/halfmage/pixelarticons/blob/v2.4.2/svg/circle-info.svg), [globe](https://github.com/halfmage/pixelarticons/blob/v2.4.2/svg/globe.svg), [aspect ratio](https://github.com/halfmage/pixelarticons/blob/v2.4.2/svg/aspect-ratio.svg), [speed](https://github.com/halfmage/pixelarticons/blob/v2.4.2/svg/speed-fast.svg), [volume](https://github.com/halfmage/pixelarticons/blob/v2.4.2/svg/volume-2.svg), [mute](https://github.com/halfmage/pixelarticons/blob/v2.4.2/svg/volume-x.svg), [bug](https://github.com/halfmage/pixelarticons/blob/v2.4.2/svg/bug.svg), [arrow left](https://github.com/halfmage/pixelarticons/blob/v2.4.2/svg/arrow-left.svg), [check](https://github.com/halfmage/pixelarticons/blob/v2.4.2/svg/check.svg), [chevron down](https://github.com/halfmage/pixelarticons/blob/v2.4.2/svg/chevron-down.svg), [eye](https://github.com/halfmage/pixelarticons/blob/v2.4.2/svg/eye.svg), [clock](https://github.com/halfmage/pixelarticons/blob/v2.4.2/svg/clock.svg), [user](https://github.com/halfmage/pixelarticons/blob/v2.4.2/svg/user.svg). The skip, wifi off and heart off icons are drawn on the same grid from the shapes of [play](https://github.com/halfmage/pixelarticons/blob/v2.4.2/svg/play.svg), [wifi](https://github.com/halfmage/pixelarticons/blob/v2.4.2/svg/wifi.svg), [heart](https://github.com/halfmage/pixelarticons/blob/v2.4.2/svg/heart.svg).

The TV navigation follows [Norigin Media's guide](https://noriginmedia.com/2019/06/24/smart-tv-navigation-with-react/) and [Utkarsh Gupta's guide](https://medium.com/@utkarsh.gupta.316/spatial-navigation-in-react-js-for-smart-tv-3aa6977a94b1). The remote button mapping uses the LG input keymapping overview by [Simon34545](https://github.com/Simon34545).

WebOS Project architecture from ["Informatic"](https://github.com/informatic/streamkatze)

The themes and the look of the app are inspired by [Litefin](https://github.com/MoazSalem/litefin) by [MoazSalem](https://github.com/MoazSalem).



## License

See [LICENSE](LICENSE).
