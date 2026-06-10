module.exports = normalize

var fixer = require('./fixer')
normalize.fixer = fixer
normalize.registerFixer = fixer.registerFixer

var makeWarning = require('./make_warning')

function normalize (data, warn, strict) {
  if (warn === true) {
    warn = null
    strict = true
  }
  if (!strict) {
    strict = false
  }
  if (!warn || data.private) {
    warn = function () { /* noop */ }
  }

  if (data.scripts &&
      data.scripts.install === 'node-gyp rebuild' &&
      !data.scripts.preinstall) {
    data.gypfile = true
  }
  fixer.warn = function () {
    warn(makeWarning.apply(null, arguments))
  }

  fixer.runPlugins('before', data, strict)

  var fixerMethods = fixer.getFixerMethodNames()
  for (var i = 0; i < fixerMethods.length; i++) {
    fixer[fixerMethods[i]](data, strict)
  }

  fixer.runPlugins('after', data, strict)

  data._id = data.name + '@' + data.version
}
