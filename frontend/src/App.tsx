import React from 'react';
import SimpleApp from './SimpleApp';

const App: React.FC = () => {
  return (
    <div>
      {process.env.NODE_ENV === 'production' && !process.env.REACT_APP_API_URL && (
        <div style={{
          background: '#f0f8ff',
          border: '1px solid #0066cc',
          borderRadius: '6px',
          padding: '12px',
          margin: '20px auto',
          maxWidth: '800px',
          textAlign: 'center',
          color: '#0066cc'
        }}>
          🚀 <strong>Demo Mode</strong> - This is a live demo running on GitHub Pages. 
          For full functionality, deploy with a backend server.
        </div>
      )}
      <SimpleApp />
    </div>
  );
};

export default App;