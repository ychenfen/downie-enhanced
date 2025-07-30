import React, { useState } from 'react';

const SimpleApp: React.FC = () => {
  const [url, setUrl] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleExtract = async () => {
    if (!url) return;
    
    setLoading(true);
    try {
      const response = await fetch('http://localhost:8000/api/downloads/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url,
          quality: 'best',
          post_processing: 'none',
          cookies: ''
        })
      });
      
      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error('Error:', error);
      setResult({ error: 'Failed to extract video info' });
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!url) return;
    
    setLoading(true);
    try {
      const response = await fetch('http://localhost:8000/api/downloads/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url,
          quality: 'best',
          post_processing: 'none',
          cookies: ''
        })
      });
      
      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error('Error:', error);
      setResult({ error: 'Failed to start download' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      maxWidth: '800px',
      margin: '50px auto',
      padding: '20px',
      fontFamily: 'Arial, sans-serif'
    }}>
      <h1 style={{
        textAlign: 'center',
        color: '#333',
        marginBottom: '30px'
      }}>
        🎬 Downie Enhanced
      </h1>
      
      <div style={{
        background: 'white',
        padding: '30px',
        borderRadius: '10px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
      }}>
        <div style={{ marginBottom: '20px' }}>
          <label style={{
            display: 'block',
            marginBottom: '8px',
            fontWeight: 'bold',
            color: '#555'
          }}>
            Video URL:
          </label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            style={{
              width: '100%',
              padding: '12px',
              border: '2px solid #ddd',
              borderRadius: '6px',
              fontSize: '16px',
              boxSizing: 'border-box'
            }}
          />
        </div>
        
        <div style={{
          display: 'flex',
          gap: '10px',
          marginBottom: '20px'
        }}>
          <button
            onClick={handleExtract}
            disabled={loading || !url}
            style={{
              flex: 1,
              padding: '12px 20px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '16px',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading || !url ? 0.6 : 1
            }}
          >
            {loading ? '⏳ Processing...' : '🔍 Extract Info'}
          </button>
          
          <button
            onClick={handleDownload}
            disabled={loading || !url}
            style={{
              flex: 1,
              padding: '12px 20px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '16px',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading || !url ? 0.6 : 1
            }}
          >
            {loading ? '⏳ Processing...' : '⬇️ Download'}
          </button>
        </div>
        
        {result && (
          <div style={{
            background: result.error ? '#fee' : '#efe',
            border: `1px solid ${result.error ? '#fcc' : '#cfc'}`,
            borderRadius: '6px',
            padding: '15px',
            marginTop: '20px'
          }}>
            <h3 style={{ 
              margin: '0 0 10px 0',
              color: result.error ? '#c33' : '#363'
            }}>
              {result.error ? '❌ Error' : '✅ Result'}
            </h3>
            <pre style={{
              background: '#f8f9fa',
              padding: '10px',
              borderRadius: '4px',
              overflow: 'auto',
              fontSize: '14px',
              margin: 0
            }}>
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </div>
      
      <div style={{
        textAlign: 'center',
        marginTop: '30px',
        color: '#666',
        fontSize: '14px'
      }}>
        <p>🚀 Backend API: <span style={{color: '#28a745'}}>Running</span></p>
        <p>Supported sites: YouTube, Vimeo, Bilibili, TikTok, and more!</p>
      </div>
    </div>
  );
};

export default SimpleApp;