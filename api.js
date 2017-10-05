var fs = require('fs');
var path = require('path');
var htmlPdf = require('html-pdf');
var Handlebars = require('handlebars');
var json2csv = require('json2csv');
var selfPath = __dirname;

module.exports = {
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
    },
    createScorecardPDFFile: function (req, res, next) {
        var rData = req.body;
        console.log('Request body', JSON.stringify(rData));
        setPDFDirectories(true);
        formatChartNumValues(rData);
        rData.reportDate = getReportDate();
        var file = rData.page === 'policyList' ? 'policy_list_template.html' : 'policy_scenario_template.html';
        var compiledHTML = compilePDFTemplate(file, true)(rData);
        var reportDir = process.env.SCORECARD_TEMPLATE_DIRECTORY;
        var reportFile =  rData.page === 'policyList' ? '/policy_list_report_tmp.html' : '/policy_scenario_report_tmp.html';
        var fullPath = reportDir + reportFile;
        setPDFResponseConf(res, fullPath, compiledHTML);
    },
    createViewerPDFFile: function (req, res, next) {
        var rData = req.body;
        var inputComp = null;
        setPDFDirectories(false);
        formatChartNumValues(rData);
        var mapTypeComp = getViewerHTMLHelperProcess(rData);
        var hazardSelComp = getHazardSelHTMLHelperProcess(rData);
        rData.reportDate = getReportDate();
        if (rData.page === 'tech') {
            inputComp = getTechHTMLHelperProcess(rData);
        }
        var file = rData.page === 'tech' ? 'technical_map_template.html' : 'viewer_template.html';
        var compiledHTML = compilePDFTemplate(file, false)(rData);
        compiledHTML = compiledHTML.split('[[MAP_TYPE]]').join(mapTypeComp);
        compiledHTML = compiledHTML.split('[[HAZARD_SELECTION]]').join(hazardSelComp);
        if (inputComp) {
            compiledHTML = compiledHTML.split('[[INPUT_SLIDERS]]').join(inputComp);
        }
        var reportDir = process.env.VIEWER_TEMPLATE_DIRECTORY;
        var reportFile =  rData.page === 'tech' ? '/technical_map_report_tmp.html' : '/viewer_report_tmp.html';
        var fullPath = reportDir + reportFile;
        setPDFResponseConf(res, fullPath, compiledHTML);
    },
    getOutputData: function (req, res, next) {
        var csvFile = selfPath + '/data/df2.csv';
        fs.readFile(csvFile, function (err, data) {
            if (err) return handleError(res, err);
            res.setHeader('Content-Type', 'text/csv');
            res.writeHead(200);
            res.end(data);
        });
    }
};

function compilePDFTemplate(file, isScorecard) {
    var filePath;
    if (isScorecard) {
        filePath = process.env.SCORECARD_TEMPLATE_DIRECTORY;
    } else {
        filePath = process.env.VIEWER_TEMPLATE_DIRECTORY;
    }
    filePath += '/' + file;
    filePath = path.resolve(filePath);
    var template = fs.readFileSync(filePath, 'utf8');
    return Handlebars.compile(template);
}
function formatChartNumValues(data) {
    var outputs1 = data['country1']['outputs'];
    var outputs2 = data['country2']['outputs'];
    var formatDollarValue = function(dollar) {
        var aThousand = 1000;
        dollar = +dollar;
        if (dollar >= aThousand) {
            if (dollar % aThousand === 0) {
                dollar /= aThousand;
                dollar += ',000';
            } else {
                dollar /= aThousand;
                dollar = dollar.toFixed(3);
                dollar = dollar.replace('.', ',');
            }
        }
        return '$' + dollar;
    }; 
    for (var key in outputs1) {
        if (outputs1.hasOwnProperty(key) && outputs2.hasOwnProperty(key)) {
            if (key.indexOf('risk') >= 0) {
               outputs1[key].value.dollarGDP = formatDollarValue(outputs1[key].value.dollarGDP); 
               outputs2[key].value.dollarGDP = formatDollarValue(outputs2[key].value.dollarGDP); 
            }
        }
    }
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
                        var label = out[outK].label;
                        if (outK === 'resilience') {
                            label += ' - Pcnt';
                            fields.push(label);                        
                        } else {
                            fields.push(label + ' - US, Millions');
                            fields.push(label);
                        }
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
                    var label = out[outp].label;
                    var label2;
                    if (outp === 'resilience') {
                        label += ' - Pcnt';
                        objData[label] = out[outp].value + '%';
                    } else {
                        label2 = label + ' - US, Millions';
                        objData[label] = out[outp].value['valueGDP'] + '%';
                        objData[label2] = '$' + out[outp].value['dollarGDP'];
                    }
                    
                }
            }
            for (var inp in inD) {
                if (inD.hasOwnProperty(inp)) {
                    for (var inoKe in inD[inp]) {
                        if (inD[inp].hasOwnProperty(inoKe)) {
                            objData[inD[inp][inoKe].label] = inD[inp][inoKe].value['label'];
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
function getTechHTMLHelperProcess(data) {
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
        var count = 0;
        var pixelValue;
        for (var inKey in inputs1) {
            if (inputs1.hasOwnProperty(inKey) && inputs2.hasOwnProperty(inKey)) {
                template += '<tr>';
                var colSpan = inKey === 'inputSoc' ? '1' : '5';
                var borderR = inKey !== 'inputSoc' ? '' : '';
                template += '<td colspan="' + colSpan + '"style="border-bottom: 1px solid #f4f5fa;' + borderR +'"><span style="font-weight: bold; font-size: 8px;">' + inputsTitle(inKey) + ' <i class="mdi mdi-information-outline"></i></span></td>';
                if (inKey === 'inputSoc') {
                    template += '<td colspan="2" style="border-bottom: 1px solid #f4f5fa;"><p class="titulo-normal" style="text-align:center;">' + data['country1'].name + '</p></td>';
                    template += '<td colspan="2" style="border-bottom: 1px solid #f4f5fa;"><p class="titulo-normal" style="text-align:center;">' + data['country2'].name + '</p></td>';
                }
                template += '</tr>';
                inputType1 = inputs1[inKey];
                inputType2 = inputs2[inKey];
                for (type in inputType1) {
                    if (inputType1.hasOwnProperty(type) && inputType2.hasOwnProperty(type)) {
                        template += '<tr>';
                        if (data['country1'].name === 'Global') {
                            values = getSliderDrawingValuesByPercentage(inputType1[type])
                        } else {
                            values = getSliderDrawingValuesByValue(inputType1[type]);
                        }
                        // values = getSliderDrawingValues(inputType1[type]);
                        // pixelValue = getSliderPorcentageValue(inputType1[type]);
                        template += '<td style="font-size:6px;">' + inputType1[type].label + '</td>';
                        template += '<td colspan="2">';
                        // template += '<p class="text-result">' + (+inputType1[type].value).toFixed(3) + '</p>';
                        template += '<p class="text-result">' + inputType1[type].value.label + '</p>';
                        template += '<div class="slider-wrapper">';
                        template += '<div class="slider-ebar"></div>';
                        template += '<div class="slider-fill" style="width: ' + values.percentage + '% "></div>';
                        // template += '<div class="slider-fill" style="width: ' + (+inputType1[type].value.value) + '% "></div>';
                        template += '<div class="slider-thumb" style="left: ' + (values.pixels - 5) + 'px"></div>';
                        // template += '<div class="slider-thumb" style="left: ' + (pixelValue - 5) + 'px"></div>';
                        template += '</div>';
                        template += '</td>';
                        if (data['country2'].name === 'Global') {
                            values = getSliderDrawingValuesByPercentage(inputType2[type])
                        } else {
                            values = getSliderDrawingValuesByValue(inputType2[type]);
                        }
                        // values = getSliderDrawingValues(inputType2[type]);
                        // pixelValue = getSliderPorcentageValue(inputType2[type]);
                        template += '<td colspan="2">';
                        // template += '<p class="text-result">' + (+inputType2[type].value).toFixed(3) + '</p>';
                        template += '<p class="text-result">' + inputType2[type].value.label + '</p>';
                        template += '<div class="slider-wrapper">';
                        template += '<div class="slider-ebar"></div>';
                        template += '<div class="slider-fill" style="width: ' + values.percentage + '% "></div>';
                        // template += '<div class="slider-fill" style="width: ' + (+inputType1[type].value.value) + '% "></div>';
                        template += '<div class="slider-thumb" style="left: ' + (values.pixels - 5) + 'px"></div>';
                        // template += '<div class="slider-thumb" style="left: ' + (pixelValue - 5) + 'px"></div>';
                        template += '</div>';
                        template += '</td>';
                        template += '</tr>';
                    }
                }
                if (count === 1) {
                    template += '<tr>';
                    template += '<td>';
                    template += '<div class="empty-ctn"></div>';
                    template += '</td>';
                    template += '</tr>';
                }
                count++;
            }
        }
        return template;
    });
    var viewerDir = process.env.VIEWER_TEMPLATE_DIRECTORY;
    var inHelperFile = '/input_helper.html';
    var fullHPath = viewerDir + inHelperFile;
    var inHelperHtml = fs.readFileSync(fullHPath, 'utf8');
    var inTemplate = Handlebars.compile(inHelperHtml);
    var inCompiledHTML = inTemplate(data);
    return getFormattedHTML(inCompiledHTML);
}
function getHazardSelHTMLHelperProcess(data) {
    Handlebars.registerHelper('hazardType', function () {
        var data = this;
        var txt = '';
        // Flood, Earthquake, Tsunamis, and Extreme Wind
        var selectedHazards = data['selectedHazards'];
        if (selectedHazards['hazard1']) {
            txt += 'Flood|';
        }
        if (selectedHazards['hazard2']) {
            txt += 'Earthquake|';
        }
        if (selectedHazards['hazard3']) {
            txt += 'Tsunamis|';
        }
        if (selectedHazards['hazard4']) {
            txt += 'Extreme Wind|';
        }
        var txtArr = txt.split('|').filter(function (val) { return val.trim().length; });
        if (txtArr.length) {
            switch (txtArr.length) {
                case 1:
                    txt = txtArr[0];
                    break;
                case 2:
                    txt = txtArr[0] + ' and ' + txtArr[1];
                    break;
                case 3:
                    txt = txtArr[0] + ', ' + txtArr[1] +' and ' + txtArr[2];
                    break;
                case 4:
                    txt = txtArr[0] + ', ' + txtArr[1] + ', ' + txtArr[2] +' and ' + txtArr[3];
                    break;
                default:
                    break;
            }
        } else {
            txt = '-';
        }
        return txt;
    });
    var viewerDir = process.env.VIEWER_TEMPLATE_DIRECTORY;
    var hazardFile = '/hazard_sel_helper.html';
    var fullHPath = viewerDir + hazardFile;
    var hHelperHtml = fs.readFileSync(fullHPath, 'utf8');
    var hTemplate = Handlebars.compile(hHelperHtml);
    var hCompiledHTML = hTemplate(data);
    return getFormattedHTML(hCompiledHTML);
}
function getViewerHTMLHelperProcess(data) {
    Handlebars.registerHelper('mapType', function () {
        var data = this;
        var output = data['country1']['outputs'];
        switch (data.map.type) {
            case 'socio':
                return output['resilience']['label'] + ' : ' + data['country1']['name'] + ' ' + output['resilience']['value'] + '%';
            case 'asset':
                return output['risk_to_assets']['label'] + ' : ' + data['country1']['name'] + ' ' + output['risk_to_assets']['value']['dollarGDP'] + ' Million (' + output['risk_to_assets']['value']['valueGDP'] + '% of GPD per Year)';
            case 'well':
                return output['risk']['label'] + ' : ' + data['country1']['name'] + ' ' + output['risk']['value']['dollarGDP'] + ' Million (' + output['risk']['value']['valueGDP'] + '% of GPD per Year)';
        }
    });
    var viewerDir = process.env.VIEWER_TEMPLATE_DIRECTORY;
    var mapHelperFile = '/map_type_helper.html';
    var fullMPath = viewerDir + mapHelperFile;
    var mapHelperHtml = fs.readFileSync(fullMPath, 'utf8');
    var mapTemplate = Handlebars.compile(mapHelperHtml);
    var mapCompiledHTML = mapTemplate(data);
    return getFormattedHTML(mapCompiledHTML)
}
function getReportDate() {
    var date = new Date();
    var months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return months[date.getMonth()] + ' ' + date.getDate() + ', ' + date.getFullYear();
}
function getSliderDrawingValuesByValue(data) {
    var max = data.max;
    var MAX_BAR_WIDTH = 50;
    var min = data.min;
    var currentVal = data.value.value;
    var diffMaxMin = max - min;
    var percentage = ((currentVal - min) * 100) / diffMaxMin;
    var pixels = (percentage * MAX_BAR_WIDTH) / 100;
    return {
        percentage: percentage,
        pixels: pixels
    };
}
function getSliderDrawingValuesByPercentage(data) {
    var MAX_BAR_WIDTH = 50;
    var percentage = data.value.value;
    var pixels = (percentage * MAX_BAR_WIDTH) / 100;
    return {
        percentage: percentage,
        pixels: pixels
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
function setPDFDirectories(isScorecard) {
    var dir;
    var files;
    if (isScorecard) {
        dir = __dirname + '/data/policy_pdf_template';
        dir = path.resolve(dir);
        files = fs.readdirSync(dir);
        console.log('- - - - Access PDF Template files - - - -');
        console.log(files);
        process.env.SCORECARD_TEMPLATE_DIRECTORY = dir;
    } else {
        dir = __dirname + '/data/viewer_pdf_template';
        dir = path.resolve(dir);
        files = fs.readdirSync(dir);
        console.log('- - - - Access PDF Template files - - - -');
        console.log(files);
        process.env.VIEWER_TEMPLATE_DIRECTORY = dir;
    }
}
function setPDFResponseConf(res, fullPath, compiledHTML) {
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
}

function handleError(res, err) {
    return res.send(err);
}
