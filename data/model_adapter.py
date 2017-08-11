#!/usr/bin/python3
# -*- coding: UTF-8 -*-
"""Wrapper for running Socio-economic resilience indicator model."""

# enable debugging
import cgitb
cgitb.enable()

print ("Content-Type: text/html;charset=utf-8")
print()

import cgi
import argparse
import importlib
import json
import logging
import os
import sys
import time


import pandas as pd

PACKAGE_PARENT = '..'
SCRIPT_DIR = os.path.dirname(os.path.realpath(
    os.path.join(os.getcwd(), os.path.expanduser(__file__))))
sys.path.append(os.path.normpath(os.path.join(SCRIPT_DIR, PACKAGE_PARENT)))

#import res_ind_lib

logging.basicConfig(
    filename='model/model.log', level=logging.DEBUG,
    format='%(asctime)s: %(levelname)s: %(message)s')


class Model():
    """Runs the resilience model."""

    def __init__(self, df=None, model_function=None, group=None,debug=False):
        if group == None: # country data is sent
            if df == None: # no country data
                return
            else: #load dataframe with country data sent
                d = json.loads(data_frame)
                df = pd.DataFrame.from_records([d], index='name')
        else: #when group data is sent
            #df_all = pd.read_csv("df2.csv")
            df_all = pd.read_csv("df_for_wrapper.csv")
            #print df_all
            if group == 'GLOBAL':
                df = df_all
            else:
                df = df_all.loc[df_all['group_name'] == group]

        for col in df.columns:
            df[col] = self.to_float(df[col])
        self.df = df
        logging.debug(self.df)
        with open('model_inputs.csv', 'w') as f:
            f.write(self.df.to_csv())

        self.model_function = model_function
        self.debug = debug

    def to_float(self, obj):
        try:
            return obj.astype('float')
        except ValueError:
            return obj

    def run(self):
        output = self.model_function(self.df)
        logging.debug(output)
        return output

if __name__ == '__main__':
    
    #parser = argparse.ArgumentParser(
    #    description="Run the Socio-economic Resilience Model.")
    #parser.add_argument('-d', '--data-frame', required=True,
    #                    dest="data_frame", help="The input data frame")
    #parser.add_argument('-m', '--model-function', required=True,
    #                    dest='model_function', help='The model function to run'
    #                    )
    #args = parser.parse_args()
    PACKAGE_PARENT = '..'
    SCRIPT_DIR = os.path.dirname(os.path.realpath(os.path.join(os.getcwd(), os.path.expanduser(__file__))))
    sys.path.append(os.path.normpath(os.path.join(SCRIPT_DIR, PACKAGE_PARENT)))

    config = {}
    form = cgi.FieldStorage()
    config['data_frame'] = form.getvalue('d')
    config['model_function'] = form.getvalue('m')
    group = form.getvalue('g')
    data_frame = config.get('data_frame')
    mf = config.get('model_function')
    m = mf.split('.')[0]
    f = mf.split('.')[1]
    #module = importlib.import_module('data.' + m) #sesha changing
    #print sys.path
    module = importlib.import_module(m)
    model_function = getattr(module, f)
    #model_function = mf
    debug = True
    if config.get('debug'):
        debug = True

    model = Model(
        df=data_frame, model_function=model_function, group=group,debug=debug
    )
    startTime = time.time()
    output = model.run()
    elapsed = time.time() - startTime
    logging.debug('Running model took: {}'.format(elapsed))
    print(output.to_json())