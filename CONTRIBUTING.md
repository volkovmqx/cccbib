# Contributing to CCCBib

Contributions are welcome. You can report bugs, improve documentation, add translations, write tests, or submit code changes.

For a bug report, include the app version, webOS version, steps to reproduce the problem, and the expected result. Include logs or screenshots when they help. For a large feature, open an issue before you start.

## Set up development

Use the Node.js version in [.nvmrc](.nvmrc) and Yarn Classic 1.22.22.

```sh
nvm install
nvm use
yarn install --frozen-lockfile
yarn start
```

The development server uses `http://127.0.0.1:3333`. Run `yarn build` to create the production files in `dist/`.

## TypeScript

Write application logic in `.ts` files. Write React components in `.tsx` files. Keep unit tests beside the source as `*.test.ts` or `*.test.tsx`. Browser tests use `.ts`. Test runner configurations use `.mts`.

[tsconfig.json](tsconfig.json) enables strict type checking and checks unused local variables and parameters. Use explicit types at API and storage boundaries. Avoid `any` and type assertions that hide invalid data. Run `yarn typecheck` before you submit a change.

Babel compiles TypeScript during the Webpack build. It does not check types. CI runs the separate TypeScript check. Existing build tools and shared browser fixtures use CommonJS `.js` or `.cjs` files.

The browser target is Chrome 68 on webOS 5. The build checks that the output uses ES2019 syntax or older syntax. Check browser support before you use a new browser API. The production browser tests also check startup errors.

## Feature-Sliced Design (FSD)

[Feature-Sliced Design](https://feature-sliced.design/docs/get-started/overview) is a method for organizing frontend code. It groups related code by its responsibility in the application. Import rules control dependencies between these groups.

A **layer** describes a level of responsibility. A **slice** groups code for one application concept, such as a talk or a watchlist. A **segment** groups code by its technical purpose, such as `ui`, `model`, `api`, or `lib`.

This repository uses these layers, from highest to lowest:

| Layer | Responsibility |
| --- | --- |
| `src/app` | Startup, routing, feature coordination, global styles, and reports. |
| `src/pages` | Home, Search, Popular, Events, conference details, Watchlist, and Settings. |
| `src/widgets` | The player, talk preview, and sidebar. |
| `src/features` | Watchlist actions, playback history, and remote commands. |
| `src/entities` | Talks, conferences, data conversion, and requests. |
| `src/shared` | Generic UI, configuration, translations, browser helpers, and webOS adapters. |

For example, `src/features/watchlist` is a slice. Its `model` segment contains storage and React hooks. Its `index.ts` file defines its public interface. The `app` and `shared` layers contain segments directly. They do not contain slices.

Follow these import rules:

- Import another slice only from a lower layer. Do not import another slice on the same layer.
- Import through the public `index.ts` interface. Use the `@/` alias, such as `import { useWatchlist } from '@/features/watchlist'`.
- Use relative imports inside the same slice.
- Keep coordination between features in `app`.
- Keep the existing type-only entity reference in `src/entities/talk/@x/conference.ts` explicit. Do not use it to bypass other import rules.

Run `yarn lint:fsd` to check the structure with Steiger. Run `yarn lint:unused` to check files, exports, and dependencies with Knip. Knip runs in normal and production modes. Production mode also finds exports that only tests use. The Knip configuration documents the `core-js` exception because Babel adds those imports.

## Tests and quality checks

| Command | Purpose |
| --- | --- |
| `yarn typecheck` | Check application, test, and configuration types. |
| `yarn lint:fsd` | Check FSD import and structure rules. |
| `yarn lint:unused` | Run both Knip modes. |
| `yarn test` | Run Vitest unit and React tests. |
| `yarn test:watch` | Run unit tests when files change. |
| `yarn test:coverage` | Run unit tests and enforce all four coverage limits. |
| `yarn build` | Check translations, build production files, and check output syntax. |
| `yarn test:e2e` | Test the production build with Playwright and current Chromium. |
| `yarn test:chrome68` | Test the production build with Chrome 68 on Linux. |
| `yarn verify` | Run all checks above, including both browser test runners. |
| `yarn setup:webos` | Download and verify the pinned LG Simulator. |
| `yarn test:webos` | Test the production build in the LG Simulator. |

Install the browser and Linux dependencies before the first browser test:

```sh
yarn playwright install --with-deps chromium
yarn build
yarn test:e2e
yarn test:chrome68
```

`yarn verify` does not run the LG Simulator. Run the [Simulator tests](#webos-simulator-on-linux) separately when you change navigation, playback, or persistence.

### Coverage and the coverage bot

[vitest.config.mts](vitest.config.mts) requires **at least 95% for each metric**: statements, branches, functions, and lines. These limits apply to the application total. A result below any limit makes `yarn test:coverage` and the required `quality / quality` CI job fail. Packaging, release, and Docker publication depend on the quality workflow.

Coverage includes application source files even when no test imports them. It excludes test files and TypeScript declaration files. Browser tests check the HTML startup scripts. Do not lower the limits or exclude application code to make a change pass. Add tests for the missing behavior.

The pinned `davelosert/vitest-coverage-report-action` posts an Application coverage comment on pull requests from this repository. It updates the same comment on later runs. It shows the four totals, the 95% targets, and coverage for changed files. It also writes a GitHub Actions job summary. Fork and Dependabot pull requests receive the summary because their tokens cannot write comments.

The reporting job reads the coverage artifact. It does not install dependencies or execute application code. The test job keeps read-only permissions. Vitest produces reports even when tests fail. The reporting job also runs after a failed quality job. The test exit status enforces the limits; the bot displays the results.

Open `coverage/index.html` for the local HTML report. CI uploads HTML, LCOV, and JSON coverage reports in the `quality-reports` artifact. Reports remain available for 14 days.

### Test conventions

Use Vitest and React Testing Library for logic, hooks, and components. Test visible behavior and important failure paths. Add a regression test when you fix a bug.

Production browser tests use local REST, GraphQL, image, subtitle, and video fixtures from `tests/browser/fixtures.cjs` and `tests/browser/fixture.webm`. The WebM fixture contains a generated blue image. Install request interception before navigation. Unexpected external requests must fail the test.

Playwright writes HTML reports to `playwright-report/`. Browser runners write failure data to `test-results/`. The Chrome 68 runner downloads Chromium snapshot `561732` into `/tmp/cccbib-chrome68` and checks that it reports version 68. Set `CHROME68_CACHE` for another cache directory or `CHROME68_EXECUTABLE_PATH` for an existing binary. Linux needs DejaVu fonts.

## webOS Simulator on Linux

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

## Translations

Copy `src/shared/i18n/locales/de.ts` to a new `.ts` file. Translate its values. Keep the source keys and `{placeholders}` unchanged. Register the language in `src/shared/i18n/translation.ts` and `UI_LANGUAGES` in `src/shared/config/constants.ts`.

Run `yarn build`. The translation check rejects missing or unused strings, empty values, and changed placeholders.

## Package and deploy to a TV

Build before you package the app:

```sh
yarn build
yarn package
yarn deploy
yarn launch
```

`yarn package` creates the `.ipk` file. Configure the webOS CLI and a TV before you use `yarn deploy` or `yarn launch`.

## Docker development

```sh
docker build -t ghcr.io/volkovmqx/cccbib:dev .
docker run --rm -p 8080:80 ghcr.io/volkovmqx/cccbib:dev
```

Open `http://127.0.0.1:8080`. CI publishes `latest` after a push to `main`. A version tag such as `v1.1.0` produces the image tag `1.1.0`. Publication requires the quality workflow to pass.

## Submit a pull request

1. Create a branch in your fork or this repository.
2. Make a focused change. Update tests and documentation for the changed behavior.
3. Run `yarn verify`. Run the Simulator tests when the change affects them.
4. Open a pull request against `main`. Explain the problem, the result, and the checks you ran. Add screenshots for visible UI changes.

The required checks are `quality / quality` and `quality / webos-simulator`. Both must pass before a merge, including an administrator merge.
