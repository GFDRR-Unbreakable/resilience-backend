var restify = require('restify');
var apiFns = require('./api');
var helmet = require('helmet');
const corsMiddleware = require('restify-cors-middleware');

/**
 * Set CORS object configuration in the corsMiddleware library. 
 */
const cors = corsMiddleware({
    preflightMaxAge: 5, //Optional
    origins: ['*'],
    allowHeaders: ['*'],
    exposeHeaders: ['*']
});

/**
 * Set default configuration for the Restify server like using CORS middleware and set request body-param custom configuration.
 */
var port = 9090;
var server = restify.createServer();
server.pre(cors.preflight);
server.use(cors.actual);
server.use(helmet());
server.use(restify.plugins.bodyParser({maxBodySize: 104857600}));
/**
 * Defined endpoint routes for the server to be persisted from any REST client.
 */
server.get('/api/output_data', apiFns.getOutputData);
server.post('/api/pdf', apiFns.createViewerPDFFile);
server.post('/api/sc_pdf', apiFns.createScorecardPDFFile);
server.post('/api/csv', apiFns.createCSVFile);

/**
 * Run a custom server using a custom port and logging its basic properties
 */
server.listen(port, function() {
  console.log('%s listening at %s', server.name, server.url);
});
