var createAggregator = require('..')
  , articleFixtures = require('fleet-street/test/article/fixtures')
  , sectionFixtures = require('fleet-street/test/section/fixtures')
  , async = require('async')
  , should = require('should')
  , _ = require('lodash')
  , createDedupe = require('doorman')
  , slugUniquer = 1
  , moment = require('moment')
  , logger = require('./null-logger')
  , MongoClient = require('mongodb').MongoClient
  , saveMongodb = require('save-mongodb')
  , createArticleService
  , createSectionService
  , createListService = require('./mock-list-service')
  , eql = require('fleet-street/lib/sequential-object-eql')


function publishedArticleMaker(articleService, articles, custom) {
  return function (cb) {
    var model = _.extend({}, articleFixtures.validNewPublishedModel, custom)

    // Make slug unique to stop validation errors (slug and section unique)
    model.slug += slugUniquer
    slugUniquer++

    articleService.create(model, function (err, result) {
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

function draftArticleMaker(articleService) {
  return function (cb) {
    articleService.create(articleFixtures.validNewModel, function (err) {
      if (err) return cb(err)
      cb(null)
    })
  }
}

function momentToDate(date) {
  return date.startOf('day').toDate()
}

describe('List Aggregator', function () {

  // Create a service and section fixture for all tests to use
  var sectionService
    , section
    , dbConnection

  // Create a database and service fixtures
  before(function(done) {
    MongoClient.connect('mongodb://127.0.0.1/cf-list-aggregator-tests', function (error, db) {

      dbConnection = db

      // Start with an empty database
      db.dropDatabase(function() {

        createSectionService = require('./mock-section-service')(saveMongodb(dbConnection.collection('section')))

        sectionService = createSectionService()
        sectionService.create(sectionFixtures.newVaildModel, function (err, newSection) {
          section = newSection
          done()
        })
      })
    })
  })

  // Clean up after tests
  after(function () {

    dbConnection.dropDatabase()
    dbConnection.close()
  })

  // Each test gets a new article service
  beforeEach(function() {
    createArticleService = require('./mock-article-service')
    (saveMongodb(dbConnection.collection('article' + Date.now())))
  })

  describe('createAggregator()', function () {

    it('should be a function and return a function', function () {
      createAggregator.should.be.type('function')
      createAggregator().should.be.type('function')
    })

  })

  describe('aggregate()', function () {

    it('should not error when an object that isn\'t a list is passed', function (done) {

      var listService = createListService()
        , articleService = createArticleService()

      createAggregator(listService, sectionService, articleService,
        { logger: logger })({}, null, null, section, function (err, results) {

        results.should.have.length(0)
        done()
      })
    })

    describe('(for a manual list)', function () {

      it('should return a list with custom list items', function (done) {
        var articles = []
          , listId
          , listService = createListService()
          , articleService = createArticleService()

        async.series(
          [ customListItemMaker(articles, { 'longTitle': 'Bob', 'type': 'custom' })
          , customListItemMaker(articles, { 'shortTitle': 'Alice', 'type': 'custom' })
          , customListItemMaker(articles, { 'type': 'custom' })
          , customListItemMaker([])
          , customListItemMaker(articles, { 'type': 'custom' })
          , customListItemMaker([])
          , customListItemMaker(articles, { 'type': 'custom' })
          , function (cb) {
              listService.create(
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

            var aggregate = createAggregator(
              listService, sectionService, articleService, { logger: logger })

            aggregate(listId, null, null, section, function (err, results) {
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

      it('should return a list with custom list items and articles', function (done) {
        var articles = []
          , listId
          , listService = createListService()
          , articleService = createArticleService()

        async.series(
          [ customListItemMaker(articles, { 'longTitle': 'Bob', 'type': 'custom' })
          , customListItemMaker(articles, { 'shortTitle': 'Alice', 'type': 'custom' })
          , customListItemMaker(articles, { 'type': 'custom' })
          , publishedArticleMaker(articleService, articles)
          , customListItemMaker(articles, { 'type': 'custom' })
          , publishedArticleMaker(articleService, articles)
          , customListItemMaker(articles, { 'type': 'custom' })
          , function (cb) {
              listService.create(
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

            var aggregate = createAggregator(listService, sectionService, articleService, { logger: logger })

            aggregate(listId, null, null, section, function (err, results) {
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
          , listService = createListService()
          , sectionService = createSectionService()
          , articleService = createArticleService()

        async.series(
          [ publishedArticleMaker(articleService, articles)
          , publishedArticleMaker(articleService, articles)
          , publishedArticleMaker(articleService, articles)
          , publishedArticleMaker(articleService, [])
          , publishedArticleMaker(articleService, articles)
          , publishedArticleMaker(articleService, [])
          , publishedArticleMaker(articleService, articles)
          , function (cb) {
              listService.create(
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

            var aggregate = createAggregator(listService, sectionService, articleService,
        { logger: logger })

            aggregate(listId, null, null, section, function (err, results) {
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
          , listService = createListService()
          , sectionService = createSectionService()
          , articleService = createArticleService()

        async.series(
          [ publishedArticleMaker(articleService, articles)
          , publishedArticleMaker(articleService, articles)
          , draftArticleMaker(articleService)
          , draftArticleMaker(articleService)
          , publishedArticleMaker(articleService, articles)
          , draftArticleMaker(articleService)
          , function (cb) {
              listService.create(
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

            var aggregate = createAggregator(listService, sectionService, articleService,
        { logger: logger })

            aggregate(listId, null, null, section, function (err, results) {
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
          , listService = createListService()
          , sectionService = createSectionService()
          , articleService = createArticleService()

        async.series(
          [ publishedArticleMaker(articleService, articles)
          , publishedArticleMaker(articleService, articles)
          , draftArticleMaker(articleService)
          , draftArticleMaker(articleService)
          , publishedArticleMaker(articleService, articles)
          , draftArticleMaker(articleService)
          , function (cb) {
              listService.create(
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

            var aggregate = createAggregator(listService, sectionService, articleService, { logger: logger })

            aggregate(listId, null, null, section, function (err, results) {
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
          , listService = createListService()
          , sectionService = createSectionService()
          , articleService = createArticleService()

        async.series(
          [ publishedArticleMaker(articleService, articles)
          , publishedArticleMaker(articleService, articles)
          , draftArticleMaker(articleService)
          , draftArticleMaker(articleService)
          , publishedArticleMaker(articleService, articles)
          , draftArticleMaker(articleService)
          , function (cb) {
            listService.create(
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

            var aggregate = createAggregator(listService, sectionService, articleService, { logger: logger })

            articles = articles.map(function (article, i) {
              article._id = article.articleId
            ; delete article._id
              return _.extend({}, article, overrides[i])
            })

            aggregate(listId, null, null, section, function (err, results) {
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
          , listService = createListService()
          , sectionService = createSectionService()
          , articleService = createArticleService()

        async.series
        (
          [ publishedArticleMaker(articleService, articles, {liveDate: oneWeekAhead, expiryDate: twoWeeksAhead })
          , publishedArticleMaker(articleService, articles)
          , publishedArticleMaker(articleService, articles)
          , function (cb) {
              listService.create
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
            var aggregate = createAggregator(listService, sectionService, articleService,
        { logger: logger })
            aggregate(listId, null, null, section, function (err, results) {
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
          , listService = createListService()
          , sectionService = createSectionService()
          , articleService = createArticleService()

        async.series
        (
          [ publishedArticleMaker(articleService, articles)
          , publishedArticleMaker(articleService, articles)
          , publishedArticleMaker(articleService, articles)
          , function (cb) {
              listService.create
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
            var aggregate = createAggregator(listService, sectionService, articleService,
        { logger: logger })
            aggregate(listId, null, null, section, function (err, results) {
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
          , listService = createListService()
          , sectionService = createSectionService()
          , articleService = createArticleService()

        async.series
        (
          [ customListItemMaker(articles, { 'type': 'custom', liveDate: oneWeekAhead, expiryDate: twoWeeksAhead })
          , customListItemMaker(articles, { 'type': 'custom' })
          , customListItemMaker(articles, { 'type': 'custom' })
          , function (cb) {
              listService.create
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
            var aggregate = createAggregator(listService, sectionService, articleService,
        { logger: logger })
            aggregate(listId, null, null, section, function (err, results) {
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
          , listService = createListService()
          , sectionService = createSectionService()
          , articleService = createArticleService()

        async.series
        (
          [ publishedArticleMaker(articleService, articles, {liveDate: twoWeeksAgo, expiryDate: oneWeekAgo })
          , customListItemMaker(articles, { 'type': 'custom' })
          , customListItemMaker(articles, { 'type': 'custom' })
          , function (cb) {
              listService.create
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
            var aggregate = createAggregator(listService, sectionService, articleService, { logger: logger })
            aggregate(listId, null, null, section, function (err, results) {
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
          , listService = createListService()
          , sectionService = createSectionService()
          , articleService = createArticleService()

        async.series
        (
          [ customListItemMaker(articles, { 'type': 'custom', liveDate: twoWeeksAgo, expiryDate: oneWeekAgo })
          , publishedArticleMaker(articleService, articles)
          , publishedArticleMaker(articleService, articles)
          , customListItemMaker(articles, { 'type': 'custom' })
          , customListItemMaker(articles, { 'type': 'custom' })
          , function (cb) {
              listService.create
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
            var aggregate = createAggregator(listService, sectionService, articleService,
        { logger: logger })
            aggregate(listId, null, null, section, function (err, results) {
              results.length.should.equal(4)
              done()
            })
          }
        )
      })

      it('should adhere to the list limit with custom items', function (done) {

        var articles = []
          , listId
          , listService = createListService()
          , sectionService = createSectionService()
          , articleService = createArticleService()

        async.series
        (
          [ publishedArticleMaker(articleService, articles)
          , customListItemMaker(articles, { 'type': 'custom' })
          , function (cb) {
              listService.create
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
            var aggregate = createAggregator(listService, sectionService, articleService,
        { logger: logger })
            aggregate(listId, null, null, section, function (err, results) {
              results.length.should.equal(1)
              done()
            })
          }
        )
      })

      it('should return a list of custom expired items in relation to date parameter', function (done) {
        var articles = []
          , oneWeekAgo = momentToDate(moment().subtract('week', 1))
          , twoWeeksAgo = momentToDate(moment().subtract('week', 2))
          , oneAndAHalfWeeksAgo = momentToDate(moment().subtract('week', 1).subtract('days', 3))
          , listId
          , listService = createListService()
          , sectionService = createSectionService()
          , articleService = createArticleService()

        async.series(
          [ customListItemMaker(articles, { type: 'custom', liveDate: twoWeeksAgo, expiryDate: oneWeekAgo })
          , customListItemMaker(articles, { type: 'custom', liveDate: twoWeeksAgo, expiryDate: oneWeekAgo })
          , customListItemMaker(articles, { type: 'custom', liveDate: twoWeeksAgo, expiryDate: oneWeekAgo })
          , function (cb) {
              listService.create
              (
                { type: 'manual'
                , name: 'test list'
                , articles: articles
                , limit: 100
                }
              , function (err, res) {
                  listId = res._id
                  cb()
                }
              )
            }
          ]
        , function (err) {
            if (err) throw err

            var aggregate = createAggregator(listService, sectionService, articleService,
              { logger: logger, date: oneAndAHalfWeeksAgo })

            aggregate(listId, null, null, section, function (err, results) {
              results.length.should.equal(3)
              done()
            })
          }
        )
      })

      it('should return a list of articles in relation to date parameter', function (done) {
        var articles = []
          , oneWeekAgo = momentToDate(moment().subtract('week', 1))
          , twoWeeksAgo = momentToDate(moment().subtract('week', 2))
          , oneAndAHalfWeeksAgo = momentToDate(moment().subtract('week', 1).subtract('days', 3))
          , listId
          , listService = createListService()
          , sectionService = createSectionService()
          , articleService = createArticleService()

        async.series(
          [ publishedArticleMaker(articleService, articles,
              { liveDate: twoWeeksAgo, expiryDate: oneWeekAgo })
          , publishedArticleMaker(articleService, articles,
              { liveDate: twoWeeksAgo, expiryDate: oneWeekAgo })
          , function (cb) {
              listService.create
              (
                { type: 'manual'
                , name: 'test list'
                , articles: articles
                , limit: 100
                }
              , function (err, res) {
                  listId = res._id
                  cb()
                }
              )
            }
          ]
        , function (err) {
            if (err) throw err

            var aggregate = createAggregator(listService, sectionService, articleService,
              { logger: logger, date: oneAndAHalfWeeksAgo })

            aggregate(listId, null, null, section, function (err, results) {
              results.length.should.equal(2)
              done()
            })
          }
        )
      })

      it('should return combination list and article items in relation to date parameter', function (done) {
        var articles = []
          , oneWeekAgo = momentToDate(moment().subtract('week', 1))
          , twoWeeksAgo = momentToDate(moment().subtract('week', 2))
          , oneAndAHalfWeeksAgo = momentToDate(moment().subtract('week', 1).subtract('days', 3))
          , listId
          , listService = createListService()
          , sectionService = createSectionService()
          , articleService = createArticleService()

        async.series(
          [ publishedArticleMaker(articleService, articles,
              { liveDate: twoWeeksAgo, expiryDate: oneWeekAgo })
          , customListItemMaker(articles, { type: 'custom', liveDate: twoWeeksAgo, expiryDate: oneWeekAgo })
          , publishedArticleMaker(articleService, articles,
              { liveDate: twoWeeksAgo, expiryDate: oneWeekAgo })
          , customListItemMaker(articles, { type: 'custom', liveDate: twoWeeksAgo, expiryDate: oneWeekAgo })
          , function (cb) {
              listService.create
              (
                { type: 'manual'
                , name: 'test list'
                , articles: articles
                , limit: 100
                }
              , function (err, res) {
                  listId = res._id
                  cb()
                }
              )
            }
          ]
        , function (err) {
            if (err) throw err

            var aggregate = createAggregator(listService, sectionService, articleService,
              { logger: logger, date: oneAndAHalfWeeksAgo })

            aggregate(listId, null, null, section, function (err, results) {
              results.length.should.equal(4)
              done()
            })
          }
        )
      })

      it('should override the live and expiry date of a non live article with date parameter', function (done) {

        var articles = []
          , oneWeekAhead = momentToDate(moment().add('week', 1))
          , twoWeeksAhead = momentToDate(moment().add('week', 2))
          , oneWeekAgo = momentToDate(moment().subtract('week', 1))
          , twoWeeksAgo = momentToDate(moment().subtract('week', 2))
          , oneAndAHalfWeeksAgo = momentToDate(moment().subtract('week', 1).subtract('days', 3))
          , overrides =
            [ { liveDate: twoWeeksAgo, expiryDate: oneWeekAgo, customId: null }
            , {}
            , { liveDate: twoWeeksAgo, expiryDate: oneWeekAgo, customId: null }
            ]
          , listId
          , listService = createListService()
          , sectionService = createSectionService()
          , articleService = createArticleService()

        async.series(
          [ publishedArticleMaker(articleService, articles, { liveDate: oneWeekAhead, expiryDate: twoWeeksAhead })
          // No override for this one so results should only be 2
          , publishedArticleMaker(articleService, articles, { liveDate: oneWeekAhead, expiryDate: twoWeeksAhead })
          , publishedArticleMaker(articleService, articles, { liveDate: oneWeekAhead, expiryDate: twoWeeksAhead })
          , function (cb) {
              listService.create(
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
            var aggregate = createAggregator(listService, sectionService, articleService,
              { logger: logger, date: oneAndAHalfWeeksAgo })

            aggregate(listId, null, null, section, function (err, results) {
              results.length.should.equal(2)
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
          , listService = createListService()
          , sectionService = createSectionService()
          , articleService = createArticleService()

        async.series(
          [ publishedArticleMaker(articleService, articles, { tags: [ { tag: 'test-tag', type: 'test-type' } ] })
          , publishedArticleMaker(articleService, [])
          , publishedArticleMaker(articleService, articles, { tags: [ { tag: 'test-tag', type: 'test-type' } ] })
          , publishedArticleMaker(articleService, [])
          , publishedArticleMaker(articleService, [], { tags: [ { tag: 'test-tag2', type: 'test-type' } ] })
          , publishedArticleMaker(articleService, [])
          , publishedArticleMaker(articleService, articles, { tags:
              [ { tag: 'test-tag', type: 'test-type' }
              , { tag: 'test-tag2', type: 'test-type' }
              ] })
          , function (cb) {
              listService.create(
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

            var aggregate = createAggregator(listService, sectionService, articleService,
        { logger: logger })

            aggregate(listId, null, null, section, function (err, results) {
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
          , listService = createListService()
          , sectionService = createSectionService()
          , articleService = createArticleService()

        async.series(
          [ publishedArticleMaker(articleService, articles, { section: '3' })
          , publishedArticleMaker(articleService, articles, { section: '4' })
          , publishedArticleMaker(articleService, articles, { section: '4' })
          , publishedArticleMaker(articleService, [])
          , draftArticleMaker(articleService)
          , publishedArticleMaker(articleService, [], { section: '5' })
          , publishedArticleMaker(articleService, [])
          , publishedArticleMaker(articleService, articles, { section: '4' })
          , function (cb) {
              listService.create(
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

            var aggregate = createAggregator(listService, sectionService, articleService, { logger: logger })

            aggregate(listId, null, null, section, function (err, results) {
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
          , listService = createListService()
          , sectionService = createSectionService()
          , articleService = createArticleService()

        async.series(
          [ publishedArticleMaker(articleService, articles, { type: 'article' })
          , publishedArticleMaker(articleService, articles, { type: 'gallery' })
          , publishedArticleMaker(articleService, articles, { type: 'article' })
          , publishedArticleMaker(articleService, [], { type: 'styleselector' })
          , draftArticleMaker(articleService, [], { type: 'article' })
          , publishedArticleMaker(articleService, [], { type: 'styleselector' })
          , publishedArticleMaker(articleService, [], { type: 'article' })
          , publishedArticleMaker(articleService, articles, { type: 'gallery' })
          , function (cb) {
              listService.create(
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

            var aggregate = createAggregator(listService, sectionService, articleService,
        { logger: logger })

            aggregate(listId, null, null, section, function (err, results) {
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
          , listService = createListService()
          , sectionService = createSectionService()
          , articleService = createArticleService()


        async.series(
          [ publishedArticleMaker(articleService, articles, { subType: 'Portrait' })
          , publishedArticleMaker(articleService, articles, { subType: 'Landscape' })
          , publishedArticleMaker(articleService, articles, { subType: 'Video' })
          , publishedArticleMaker(articleService, [], { subType: 'Portrait' })
          , draftArticleMaker(articleService, [], { subType: 'Portrait' })
          , publishedArticleMaker(articleService, [], { subType: 'Portrait' })
          , publishedArticleMaker(articleService, [], { subType: 'Landscape' })
          , publishedArticleMaker(articleService, articles, { subType: 'Video' })
          , function (cb) {
              listService.create(
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

            var aggregate = createAggregator(listService, sectionService, articleService,
        { logger: logger })

            aggregate(listId, null, null, section, function (err, results) {
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
          , listService = createListService()
          , sectionService = createSectionService()
          , articleService = createArticleService()

        async.series(
          [ publishedArticleMaker(articleService, articles, { displayDate: new Date(2011, 1, 1) })
          , publishedArticleMaker(articleService, articles, { displayDate: new Date(2012, 1, 1) })
          , publishedArticleMaker(articleService, articles, { displayDate: new Date(2013, 1, 1) })
          , draftArticleMaker(articleService)
          , publishedArticleMaker(articleService, articles, { displayDate: new Date(2014, 1, 1) })
          , publishedArticleMaker(articleService, articles, { displayDate: new Date(2015, 1, 1) })
          , function (cb) {
              listService.create(
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

            var aggregate = createAggregator(listService, sectionService, articleService,
        { logger: logger })

            aggregate(listId, null, null, section, function (err, results) {
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
          , listService = createListService()
          , sectionService = createSectionService()
          , articleService = createArticleService()

        async.series(
          [ publishedArticleMaker(articleService, articles, { shortTitle: 'j' })
          , publishedArticleMaker(articleService, articles, { shortTitle: 'a' })
          , publishedArticleMaker(articleService, articles, { shortTitle: '9' })
          , draftArticleMaker(articleService)
          , publishedArticleMaker(articleService, articles, { shortTitle: '0' })
          , publishedArticleMaker(articleService, articles, { shortTitle: 'z' })
          , function (cb) {
              listService.create(
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

            var aggregate = createAggregator(listService, sectionService, articleService,
        { logger: logger })

            aggregate(listId, null, null, section, function (err, results) {
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
        , listService = createListService()
        , sectionService = createSectionService()
        , articleService = createArticleService()

        async.series(
          [ publishedArticleMaker(articleService, [])
          , publishedArticleMaker(articleService, [])
          , publishedArticleMaker(articleService, [])
          , draftArticleMaker(articleService)
          , publishedArticleMaker(articleService, [])
          , publishedArticleMaker(articleService, [])
          , function (cb) {
              listService.create(
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

            var aggregate = createAggregator(listService, sectionService, articleService,
        { logger: logger })

            aggregate(listId, null, null, section, function (err, results) {
              should.not.exist(err)
              results.should.have.length(3)
              done()
            })

          })
      })

      it('should return a list of articles in relation to date parameter', function (done) {
        var articles = []
          , oneWeekAgo = momentToDate(moment().subtract('week', 1))
          , twoWeeksAgo = momentToDate(moment().subtract('week', 2))
          , oneAndAHalfWeeksAgo = momentToDate(moment().subtract('week', 1).subtract('days', 3))
          , listId
          , listService = createListService()
          , sectionService = createSectionService()
          , articleService = createArticleService()

        async.series(
          [ publishedArticleMaker(articleService, articles,
              { liveDate: twoWeeksAgo, expiryDate: oneWeekAgo, section: 'preview-section' })
          , publishedArticleMaker(articleService, articles,
              { liveDate: twoWeeksAgo, expiryDate: oneWeekAgo, section: 'preview-section' })
          , function (cb) {
              listService.create(
                { type: 'auto'
                , name: 'test list'
                , sections: ['preview-section']
                , limit: 100
                }
              , function (err, res) {
                  listId = res._id
                  cb()
                }
              )
            }
          ]
        , function (err) {
            if (err) throw err

            var aggregate = createAggregator(listService, sectionService, articleService,
              { logger: logger, date: oneAndAHalfWeeksAgo })

            aggregate(listId, null, null, section, function (err, results) {
              results.length.should.equal(2)
              done()
            })
          }
        )
      })
    })

    it('should not have duplicates if a deduper is not injected', function (done) {
      var articles = []
        , listIds = []
        , listService = createListService()
        , sectionService = createSectionService()
        , articleService = createArticleService()

      async.series(
        [ publishedArticleMaker(articleService, articles)
        , publishedArticleMaker(articleService, articles)
        , publishedArticleMaker(articleService, articles)
        , draftArticleMaker(articleService)
        , publishedArticleMaker(articleService, articles)
        , publishedArticleMaker(articleService, articles)
        , function (cb) {
            listService.create(
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
            listService.create(
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

          var aggregate = createAggregator(listService, sectionService, articleService,
        { logger: logger })

          aggregate(listIds, null, null, section, function (err, results) {
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
      , listService = createListService()
      , sectionService = createSectionService()
      , articleService = createArticleService()

    async.series(
      [ publishedArticleMaker(articleService, articles)
      , publishedArticleMaker(articleService, articles)
      , publishedArticleMaker(articleService, articles)
      , draftArticleMaker(articleService)
      , publishedArticleMaker(articleService, articles)
      , publishedArticleMaker(articleService, articles)
      , function (cb) {
          listService.create(
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
          listService.create(
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

        var aggregate = createAggregator(listService, sectionService, articleService, { logger: logger })
        aggregate(listIds, createDedupe(), null, section, function (err, results) {
          should.not.exist(err)
          results.should.have.length(5)
          done()
        })

      })
  })

  it('should return a limited set with deduper', function (done) {
    var articles = []
      , listIds = []
      , listService = createListService()
      , sectionService = createSectionService()
      , articleService = createArticleService()

    async.series(
      [ publishedArticleMaker(articleService, articles)
      , publishedArticleMaker(articleService, articles)
      , publishedArticleMaker(articleService, articles)
      , draftArticleMaker(articleService)
      , publishedArticleMaker(articleService, articles)
      , publishedArticleMaker(articleService, articles)
      , publishedArticleMaker(articleService, articles)
      , publishedArticleMaker(articleService, articles)
      , publishedArticleMaker(articleService, articles)
      , publishedArticleMaker(articleService, articles)
      , publishedArticleMaker(articleService, articles)
      , publishedArticleMaker(articleService, articles)
      , function (cb) {
          listService.create(
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
          listService.create(
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

        var aggregate = createAggregator(
              listService, sectionService, articleService, { logger: logger })
          , dedupe = createDedupe()

        dedupe(articles[1].articleId)

        sectionService.create(sectionFixtures.newVaildModel, function (err, section) {
          aggregate(listIds, dedupe, 6, section, function (err, results) {
            should.not.exist(err)
            results.should.have.length(6)
            done()
          })
        })
      })
  })
})
