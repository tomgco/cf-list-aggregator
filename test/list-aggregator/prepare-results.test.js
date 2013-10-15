var prepareResults = require('../../lib/prepare-results')

describe('prepare()', function () {

  it('should not make assumptions about the order of items', function () {
    var prepared = prepareResults(
      [ { _id: 0, shortTitle: 'James' }
      , { _id: 1, shortTitle: 'Robert'}
      ],
      [ { articleId: 1, shortTitle: 'Bob' }
      , { articleId: 0, shortTitle: 'Jim' }
      ])
    prepared.should.eql(
      [ { _id: 0, shortTitle: 'Jim' }
      , { _id: 1, shortTitle: 'Bob' }
      ])
  })

})