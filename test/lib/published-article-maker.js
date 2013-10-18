var _ = require('lodash')
  , articleFixtures = require('fleet-street/test/article/fixtures')

module.exports = function publishedArticleMaker(articleService, articles, custom) {
  var slugUniquer = 1

  return function (cb) {
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
