module.exports = prepare

var applyOverrides = require('./apply-overrides')
  , _ = require('lodash')

/*
 * Applies overrides and minimizes each article
 * in a list.
 */
function prepare(results, overrides) {
  return results.map(function (result) {
    if (overrides && overrides.length) {
      var overrideItem = _.find(overrides, function (listItem) {
        return listItem.articleId === result._id
      })
      if (overrideItem) {
        return applyOverrides(result, overrideItem)
      } else {
        return result
      }
    }
    return result
  })
}