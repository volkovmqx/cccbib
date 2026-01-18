# CCCBib

[media.ccc.de](https://media.ccc.de) media library application for webOS.

![Main Screen](https://github.com/volkovmqx/cccbib/blob/main/.github/screenshots/screenshot1.png?raw=true)

![Player Screen](https://github.com/volkovmqx/cccbib/blob/main/.github/screenshots/screenshot2.png?raw=true)


## Background

This app uses the official media.ccc.de/graphql endpoint. It is built using React, Embla, Mantine, React TV Player and ❤️ from Leipzig.

## Features

- Support for conferences lazy loading.
- Preview of the events on scroll.
- Support for language change.
- Smart TV Navigation with React! (Thanks to [this](https://noriginmedia.com/2019/06/24/smart-tv-navigation-with-react/) and [this](https://medium.com/@utkarsh.gupta.316/spatial-navigation-in-react-js-for-smart-tv-3aa6977a94b1).)
- Search functionnality.
- Watchlist.
- Quality of Life Remote Controller Button Mapping (Thanks to [Simon34545](https://github.com/Simon34545) LG Input Keymapping overview!) inspired by Youtube/Jellyfin.
- Configuration page for preferred languages and subtitles.
- Substitles functionnality.
- About Info page (in Settings on the bottom).

## Roadmap

- &#9744; Add Speaker page.
- &#9744; Trigger for remote control/Home Assistant integration (Watching now/Edit Watchlist).
- ~~&#9744; Jeopardy Theme song when waiting for too long.~~

##  Contributions

Either you found a bug, optimisation strategy or want something implemented, go ahead and hack your way into the code, PRs are welcome 🌱.


## Development

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

This image is built in CI on pushes to `main` (tagged `latest`) and on version tags like `v1.0.2` (tagged `1.0.2`).


## Credit

The Logo ["Voctocat"](https://morr.cc/voctocat/) is kindly provided by [Blinry](https://github.com/blinry) under CC BY-NC-SA 4.0 License.

WebOS Project architecture from ["Informatic"](https://github.com/informatic/streamkatze)



## License

Check LICENSE