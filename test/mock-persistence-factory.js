var save = require('save')

module.exports = function () {
  var instances = {}

  function register(collectionName) {

    if (instances[collectionName]) {
      throw new Error(collectionName + ' already registered')
    }

    instances[collectionName] =
      save(collectionName,
        { debug: true
        })
    return get
  }

  function get(collectionName) {
    if (!instances[collectionName]) {
      throw new Error('Persistence not registered \'' + collectionName + '\'')
    }
    return instances[collectionName]
  }
  get.register = register
  return get
}