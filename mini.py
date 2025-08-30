# mini.py

import streamlit as st
import pandas as pd
import numpy as np
import re
import json
import os
import tempfile
from datetime import datetime
import warnings
warnings.filterwarnings('ignore')

# PDF Reader
from pypdf import PdfReader

# AI / ML Imports
from transformers import AutoTokenizer, AutoModelForCausalLM, pipeline
import torch
from sentence_transformers import SentenceTransformer
import faiss

# -----------------------------
# Streamlit Page Config
# -----------------------------
st.set_page_config(
    page_title="StudyMate AI - Q&A System",
    page_icon="📚",
    layout="wide",
    initial_sidebar_state="expanded"
)

# -----------------------------
# Custom CSS
# -----------------------------
st.markdown("""
<style>
    .main-header {
        font-size: 3.5rem;
        color: #2E86AB;
        text-align: center;
        margin-bottom: 2rem;
        text-shadow: 2px 2px 4px rgba(0,0,0,0.1);
    }
    .section-header {
        font-size: 1.8rem;
        color: #2c3e50;
        border-bottom: 3px solid #3498db;
        padding-bottom: 0.5rem;
        margin: 2rem 0 1rem 0;
    }
    .chat-message {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 1rem;
        border-radius: 10px;
        margin: 1rem 0;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    .answer-box {
        background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
        color: white;
        padding: 1.5rem;
        border-radius: 15px;
        margin: 1rem 0;
        box-shadow: 0 6px 12px rgba(0,0,0,0.15);
    }
    .info-card {
        background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
        color: white;
        padding: 1rem;
        border-radius: 10px;
        margin: 0.5rem 0;
        text-align: center;
    }
    .upload-area {
        border: 2px dashed #3498db;
        border-radius: 10px;
        padding: 2rem;
        text-align: center;
        margin: 1rem 0;
        background-color: #f8f9fa;
    }
    .stProgress > div > div > div > div {
        background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
    }
</style>
""", unsafe_allow_html=True)

# -----------------------------
# PDF Handling
# -----------------------------
def extract_text_from_pdf(pdf_file):
    """Extract text from uploaded PDF using pypdf."""
    pdf_reader = PdfReader(pdf_file)
    text = ""
    for page in pdf_reader.pages:
        text += page.extract_text() or ""
    return text

def chunk_text(text, chunk_size=500, overlap=50):
    """Split text into overlapping chunks."""
    chunks = []
    for i in range(0, len(text), chunk_size - overlap):
        chunks.append(text[i:i + chunk_size])
    return chunks

# -----------------------------
# Model + Index Setup
# -----------------------------
@st.cache_resource
def load_models():
    tokenizer = AutoTokenizer.from_pretrained("ibm-granite/granite-3.2-2b-instruct")
    model = AutoModelForCausalLM.from_pretrained(
        "ibm-granite/granite-3.2-2b-instruct",
        device_map="auto",
        torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32
    )
    generator = pipeline("text-generation", model=model, tokenizer=tokenizer)

    embedder = SentenceTransformer("all-MiniLM-L6-v2")
    return generator, embedder

def create_faiss_index(chunks, embedder):
    embeddings = embedder.encode(chunks)
    dim = embeddings.shape[1]
    index = faiss.IndexFlatL2(dim)
    index.add(embeddings)
    return index, embeddings

def retrieve_relevant_chunks(query, embedder, index, chunks, top_k=3):
    query_vec = embedder.encode([query])
    distances, indices = index.search(query_vec, top_k)
    return [chunks[i] for i in indices[0]]

def generate_response(query, generator, embedder, index, chunks):
    relevant_chunks = retrieve_relevant_chunks(query, embedder, index, chunks)
    context = "\n".join(relevant_chunks)
    prompt = f"Context:\n{context}\n\nQuestion: {query}\nAnswer:"
    response = generator(prompt, max_length=512, do_sample=True, temperature=0.7)[0]["generated_text"]
    return response

# -----------------------------
# Streamlit App
# -----------------------------
def main():
    st.title("📚 StudyMate AI")
    st.write("Ask questions directly from your uploaded PDFs!")

    with st.sidebar:
        st.header("Upload & Process")
        uploaded_files = st.file_uploader("Upload PDF files", type=["pdf"], accept_multiple_files=True)
        process_button = st.button("Process Documents")

    if "generator" not in st.session_state:
        st.session_state.generator, st.session_state.embedder = load_models()
    generator, embedder = st.session_state.generator, st.session_state.embedder

    if process_button and uploaded_files:
        with st.spinner("Processing PDFs..."):
            all_text = ""
            for file in uploaded_files:
                all_text += extract_text_from_pdf(file)
            chunks = chunk_text(all_text)
            index, _ = create_faiss_index(chunks, embedder)
            st.session_state.index = index
            st.session_state.chunks = chunks
        st.success("✅ Documents processed!")

    st.subheader("💬 Chat with your PDF")
    user_query = st.text_input("Enter your question:")
    if st.button("Ask") and user_query:
        if "index" in st.session_state:
            response = generate_response(user_query, generator, embedder, st.session_state.index, st.session_state.chunks)
            st.write("### 🤖 Answer:")
            st.write(response)
        else:
            st.warning("Please upload and process documents first.")

    st.markdown("---")
    st.markdown(
        """
        <div style="text-align: center; color: #666; margin-top: 2rem;">
            <p><strong>StudyMate AI</strong> - Powered by IBM Granite 3.2-2B | Built with ❤️ for Students</p>
            <p>🔬 NLP | 🎯 Semantic Search | 📚 Learning Assistant</p>
        </div>
        """,
        unsafe_allow_html=True,
    )

if __name__ == "__main__":
    main()