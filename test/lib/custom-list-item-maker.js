var _ = require('lodash')
  , articleFixtures = require('fleet-street/test/article/fixtures')

module.exports = function customListItemMaker(articles, custom) {
  return function (cb) {
    var model = _.extend({}, articleFixtures.validNewPublishedModel, custom)
    model.articleId = null
    articles.push(model)
    cb(null)
  }
}
