module.exports = normalize

var fixer = require('./fixer')
normalize.fixer = fixer

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
    warn = function () {}
  }

  if (data.scripts &&
      data.scripts.install === 'node-gyp rebuild' &&
      !data.scripts.preinstall) {
    data.gypfile = true
  }
  fixer.warn = function () {
    warn(makeWarning.apply(null, arguments))
  }
  fixer.run(data, strict)
  data._id = data.name + '@' + data.version
}
