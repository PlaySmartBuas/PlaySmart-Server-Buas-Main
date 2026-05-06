from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Any
import sys
import os
import logging
import pandas as pd

router = APIRouter()


class ReactionRequest(BaseModel):
    # model_path is optional: when omitted the backend will try the default model
    model_path: Optional[str] = None
    video_path: str
    input_log_path: str
    gaze_log_path: Optional[str] = None
    threshold: Optional[float] = 0.8
    output_csv_path: Optional[str] = None


@router.post("/run")
async def run_reaction_time(req: ReactionRequest) -> Any:
    """Run YOLO-based reaction time inference and return reaction instances as JSON.

    The endpoint will attempt to import the project inference module and run
    the pipeline. The function returns the reaction_data list (each item is a
    dict with timing fields) so the frontend can overlay markers.
    """
    try:
        # Ensure project root is on sys.path so local app packages can be imported
        project_root = os.path.abspath(
            os.path.join(os.path.dirname(__file__), "..", "..", "..", "..")
        )
        if project_root not in sys.path:
            sys.path.insert(0, project_root)

        # Prefer the packaged backend inference service if present
        try:
            from app.services import inference as rt_inference
        except Exception:
            # Fallback to legacy ModelKPIs location if backend service not available
            from ModelKPIs.Valorant.Reaction_time import inference as rt_inference
    except Exception as e:
        logging.exception("Failed to import inference module")
        raise HTTPException(status_code=500, detail=f"Import error: {e}")

    # Validate incoming payload and input files; collect structured issues so
    # frontend gets a clear explanation of what's missing or malformed.
    logging.info(f"Reaction inference request payload: {req.dict()}")

    issues = []
    checked_paths = {}

    # Video path - must be provided. It may be a filesystem path or a URL
    # (for example the frontend may send a backend-served URL like
    # http://localhost:8000/api/videos/<name>.mp4). If the path looks like a
    # URL or an internal /api path, skip the filesystem existence check and
    # let OpenCV attempt to open it at runtime.
    if not req.video_path:
        issues.append({"field": "video_path", "issue": "empty"})
    else:
        vp = req.video_path
        checked_paths["video_path"] = vp
        is_url_like = isinstance(vp, str) and (
            vp.startswith("http://")
            or vp.startswith("https://")
            or vp.startswith("/api/")
            or "localhost" in vp
        )
        if not is_url_like:
            # Only check filesystem existence for non-URL paths
            abs_vp = os.path.abspath(vp)
            checked_paths["video_path"] = abs_vp
            if not os.path.exists(abs_vp):
                issues.append(
                    {"field": "video_path", "issue": "not_found", "checked": abs_vp}
                )

    # Input log path - must be provided and readable
    if not req.input_log_path:
        issues.append({"field": "input_log_path", "issue": "empty"})
    else:
        checked_paths["input_log_path"] = os.path.abspath(req.input_log_path)
        if not os.path.exists(checked_paths["input_log_path"]):
            issues.append(
                {
                    "field": "input_log_path",
                    "issue": "not_found",
                    "checked": checked_paths["input_log_path"],
                }
            )
        else:
            # Try to read the CSV and check for minimal expected columns
            try:
                df = pd.read_csv(checked_paths["input_log_path"])
                cols = set(df.columns.tolist())
                # inference expects at least a 'unix_time' column and may look
                # for 'event_type' when determining clicks; warn if missing.
                if "unix_time" not in cols:
                    issues.append(
                        {
                            "field": "input_log_path",
                            "issue": "missing_column",
                            "missing": "unix_time",
                        }
                    )
                if "event_type" not in cols:
                    # Not fatal: we can still run inference, but clicks won't be detected
                    issues.append(
                        {
                            "field": "input_log_path",
                            "issue": "warning_missing_column",
                            "missing": "event_type",
                        }
                    )
            except Exception as e:
                issues.append(
                    {"field": "input_log_path", "issue": "read_error", "error": str(e)}
                )

    # Gaze log path optional - if provided, ensure it exists
    if req.gaze_log_path:
        checked_paths["gaze_log_path"] = os.path.abspath(req.gaze_log_path)
        if not os.path.exists(checked_paths["gaze_log_path"]):
            issues.append(
                {
                    "field": "gaze_log_path",
                    "issue": "not_found",
                    "checked": checked_paths["gaze_log_path"],
                }
            )

    if issues:
        logging.warning(f"Validation issues for reaction inference request: {issues}")
        # Return a structured 400 so the frontend can display helpful diagnostics
        raise HTTPException(
            status_code=400, detail={"issues": issues, "checked_paths": checked_paths}
        )

    # Call the inference function with defensive error handling so we can
    # return clearer HTTP errors for missing files instead of a generic 500.
    try:
        logging.info(
            "Calling inference with:",
            {
                "model_path": req.model_path or "",
                "video_path": req.video_path,
                "input_log_path": req.input_log_path,
                "gaze_log_path": req.gaze_log_path or "",
            },
        )

        result = rt_inference.run_yolo_inference(
            model_path=req.model_path or "",
            video_path=req.video_path,
            input_log_path=req.input_log_path,
            gaze_log_path=req.gaze_log_path or "",
            threshold=req.threshold or 0.8,
            output_csv_path=req.output_csv_path or "",
        )
    except FileNotFoundError as e:
        # Missing input file -> client error so return 400 with the message
        logging.warning(f"Inference FileNotFoundError: {e}")
        raise HTTPException(status_code=400, detail=f"Inference error: {e}")
    except Exception as e:
        logging.exception("Error running inference")
        raise HTTPException(status_code=500, detail=f"Inference error: {e}")

    # result is expected to be a dict containing 'reaction_data'
    if isinstance(result, dict) and "reaction_data" in result:
        return {
            "reaction_data": result["reaction_data"],
            "meta": {k: v for k, v in result.items() if k != "reaction_data"},
        }

    # Fallback: if run_yolo_inference returned a list, return it directly
    if isinstance(result, list):
        return {"reaction_data": result}

    raise HTTPException(status_code=500, detail="Unexpected inference result format")
