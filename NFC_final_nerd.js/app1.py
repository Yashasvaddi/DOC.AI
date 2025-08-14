from flask import Flask, request, jsonify, send_from_directory
import os
import time # For simulating processing time
# from run_splitter import process_document # Uncomment and import your actual function
# from response import get_chat_response # Uncomment and import your actual function

app = Flask(__name__, static_folder='.') # Serve static files from the current directory

# --- Configuration ---
UPLOAD_FOLDER = 'uploads'
# Ensure the upload folder exists
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

# --- Frontend File Serving Routes ---
# These routes serve your HTML, CSS, and JS files directly.
# When you run the Flask app, navigate to http://127.0.0.1:5000/ in your browser.

@app.route('/')
def index():
    """Serves the main HTML page."""
    return send_from_directory('.', 'index.html')

@app.route('/style.css')
def style():
    """Serves the CSS file."""
    return send_from_directory('.', 'style.css')

@app.route('/script.js')
def script():
    """Serves the JavaScript file."""
    return send_from_directory('.', 'script.js')

# --- File Upload API Endpoint ---

@app.route('/upload', methods=['POST'])
def upload_file():
    """Handles file uploads from the frontend."""
    if 'file' not in request.files:
        return jsonify({'error': 'No file part in the request'}), 400

    file = request.files['file']

    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    if file:
        # Sanitize filename to prevent directory traversal attacks
        filename = os.path.basename(file.filename)
        filepath = os.path.join(UPLOAD_FOLDER, filename)

        try:
            file.save(filepath)
            print(f"File '{filename}' saved to {filepath}")

            # --- INTEGRATION POINT: Call run_splitter.py ---
            # This is where you integrate your document processing pipeline.
            # The `run_splitter.py` script should take the `filepath` as input.
            # It's also responsible for converting JPG/PNG to PDF if needed.
            print(f"Calling run_splitter.py with file: {filepath}...")
            time.sleep(2) # Simulate processing time
            # Example:
            # success, message = process_document(filepath)
            # if not success:
            #     return jsonify({'error': message}), 500

            return jsonify({'message': f'File "{filename}" uploaded and sent for processing!'}), 200

        except Exception as e:
            print(f"Error during file upload or processing: {e}")
            return jsonify({'error': f'Server error during file processing: {str(e)}'}), 500
    
    return jsonify({'error': 'An unexpected error occurred during upload.'}), 500

# --- Chatbot API Endpoint ---

@app.route('/chat', methods=['POST'])
def chat():
    """Handles chat queries from the frontend."""
    data = request.get_json()
    query = data.get('query')

    if not query:
        return jsonify({'error': 'No query provided'}), 400

    print(f"Received chat query: '{query}'")

    # --- INTEGRATION POINT: Call response.py ---
    # This is where you integrate your chatbot's response logic.
    # The `response.py` script should take the `query` and interact with Ollama Llama3.
    try:
        print(f"Calling response.py with query: '{query}'...")
        time.sleep(3) # Simulate AI thinking time

        # Example:
        # ai_response = get_chat_response(query)
        # if not ai_response:
        #     return jsonify({'error': 'Could not get a response from the AI.'}), 500

        # Placeholder response for demonstration
        ai_response = f"I received your question: '{query}'. Your Llama3 model (via response.py) would answer this."
        
        return jsonify({'response': ai_response}), 200

    except Exception as e:
        print(f"Error during chat response generation: {e}")
        return jsonify({'error': f'Server error during chat processing: {str(e)}'}), 500

# --- Run the Flask App ---

if __name__ == '__main__':
    # For development, debug=True provides helpful error messages and auto-reloads.
    # For production, set debug=False and use a production-ready WSGI server (e.g., Gunicorn).
    app.run(debug=True)