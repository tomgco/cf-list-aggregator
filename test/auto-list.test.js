var createAggregator = require('..')
  , saveMongodb = require('save-mongodb')
  , async = require('async')
  , should = require('should')
  , moment = require('moment')
  , _ = require('lodash')
  , eql = require('fleet-street/lib/sequential-object-eql')
  , articleFixtures = require('fleet-street/test/article/fixtures')
  , sectionFixtures = require('fleet-street/test/section/fixtures')
  , publishedArticleMaker = require('./lib/published-article-maker')
  , draftArticleMaker = require('./lib/draft-article-maker')
  , momentToDate = require('./lib/moment-to-date')
  , logger = require('./null-logger')
  , createListService = require('./mock-list-service')
  , dbConnect = require('./lib/db-connection')
  , createArticleService
  , createSectionService
  , section
  , sectionService
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

describe('List aggregator (for an auto list)', function () {

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
