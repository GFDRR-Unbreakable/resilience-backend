var fs = require('fs');
var path = require('path');
var htmlPdf = require('html-pdf');
var Handlebars = require('handlebars');
var json2csv = require('json2csv');
var selfPath = __dirname;

module.exports = {
    /**
     * This method gets called when the /api/csv enpoint is requested from the client side and it processes the requested data
     * to build a CSV file and returns it as a response to the client.
     * @param {Request} req - The request params of the endpoint.
     * @param {Response} res - The response params of the endpoint.
     * @param {Function} next - Middleware callback function which is invoked first every time the app receives a request.
     */
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
    /**
     * This method gets called when the /api/sc_pdf enpoint is requested from the client side and it processes the requested data
     * to build a Scorecard-related data PDF file and returns it as a response to the client.
     * @param {Request} req - The request params of the endpoint.
     * @param {Response} res - The response params of the endpoint.
     * @param {Function} next - Middleware callback function which is invoked first every time the app receives a request.
     */
    createScorecardPDFFile: function (req, res, next) {
        var rData = req.body;
        console.log('Request body', JSON.stringify(rData));
        setPDFDirectories(true);
        if (rData.page === 'policyList') {
            formatChartNumValues(rData);
        }
        rData.reportDate = getReportDate();
        var file = rData.page === 'policyList' ? 'policy_list_template.html' : 'policy_scenario_template.html';
        var compiledHTML = compilePDFTemplate(file, true)(rData);
        var reportDir = process.env.SCORECARD_TEMPLATE_DIRECTORY;
        var reportFile =  rData.page === 'policyList' ? '/policy_list_report_tmp.html' : '/policy_scenario_report_tmp.html';
        var fullPath = reportDir + reportFile;
        setPDFResponseConf(res, fullPath, compiledHTML);
    },
    /**
     * This method gets called when the /api/pdf enpoint is requested from the client side and it processes the requested data
     * to build a Viewer-TechMap-related data PDF file and returns it as a response to the client.
     * @param {Request} req - The HTTP request params of the endpoint.
     * @param {Response} res - The HTTP response params of the endpoint.
     * @param {Function} next - Middleware callback function which is invoked first every time the app receives a request.
     */
    createViewerPDFFile: function (req, res, next) {
        var rData = req.body;
        var inputComp1 = null;
        var inputComp2 = null;
        setPDFDirectories(false);
        formatChartNumValues(rData);
        var mapTypeComp = getViewerHTMLHelperProcess(rData);
        var hazardSelComp = getHazardSelHTMLHelperProcess(rData);
        rData.reportDate = getReportDate();
        if (rData.page === 'tech') {
            inputComp1 = getTechHTMLHelperProcess(rData, true);
            inputComp2 = getTechHTMLHelperProcess(rData, false);
        }
        var file = rData.page === 'tech' ? 'technical_map_template.html' : 'viewer_template.html';
        var compiledHTML = compilePDFTemplate(file, false)(rData);
        compiledHTML = compiledHTML.split('[[MAP_TYPE]]').join(mapTypeComp);
        compiledHTML = compiledHTML.split('[[HAZARD_SELECTION]]').join(hazardSelComp);
        if (inputComp1 && inputComp2) {
            compiledHTML = compiledHTML.split('[[INPUT_SLIDERS_1]]').join(inputComp1);
            compiledHTML = compiledHTML.split('[[INPUT_SLIDERS_2]]').join(inputComp2);
        }
        var reportDir = process.env.VIEWER_TEMPLATE_DIRECTORY;
        var reportFile =  rData.page === 'tech' ? '/technical_map_report_tmp.html' : '/viewer_report_tmp.html';
        var fullPath = reportDir + reportFile;
        setPDFResponseConf(res, fullPath, compiledHTML);
    },
    /**
     * This method gets called when the /api/output_data enpoint is requested from the client side and it processes the requested data
     * to build a Output-related data CSV file and returns it as a response to the client.
     * @param {Request} req - The HTTP request params of the endpoint.
     * @param {Response} res - The HTTP response params of the endpoint.
     * @param {Function} next - Middleware callback function which is invoked first every time the app receives a request.
     */
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
/**
 * Reads data PDF-related template files and returns a compiled HTML template so it can be executed immediately using Handlebars library.
 * @param {String} file - PDF File name 
 * @param {Boolean} isScorecard - Determines if the file comes from 'Scorecard' or 'Viewer' templates directory.
 */
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
/**
 * Formats numeric 'output' numeric data to be set in HTML template and generate a PDF file. 
 * @param {Object} data - Request body param
 */
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
/**
 * Prepares CSV-required formatted data to generate a CSV file by passing the request body data and two empty arrays which are
 * populated to be used for building the CSV file using the json2csv library.
 * @param {Object} resData - Request body param data.
 * @param {Array} data - Set of data to be used to generate the CSV file
 * @param {Array} fields - Set of fields or header labels to be used to generate the CSV file.
 */
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
/**
 * Returns a formatted HTML string to be used to generate PDF file from a pre-compiled HTML template.
 * @param {String} htmlTxt - HTML string generated from the Handlebars library.  
 */
function getFormattedHTML(htmlTxt) {
    var prefix = htmlTxt.slice(0, htmlTxt.indexOf('>') + 1);
    var suffix = htmlTxt.slice(htmlTxt.lastIndexOf('<'), htmlTxt.lastIndexOf('>') + 1);
    htmlTxt = htmlTxt.replace(prefix, '').replace(suffix, '').trim();
    return htmlTxt;
}
/**
 * Returns a new preprocesed-custom HTML string to be included in the final pre-compiled HTML template by then generate a PDF file.
 * This process grabs and builds input-related data passed from the request body data to display a slider-like html component.   
 * @param {Object} data - Request body param data
 * @param {Boolean} isFirstInput - Verifies if two of all four input factors are set to build the HTML template differently. 
 */
function getTechHTMLHelperProcess(data, isFirstInput) {
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
        var filteredInputs = {};
        for (var inputKey in inputs1) {
            if (inputs1.hasOwnProperty(inputKey) && inputs2.hasOwnProperty(inputKey)) {
                if (isFirstInput) {
                    if (inputKey === 'inputSoc' || inputKey === 'inputEco') {
                        filteredInputs[inputKey] = inputs1[inputKey];
                    }
                } else {
                    if (inputKey === 'inputExp' || inputKey === 'inputVul') {
                        filteredInputs[inputKey] = inputs1[inputKey];
                    }
                }
            }
        }
        for (var inKey in filteredInputs) {
            if (filteredInputs.hasOwnProperty(inKey) && inputs2.hasOwnProperty(inKey)) {
                template += '<tr>';
                var colSpan = inKey === 'inputSoc' ? '1' : '5';
                var borderR = inKey !== 'inputSoc' ? '' : '';
                template += '<td colspan="' + colSpan + '"style="border-bottom: 1px solid #f4f5fa;' + borderR +'"><span style="font-weight: bold; font-size: 8px;">' + inputsTitle(inKey) + ' <i class="mdi mdi-information-outline"></i></span></td>';
                if (inKey === 'inputSoc') {
                    template += '<td colspan="2" style="border-bottom: 1px solid #f4f5fa;"><p class="titulo-normal" style="text-align:center;">' + data['country1'].name + '</p></td>';
                    template += '<td colspan="2" style="border-bottom: 1px solid #f4f5fa;"><p class="titulo-normal" style="text-align:center;">' + data['country2'].name + '</p></td>';
                }
                template += '</tr>';
                inputType1 = filteredInputs[inKey];
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
                if (isFirstInput && count === 1) {
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
/**
 * Returns a new preprocesed-custom HTML string to be included in the final pre-compiled HTML template by then generate a PDF file.
 * This process grabs and process hazard-related data passed from the request body data to display which 'Hazard' data have been selected in the app.
 * @param {Object} data - Ruquest body param data
 */
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
/**
 * Returns a new preprocesed-custom HTML string to be included in the final pre-compiled HTML template by then generate a PDF file.
 * This process grabs and process map factor-indicator data passed from the request body data to display which map factor-indicator data has been selected in the app.
 * @param {Object} data - Request body param data 
 */
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
/**
 * Returns a formatted current date data to be included in a HTML-compiled template by then generate a PDF file.
 */
function getReportDate() {
    var date = new Date();
    var months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return months[date.getMonth()] + ' ' + date.getDate() + ', ' + date.getFullYear();
}
/**
 * Returns the percentage and pixels the HTML elements will be filled/drawn in the compiled-HTML of the input-related data. 
 * @param {Object} data - Data provided by one of the properties of the request body param which has the input-related min, max and current values.  
 */
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
/**
 * Returns the percentage and pixels the HTML elements will be filled/drawn in the compiled-HTML of the input-related data. 
 * @param {Object} data - Data provided by one of the properties of the request body param which has only the input-related value.  
 */
function getSliderDrawingValuesByPercentage(data) {
    var MAX_BAR_WIDTH = 50;
    var percentage = data.value.value;
    var pixels = (percentage * MAX_BAR_WIDTH) / 100;
    return {
        percentage: percentage,
        pixels: pixels
    }
}
/**
 * Saves the directory path for the CSV files in a Node.js global-variable to be used in its corresponding endpoint. 
 */
function setCSVDirectories() {
    var dir = __dirname + '/data/viewer_csv';
    dir = path.resolve(dir);
    var files = fs.readdirSync(dir);
    console.log('- - - - Access CSV files - - - -');
    console.log(files);
    process.env.VIEWER_CSV_DIRECTORY = dir;
}
/**
 * Saves the directory path for the PDF files in a Node.js global-variable to be used in its corresponding endpoints. 
 */
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
/**
 * Reusable function which resolves the PDF-generated response data.
 * @param {Response} res - The HTTP response. 
 * @param {String} fullPath - Directory path which is used read the final-compiled HTML file and write it into another HTML file then creates a new PDF file and send it back to client as the response.
 * @param {String} compiledHTML - Compiled-HTML string which is used to write it into the final-HTML template.
 */
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
/**
 * Returns a response error if something went wrong during the execution of a enppoint.
 * @param {Response} res - The HTTP response.
 * @param {Error} err - Custom err notification message during the execution of an endpoint.
 */
function handleError(res, err) {
    return res.send(err);
}
