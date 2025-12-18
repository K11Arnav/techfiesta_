import json
import os
import pandas as pd
import numpy as np

class RuleEngine:
    def __init__(self, config_path="fraud_rules.json"):
        self.config_path = config_path
        self.config = {}
        self.reload_config()

    def reload_config(self):
        """Reloads the rules from the JSON file."""
        if os.path.exists(self.config_path):
            with open(self.config_path, 'r') as f:
                self.config = json.load(f)
        else:
            print(f"Warning: Config file {self.config_path} not found.")

    def evaluate(self, transaction, last_txn_time=None):
        """
        Evaluates a single transaction dictionary against the rules.
        
        Args:
            transaction (dict): The transaction data (Amount, Time, V1...V28).
            last_txn_time (float, optional): Timestamp of the last transaction for this user.
            
        Returns:
            tuple: (total_score, rule_details_dict)
        """
        score = 0.0
        details = {}
        cfg = self.config

        # --- RULE 1: VELOCITY ---
        if cfg.get('velocity', {}).get('enabled', False):
            # Logic: If time since last transaction is too short -> FLAG
            time_window = cfg['velocity'].get('time_window_sec', 5)
            weight = cfg['velocity'].get('weight', 2.5)
            
            if last_txn_time is not None:
                time_diff = transaction['Time'] - last_txn_time
                if time_diff < time_window:
                    score += weight
                    details['r1_velocity'] = 1
                else:
                    details['r1_velocity'] = 0
            else:
                # No history, can't calc velocity
                details['r1_velocity'] = 0

        # --- RULE 2: HIGH-RISK PCA ---
        if cfg.get('high_risk_pca', {}).get('enabled', False):
            # Logic: If any critical V-component is > threshold -> FLAG
            components = cfg['high_risk_pca'].get('components', ['V4', 'V10', 'V12', 'V14'])
            threshold = cfg['high_risk_pca'].get('default_threshold', 3.0)
            weight = cfg['high_risk_pca'].get('weight', 1.5)
            
            is_extreme = False
            for comp in components:
                val = transaction.get(comp, 0)
                if abs(val) > threshold:
                    is_extreme = True
                    break
            
            if is_extreme:
                score += weight
                details['r2_high_risk_pca'] = 1
            else:
                details['r2_high_risk_pca'] = 0

        # --- RULE 3: AMOUNT ANOMALY ---
        if cfg.get('amount_anomaly', {}).get('enabled', False):
            # Logic: Very small (test) or very large or suspicious round numbers
            small_thresh = cfg['amount_anomaly'].get('small_threshold', 10)
            large_thresh = cfg['amount_anomaly'].get('large_threshold', 1000)
            weight = cfg['amount_anomaly'].get('weight', 1.0)
            
            amt = transaction['Amount']
            flag_small = (amt < small_thresh) and (amt > 0.01)
            flag_large = (amt > large_thresh)
            flag_round = (amt % 50 == 0) and (amt >= 100) and (amt <= 500)
            
            if flag_small or flag_large or flag_round:
                score += weight
                details['r3_amount_anomaly'] = 1
            else:
                details['r3_amount_anomaly'] = 0

        # --- RULE 4: COMBINATION PATTERNS ---
        if cfg.get('combo_pattern', {}).get('enabled', False):
            # Logic: Velocity + Small Amount OR High Risk PCA + Large Amount
            weight = cfg['combo_pattern'].get('weight', 3.0)
            
            r1 = details.get('r1_velocity', 0)
            r2 = details.get('r2_high_risk_pca', 0)
            r3 = details.get('r3_amount_anomaly', 0)
            
            # Use 'amt' from Rule 3 block, or fetch again
            amt = transaction['Amount']
            small_thresh = cfg.get('amount_anomaly', {}).get('small_threshold', 10)
            large_thresh = cfg.get('amount_anomaly', {}).get('large_threshold', 1000)
            
            is_small = (amt < small_thresh)
            is_large = (amt > large_thresh)
            
            # Pattern A: Velocity + Small (Test Fraud)
            pat_a = (r1 == 1) and is_small
            
            # Pattern B: PCA + Large (Major Fraud)
            pat_b = (r2 == 1) and is_large
            
            if pat_a or pat_b:
                score += weight
                details['r4_combo_pattern'] = 1
            else:
                details['r4_combo_pattern'] = 0

        # --- NORMALIZE SCORE ---
        # Calculate total possible weight to normalize to [0, 1]
        # (simplified: sum of all active weights)
        total_weight = 0
        if cfg.get('velocity', {}).get('enabled'): total_weight += cfg['velocity']['weight']
        if cfg.get('high_risk_pca', {}).get('enabled'): total_weight += cfg['high_risk_pca']['weight']
        if cfg.get('amount_anomaly', {}).get('enabled'): total_weight += cfg['amount_anomaly']['weight']
        if cfg.get('combo_pattern', {}).get('enabled'): total_weight += cfg['combo_pattern']['weight']
        
        normalized_score = 0
        if total_weight > 0:
            normalized_score = score / total_weight
            
        return normalized_score, details
