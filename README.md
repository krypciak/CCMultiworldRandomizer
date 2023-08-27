# Client for CrossCode Archipelago Integration

This is still under *heavy* development, though it does work if you're willing to edit some files manually.

# Setup guide

## How to generate your own multiworld with crosscode seeds

Either:
1. Download the [CrossCode development branch](https://github.com/CodeTriangle/Archipelago) and follow the [instructions for running from source](https://github.com/CodeTriangle/Archipelago/blob/crosscode-dev/docs/running%20from%20source.md).
2. Download the APWorld file from the [releases page of the CrossCode development branch](https://github.com/CodeTriangle/Archipelago/releases/latest) and put it into `lib/worlds` in your Archipelago folder. **This integration requires at least 0.4.2 RC to roll the seed**.

Then put your yamls in the `Players` directory and run the `Generate` program. If you need a yaml to build off of, this should work:
```yaml
CrossCode:
  start_inventory:
    Green Leaf Shade: 1 # Remove this if you don't want to be able to access Autumn's Rise immediately.
description: Example yaml from https://github.com/CodeTriangle/Archipelago
game: CrossCode
name: CrossCodeTri
```

## How to host a multiworld with crosscode seeds

You should be able to use the `MultiServer` program from any up-to-date Archipelago installation regardless of whether it has the CrossCode APWorld. If you have issues, use the instructions above to install the CrossCode APWorld and then try again.

## How to join a multiworld with crosscode seeds

Install [CCLoader2](https://wiki.c2dl.info/CCLoader), then download the *most recent* [CCMultiworldRandomizer release](https://github.com/CodeTriangle/CCMultiworldRandomizer/releases/latest) and place it into the `assets/mods` directory.

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

## Optional poptracker package

Courtesy of Lurch9229, you can have a fancier interface for tracking your progress. [See here for information](https://github.com/lurch9229/CrossCode-Poptracker-AP).

## How to get support

First off, thank you for beta testing! I truly appreciate it.

Second off, please make sure you are using the most recent version of both the mod and the APWorld. I will not provide support for outdated versions of either.

With that out of the way, here's what to do:
1. Join the [Archipelago discord server](https://discord.gg/8Z65BR2).
2. Follow the CrossCode thread in the `#future-game-design` forum.
3. Post the following details about your issue:
  * What you did leading up to the issue.
  * The *expected* behavior.
  * The *actual* behavior (in enough detail that I could feasibly reproduce it).

I'm pretty active on Discord, so I should see your message within a few hours. For bugs that have a quick fix, I have generally been able to address them within a week. For more sophisticated bugs or for bugs that I suspect are hidden in code that will be rewritten later, I'll modify this page to include a workaround until such time as I can actually fix it.

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
