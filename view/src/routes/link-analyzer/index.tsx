import React, { useState } from 'react';

const LinkAnalyzer = () => {
  const [url, setUrl] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const analyzeLink = async () => {
    try {
      const response = await fetch('/tools/LINK_ANALYZER', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        throw new Error('Failed to analyze link');
      }

      const data = await response.json();
      setResult(data);
      setError(null);
    } catch (err) {
      setError(err.message);
      setResult(null);
    }
  };

  return (
    <div>
      <h1>Link Analyzer</h1>
      <input
        type='url'
        placeholder='Enter URL'
        value={url}
        onChange={(e) => setUrl(e.target.value)}
      />
      <button onClick={analyzeLink}>Analyze</button>

      {error && <p style={{ color: 'red' }}>{error}</p>}
      {result && (
        <div>
          <h2>Analysis Results</h2>
          <p>Links Found: {result.linksFound}</p>
          <p>Broken Links: {result.brokenLinks}</p>
          <p>SEO Score: {result.seoScore}</p>
        </div>
      )}
    </div>
  );
};

export default LinkAnalyzer;
