from server import process_test_analytics, init_db


if __name__ == "__main__":
    init_db()
    process_test_analytics("TEST_20260922_2256")