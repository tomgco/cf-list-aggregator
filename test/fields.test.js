var createAggregator = require('..')
  , async = require('async')
  , saveMongodb = require('save-mongodb')
  , should = require('should')
  , createListService = require('./mock-list-service')
  , createArticleService = require('./mock-list-service')
  , dbConnect = require('./lib/db-connection')
  , publishedArticleMaker = require('./lib/published-article-maker')
  , logger = require('./null-logger')
  , sectionFixtures = require('fleet-street/test/section/fixtures')
  , createSectionService
  , sectionService
  , section
  , dbConnection

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

describe('List aggregator fields option', function () {
  it('should allow a fields option to be passed to define fields to return', function (done) {
    var articles = []
      , listId
      , listService = createListService()
      , sectionService = createSectionService()
      , articleService = createArticleService()

    async.series(
      [ publishedArticleMaker.createArticles(3, articleService, articles)
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
          { logger: logger, fields: { longTitle: 1 } })

        aggregate(listId, null, null, section, function (err, results) {
          should.not.exist(err)
          results.should.have.length(3)
          results.forEach(function (result) {
            // _id is always returned from mongo
            Object.keys(result).length.should.equal(2)
            Object.keys(result)[0].should.equal('longTitle')
          })
          done()
        })
      })
  })

  it('should allow the fields option to be an array of fields', function (done) {
    var articles = []
      , listId
      , listService = createListService()
      , sectionService = createSectionService()
      , articleService = createArticleService()

    async.series(
      [ publishedArticleMaker.createArticles(3, articleService, articles)
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
          { logger: logger, fields: ['longTitle', 'tags'] })

        aggregate(listId, null, null, section, function (err, results) {
          should.not.exist(err)
          results.should.have.length(3)
          results.forEach(function (result) {
            // _id is always returned from mongo
            Object.keys(result).length.should.equal(3)
            Object.keys(result)[0].should.equal('longTitle')
          })
          done()
        })
      })
  })

  it('should have a default fields object which gets used if no fields provided', function (done) {
    var articles = []
      , listId
      , listService = createListService()
      , sectionService = createSectionService()
      , articleService = createArticleService()

    async.series(
      [ publishedArticleMaker.createArticles(1, articleService, articles)
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
          results.should.have.length(1)
          results.forEach(function (result) {
            var properties =
              [ 'type'
              , 'shortTitle'
              , 'longTitle'
              , 'subTitle'
              , 'crops'
              , 'displayDate'
              , 'showDisplayDate'
              , 'tags'
              , 'images'
              , 'downloads'
              , 'commentCount'
              , 'viewCount'
              , 'standfirst'
              , '_id'
              ]

            properties.forEach(function (prop) {
              should.exist(result[prop])
            })

            Object.keys(properties).length.should.equal(properties.length)
          })
          done()
        })
      })
  })

  it('should allow the passing of an array which will get converted into a mongo fields query')
})
