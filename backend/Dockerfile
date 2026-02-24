# ---- Builder Stage ----
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim AS builder

# Node.js is needed by prisma-client-py to run `prisma generate`
RUN apt-get update && apt-get install -y --no-install-recommends nodejs npm \
    && rm -rf /var/lib/apt/lists/*

# Enable bytecode compilation
ENV UV_COMPILE_BYTECODE=1

# Copy from the cache instead of linking since it's a separate volume
ENV UV_LINK_MODE=copy

# Increase download timeout for large packages (torch, scipy, etc.)
ENV UV_HTTP_TIMEOUT=300

# Install dependencies
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-install-project --no-dev

# Generate Prisma client from schema
COPY README.md ./
COPY prisma ./prisma
RUN uv run prisma generate


# ---- Final Stage ----
FROM python:3.12-slim-bookworm

# Node.js runtime needed by the generated Prisma engine
RUN apt-get update && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy the virtual environment from the builder
COPY --from=builder /app/.venv /app/.venv

# Copy the Prisma query engine binary from the builder cache
COPY --from=builder /root/.cache/prisma-python /root/.cache/prisma-python

# Add .venv/bin to PATH
ENV PATH="/app/.venv/bin:$PATH"

# Copy the source code (respects .dockerignore)
COPY . .

# Expose the port FastAPI runs on
EXPOSE 8000

# Run the application with Uvicorn
CMD ["uvicorn", "src.api.server:app", "--host", "0.0.0.0", "--port", "8000"]
