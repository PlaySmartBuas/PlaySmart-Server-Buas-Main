#!/usr/bin/env bash
# setup_inference_service.sh
# Run this once on the Linux GPU box to stand up the Play-Smart inference service.
set -euo pipefail

APP_DIR="/opt/play-smart-inference"
MOUNT_POINT="/mnt/sftp_data"
SERVICE_USER="inference"

echo "== 1. Create service user (no login shell needed) =="
if ! id "$SERVICE_USER" &>/dev/null; then
    sudo useradd --system --no-create-home --shell /usr/sbin/nologin "$SERVICE_USER"
fi

echo "== 2. Create app directory =="
sudo mkdir -p "$APP_DIR"
sudo chown "$USER":"$USER" "$APP_DIR"
# Copy main.py, run_yolo_inference.py, and your models/ folder into $APP_DIR
# before continuing, e.g.:
#   cp main.py run_yolo_inference.py "$APP_DIR"/
#   cp -r models "$APP_DIR"/

echo "== 3. Set up the SMB mount (replaces the Windows Z:/ drive mapping) =="
sudo mkdir -p "$MOUNT_POINT"
# Store SMB creds outside of fstab so they aren't world-readable
sudo tee /etc/samba/credentials-sftp_data > /dev/null <<'EOF'
username=YOUR_SMB_USERNAME
password=YOUR_SMB_PASSWORD
EOF
sudo chmod 600 /etc/samba/credentials-sftp_data

# Add this line to /etc/fstab (adjust //host/share to match your setup):
#   //queenbee/sftp_data /mnt/sftp_data cifs credentials=/etc/samba/credentials-sftp_data,uid=inference,gid=inference,iocharset=utf8,vers=3.0,_netdev 0 0
echo "NOTE: add the fstab line shown in this script's comments, then run: sudo mount -a"

echo "== 4. Python venv + dependencies =="
cd "$APP_DIR"
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip

# Use opencv-python-headless on a server with no display
pip install fastapi "uvicorn[standard]" pydantic pandas opencv-python-headless ultralytics

# Install the CUDA build of torch matching your driver/CUDA version.
# Check your CUDA version first with: nvidia-smi
# Then get the right command from https://pytorch.org/get-started/locally/
# Example for CUDA 12.1:
pip install torch --index-url https://download.pytorch.org/whl/cu121

echo "== 5. Install and start the systemd service =="
sudo cp playsmart-inference.service /etc/systemd/system/
sudo chown -R "$SERVICE_USER":"$SERVICE_USER" "$APP_DIR"
sudo systemctl daemon-reload
sudo systemctl enable playsmart-inference
sudo systemctl start playsmart-inference
sudo systemctl status playsmart-inference --no-pager

echo "== 6. Open the firewall port (if ufw is in use) =="
sudo ufw allow 8000/tcp || true

echo "Done. Check logs with: sudo journalctl -u playsmart-inference -f"
