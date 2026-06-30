from fastapi import FastAPI

app = FastAPI(title="Business Starter Kit FastAPI", version="0.1.0")


@app.get("/health")
def health():
    return {"service": "api-fastapi", "status": "ok"}


@app.get("/")
def root():
    return {
        "service": "api-fastapi",
        "message": "Business Starter Kit Python API is alive",
    }
