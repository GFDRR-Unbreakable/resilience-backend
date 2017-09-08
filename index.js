var restify = require('restify');
var apiFns = require('./api');
const corsMiddleware = require('restify-cors-middleware');

const cors = corsMiddleware({
    preflightMaxAge: 5, //Optional
    origins: ['*'],
    allowHeaders: ['*'],
    exposeHeaders: ['*']
});

var port = 9090;
var server = restify.createServer();
server.pre(cors.preflight);
server.use(cors.actual);
server.use(restify.plugins.bodyParser({maxBodySize: 104857600}));

server.get('/api/output_data', apiFns.getOutputData);
server.post('/api/pdf', apiFns.createViewerPDFFile);
server.post('/api/csv', apiFns.createCSVFile);


server.listen(port, function() {
  console.log('%s listening at %s', server.name, server.url);
});
