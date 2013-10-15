module.exports = createAggregator

var createRecursiveSectionizer = require('cf-sectionizer/recursive-sectionizer')
  , _ = require('lodash')
  , async = require('async')
  , sectionizer = require('cf-sectionizer/sectionizer')
  , createListAggregator = require('./lib/aggregator')

function createAggregator(listService, sectionService, crudService, options) {

  var recursiveSectionizer = createRecursiveSectionizer(sectionService)
    , aggregateList = createListAggregator(crudService, options)

  /*
   * Runs the list aggregator over a number of lists
   */
  function aggregateLists(lists, dedupe, limit, section, cb) {

    // Make sure 'no limit' will work with comparison operators
    if (typeof limit !== 'number') limit = Infinity

    // Normalise the list input, so it's always an array
    if (!Array.isArray(lists)) lists = [ lists ]

    // Don't look up the same list more than once unnecessarily
    lists = _.uniq(lists)

    /*
     * Looks up a list by id, and collects the article content for it
     */
    function aggregateEach(listId, cb) {
      listService.read(listId, function (err, list) {

        if (err) return cb(err)
        if (!list) return cb(null, [])

        recursiveSectionizer(list, section, function(err, sectionizedList) {

          sectionizedList = sectionizer(sectionizedList, section)

          aggregateList(sectionizedList, function (err, listArticles) {
            if (err) return cb(err)
            cb(null, listArticles)
          })

        })

      })
    }

    /*
     * Flatten list aggregations into a 1D array of articles
     * (aggregations is an array of arrays).
     */
    function flattenAggregations(aggregations) {
      var articles = []
      aggregations.forEach(function (result) {
        articles = articles.concat(result)
      })
      return articles
    }

    /*
     * Dedupes and array of articles with or without a deduper provided
     */
    function dedupeResults(articles, cb) {

      // Make sure that each article in the list is unique. Custom items are always unique.
      var i = 0
      articles = _.uniq(articles, function (article) {
        return (article.type === 'custom' || typeof article._id === 'undefined') ? i++ : article._id
      })

      var deduped

      if (dedupe) {
        // If a deduper has been passed, use it
        deduped = []
        articles.forEach(function (article) {
          var isDuplicate = dedupe.has(article._id)
          if (!isDuplicate && deduped.length < limit) {
            deduped.push(article)
          }
        })
      } else {
        // Otherwise just return up to the limit of articles
        deduped = articles.slice(0, isFinite(limit) ? limit : undefined)
      }

      return cb(null, deduped)

    }

    // Lookup each list and concatenate the contents of
    // each, then dedupe the results and callback
    async.map(lists, aggregateEach, function (err, results) {
      if (err) return cb(err)
      dedupeResults(flattenAggregations(results), function (err, articles) {
        if (err) return cb(err)
        cb(null, articles)
      })
    })

  }

  return aggregateLists

}