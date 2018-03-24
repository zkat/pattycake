'use strict'

const test = require('tap').test

const match = require('../index.js')
const $ = match.$

test('object matcher', t => {
  // Sugared:
  // match ({x: 1}) {
  //   Object {x} => x
  // }
  t.equal(match ({x: 1}) ( // eslint-disable-line
    $(Object, {}), ({x}) => x
  ), 1, 'object matcher matched and destructuring worked')
  t.throws(
    () => match ('foo') ( // eslint-disable-line
      $(Object, {}), () => 'no win'
    ),
    /badmatch/,
    'no matching clauses for string literal'
  )

  // Sugared:
  // match (new Foo(1)) {
  //   Foo {x} => x
  //   Object {} => 'matched Object, not Foo'
  // }
  class Foo { constructor (x) { this.x = x } }
  t.equal(
    match (new Foo(1)) ( // eslint-disable-line
      $(Foo, {}), ({x}) => x,
      $(Object, {}), () => 'matched Object, not Foo'
    ),
    1, 'Custom class matched by instanceof'
  )

  // Sugared:
  // match (new Foo(1)) {
  //   Object {} => 'matched Object, not Foo'
  //   Foo {x} => x
  // }
  t.equal(match (new Foo(1)) ( // eslint-disable-line
    $(Object, {}), () => 'matched Object, not Foo',
    $(Foo, {}), ({x}) => x
  ), 'matched Object, not Foo', 'clause matching done in top-down order')

  // Sugared:
  // match ({x: 1}) {
  //   Foo {x} => x
  //   Object {} => 'obj'
  // }
  t.equal(match ({x: 1}) ( // eslint-disable-line
    $(Foo, {}), ({x}) => x,
    $(Object, {}), () => 'obj'
  ), 'obj', 'matched Object, not Foo')

  // Sugared:
  // match ({x: 1}) {
  //   {x} => 'x is 1'
  // }
  t.equal(match ({x: 1}) ( // eslint-disable-line
    {x: $}, ({x}) => x
  ), 1, 'plain object is an alias for $(Object, {...})')

  class None {}
  class Just { constructor (val) { this.val = val } }
  Just[Symbol.patternMatch] = function (val) {
    if (val instanceof Just) { return {[Symbol.patternValue]: val.val} }
  }
  // Sugared:
  // match (new Just(1)) {
  //   Just x => x === 1 && 'ok',
  //   None {} => 'nope'
  // }
  t.equal(match (new Just(1)) ( // eslint-disable-line
    $(Just, $), x => x === 1 && 'ok',
    $(None, {}), () => 'nope'
  ), 'ok', 'extractor and toplevel $ matcher work')

  t.done()
})

test('Guards! Guards!', t => {
  // Sugared:
  // match (1) {
  //   x if (x === 2) => 'nope'
  //   x if (x === 1) => 'ok'
  // }
  t.equal(match (1) ( // eslint-disable-line
    $($, x => x === 2), x => 'nope',
    $($, x => x === 1), x => 'ok'
  ), 'ok', 'guard filtered otherwise-matching clause')

  t.done()
})

test('Nested object matching', t => {
  // Sugared:
  // match ({x: {y: 1}}) {
  //   {x: {y: 2}} => y
  //   {x: {y: 1}} => y
  // }
  t.equal(match ({x: {y: 1}}) ( // eslint-disable-line
    {x: {y: 2}}, ({x}) => 'nope',
    {x: {y: 1}}, ({x: {y}}) => y === 1 && 'ok'
  ), 'ok', 'Object destructing with nested literal')

  class Foo {}
  // Sugared:
  // match ({x: {y: new Foo()}}) {
  //   {x: {y: Foo {}}} => 'ok'
  // }
  t.equal(match ({x: {y: new Foo()}}) ( //eslint-disable-line
    {x: {y: $(Foo, {})}}, () => 'ok'
  ), 'ok', 'nested, typed submatch successful')
  t.done()
})

test('Number matcher', t => {
  // Sugared:
  // const two = 2
  // match (two) {
  //   1 => 'nope'
  //   ^two => 'ok'
  // }
  const two = 2
  t.equal(match (two) ( // eslint-disable-line
    1, () => 'nope',
    // NOTE - when doing an actual `match` macro, we need to distinguish
    //        between var-as-match and var-as-assignment
    two, () => 'ok'
  ), 'ok', 'Number literals matched by ===')

  t.done()
})

test('String matcher', t => {
  // Sugared:
  // match ('foobar') {
  //   'foobar' => 'ok'
  // }
  t.equal(match ('foobar') ( // eslint-disable-line
    'barfoo', () => 'nope',
    'foobar', () => 'ok'
  ), 'ok', 'matched string')

  t.done()
})

test('RegExp matcher', t => {
  // Sugared:
  // match ('foobar') {
  //   /foo(bar)/ [match, submatch] => match + submatch
  // }
  t.equal(match ('foobar') ( // eslint-disable-line
    /foo(bar)/, ([match, submatch]) => match + submatch
  ), 'foobarbar', 'matched regexp and receive match obj')
  t.done()
})

test('Array matcher', t => {
  // Sugared:
  // match ([1, 2]) {
  //   [1, y] => ...
  // }
  t.deepEqual(match ([1, 2]) ( // eslint-disable-line
    [1], () => 'nope',
    [1, 2, 3], () => 'nope',
    [1, 3], () => 'nope',
    [2, $], () => 'nope',
    [$, 1], () => 'nope',
    [1, $], ([x, y]) => [x, y]
  ), [1, 2], 'Array matching')

  // Sugared:
  // match ([1, 2]) {
  //   [1, 2, 3, ...rest] => ...
  //   [1, 2, ...rest] => ...
  // }
  t.equal(match ([1, 2]) ( // eslint-disable-line
    [1, 2, 3, $.rest], ([a, b, c, ...rest]) => 'nope',
    [1, 2, $.rest], ([x, y, ...rest]) => {
      t.deepEqual([x, y, ...rest], [1, 2], '...rest destructured right')
      return 'ok'
    }
  ), 'ok', '...rest matching works')

  // Sugared:
  // match ([1, {x: {y: 2}}]) {
  //   [1, {x: {y: 2}}] => 'ok'
  // }
  t.equal(match ([1, {x: {y: 2}}]) ( // eslint-disable-line
    [1, 2], () => 'nope',
    [1, {y: 2}], () => 'nope',
    [2, {x: {y: 2}}], () => 'nope',
    [1, {x: {x: 2}}], () => 'nope',
    [1, {x: {y: 1}}], () => 'nope',
    [1, {x: {y: 2}}, $], () => 'nope',
    [1, {x: {y: 2}}], () => 'ok'
  ), 'ok', 'Nested array data matching')

  // Sugared:
  // match ({length: 2, 0: 1, 1: 2}) {
  //   Object [1, 2] => 'ok'
  // }
  t.equal(match ({length: 2, 0: 1, 1: 2}) ( // eslint-disable-line
    $(Object, [1]), () => 'nope',
    $(Object, [1, 2, 3]), () => 'nope',
    $(Object, [1, 3]), () => 'nope',
    $(Object, [2, $]), () => 'nope',
    $(Object, [$, 1]), () => 'nope',
    $(Object, [1, $]), ([x, y]) => x === 1 && y === 2 && 'ok'
  ), 'ok', 'works with Array-likes')

  t.done()
})

test('or-matcher', t => {
  // Sugared:
  // match (2) {
  //   1 || 3 => 'nope'
  //   2 || 4 => 'ok'
  // }
  t.equal(match (2) ( // eslint-disable-line
    $.or(1, 3), () => 'nope',
    $.or(2, 4), () => 'ok'
  ), 'ok', 'literal OR matched')

  // Sugared:
  // match ('foo') {
  //   'bar' || 'baz' => 'nope'
  //   'bar' || x if (x === 'foo') => 'ok'
  // }
  t.equal(match ('foo') ( // eslint-disable-line
    $.or('bar', 'baz'), () => 'nope',
    $.or('bar', $, x => x === 'foo'), () => 'ok'
  ), 'ok', 'guards work for or-matchers')

  t.done()
})

test('and-matcher', t => {
  // Sugared:
  // match ({x: 1, y: 2}) {
  //   {x: 1} && {y: 1} => 'nope'
  //   {x: 1} && {y: 2} => 'ok'
  // }
  t.equal(match ({x: 1, y: 2}) ( // eslint-disable-line
    $.and({x: 1}, {y: 1}), () => 'nope',
    $.and({x: 1}, {y: 2}), () => 'ok'
  ), 'ok', 'AND matcher worked')

  // Sugared:
  // match ([1, 2, 3]) {
  //   [1, ...] && [a, 1, b] if (b === 4)=> 'nope'
  //   [1, ...] && [a, 2, b] => 'ok'
  // }
  t.equal(match ([1, 2, 3]) ( // eslint-disable-line
    $.and([1, $.rest], [$, 2, $], ([a, x, b]) => b === 4), () => 'nope',
    $.and([1, $.rest], [$, 2, $], ([a, x, b]) => b === 3), () => 'ok'
  ), 'ok', 'guards work for and-matchers')

  t.done()
})
