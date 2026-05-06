import json
import numpy as np
import pandas as pd


# ---------- Parsing & small transforms ----------

def parse_resolution_column(series: pd.Series) -> pd.DataFrame:
    """
    Parse strings like '2560x1440p' or '1920x1080' into numeric res_x, res_y.
    If already numeric, attempt to coerce. Returns DataFrame with res_x/res_y.
    """
    extracted = series.astype(str).str.extract(
        r"(?P<res_x>\d+)\s*x\s*(?P<res_y>\d+)", expand=True
    )
    extracted["res_x"] = pd.to_numeric(extracted["res_x"], errors="coerce")
    extracted["res_y"] = pd.to_numeric(extracted["res_y"], errors="coerce")
    return extracted


def ensure_unix_time_numeric(df: pd.DataFrame) -> pd.DataFrame:
    if "unix_time" not in df.columns:
        raise ValueError("Expected 'unix_time' column.")
    df["unix_time"] = pd.to_numeric(df["unix_time"], errors="coerce")
    return df


def add_time_offset(df: pd.DataFrame) -> pd.DataFrame:
    df["time_offset_ms"] = df["unix_time"] - df["unix_time"].min()
    return df


def parse_datetime(df: pd.DataFrame) -> pd.DataFrame:
    if "datetime" in df.columns:
        df["datetime_parsed"] = pd.to_datetime(df["datetime"], errors="coerce")
    return df


# ---------- Cleaning primitives ----------

def clip_gaze_01(df: pd.DataFrame) -> pd.DataFrame:
    for col in ["left_gaze_x", "left_gaze_y", "right_gaze_x", "right_gaze_y"]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")
    return df


def normalize_screen_coords(df: pd.DataFrame) -> pd.DataFrame:
    # Expect res_x/res_y present; compute if needed from screen_resolution_x
    if "res_x" not in df.columns or "res_y" not in df.columns:
        if "screen_resolution_x" in df.columns:
            parsed = parse_resolution_column(df["screen_resolution_x"])
            df["res_x"] = parsed["res_x"]
            df["res_y"] = parsed["res_y"]
        if "screen_resolution_y" in df.columns:
            if "res_y" not in df.columns:
                df["res_y"] = np.nan
            df["res_y"] = df["res_y"].fillna(pd.to_numeric(df["screen_resolution_y"], errors="coerce"))
    # Now create normalized coords if screen_x, screen_y present
    if all(c in df.columns for c in ["screen_x", "screen_y", "res_x", "res_y"]):
        with np.errstate(divide="ignore", invalid="ignore"):
            df["screen_x_norm"] = df["screen_x"] / df["res_x"]
            df["screen_y_norm"] = df["screen_y"] / df["res_y"]
    return df


def clean_event_and_emotion(df: pd.DataFrame) -> pd.DataFrame:
    if "event_type" in df.columns:
        df["event_type"] = df["event_type"].fillna("no_event")

    if "emotion" in df.columns:
        # Convert blanks & strings representing missing → NaN
        df["emotion"] = (
            df["emotion"]
            .replace(["", " ", "NA", "N/A", "None", "null"], np.nan)
        )

    if "confidence" in df.columns:
        if pd.api.types.is_numeric_dtype(df["confidence"]):
            df["confidence"] = df["confidence"].fillna(df["confidence"].mean())
        else:
            df["confidence"] = pd.to_numeric(df["confidence"], errors="coerce").fillna(0.0)

    return df


def optional_drop_static_resolution(df: pd.DataFrame, drop_if_constant: bool) -> pd.DataFrame:
    if drop_if_constant:
        for col in ["res_x", "res_y"]:
            if col in df.columns:
                series = df[col].dropna()
                if len(series) > 0 and series.nunique() == 1:
                    df.drop(columns=[col], inplace=True)
        for col in ["screen_resolution_x", "screen_resolution_y"]:
            if col in df.columns:
                df.drop(columns=[col], inplace=True)
    return df


# ---------- Resampling ----------

def resample_nearest(df: pd.DataFrame, hz: float) -> pd.DataFrame:
    """
    Resample to fixed Hz by nearest timestamp. Keeps nearest rows to a regular grid.
    Assumes unix_time is in milliseconds.
    """
    if "unix_time" not in df.columns:
        raise ValueError("Expected 'unix_time' for resampling.")
    out = df.sort_values("unix_time").copy()
    t0 = int(out["unix_time"].min())
    t1 = int(out["unix_time"].max())
    period_ms = int(round(1000.0 / float(hz)))
    target_ts = np.arange(t0, t1 + period_ms, period_ms, dtype=np.int64)
    target = pd.DataFrame({"unix_time": target_ts})
    merged = pd.merge_asof(
        target.sort_values("unix_time"),
        out.sort_values("unix_time"),
        on="unix_time",
        direction="nearest",
    )
    return merged


# ---------- DQ metrics ----------

def compute_dq_metrics(df: pd.DataFrame) -> dict:
    """General-purpose DQ metrics to run on raw or cleaned CSVs."""
    metrics = {}
    metrics["rows"] = int(len(df))
    metrics["columns"] = int(len(df.columns))
    metrics["columns_list"] = list(df.columns)
    metrics["dtypes"] = {c: str(t) for c, t in df.dtypes.items()}
    metrics["missing_total"] = int(df.isna().sum().sum())
    metrics["missing_by_column"] = {c: int(n) for c, n in df.isna().sum().items()}
    metrics["duplicate_rows"] = int(df.duplicated().sum())

    # Validity checks
    validity = {}
    for col in ["left_gaze_x", "left_gaze_y", "right_gaze_x", "right_gaze_y"]:
        if col in df.columns and pd.api.types.is_numeric_dtype(df[col]):
            s = df[col]
            valid_mask = s.between(0, 1)
            validity[col] = {
                "valid_pct": float(valid_mask.mean() * 100.0),
                "min": float(s.min()) if len(s) else None,
                "max": float(s.max()) if len(s) else None,
                "out_of_bounds_pct": float((~valid_mask).mean() * 100.0),
            }
    for col in ["screen_x", "screen_y", "screen_x_norm", "screen_y_norm"]:
        if col in df.columns and pd.api.types.is_numeric_dtype(df[col]):
            s = df[col]
            valid_mask = s >= 0
            validity[col] = {
                "valid_pct": float(valid_mask.mean() * 100.0),
                "min": float(s.min()) if len(s) else None,
                "max": float(s.max()) if len(s) else None,
            }
    metrics["validity_checks"] = validity

    # Timeliness
    if "unix_time" in df.columns:
        try:
            unix = pd.to_numeric(df["unix_time"], errors="coerce")
            diffs = unix.diff()
            negative_steps = int((diffs < 0).sum(skipna=True))
            zero_steps = int((diffs == 0).sum(skipna=True))
            metrics["timeliness"] = {
                "monotonic_non_decreasing": negative_steps == 0,
                "negative_steps": negative_steps,
                "equal_steps": zero_steps,
            }
        except Exception:
            metrics["timeliness"] = {"monotonic_non_decreasing": False}

    # Completeness KPI (% non-null per column)
    metrics["completeness_pct_by_column"] = {
        c: float(100.0 * (1.0 - df[c].isna().mean())) for c in df.columns
    }

    # Composite "quality score" (tune weights to taste)
    completeness_mean = float(np.mean(list(metrics["completeness_pct_by_column"].values())))
    uniqueness_score = 100.0 * (1.0 - (metrics["duplicate_rows"] / max(1, len(df))))
    gaze_valid_scores = [
        validity[k]["valid_pct"]
        for k in ["left_gaze_x", "left_gaze_y", "right_gaze_x", "right_gaze_y"]
        if k in validity
    ]
    gaze_valid_mean = float(np.mean(gaze_valid_scores)) if gaze_valid_scores else completeness_mean
    overall = 0.6 * completeness_mean + 0.2 * uniqueness_score + 0.2 * gaze_valid_mean
    metrics["overall_quality_score_pct"] = float(round(overall, 2))

    return metrics


def save_json(obj: dict, path: str):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, indent=2)
