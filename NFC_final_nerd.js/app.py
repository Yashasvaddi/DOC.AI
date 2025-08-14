from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import os
import time
import uuid
from typing import Optional
from NFC4_nerdjs.modules.response import res_main as genans 
from NFC4_nerdjs.modules.run_splitter import main as run_slpitter
from NFC4_nerdjs.modules.pdf_highlighter import main as pdf_high
import zipfile
# Initialize FastAPI app
app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration
UPLOAD_FOLDER = 'C:\\Users\\Nitesh\\NFC_final_nerd.js\\NFC4_nerdjs\\database'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Mount static files (for serving frontend)
app.mount("/static", StaticFiles(directory="."), name="static")

class DownloadRequest(BaseModel):
    directoryPath: str

# Models
class ChatRequest(BaseModel):
    query: str

# Frontend file serving routes
@app.get("/")
async def index():
    return FileResponse("index.html")

@app.get("/style.css")
async def style():
    return FileResponse("style.css")

@app.get("/script.js")
async def script():
    return FileResponse("script.js")

# File upload endpoint
@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No selected file")
    
    try:
        # Generate a unique filename to prevent conflicts
        file_ext = os.path.splitext(file.filename)[1]
        unique_filename = f"{uuid.uuid4()}{file_ext}"
        file_path = os.path.join(UPLOAD_FOLDER, unique_filename)
        
        # Save the file
        with open(file_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
        
        print(f"File '{file.filename}' saved as '{unique_filename}' at {file_path}")
        run_slpitter(unique_filename)
        pdf_high(unique_filename)
        # Simulate document processing
        print(f"Processing document: {file_path}...")
        time.sleep(2)  # Simulate processing time
        
        # In a real app, you would call your processing function:
        # success, message = process_document(file_path)
        # if not success:
        #     raise HTTPException(status_code=500, detail=message)

        return JSONResponse(
            status_code=200,
            content={"message": f"File '{file.filename}' uploaded and processed successfully!"},
        )
        
    except Exception as e:
        print(f"Error during file processing: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Server error during file processing: {str(e)}"
        )

@app.post("/download-directory")
async def download_directory(request: DownloadRequest):
    try:
        directory_path = request.directoryPath

        if not os.path.exists(directory_path):
            return JSONResponse(status_code=404, content={"error": "Directory not found"})

        zip_output_dir = "temp"
        zip_filename = "database.zip"
        os.makedirs(zip_output_dir, exist_ok=True)
        zip_path = os.path.join(zip_output_dir, zip_filename)

        # Create the zip file
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for root, _, files in os.walk(directory_path):
                for file in files:
                    abs_path = os.path.join(root, file)
                    rel_path = os.path.relpath(abs_path, start=directory_path)
                    zipf.write(abs_path, arcname=rel_path)

        return FileResponse(zip_path, filename=zip_filename, media_type='application/zip')

    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

# Chatbot endpoint
@app.post("/chat")
async def chat(chat_request: ChatRequest):
    if not chat_request.query:
        raise HTTPException(status_code=400, detail="No query provided")
    
    print(f"Received chat query: '{chat_request.query}'")

    try:
        # Simulate AI processing time
        print("Processing query with AI...")
        time.sleep(3)
        
        # In a real app, you would call your AI response function:
        # ai_response = get_chat_response(chat_request.query)
        # if not ai_response:
        #     raise HTTPException(status_code=500, detail="Could not get AI response")

        # Placeholder response
        ai_response = genans(chat_request.query)  # Call PDF highlighter if needed
        return JSONResponse(
            status_code=200,
            content={"response": ai_response}
        )
        
    except Exception as e:
        print(f"Error during chat processing: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Server error during chat processing: {str(e)}"
        )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)