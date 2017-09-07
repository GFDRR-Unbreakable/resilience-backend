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
        var rData = req.body;
        var inputD = null;
        setPDFDirectories();
        if (rData.page === 'tech') {
            inputD = getHTMLHelperProcess(rData);
        }
        var file = rData.page === 'tech' ? 'technical_map_template.html' : 'viewer_template.html';
        var compiledHTML = compilePDFTemplate(file)(rData);
        if (inputD) {
            compiledHTML = compiledHTML.split('[[INPUT_SLIDERS]]').join(inputD);
        }
        var reportDir = process.env.VIEWER_TEMPLATE_DIRECTORY;
        var reportFile =  rData.page === 'tech' ? '/technical_map_report_tmp.html' : '/viewer_report_tmp.html';
        var fullPath = reportDir + reportFile;
        fs.writeFile(fullPath, compiledHTML, function (err) {
            if (err) {
                handleError(res, err);
            }
            var html = fs.readFileSync(fullPath, 'utf8');
            var phantomJSPath = path.resolve('node_modules/phantomjs-prebuilt/bin/phantomjs');
            var options = {
                phantomPath: phantomJSPath,
                format: 'Letter'
            };
            console.log('Starting creating pdf...');
            htmlPdf.create(html, options).toBuffer(function (err, buffer) {
                if (err) {
                    handleError(res, err);
                }
                console.log('Finishing creating pdf...');
                fs.unlinkSync(fullPath);
                var data = [];
                data.push(buffer);
                var pdfContent = Buffer.concat(data).toString('base64');
                res.header("Access-Control-Allow-Headers", "X-Requested-With");
                res.header('Content-Type', 'application/pdf');
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
        var csvDir = process.env.VIEWER_CSV_DIRECTORY;
        var csvFileName = '/viewer_report.csv';
        var fullPath = csvDir + csvFileName;
        var csv = json2csv({data: data, fields: fields});
        console.log("Data generated: ", data);
        fs.writeFile(fullPath, csv, function (err) {
            if (err) {
                handleError(res, err);
            }
            var csvFile = fs.readFileSync(fullPath, 'utf8');
            res.header('Content-Type', 'text/csv');
            res.send(csvFile);
        });
    }
};

function outputFN() {
    function porcentajePixel(min, max, centro) {
        var totalCalcular, centroPorcentaje, barra_color, circulo, numero, avancePX;
        var idColor = "", idFigura = "", idNumber = "";
        /*=== validamos los datos que ingresen ===*/
        min = min || 0;
        max = max || 320;
        centro = centro || 0;

        for (var i = 1; i <= 10; i++) {
            idColor = "color" + i;
            idFigura = "figura" + i;
            idNumber = "number" + i;
            barra_color = document.getElementById(idColor);
            circulo = document.getElementById(idFigura);
            numero = document.getElementById(idNumber);
            if (max > min && centro <= max && centro >= min) {
                totalCalcular = max - min;
                /*=== aqui 100 es en porcentaje ===*/
                centroPorcentaje = ((centro - min) * 100) / totalCalcular;
                centroPorcentaje = Math.round(centroPorcentaje);
                avancePX = (centroPorcentaje * 80) / 100;
                barra_color.style.width = avancePX + "px";
                /*=== El -10 significa el radio del circulo ===*/
                avancePX = avancePX - 10;
                circulo.style.left = avancePX + "px";
                /*=== El +20 es 10 del radio y un margind igual 10 para que se vea separado ===*/
                avancePX = avancePX + 20;
                numero.style.left = avancePX + "px";
                numero.innerHTML = centroPorcentaje + '%';

                console.log("Minimo: " + min, "Maximo: " + max, "Centro: " + centro);
                console.log("Total sobre cual calcular el porcentaje: " + totalCalcular);
                console.log(centro, "Es: " + centroPorcentaje + "%");
            }
            else {
                console.log("No Es Posible Calcular El Porcentaje");
            }

        }

    }

    //Recive como datos min, max, numeroCentro
    var min = Math.round(Math.random() * 100);
    var max = Math.round(Math.random() * 100);
    var centro = Math.round(Math.random() * 100);
    porcentajePixel(min, max, centro);
}


function compilePDFTemplate(file) {
    var filePath = process.env.VIEWER_TEMPLATE_DIRECTORY;
    filePath += '/' + file;
    filePath = path.resolve(filePath);
    var template = fs.readFileSync(filePath, 'utf8');
    return Handlebars.compile(template);
}
function getSliderDrawingValues(data) {
    var max = data.max;
    var MAX_BAR_WIDTH = 80;
    var min = data.min;
    var currentVal = data.value;
    var diffMaxMin = max - min;
    var percentage = ((currentVal - min) * 100) / diffMaxMin;
    var pixels = (percentage * MAX_BAR_WIDTH) / 100;
    return {
        percentage: percentage,
        pixels: pixels
    };
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
                        fields.push(out[outK].label);
                    }
                }
                for (var inK in inD) {
                    if (inD.hasOwnProperty(inK)) {
                        for (var inoK in inD[inK]) {
                            if (inD[inK].hasOwnProperty(inoK)) {
                                fields.push(inD[inK][inoK].label);
                            }
                        }
                    }
                }
            }
            var objData = {};
            objData['name'] = resData[key]['name'];
            for (var outp in out) {
                if (out.hasOwnProperty(outp)) {
                    objData[out[outp].label] = out[outp].value;
                }
            }
            for (var inp in inD) {
                if (inD.hasOwnProperty(inp)) {
                    for (var inoKe in inD[inp]) {
                        if (inD[inp].hasOwnProperty(inoKe)) {
                            objData[inD[inp][inoKe].label] = inD[inp][inoKe].value;
                        }
                    }
                }
            }
            data.push(objData);
        }
    }
}
function getFormattedHTML(htmlTxt) {
    var prefix = htmlTxt.slice(0, htmlTxt.indexOf('>') + 1);
    var suffix = htmlTxt.slice(htmlTxt.lastIndexOf('<'), htmlTxt.lastIndexOf('>') + 1);
    htmlTxt = htmlTxt.replace(prefix, '').replace(suffix, '').trim();
    return htmlTxt;
}
function setCSVDirectories() {
    var dir = __dirname + '/data/viewer_csv';
    dir = path.resolve(dir);
    var files = fs.readdirSync(dir);
    console.log('- - - - Access CSV files - - - -');
    console.log(files);
    process.env.VIEWER_CSV_DIRECTORY = dir;
}
function getHTMLHelperProcess(data) {
    Handlebars.registerHelper('input', function (options) {
        var data = this;
        var inputs1 = data['country1'].inputs;
        var inputs2 = data['country2'].inputs;
        var template = '';
        var inputsTitle = function (key) {
            switch (key) {
                case 'inputSoc':
                    return 'Social Protection';
                case 'inputEco':
                    return 'Economics';
                case 'inputExp':
                    return 'Exposure';
                case 'inputVul':
                    return 'Vulnerability';
                default:
                    return '';
            }
        };
        var inputType1;
        var inputType2;
        var values;
        var type;
        for (var inKey in inputs1) {
            if (inputs1.hasOwnProperty(inKey) && inputs2.hasOwnProperty(inKey)) {
                template += '<tr>';
                template += '<td colspan="5" style="border-bottom: 1px solid #f4f5fa; border-right: 1px solid #f4f5fa;">';
                template += '<span class="titulo">' + inputsTitle(inKey) + '</span>';
                template += '<span class="titulo-normal" style="padding-left: 20px">' + data['country1'].name + '</span>';
                template += '<span class="titulo-normal" style="padding-left: 50px">' + data['country2'].name + '</span>';
                template += '</td>';
                template += '</tr>';
                inputType1 = inputs1[inKey];
                inputType2 = inputs2[inKey];
                for (type in inputType1) {
                    if (inputType1.hasOwnProperty(type) && inputType2.hasOwnProperty(type)) {
                        template += '<tr>';
                        values = getSliderDrawingValues(inputType1[type]);
                        template += '<td class="titulo">' + inputType1[type].label + '</td>';
                        template += '<td colspan="2">';
                        template += '<p class="text-result">' + (+inputType1[type].value).toFixed(6) + '</p>';
                        template += '<div class="slider-wrapper">';
                        template += '<div class="slider-ebar"></div>';
                        template += '<div class="slider-fill" style="width: ' + values.percentage + '% "></div>';
                        template += '<div class="slider-thumb" style="left: ' + (values.pixels - 5) + 'px"></div>';
                        template += '</div>';
                        template += '</td>';
                        values = getSliderDrawingValues(inputType2[type]);
                        template += '<td colspan="2" style="border-right: 1px solid #f4f5fa;">';
                        template += '<p class="text-result">' + inputType2[type].value + '</p>';
                        template += '<div class="slider-wrapper">';
                        template += '<div class="slider-ebar"></div>';
                        template += '<div class="slider-fill" style="width: ' + values.percentage + '% "></div>';
                        template += '<div class="slider-thumb" style="left: ' + (values.pixels - 5) + 'px"></div>';
                        template += '</div>';
                        template += '</td>';
                        template += '</tr>';
                    }
                }
            }
        }
        return template;
    });
    var viewerDir = process.env.VIEWER_TEMPLATE_DIRECTORY;
    var helperFile = '/input_helper.html';
    var fullHPath = viewerDir + helperFile;
    var helperHtml = fs.readFileSync(fullHPath, 'utf8');
    var template = Handlebars.compile(helperHtml);
    var compiledHTML = template(data);
    return getFormattedHTML(compiledHTML);
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
