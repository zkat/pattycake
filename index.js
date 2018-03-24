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
  let matched
  let matchedVal
  const clause = clauses.find(clause => {
    if (clause.matcher.extractor) {
      if (clause.matcher.extractor[Symbol.patternMatch]) {
        const extracted = clause.matcher.extractor[Symbol.patternMatch](val)
        if (!extracted) { return false }
        if (extracted && extracted[Symbol.patternValue]) {
          val = extracted[Symbol.patternValue]
        }
      } else if (typeof clause.extractor === 'function') {
        if (!(val instanceof clause.matcher.extractor)) { return false }
      }
    }
    matched = clause.matcher[Symbol.patternMatch](val)
    if (matched) {
      matchedVal = matched.hasOwnProperty(Symbol.patternValue)
        ? matched[Symbol.patternValue]
        : val
      if (clause.matcher.guard) {
        return clause.matcher.guard(matchedVal)
      }
      return true
    }
  })
  if (clause) {
    return clause.body(matchedVal)
  } else {
    throw new MatchError('badmatch')
  }
}

class Matcher {
  constructor (extractor, matcher, guard) {
    this.extractor = extractor
    this.matcher = matcher
    this.guard = guard
  }
}

class LiteralMatcher extends Matcher {
  [Symbol.patternMatch] (val) {
    return val === this.matcher
  }
}

class ArrayMatcher extends Matcher {
  constructor (extractor, matcher, guard) {
    super(extractor, matcher, guard)
    const $restIdx = this.matcher.indexOf($.rest)
    this.strictLength = $restIdx === -1
    if (!this.strictLength) {
      this.minLength = $restIdx
    }
    this.subMatchers = this.matcher.map(x => $(x))
  }
  [Symbol.patternMatch] (val) {
    if (this.extractor && this.extractor[Symbol.patternMatch]) {
      const match = this.extractor[Symbol.patternMatch](val)
      if (!match) {
        return false
      } else if (match.hasOwnProperty(Symbol.patternValue)) {
        val = match[Symbol.patternValue]
      }
    } else if (this.extractor && typeof this.extractor === 'function') {
      if (!(val instanceof this.extractor)) { return false }
    }
    if (!val) { return false }
    if (val.length === undefined) { return false }
    if (this.strictLength && val.length !== this.matcher.length) {
      return false
    }
    if (!this.strictLength && val.length < this.minLength) { return false }
    const subs = this.subMatchers
    const arr = []
    let gotRest = false
    for (let i = 0; i < val.length; i++) {
      if (gotRest || subs[i] === $) {
        arr[i] = val[i]
      } else if (subs[i] === $.rest) {
        gotRest = true
        arr[i] = val[i]
      } else if (!subs[i]) {
        arr[i] = val[i]
      } else if (subs[i][Symbol.patternMatch]) {
        const match = subs[i][Symbol.patternMatch](val[i])
        if (!match) {
          return false
        } else if (match.hasOwnProperty(Symbol.patternValue)) {
          arr[i] = match[Symbol.patternValue]
        } else {
          arr[i] = val[i]
        }
      }
    }
    return {[Symbol.patternValue]: arr}
  }
}

class ObjectMatcher extends Matcher {
  constructor (extractor, matcher, guard) {
    super(extractor, matcher, guard)
    this.subMatchers = {}
    Object.keys(this.matcher).forEach(k => {
      this.subMatchers[k] = $(this.matcher[k])
    })
  }
  [Symbol.patternMatch] (val) {
    if (!val) { return false }
    if (this.extractor && this.extractor[Symbol.patternMatch]) {
      const match = this.extractor[Symbol.patternMatch](val)
      if (!match) {
        return false
      } else if (match.hasOwnProperty(Symbol.patternValue)) {
        val = match[Symbol.patternValue]
      }
    } else if (this.extractor && typeof this.extractor === 'function') {
      if (!(val instanceof this.extractor)) { return false }
    }
    const subs = this.subMatchers
    const ret = {}
    return Array.from(
      new Set(Object.keys(subs).concat(Object.keys(val)))
    ).every(k => {
      if (val[k] === undefined) {
        return false
      } else if (subs[k] === $ || !subs[k]) {
        ret[k] = val[k]
        return true
      } else if (subs[k][Symbol.patternMatch]) {
        const matched = subs[k][Symbol.patternMatch](val[k])
        if (!matched) {
          return false
        } else if (matched.hasOwnProperty(Symbol.patternValue)) {
          ret[k] = matched[Symbol.patternValue]
          return true
        } else {
          ret[k] = val[k]
          return true
        }
      } else {
        return false
      }
    }) && {[Symbol.patternValue]: ret}
  }
}

class RegExpMatcher extends Matcher {
  [Symbol.patternMatch] (val) {
    const match = this.matcher.exec(val)
    if (match) { return {[Symbol.patternValue]: match} }
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
function $ (extractor, matcher, guard) {
  // $({foo: $}), $(1), $(null), etc
  if (arguments.length === 1) {
    matcher = extractor
    extractor = undefined
  }
  // $({foo: $}/null/1/etc, x => x === 1)
  if (!guard && typeof matcher === 'function' && matcher !== $) {
    guard = matcher
    matcher = extractor
    extractor = undefined
  }
  // Can't extend RegExp so special-casing right here
  if (extractor && {}.toString.call(extractor) === '[object RegExp]') {
    extractor = new RegExpMatcher(extractor)
  }

  if (matcher === undefined || matcher === $ || matcher === $.rest) {
    return new AnyMatcher(extractor, matcher, guard)
  } else if (matcher instanceof Matcher) {
    // $($(...))
    return matcher
  } else if (typeof matcher === 'number' || typeof matcher === 'string' || typeof matcher === 'boolean' || matcher === null) {
    return new LiteralMatcher(extractor, matcher, guard)
  } else if (Array.isArray(matcher)) {
    return new ArrayMatcher(extractor, matcher, guard)
  } else if ({}.toString.call(matcher) === '[object RegExp]') {
    return new RegExpMatcher(extractor, matcher, guard)
  } else if (typeof matcher === 'object') {
    return new ObjectMatcher(extractor, matcher, guard)
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
