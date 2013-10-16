var save = require('save')
  , schemata = require('schemata')
  , crudService = require('crud-service')
  , logger = require('./null-logger')
  , schema = schemata(
    { _id:
      { type: String
      }
    , created:
      { type: Date
      , defaultValue: function () { return new Date() }
      }
    })

module.exports = function(saveEngine) {
  return function () {
    var sectionSave = save('section', { engine: saveEngine, debug: false, logger: logger })
    , service = crudService('section', sectionSave, schema)

    return service
  }
}