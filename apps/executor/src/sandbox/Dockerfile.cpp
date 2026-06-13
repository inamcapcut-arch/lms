FROM gcc:13
RUN apt-get update && apt-get install -y python3 && rm -rf /var/lib/apt/lists/*
RUN useradd -u 1000 -m sandbox
WORKDIR /workspace
