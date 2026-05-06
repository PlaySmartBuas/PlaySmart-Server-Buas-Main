import os
import pandas as pd

from esports_utils import (
    ensure_unix_time_numeric,
    add_time_offset,
    parse_datetime,
    clip_gaze_01,
    normalize_screen_coords,
    clean_event_and_emotion,
    optional_drop_static_resolution,
    resample_nearest,
    compute_dq_metrics,
    save_json,
)

# ---------------- CONFIG ----------------
MERGED_DIR  = "/mnt/raid0/esports/sftp_data/merged"
CLEANED_DIR = "/mnt/raid0/esports/Comiccon/cleaned"
DQ_DIR      = "/mnt/raid0/esports/Comiccon/dq_checks"

RESAMPLE_HZ = None          # keep None unless you explicitly want resampling
DROP_STATIC_RES = True
# --------------------------------------


def clean_pipeline(df: pd.DataFrame) -> pd.DataFrame:
    """Same pipeline as clean_preprocessing.py, but callable server-side."""
    df = ensure_unix_time_numeric(df)
    df = add_time_offset(df)
    df = parse_datetime(df)
    df = clip_gaze_01(df)                # NOTE: no clipping, only coercion
    df = normalize_screen_coords(df)
    df = clean_event_and_emotion(df)
    if RESAMPLE_HZ:
        df = resample_nearest(df, RESAMPLE_HZ)
    df = optional_drop_static_resolution(df, drop_if_constant=DROP_STATIC_RES)
    return df


def iter_merged_files():
    if not os.path.isdir(MERGED_DIR):
        print(f"[WARN] Folder not found: {MERGED_DIR}")
        return []
    return sorted(f for f in os.listdir(MERGED_DIR) if f.endswith("_merged.csv"))


def main():
    os.makedirs(CLEANED_DIR, exist_ok=True)
    os.makedirs(DQ_DIR, exist_ok=True)

    files = iter_merged_files()
    if not files:
        print("[INFO] No merged files found.")
        return

    for fname in files:
        in_path = os.path.join(MERGED_DIR, fname)
        base = fname.replace(".csv", "")

        cleaned_path = os.path.join(CLEANED_DIR, f"{base}__cleaned.csv")
        dq_path = os.path.join(DQ_DIR, f"{base}__dq_metrics.json")

        if os.path.isfile(cleaned_path) and os.path.isfile(dq_path):
            print(f"[SKIP] {fname}: already cleaned and checked")
            continue

        if os.path.getsize(in_path) == 0:
            print(f"[WARN] {fname} is empty, skipping")
            continue

        print(f"\n=== Cleaning & DQ: {fname} ===")

        try:
            df = pd.read_csv(in_path, low_memory=False)
        except Exception as e:
            print(f"[ERROR] Failed to read {fname}: {e}")
            continue

        dq_before = compute_dq_metrics(df)

        try:
            cleaned = clean_pipeline(df)
        except Exception as e:
            print(f"[ERROR] Cleaning failed for {fname}: {e}")
            continue

        dq_after = compute_dq_metrics(cleaned)

        try:
            if not os.path.isfile(cleaned_path):
                cleaned.to_csv(cleaned_path, index=False)
                print(f"[OK] Saved cleaned → {cleaned_path}")

            if not os.path.isfile(dq_path):
                save_json({"before": dq_before, "after": dq_after}, dq_path)
                print(f"[OK] Saved dq metrics → {dq_path}")

        except Exception as e:
            print(f"[ERROR] Saving failed for {fname}: {e}")


if __name__ == "__main__":
    main()