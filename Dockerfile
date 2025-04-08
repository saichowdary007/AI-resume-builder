FROM python:3.10-slim

# Set working directory inside container
WORKDIR /app

# Copy everything from your project into the container
COPY . /app

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Expose the FastAPI app port
EXPOSE 3002

# Start the server
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "3002"]
