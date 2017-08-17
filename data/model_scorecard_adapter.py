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
    def __init__(self, df=None, macro=None, cat_info=None, hazard_ratios=None,optionPDS='no',optionFee="tax",social_col=None,pol_str_arr=None,pol_str=None,pol_info_to_process_list=None,p_col_impacted=None,pol_model_function=None,debug=False):

        for col in df.columns:
            df[col] = self.to_float(df[col])

        self.pol_str_arr = pol_str_arr
        self.pol_info_to_process_list = []
        self.pol_model_function = pol_model_function

        df_pol = df.copy()

        for i in range(len(pol_str_arr)):
            #print("Policy Variable: " + str(pol_str_arr[i]))
            pol_str = pol_str_arr[i]

            # BEGIN MANIPULATE DF FOR POLICY and send to pol_model_function
            optionPDS = optionPDS
            optionFee = optionFee
            #df_pol = df.copy()
            ##MACRO
            macro_cols = [c for c in df_pol if "macro" in c]
            macro = df_pol[macro_cols]
            macro = macro.rename(columns=lambda c: c.replace("macro_", ""))
            #print(macro.to_string())

            ##CAT INFO
            cat_cols = [c for c in df_pol if "cat_info" in c]
            cat_info = df_pol[cat_cols]
            cat_info.columns = pd.MultiIndex.from_tuples([c.replace("cat_info_", "").split("__") for c in cat_info])
            cat_info = cat_info.sort_index(axis=1).stack()
            cat_info.index.names = "name", "income_cat"

            #print(cat_info.columns)
            #OUTPUT FROM ABOVE PRINT:Index(['axfin', 'c', 'fa', 'gamma_SP', 'k', 'n', 'shew', 'v'], dtype='object')

            ##HAZARD RATIOS
            ###exposure
            fa_cols = [c for c in df_pol if "hazard_ratio_fa" in c]
            fa = df_pol[fa_cols]
            fa.columns = [c.replace("hazard_ratio_fa__", "") for c in fa]

            ##### add poor and nonpoor
            hop = pd.DataFrame(2 * [fa.unstack()], index=["poor", "nonpoor"]).T
            hop.ix["flood"]["poor"] = df.hazard_ratio_flood_poor
            # print(hop)
            hop.ix["surge"]["poor"] = hop.ix["flood"]["poor"] * df["ratio_surge_flood"]
            hop.ix["surge"]["nonpoor"] = hop.ix["flood"]["nonpoor"] * df["ratio_surge_flood"]
            hop = hop.stack().swaplevel(0, 1).sort_index()
            hop.index.names = ["name", "hazard", "income_cat"]

            hazard_ratios = pd.DataFrame()
            hazard_ratios["fa"] = hop

            ## Shew
            hazard_ratios["shew"] = 0
            # hazard_ratios["shew"] +=df.shew_for_hazard_ratio #sesha commenting this and adding next two lines.
            names = hazard_ratios["fa"].index.get_level_values('name')  # sesha added
            hazard_ratios["shew"] = df_pol.ix[names]["shew_for_hazard_ratio"].values  # sesha added
            # no EW for earthquake
            hazard_ratios["shew"] = hazard_ratios.shew.unstack("hazard").assign(earthquake=0).stack("hazard").reset_index().set_index(["name", "hazard", "income_cat"])

            #print(cat_info.to_string())

            # POLICY: Reduce vulnerability of the poor by 5% of their current exposure
            if pol_str == '_exp095':
                cat_info.ix[(cat_info.index.get_level_values('income_cat') == "poor"), "v"] *= 0.95

            # POLICY: Reduce vulnerability of the rich by 5% of their current exposure
            elif pol_str == '_exr095':
                cat_info.ix[(cat_info.index.get_level_values('income_cat') == "nonpoor"), "v"] *= 0.95

            # POLICY: Increase income of the poor by 10%
            elif pol_str == '_pcinc_p_110':
                cat_info.ix[(cat_info.index.get_level_values('income_cat') == "poor"), "c"] *= 1.10
                cat_info['gamma_SP'] = cat_info['gamma_SP'] / cat_info['c']

            # POLICY: Increase social transfers to poor BY one third
            elif pol_str == '_soc133':
                # Cost of this policy = sum(social_topup), per person
                cat_info['social_topup'] = 0
                cat_info.ix[(cat_info.index.get_level_values('income_cat') == "poor"), "social_topup"] = 0.333 * cat_info.ix[(cat_info.index.get_level_values('income_cat') == "poor"), ["gamma_SP","c"]].prod(axis=1)
                cat_info.ix[(cat_info.index.get_level_values('income_cat') == "poor"), "c"] *= (1.0 + 0.333 * cat_info.ix[(cat_info.index.get_level_values('income_cat') == "poor"), "gamma_SP"])
                # Initialize cat_info['pcsoc'] to 0 for now. CHECK WITH BRIAN.
                cat_info['pcsoc'] = 0
                # BRIAN says cat_info['pcsoc'] is computed from social, but it is used for computing social on next line. Something need to change here.
                cat_info['gamma_SP'] = (cat_info['social_topup'] + cat_info['pcsoc']) / cat_info['c']

            # POLICY: Decrease reconstruction time by 1/3
            elif pol_str == '_rec067':
                macro['T_rebuild_K'] *= 0.666667

            # POLICY: Increase access to early warnings to 100%
            elif pol_str == '_ew100':
                cat_info['shew'] = 1.0
                cat_info[p_col_impacted] = 1.0

            # POLICY: Decrease vulnerability of poor by 30%
            elif pol_str == '_vul070':
                cat_info.ix[(cat_info.index.get_level_values('income_cat') == "poor"), "v"] *=0.70

            # POLICY: Decrease vulnerability of rich by 30%
            elif pol_str == '_vul070r':
                cat_info.ix[(cat_info.index.get_level_values('income_cat') == "nonpoor"), "v"] *= 0.70

            # POLICY: Postdisaster support package
            elif pol_str == 'optionPDS':
                optionPDS = "unif_poor"

            # POLICY: Develop market insurance (optionFee = 'insurance_premium')
            elif pol_str == 'optionFee':
                optionPDS = "unif_poor"
                optionFee = "insurance_premium"

            # POLICY: Universal access to finance
            elif pol_str == 'axfin':
                cat_info.ix[(cat_info.index.get_level_values('income_cat') == "nonpoor"), "axfin"] = 1
                cat_info.ix[(cat_info.index.get_level_values('income_cat') == "poor"), "axfin"] = 1


            policyDict = {}
            policyDict["pol_str"] = pol_str
            policyDict["df"] = df_pol
            policyDict["macro"] = macro
            policyDict["cat_info"] = cat_info
            policyDict["hazard_ratios"] = hazard_ratios
            #policyDict["pol_model_function"] = self.pol_model_function
            policyDict["optionPDS"] = optionPDS
            policyDict["optionFee"] = optionFee

            self.pol_info_to_process_list.append(policyDict)
            # END MANIPULATE DF FOR POLICY

    def to_float(self, obj):
        try:
            return obj.astype('float')
        except ValueError:
            return obj

    def run(self):
        output_list = []
        #output_list = {}
        for i in range(len(self.pol_info_to_process_list)):
            #print("Policy Info: " + str(self.pol_info_to_process_list[i])  + "\n")
            pol_info = self.pol_info_to_process_list[i]

            output_pol = self.pol_model_function(pol_info["df"],pol_info["macro"],pol_info["cat_info"],pol_info["hazard_ratios"],optionPDS=pol_info["optionPDS"],optionFee=pol_info["optionFee"])
            #o = output[['risk','resilience','risk_to_assets','group_name','id',"dK","dKtot","delta_W","delta_W_tot","dWpc_currency","dWtot_currency"]]
            #o_pol = output_pol[['risk','resilience','risk_to_assets','group_name','id',"dK","dKtot","delta_W","delta_W_tot","dWpc_currency","dWtot_currency"]]
            o_pol = output_pol[['id','group_name',"dK","dKtot","dWpc_currency","dWtot_currency"]]

            output_list.append(o_pol)

        #print output_list[]
        return output_list

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

    #config['model_function'] = form.getvalue('m')
    config['pol_model_function'] = form.getvalue('pol_m')
    p_col_impacted = form.getvalue('p_col_impacted')
    pol_str_arr = form.getvalue('pol_str_arr')
    pol_str_arr = pol_str_arr.split(',')
    #print(pol_str_arr)
    pol_str = form.getvalue('pol_str')
    social_col = form.getvalue('social_col')
    data_file = form.getvalue('i_df')
    df = pd.read_csv(data_file,index_col='name')
    #mf = config.get('model_function')
    pol_mf = config.get('pol_model_function')

    #config['model_function'] = "res_ind_lib_big.compute_resilience_from_packed_inputs"
    #p_col_impacted = "v_cat_info__poor"
    #pol_str = "_pcinc_p_110" # hard coded to check syntax
    #social_col = "gamma_SP_cat_info__poor"
    #data_file = "df_for_wrapper.csv"
    #df = pd.read_csv(data_file,index_col='name')
    #mf = config.get('model_function')
    #pol_str_arr = ["_exp095","_exr095", "_pcinc_p_110","_soc133","_rec067","_ew100","_vul070p","_vul070","optionPDS","optionFee","axfin"]
    #pol_str_arr = ["_exp095","_exr095"]

    #m = mf.split('.')[0]
    #f = mf.split('.')[1]
    pol_m = pol_mf.split('.')[0]
    pol_f = pol_mf.split('.')[1]
    #module = importlib.import_module('data.' + m) #sesha changing
    #print sys.path
    module = importlib.import_module(pol_m)
    #model_function = getattr(module, f)
    pol_model_function = getattr(module, pol_f)
    #pol_model_function = getattr(module,pol_f)
    debug = True
    if config.get('debug'):
        debug = True

    model = Model(df=df,social_col=social_col,pol_str_arr=pol_str_arr,pol_str=pol_str,p_col_impacted=p_col_impacted, pol_model_function=pol_model_function, debug=debug)
    startTime = time.time()
    output = model.run()
    elapsed = time.time() - startTime
    logging.debug('Running model took: {}'.format(elapsed))

    jsonStr = "{\"data\":["
    for i in range(len(output)):
        if len(jsonStr) == 9: # 9 for data:[ - Change accordingly in future if this text changes.
            jsonStr += output[i].to_json()
        else:
            jsonStr += "," + output[i].to_json()
    jsonStr +="]}"

    print(json.dumps(jsonStr))
