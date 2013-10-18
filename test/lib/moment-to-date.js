module.exports =function momentToDate(date) {
  return date.startOf('day').toDate()
}
