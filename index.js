'use strict'

Symbol.patternMatch = Symbol('patternMatch')
Symbol.patternValue = Symbol('patternValue')

class MatchError extends Error {}
class MatchClause {
  constructor (matcher, body) {
    if (!matcher) { throw new Error('matcher clause required') }
    if (!body) { throw new Error('clause body required') }
    this.matcher = matcher
    this.body = body
  }
}
module.exports = match
function match (val, ...clauseParts) {
  if (!clauseParts.length) {
    return (...clauseParts) => match(val, ...clauseParts)
  }
  const clauses = clauseParts.reduce((acc, part, i) => {
    if (!(i % 2)) {
      acc.push([part])
    } else {
      acc[(i - 1) / 2].push(part)
    }
    return acc
  }, []).map(([matcher, body]) => {
    return new MatchClause($(matcher), body)
  })
  const clause = clauses.find(clause => {
    if (clause.matcher[Symbol.patternMatch](val)) {
      if (clause.matcher.guard) {
        return clause.matcher.guard(val)
      }
      return true
    }
  })
  if (clause && clause.matcher[Symbol.patternValue]) {
    return clause.body(clause.matcher[Symbol.patternValue](val))
  } else if (clause) {
    return clause.body(val)
  } else {
    throw new MatchError('badmatch')
  }
}

// MatchClauseLHS := [MatchType] (LiteralMatcher | ArrayMatcher | ObjectMatcher | JSVar) [GuardExpr]
// MatchType := LHSExpr
// LiteralMatcher := RegExp | String | Number | Bool | Null
// ArrayMatcher := '[' MatchClauseLHS [',', MatchClauseLHS]* ']'
// ObjectMatcher := '{' (JSVar [':' MatchClauseLHS]) [',' (JSVar [':', MatchClauseLHS]*)] '}'
// GuardExpr := 'if' '(' RHSExpr ')'
class Matcher {
  constructor (matchType, matcher, guard) {
    this.matchType = matchType
    this.matcher = matcher
    this.guard = guard
  }
  [Symbol.patternValue] (val) { return val }
  [Symbol.patternValue] (val) { return val }
}

class LiteralMatcher extends Matcher {
  [Symbol.patternMatch] (val) {
    return val === this.matcher
  }
}

class ArrayMatcher extends Matcher {
  constructor (matchType, matcher, guard) {
    super(matchType, matcher, guard)
    const $restIdx = this.matcher.indexOf($.rest)
    this.strictLength = $restIdx === -1
    if (!this.strictLength) {
      this.minLength = $restIdx
    }
    this.subMatchers = this.matcher.map(x => $(x))
  }
  [Symbol.patternValue] (val) { return Array.from(val) }
  [Symbol.patternMatch] (val) {
    if (!val) { return false }
    if (this.matchType && this.matchType[Symbol.patternMatch]) {
      if (!this.matchType[Symbol.patternMatch](val)) { return false }
    } else if (this.matchType && typeof this.matchType === 'function') {
      if (!(val instanceof this.matchType)) { return false }
    }
    if (!val.hasOwnProperty('length')) { return false }
    if (this.strictLength && val.length !== this.matcher.length) {
      return false
    }
    if (!this.strictLength && val.length < this.minLength) { return false }
    const subs = this.subMatchers
    return [].every.call(val, (elt, i) => (
      subs[i] === $ ||
      subs[i] === $.rest ||
      !subs[i] ||
      (subs[i][Symbol.patternMatch] && subs[i][Symbol.patternMatch](elt, val[i]))
    ))
  }
}

class ObjectMatcher extends Matcher {
  constructor (matchType, matcher, guard) {
    super(matchType, matcher, guard)
    this.subMatchers = {}
    Object.keys(this.matcher).forEach(k => {
      this.subMatchers[k] = $(this.matcher[k])
    })
  }
  [Symbol.patternMatch] (val) {
    if (!val) { return false }
    if (this.matchType && this.matchType[Symbol.patternMatch]) {
      if (!this.matchType[Symbol.patternMatch](val)) { return false }
    } else if (this.matchType) {
      if (!(val instanceof this.matchType)) { return false }
    }
    const subs = this.subMatchers
    const ret = Object.keys(subs).every(k => {
      if (!val.hasOwnProperty(k)) { return false }
      if (subs[k] === $ || !subs[k]) { return true }
      return (
        subs[k][Symbol.patternMatch] && subs[k][Symbol.patternMatch](val[k])
      )
    })
    return ret
  }
}

class RegExpMatcher extends Matcher {
  [Symbol.patternValue] (val) { return this.matcher.exec(val) }
  [Symbol.patternMatch] (val) {
    const method = this.matcher[Symbol.patternMatch]
    if (method) {
      return method(val)
    } else {
      return this.matcher.exec(val)
    }
  }
}

class AnyMatcher extends Matcher {
  [Symbol.patternMatch] () { return true }
}

class OrMatcher extends Matcher {
  [Symbol.patternMatch] (val) {
    return this.matcher.some(m => m[Symbol.patternMatch](val))
  }
}

class AndMatcher extends Matcher {
  [Symbol.patternMatch] (val) {
    return this.matcher.every(m => m[Symbol.patternMatch](val))
  }
}

module.exports.$ = $ // aka `JSVar` for our purposes
function $ (matchType, matcher, guard) {
  // $({foo: $}), $(1), $(null), etc
  if (arguments.length === 1) {
    matcher = matchType
    matchType = undefined
  }
  // $({foo: $}/null/1/etc, x => x === 1)
  if (!guard && typeof matcher === 'function') {
    guard = matcher
    matcher = matchType
    matchType = undefined
  }
  if (matcher === undefined || matcher === $ || matcher === $.rest) {
    return new AnyMatcher(matchType, matcher, guard)
  } else if (matcher instanceof Matcher) {
    // $($(...))
    return matcher
  } else if (typeof matcher === 'number' || typeof matcher === 'string' || typeof matcher === 'boolean' || matcher === null) {
    return new LiteralMatcher(matchType, matcher, guard)
  } else if (Array.isArray(matcher)) {
    return new ArrayMatcher(matchType || Array, matcher, guard)
  } else if ({}.toString.call(matcher) === '[object RegExp]') {
    return new RegExpMatcher(matchType, matcher, guard)
  } else if (typeof matcher === 'object') {
    return new ObjectMatcher(matchType, matcher, guard)
  } else {
    throw new Error('Invalid matcher: ' + require('util').inspect(matcher))
  }
}

module.exports.$.rest = Symbol('match.$.rest')
module.exports.$.or = (...alts) => {
  const maybeGuard = alts[alts.length - 1]
  let guard
  if (maybeGuard && typeof maybeGuard === 'function') {
    alts = alts.slice(0, alts.length - 1)
    guard = maybeGuard
  }
  return new OrMatcher(null, alts.map(a => $(a)), guard)
}
module.exports.$.and = (...alts) => {
  const maybeGuard = alts[alts.length - 1]
  let guard
  if (maybeGuard && typeof maybeGuard === 'function') {
    alts = alts.slice(0, alts.length - 1)
    guard = maybeGuard
  }
  return new AndMatcher(null, alts.map(a => $(a)), guard)
}
