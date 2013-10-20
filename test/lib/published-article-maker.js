module.exports = publishedArticleMaker

var _ = require('lodash')
  , articleFixtures = require('fleet-street/test/article/fixtures')
  , async = require('async')

module.exports.createArticles = function (i, articleService, articles, custom) {
  return function (cb) {
    return async.times(i, publishedArticleMaker(articleService, articles, custom), cb)
  }
}

function publishedArticleMaker(articleService, articles, custom) {
  var slugUniquer = 1

  return function (n, cb) {
    if (!cb) cb = n

    var model = _.extend({}, articleFixtures.validNewPublishedModel, custom)

    // Make slug unique to stop validation errors (slug and section unique)
    model.slug += slugUniquer
    slugUniquer++

    articleService.create(model, function (err, result) {
      if (err) return cb(err)
      articles.push(_.extend({}, { articleId: result._id }, custom))
      cb()
    })
  }
}
