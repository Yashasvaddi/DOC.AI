document.addEventListener('DOMContentLoaded', () => {
    // Global variables for UI elements
    let uploadedFiles = [];
    let processedFiles = [];
    let chatHistory = [];
    let recognition; // SpeechRecognition object
    let isRecording = false;
    let speakerEnabled = true;
    let audioContext;
    let gainNode;
    let audioQueue = [];
    let isPlaying = false;

    // DOM Elements
    const bgAnimation = document.getElementById('bgAnimation');
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebarToggle');
    const mobileToggle = document.getElementById('mobileToggle');
    const mainContent = document.getElementById('mainContent');
    const menuItems = document.querySelectorAll('.menu-item');
    const contentSections = document.querySelectorAll('.content-section');

    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');
    const fileList = document.getElementById('fileList');
    const processBtn = document.getElementById('processBtn');
    const clearAllBtn = document.getElementById('clearAllBtn');
    const progressBar = document.getElementById('progressBar');
    const progressFill = document.getElementById('progressFill');
    const statusMessage = document.getElementById('statusMessage');

    const chatMessages = document.getElementById('chatMessages');
    const chatInput = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendBtn');
    const micBtn = document.getElementById('micBtn');
    const speakerBtn = document.getElementById('speakerBtn');
    const volumeSlider = document.getElementById('volumeSlider');
    const globalDownloadBtn = document.getElementById('globalDownloadBtn');

    // --- Initialization ---
    // Initialize Lucide icons
    lucide.createIcons();
    // Initialize animated background
    createParticles();
    // Initialize audio context for text-to-speech volume control
    initAudioContext();
    // Initialize speech recognition for voice input
    initSpeechRecognition();
    // Setup sidebar navigation
    initSidebarNavigation();
    // Update initial button states
    updateButtons();

    // Set initial active section
    document.getElementById('file-manager').classList.add('active');

    // --- Animated Background Particles ---
    function createParticles() {
        for (let i = 0; i < 50; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            particle.style.left = Math.random() * 100 + '%';
            particle.style.top = Math.random() * 100 + '%';
            particle.style.width = Math.random() * 4 + 2 + 'px';
            particle.style.height = particle.style.width;
            particle.style.animationDelay = Math.random() * 6 + 's';
            particle.style.animationDuration = (Math.random() * 3 + 3) + 's';
            bgAnimation.appendChild(particle);
        }
    }

    // --- Sidebar Navigation ---
    function initSidebarNavigation() {
        menuItems.forEach(item => {
            item.addEventListener('click', () => {
                // Remove active class from all menu items
                menuItems.forEach(mi => mi.classList.remove('active'));
                // Add active class to clicked item
                item.classList.add('active');

                // Hide all content sections and remove active class
                contentSections.forEach(section => {
                    section.classList.remove('active');
                    section.style.display = 'none'; // Ensure display none for non-active
                });

                // Show selected content section
                const sectionId = item.getAttribute('data-section');
                const targetSection = document.getElementById(sectionId);
                if (targetSection) {
                    targetSection.style.display = 'block'; // Set display block before adding active
                    setTimeout(() => { // Small delay for animation to play
                        targetSection.classList.add('active');
                    }, 50);
                }

                // Close sidebar on mobile after selection
                if (window.innerWidth <= 992) { // Adjusted breakpoint for mobile sidebar
                    sidebar.classList.remove('open');
                }
            });
        });

        // Sidebar toggle for desktop
        sidebarToggle.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
            mainContent.classList.toggle('expanded'); // Adjust main content margin
            // Update icon based on collapsed state
            const icon = sidebarToggle.querySelector('i');
            if (sidebar.classList.contains('collapsed')) {
                icon.setAttribute('data-lucide', 'chevron-right');
            } else {
                icon.setAttribute('data-lucide', 'chevron-left');
            }
            lucide.createIcons(); // Re-render icon
        });

        // Mobile sidebar toggle
        mobileToggle.addEventListener('click', () => {
            sidebar.classList.toggle('open');
        });

        // Close sidebar on mobile when clicking outside
        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 992) {
                if (!sidebar.contains(e.target) && !mobileToggle.contains(e.target)) {
                    sidebar.classList.remove('open');
                }
            }
        });
    }

    // --- Audio Context for Text-to-Speech Volume ---
    function initAudioContext() {
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            gainNode = audioContext.createGain();
            gainNode.connect(audioContext.destination);
            gainNode.gain.value = volumeSlider.value;
        } catch (e) {
            console.error('Audio context initialization failed:', e);
            speakerBtn.disabled = true;
            speakerBtn.title = 'Text-to-Speech not supported or audio context failed.';
        }
    }

    // --- Speech Recognition (Voice-to-Text) ---
    function initSpeechRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.warn('Speech recognition not supported in this browser.');
            micBtn.disabled = true;
            micBtn.title = 'Speech Recognition not supported in this browser';
            return;
        }

        recognition = new SpeechRecognition();
        recognition.continuous = false; // Listen for a single utterance
        recognition.interimResults = false; // Only return final results
        recognition.lang = 'en-US';

        recognition.onstart = () => {
            isRecording = true;
            micBtn.classList.add('active');
            chatInput.placeholder = 'Listening... Speak now!';
            chatInput.disabled = true;
            sendBtn.disabled = true;
            speakerBtn.disabled = true; // Disable speaker during recording
        };

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            chatInput.value = transcript;
            // Automatically send message after recognition
            if (transcript.trim() !== '') {
                sendChatMessage();
            }
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            isRecording = false;
            micBtn.classList.remove('active');
            chatInput.placeholder = 'Ask me anything about your files...';
            chatInput.disabled = false;
            sendBtn.disabled = false;
            speakerBtn.disabled = false;
            if (event.error === 'no-speech') {
                addMessage('ai', 'I didn\'t catch that. Please try speaking louder or clearer.');
            } else if (event.error === 'not-allowed') {
                addMessage('ai', 'Microphone access denied. Please enable it in your browser settings.');
            } else {
                addMessage('ai', `Speech recognition error: ${event.error}`);
            }
        };

        recognition.onend = () => {
            isRecording = false;
            micBtn.classList.remove('active');
            chatInput.placeholder = 'Ask me anything about your files...';
            chatInput.disabled = false;
            sendBtn.disabled = false;
            speakerBtn.disabled = false;
        };

        micBtn.addEventListener('click', () => {
            if (isRecording) {
                recognition.stop();
            } else {
                try {
                    recognition.start();
                } catch (e) {
                    console.error('Error starting speech recognition:', e);
                    addMessage('ai', 'Could not start microphone. Please check permissions.');
                }
            }
        });
    }

    // --- Text-to-Speech (Speaker) ---
    function speak(text) {
        if (!speakerEnabled || !window.speechSynthesis) {
            console.warn('Text-to-speech not enabled or not supported.');
            return;
        }

        // Stop any ongoing speech
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.9;
        utterance.pitch = 1;
        utterance.volume = gainNode ? gainNode.gain.value : volumeSlider.value; // Use gainNode if available

        utterance.onend = () => {
            isPlaying = false;
            speakerBtn.classList.remove('active');
        };
        utterance.onstart = () => {
            isPlaying = true;
            speakerBtn.classList.add('active');
        };
        utterance.onerror = (event) => {
            console.error('SpeechSynthesisUtterance.onerror', event);
            isPlaying = false;
            speakerBtn.classList.remove('active');
        };

        window.speechSynthesis.speak(utterance);
    }

    function toggleSpeaker() {
        speakerEnabled = !speakerEnabled;
        speakerBtn.classList.toggle('active', speakerEnabled);
        if (gainNode) {
            gainNode.gain.value = speakerEnabled ? volumeSlider.value : 0;
        }
        if (!speakerEnabled && isPlaying) {
            window.speechSynthesis.cancel(); // Stop speech if disabled
        }
    }

    // Volume control
    volumeSlider.addEventListener('input', (e) => {
        if (gainNode) {
            gainNode.gain.value = e.target.value;
        }
        // If speaker is enabled and speech is playing, adjust volume immediately
        if (speakerEnabled && isPlaying) {
            // This might not immediately affect ongoing speech in all browsers,
            // but new speech will use the updated volume.
        }
    });

    speakerBtn.addEventListener('click', toggleSpeaker);

    // --- File Upload & Processing Logic ---
    uploadArea.addEventListener('click', () => fileInput.click());
    uploadArea.querySelector('.browse-link').addEventListener('click', (e) => {
        e.stopPropagation();
        fileInput.click();
    });

    uploadArea.addEventListener('dragover', handleDragOver);
    uploadArea.addEventListener('dragleave', handleDragLeave);
    uploadArea.addEventListener('drop', handleDrop);
    fileInput.addEventListener('change', handleFileSelect);

    function handleDragOver(e) {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    }

    function handleDragLeave(e) {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
    }

    function handleDrop(e) {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        const files = Array.from(e.dataTransfer.files);
        addFiles(files);
    }

    function handleFileSelect(e) {
        const files = Array.from(e.target.files);
        addFiles(files);
    }

    async function addFiles(files) {
        for (const file of files) {
            if (!uploadedFiles.find(f => f.file.name === file.name && f.file.size === file.size)) {
                const fileExtension = file.name.split('.').pop().toLowerCase();
                let fileToProcess = file;
                let originalType = file.type;

                // Client-side PDF conversion for images
                if (file.type.startsWith('image/') && (fileExtension === 'jpg' || fileExtension === 'jpeg' || fileExtension === 'png')) {
                    try {
                        showStatus(`Converting ${file.name} to PDF...`, 'info');
                        fileToProcess = await convertImageToPdf(file);
                        fileToProcess.name = file.name.replace(/\.(jpg|jpeg|png)$/i, '.pdf'); // Rename to .pdf
                        fileToProcess.type = 'application/pdf'; // Set new type
                        originalType = 'image-converted'; // Mark as converted image
                        showStatus(`${file.name} converted to PDF successfully!`, 'success');
                    } catch (error) {
                        console.error('Error converting image to PDF:', error);
                        showStatus(`Failed to convert ${file.name} to PDF. Uploading original.`, 'error');
                        fileToProcess = file; // Fallback to original if conversion fails
                        originalType = file.type;
                    }
                } else if (file.type !== 'application/pdf') {
                    showStatus(`Note: ${file.name} is not PDF/Image. Backend conversion required.`, 'info');
                }

                uploadedFiles.push({
                    file: fileToProcess,
                    originalFile: file, // Keep reference to original for display
                    id: Date.now() + Math.random(),
                    processed: false,
                    originalType: originalType // Store original type for icon
                });
            }
        }
        updateFileList();
        updateButtons();
    }

    async function convertImageToPdf(imageFile) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "anonymous"; // Important for CORS if image is from external URL
            img.src = URL.createObjectURL(imageFile);

            img.onload = () => {
                URL.revokeObjectURL(img.src); // Clean up URL object
                const { jsPDF } = window.jspdf;
                const doc = new jsPDF({
                    orientation: img.width > img.height ? 'l' : 'p', // Landscape if image is wider
                    unit: 'px',
                    format: [img.width, img.height] // Use image dimensions
                });

                doc.addImage(img, 'JPEG', 0, 0, img.width, img.height); // Add image to PDF
                const pdfBlob = doc.output('blob'); // Get PDF as Blob

                // Create a new File object from the Blob
                const pdfFile = new File([pdfBlob], imageFile.name.replace(/\.(jpg|jpeg|png)$/i, '.pdf'), {
                    type: 'application/pdf',
                    lastModified: Date.now()
                });
                resolve(pdfFile);
            };

            img.onerror = (error) => {
                URL.revokeObjectURL(img.src);
                reject(new Error('Failed to load image for PDF conversion.'));
            };
        });
    }

    function updateFileList() {
        fileList.innerHTML = '';
        uploadedFiles.forEach((fileObj, index) => {
            const fileItem = createFileItem(fileObj, index);
            fileList.appendChild(fileItem);
        });
        // Re-initialize icons for any new content
        lucide.createIcons();
    }

    function createFileItem(fileObj, index) {
        const div = document.createElement('div');
        div.className = 'file-item';

        const extension = fileObj.originalFile.name.split('.').pop().toLowerCase();
        const fileSize = formatFileSize(fileObj.originalFile.size);
        const statusIcon = fileObj.processed ? '✅' : '⏳';

        div.innerHTML = `
            <div class="file-info">
                <div class="file-icon ${getFileIconClass(fileObj.originalType || extension)}">
                    ${(fileObj.originalType || extension).toUpperCase().substring(0, 3)}
                </div>
                <div class="file-details">
                    <h4>${statusIcon} ${fileObj.originalFile.name}</h4>
                    <p>${fileSize} • ${fileObj.originalType ? fileObj.originalType.split('/')[1] : extension.toUpperCase()} • ${fileObj.processed ? 'Processed' : 'Ready'}</p>
                </div>
            </div>
            <div class="file-actions">
                <button class="btn btn-small btn-danger" onclick="removeFile(${index})">
                    <i data-lucide="trash-2"></i> Remove
                </button>
            </div>
        `;
        return div;
    }

    function getFileIconClass(type) {
        if (type.includes('pdf')) return 'pdf';
        if (type.includes('jpg') || type.includes('jpeg')) return 'jpg';
        if (type.includes('png')) return 'png';
        if (type.includes('txt')) return 'txt';
        return 'default';
    }

    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    function removeFile(index) {
        uploadedFiles.splice(index, 1);
        updateFileList();
        updateButtons();
        if (uploadedFiles.length === 0) {
            // If no files, hide chat/download sections and reset chat
            document.getElementById('chat-interface').classList.remove('active');
            document.getElementById('chat-interface').style.display = 'none';
            document.getElementById('download-options').classList.remove('active');
            document.getElementById('download-options').style.display = 'none';
            chatMessages.innerHTML = '<div class="welcome-message"><p>Hello! Upload a document to start a conversation.</p><p>I can summarize, answer questions, and extract key information.</p></div>';
            chatHistory = [];
            // Switch back to file manager if it's not active
            if (!document.getElementById('file-manager').classList.contains('active')) {
                menuItems.forEach(mi => mi.classList.remove('active'));
                document.querySelector('[data-section="file-manager"]').classList.add('active');
                document.getElementById('file-manager').style.display = 'block';
                setTimeout(() => document.getElementById('file-manager').classList.add('active'), 50);
            }
        }
    }

    function updateButtons() {
        processBtn.disabled = uploadedFiles.length === 0 || uploadedFiles.some(f => f.processed);
        clearAllBtn.disabled = uploadedFiles.length === 0;
    }

    function clearAll() {
        uploadedFiles = [];
        processedFiles = [];
        chatHistory = [];
        updateFileList();
        updateButtons();
        hideStatus();
        hideProgress();
        // Reset chat and hide sections
        document.getElementById('chat-interface').classList.remove('active');
        document.getElementById('chat-interface').style.display = 'none';
        document.getElementById('download-options').classList.remove('active');
        document.getElementById('download-options').style.display = 'none';
        chatMessages.innerHTML = '<div class="welcome-message"><p>Hello! Upload a document to start a conversation.</p><p>I can summarize, answer questions, and extract key information.</p></div>';
        fileInput.value = ''; // Clear the file input
        // Ensure file manager is active
        menuItems.forEach(mi => mi.classList.remove('active'));
        document.querySelector('[data-section="file-manager"]').classList.add('active');
        document.getElementById('file-manager').style.display = 'block';
        setTimeout(() => document.getElementById('file-manager').classList.add('active'), 50);
    }

    processBtn.addEventListener('click', processFiles);

    async function processFiles() {
        if (uploadedFiles.length === 0) return;

        showProgress();
        processBtn.disabled = true;
        clearAllBtn.disabled = true;

        try {
            for (let i = 0; i < uploadedFiles.length; i++) {
                const fileObj = uploadedFiles[i];
                updateProgress(((i + 0.5) / uploadedFiles.length) * 100); // Halfway for upload, half for processing

                const formData = new FormData();
                formData.append('file', fileObj.file); // Send the potentially converted PDF file

                // Simulate actual upload to Flask backend
                const response = await fetch('/upload', {
                    method: 'POST',
                    body: formData,
                });

                const result = await response.json();

                if (!response.ok) {
                    throw new Error(result.error || `Failed to upload ${fileObj.file.name}`);
                }

                // Simulate backend processing time
                await new Promise(resolve => setTimeout(resolve, 1500));

                fileObj.processed = true;
                processedFiles.push(fileObj);
                updateFileList();
                updateProgress(((i + 1) / uploadedFiles.length) * 100);
            }

            showStatus(`Successfully processed ${uploadedFiles.length} files!`, 'success');

            // Transition to chat interface after processing
            setTimeout(() => {
                hideProgress();
                // Activate chat interface section
                menuItems.forEach(mi => mi.classList.remove('active'));
                document.querySelector('[data-section="chat-interface"]').classList.add('active');
                contentSections.forEach(section => section.classList.remove('active'));
                document.getElementById('chat-interface').style.display = 'block';
                setTimeout(() => document.getElementById('chat-interface').classList.add('active'), 50);

                // Add welcome message from AI
                const welcomeText = `Great! I've processed ${uploadedFiles.length} files. What would you like to know about them?`;
                addMessage('ai', welcomeText);
                speak(welcomeText);
                chatInput.focus();
            }, 1000);

        } catch (error) {
            console.error('Processing error:', error);
            showStatus('Error during file processing: ' + error.message, 'error');
            hideProgress();
        } finally {
            processBtn.disabled = false;
            clearAllBtn.disabled = false;
        }
    }

    function showProgress() {
        progressBar.style.display = 'block';
        progressFill.style.width = '0%';
    }

    function hideProgress() {
        setTimeout(() => {
            progressBar.style.display = 'none';
            progressFill.style.width = '0%';
        }, 1000);
    }

    function updateProgress(percent) {
        progressFill.style.width = percent + '%';
    }

    function showStatus(message, type) {
        statusMessage.innerHTML = message;
        statusMessage.className = `status-message status-${type}`;
        statusMessage.style.display = 'block';

        if (type === 'success' || type === 'info') {
            setTimeout(hideStatus, 5000);
        }
    }

    function hideStatus() {
        statusMessage.style.display = 'none';
        statusMessage.className = 'status-message';
    }

    // --- Chatbot Messaging ---
    sendBtn.addEventListener('click', sendChatMessage);
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendChatMessage();
        }
    });
    chatInput.addEventListener('input', () => {
        chatInput.style.height = 'auto';
        chatInput.style.height = Math.min(chatInput.scrollHeight, 150) + 'px';
    });

    async function sendChatMessage() {
        const query = chatInput.value.trim();
        if (!query) return;

        addMessage('user', query);
        chatInput.value = '';
        chatInput.style.height = 'auto'; // Reset height after sending
        chatInput.disabled = true;
        sendBtn.disabled = true;
        micBtn.disabled = true;
        speakerBtn.disabled = true;

        try {
            const response = await fetch('/chat', { // Your Flask chat endpoint
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ query: query }),
            });

            const result = await response.json();

            if (response.ok) {
                const aiResponse = result.response || 'No response from AI.';
                addMessage('ai', aiResponse);
                speak(aiResponse);
            } else {
                addMessage('ai', result.error || 'Error getting response from AI.');
                speak('Sorry, I encountered an error.');
            }
        } catch (error) {
            console.error('Chat error:', error);
            addMessage('ai', 'Network error or AI assistant is unreachable.');
            speak('Sorry, I cannot connect to the AI assistant right now.');
        } finally {
            chatInput.disabled = false;
            sendBtn.disabled = false;
            micBtn.disabled = false;
            speakerBtn.disabled = false;
            chatInput.focus();
        }
    }

    function addMessage(sender, content) {
        const welcomeMsg = chatMessages.querySelector('.welcome-message');
        if (welcomeMsg) {
            welcomeMsg.remove();
        }
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}`;

        const avatarIcon = sender === 'user' ? 'user' : 'bot';

        messageDiv.innerHTML = `
            <div class="message-avatar">
                <i data-lucide="${avatarIcon}"></i>
            </div>
            <div class="message-content">${content}</div>
        `;
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        lucide.createIcons(); // Re-render icons for new messages
        chatHistory.push({ sender, content });
    }

    // --- Global Download Button (Placeholder) ---
    // --- Global Download Button ---
globalDownloadBtn.addEventListener('click', async () => {
    const directoryPath = 'C:\\Users\\Nitesh\\NFC_final_nerd.js\\NFC4_nerdjs\\database';
    
    try {
        showStatus('Preparing directory for download...', 'info');

        const response = await fetch('/download-directory', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ directoryPath: directoryPath })
        });

        if (!response.ok) {
            throw new Error('Failed to download directory');
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'database.zip';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        showStatus('Directory download started!', 'success');
    } catch (error) {
        console.error('Error downloading directory:', error);
        showStatus('Error downloading directory: ' + error.message, 'error');
    }
});

// --- Radio Button Logic (UI only) ---
document.querySelectorAll('input[name="uploadType"]').forEach(radio => {
    radio.addEventListener('change', (event) => {
        if (event.target.value === 'multiple') {
            fileInput.multiple = true; // Enable multiple file selection
        } else {
            fileInput.multiple = false; // Restrict to a single file
        }
    });
});

// --- Handle window resize for sidebar ---
window.addEventListener('resize', () => {
    if (window.innerWidth > 992) {
        sidebar.classList.remove('open');
    }
});

    // --- Radio Button Logic (UI only) ---
    document.addEventListener('DOMContentLoaded', function () {
        const fileInput = document.getElementById('fileInput'); // Make sure this ID exists

        document.querySelectorAll('input[name="uploadType"]').forEach(radio => {
            radio.addEventListener('change', (event) => {
                if (event.target.value === 'multiple') {
                    fileInput.multiple = true; // Enable multiple file selection
                } else {
                    fileInput.multiple = false; // Restrict to a single file
                }
            });
        });
    });


    // --- Handle window resize for sidebar ---
    window.addEventListener('resize', () => {
        if (window.innerWidth > 992) {
            sidebar.classList.remove('open');
        }
    });
});
