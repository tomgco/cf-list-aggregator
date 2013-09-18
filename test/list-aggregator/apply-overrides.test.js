var override = require('../../../lib/list-aggregator/apply-overrides')

describe('override()', function () {

  it('should override supplied properties', function () {
    override({ a: 1, b: 2 }, { a: 10 }).should.eql({ a: 10, b: 2 })
  })

  it('should not override anything if no properties are supplied', function () {
    override({ a: 1, b: 2 }, {}).should.eql({ a: 1, b: 2 })
  })

  it('should only override properties that the object already has', function () {
    override({ a: 1, b: 2 }, { c: 10 }).should.eql({ a: 1, b: 2 })
  })

})