#!/bin/bash

version="$(jq -r <ccmod.json .version)";
filename="CCMultiworldRandomizer-$version.ccmod";

[ -f "$filename" ] && rm "$filename"
zip -r "$filename" assets ccmod.json data/data.json plugin.js
