# How slot loading in CrossCode works

(somewhat simplified)

* initiated in one of these ways:
  * to load an existing slot, `ig.storage.loadSlot(number)` is called:
    - copies data from slot `number` into `ig.storage.currentLoadFile` and `ig.storage.checkPointSave`
    - calls `ig.game.teleport(map)` where `map` is the most recently played map from save `number`
  * to begin a new game, `ig.start(startMode)` is called:
    - game enters `NEWGAME` substate
    - game enters `GAME` state

* when game is in `NEWGAME` substate, `ig.game.teleport(starting_map)` is called by `ig.game.transitionEnded`.

* when `ig.game.teleport(map, marker, ...)` is called:
  - saves `map` to `ig.mapName`
  - saves `marker` to `ig.marker` and `ig.game.teleporting.position`
  - saves other parameters to `ig.game.teleporting`
  - calls `ig.game.preloadLevel(map)`

* when `ig.game.preloadLevel(mapName)` is called:
  - asynchronously loads the file in `/assets/data/maps/$mapName`
  - on completion, saves the loaded JSON to `ig.game.teleporting.levelData`

* every frame, `ig.game.update(...)` is called
  - checks if a teleport is in progress
  - checks if `ig.game.teleporting.levelData` is populated
    * if so, calls `ig.game.loadLevel(levelData)` and clears `levelData`

* when `ig.loadLevel(levelData)` is called:
  - resets map variables
  - calls `onLevelLoadStart(levelData)` on all game addons
  - creates terrain
  - spawns map entities
  - creates the player entity
  - sets `ig.ready` to true

* when `ig.storage.onLevelLoadStart(levelData)` is called:
  - if `ig.storage.currentLoadFile` is set:
    * populates ig.vars with vars saved in `ig.storage.currentLoadFile`
    * calls `onStoragePreLoad` on all Storage listeners

# How this is modified in CCMWR

Archipelago slot data is required during two parts of the process:

1. before `ig.game.preloadLevel` (so that patches can be applied by cc-open-world)
2. before map entities are spawned (so that the resources are available as args for usage in map events)

To address these concerns:

1. the model `sc.multiworld` broadcasts a message of type `sc.MULTIWORLD_MSG.OPTIONS_PRESENT` upon connection
   * this occurs while still on the title screen, and therefore happens *long* before `preloadLevel` is called
2. `sc.multiworld` is set up as a Storage listener
   * upon indication that the save file is loading, `ig.vars` will be populated with the information:
     - `mw.options`, containing most YAML options
     - `mw.mode`, containing the logic mode, `"open"`, or `"linear"`
