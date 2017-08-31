var fs = require('fs');
var path = require('path');
var htmlPdf = require('html-pdf');
var Handlebars = require('handlebars');
var json2csv = require('json2csv');
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
    };
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
  },
  createCSVFile: function (req, res, next) {
    var resData = req.body;
    setCSVDirectories();
    var data = [];
    var fields = [];
    formatCSVData(resData, data, fields);
    console.log(fields);
    console.log(data);
    var csvDir = process.env.VIEWER_CSV_DIRECTORY;
    var csvFileName = '/viewer_report.csv';
    var fullPath = csvDir + csvFileName;
    var csv = json2csv({ data: data, fields: fields });
    fs.writeFile(fullPath, csv, function (err) {
        if (err) { handleError(res, err); }
        var csvFile = fs.readFileSync(fullPath, 'utf8');
        // res.header("Access-Control-Allow-Headers", "X-Requested-With, Content-Type");
        // res.header('Access-Control-Allow-Headers', 'Content-Type');
        res.header('Content-Type', 'text/csv');
        res.send(csvFile);
    });
  }
};

function compilePDFTemplate() {
  var filePath = process.env.VIEWER_TEMPLATE_DIRECTORY;
  filePath += 'viewer_template.html';
  filePath = path.resolve(filePath);
  var template = fs.readdirSync(filePath, 'utf8');
  return Handlebars.compile(template);
}
function formatCSVData(resData, data, fields) {
  for (var key in resData) {
    if (resData.hasOwnProperty(key)) {
      var out = resData[key]['outputs'];
      var inD = resData[key]['inputs'];
      if (!fields.length) {
        fields.push('name');
        for (var outK in out) {
          if (out.hasOwnProperty(outK)) {
            fields.push({
              label: out[outK].label
            });
          }
        }
        for (var inK in inD) {
          if (inD.hasOwnProperty(inK)) {
            for (var inoK in inD[inK]) {
              if (inD[inK].hasOwnProperty(inoK)) {
                fields.push({
                  label: inD[inK][inoK].label
                });
              }
            }
          }
        }
      }
      var objData = {};
      objData['name'] = resData[key]['name'];
      for (var outp in out) {
        if (out.hasOwnProperty(outp)) {
            objData[out[outp].label] = objData[out[outp].value];
        }
      }
      for (var inp in inD) {
        if (inD.hasOwnProperty(inp)) {
          for (var inoKe in inD[inp]) {
              if (inD[inp].hasOwnProperty(inoKe)) {
                  objData[inD[inp][inoKe].label] = objData[inD[inp].value];
              }
          }
        }
      }
      data.push(objData);
    }
  }
}
function setCSVDirectories() {
    var dir = __dirname + '/data/viewer_csv';
    dir = path.resolve(dir);
    var files = fs.readdirSync(dir);
    console.log('- - - - Access CSV files - - - -');
    console.log(files);
    process.env.VIEWER_CSV_DIRECTORY = dir;
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
