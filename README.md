# pattycake [![npm version](https://img.shields.io/npm/v/pattycake.svg)](https://npm.im/pattycake) [![license](https://img.shields.io/npm/l/pattycake.svg)](https://npm.im/pattycake) [![Travis](https://img.shields.io/travis/zkat/pattycake.svg)](https://travis-ci.org/zkat/pattycake) [![AppVeyor](https://ci.appveyor.com/api/projects/status/github/zkat/pattycake?svg=true)](https://ci.appveyor.com/project/zkat/pattycake) [![Coverage Status](https://coveralls.io/repos/github/zkat/pattycake/badge.svg?branch=latest)](https://coveralls.io/github/zkat/pattycake?branch=latest)

[`pattycake`](https://github.com/zkat/pattycake) is a little playground being
used to prototype concepts surrounding the [TC39 pattern matching
proposal](https://github.com/tc39/proposal-pattern-matching). It's not a spec,
it's not a standard, and it doesn't represent the actual look and feel of the JS
feature. But it'll help figure out what that could actually be!

## Install

`$ npm install pattycake`

## Table of Contents

* [Example](#example)
* [API](#api)

### Example

```javascript
const val = match (await fetch(jsonService)) {
  {status: 200, {headers: {'Content-Length': s}}} => `Response size is ${s}`,
  {status: 404} => 'JSON not found',
  res@{status} if (status >= 400) => throw new RequestError(res)
}
```

### API

This documentation described the sugared version of the `match` expression. The
API exported by `pattycake` is similar, but uses functions and different syntax
for the same underlying concepts.

To convert a sugary `match` to a `pattycake` match:
1. Replace the main `{}` pair with `()`
2. Separate match clauses and bodies into matcher expressions and a fat arrow function, using the parameter list for the fat arrow for destructuring.
3. Replace any variable clauses in the match side with `match.$`.
4. If using guards, convert the guard to a function and pass it as the last argument to `match.$`. If you weren't already using `match.$` for a certain clause (because it wasn't necessary), wrap that clause with `match.$` and pass the guard function as the second argument.
5. If using `...rest`s with array or object matchers, replace the `...rest` with `$.rest` and destructure the array in the fat arrow body.

##### Example

```js
match (x) {
  {a: 1, b} => ...,
  [1, 2, ...etc] => ...,
  1 => ...,
  'string' => ...,
  true => ...,
  null => ...,
  /regexhere/ => ...
}

// Converts to...
const $ = match.$
match (x) (
  {a: 1, b: $}, ({b}) => ...,
  [1, 2, $.rest], ([a, b, ...etc]) => ...,
  1, () => ...,
  'string', () => ...,
  true, () => ...,
  null, () => ...,
  /regexhere/, () => ...
)
```
