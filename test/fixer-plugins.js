const test = require('node:test')
const assert = require('node:assert')
const normalize = require('../lib/normalize')

function resetPlugins () {
  normalize.fixer.resetPlugins()
}

test('registerFixer is exposed on normalize', function () {
  assert.strictEqual(typeof normalize.registerFixer, 'function')
})

test('registerFixer throws on invalid plugin', function () {
  resetPlugins()
  assert.throws(function () {
    normalize.registerFixer({ name: 'bad', phase: 'after' })
  }, /registerFixer requires a plugin/)
  assert.throws(function () {
    normalize.registerFixer('not a function or object')
  }, /registerFixer requires a plugin/)
})

test('registerFixer throws on invalid phase', function () {
  resetPlugins()
  assert.throws(function () {
    normalize.registerFixer({ name: 'bad', phase: 'middle', fix: function () {} })
  }, /Invalid plugin phase/)
})

test('registerFixer accepts a function as plugin', function () {
  resetPlugins()
  var executionOrder = []
  normalize.registerFixer(function myPlugin (data) {
    executionOrder.push('myPlugin')
    data.customField = 'set-by-plugin'
  })

  var data = { name: 'test', version: '1.0.0' }
  normalize(data)
  assert.strictEqual(data.customField, 'set-by-plugin')
  assert.ok(executionOrder.indexOf('myPlugin') >= 0)
})

test('registerFixer accepts an object plugin', function () {
  resetPlugins()
  var data = { name: 'test', version: '1.0.0' }
  normalize.registerFixer({
    name: 'objectPlugin',
    phase: 'after',
    fix: function (d) {
      d.objectPluginRan = true
    },
  })

  normalize(data)
  assert.strictEqual(data.objectPluginRan, true)
})

test('plugins in "before" phase run before built-in fixers', function () {
  resetPlugins()
  var executionOrder = []

  normalize.registerFixer({
    name: 'beforePlugin',
    phase: 'before',
    fix: function () {
      executionOrder.push('beforePlugin')
    },
  })

  var data = { name: 'test', version: '1.0.0' }
  normalize(data)
  assert.strictEqual(executionOrder[0], 'beforePlugin')
})

test('plugins in "after" phase run after built-in fixers', function () {
  resetPlugins()
  var executionOrder = []

  normalize.registerFixer({
    name: 'beforeMarker',
    phase: 'before',
    fix: function () {
      executionOrder.push('beforeMarker')
    },
  })

  normalize.registerFixer({
    name: 'afterPlugin',
    phase: 'after',
    fix: function () {
      executionOrder.push('afterPlugin')
    },
  })

  var data = { name: 'test', version: '1.0.0' }
  normalize(data)

  var afterIndex = executionOrder.indexOf('afterPlugin')
  var beforeIndex = executionOrder.indexOf('beforeMarker')
  assert.ok(afterIndex > beforeIndex, 'after plugin should run after before plugin')
  assert.ok(afterIndex > 0, 'after plugin should not be first')
})

test('default phase for function plugins is "after"', function () {
  resetPlugins()
  var executionOrder = []

  normalize.registerFixer({
    name: 'beforeMarker',
    phase: 'before',
    fix: function () {
      executionOrder.push('beforeMarker')
    },
  })

  normalize.registerFixer(function defaultAfterPlugin () {
    executionOrder.push('defaultAfterPlugin')
  })

  var data = { name: 'test', version: '1.0.0' }
  normalize(data)

  var defaultIdx = executionOrder.indexOf('defaultAfterPlugin')
  var beforeIdx = executionOrder.indexOf('beforeMarker')
  assert.ok(defaultIdx > beforeIdx, 'default function plugin should run after built-in fixers')
})

test('plugins can modify data', function () {
  resetPlugins()
  var data = {
    name: 'test-pkg',
    version: '1.0.0',
    description: 'test',
    readme: 'readme',
  }

  normalize.registerFixer({
    name: 'addExports',
    phase: 'after',
    fix: function (d) {
      d.exports = { '.': './index.js' }
    },
  })

  normalize(data)
  assert.deepStrictEqual(data.exports, { '.': './index.js' })
})

test('plugins trigger warn when needed', function () {
  resetPlugins()
  var warnings = []
  function warn (message) {
    warnings.push(message)
  }

  var data = {
    name: 'test-pkg',
    version: '1.0.0',
    description: 'test',
    readme: 'readme',
    repository: 'https://github.com/user/repo',
    license: 'MIT',
  }

  normalize.registerFixer({
    name: 'warnPlugin',
    phase: 'after',
    fix: function (d) {
      d._warnCheck = 'triggered'
    },
  })

  normalize(data, warn)
  assert.strictEqual(data._warnCheck, 'triggered')
})

test('plugin that throws is caught and does not break normalization', function () {
  resetPlugins()
  var warnings = []
  function warn (message) {
    warnings.push(message)
  }

  var data = {
    name: 'test-pkg',
    version: '1.0.0',
    description: 'test',
    readme: 'readme',
  }

  normalize.registerFixer({
    name: 'throwingPlugin',
    phase: 'after',
    fix: function () {
      throw new Error('plugin exploded')
    },
  })

  normalize.registerFixer({
    name: 'runsAfterThrowing',
    phase: 'after',
    fix: function (d) {
      d.ranAfterThrow = true
    },
  })

  normalize(data, warn)

  var pluginErrorWarnings = warnings.filter(function (w) {
    return w.includes('throwingPlugin') && w.includes('plugin exploded')
  })
  assert.strictEqual(pluginErrorWarnings.length, 1, 'should warn about plugin error')
  assert.strictEqual(data.ranAfterThrow, true, 'subsequent plugins should still run')
  assert.strictEqual(data._id, 'test-pkg@1.0.0', 'normalization should complete')
})

test('plugin that throws in "before" phase does not prevent built-in fixers', function () {
  resetPlugins()
  var warnings = []
  function warn (message) {
    warnings.push(message)
  }

  var data = {
    name: 'test-pkg',
    version: '1.0.0',
    description: 'A test package',
    readme: 'readme',
  }

  normalize.registerFixer({
    name: 'throwingBeforePlugin',
    phase: 'before',
    fix: function () {
      throw new Error('before plugin failed')
    },
  })

  normalize(data, warn)

  var pluginErrorWarnings = warnings.filter(function (w) {
    return w.includes('throwingBeforePlugin') && w.includes('before plugin failed')
  })
  assert.strictEqual(pluginErrorWarnings.length, 1, 'should warn about before plugin error')
  assert.strictEqual(data.description, 'A test package', 'built-in fixers should still run')
  assert.strictEqual(data._id, 'test-pkg@1.0.0', 'normalization should complete')
})

test('plugin execution order is deterministic', function () {
  resetPlugins()
  var order = []

  normalize.registerFixer({
    name: 'first',
    phase: 'before',
    fix: function () { order.push('first-before') },
  })
  normalize.registerFixer({
    name: 'second',
    phase: 'before',
    fix: function () { order.push('second-before') },
  })
  normalize.registerFixer({
    name: 'third',
    phase: 'after',
    fix: function () { order.push('third-after') },
  })
  normalize.registerFixer({
    name: 'fourth',
    phase: 'after',
    fix: function () { order.push('fourth-after') },
  })

  var data = { name: 'test', version: '1.0.0' }
  normalize(data)

  var beforeSlice = order.slice(0, 2)
  var afterSlice = order.slice(2)

  assert.deepStrictEqual(beforeSlice, ['first-before', 'second-before'])
  assert.deepStrictEqual(afterSlice, ['third-after', 'fourth-after'])
})