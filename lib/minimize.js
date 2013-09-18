module.exports = minimize

var _ = require('lodash')
  , minimizeFields =
      [ '_id'
      , 'type'
      , 'shortTitle'
      , 'longTitle'
      , 'subTitle'
      , 'crops'
      , '__fullUrlPath'
      , '__liteSection'
      , 'displayDate'
      , 'showDisplayDate'
      , 'tags'
      , 'images'
      , 'downloads'
      , 'commentCount'
      , 'viewCount'
      , 'standfirst'
      ]

/*
 * Reduces an article to just the desired properties
 */
function minimize(article) {
  var minimalArticle = _.pick(article, minimizeFields)
  return minimalArticle
}