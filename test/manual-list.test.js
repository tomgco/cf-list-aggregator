var createAggregator = require('..')
  , MongoClient = require('mongodb').MongoClient
  , saveMongodb = require('save-mongodb')
  , async = require('async')
  , should = require('should')
  , moment = require('moment')
  , _ = require('lodash')
  , eql = require('fleet-street/lib/sequential-object-eql')
  , articleFixtures = require('fleet-street/test/article/fixtures')
  , sectionFixtures = require('fleet-street/test/section/fixtures')
  , customListItemMaker = require('./lib/custom-list-item-maker')
  , publishedArticleMaker = require('./lib/published-article-maker')
  , draftArticleMaker = require('./lib/draft-article-maker')
  , momentToDate = require('./lib/moment-to-date')
  , logger = require('./null-logger')
  , createListService = require('./mock-list-service')
  , createArticleService
  , createSectionService
  , section
  , sectionService
  , dbConnection

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

describe('List aggregator (for a manual list)', function () {

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
