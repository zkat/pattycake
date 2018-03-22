'use strict'

const test = require('tap').test

const match = require('../index.js')

test('plain match', t => {
  // Sugared:
  // match ({x: 1}) {
  //   Object {x} => x
  //   {x} => x // synonym
  // }
  t.equal(match({x: 1},
    Object, ({x}) => x
  ), 1, 'object matcher matched and destructuring worked')
  t.throws(
    () => match('foo', Object, () => 'no win'),
    /badarg/,
    'no matching clauses for string literal'
  )

  class Foo {
    constructor (x) {
      this.x = x
    }
  }

  // Sugared:
  // match (new Foo(1)) {
  //   Foo {x} => x
  //   {} => 'matched Object, not Foo'
  // }
  t.equal(match(new Foo(1),
    Foo, ({x}) => x,
    Object, () => 'matched Object, not Foo'
  ), 1, 'Custom class matched by instanceof')

  // Sugared:
  // match (new Foo(1)) {
  //   {} => 'matched Object, not Foo'
  //   Foo {x} => x
  // }
  t.equal(match(new Foo(1),
    Object, () => 'matched Object, not Foo',
    Foo, ({x}) => x
  ), 'matched Object, not Foo', 'clause matching done in top-down order')

  // Sugared:
  // match ({x: 1}) {
  //   Foo {x} => x
  //   {} => 'obj'
  // }
  t.equal(match({x: 1},
    Foo, ({x}) => x,
    Object, () => 'obj'
  ), 'obj', 'matched Object, not Foo')

  t.done()
})

test('Compound matcher', t => {
  // Sugared:
  // match ({x: {y: 1}}) {
  //   {x: {y: 1}} => y
  // }
  t.equal(match({x: {y: 1}},
    match.multi(
      Object,
      match.path(Object, 'x'),
      match.path(1, 'x', 'y')
    ), ({x: {y}}) => y
  ), 1, 'compound object matching works')

  t.done()
})

test('RegExp matcher', t => {
  // Sugared:
  // match ('foobar') {
  //   /foo(bar)/ [match, submatch] => match + submatch
  // }
  t.equal(match('foobar',
    /foo(bar)/, ([match, submatch]) => match + submatch
  ), 'foobarbar', 'matched regexp and receive match obj')

  t.done()
})

test('Array matcher')

//
//
//
// class Foo extends Object {
//   constructor (x, y) {
//     super()
//     this.x = x
//     this.y = y
//   }
// }
//
// function tryMatch (val) {
//   console.log('\nmatch', `(val = ${util.inspect(val)}) {`, '\n  ', match(val,
//     // sugar: /foo(bar)/ [match, submatch]
//     expr(
//       // Compound matcher generated
//       {
//         [Symbol.match] (val) {
//           return (
//             mm(Array, val)
//           )
//         },
//         [Symbol.matchValue] (val) {
//           return String(val).match(/foo(bar)/)
//         }
//       },
//       ([match, submatch]) => `/foo(bar)/ [match, submatch] => match === ${util.inspect(match)} && submatch === ${util.inspect(submatch)}`
//     ),
//
//     // sugar: [a, b]
//     expr(
//       // Compound matcher generated
//       {
//         [Symbol.match] (val) {
//           return (
//             mm(Array, val) &&
//             val.length === 2
//           )
//         }
//       },
//       ([a, b]) => `[a, b] => ${util.inspect([a, b])}`
//     ),
//
//     // sugar: [a, 2, ...rest]
//     expr(
//       // Compound matcher generated
//       {
//         [Symbol.match] (val) {
//           return (
//             mm(Array, val) &&
//             val[1] === 2
//           )
//         }
//       },
//       ([a, _, ...rest]) => `[a, 2, ...rest] => a === ${util.inspect(a)} && rest === ${util.inspect(rest)}`
//     ),
//     // sugar: {y: {x: 'hello'}}
//     expr(
//       // Compound matcher generated
//       {
//         [Symbol.match] (val) {
//           return (
//             mm(Object, val) &&
//             mm(Object, val.y) &&
//             val.y.x === 'hello'
//           )
//         }
//       },
//       ({y: {x}}) => `{y: {x: 'hello'}} => x === ${util.inspect(x)}`
//     ),
//
//     // sugar: {y: Foo {x: 'hello'}}
//     expr(
//       // Compound matcher generated
//       {
//         [Symbol.match] (val) {
//           return (
//             mm(Object, val) &&
//             mm(Foo, val.y)
//           )
//         }
//       },
//       ({y: {x}}) => `{y: Foo {x}} => x === ${util.inspect(x)}`
//     ),
//
//     // sugar: {x, x: {y}}
//     expr(
//       // Compound matcher generated
//       {
//         [Symbol.match] (val) {
//           return (
//             mm(Object, val) &&
//             mm(Object, val.x)
//           )
//         }
//       },
//       ({x, x: {y}}) => `{x, x: {y}} => x === ${util.inspect(x)} && y === ${y} // (follows destr. syntax)`
//     ),
//
//     // sugar: {y: {x}}: x + y
//     expr(
//       // Compound matcher generated
//       {
//         [Symbol.match] (val) {
//           return (
//             mm(Object, val) &&
//             mm(Object, val.y)
//           )
//         }
//       },
//       ({y: {x}}) => `{y: {x}} => x === ${x} // (y is unbound)`
//     ),
//     // sugar: Foo {x, y}
//     expr(Foo, ({x, y}) => `Foo {x, y} => x === ${x} && y === ${y}`),
//
//     // sugar: {x, y}
//     expr(Object, ({x, y}) => `{x, y} => x === ${x} && y === ${y}`),
//
//     // sugar: <literal number/string>
//     expr({
//       [Symbol.match] (v) { return v === val }
//     }, (x) => `${util.inspect(val)} => val === ${util.inspect(x)}`)
//   ), '\n}')
// }
//
// console.log('== basic match types ==')
// tryMatch({x: 1, y: 2})
// tryMatch(new Foo(1, 2))
// tryMatch('hello')
// tryMatch(1)
//
// console.log('\n== array matching ==')
// tryMatch([1, 2])
// tryMatch([1, 2, 3, 4, 5])
//
// console.log('\n== compound matching ==')
// tryMatch({x: {y: 2}})
// tryMatch({y: {x: 1}})
// tryMatch({y: {x: 'hello'}})
// tryMatch({y: new Foo(1, 2)})
//
// console.log('\n== guards ==')
// tryMatch([3,2,1])
//
// console.log('\n== using Symbol.matchValue api ==')
// tryMatch(/foobar/)
