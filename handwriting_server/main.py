import json

from flask import Flask, jsonify, request, g
from flask_cors import CORS

from data import new_connection
from prompt import LowercaseAlphaPrompter, LowercaseExponentialPrompter

app = Flask(__name__)
DB_FILENAME = 'test.db'
CORS(app)

def get_db():
  if 'db' not in g:
    g.db = new_connection(DB_FILENAME)
  return g.db

def get_new_prompt(prompter):
    conn = get_db()

    next_prompt = prompter.next_prompt()
    prompt_id = conn.save_prompt(next_prompt)
    return {"prompt_id": prompt_id, "prompt": next_prompt}

def save_trajectory(data):
    conn = get_db()
    print(data['prompt_id'], type(data['prompt_id']))

    conn.save_demo(
      data['prompt_id'],
      data['demo_name'],
      data['demo_type'],
      json.dumps(data['trajectory']),
      )

@app.route("/prompt", methods=["GET"])
def get_prompt():
    prompter = LowercaseExponentialPrompter(min_length=2, survive=0.001)
    prompt = get_new_prompt(prompter)
    return jsonify(prompt)


@app.route("/trajectory", methods=["POST"])
def receive_trajectory():
    data = request.json
    save_trajectory(data)
    return jsonify({"status": "ok"})

@app.teardown_appcontext
def close_db(exception):
  g.pop('db', None)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
