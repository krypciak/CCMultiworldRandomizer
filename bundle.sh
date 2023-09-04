#!/bin/bash

version="$(jq -r <ccmod.json .version)";
filename="CCMultiworldRandomizer-$version.ccmod";

zip -r "$filename" assets ccmod.json data plugin.js
