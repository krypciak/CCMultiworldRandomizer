# Client for CrossCode Archipelago Integration

This is still under *heavy* development, though it does work if you're willing to edit some files manually.

# Setup guide

## How to generate your own multiworld with crosscode seeds

Either:
1. Download the [CrossCode development branch](https://github.com/CodeTriangle/Archipelago) and follow the [instructions for running from source](https://github.com/CodeTriangle/Archipelago/blob/crosscode-dev/docs/running%20from%20source.md).
2. Download the APWorld file from the [releases page of the CrossCode development branch](https://github.com/CodeTriangle/Archipelago/releases) and put it into `lib/worlds` in your Archipelago folder downloaded from the [main Archipelago releases page](https://github.com/ArchipelagoMW/Archipelago/releases).

Then put your yamls in the `Players` directory and run the `Generate` program.

## How to host a multiworld with crosscode seeds

You should be able to use the `MultiServer` program from any up-to-date Archipelago installation regardless of whether it has the CrossCode APWorld. If you have issues, use the instructions above to install the CrossCode APWorld and then try again.

## How to join a multiworld with crosscode seeds

Install CCLoader2 [(instructions)](https://wiki.c2dl.info/CCLoader), then download the pinned `.ccmod` and place it into the `assets/mods` directory.

For now, you need to input connection data manually. Create a file `apConnection.json` in the root directory of your CrossCode installation and put the following into it:
```json
{
  "hostname": "archipelago.gg",
  "port": 38281,
  "name": "CrossCodeTri"
}
```

Replace the fields with their correct values for the hosted game.

You will also need the following dependency mods:
* [CC-Open-World](https://github.com/buanjautista/cc-open-world/releases), the one that has no dependencies. This is to prevent softlocks when you inevitably sequence-break the game.

Open CrossCode and start a new save file. I recommend New Game+ with the Skip Beginning option. You will start in the last stretch of the Rookie Dungeon. **The chests in the rookie dungeon are not in logic.**

Until further notice, you need to **save and reload your game** before collecting any chests beyond the Rookie Dungeon due to some latent bugs.

You will know if the mod is working when you get to space for the first time and you don't recieve the Disc of Insight and Green Leaf Shade as expected.

# A note on versions

Every `x.0.0` version and every `0.y.0` version defines a new connection interface between client and server. In other words, You can use any mod with version `0.1.a` to talk to any server with an APWorld of version `0.1.b` server, regardless of what `a` and `b` are, but a client with version `0.2.a` and a server with version `0.1.b` will not be able to talk to each other. Similarly, `1.a.b` can talk to `1.c.d` but `2.a.b` cannot talk to `1.c.d`.

# Checklist

- [x] Send and recieve items
- [x] GUI for sent items
- [x] Offline play support
  - [x] Don't crash upon connection failure
  - [x] Cached local list of checked locations
- [ ] Useable interface
  - [x] Ability to set URL, port, and slot name outside of code
  - [ ] Ability to set URL, port, and slot name in-game
- [x] Support for multiple slots
  - [x] Connect to AP server on load game, disconnect on quit game
  - [x] Cache connection details in save file
- [ ] Settle on a final AP item icon
  - See `assets/icons.png` for options
