import platform
import sqlite3
import time
import uuid
from pathlib import Path


class Connection:
  def __init__(self, conn):
    self.conn = conn
    self.host = platform.node()

  def save_prompt(self, prompt):
    cur = self.conn.cursor()

    result = cur.execute('''
      select uuid from prompts where prompt = ?''', (prompt,)).fetchall()

    if len(result) == 0:
      prompt_uuid = str(uuid.uuid4())
      cur.execute('''
          insert into prompts (uuid, prompt) values (?, ?)
        ''', (prompt_uuid, prompt))
      self.conn.commit()
      return prompt_uuid
    else:
      return result[0][0]

  def save_demo(self, prompt_id, demo_name, demo_type, demo_traj):
    demo_uuid = str(uuid.uuid4())
    demo_time = time.time()
    cur = self.conn.cursor()
    cur.execute('''
      insert into demos (uuid, host, time, prompt_id, demo_name, demo_type, trajectory)
      values (?, ?, ?, ?, ?, ?, ?)
      ''', (
        demo_uuid,
        self.host,
        demo_time,
        prompt_id,
        demo_name,
        demo_type,
        demo_traj))
    self.conn.commit()

  def __del__(self):
    self.conn.close()


def new_connection(filename, wipe=False):
  filepath = Path(filename)
  if filepath.exists() and filepath.is_file():
    conn = sqlite3.connect(filename)
    cur = conn.cursor()
    cur.execute("""
        SELECT name FROM sqlite_master
        WHERE type='table' AND name='done';
    """)
    exists = cur.fetchone() is not None

    if not exists:
      # 2. Wipe the DB (drop all tables)
      cur.execute("""
          SELECT name FROM sqlite_master
          WHERE type='table';
      """)
      tables = [row[0] for row in cur.fetchall()]

      for t in tables:
        cur.execute(f"DROP TABLE IF EXISTS {t};")
  else:
    conn = sqlite3.connect(filename)
    cur = conn.cursor()
    exists = False

  if not exists:
    # 3. Create schema
    cur.execute("""
        CREATE TABLE prompts (
            uuid TEXT PRIMARY KEY,
            prompt TEXT NOT NULL
        );
    """)

    cur.execute("""
        CREATE TABLE demos (
            uuid TEXT PRIMARY KEY,
            host TEXT NOT NULL,
            time REAL NOT NULL,
            prompt_id INTEGER NOT NULL,
            demo_name TEXT NOT NULL,
            demo_type TEXT NOT NULL,
            trajectory TEXT NOT NULL,   -- store JSON as TEXT
            FOREIGN KEY(prompt_id) REFERENCES prompts(id) ON DELETE CASCADE
        );
    """)

    # 4. Create the "done" marker table
    cur.execute("CREATE TABLE done (id INTEGER PRIMARY KEY);")
    cur.execute("INSERT INTO done (id) VALUES (1);")

    conn.commit()

  return Connection(conn)
