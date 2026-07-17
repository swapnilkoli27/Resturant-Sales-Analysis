# Use official lightweight Python runtime
FROM python:3.10-slim

# Set system-level environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=5002

# Set container working directory
WORKDIR /app

# Install system utilities if needed
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements file first to optimize cache layers
COPY requirements.txt .

# Install Python requirements
RUN pip install --no-cache-dir -r requirements.txt

# Copy all source assets into container
COPY . .

# Run model training pipeline to bake pre-trained models into the image
RUN python train.py

# Expose target listening port
EXPOSE 5002

# Start the production Gunicorn web server
CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:5002", "wsgi:app"]
