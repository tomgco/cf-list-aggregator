var _ = require('lodash')
  , save = require('save')
  , crudService = require('crud-service')

function createPublicQuery(query) {
  var now = new Date()
    , publicQuery = _.extend({}, query,
    { state: 'Published'
    , $and:
      [ { $or: [{ liveDate: null }, { liveDate: { $lte: now } }] }
      , { $or: [{ expiryDate: null }, { expiryDate: { $gte: now } } ] }
      ]
    })

  if (query.previewId) {
    publicQuery = query
  }

  return publicQuery
}

module.exports = function() {

  var memgo = require('save-memgo')
    , articleSave = save('article',
      // Create a unique name for the memgo engine so it always starts empty.
      { engine: memgo('article' + Math.floor(Math.random() * 1e6)), debug: true })
    , schema = require('fleet-street/bundles/article/article-schema')([], articleSave)
    , service = crudService('article', articleSave, schema)

  // Find the articles that are available to the public
  service.findPublic = function (query, options, callback) {
    service.find(createPublicQuery(query), options, callback)
  }

  return service
}