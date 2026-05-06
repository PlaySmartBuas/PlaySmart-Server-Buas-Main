from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
import subprocess
import os
import sys

from app.database import get_db
from app.crud import toolkit as toolkit_crud
from app.models.toolkit import ToolkitConfig, ToolkitConfigUpdate
from app.utils.auth import get_current_user_id

router = APIRouter()

# Global variables to track processes
toolkit_process = None
obs_process = None
tobii_process = None


class ToolkitPath(BaseModel):
    batPath: str


class OBSPath(BaseModel):
    obsPath: str


class TobiiPath(BaseModel):
    tobiiPath: str


class DataDirectoryPath(BaseModel):
    dataPath: str


@router.get("/select-file")
async def select_file():
    """Open a native file dialog to select the batch file"""
    try:
        import tkinter as tk
        from tkinter import filedialog

        root = tk.Tk()
        root.withdraw()
        root.attributes("-topmost", True)

        file_path = filedialog.askopenfilename(
            title="Select main.bat file",
            filetypes=[("Batch Files", "*.bat"), ("All Files", "*.*")],
            initialdir=os.path.expanduser("~"),
        )

        root.destroy()

        if file_path:
            return {"success": True, "filePath": file_path}
        else:
            return {"success": False, "filePath": None, "message": "No file selected"}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error opening file dialog: {str(e)}"
        )


@router.get("/select-obs")
async def select_obs():
    """Open a native file dialog to select OBS executable"""
    try:
        import tkinter as tk
        from tkinter import filedialog

        root = tk.Tk()
        root.withdraw()
        root.attributes("-topmost", True)

        # Start in Program Files by default
        initial_dir = "C:/Program Files"
        if not os.path.exists(initial_dir):
            initial_dir = os.path.expanduser("~")

        file_path = filedialog.askopenfilename(
            title="Select OBS Studio executable",
            filetypes=[("Executable Files", "*.exe"), ("All Files", "*.*")],
            initialdir=initial_dir,
        )

        root.destroy()

        if file_path:
            return {"success": True, "filePath": file_path}
        else:
            return {"success": False, "filePath": None, "message": "No file selected"}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error opening file dialog: {str(e)}"
        )


@router.get("/select-tobii")
async def select_tobii():
    """Open a native file dialog to select Tobii Eye Tracker Manager executable"""
    try:
        import tkinter as tk
        from tkinter import filedialog

        root = tk.Tk()
        root.withdraw()
        root.attributes("-topmost", True)

        # Start in Program Files by default
        initial_dir = "C:/Program Files"
        if not os.path.exists(initial_dir):
            initial_dir = os.path.expanduser("~")

        file_path = filedialog.askopenfilename(
            title="Select Tobii Eye Tracker Manager executable",
            filetypes=[("Executable Files", "*.exe"), ("All Files", "*.*")],
            initialdir=initial_dir,
        )

        root.destroy()

        if file_path:
            return {"success": True, "filePath": file_path}
        else:
            return {"success": False, "filePath": None, "message": "No file selected"}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error opening file dialog: {str(e)}"
        )


@router.post("/start-obs")
async def start_obs(data: OBSPath):
    """Start OBS Studio"""
    global obs_process

    if not data.obsPath:
        raise HTTPException(status_code=400, detail="No OBS path provided")

    if obs_process:
        poll = obs_process.poll()
        if poll is None:
            return {
                "success": True,
                "message": "OBS is already running",
                "pid": obs_process.pid,
            }
        else:
            obs_process = None

    if not os.path.exists(data.obsPath):
        raise HTTPException(
            status_code=400, detail=f"OBS executable not found: {data.obsPath}"
        )

    try:
        # Set working directory to OBS executable's directory
        obs_dir = os.path.dirname(data.obsPath)
        obs_process = subprocess.Popen([data.obsPath], cwd=obs_dir)
        return {
            "success": True,
            "message": "OBS started successfully",
            "pid": obs_process.pid,
        }
    except Exception as e:
        obs_process = None
        raise HTTPException(status_code=500, detail=f"Failed to start OBS: {str(e)}")


@router.post("/start-tobii")
async def start_tobii(data: TobiiPath):
    """Start Tobii Eye Tracker Manager"""
    global tobii_process

    if not data.tobiiPath:
        raise HTTPException(status_code=400, detail="No Tobii path provided")

    if tobii_process:
        poll = tobii_process.poll()
        if poll is None:
            return {
                "success": True,
                "message": "Tobii is already running",
                "pid": tobii_process.pid,
            }
        else:
            tobii_process = None

    if not os.path.exists(data.tobiiPath):
        raise HTTPException(
            status_code=400, detail=f"Tobii executable not found: {data.tobiiPath}"
        )

    try:
        # Set working directory to Tobii executable's directory
        tobii_dir = os.path.dirname(data.tobiiPath)
        tobii_process = subprocess.Popen([data.tobiiPath], cwd=tobii_dir)
        return {
            "success": True,
            "message": "Tobii started successfully",
            "pid": tobii_process.pid,
        }
    except Exception as e:
        tobii_process = None
        raise HTTPException(status_code=500, detail=f"Failed to start Tobii: {str(e)}")


@router.post("/start-toolkit")
async def start_toolkit(data: ToolkitPath):
    """Start the Play-O-Meter toolkit by executing the batch file"""
    global toolkit_process

    if not data.batPath:
        raise HTTPException(status_code=400, detail="No path provided")

    if toolkit_process:
        poll = toolkit_process.poll()
        if poll is None:
            raise HTTPException(status_code=400, detail="Toolkit is already running")
        else:
            toolkit_process = None

    if not os.path.exists(data.batPath):
        raise HTTPException(status_code=400, detail=f"File not found: {data.batPath}")

    try:
        if sys.platform == "win32":
            toolkit_process = subprocess.Popen(
                [data.batPath],
                creationflags=subprocess.CREATE_NEW_CONSOLE,
                cwd=os.path.dirname(data.batPath),
            )
        else:
            toolkit_process = subprocess.Popen([data.batPath], shell=True)

        return {
            "success": True,
            "message": "Toolkit started successfully",
            "pid": toolkit_process.pid,
        }
    except Exception as e:
        toolkit_process = None
        raise HTTPException(
            status_code=500, detail=f"Failed to start toolkit: {str(e)}"
        )


@router.post("/stop-toolkit")
async def stop_toolkit():
    """Stop the running toolkit process"""
    global toolkit_process

    if toolkit_process:
        try:
            toolkit_process.terminate()
            toolkit_process.wait(timeout=5)
            toolkit_process = None
            return {"success": True, "message": "Toolkit stopped successfully"}
        except Exception as e:
            toolkit_process = None
            raise HTTPException(
                status_code=500, detail=f"Error stopping toolkit: {str(e)}"
            )

    toolkit_process = None
    return {"success": True, "message": "No toolkit process was running"}


@router.get("/toolkit-status")
async def toolkit_status():
    """Check if the toolkit is currently running"""
    global toolkit_process

    if toolkit_process:
        poll = toolkit_process.poll()
        if poll is not None:
            toolkit_process = None
            return {"running": False}
        return {"running": True, "pid": toolkit_process.pid}

    return {"running": False}


@router.post("/reset-toolkit")
async def reset_toolkit():
    """Force reset the toolkit state"""
    global toolkit_process
    toolkit_process = None
    return {"success": True, "message": "Toolkit state reset"}


# Database endpoints for toolkit configuration
@router.get("/config", response_model=ToolkitConfig)
async def get_toolkit_config(
    user_id: int = Depends(get_current_user_id), db: Session = Depends(get_db)
):
    """Get toolkit configuration for the current user"""
    config = toolkit_crud.get_toolkit_config_by_user(db, user_id)
    if not config:
        raise HTTPException(status_code=404, detail="Toolkit configuration not found")
    return config


@router.post("/config", response_model=ToolkitConfig)
async def save_toolkit_config(
    config: ToolkitConfigUpdate,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Save or update toolkit configuration for the current user"""
    updated_config = toolkit_crud.update_toolkit_config(db, user_id, config)
    return updated_config
