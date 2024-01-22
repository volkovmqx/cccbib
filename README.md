# CCCBib

[media.ccc.de](https://media.ccc.de) media library application for webOS.

![Main Screen](https://github.com/volkovmqx/cccbib/blob/main/.github/screenshots/screenshot1.png?raw=true)

![Player Screen](https://github.com/volkovmqx/cccbib/blob/main/.github/screenshots/screenshot2.png?raw=true)


## Background

This app uses the official media.ccc.de/graphql endpoint. It is built using React, Swiper, Mantine, React TV Player and ❤️ from Leipzig.

## Features

- Support for conferences lazy loading.
- Support for language change.

## Roadmap

- &#9744; Switch to Swiper virtual slides to optimise the DOM
- &#9744; Add Search functionnality

##  Contributions

Either you found a bug, optimisation strategy or want something implemented, go ahead and hack your way into the code, PRs are welcome.


## Development

```sh
yarm install

# Serve development build on http://127.0.0.1:3000
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

## Credit

The Logo ["Voctocat"](https://morr.cc/voctocat/) is kindly provided by [Blinry](https://github.com/blinry) under CC BY-NC-SA 4.0 License.

WebOS Project architecture from ["Informatic"](https://github.com/informatic/streamkatze)

## License

Check LICENSE