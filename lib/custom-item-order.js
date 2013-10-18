module.exports = getCustomItemOrder

var _ = require('lodash')
  , isVisible = require('cf-visibility-check')

/*
 * Determines the index that the custom items
 * should be located at once the existing articles
 * have been retrieved from the system. This is because
 * some articles may not have been retrieved due to having
 * been deleted from the system, or due to visibility rules.
 */
function getCustomItemOrder(results, articles, date) {

  var customListItems = []
    , resultIds = _.pluck(results, '_id')
    , filteredArticles = _.filter(articles, function (item) {
        if (item.articleId === null || resultIds.indexOf(item.articleId) > -1) {
          return item
        }
      })

  articles = filteredArticles

  var i = 0
  articles.forEach(function (item) {
    if (item.type === 'custom') {
      if (!isVisible(item, date)) return
      item.listOrder = i
      customListItems.push(item)
    }
    i++
  })

  return customListItems

}