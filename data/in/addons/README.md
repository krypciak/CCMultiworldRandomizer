# Addon Data Format

This document describes the data format used for addons. This language is essentially a JSON patch file geared specifically toward modifying the world description JSON files.

## Merge Mode

When the parser starts, it is in merge mode. It will go key-by-key through each object and array and *combine* the keys and values of the original with the keys and values of the addon.

Given the following world file:

```js
{
    "foo": {
        "thing": 5,
        "numbers": {
            "one": 1,
            "two": 2,
            "three": 3
        },
        "letters": [
            "a",
            "b",
            "c",
            "d"
        ]
    }
}
```

and the following addon:

```js
{
    "foo": {
        "numbers": {
            "four": 4
        }
        "letters": [
            "e",
            "f",
            "g"
        ],
        "extra": "secret"
    },
    "bar": {
        "thing": 6,
        "extra": "special"
    }
}
```

the parser will combine them together to create:

```js
{
    "foo": {
        "thing": 5,
        "numbers": {
            "one": 1,
            "two": 2,
            "three": 3,
            "four": 4,
        },
        "letters": [
            "a",
            "b",
            "c",
            "d",
            "e",
            "f",
            "g"
        ]
        "extra": "special"
    },
    "bar": {
        "thing": 6,
        "extra": "special"
    }
}
```

This allows you to structure an addon that simply adds some number of checks as if it were a normal world file.

Note that merge mode will fail to parse two incompatible types, and it will not override bottom-level values.

Given the following world file:

```js
{
    "foo": {
        "thing": 5,
        "numbers": {
            "one": 1,
            "two": 2,
        },
        "letters": [
            "a",
            "b"
        ]
    }
}
```

the following addon is malformed and will cause the parser to exit:

```js
{
    "foo": {
        "thing": 7, // Will not replace values
        "numbers": [
            3,
            4
        ], // Will not merge dissimilar types
        "letters": "ab" // Will not merge dissimilar types
    }
}
```

There are a lot of situations where merge mode will not be sufficient. For these cases, we'll have to use diff mode.

## Diff Mode

Diff mode can be entered by using a special key. Essentially, it will be the old key, followed by the sequence `~DIFF` (in all captial letters). The value for this key will be an array of changes to make to the object, specified in the following format:

```js
{
    "foo": {
        "numbers~DIFF": [
            {
                "action: "[FUNCTION]",
                // other keys required by function
            },
            {
                "action: "[FUNCTION]",
                // other keys required by function
            }
        ],
        "letters": [
            "e",
            "f"
        ]
    }
}
```

See below for available functions.

### Diff Mode Alternate Syntax

This can be quite verbose, so there is some alternate syntax for diff mode, described at the end of the document.

If there is only one element in the list, the list can be replaced with just the one object. Thus, the following two diff directives perform the same operation:

```js
{
    "foo": {
        "numbers~DIFF": [
            {
                "action": "REPLACE",
                "content": {
                    "one": 2,
                    "two": 3,
                    "three": 4
                }
            }
        ]
    }
}
```

```js
{
    "foo": {
        "numbers~DIFF": {
            "action": "REPLACE",
            "content": {
                "one": 2,
                "two": 3,
                "three": 4
            }
        }
    }
}
```

Furthermore, if the function only takes one argument called `content`, then replacing `DIFF` in the key with the directive name will assume the value of the key to be the `content` tag. Thus, the following does the same task as the two above:

```js
{
    "foo": {
        "numbers~REPLACE": {
            "one": 2,
            "two": 3,
            "three": 4
        }
    }
}
```

## Diff Mode Functions

Available functions include:

### REPLACE
