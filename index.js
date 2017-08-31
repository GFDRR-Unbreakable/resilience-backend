var restify = require('restify');
var apiFns = require('./api');
const corsMiddleware = require('restify-cors-middleware');

const cors = corsMiddleware({
    preflightMaxAge: 5, //Optional
    origins: ['*'],
    allowHeaders: ['*'],
    exposeHeaders: ['*']
});

// function moreOpts(req, res, next) {
//   res.header('Access-Control-Allow-Origin', "*");
//   res.header('Access-Control-Allow-Headers', "Origin, Accept, X-Requested-With, Content-Type");
//   res.header('Access-Control-Allow-Methods', "GET, POST, OPTIONS");
//   res.send(200);
//   return next();
// }
// function serveOptions(req, res, next) {
//     res.send(200);
// }

var port = 9090;
var server = restify.createServer();
server.pre(cors.preflight);
server.use(cors.actual);
// server.use(restify.CORS());
// server.opts(/.*/, moreOpts);
server.get('/api/output_data', apiFns.getOutputData);
server.post('/api/pdf', apiFns.createPDFFile);
server.post('/api/csv', apiFns.createCSVFile);


server.listen(port, function() {
  console.log('%s listening at %s', server.name, server.url);
});
