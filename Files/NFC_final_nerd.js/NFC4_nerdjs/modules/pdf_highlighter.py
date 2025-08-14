#!/usr/bin/env python3
"""
Final PDF Highlighter - Works with your JSON structure
Highlights PDF based on location information and content matching
"""

import fitz  # PyMuPDF
import json
import re
import os
from difflib import SequenceMatcher
from typing import List, Dict, Tuple, Optional

class PDFHighlighter:
    def __init__(self, pdf_path: str, json_path: str):
        self.pdf_path = pdf_path
        self.json_path = json_path
        self.pdf_doc = None
        self.json_data = None
        self.colors = [
            [1, 1, 0],      # Yellow
            [0, 1, 0],      # Green  
            [1, 0.5, 0],    # Orange
            [0, 0.8, 1],    # Light Blue
            [1, 0, 1],      # Magenta
            [0.5, 1, 0.5],  # Light Green
            [1, 0.7, 0.7],  # Pink
            [0.7, 0.7, 1],  # Light Purple
        ]
        
    def load_files(self) -> bool:
        """Load PDF and JSON files"""
        try:
            # Load PDF
            if not os.path.exists(self.pdf_path):
                print(f"❌ PDF file not found: {self.pdf_path}")
                return False
            
            self.pdf_doc = fitz.open(self.pdf_path)
            print(f"✅ Loaded PDF with {self.pdf_doc.page_count} pages")
            
            # Load JSON
            if not os.path.exists(self.json_path):
                print(f"❌ JSON file not found: {self.json_path}")
                return False
                
            with open(self.json_path, 'r', encoding='utf-8') as f:
                self.json_data = json.load(f)
            
            keypoints = self.json_data.get('contextual_keypoints', [])
            print(f"✅ Loaded JSON with {len(keypoints)} keypoints")
            
            return True
            
        except Exception as e:
            print(f"❌ Error loading files: {e}")
            return False
    
    def extract_sentences_from_keypoint(self, keypoint_text: str) -> List[str]:
        """Extract actual sentences from formatted keypoint text"""
        if not keypoint_text:
            return []
        
        sentences = []
        
        # Remove formatting markers
        text = re.sub(r'\*\*[^*]+\*\*', '', keypoint_text)  # Remove **headers**
        text = re.sub(r'^\*\s+', '', text, flags=re.MULTILINE)  # Remove bullet points
        text = re.sub(r'^[\s\-\•\d\.]+', '', text, flags=re.MULTILINE)  # Remove bullets and numbers
        text = re.sub(r'Here is the extracted.*?:', '', text, flags=re.IGNORECASE)  # Remove meta text
        text = re.sub(r'None mentioned', '', text, flags=re.IGNORECASE)  # Remove "None mentioned"
        
        # Extract sentences
        potential_sentences = re.split(r'[.!?]+', text)
        
        for sentence in potential_sentences:
            sentence = sentence.strip()
            if (len(sentence) > 15 and 
                not sentence.lower().startswith(('here is', 'none', 'technical details', 'key points', 'important facts')) and
                not re.match(r'^\d+\s*:', sentence)):  # Skip numbered items
                
                # Clean up the sentence
                sentence = re.sub(r'\s+', ' ', sentence)  # Normalize whitespace
                sentence = re.sub(r'^[^\w]+', '', sentence)  # Remove leading non-word chars
                sentences.append(sentence)
        
        return sentences[:5]  # Return top 5 sentences
    
    def parse_location(self, location: str) -> Optional[int]:
        """Extract page number from location string"""
        if not location:
            return None
            
        # Look for "Page X" pattern
        match = re.search(r'Page\s+(\d+)', location, re.IGNORECASE)
        if match:
            return int(match.group(1))
        
        return None
    
    def find_text_on_page(self, page: fitz.Page, search_texts: List[str], min_similarity: float = 0.6) -> List[fitz.Rect]:
        """Find text locations on a specific page"""
        found_rects = []
        page_text = page.get_text()
        
        for search_text in search_texts:
            if len(search_text) < 10:  # Skip very short text
                continue
            
            # Method 1: Direct search (case insensitive)
            text_instances = page.search_for(search_text)
            if text_instances:
                found_rects.extend(text_instances)
                continue
            
            # Method 2: Search first few words
            words = search_text.split()
            if len(words) >= 3:
                for i in range(min(3, len(words) - 2)):  # Try different word combinations
                    search_phrase = ' '.join(words[i:i+3])
                    instances = page.search_for(search_phrase)
                    if instances:
                        found_rects.extend(instances)
                        break
            
            # Method 3: Fuzzy matching with sentences from page
            sentences = [s.strip() for s in re.split(r'[.!?]+', page_text) if len(s.strip()) > 20]
            
            for sentence in sentences:
                similarity = SequenceMatcher(None, search_text.lower(), sentence.lower()).ratio()
                if similarity >= min_similarity:
                    instances = page.search_for(sentence[:50])  # Search first part
                    if instances:
                        found_rects.extend(instances)
                        break
        
        return found_rects
    
    def highlight_keypoints(self, output_path: str) -> bool:
        """Main highlighting function"""
        if not self.load_files():
            return False
        
        try:
            keypoints = self.json_data.get('contextual_keypoints', [])
            total_highlights = 0
            processed_keypoints = 0
            
            print(f"\n🎯 Processing {len(keypoints)} keypoints...")
            
            for i, keypoint in enumerate(keypoints):
                location = keypoint.get('location', '')
                keypoint_text = keypoint.get('keypoints', '')
                
                if not keypoint_text:
                    continue
                
                # Extract page number
                page_num = self.parse_location(location)
                if not page_num or page_num > self.pdf_doc.page_count:
                    print(f"⚠️  Invalid page number for keypoint {i+1}: {location}")
                    continue
                
                # Get the page (0-indexed)
                page = self.pdf_doc[page_num - 1]
                
                # Extract sentences from keypoint
                sentences = self.extract_sentences_from_keypoint(keypoint_text)
                
                if not sentences:
                    print(f"⚠️  No valid sentences extracted from keypoint {i+1}")
                    continue
                
                # Find text locations on the page
                rects = self.find_text_on_page(page, sentences, min_similarity=0.4)
                
                if rects:
                    # Choose color based on keypoint index
                    color = self.colors[i % len(self.colors)]
                    
                    # Add highlights
                    for rect in rects:
                        highlight = page.add_highlight_annot(rect)
                        highlight.set_colors({"stroke": color})
                        highlight.update()
                    
                    total_highlights += len(rects)
                    processed_keypoints += 1
                    print(f"✅ Keypoint {i+1} ({location}): {len(rects)} highlights added")
                else:
                    print(f"❌ Keypoint {i+1} ({location}): No matching text found")
                    # Debug: show what we were looking for
                    print(f"   🔍 Searched for: {sentences[0][:100]}..." if sentences else "   🔍 No sentences to search")
            
            # Save the highlighted PDF
            self.pdf_doc.save(output_path)
            self.pdf_doc.close()
            
            print(f"\n📊 RESULTS:")
            print(f"✅ Total keypoints processed: {processed_keypoints}/{len(keypoints)}")
            print(f"✅ Total highlights added: {total_highlights}")
            print(f"✅ Highlighted PDF saved: {output_path}")
            
            if processed_keypoints == 0:
                print(f"\n💡 TROUBLESHOOTING TIPS:")
                print(f"   1. Check that page numbers in JSON match PDF pages")
                print(f"   2. Verify that JSON contains actual text from the PDF")
                print(f"   3. Try running the debug script first to analyze the content")
                
                return False
            
            return True
            
        except Exception as e:
            print(f"❌ Error during highlighting: {e}")
            return False

def main(file_name: str):
    """Main function with your file paths"""
    # Update these paths to match your files
    pdf_path = f"C:\\Users\\Nitesh\\NFC_final_nerd.js\\NFC4_nerdjs\\database\\{file_name}"  # Update this to your actual PDF path
    json_path = r"C:\Users\Nitesh\NFC_final_nerd.js\NFC4_nerdjs\database\sample_json.json"  # Update this to your actual JSON path
    output_path = r"C:\Users\Nitesh\NFC_final_nerd.js\NFC4_nerdjs\database\highlight.pdf"
    
    print("🎨 PDF Highlighter - Final Solution")
    print("=" * 50)
    
    # Verify files exist
    if not os.path.exists(pdf_path):
        print(f"❌ PDF file not found: {pdf_path}")
        print("Please update the pdf_path variable with the correct path")
        return
    
    if not os.path.exists(json_path):
        print(f"❌ JSON file not found: {json_path}")
        print("Please update the json_path variable with the correct path")
        return
    
    # Create highlighter and process
    highlighter = PDFHighlighter(pdf_path, json_path)
    
    success = highlighter.highlight_keypoints(output_path)
    
    if success:
        print(f"\n🎉 SUCCESS! Open the highlighted PDF:")
        print(f"   {os.path.abspath(output_path)}")
    else:
        print(f"\n❌ Highlighting failed. Check the output above for details.")
        print(f"\n🔧 Consider running the debug script first:")
        print(f"   python enhanced_pdf_highlighter.py")

if __name__ == "__main__":
    main()