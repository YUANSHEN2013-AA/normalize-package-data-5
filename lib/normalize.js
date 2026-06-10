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

function normalize (data, warn, strict) {
  if (warn === true) {
    warn = null
    strict = true
  }
  var warnEvenIfPrivate = []
  if (strict && typeof strict === 'object' && !Array.isArray(strict)) {
    warnEvenIfPrivate = Array.isArray(strict.warnEvenIfPrivate)
      ? strict.warnEvenIfPrivate
      : (strict.warnEvenIfPrivate ? [strict.warnEvenIfPrivate] : [])
    strict = strict.strict === true
  }
  if (!strict) {
    strict = false
  }
  if (!warn) {
    warn = function () { /* noop */ }
  }

  if (data.scripts &&
      data.scripts.install === 'node-gyp rebuild' &&
      !data.scripts.preinstall) {
    data.gypfile = true
  }
  if (data.private && warnEvenIfPrivate.length === 0) {
    fixer.warn = function () { /* noop */ }
  } else if (data.private) {
    var alwaysWarnSet = {}
    for (var i = 0; i < warnEvenIfPrivate.length; i++) {
      alwaysWarnSet[warnEvenIfPrivate[i]] = true
    }
    fixer.warn = function () {
      var warningName = arguments[0]
      if (alwaysWarnSet[warningName]) {
        warn(makeWarning.apply(null, arguments))
      }
    }
  } else {
    fixer.warn = function () {
      warn(makeWarning.apply(null, arguments))
    }
  }
  thingsToFix.forEach(function (thingName) {
    fixer['fix' + ucFirst(thingName)](data, strict)
  })
  data._id = data.name + '@' + data.version
}

function ucFirst (string) {
  return string.charAt(0).toUpperCase() + string.slice(1)
}
