Hello, developers!

Thank you for your interest in contributing to this project. There are a few things you'll want to know about setting
up the development environment.

## Archipelago.js

Archipelago.js is the JavaScript library that provides the websocket connection to the Archipelago server. As of August
2024, CCMultiworldRandomizer depends on
[a custom fork of Archipelago.js](https://github.com/CodeTriangle/archipelago.js/tree/crosscode)
tailored for use in CrossCode.

To ensure correct versioning, it is included in this repository at `extern/apjs` via git submodule. Upon cloning this
repository, run the following to download submodules:

```bash
git submodule update --init --recursive
```

If you ever make changes to `extern/apjs`, make sure run `npm install` in the root of the CCMultiworldRandomizer
repository to ensure that your changes are added.

The fork is necessary because:
* The upstream depends on `isomorphic-ws`, a package which in theory provides the same websocket interface for node.js
  and browser installations, but breaks CrossCode due to the nw.js environment, which combines aspects of the browser
  and the web. Previously, the project depended on a packed tarball custom-made for CrossCode by the maintainer of
  Archipelago.js, which caused a significant amount of friction for people checking out the code for the first time.
* The upstream is not used in many other APWorlds and is therefore somewhat untested for this purpose. The fork will
  contain these fixes before they are merged into main.
