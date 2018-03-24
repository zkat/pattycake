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
* [Design Decisions](#design-decisions)
* [Bikesheds](#bikesheds)

### Example

```javascript
const val = match (await fetch(jsonService)) {
  {status: 200, {headers: {'Content-Length': s}}} => `Response size is ${s}`
  {status: 404} => 'JSON not found'
  {status} if (status >= 400) => 'request error'
}
```

### API

#### Note on API documentation

This documentation described the sugared version of the `match` expression. The
API exported by `pattycake` is similar, but uses functions and different syntax
for the same underlying concepts.

To convert a sugary `match` to a `pattycake` match:
1. Replace the main `{}` pair with `()`
2. Separate match clauses and bodies into matcher expressions and a fat arrow function, using the parameter list for the fat arrow for destructuring.
3. If your clause uses the format `Foo x`, `Foo {}`, etc, use `match.$` to create the corresponding clause: `match.$(Foo, {})`
4. Replace any variable clauses in the match side with `match.$`.
5. If using guards, convert the guard to a function and pass it as the last argument to `match.$`. If you weren't already using `match.$` for a certain clause (because it wasn't necessary), wrap that clause with `match.$` and pass the guard function as the second argument.
6. If using `||` or `&&`, wrap the expressions in `$.or` or `$.and`, with each alternative as an argument to those functions.
7. If using `...splat`s with array matchers, replace the `...splat` with `$.rest` and destructure the array in the fat arrow body.

##### Example

```js
match (x) {
  {a: 1, b} => ...
  Foo {x} => ...
  [1, 2, ...etc] => ...
  1 => ...
  'string' => ...
  true => ...
  null => ...
  /regexhere/ => ...
  1 || 2 || 3 => ...
  {x: 1} && {y} => ...
}

// Converts to...
const $ = match.$
match (x) (
  {a: 1, b: $}, ({b}) => ...,
  $(Foo, {x: $}), ({x}) => ...,
  [1, 2, $.rest], ([a, b, ...etc]) => ...,
  1, () => ...,
  'string', () => ...,
  true, () => ...,
  null, () => ...,
  /regexhere/, () => ...,
  $.or(1, 2, 3), () => ...,
  $.and({x: 1}, {y: $}), ({y}) => ...
)
```

#### <a href="match"></a> `match (val) { [clauses]* }`

The `match` expression compares `val` against a number of clauses, and executes
the body to the right of the arrow for the clause that succeeds, returning its
final value.

There are x types of clauses: primitives, RegExp, Object, Array, `||`, `&&`, and
variable. Each of these clauses, except `||` and `&&`, can include a custom
matcher.

Composite clauses are able to further destructure and match their input, and the
top level clause can include a guard expression to further filter individual
clauses.

#### <a href="variable-matcher"></a> Variables

Plain variables in a `match` will be bound to their associated value and made
available to the body of that clause. If the variable is already bound in the
surrounding scope, it will be shadowed. Values inside variables are never
matched against directly -- use a guard instead.

##### Example

```js
const y = 2
match (1) {
  y => y === 1 // `const y` shadowed
}

match (2) {
  x if (x === y) => x === y === 2 // guard comparison with variable
}
```

#### <a href="primitive-matcher"></a> Primitives

Primitive types will be matched with `===`. The following literals can be
matched against: `Number`, `String`, `Boolean`, `Null`.

##### Example

```js
match (x) {
  1 => ...
  'foo' => ...
  true => ...
  null => ...
  {x: true, y: 1, z: true} => ...
}
```

#### <a href="object-matcher"></a> Objects

Objects are destructured. Any variables mentioned in the match side MUST exist
in the matched object, but additional properties on the object will be ignored.
Matches within objects can be further nested with any other types.

##### Example

```js
match (x) {
  {x: 1, y} => ... // the y property is required, and is locally bound to y
  {} => ... // matches any object
  {x: {y: 1}} => ...
  Foo {y} => ... // matches an instance of `Foo` or, if
                 // `Foo[Symbol.patternMatch]` is present, that method is called
                 // instead. y is destructured out of the `Foo` object if the
                 // property exists.
}
```

#### <a href="array-matcher"></a> Arrays

Array values are matches individually, just like with [Object
matchers](#object-matcher). The array length must match, unless a splat is used
(`[1, 2, ...etc]`), in which case the array must be at least as long as the
number of entries before the splat.

Array destructuring supports using a custom matcher, just like Objects. When
using custom matchers, the value is destructures as an `Array-like` object, so
it doesn't need to be a subclass of `Array` -- the `length` property will be
used for destructuring, along with any numerical keys.

##### Example

```js
match (x) {
  [a, b, 1] => ...
  [1, 2, null] => ...
  [1, ...etc] => ...
  Foo [1, 2] => ...
}
```

#### <a href="regexp-matcher"></a> RegExp

Regular expression matchers are executed against the incoming value and the
match value made available for further destructuring, with Array or Object
matchers.

##### Example

```js
match (x) {
  /foo(bar)/u [match, submatch] => match + submatch === 'foobarbar'
  /(?<yyyy>\d{4})-(?<mm>\d{2})-(?<dd>\d{2})/u {groups: {yyyy, mm, dd}} => ...
}
```

#### <a href="compound-matcher"></a> `&&` and `||`

You can use `&&` and `||` between expressions at any level. Guards are not
included in these expressions, as there must be only one.

##### Example

```js
match (x) {
  1 || 2 || 3 => ...
  [1, y] && {x: 2} => ...
}
```

### <a href="design-decisions"></a> Design Decisions

These are key, intentional design desicions made by this proposal in particular
which I believe should stay as they are, and why:

#### <a href="variables-always-assign"></a> > Variables always assign

When the match pattern is a variable, it should simply assign to that variable,
instead of trying to compare the value somehow.

```js
const y = 2
match (1) {
  y => x === y // y is bound to 1
}
```

Guards can be used instead, for comparisons:

```js
const y = 2
match (1) {
  x if (y === 2) => 'does not match'
  x if (x === 1) => 'x is 1'
}
```

See also [the bikeshed about pinning](#variable-pinning-operator) for a proposal
on how to allow variable-based matching.

##### Benefits:

* Follows the precedent of every other match implementation I could find. This is about as universal as I think this gets? Unless I misread/misunderstood what another language is doing or missed an exception.
* Consistent behavior: No ambiguity when a variable is not assigned vs when it's suddenly assigned in the scope. Behavior will remain the same.
* Eliminates the need for an `else`/`default` leg, because assignment to any variable will be sufficient. JS programmers are already used to assigning variables that are then ignored (in functions, in particular), and different people have different tastes in what that should be. `_`, `other`, etc, would all be perfectly cromulent alternatives.

#### > Primitives compared with `===`

This proposal special-cases Array, Object, and RegExp literal matches to make
them more convenient and intuitive, but Numbers, Strings, Booleans, and Null are
always compared using `===`:

```js
match (x) => {
  1 => 'x is 1'
  'foo' => 'x is foo'
  null => 'x is null (not undefined)'
}
```

See also [the bikeshed about special-casing the `null` matcher](#null-punning),
as well as the one [about making `undefined` another "primitive"
matcher](#undefined-match).

#### > Only one parameter to match against

`match` accepts only a single argument to match against. This is sufficient,
since arrays can be used with minimal syntactic overhead to achieve this effect:

```js
match ([x, y]) {
  [1, 2] => ...
}
```

(versus `match (x, y) ...`)

#### > `=>` for leg bodies

The previous `match` proposal used `:` as the separator between matchers and
bodies. I believe `=>` is a better choice here due to its correspondence to fat
arrows, and how similar the scoping/`{}` rules would be. Bodies should be
treated as expressions returning values, which is very different from how
`switch` works. I believe this is enough reason to distance `match`'s leg syntax
from `switch`'s.

```js
match (x) {
  foo => foo + 1
  {y: 1} => x.y === y
  bar => {
    console.log(bar)
    return bar + 2
  }
}
```

I don't think this is worth bikeshedding over unless there's major concerns
about syntactic ambiguity I haven't thought of.

#### > Use `||` and `&&` for joining

There was [some
discussion](https://github.com/tc39/proposal-pattern-matching/issues/7) about
different ways to join together multiple match patterns. This proposal picked `||`
for one-of, and `&&` for all-of matches:

```js
match (x) {
  1 || 2 || 3 || x if (x > 10) => '...'
  Bar {} && Foo {} => 'instanceof both Bar and Foo classes'
}
```

I believe this is better than `:` because, again, it distances itself more from
the very very different `switch` semantics, and also has a very clear symmetry
that allows `&&` to work just fine. It also fits with other pattern matching
engines that allow alternatives like this actually do. I don't believe this is
worth further bikeshedding.

### Bikesheds

These are things that have different tradeoffs that are worth choosing between.
None of these options are strictly or clearly better than the other (imo), so
they're worth discussing and making executive choices about.

#### <a href="method-symbols"></a> > Matcher method symbols

The original proposal used `Symbol.match`, but [that is already a "well-known"
Symbol](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol#Well-known_symbols)
used with RegExps. It's best for us to find a better one.

This proposal uses `Symbol.patternMatch` and `Symbol.patternValue` for its
methods, but that's all open to bikeshedding.

```js
class One {
  [Symbol.patternMatch] (val) { val === 1 }
}

match (1) {
  One x => 'x is 1'
}
```

#### <a href="undefined-match"></a> > `undefined` matching

While `null` is an actual primitive literal, `undefined` is an immutable
property of the global object that happens to *contain* the undefined primitive 
value (which is obtainable via `void 0`, etc). This means that `undefined` can be a regular
variable, and can thus potentially be assigned by match expressions. There are
thus two choices here that we could take as far as how `match` treats
`undefined` matches:

The "consistent" solution would be to keep variable semantics for `undefined`
and treat it like a regular variable. This means that using `undefined` in the
LHS of a match clause would bind _any value_ to that variable and make it
available for that leg:

```js
match (1) {
  undefined => 'always matches'
  1 => 'unreachable code'
}
```

This avoids any special cases in the matching rules, but a guard must be used 
to actually test if the value is undefined.

The alternative is to have a bit of a special case for `undefined` so it's
always treated as referring to the undefined primitive value, and matches with
an `===` comparison, as the other primitive literals do:

```js
match (1) {
  undefined => 'nope'
  1 => 'matches === 1'
}
```

This special-casing avoids a confusing footgun that the "consistent" approach allows,
if authors assume that `undefined` refers to the primitive value, which they can
usually do without problem:

```js
// If `undefined` is treated as a variable:
match(1) {
  undefined => 'always matches, and now undefined is bound to 1 in this body :('
}
```

Another argument in favor of the special case is so, instead of [making `match`
automatically pun on `null` equality](null-punning), we can use `||` to do the equivalent of a
`foo == null`:

```js
var x
match (x) {
  null || undefined => 'yay'
}
```

#### <a href="null-punning"></a> > Automatic equality-punning for `null`

By default, non-Object, non-Array, non-RegExp literals are [matched using
`===`](triple-or-double-match). Assuming that remains the case, there's a
question of whether supporting what's often considered "the reasonable use for `==`"
is worth the cost of inconsistency here. That is, we might want `null` in the
LHS of a match clause to cause a `==` check, instead of a `===` check, which
would make `undefined` match, as well:

```js
match (undefined) {
  null => 'this matches'
}
```

On the other hand, this would make it confusing for people expecting a `===`
match for this sort of literal. The main alternative would be to use a guard:

```js
match (undefined) {
  x if (x == null) => 'this matches'
}
```

Or, alternatively, using `|` if [`undefined` is
special-cased](#undefined-matching).

#### <a href="match-assignment"></a> > Assigning matches to variables

If you have a nested match, particularly a nested one, it would be useful to be
able to bind those specific matches to a variable. There's a number of syntaxes
that can be used for this:

##### Option A: `as`

This syntax is [used by
F#](https://docs.microsoft.com/en-us/dotnet/fsharp/language-reference/pattern-matching).
(TK TK Kat: I think there's an `as` proposal for JS already? somewhere?)

```js
match (x) {
  {x: {y: 1} as x} => x.y === 1
}
```

##### Option B: `@`

This syntax seems to be by far the most common, and is used by
[Rust](https://doc.rust-lang.org/book/second-edition/ch18-03-pattern-syntax.html#-bindings),
[Haskell](https://en.wikibooks.org/wiki/Haskell/Pattern_matching#as-patterns),
[Scala](http://www.scala-lang.org/files/archive/spec/2.11/08-pattern-matching.html#pattern-binders).
Its main differences from `as` are that the variable goes before the match and `@`
is more terse -- specially since spaces aren't necessary.

```js
match (x) {
  {x: x@{y: 1}} => x.y === 1
}
```

Another benefit of using `@` is that it could allow folks to use a matcher
directly without needing to assign a variable to it, because the `@` operator
could double-up as a matcher "tag":

```js
match (obj) {
  @Foo => 'Foo[Symbol.patternMatch](obj) executed!'
  _@Foo => '@Foo is a shorthand for this'
  Foo {} => 'the way you would do it otherwise'
  Foo _ => 'though this works, too'
}
```

##### Option C: `=`

I'm not sure this one would even work reasonably in JS, because `=` is already
used for defaults in destructuring, but I'm including this one for the sake of
completeness, because it's [what Erlang uses for
this](http://learnyousomeerlang.com/syntax-in-functions#highlighter_784541)

```js
match (x) {
  {x: x = {y: 1}} => x.y === 1
}
```

#### <a href="variable-pinning-operator"></a> > Pin operator

Since this proposal [treats variables as universal
matches](#variables-always-assign), it leaves some space as far as what should
actually be done to match against variables in the scope, instead of literals.

This proposal initially assumes that guards will be used in cases like these,
since they should generally work just fine, but there's also the possibility of
incorporating [a pin
operator](https://elixir-lang.org/getting-started/pattern-matching.html), like
Elixir does, for forcing a match on a variable. This would work out to a
shorthand only for primitive values.

Using the operator directly from Elixir:

```js
const y = 1
match (x) {
  ^y => 'x is 1'
  x if (x === y) => 'this is how you would do it otherwise'
}
```

A more compelling reason to have this terseness might be to allow matches on
`Symbol`s or other "constant"-like objects:

```js
import {FOO, BAR} from './constants.js'

match (x) {
  ^FOO => 'x was the FOO constant'
  ^BAR => 'x was the BAR constant'
}
```

It's also possible to choose all sorts of different operators for this, but I'm
just using whatever Elixir does for this bit.

An alternative might also be to use custom matcher objects/functions to allow
this sort of equality:

```js
import {FOO, BAR} from './constants.js'

class ConstantMatcher {
  constructor (val) { this.val = val }
  [Symbol.patternMatch] (val) { return this.val === val }
}
function ByVal (obj) {
  return new ConstantMatcher(obj)
}

match (x) {
  ByVal(c.FOO) x => 'got a FOO'
  ByVal(c.BAR) x => 'got a BAR'
}
```

This might be enough, and might even be a reason to consider a built-in version
of this matcher.

(Kat's opinion: we have terse enough guards that this seems useless. Elixir
benefits from it mostly because it relies heavily on pattern matching on
variable assignments, not just in its case statement. The JS version of this
would have limited utility.)
