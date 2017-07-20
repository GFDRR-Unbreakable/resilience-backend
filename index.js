var restify = require('restify');
var apiFns = require('./api');

function corsHeaders(req, res, next) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Request-Method', '*');
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET, POST');
  res.setHeader('Access-Control-Allow-Headers', '*');
  next();
}
function serveOptions(req, res, next) {
    res.send(200);
}

var port = 9090;
var server = restify.createServer();

server.use(corsHeaders);

server.get('/api/output_data', apiFns.getOutputData);
server.opts(/./, serveOptions);

server.listen(port, function() {
  console.log('%s listening at %s', server.name, server.url);
})
