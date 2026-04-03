import sqlite3

for db in ['db/kaampay.db', 'db/mazdoorpay.db']:
    try:
        conn = sqlite3.connect(db)
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [r[0] for r in cur.fetchall()]
        print(f"DB: {db}")
        print(f"Tables: {tables}")
        if 'workers' in tables:
            cur.execute('SELECT worker_id, name, phone_number, kaam_score FROM workers ORDER BY rowid DESC')
            rows = cur.fetchall()
            print(f"Workers ({len(rows)} total):")
            for r in rows:
                d = dict(r)
                print(f"  ID={d['worker_id']} | Name={d['name']} | Phone={d['phone_number']} | Score={d['kaam_score']}")
        print("---")
        conn.close()
    except Exception as e:
        print(f"Error with {db}: {e}")
