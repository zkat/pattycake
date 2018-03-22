'use strict'

// This module is intended as a prototype semi-desugaring of the following
// ABNF-style grammar:
//
// Match := 'match' '(' RHSExpr ')' '{' MatchClause* '}'
// MatchClause := MatchClauseLHS '=>' RHSExpr MaybeASI
// MatchClauseLHS := [MatcherExpr] (LiteralMatcher | ArrayMatcher | ObjectMatcher | JSVar)
// MatcherExpr := LHSExpr
// LiteralMatcher := LitRegExp | LitString | LitNumber
// ArrayMatcher := '[' MatchClauseLHS [',', MatchClauseLHS]* ']'
// ObjectMatcher := '{' (JSVar [':' MatchClauseLHS]) [',' (JSVar [':', MatchClauseLHS]*)] '}'

class MatchError extends Error {}

class MatchClause {
  constructor (matcher, body) {
    if (typeof body !== 'function') {
      throw new Error('clause body must be a function')
    }
    this.matcher = matcher
    this.body = body
  }
  exec (val) {
    this.body.call(null, val)
  }
  match (val) {
    const method = this.matcher[Symbol.patternMatch]
    if (method) {
      return method(val)
    } else if (this.matcher instanceof RegExp) {
      return !!val
    } else {
      return val instanceof this.matcher
    }
  }
  getVal (val) {
    const method = this.matcher[Symbol.patternValue]
    if (method) {
      return method(val)
    } else if (this.matcher instanceof RegExp) {
      return this.matcher.exec(val)
    } else {
      return val
    }
  }
}

class LiteralMatchClause extends MatchClause {
  match (val) {
    return val === this.matcher
  }
  getVal (val) {
    return val
  }
}

module.exports = match
function match (val, ...clauseParts) {
  const clauses = clauseParts.reduce((acc, part, i) => {
    if (!(i % 2)) {
      acc.push([part])
    } else {
      acc[(i - 1) / 2].push(part)
    }
    return acc
  }, []).map(parseMatchClause)
  let matched
  const expr = clauses.find(clause => {
    matched = clause.getVal(val)
    return clause.match(val)
  })
  if (expr) {
    expr.body(matched)
  } else {
    throw new MatchError('badarg')
  }
  return expr && expr.body(matched)
}

module.exports.multi = multi
function multi (...matchers) {
  const clauses = matchers.map(m => parseMatchClause([m, Function.prototype]))
  return {
    [Symbol.patternMatch] (val) {
      return clauses.every(c => c.match(c.getVal(val)))
    },
    [Symbol.patternValue] (val) {
      // TODO - figure out automated nested patternValue construction
      return clauses[0] ? clauses[0].getVal(val) : val
    }
  }
}

module.exports.path = pathMatcher
function pathMatcher (matcher, ...keys) {
  const clause = parseMatchClause([matcher, Function.prototype])
  return {
    [Symbol.patternMatch] (val) {
      if (val) {
        const targetVal = keys.reduce((val, key) => {
          return val != null && val[key]
        }, val)
        return clause.match(clause.getVal(targetVal))
      }
    }
  }
}

function parseMatchClause ([matcher, body]) {
  if (typeof matcher === 'string' || typeof matcher === 'number') {
    return new LiteralMatchClause(matcher, body)
  } else {
    return new MatchClause(matcher, body)
  }
}
