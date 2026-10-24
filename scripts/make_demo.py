"""Regenerates data/jobs.demo.json (fictional data). Run: python -I scripts/make_demo.py"""
import json
from pathlib import Path

rows = [
    ("Acme Example", "Senior AI Automation Engineer", "agent", 92, "alta", "1800-2400", "USD", 2100, True, "Email with CV attached", "no", "EN", "Remote, LATAM"),
    ("Globex Sample Co", "Data Analyst", "data", 88, "alta", "1500", "USD", 1500, True, "Company careers form", "si", "EN", "Remote, worldwide"),
    ("Initech Demo", "Backend Developer (Python)", "sw", 84, "alta", "", "", None, False, "Company careers form", "si", "EN", "Remote, LATAM"),
    ("Umbrella Placeholder", "BI Developer", "bi", 81, "media", "1300-1600", "USD", 1450, True, "Email with CV attached", "no", "ES", "Remote, Americas"),
    ("Hooli Fictional", "LLM Agent Developer", "agent", 79, "media", "2000", "USD", 2000, True, "Third-party portal", "si", "EN", "Remote, worldwide"),
    ("Stark Imaginary Ltd", "Data Engineer", "data", 74, "media", "", "", None, False, "Third-party portal", "si", "EN", "Remote, EMEA and LATAM"),
    ("Wayne Mockup Inc", "Full Stack Developer", "sw", 71, "media", "1100", "USD", 1100, True, "Company careers form", "si", "EN", "Remote, LATAM"),
    ("Soylent Test Labs", "Automation Specialist (no-code and scripts)", "agent", 66, "baja", "900-1000", "USD", 950, False, "Email with CV attached", "no", "EN", "Remote, worldwide"),
    ("Cyberdyne Notreal", "Junior Software Engineer", "sw", 58, "baja", "", "", None, False, "Company careers form", "si", "EN", "Hybrid, outside eligible area"),
    ("Vandelay Example Group", "Analytics Engineer", "data", 77, "media", "1700", "USD", 1700, True, "Company careers form", "si", "EN", "Remote, Americas"),
    ("Pied Piper Sample", "Workflow Automation Developer", "agent", 86, "alta", "1600-2000", "USD", 1800, True, "Email with CV attached", "no", "ES", "Remote, LATAM"),
]
S = {
    "agent": ("Hands-on experience building automation pipelines and LLM tool-use flows.", "Limited exposure to the vendor's own orchestration product.", "Fast-growing team; scope may shift."),
    "data": ("Strong SQL and dashboard delivery in past projects.", "No direct experience with the listed warehouse vendor.", "Role description is vague about ownership of data quality."),
    "bi": ("Dashboards and semantic modeling are a direct match.", "Asked for a certification that is not held.", "Reporting requests may arrive ad hoc."),
    "sw": ("Solid Python and API design background.", "Listing mentions a framework with limited prior use.", "Salary not published; may fall under the floor."),
}
out = []
for i, (e, p, k, s, pr, sal, cur, usd, floor, m, h, lang, pais) in enumerate(rows, 1):
    f, b, r = S[k]
    out.append({
        "id": f"demo-{i:03d}", "empresa": e, "puesto": p,
        "url": f"https://example.com/jobs/demo-{i:03d}", "fuente": "Example Board",
        "pais_elegible": pais, "modalidad": pais.split(",")[0], "idioma": lang,
        "fecha_publicacion": f"2026-0{1 + i % 9}-{10 + i:02d}",
        "salario_publicado": sal, "moneda": cur, "salario_mensual_usd_est": usd,
        "cumple_piso": "si" if floor else "no", "score": s, "prioridad": pr,
        "metodo_postulacion": m, "requiere_humano": h,
        "estado_verificacion": "Verified active on publication date (demo)",
        "fortalezas": f, "brechas": b, "riesgos": r, "notas": "Fictional demo entry.",
    })
path = Path(__file__).resolve().parent.parent / "data" / "jobs.demo.json"
path.write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print("wrote", path)
