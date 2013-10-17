module.exports = createProcessor

var _ = require('lodash')
  , async = require('async')
  , isVisible = require('cf-visibility-check')

function createProcessor(crudService, options) {

  return processResults

  /*
   * Process the results that come back from the system
   * when the list query is run. Some items will not come
   * back because of visibility rules, and if they have been
   * overridden in such a way that means they should be visible,
   * the item needs to be fetched individually.
   */
  function processResults(results, articles, callback) {

    if (!articles) {
      callback(null, results)
    } else {

      var parsedResults = []
        , resultIds = _.pluck(results, '_id')

      async.eachSeries(
        articles
      , function (item, eachCallback) {
          // if not a custom item or an overidden item, just add to the list of results
          if (typeof item.customId === 'undefined') {
            var index = resultIds.indexOf(item.articleId)
            if (index > -1) {
              parsedResults.push(results[index])
            }
            eachCallback(null)
          // if an overridden item, need to check if its live and if so, get all of the other data for this article
          } else if (item.customId === null) {
            // only get extra article data if its actually needed (i.e the article is live)
            if (isVisible(item, options.date)) {
              crudService.read(item.articleId, function (error, article) {
                if (article) {
                  parsedResults.push(article)
                }
                eachCallback(error)
              })
            } else {
              eachCallback(null)
            }
          } else {
            eachCallback(null)
          }
        }
      , function (error) {
          callback(error, parsedResults)
        }
      )
    }
  }
}