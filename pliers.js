module.exports = tasks

function tasks(pliers) {

  pliers('test', function (done) {
    pliers.exec('./node_modules/.bin/mocha ', done)
  })

  pliers('lint', function (done) {
    pliers.exec('./node_modules/jshint/bin/jshint .', done)
  })
}