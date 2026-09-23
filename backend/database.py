# app/database.py
import sqlite3
import json

DB_FILE = "../output_data/climbing_analytics.db"

def init_db():
    """Creates the historical database tables if they do not exist."""
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("""
                   CREATE TABLE IF NOT EXISTS test_results (
                                                               test_id TEXT PRIMARY KEY,
                                                               timestamp TEXT NOT NULL,
                                                               test_type TEXT NOT NULL,
                                                               critical_force_kg REAL NOT NULL,
                                                               w_prime_joules REAL NOT NULL,
                                                               r_squared REAL NOT NULL,
                                                               set_peaks_json TEXT NOT NULL
                   )
                   """)
    conn.commit()
    conn.close()

def save_analytics(test_id, test_type, cf, w_prime, r_sq, peaks_list):
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("""
        INSERT OR REPLACE INTO test_results 
        (test_id, timestamp, test_type, critical_force_kg, w_prime_joules, r_squared, set_peaks_json)
        VALUES (?, datetime('now'), ?, ?, ?, ?, ?)
    """, (test_id, test_type, cf, w_prime, r_sq, json.dumps(peaks_list)))
    conn.commit()
    conn.close()

def get_all_tests():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT test_id, timestamp, test_type, critical_force_kg, w_prime_joules, r_squared FROM test_results ORDER BY timestamp DESC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_test_by_id(test_id):
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM test_results WHERE test_id = ?", (test_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def delete_test_by_id(test_id: str) -> bool:
    """Removes a test entry from the local SQLite database table."""
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM test_results WHERE test_id = ?", (test_id,))
    changes = conn.total_changes
    conn.commit()
    conn.close()
    return changes > 0