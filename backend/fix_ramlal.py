"""
Script to:
1. Show all workers in the database
2. Add Ram Lal if not present
"""
import sqlite3
import uuid
from datetime import date

db_path = 'db/kaampay.db'
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row

# Show existing workers
cur = conn.cursor()
cur.execute("SELECT worker_id, name, phone_number, kaam_score, is_active FROM workers ORDER BY rowid DESC")
rows = cur.fetchall()
print(f"=== Existing Workers ({len(rows)}) ===")
for r in rows:
    print(f"  {dict(r)}")

# Check if Ram Lal exists
names = [r['name'].lower() for r in rows]
if 'ram lal' not in names:
    worker_id = 'W_RAMLAL'
    conn.execute("""
        INSERT OR IGNORE INTO workers
        (worker_id, name, phone_number, phone_type,
         aadhaar_last4, aadhaar_verified, job_type,
         state, registered_by_contractor, kaam_score, is_active, date_registered)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        worker_id, 'Ram Lal', '9999999999', 'feature_phone',
        '0000', 1, 'unskilled',
        'Delhi', 'CONT_001', 600, 1, date.today().isoformat()
    ))
    
    # Also link to contractor
    conn.execute("""
        INSERT OR IGNORE INTO contractor_worker_relationships
        (contractor_id, worker_id, first_worked_date)
        VALUES (?, ?, CURRENT_DATE)
    """, ('CONT_001', worker_id))
    
    conn.commit()
    print(f"\n✅ Ram Lal added with ID {worker_id}")
else:
    print("\n✅ Ram Lal already exists in database")

# Verify
cur.execute("SELECT worker_id, name, kaam_score, is_active FROM workers ORDER BY rowid DESC")
rows = cur.fetchall()
print(f"\n=== Final Workers ({len(rows)}) ===")
for r in rows:
    print(f"  {dict(r)}")

conn.close()
