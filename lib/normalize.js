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

function normalize (data, warn, strict, warnEvenIfPrivate) {
  var warningFn = warn
  var isStrict = strict
  var privateWarnings = warnEvenIfPrivate

  if (typeof warningFn === 'boolean') {
    isStrict = warningFn
    if (typeof strict === 'function') {
      warningFn = strict
    } else {
      warningFn = null
      privateWarnings = strict
    }
  } else if (typeof strict !== 'boolean' && typeof strict !== 'undefined') {
    isStrict = false
    privateWarnings = strict
  }

  if (!isStrict) {
    isStrict = false
  }
  if (!warningFn) {
    warningFn = function () {}
  }
  if (!privateWarnings) {
    privateWarnings = []
  } else if (!Array.isArray(privateWarnings)) {
    privateWarnings = [privateWarnings]
  }

  if (data.scripts &&
      data.scripts.install === 'node-gyp rebuild' &&
      !data.scripts.preinstall) {
    data.gypfile = true
  }
  fixer.warn = function () {
    if (data.private && privateWarnings.indexOf(arguments[0]) === -1) {
      return
    }
    warningFn(makeWarning.apply(null, arguments))
  }
  thingsToFix.forEach(function (thingName) {
    fixer['fix' + ucFirst(thingName)](data, isStrict)
  })
  data._id = data.name + '@' + data.version
}

function ucFirst (string) {
  return string.charAt(0).toUpperCase() + string.slice(1)
}
