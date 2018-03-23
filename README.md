# pattycake [![npm version](https://img.shields.io/npm/v/pattycake.svg)](https://npm.im/pattycake) [![license](https://img.shields.io/npm/l/pattycake.svg)](https://npm.im/pattycake) [![Travis](https://img.shields.io/travis/zkat/pattycake.svg)](https://travis-ci.org/zkat/pattycake) [![AppVeyor](https://ci.appveyor.com/api/projects/status/github/zkat/pattycake?svg=true)](https://ci.appveyor.com/project/zkat/pattycake) [![Coverage Status](https://coveralls.io/repos/github/zkat/pattycake/badge.svg?branch=latest)](https://coveralls.io/github/zkat/pattycake?branch=latest)

[`pattycake`](https://github.com/zkat/pattycake) is a little playground being used to prototype concepts surrounding the [TC39 pattern matching proposal](https://github.com/tc39/proposal-pattern-matching). It's not a spec, it's not a standard, and it doesn't represent the actual look and feel of the JS feature. But it'll help figure out what that could actually be!

## Install

`$ npm install pattycake`

## Table of Contents

* [Example](#example)
* [Features](#features)
* [Bikesheds](#bikesheds)
* [API](#api)

### Example

```javascript
```

### Features

### Bikesheds

These are things that have different tradeoffs that are worth choosing between.
None of these options are strictly or clearly better than the other (imo), so
they're worth discussing and making executive choices about.

#### <a href="undefined-match"></a> > `undefined` matching

While `null` is an actual primitive literal, `undefined` is an immutable
property of the global object. This means that `undefined` can be a regular
variable, and can thus potentially be assigned by match expressions. There are
thus two choices here that we could take as far as how `match` treats
`undefined` matches:

The "consistent" solution would be to keep variable semantics for `undefined`
and treat it like a regular variable. This means that using `undefined` in the
LHS of a match clause would bind _any value_ to that variable and make it
available for that leg:

```
match (1) {
  undefined => 'always matches'
  1 => 'unreachable code'
}
```

The alternative is to have a bit of a special case for `undefined` so it's
always treated as a `===` comparison, the same way other atomic literals work:

```
match (1) {
  undefined => 'nope'
  1 => 'matches === 1'
}
```

Another argument in favor of the special case is so, instead of [making `match`
automatically pun on `null` equality](null-punning), we can use `|` to do the equivalent of a
`foo == null`:

```
var x
match (x) {
  null | undefined => 'yay'
}
```

#### <a href="null-punning"></a> > Automatic equality-punning for `null`

By default, non-Object, non-Array, non-RegExp literals are [matched using
`===`](triple-or-double-match). Assuming that remains the case, there's a
question of whether supporting what's often considered "the reasonable use for `==`"
is worth the cost of inconsistency here. That is, we might want `null` in the
LHS of a match clause to cause a `==` check, instead of a `===` check, which
would make `undefined` match, as well:

```
match (undefined) {
  null => 'this matches'
}
```

On the other hand, this would make it confusing for people expecting a `===`
match for this sort of literal. The main alternative would be to use a guard:

```
match (undefined) {
  x if (x == null) => 'this matches'
}
```

Or, alternatively, using `|` if [`undefined` is
special-cased](#undefined-matching).

### API
