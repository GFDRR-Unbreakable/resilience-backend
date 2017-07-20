var fs = require('fs');
var selfPath = __dirname;

module.exports = {
  getOutputData: function (req, res, next) {
    var csvFile = selfPath + '/data/df2.csv';
    fs.readFile(csvFile, function (err, data) {
      if (err) return handleError(res, err);
      res.setHeader('Content-Type', 'text/csv');
      res.writeHead(200);
      res.end(data);
    });
  }
}

function handleError(res, err) {
  return res.send(err);
}
