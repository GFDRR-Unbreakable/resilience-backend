var fs = require('fs');
var path = require('path');
var htmlPdf = require('html-pdf');
var HandleBars = require('handlebars');
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
  },
  createPDFFile: function (req, res, next) {
    var data = {
      test: req.body.test
    }
    setPDFDirectories();
    var compiledHTML = compilePDFTemplate()(data);
    var reportDir = process.env.VIEWER_TEMPLATE_DIRECTORY;
    var reportFileTxt = '/viewer_report.html';
    fs.writeFile(reportDir + reportFileTxt, compiledHTML, function (err) {
      if (err) { handleError(res, err); }
      var html = fs.readFileSync(reportDir + reportFileTxt, 'utf8');
      var phantomJSPath = path.resolve('node_modules/phantomjs-prebuilt/bin/phantomjs');
      var options = {
        phantomPath: phantomJSPath,
        format: 'Letter'
      };
      console.log('Starting creating pdf...');
      htmlPdf.create(html, options).toBuffer(function (err, buffer) {
        if (err) { handleError(res, err); }
        console.log('Finishing creating pdf...');
        fs.unlinkSync(reportDir + reportFileTxt);
        var data = [];
        data.push(buffer);
        var pdfContent = Buffer.concat(data).toString('base64');
        res.header("Access-Control-Allow-Headers", "X-Requested-With");
        res.header('content-type', 'application/pdf');
        res.send(pdfContent);
      });
    });
  }
}

function compilePDFTemplate() {
  var filePath = process.env.VIEWER_TEMPLATE_DIRECTORY;
  filePath += 'viewer_template.html';
  filePath = path.resolve(filePath);
  var template = fs.readdirSync(filePath, 'utf8');
  return Handlebars.compile(template);
}

function setPDFDirectories() {
  var dir = __dirname + '/data/viewer_pdf_template';
  dir = path.resolve(dir);
  var files = fs.readdirSync(dir);
  console.log('- - - - Access PDF Template files - - - -');
  console.log(files);
  process.env.VIEWER_TEMPLATE_DIRECTORY = dir;
}
 
function handleError(res, err) {
  return res.send(err);
}
