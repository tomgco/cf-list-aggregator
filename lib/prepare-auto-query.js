module.exports = prepareAutoQuery

function prepareAutoQuery(list) {

  /* jshint maxcomplexity: 9 */

  var q = { query: {}, options: {}, overrides: null }

  if (Array.isArray(list.tags) && list.tags.length) {
    q.query.tags = { $in: list.tags }
  }

  if (Array.isArray(list.sections) && list.sections.length) {
    q.query.section = { $in: list.sections }
  }

  if (Array.isArray(list.articleTypes) && list.articleTypes.length) {
    q.query.type = { $in: list.articleTypes }
  }

  if (Array.isArray(list.articleSubTypes) && list.articleSubTypes.length) {
    q.query.subType = { $in: list.articleSubTypes }
  }

  switch (list.order) {
  case 'recent':
    q.options.sort = [ [ 'displayDate', 'desc' ] ]
    break
  case 'most comments':
    q.options.sort = [ [ 'commentCount', 'desc' ] ]
    break
  case 'popular':
    q.options.sort = [ [ 'viewCount', 'desc' ] ]
    break
  case 'alphabetical':
    q.options.sort = [ [ 'shortTitle', 'asc' ] ]
    break
  }

  return q

}