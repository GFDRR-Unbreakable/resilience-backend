var restify = require('restify');
var apiFns = require('./api');

function corsHeaders(req, res, next) {
  req.setRequestHeader('Access-Control-Request-Headers', "Origin, Accept, X-Requested-With, Content-Type");
  req.setRequestHeader('Access-Control-Request-Method', "GET, POST, OPTIONS");
  res.setHeader('Access-Control-Allow-Origin', "*");
  res.setHeader('Access-Control-Allow-Headers', "Origin, Accept, X-Requested-With, Content-Type");
  res.setHeader('Access-Control-Allow-Methods', "GET, POST, OPTIONS");
  next();
}
function serveOptions(req, res, next) {
    res.send(200);
}

var port = 9090;
var server = restify.createServer();

server.use(corsHeaders);

server.get('/api/output_data', apiFns.getOutputData);
server.post('/api/pdf', apiFns.createPDFFile);
server.post('/api/csv', apiFns.createCSVFile);
server.opts(/./, serveOptions);

server.listen(port, function() {
  console.log('%s listening at %s', server.name, server.url);
});
