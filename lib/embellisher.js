module.exports = createEmbellisher

var darkroomUrlBuilder = require('../darkroom-url-builder')

/*
 * Creates a function that will embellish each article in
 * a list with properties (values and methods) that
 * are expected to exist by the rest of the system –
 * e.g. __fullUrlPath and getImage()
 */
function createEmbellisher(serviceLocator) {

  function embellishArticles(articles) {
    return articles.map(function (article) {
      return embellishArticle(article)
    })
  }

  function embellishArticle(article) {

    // If it has a link then if must be a custom item
    if (article.link) article.__fullUrlPath = article.link

    darkroomUrlBuilder(
        article.images
      , article.crops
      , serviceLocator.properties.darkroomApiUrl
      , serviceLocator.properties.darkroomSalt)

    return article

  }

  return embellishArticles

}
