module.exports = override

var _ = require('lodash')

/*
 * Takes an article and an object of key/values
 * of which to override the article's own properties.
 * Overrides the properties on, and returns a new object,
 * not the original article.
 */
function override(article, overrides) {
  var o = {}
  Object.keys(overrides).forEach(function (key) {
    if (!article.hasOwnProperty(key)) return
    o[key] = overrides[key]
  })
  return _.extend({}, article, o)
}