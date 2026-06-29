from flask import Flask, render_template, request, jsonify
from werkzeug.utils import secure_filename
from pathlib import Path
import sqlite3
import uuid
import json

app = Flask(__name__)

DB_PATH = Path("alfajores.db")
UPLOAD_FOLDER = Path("static/uploads")
UPLOAD_FOLDER.mkdir(parents=True, exist_ok=True)

ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "webp"}

INITIAL_ALFAJORES = [
    ("A", 1, "Mantecol", "uploads/mantecol.png"),
    ("A", 2, "Águila Minitorta Dark", "uploads/aguila-minitorta.png"),
    ("A", 3, "Chocotorta", "uploads/chocotorta.png"),
    ("A", 4, "Tri Shot Blanco", "uploads/trishot-blanco.png"),
]

DEFAULT_SLOTS = {}

def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS

def crear_base():
    conn = get_conn()
    cur = conn.cursor()

    cur.execute("""
        CREATE TABLE IF NOT EXISTS alfajores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            grupo TEXT NOT NULL,
            posicion INTEGER NOT NULL,
            nombre TEXT NOT NULL,
            foto TEXT DEFAULT '',
            puntaje REAL DEFAULT 0,
            opinion TEXT DEFAULT '',
            precio TEXT DEFAULT '',
            lugar TEXT DEFAULT '',
            fecha TEXT DEFAULT ''
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS fixture (
            id INTEGER PRIMARY KEY,
            slots TEXT NOT NULL
        )
    """)

    cur.execute("SELECT COUNT(*) FROM alfajores")
    if cur.fetchone()[0] == 0:
        for grupo, posicion, nombre, foto in INITIAL_ALFAJORES:
            cur.execute(
                "INSERT INTO alfajores (grupo, posicion, nombre, foto) VALUES (?, ?, ?, ?)",
                (grupo, posicion, nombre, foto)
            )

        for grupo in ["B", "C", "D"]:
            for posicion in range(1, 5):
                cur.execute(
                    "INSERT INTO alfajores (grupo, posicion, nombre, foto) VALUES (?, ?, ?, ?)",
                    (grupo, posicion, f"Alfajor {grupo}{posicion}", "")
                )

    cur.execute("SELECT COUNT(*) FROM fixture WHERE id = 1")
    if cur.fetchone()[0] == 0:
        cur.execute(
            "INSERT INTO fixture (id, slots) VALUES (?, ?)",
            (1, json.dumps(DEFAULT_SLOTS))
        )

    conn.commit()
    conn.close()

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/state", methods=["GET"])
def get_state():
    conn = get_conn()
    cur = conn.cursor()

    cur.execute("SELECT * FROM alfajores ORDER BY grupo, posicion")
    alfajores = [dict(row) for row in cur.fetchall()]

    cur.execute("SELECT slots FROM fixture WHERE id = 1")
    fixture_row = cur.fetchone()
    slots = json.loads(fixture_row["slots"]) if fixture_row else {}

    conn.close()
    return jsonify({"alfajores": alfajores, "slots": slots})

@app.route("/api/alfajor/<int:alfajor_id>", methods=["POST"])
def update_alfajor(alfajor_id):
    data = request.get_json(force=True)

    conn = get_conn()
    cur = conn.cursor()
    cur.execute("""
        UPDATE alfajores
        SET nombre = ?, puntaje = ?, opinion = ?, precio = ?, lugar = ?, fecha = ?
        WHERE id = ?
    """, (
        data.get("nombre", ""),
        data.get("puntaje", 0) or 0,
        data.get("opinion", ""),
        data.get("precio", ""),
        data.get("lugar", ""),
        data.get("fecha", ""),
        alfajor_id
    ))
    conn.commit()
    conn.close()

    return jsonify({"ok": True})

@app.route("/api/alfajor/<int:alfajor_id>/position", methods=["POST"])
def update_position(alfajor_id):
    data = request.get_json(force=True)
    grupo = data.get("grupo")
    posicion = int(data.get("posicion"))

    if grupo not in ["A", "B", "C", "D"] or posicion not in [1, 2, 3, 4]:
        return jsonify({"ok": False, "error": "Posición inválida"}), 400

    conn = get_conn()
    cur = conn.cursor()
    cur.execute("UPDATE alfajores SET grupo = ?, posicion = ? WHERE id = ?", (grupo, posicion, alfajor_id))
    conn.commit()
    conn.close()

    return jsonify({"ok": True})

@app.route("/api/alfajor/<int:alfajor_id>/foto", methods=["POST"])
def upload_foto(alfajor_id):

    if "foto" not in request.files:
        return jsonify({
            "ok": False,
            "error": "No se subió archivo"
        }), 400

    file_storage = request.files["foto"]
    original_filename = file_storage.filename or ""

    if original_filename == "":
        return jsonify({
            "ok": False,
            "error": "Archivo vacío"
        }), 400

    if not allowed_file(original_filename):
        return jsonify({
            "ok": False,
            "error": "Formato no permitido"
        }), 400

    ext = original_filename.rsplit(".", 1)[1].lower()

    filename = secure_filename(
        f"alfajor_{alfajor_id}_{uuid.uuid4().hex[:8]}.{ext}"
    )

    save_path = UPLOAD_FOLDER / filename
    file_storage.save(save_path)

    db_path = f"uploads/{filename}"

    conn = get_conn()
    cur = conn.cursor()

    cur.execute(
        "UPDATE alfajores SET foto = ? WHERE id = ?",
        (db_path, alfajor_id)
    )

    conn.commit()
    conn.close()

    return jsonify({
        "ok": True,
        "foto": db_path
    })

@app.route("/api/fixture", methods=["POST"])
def save_fixture():
    data = request.get_json(force=True)
    slots = data.get("slots", {})

    conn = get_conn()
    cur = conn.cursor()
    cur.execute("UPDATE fixture SET slots = ? WHERE id = 1", (json.dumps(slots),))
    conn.commit()
    conn.close()

    return jsonify({"ok": True})

@app.route("/api/reset", methods=["DELETE"])
def reset():
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("DELETE FROM alfajores")
    cur.execute("UPDATE fixture SET slots = ? WHERE id = 1", (json.dumps(DEFAULT_SLOTS),))

    for grupo, posicion, nombre, foto in INITIAL_ALFAJORES:
        cur.execute(
            "INSERT INTO alfajores (grupo, posicion, nombre, foto) VALUES (?, ?, ?, ?)",
            (grupo, posicion, nombre, foto)
        )

    for grupo in ["B", "C", "D"]:
        for posicion in range(1, 5):
            cur.execute(
                "INSERT INTO alfajores (grupo, posicion, nombre, foto) VALUES (?, ?, ?, ?)",
                (grupo, posicion, f"Alfajor {grupo}{posicion}", "")
            )

    conn.commit()
    conn.close()

    return jsonify({"ok": True})

if __name__ == "__main__":
    crear_base()
    app.run(debug=True)
