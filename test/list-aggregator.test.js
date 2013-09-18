var serviceLocator = require('service-locator').createServiceLocator()
  , createAggregator = require('../../lib/list-aggregator')
  , articleFixtures = require('../article/fixtures')
  , async = require('async')
  , should = require('should')
  , _ = require('lodash')
  , eql = require('../../lib/sequential-object-eql')
  , uberCache = require('uber-cache')
  , createDedupe = require('doorman')
  , imageFixtures = require('../lib/fixtures/crop-config')
  , slugUniquer = 1
  , moment = require('moment')

// Initialize the mongo database
before(function (done) {

  require('../mongodb-bootstrap')(serviceLocator, function (error, sl) {
    serviceLocator = sl

    serviceLocator.persistence
      .register('article')
      .register('tag')
      .register('section')

    serviceLocator.properties.images =
      { article: imageFixtures.standard
      }

    serviceLocator.properties.darkroomApiUrl = 'darkroomApiUrlStub'
    serviceLocator.properties.darkroomSalt = 'darkroomSaltStub'

    serviceLocator
      .register('articleService', require('../../bundles/article/service')(serviceLocator))
      .register('tagService', require('../../bundles/tag/service')(serviceLocator))
      .register('sectionService', require('../../bundles/section/service')(serviceLocator))
      .register('cache', uberCache())

    var lists = {}
      ,  id = 0
    serviceLocator.register('listService',
      { read: function (id, cb) {
          cb(null, lists[id])
        }
      , create: function (list, cb) {
          var _id = '_' + id++
          lists[_id] = list
          cb(null, _.extend({ _id: _id }, list))
        }
      })

    done()
  })

})

after(function (done) {
  serviceLocator.serviceDatabaseConnection.dropDatabase(done)
})


function publishedArticleMaker(articles, custom) {
  return function (cb) {
    var model = _.extend({}, articleFixtures.validNewPublishedModel, custom)

    // Make slug unique to stop validation errors (slug and section unique)
    model.slug += slugUniquer
    slugUniquer++

    serviceLocator.articleService.create(model, function (err, result) {
      if (err) return cb(err)
      articles.push(_.extend({}, { articleId: result._id }, custom))
      cb(null)
    })
  }
}

function customListItemMaker(articles, custom) {
  return function (cb) {
    var model = _.extend({}, articleFixtures.validNewPublishedModel, custom)
    model.articleId = null
    articles.push(model)
    cb(null)
  }
}

function draftArticleMaker() {
  return function (cb) {
    serviceLocator.articleService.create(articleFixtures.validNewModel, function (err) {
      if (err) return cb(err)
      cb(null)
    })
  }
}

describe('List Aggregator', function () {

  describe('createAggregator()', function () {

    it('should be a function and return a function', function () {
      createAggregator.should.be.a('function')
      createAggregator(serviceLocator).should.be.a('function')
    })

  })

  describe('aggregate()', function () {

    beforeEach(function (done) {
      serviceLocator.articleService.deleteMany({}, done)
    })

    it('should not error when an object that isn\'t a list is passed', function (done) {
      createAggregator(serviceLocator)({}, null, null, function (err, results) {
        results.should.have.length(0)
        done()
      })
    })

    describe('(for a manual list)', function () {

      it('should return a list with custom list items', function (done) {
        var articles = []
          , listId

        async.series(
          [ customListItemMaker(articles, { 'longTitle': 'Bob', 'type': 'custom' })
          , customListItemMaker(articles, { 'shortTitle': 'Alice', 'type': 'custom' })
          , customListItemMaker(articles, { 'type': 'custom' })
          , customListItemMaker([])
          , customListItemMaker(articles, { 'type': 'custom' })
          , customListItemMaker([])
          , customListItemMaker(articles, { 'type': 'custom' })
          , function (cb) {
              serviceLocator.listService.create(
                { type: 'manual'
                , name: 'test list'
                , articles: articles
                , limit: 100
                }
              , function (err, res) {
                  listId = res._id
                  cb(null)
                })
            }
          ], function (err) {
            if (err) throw err

            var aggregate = createAggregator(serviceLocator)

            aggregate(listId, null, null, function (err, results) {
              should.not.exist(err)
              results.should.have.length(5)
              results.forEach(function (result, i) {
                if (i === 0) {
                  result.longTitle.should.eql('Bob')
                } else if (i === 1) {
                  result.shortTitle.should.eql('Alice')
                }
              })
              done()
            })

          })
      })

      it('should return a list with custom list items', function (done) {
        var articles = []
          , listId

        async.series(
          [ customListItemMaker(articles, { 'longTitle': 'Bob', 'type': 'custom' })
          , customListItemMaker(articles, { 'shortTitle': 'Alice', 'type': 'custom' })
          , customListItemMaker(articles, { 'type': 'custom' })
          , publishedArticleMaker(articles)
          , customListItemMaker(articles, { 'type': 'custom' })
          , publishedArticleMaker(articles)
          , customListItemMaker(articles, { 'type': 'custom' })
          , function (cb) {
              serviceLocator.listService.create(
                { type: 'manual'
                , name: 'test list'
                , articles: articles
                , limit: 100
                }
              , function (err, res) {
                  listId = res._id
                  cb(null)
                })
            }
          ], function (err) {
            if (err) throw err

            var aggregate = createAggregator(serviceLocator)

            aggregate(listId, null, null, function (err, results) {
              should.not.exist(err)
              results.should.have.length(7)
              results.forEach(function (result, i) {
                if (i === 0) {
                  result.longTitle.should.eql('Bob')
                } else if (i === 1) {
                  result.shortTitle.should.eql('Alice')
                }
              })
              done()
            })

          })
      })

      it('should return only the list of full articles specified by ids', function (done) {

        var articles = []
          , listId

        async.series(
          [ publishedArticleMaker(articles)
          , publishedArticleMaker(articles)
          , publishedArticleMaker(articles)
          , publishedArticleMaker([])
          , publishedArticleMaker(articles)
          , publishedArticleMaker([])
          , publishedArticleMaker(articles)
          , function (cb) {
              serviceLocator.listService.create(
                  { type: 'manual'
                  , name: 'test list'
                  , articles: articles
                  , limit: 100
                  }
                , function (err, res) {
                    listId = res._id
                    cb(null)
                  })
            }
          ], function (err) {
            if (err) throw err

            var aggregate = createAggregator(serviceLocator)

            aggregate(listId, null, null, function (err, results) {
              should.not.exist(err)
              results.should.have.length(5)
              results.forEach(function (result, i) {
                eql(_.extend({}, articleFixtures.minimalNewPublishedModel, { _id: articles[i].articleId }), result,
                  false, true)
              })
              done()
            })

          })
      })

      it('should only return published articles', function (done) {

        var articles = []
          , listId

        async.series(
          [ publishedArticleMaker(articles)
          , publishedArticleMaker(articles)
          , draftArticleMaker()
          , draftArticleMaker()
          , publishedArticleMaker(articles)
          , draftArticleMaker()
          , function (cb) {
              serviceLocator.listService.create(
                  { type: 'manual'
                  , name: 'test list'
                  , articles: articles
                  , limit: 100
                  }
                , function (err, res) {
                    listId = res._id
                    cb(null)
                  })
            }
          ], function (err) {
            if (err) throw err

            var aggregate = createAggregator(serviceLocator)

            aggregate(listId, null, null, function (err, results) {
              should.not.exist(err)
              results.should.have.length(3)
              results.forEach(function (result, i) {
                eql(_.extend({}, articleFixtures.minimalNewPublishedModel, { _id: articles[i].articleId }), result,
                  false, true)
              })
              done()
            })

          })

      })

      it('should limit the number of articles', function (done) {

        var articles = []
          , listId

        async.series(
          [ publishedArticleMaker(articles)
          , publishedArticleMaker(articles)
          , draftArticleMaker()
          , draftArticleMaker()
          , publishedArticleMaker(articles)
          , draftArticleMaker()
          , function (cb) {
              serviceLocator.listService.create(
                  { type: 'manual'
                  , name: 'test list'
                  , articles: articles
                  , limit: 2
                  }
                , function (err, res) {
                    listId = res._id
                    cb(null)
                  })
            }
          ], function (err) {
            if (err) throw err

            var aggregate = createAggregator(serviceLocator)

            aggregate(listId, null, null, function (err, results) {
              should.not.exist(err)
              results.should.have.length(2)
              results.forEach(function (result, i) {
                eql(_.extend({}, articleFixtures.minimalNewPublishedModel, { _id: articles[i].articleId }),
                  result, false, true)
              })
              done()
            })

          })

      })

      it('should override given article properties', function (done) {

        var articles = []
          , overrides =
            [ { longTitle: 'Override #1' }
            , { shortTitle: 'Special short title', displayDate: new Date() }
            , {}
            ]
          , listId

        async.series(
          [ publishedArticleMaker(articles)
          , publishedArticleMaker(articles)
          , draftArticleMaker()
          , draftArticleMaker()
          , publishedArticleMaker(articles)
          , draftArticleMaker()
          , function (cb) {
              serviceLocator.listService.create(
                { type: 'manual'
                , name: 'test list'
                , articles: articles.map(function (article, i) {
                    return _.extend({}, article, overrides[i])
                  })
                , limit: 100
                }
                , function (err, res) {
                    listId = res._id
                    cb(null)
                  })
            }
          ], function (err) {
            if (err) throw err

            var aggregate = createAggregator(serviceLocator)

            articles = articles.map(function (article, i) {
              article._id = article.articleId
            ; delete article._id
              return _.extend({}, article, overrides[i])
            })

            aggregate(listId, null, null, function (err, results) {
              should.not.exist(err)
              results.should.have.length(3)
              results.forEach(function (result, i) {
                eql(_.extend({}, articleFixtures.minimalNewPublishedModel, articles[i]), result, false, true)
              })
              done()
            })

          })

      })

      it('should override the live and expiry date of a non live article', function (done) {

        var articles = []
          , oneWeekAhead = moment().add('week', 1)
          , twoWeeksAhead = moment().add('week', 2)
          , oneWeekAgo = moment().subtract('week', 1)
          , overrides =
             [ { liveDate: oneWeekAgo, expiryDate: oneWeekAhead, customId: null }
             ]
          , listId

        async.series
        (
          [ publishedArticleMaker(articles, {liveDate: oneWeekAhead, expiryDate: twoWeeksAhead })
          , publishedArticleMaker(articles)
          , publishedArticleMaker(articles)
          , function (cb) {
              serviceLocator.listService.create
              (
                { type: 'manual'
                , name: 'test list'
                , articles: articles.map(function (article, i) {
                    return _.extend({}, article, overrides[i])
                  })
                , limit: 100
                }
              , function (err, res) {
                  listId = res._id
                  cb(null)
                }
              )
            }
          ]
        , function (err) {
            if (err) throw err
            var aggregate = createAggregator(serviceLocator)
            aggregate(listId, null, null, function (err, results) {
              results.length.should.equal(3)
              done()
            })
          }
        )
      })

      it('should override the live and expiry date of a live article', function (done) {

        var articles = []
          , oneWeekAhead = moment().add('week', 1)
          , twoWeeksAhead = moment().add('week', 2)
          , overrides =
             [ { liveDate: oneWeekAhead, expiryDate: twoWeeksAhead, customId: null }
             ]
          , listId

        async.series
        (
          [ publishedArticleMaker(articles)
          , publishedArticleMaker(articles)
          , publishedArticleMaker(articles)
          , function (cb) {
              serviceLocator.listService.create
              (
                { type: 'manual'
                , name: 'test list'
                , articles: articles.map(function (article, i) {
                    return _.extend({}, article, overrides[i])
                  })
                , limit: 100
                }
              , function (err, res) {
                  listId = res._id
                  cb(null)
                }
              )
            }
          ]
        , function (err) {
            if (err) throw err
            var aggregate = createAggregator(serviceLocator)
            aggregate(listId, null, null, function (err, results) {
              results.length.should.equal(2)
              done()
            })
          }
        )
      })

      it('should respect live and expiry dates of non live custom items', function (done) {

        var articles = []
          , oneWeekAhead = moment().add('week', 1)
          , twoWeeksAhead = moment().add('week', 2)
          , listId

        async.series
        (
          [ customListItemMaker(articles, { 'type': 'custom', liveDate: oneWeekAhead, expiryDate: twoWeeksAhead })
          , customListItemMaker(articles, { 'type': 'custom' })
          , customListItemMaker(articles, { 'type': 'custom' })
          , function (cb) {
              serviceLocator.listService.create
              (
                { type: 'manual'
                , name: 'test list'
                , articles: articles
                , limit: 100
                }
              , function (err, res) {
                  listId = res._id
                  cb(null)
                }
              )
            }
          ]
        , function (err) {
            if (err) throw err
            var aggregate = createAggregator(serviceLocator)
            aggregate(listId, null, null, function (err, results) {
              results.length.should.equal(2)
              done()
            })
          }
        )
      })

      it('should work when there are expired normal items and live custom items', function (done) {

        var articles = []
          , oneWeekAgo = moment().subtract('week', 1)
          , twoWeeksAgo = moment().subtract('week', 2)
          , listId

        async.series
        (
          [ publishedArticleMaker(articles, {liveDate: twoWeeksAgo, expiryDate: oneWeekAgo })
          , customListItemMaker(articles, { 'type': 'custom' })
          , customListItemMaker(articles, { 'type': 'custom' })
          , function (cb) {
              serviceLocator.listService.create
              (
                { type: 'manual'
                , name: 'test list'
                , articles: articles
                , limit: 100
                }
              , function (err, res) {
                  listId = res._id
                  cb(null)
                }
              )
            }
          ]
        , function (err) {
            if (err) throw err
            var aggregate = createAggregator(serviceLocator)
            aggregate(listId, null, null, function (err, results) {
              results.length.should.equal(2)
              done()
            })
          }
        )
      })

      it('should work when there are expired custom items, live custom items and live normal items', function (done) {

        var articles = []
          , oneWeekAgo = moment().subtract('week', 1)
          , twoWeeksAgo = moment().subtract('week', 2)
          , listId

        async.series
        (
          [ customListItemMaker(articles, { 'type': 'custom', liveDate: twoWeeksAgo, expiryDate: oneWeekAgo })
          , publishedArticleMaker(articles)
          , publishedArticleMaker(articles)
          , customListItemMaker(articles, { 'type': 'custom' })
          , customListItemMaker(articles, { 'type': 'custom' })
          , function (cb) {
              serviceLocator.listService.create
              (
                { type: 'manual'
                , name: 'test list'
                , articles: articles
                , limit: 100
                }
              , function (err, res) {
                  listId = res._id
                  cb(null)
                }
              )
            }
          ]
        , function (err) {
            if (err) throw err
            var aggregate = createAggregator(serviceLocator)
            aggregate(listId, null, null, function (err, results) {
              results.length.should.equal(4)
              done()
            })
          }
        )
      })

      it('should adhere to the list limit with custom items', function (done) {

        var articles = []
          , listId

        async.series
        (
          [ publishedArticleMaker(articles)
          , customListItemMaker(articles, { 'type': 'custom' })
          , function (cb) {
              console.log(articles)
              serviceLocator.listService.create
              (
                { type: 'manual'
                , name: 'test list'
                , articles: articles
                , limit: 1
                }
              , function (err, res) {
                  listId = res._id
                  cb(null)
                }
              )
            }
          ]
        , function (err) {
            if (err) throw err
            var aggregate = createAggregator(serviceLocator)
            aggregate(listId, null, null, function (err, results) {
              results.length.should.equal(1)
              done()
            })
          }
        )
      })

    })

    describe('(for an auto list)', function () {

      it('should return articles whose tags match those of the list', function (done) {

        var articles = []
          , listId

        async.series(
          [ publishedArticleMaker(articles, { tags: [ { tag: 'test-tag', type: 'test-type' } ] })
          , publishedArticleMaker([])
          , publishedArticleMaker(articles, { tags: [ { tag: 'test-tag', type: 'test-type' } ] })
          , publishedArticleMaker([])
          , publishedArticleMaker([], { tags: [ { tag: 'test-tag2', type: 'test-type' } ] })
          , publishedArticleMaker([])
          , publishedArticleMaker(articles, { tags:
              [ { tag: 'test-tag', type: 'test-type' }
              , { tag: 'test-tag2', type: 'test-type' }
              ] })
          , function (cb) {
              serviceLocator.listService.create(
                { type: 'auto'
                , name: 'test list'
                , tags: [ { tag: 'test-tag', type: 'test-type' } ]
                , order: 'recent'
                , limit: 100
                }
                , function (err, res) {
                    listId = res._id
                    cb(null)
                  })
            }
          ], function (err) {
            if (err) throw err

            var aggregate = createAggregator(serviceLocator)

            aggregate(listId, null, null, function (err, results) {
              should.not.exist(err)
              results.should.have.length(3)
              results.forEach(function (result, i) {
                eql(_.extend(
                      {}
                    , articleFixtures.minimalNewPublishedModel
                    , { _id: articles[i].articleId, tags: articles[i].tags })
                  , result, false, true)
              })
              done()
            })

          })
      })

      it('should return articles from a particular sections', function (done) {

        var articles = []
          , listId

        async.series(
          [ publishedArticleMaker(articles, { section: '3' })
          , publishedArticleMaker(articles, { section: '4' })
          , publishedArticleMaker(articles, { section: '4' })
          , publishedArticleMaker([])
          , draftArticleMaker([])
          , publishedArticleMaker([], { section: '5' })
          , publishedArticleMaker([])
          , publishedArticleMaker(articles, { section: '4' })
          , function (cb) {
              serviceLocator.listService.create(
                { type: 'auto'
                , name: 'test list'
                , order: 'recent'
                , sections: [ '3', '4' ]
                , limit: 100
                }
                , function (err, res) {
                    listId = res._id
                    cb(null)
                  })
            }
          ], function (err) {
            if (err) throw err

            var aggregate = createAggregator(serviceLocator)

            aggregate(listId, null, null, function (err, results) {
              should.not.exist(err)
              results.should.have.length(4)
              results.forEach(function (result, i) {
                eql(_.extend(
                      {}
                    , articleFixtures.minimalNewPublishedModel
                    , { _id: articles[i].articleId })
                  , result, false, true)
              })
              done()
            })

          })
      })

      it ('should return articles of a particular type', function(done) {
        var articles = []
          , listId

        async.series(
          [ publishedArticleMaker(articles, { type: 'article' })
          , publishedArticleMaker(articles, { type: 'gallery' })
          , publishedArticleMaker(articles, { type: 'article' })
          , publishedArticleMaker([], { type: 'styleselector' })
          , draftArticleMaker([], { type: 'article' })
          , publishedArticleMaker([], { type: 'styleselector' })
          , publishedArticleMaker([], { type: 'article' })
          , publishedArticleMaker(articles, { type: 'gallery' })
          , function (cb) {
              serviceLocator.listService.create(
                { type: 'auto'
                , name: 'test list'
                , order: 'recent'
                , articleTypes: [ 'article' ]
                , limit: 100
                }
                , function (err, res) {
                    listId = res._id
                    cb(null)
                  })
            }
          ], function (err) {
            if (err) throw err

            var aggregate = createAggregator(serviceLocator)

            aggregate(listId, null, null, function (err, results) {
              should.not.exist(err)
              results.should.have.length(3)
              results.forEach(function (result, i) {
                eql(_.extend(
                      {}
                    , articleFixtures.minimalNewPublishedModel
                    , { _id: articles[i].articleId })
                  , result, false, true)
              })
              done()
            })

          })
      })

      it ('should return articles of a particular sub type', function(done) {
        var articles = []
          , listId

        async.series(
          [ publishedArticleMaker(articles, { subType: 'Portrait' })
          , publishedArticleMaker(articles, { subType: 'Landscape' })
          , publishedArticleMaker(articles, { subType: 'Video' })
          , publishedArticleMaker([], { subType: 'Portrait' })
          , draftArticleMaker([], { subType: 'Portrait' })
          , publishedArticleMaker([], { subType: 'Portrait' })
          , publishedArticleMaker([], { subType: 'Landscape' })
          , publishedArticleMaker(articles, { subType: 'Video' })
          , function (cb) {
              serviceLocator.listService.create(
                { type: 'auto'
                , name: 'test list'
                , order: 'recent'
                , articleSubTypes: [ 'Portrait' ]
                , limit: 100
                }
                , function (err, res) {
                    listId = res._id
                    cb(null)
                  })
            }
          ], function (err) {
            if (err) throw err

            var aggregate = createAggregator(serviceLocator)

            aggregate(listId, null, null, function (err, results) {
              should.not.exist(err)
              results.should.have.length(3)
              results.forEach(function (result, i) {
                eql(_.extend(
                      {}
                    , articleFixtures.minimalNewPublishedModel
                    , { _id: articles[i].articleId })
                  , result, false, true)
              })
              done()
            })

          })
      })

      it('should order the articles by displayDate', function (done) {

        var articles = []
          , listId

        async.series(
          [ publishedArticleMaker(articles, { displayDate: new Date(2011, 1, 1) })
          , publishedArticleMaker(articles, { displayDate: new Date(2012, 1, 1) })
          , publishedArticleMaker(articles, { displayDate: new Date(2013, 1, 1) })
          , draftArticleMaker([])
          , publishedArticleMaker(articles, { displayDate: new Date(2014, 1, 1) })
          , publishedArticleMaker(articles, { displayDate: new Date(2015, 1, 1) })
          , function (cb) {
              serviceLocator.listService.create(
                { type: 'auto'
                , name: 'test list'
                , order: 'recent'
                , limit: 100
                }
                , function (err, res) {
                    listId = res._id
                    cb(null)
                  })
            }
          ], function (err) {
            if (err) throw err

            var aggregate = createAggregator(serviceLocator)

            aggregate(listId, null, null, function (err, results) {
              should.not.exist(err)
              results.should.have.length(5)
              results.forEach(function (result, i) {
                eql(_.extend(
                      {}
                    , articleFixtures.minimalNewPublishedModel
                    , { _id: articles[articles.length - i - 1].articleId
                      , displayDate: articles[articles.length - i - 1].displayDate
                      })
                  , result, false, true)
              })
              done()
            })

          })
      })

      it('should order the articles alphabetically', function (done) {

        var articles = []
          , listId

        async.series(
          [ publishedArticleMaker(articles, { shortTitle: 'j' })
          , publishedArticleMaker(articles, { shortTitle: 'a' })
          , publishedArticleMaker(articles, { shortTitle: '9' })
          , draftArticleMaker([])
          , publishedArticleMaker(articles, { shortTitle: '0' })
          , publishedArticleMaker(articles, { shortTitle: 'z' })
          , function (cb) {
              serviceLocator.listService.create(
                { type: 'auto'
                , name: 'test list'
                , order: 'alphabetical'
                , limit: 100
                }
                , function (err, res) {
                    listId = res._id
                    cb(null)
                  })
            }
          ], function (err) {
            if (err) throw err

            var aggregate = createAggregator(serviceLocator)

            aggregate(listId, null, null, function (err, results) {
              should.not.exist(err)
              results.should.have.length(5)
              results.forEach(function (result, i) {
                eql(_.extend(
                      {}
                    , articleFixtures.minimalNewPublishedModel
                    , { _id: articles[articles.length - i - 1].articleId
                      , shortTitle: articles[articles.length - i - 1].shortTitle
                      })
                  , result, false, true)
              })
              done()
            })

          })
      })

      it('should order the articles by number of comments')
      it('should order the articles by popularity')

      it('should limit the number of articles', function (done) {

        var listId

        async.series(
          [ publishedArticleMaker([])
          , publishedArticleMaker([])
          , publishedArticleMaker([])
          , draftArticleMaker([])
          , publishedArticleMaker([])
          , publishedArticleMaker([])
          , function (cb) {
              serviceLocator.listService.create(
                { type: 'auto'
                , name: 'test list'
                , order: 'recent'
                , limit: 3
                }
                , function (err, res) {
                    listId = res._id
                    cb(null)
                  })
            }
          ], function (err) {
            if (err) throw err

            var aggregate = createAggregator(serviceLocator)

            aggregate(listId, null, null, function (err, results) {
              should.not.exist(err)
              results.should.have.length(3)
              done()
            })

          })
      })

    })

    it('should not have duplicates if a deduper is not injected', function (done) {
      var articles = []
        , listIds = []

      async.series(
        [ publishedArticleMaker(articles)
        , publishedArticleMaker(articles)
        , publishedArticleMaker(articles)
        , draftArticleMaker([])
        , publishedArticleMaker(articles)
        , publishedArticleMaker(articles)
        , function (cb) {
            serviceLocator.listService.create(
              { type: 'auto'
              , name: 'test list'
              , order: 'recent'
              , limit: 100
              }
              , function (err, res) {
                  listIds.push(res._id)
                  cb(null)
                })
          }
        , function (cb) {
            serviceLocator.listService.create(
              { type: 'auto'
              , name: 'test list'
              , order: 'recent'
              , limit: 100
              }
              , function (err, res) {
                  listIds.push(res._id)
                  cb(null)
                })
          }
        ], function (err) {
          if (err) throw err

          var aggregate = createAggregator(serviceLocator)

          aggregate(listIds, null, null, function (err, results) {
            should.not.exist(err)
            results.should.have.length(5)
            done()
          })

        })
    })

  })

  it('should not have duplicates if a deduper is injected', function (done) {
    var articles = []
      , listIds = []

    async.series(
      [ publishedArticleMaker(articles)
      , publishedArticleMaker(articles)
      , publishedArticleMaker(articles)
      , draftArticleMaker([])
      , publishedArticleMaker(articles)
      , publishedArticleMaker(articles)
      , function (cb) {
          serviceLocator.listService.create(
            { type: 'auto'
            , name: 'test list'
            , order: 'recent'
            , limit: 100
            }
            , function (err, res) {
                listIds.push(res._id)
                cb(null)
              })
        }
      , function (cb) {
          serviceLocator.listService.create(
            { type: 'auto'
            , name: 'test list'
            , order: 'recent'
            , limit: 100
            }
            , function (err, res) {
                listIds.push(res._id)
                cb(null)
              })
        }
      ], function (err) {
        if (err) throw err

        var aggregate = createAggregator(serviceLocator)

        aggregate(listIds, createDedupe(), null, function (err, results) {
          should.not.exist(err)
          results.should.have.length(5)
          done()
        })

      })
  })

  it('should return a limited set with deduper', function (done) {
    var articles = []
      , listIds = []

    async.series(
      [ publishedArticleMaker(articles)
      , publishedArticleMaker(articles)
      , publishedArticleMaker(articles)
      , draftArticleMaker([])
      , publishedArticleMaker(articles)
      , publishedArticleMaker(articles)
      , publishedArticleMaker(articles)
      , publishedArticleMaker(articles)
      , publishedArticleMaker(articles)
      , publishedArticleMaker(articles)
      , publishedArticleMaker(articles)
      , publishedArticleMaker(articles)
      , function (cb) {
          serviceLocator.listService.create(
            { type: 'auto'
            , name: 'test list'
            , order: 'recent'
            , limit: 2
            }
            , function (err, res) {
                listIds.push(res._id)
                cb(null)
              })
        }
      , function (cb) {
          serviceLocator.listService.create(
            { type: 'auto'
            , name: 'test list'
            , order: 'recent'
            , limit: 100
            }
            , function (err, res) {
                listIds.push(res._id)
                cb(null)
              })
        }
      ], function (err) {
        if (err) throw err

        var aggregate = createAggregator(serviceLocator)
          , dedupe = createDedupe()

        dedupe(articles[1].articleId)

        aggregate(listIds, dedupe, 6, function (err, results) {
          should.not.exist(err)
          results.should.have.length(6)
          done()
        })

      })
  })

})