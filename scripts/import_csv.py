#!/usr/bin/env python3
"""Convert a CSV of scored job offers into data/jobs.local.json.

Run with:  python -I scripts/import_csv.py offers.csv [-o data/jobs.local.json]

Expected columns: id,empresa,puesto,url,fuente,pais_elegible,modalidad,idioma,
fecha_publicacion,salario_publicado,moneda,salario_mensual_usd_est,cumple_piso,score,
prioridad,metodo_postulacion,requiere_humano,estado_verificacion,fortalezas,brechas,
riesgos,notas
"""
import argparse
import csv
import json
import re
import sys
from pathlib import Path

COLUMNS = (
    "id,empresa,puesto,url,fuente,pais_elegible,modalidad,idioma,fecha_publicacion,"
    "salario_publicado,moneda,salario_mensual_usd_est,cumple_piso,score,prioridad,"
    "metodo_postulacion,requiere_humano,estado_verificacion,fortalezas,brechas,riesgos,notas"
).split(",")

AI_RE = re.compile(r"\b(ai|agents?|automation|automatizaci\w*|llm|genai)\b", re.I)
DATA_RE = re.compile(r"data analyst|data engineer|data scien\w*|\bbi\b|business intelligence|analytics", re.I)


def cv_variant(title):
    if AI_RE.search(title):
        return "AI-Automation"
    if DATA_RE.search(title):
        return "Data-BI"
    return "Software"


def to_score(v):
    try:
        return max(0, min(100, int(round(float(str(v).strip())))))
    except ValueError:
        return 0


def convert(row):
    job = {c: (row.get(c) or "").strip() for c in COLUMNS}
    job["score"] = to_score(job["score"])
    job["prioridad"] = job["prioridad"].lower() or "media"
    job["idioma"] = "EN" if job["idioma"].upper() == "EN" else "ES"
    job["cv_variant"] = cv_variant(job["puesto"])
    return job


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("csv_file")
    default_out = Path(__file__).resolve().parent.parent / "data" / "jobs.local.json"
    ap.add_argument("-o", "--output", default=str(default_out))
    args = ap.parse_args(argv)

    with open(args.csv_file, newline="", encoding="utf-8-sig") as fh:
        reader = csv.DictReader(fh)
        missing = [c for c in ("id", "puesto") if c not in (reader.fieldnames or [])]
        if missing:
            sys.exit("CSV is missing required columns: " + ", ".join(missing))
        jobs = [convert(r) for r in reader if (r.get("id") or "").strip() and (r.get("puesto") or "").strip()]

    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(jobs, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {len(jobs)} offers to {out}")


if __name__ == "__main__":
    main()
