const test = require('node:test')
const assert = require('node:assert')

const normalize = require('../')

test('plugin execution order and data modification', function () {
  normalize.clearFixers()
  const data = { name: 'test', version: '1.0.0' }
  const executionOrder = []
  
  normalize.registerFixer(function (d) {
    executionOrder.push('plugin1')
    d.plugin1 = true
  })

  normalize.registerFixer(function (d) {
    executionOrder.push('plugin2')
    d.plugin2 = true
  })

  normalize(data)

  assert.deepStrictEqual(executionOrder, ['plugin1', 'plugin2'])
  assert.strictEqual(data.plugin1, true)
  assert.strictEqual(data.plugin2, true)
})

test('plugin triggers warn', function () {
  normalize.clearFixers()
  const data = { name: 'test', version: '1.0.0' }
  let warned = false

  normalize.registerFixer(function (d) {
    this.warn('pluginWarning')
  })

  normalize(data, function (msg) {
    if (msg.includes('pluginWarning')) {
      warned = true
    }
  })

  assert.strictEqual(warned, true)
})

test('plugin exception handling', function () {
  normalize.clearFixers()
  const data = { name: 'test', version: '1.0.0' }

  normalize.registerFixer(function (d) {
    throw new Error('plugin error')
  })

  let threw = false
  try {
    normalize(data)
  } catch (err) {
    threw = true
    assert.strictEqual(err.message, 'plugin error')
  }

  assert.strictEqual(threw, true)
})
