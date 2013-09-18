module.exports = prepareManualQuery

function prepareManualQuery(list, IdType) {

  var q = { query: {}, options: {}, overrides: null }
    , ids = []

  list.articles.forEach(function (article) {
    if (article.type !== 'custom') {
      var articleId = new IdType(article.articleId)
      ids.push({ _id: articleId })
    }
  })

  if (ids.length > 0) {
    q.query = { $or: ids }
  } else {
    q.query._id = { $in: ids }
  }

  q.overrides = list.articles

  return q

}