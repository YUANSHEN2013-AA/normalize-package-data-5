const test = require('node:test')
const assert = require('node:assert')
const normalize = require('../lib/normalize')
const fixer = require('../lib/fixer')

function reset () {
  fixer.clearRegisteredFixers()
}

test('API surface: registerFixer / getRegisteredFixers / clearRegisteredFixers exist', function () {
  assert.strictEqual(typeof normalize.registerFixer, 'function',
    'normalize.registerFixer must be a function')
  assert.strictEqual(typeof normalize.getRegisteredFixers, 'function',
    'normalize.getRegisteredFixers must be a function')
  assert.strictEqual(typeof normalize.clearRegisteredFixers, 'function',
    'normalize.clearRegisteredFixers must be a function')
  assert.strictEqual(typeof fixer.registerFixer, 'function',
    'fixer.registerFixer must be a function')
  reset()
})

test('API surface: existing normalize(data, warn, strict) unchanged', function () {
  reset()
  var data = { name: 'test-pkg', version: '1.0.0' }
  normalize(data)
  assert.strictEqual(data.name, 'test-pkg')
  assert.strictEqual(data.version, '1.0.0')
  assert.strictEqual(data._id, 'test-pkg@1.0.0')
  // no plugins registered -> default behaviour preserved exactly
  assert.strictEqual(normalize.getRegisteredFixers().length, 0)
})

test('registerFixer accepts a function plugin and runs it (post phase default)', function () {
  reset()
  var seen = null
  normalize.registerFixer(function myFnPlugin (ctx) {
    seen = ctx
    ctx.data.pluginWasHere = true
  })

  var data = { name: 'hello', version: '1.0.0' }
  normalize(data)

  assert.strictEqual(data.pluginWasHere, true, 'plugin must be able to mutate data')
  assert.ok(seen && seen.data === data, 'ctx.data must be the data object')
  assert.strictEqual(typeof seen.warn, 'function', 'ctx.warn must be a function')
  assert.strictEqual(seen.strict, false, 'ctx.strict must match the normalize argument')
  assert.ok(seen.fixer, 'ctx.fixer must be exposed')
  reset()
})

test('plugin execution order: pre -> core fixes -> post', function () {
  reset()
  var order = []
  normalize.registerFixer({
    name: 'post1',
    run: function () { order.push('post1') },
  })
  normalize.registerFixer({
    name: 'pre1',
    phase: 'pre',
    run: function () { order.push('pre1') },
  })
  normalize.registerFixer(function post2 (ctx) {
    order.push('post2')
  })
  normalize.registerFixer({
    name: 'pre2',
    phase: 'pre',
    run: function () { order.push('pre2') },
  })

  var data = { name: 'abc', version: '1.0.0' }
  normalize(data)

  // 'pre' plugins run first (in registration order), then 'post' plugins (in registration order)
  assert.deepStrictEqual(order, ['pre1', 'pre2', 'post1', 'post2'],
    'plugins should be executed in registration order within their phase')
  reset()
})

test('plugin mutation order: pre plugin sees raw data before core fixes', function () {
  reset()
  normalize.registerFixer({
    name: 'pre-observer',
    phase: 'pre',
    run: function (ctx) {
      // before core fixes, 'keywords' might still be a string
      ctx.data._sawKeywordsAs = typeof ctx.data.keywords
    },
  })
  normalize.registerFixer({
    name: 'post-observer',
    run: function (ctx) {
      // after core fixes, 'keywords' is an array
      ctx.data._sawKeywordsAsAfter = Array.isArray(ctx.data.keywords) ? 'array' : typeof ctx.data.keywords
    },
  })

  var data = { name: 'abc', version: '1.0.0', keywords: 'a, b, c' }
  normalize(data)

  assert.strictEqual(data._sawKeywordsAs, 'string', 'pre phase sees raw keywords string')
  assert.strictEqual(data._sawKeywordsAsAfter, 'array', 'post phase sees normalized keywords array')
  reset()
})

test('plugin can trigger warn via ctx.warn and via this.warn', function () {
  reset()
  normalize.registerFixer(function ctxWarnPlugin (ctx) {
    ctx.warn('missingReadme') // triggers warn through ctx
  })
  normalize.registerFixer(function thisWarnPlugin () {
    this.warn('missingRepository') // triggers warn through `this` (bound to fixer)
  })

  var warnings = []
  var data = { name: 'warn-test', version: '1.0.0' }
  normalize(data, function (w) { warnings.push(w) })

  assert.ok(warnings.length >= 2, 'at least two warnings should come from the plugins')
  reset()
})

test('plugin exception is caught, does not break normalize, and emits a pluginError warning', function () {
  reset()
  normalize.registerFixer(function good (ctx) {
    ctx.data.ok = true
  })
  normalize.registerFixer(function bad (ctx) {
    throw new Error('plugin failure sample')
  })
  normalize.registerFixer(function okToo (ctx) {
    ctx.data.ok2 = true
  })

  var warnings = []
  var data = { name: 'error-test', version: '1.0.0' }
  // should not throw
  normalize(data, function (w) { warnings.push(w) })

  assert.strictEqual(data.ok, true, 'plugin before error still ran')
  assert.strictEqual(data.ok2, true, 'plugin after error still ran')
  assert.strictEqual(data.name, 'error-test', 'core normalize still ran')
  assert.strictEqual(data._id, 'error-test@1.0.0', '_id still computed')

  var gotPluginError = warnings.some(function (w) {
    return typeof w === 'string' && w.indexOf('pluginError') !== -1
  })
  assert.strictEqual(gotPluginError, true, 'a warning referencing pluginError should be emitted')
  reset()
})

test('plugin object form: { name, run }', function () {
  reset()
  var called = false
  normalize.registerFixer({
    name: 'named-runner',
    run: function (ctx) {
      called = true
      ctx.data.fromNamed = true
    },
  })
  var data = { name: 'a', version: '1.0.0' }
  normalize(data)
  assert.strictEqual(called, true, 'named-runner plugin should be called')
  assert.strictEqual(data.fromNamed, true, 'named-runner plugin should mutate data')
  reset()
})

test('plugin object form: { name, fix*Field }', function () {
  reset()
  normalize.registerFixer({
    name: 'field-style',
    fixExportsField: function (data, strict) {
      if (data.exports && typeof data.exports === 'string') {
        var v = data.exports
        data.exports = { '.': v }
      }
    },
    fixTypeField: function (data, strict) {
      if (!data.type) data.type = 'commonjs'
    },
  })
  var data = { name: 'field-style', version: '1.0.0', exports: './index.js' }
  normalize(data)
  assert.deepStrictEqual(data.exports, { '.': './index.js' }, 'fixExportsField should run')
  assert.strictEqual(data.type, 'commonjs', 'fixTypeField should run')
  reset()
})

test('clearRegisteredFixers removes all plugins', function () {
  reset()
  normalize.registerFixer(function (ctx) { ctx.data.touched = true })
  assert.strictEqual(normalize.getRegisteredFixers().length, 1)

  normalize.clearRegisteredFixers()
  assert.strictEqual(normalize.getRegisteredFixers().length, 0)

  var data = { name: 'x', version: '1.0.0' }
  normalize(data)
  assert.strictEqual(data.touched, undefined, 'plugin should not run after clear')
})

test('registerFixer rejects invalid plugins', function () {
  reset()
  assert.throws(function () { normalize.registerFixer(null) })
  assert.throws(function () { normalize.registerFixer(undefined) })
  assert.throws(function () { normalize.registerFixer(42) })
  assert.throws(function () { normalize.registerFixer('nope') })
  assert.throws(function () { normalize.registerFixer({ name: 'x' }) },
    'object plugin with no run() or fix*() method should throw')
  reset()
})

test('multiple normalize() invocations re-run registered plugins each time', function () {
  reset()
  var count = 0
  normalize.registerFixer(function counter (ctx) { count++ })
  for (var i = 0; i < 5; i++) {
    normalize({ name: 'pkg-' + i, version: '1.0.0' })
  }
  assert.strictEqual(count, 5, 'plugin should run once per normalize() invocation')
  reset()
})

test('backwards compatibility: normalize.fixer.{fixRepositoryField,...} still callable', function () {
  reset()
  var data = { name: 'compat', version: '1.0.0', repository: 'user/repo' }
  fixer.fixRepositoryField(data)
  assert.ok(data.repository && data.repository.url,
    'fixRepositoryField should still be directly callable')
  reset()
})
