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

// Plugin API
normalize.registerFixer = function (plugin) {
  return fixer.registerFixer(plugin)
}
normalize.getRegisteredFixers = function () {
  return fixer.getRegisteredFixers()
}
normalize.clearRegisteredFixers = function () {
  return fixer.clearRegisteredFixers()
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

  var ctx = { data: data, strict: strict, warn: fixer.warn, fixer: fixer }

  // pre-phase plugins (run before core normalizations)
  runPhase(fixer.getRegisteredFixers(), 'pre', ctx)

  thingsToFix.forEach(function (thingName) {
    fixer['fix' + ucFirst(thingName)](data, strict)
  })

  // post-phase plugins (run after core normalizations, default)
  runPhase(fixer.getRegisteredFixers(), 'post', ctx)

  data._id = data.name + '@' + data.version
}

function runPhase (plugins, phase, ctx) {
  for (var i = 0; i < plugins.length; i++) {
    var plugin = plugins[i]
    if (plugin.phase !== phase) continue
    try {
      plugin.run.call(ctx.fixer, ctx)
    } catch (err) {
      var name = plugin.name || ('plugin#' + i)
      ctx.warn('pluginError', name, err && err.message ? err.message : String(err))
    }
  }
}

function ucFirst (string) {
  return string.charAt(0).toUpperCase() + string.slice(1)
}
