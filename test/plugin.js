const test = require('node:test')
const assert = require('node:assert')
const normalize = require('../lib/normalize')
const warningMessages = require('../lib/warning_messages.json')

test('plugin execution order follows registration order', function () {
  normalize.clearFixers()
  var order = []
  normalize.registerFixer({
    name: 'first',
    fix: function () { order.push('first') },
  })
  normalize.registerFixer({
    name: 'second',
    fix: function () { order.push('second') },
  })
  normalize.registerFixer({
    name: 'third',
    fix: function () { order.push('third') },
  })

  normalize({ name: 'test-pkg', version: '1.0.0' })
  assert.deepStrictEqual(order, ['first', 'second', 'third'])
  normalize.clearFixers()
})

test('plugin runs after all built-in fixers', function () {
  normalize.clearFixers()
  var pluginCalled = false
  var dataAfterBuiltin = null

  normalize.registerFixer({
    name: 'observer',
    fix: function (data) {
      pluginCalled = true
      dataAfterBuiltin = JSON.parse(JSON.stringify(data))
    },
  })

  var data = {
    name: 'test-pkg',
    version: '1.0.0',
    keywords: 'tag1, tag2',
    man: './doc.1',
  }
  normalize(data)

  assert.ok(pluginCalled, 'plugin was called')
  assert.ok(Array.isArray(dataAfterBuiltin.keywords), 'built-in fixKeywordsField ran before plugin')
  assert.deepStrictEqual(dataAfterBuiltin.keywords, ['tag1', 'tag2'])
  assert.ok(Array.isArray(dataAfterBuiltin.man), 'built-in fixManField ran before plugin')
  normalize.clearFixers()
})

test('plugin can modify data', function () {
  normalize.clearFixers()
  normalize.registerFixer({
    name: 'addCustomField',
    fix: function (data) {
      data.customField = 'added-by-plugin'
    },
  })

  var data = { name: 'test-pkg', version: '1.0.0' }
  normalize(data)
  assert.strictEqual(data.customField, 'added-by-plugin')
  normalize.clearFixers()
})

test('plugin can modify data that affects _id', function () {
  normalize.clearFixers()
  normalize.registerFixer({
    name: 'renamePackage',
    fix: function (data) {
      data.name = 'renamed-pkg'
    },
  })

  var data = { name: 'original-pkg', version: '1.0.0' }
  normalize(data)
  assert.strictEqual(data.name, 'renamed-pkg')
  assert.strictEqual(data._id, 'renamed-pkg@1.0.0')
  normalize.clearFixers()
})

test('plugin can trigger warnings via warn function', function () {
  normalize.clearFixers()
  normalize.registerFixer({
    name: 'warningPlugin',
    fix: function (data, strict, warn) {
      warn('missingLicense')
    },
  })

  var warnings = []
  normalize({ name: 'test-pkg', version: '1.0.0' }, function (w) {
    warnings.push(w)
  })
  assert.ok(
    warnings.some(function (w) { return w === warningMessages.missingLicense }),
    'plugin warning was emitted'
  )
  normalize.clearFixers()
})

test('plugin can trigger custom warnings', function () {
  normalize.clearFixers()
  normalize.registerFixer({
    name: 'customWarnPlugin',
    fix: function (data, strict, warn) {
      warn('customWarning', 'someDetail')
    },
  })

  var warnings = []
  normalize({ name: 'test-pkg', version: '1.0.0' }, function (w) {
    warnings.push(w)
  })
  assert.ok(
    warnings.some(function (w) { return w.includes('customWarning') && w.includes('someDetail') }),
    'custom plugin warning was emitted via fallback format'
  )
  normalize.clearFixers()
})

test('plugin error does not crash normalization', function () {
  normalize.clearFixers()
  normalize.registerFixer({
    name: 'brokenPlugin',
    fix: function () {
      throw new Error('something went wrong')
    },
  })

  var warnings = []
  var data = { name: 'test-pkg', version: '1.0.0' }
  assert.doesNotThrow(function () {
    normalize(data, function (w) {
      warnings.push(w)
    })
  })
  assert.strictEqual(data._id, 'test-pkg@1.0.0', 'normalization completed despite plugin error')
  assert.ok(
    warnings.some(function (w) {
      return w.includes('brokenPlugin') && w.includes('something went wrong')
    }),
    'plugin error was reported as a warning'
  )
  normalize.clearFixers()
})

test('plugin error uses null name when plugin has no name', function () {
  normalize.clearFixers()
  normalize.registerFixer(function () {
    throw new Error('anonymous fail')
  })

  var warnings = []
  normalize({ name: 'test-pkg', version: '1.0.0' }, function (w) {
    warnings.push(w)
  })
  assert.ok(
    warnings.some(function (w) { return w.includes('null') && w.includes('anonymous fail') }),
    'anonymous plugin error reported with null name'
  )
  normalize.clearFixers()
})

test('plugin error does not prevent subsequent plugins from running', function () {
  normalize.clearFixers()
  var secondCalled = false

  normalize.registerFixer({
    name: 'first',
    fix: function () { throw new Error('fail') },
  })
  normalize.registerFixer({
    name: 'second',
    fix: function () { secondCalled = true },
  })

  normalize({ name: 'test-pkg', version: '1.0.0' })
  assert.ok(secondCalled, 'second plugin still ran after first plugin error')
  normalize.clearFixers()
})

test('registerFixer accepts a plain function as shorthand', function () {
  normalize.clearFixers()
  var called = false
  normalize.registerFixer(function (data) {
    called = true
    data.shorthandField = true
  })

  var data = { name: 'test-pkg', version: '1.0.0' }
  normalize(data)
  assert.ok(called, 'shorthand plugin was called')
  assert.strictEqual(data.shorthandField, true)
  normalize.clearFixers()
})

test('registerFixer throws if plugin has no fix function', function () {
  assert.throws(function () {
    normalize.registerFixer({ name: 'bad' })
  }, /must provide a fix function/)
})

test('registerFixer throws if plugin is not a function or object', function () {
  assert.throws(function () {
    normalize.registerFixer('not a plugin')
  }, /must provide a fix function/)
})

test('clearFixers removes all registered plugins', function () {
  normalize.clearFixers()
  normalize.registerFixer({ name: 'a', fix: function () {} })
  normalize.registerFixer({ name: 'b', fix: function () {} })
  assert.strictEqual(normalize.getFixers().length, 2)

  normalize.clearFixers()
  assert.strictEqual(normalize.getFixers().length, 0)
})

test('getFixers returns a copy of the plugin list', function () {
  normalize.clearFixers()
  normalize.registerFixer({ name: 'a', fix: function () {} })
  var copy = normalize.getFixers()
  copy.push({ name: 'injected', fix: function () {} })
  assert.strictEqual(normalize.getFixers().length, 1, 'original list not mutated')
  normalize.clearFixers()
})

test('plugin receives strict flag', function () {
  normalize.clearFixers()
  var receivedStrict = null
  normalize.registerFixer({
    name: 'strictObserver',
    fix: function (data, strict) {
      receivedStrict = strict
    },
  })

  normalize({ name: 'test-pkg', version: '1.0.0' }, null, true)
  assert.strictEqual(receivedStrict, true)

  normalize({ name: 'test-pkg', version: '1.0.0' }, null, false)
  assert.strictEqual(receivedStrict, false)

  normalize.clearFixers()
})

test('plugin receives data after built-in normalization', function () {
  normalize.clearFixers()
  normalize.registerFixer({
    name: 'dataObserver',
    fix: function (data) {
      data.hasReadme = !!data.readme
    },
  })

  var data = { name: 'test-pkg', version: '1.0.0' }
  normalize(data)
  assert.strictEqual(data.hasReadme, true, 'plugin saw data after fixReadmeField')
  normalize.clearFixers()
})

test('multiple plugins can chain data modifications', function () {
  normalize.clearFixers()
  normalize.registerFixer({
    name: 'step1',
    fix: function (data) {
      data.steps = data.steps || []
      data.steps.push('step1')
    },
  })
  normalize.registerFixer({
    name: 'step2',
    fix: function (data) {
      data.steps.push('step2')
    },
  })

  var data = { name: 'test-pkg', version: '1.0.0' }
  normalize(data)
  assert.deepStrictEqual(data.steps, ['step1', 'step2'])
  normalize.clearFixers()
})
