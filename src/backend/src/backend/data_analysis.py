import json
import sqlite3
import time

import pandas as pd
from scipy import integrate as spi, stats as sps

from config import Config


def process_test_analytics(test_id: str):
    try:
        time.sleep(1.5) # Allow final logging buffers to flush to disk
        df_data = pd.read_csv(Config.LOG_FILE_DATA, names=["timestamp", "weight", "status"])\
            .set_index("timestamp")
        df_events = pd.read_csv(Config.LOG_FILE_EVENTS, names=["timestamp", "event", "status", "test_id"])\
            .set_index("timestamp")

        # Isolate rows captured under this specific TestID
        df_events_test = df_events.loc[df_events['test_id'] == test_id]
        if df_events_test.empty:
            print(f"Analytics failure: No data found matching {test_id}")
            return

        # Locate individual phase transition boundaries
        set_peaks = []
        cumulative_work = []
        cumulative_time = []

        total_work_done = 0.0
        total_time_seconds = 0.0

        pull_start = None
        for timestamp, event_row in df_events_test.iterrows():
            event = event_row["event"]
            if event == "PULL_START":
                pull_start = timestamp
            elif event == "REST_START" or event == "TEST_END":
                pull_data = df_data.loc[(df_data.index >= pull_start) & (df_data.index < timestamp), "weight"]

                if len(pull_data) > 0:
                    peak = float(pull_data.max())
                    set_peaks.append(peak)

                    # Compute Work (Impulse) via linear trapezoidal integration modeling
                    set_work = float(spi.trapezoid(pull_data.values, dx=(1.0 / 80.0)))
                    total_work_done += set_work
                    # TODO: make the timestamp difference
                    total_time_seconds += 7.0 # Standard work block time allocation

                    cumulative_work.append(total_work_done)
                    cumulative_time.append(total_time_seconds)
                else:
                    print(f"No data in the pull interval {pull_start}, {timestamp}")

        if len(cumulative_work) < 2:
            print("Not enough cumulative work")
            print(set_peaks, cumulative_work, cumulative_time)
            print(df_events_test)
            print(df_data)
            return # Insufficient data to execute reliable linear regressions

        # Execute Monod-Scherrer Linear Model Mapping
        # Cumulative Work = (Critical Force * Cumulative Time) + W'
        slope, intercept, r_value, p_value, std_err = sps.linregress(cumulative_time, cumulative_work)

        # Save metrics directly into SQLite
        save_analytics(
            test_id=test_id,
            test_type="CRITICAL_FORCE_7_3",
            cf=round(slope, 2),
            w_prime=round(intercept, 2),
            r_sq=round(r_value**2, 4),
            peaks_list=set_peaks
        )
        print(f"Successfully processed analytics for {test_id}. CF: {round(slope,2)}kg, W': {round(intercept,2)}J")
    except Exception as e:
        print(f"Error executing mathematical analytics engine processing: {str(e)}")


def save_analytics(test_id, test_type, cf, w_prime, r_sq, peaks_list):
    conn = sqlite3.connect(Config.DB_FILE)
    cursor = conn.cursor()
    cursor.execute("""
        INSERT OR REPLACE INTO test_results 
        (test_id, timestamp, test_type, critical_force_kg, w_prime_joules, r_squared, set_peaks_json)
        VALUES (?, datetime('now'), ?, ?, ?, ?, ?)
    """, (test_id, test_type, cf, w_prime, r_sq, json.dumps(peaks_list)))
    conn.commit()
    conn.close()
