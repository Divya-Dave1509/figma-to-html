import React, { useState } from 'react';
import axios from 'axios';

const UploadZone = ({ onConversionStart, onConversionSuccess, onConversionError }) => {
    const [mode, setMode] = useState('web'); // 'web' or 'email'
    const [inputType, setInputType] = useState('image'); // 'image' or 'figma'
    const [file, setFile] = useState(null);
    const [figmaUrl, setFigmaUrl] = useState('');
    const [customCSS, setCustomCSS] = useState('');
    const [loading, setLoading] = useState(false);

    const handleFileChange = (e) => {
        setFile(e.target.files[0]);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!file && inputType === 'image') return alert('Please select an image');
        if (!figmaUrl && inputType === 'figma') return alert('Please enter a Figma URL');

        setLoading(true);
        onConversionStart();

        const API_URL = import.meta.env.VITE_API_URL || '/api';

        try {
            let response;
            if (inputType === 'image') {
                const formData = new FormData();
                formData.append('image', file);
                formData.append('mode', mode);
                formData.append('customCSS', customCSS); // Send Custom CSS
                response = await axios.post(`${API_URL}/convert/image`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
            } else {
                response = await axios.post(`${API_URL}/convert/figma`, { url: figmaUrl, mode, customCSS }); // Send Custom CSS
            }

            onConversionSuccess(response.data);
        } catch (error) {
            console.error(error);
            let errorMsg = error.response?.data?.error || error.message || 'Conversion failed';

            // Helpful hint for deployment 404s (Backend not reached)
            if (error.response?.status === 404) {
                errorMsg = `Backend not found (404). Did you deploy the Server and set VITE_API_URL in Vercel?`;
            }

            onConversionError(typeof errorMsg === 'object' ? JSON.stringify(errorMsg) : errorMsg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="upload-zone">
            <h2>Start New Project</h2>

            <div className="mode-toggle">
                <label>
                    <input
                        type="radio"
                        name="mode"
                        value="web"
                        checked={mode === 'web'}
                        onChange={(e) => setMode(e.target.value)}
                    />
                    Web Page
                </label>
                <label>
                    <input
                        type="radio"
                        name="mode"
                        value="email"
                        checked={mode === 'email'}
                        onChange={(e) => setMode(e.target.value)}
                    />
                    Email Template
                </label>
            </div>

            <div className="input-type-tabs">
                <button
                    className={inputType === 'image' ? 'active' : ''}
                    onClick={() => setInputType('image')}
                >
                    Upload Image
                </button>
                <button
                    className={inputType === 'figma' ? 'active' : ''}
                    onClick={() => setInputType('figma')}
                >
                    Figma URL
                </button>
            </div>

            <form onSubmit={handleSubmit} className="upload-form">
                {inputType === 'image' ? (
                    <div className="file-input">
                        <input type="file" accept="image/*" onChange={handleFileChange} />
                        {file && <p>Selected: {file.name}</p>}
                    </div>
                ) : (
                    <div className="url-input">
                        <input
                            type="text"
                            placeholder="Paste Figma URL (e.g., https://www.figma.com/file/...)"
                            value={figmaUrl}
                            onChange={(e) => setFigmaUrl(e.target.value)}
                        />
                        <small>Make sure the URL points to a specific Frame (node-id).</small>
                    </div>
                )}

                <div className="custom-css-input" style={{ marginTop: '20px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', color: '#94a3b8' }}>
                        Custom CSS / Utilities (Optional)
                    </label>
                    <textarea
                        placeholder="Paste your CSS classes, variables, or utility definitions here. The AI will prioritize these styles."
                        value={customCSS}
                        onChange={(e) => setCustomCSS(e.target.value)}
                        style={{
                            width: '100%',
                            minHeight: '100px',
                            background: '#1e293b',
                            border: '1px solid #334155',
                            borderRadius: '8px',
                            padding: '12px',
                            color: '#f8fafc',
                            fontFamily: 'monospace',
                            fontSize: '0.9rem',
                            resize: 'vertical'
                        }}
                    />
                </div>

                <button type="submit" disabled={loading} className="generate-btn" style={{ marginTop: '20px' }}>
                    {loading ? 'Generating...' : 'Generate HTML'}
                </button>
            </form>
        </div>
    );
};

export default UploadZone;
