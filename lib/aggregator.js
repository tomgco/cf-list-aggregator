module.exports = createAggregator

var prepareResults = require('./prepare-results')
  , prepareAutoQuery = require('./prepare-auto-query')
  , prepareManualQuery = require('./prepare-manual-query')
  , createResultsProcessor = require('./results-processor')
  , getCustomItemOrder = require('./custom-item-order')
  , defaultFields = require('./default-fields')
  , _ = require('lodash')

function createAggregator(crudService, options) {

  var processResults = createResultsProcessor(crudService, options)

  /*
   * Aggregates a single list
   */
  function aggregateList(list, cb) {

    var overrides = null
      , q

    if (list.type === 'manual') {

      q = prepareManualQuery(list, crudService.idType)
      overrides = q.overrides

    } else if (list.type === 'auto') {

      q = prepareAutoQuery(list)

    } else {
      return cb(new Error('Unsupported list type "' + list.type + '"'))
    }

    // Set the query limit
    q.options.limit = list.limit

    if (options.date) {
      q.options.date = options.date
    }

    if (options.fields) {
      q.options.fields = options.fields
    } else {
      q.options.fields = defaultFields
    }

    crudService.findPublic(q.query, q.options, function (err, unprocessedResults) {

      if (err) return cb(err)

      processResults(unprocessedResults, list.articles, function (error, results) {

        if (error) return cb(error)

        if (list.type !== 'manual') {

          return cb(null, prepareResults(results, overrides))

        } else {

          // Give the custom list items an order based on
          // the items that were retrieved from the system
          var customListItems = getCustomItemOrder(results, list.articles, options.date)

          // Create an array to mix in the found items with the custom items
          var newResults = []
            // Don't go any higher than list.limit, otherwise there wont' be enough
            , length = Math.min(results.length + customListItems.length, list.limit)

          for (var i = 0; i < length; i++) {
            var custom = _.find(customListItems, findItemWithOrder(i))
            // If there is a custom item that wants index i, use it otherwise
            // shift the next item off the front of the results array
            newResults[i] = custom ? custom : results.shift()
          }

          return cb(null, prepareResults(newResults, overrides))

        }

      })
    })
  }

  return aggregateList

}

function findItemWithOrder(i) {
  return function(item) {
    return item.listOrder === i ? true : false
  }
}