from pathlib import Path
from datetime import date

from generate_dq_report import build_report

# ---------------- CONFIG ----------------
DQ_DIR = Path("/mnt/raid0/esports/Comiccon/dq_checks")
REPORT_DIR = Path("/mnt/raid0/esports/Comiccon/reports")

# Base name without extension; date will be appended automatically
REPORT_BASENAME = "ComicCon_Data_Quality_Report_BUas"

# Date format for suffix
DATE_FMT = "%Y-%m-%d"
# --------------------------------------


def main():
    REPORT_DIR.mkdir(parents=True, exist_ok=True)

    if not DQ_DIR.exists():
        print(f"[WARN] DQ directory not found: {DQ_DIR}")
        return

    metrics = list(DQ_DIR.glob("*_dq_metrics.json"))
    if not metrics:
        print(f"[INFO] No dq_metrics files found in {DQ_DIR}")
        return

    today_str = date.today().strftime(DATE_FMT)
    out_docx = REPORT_DIR / f"{REPORT_BASENAME}__{today_str}.docx"

    # Generate only once per day
    if out_docx.exists():
        print(f"[SKIP] Today's report already exists → {out_docx}")
        return

    print(f"[RUN] Generating daily report → {out_docx}")
    try:
        build_report(DQ_DIR, out_docx)
        print(f"[OK] Report generated → {out_docx}")
        print(f"[OK] Summary CSVs written into → {REPORT_DIR}")
    except Exception as e:
        print(f"[ERROR] Report generation failed: {e}")


if __name__ == "__main__":
    main()