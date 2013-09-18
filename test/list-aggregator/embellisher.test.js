var createEmbellisher = require('../../../lib/list-aggregator/embellisher')
  , articleFixtures = require('../../article/fixtures')
  , _ = require('lodash')
  , imageFixtures = require('../../lib/fixtures/crop-config')
  , serviceLocator = { properties: {} }

serviceLocator.properties.images =
  { article: imageFixtures.standard
  }

serviceLocator.properties.darkroomApiUrl = 'darkroomApiUrlStub'
serviceLocator.properties.darkroomSalt = 'darkroomSaltStub'

describe('embellishArticles()', function () {

  it('should embellish a single article with image url building functions', function () {

    var article = _.extend({}, articleFixtures.validNewPublishedModel)
      , embellishArticles = createEmbellisher(serviceLocator)
    embellishArticles([ article ])
    article.images.should.have.property('getImage')

  })

})