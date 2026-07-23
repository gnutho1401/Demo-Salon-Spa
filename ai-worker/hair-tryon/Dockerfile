FROM python:3.10-slim

WORKDIR /app

# Install system dependencies for OpenCV and other AI packages
RUN apt-get update && apt-get install -y \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgl1-mesa-glx \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements file
COPY requirements.txt .

# Install Python dependencies
# Note: If deploying to a GPU instance, you might need to install torch with CUDA support explicitly before other requirements.
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source code
COPY . .

# Expose port (RunPod/EC2 often use 8000 for FastAPI)
EXPOSE 8000

# Start the application using Uvicorn
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
