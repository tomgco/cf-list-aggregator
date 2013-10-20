var createAggregator = require('..')
  , sectionFixtures = require('fleet-street/test/section/fixtures')
  , async = require('async')
  , should = require('should')
  , createDedupe = require('doorman')
  , logger = require('./null-logger')
  , saveMongodb = require('save-mongodb')
  , createArticleService
  , createSectionService
  , createListService = require('./mock-list-service')
  , publishedArticleMaker = require('./lib/published-article-maker')
  , draftArticleMaker = require('./lib/draft-article-maker')
  , dbConnect = require('./lib/db-connection')

describe('List Aggregator', function () {

  // Create a service and section fixture for all tests to use
  var sectionService
    , section
    , dbConnection

  // Create a database and service fixtures
  before(function(done) {
    dbConnect.connect(function (err, db) {
      dbConnection = db

      createSectionService = require('./mock-section-service')(saveMongodb(dbConnection.collection('section')))

      sectionService = createSectionService()
      sectionService.create(sectionFixtures.newVaildModel, function (err, newSection) {
        section = newSection
        done()
      })
    })
  })

  // Clean up after tests
  after(dbConnect.disconnect)

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

    it('should not have duplicates if a deduper is not injected', function (done) {
      var articles = []
        , listIds = []
        , listService = createListService()
        , sectionService = createSectionService()
        , articleService = createArticleService()

      async.series(
        [ publishedArticleMaker.createArticles(5, articleService, articles)
        , draftArticleMaker(articleService)
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
      [ publishedArticleMaker.createArticles(5, articleService, articles)
      , draftArticleMaker(articleService)
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
      [ publishedArticleMaker.createArticles(11, articleService, articles)
      , draftArticleMaker(articleService)
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

        var aggregate = createAggregator(listService, sectionService, articleService, { logger: logger })
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
