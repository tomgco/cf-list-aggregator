var articleFixtures = require('fleet-street/test/article/fixtures')

module.exports = function draftArticleMaker(articleService) {
  return function (cb) {
    articleService.create(articleFixtures.validNewModel, cb)
  }
}
