document
  .getElementById('url-form')
  .addEventListener('submit', async (event) => {
    event.preventDefault();

    const urlInput = document.getElementById('url-input').value;
    const resultsDiv = document.getElementById('results');

    resultsDiv.innerHTML = '<p>Analyzing URL...</p>';

    try {
      // Simulate an API call to analyze the URL
      const response = await fetch('/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: urlInput }),
      });

      const data = await response.json();

      if (response.ok) {
        resultsDiv.innerHTML = `<h2>Analysis Results</h2><pre>${
          JSON.stringify(data, null, 2)
        }</pre>`;
      } else {
        resultsDiv.innerHTML = `<p>Error: ${data.message}</p>`;
      }
    } catch (error) {
      resultsDiv.innerHTML = `<p>Error: ${error.message}</p>`;
    }
  });
