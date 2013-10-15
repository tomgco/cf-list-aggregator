var save = require('save')
  , memgo = require('save-memgo')
  , sectionSave = save('section', { engine: memgo(), debug: true })
  , schemata = require('schemata')
  , crudService = require('crud-service')
  , schema = schemata(
    { _id:
      { type: String
      }
    , created:
      { type: Date
      , defaultValue: function () { return new Date() }
      }
    })

module.exports = function() {
  var service = crudService('section', sectionSave, schema)
  return service
}