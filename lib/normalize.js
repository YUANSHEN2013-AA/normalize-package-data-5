module.exports = normalize

var fixer = require('./fixer')
normalize.fixer = fixer

var makeWarning = require('./make_warning')

var fieldsToFix = ['name', 'version', 'description', 'repository', 'modules', 'scripts',
  'files', 'bin', 'man', 'bugs', 'keywords', 'readme', 'homepage', 'license']
var otherThingsToFix = ['dependencies', 'people', 'typos']

var thingsToFix = fieldsToFix.map(function (fieldName) {
  return ucFirst(fieldName) + 'Field'
})
// two ways to do this in CoffeeScript on only one line, sub-70 chars:
// thingsToFix = fieldsToFix.map (name) -> ucFirst(name) + "Field"
// thingsToFix = (ucFirst(name) + "Field" for name in fieldsToFix)
thingsToFix = thingsToFix.concat(otherThingsToFix)

var pluginFixers = []

normalize.registerFixer = function (plugin) {
  if (typeof plugin === 'function') {
    plugin = { name: null, fix: plugin }
  }
  if (!plugin || typeof plugin.fix !== 'function') {
    throw new TypeError('Plugin must provide a fix function')
  }
  pluginFixers.push(plugin)
}

normalize.clearFixers = function () {
  pluginFixers.length = 0
}

normalize.getFixers = function () {
  return pluginFixers.slice()
}

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
  thingsToFix.forEach(function (thingName) {
    fixer['fix' + ucFirst(thingName)](data, strict)
  })
  pluginFixers.forEach(function (plugin) {
    try {
      plugin.fix(data, strict, fixer.warn)
    } catch (err) {
      fixer.warn('pluginError', plugin.name, err.message)
    }
  })
  data._id = data.name + '@' + data.version
}

function ucFirst (string) {
  return string.charAt(0).toUpperCase() + string.slice(1)
}
