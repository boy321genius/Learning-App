if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/learning-app/sw.js');
  });
}

// EXPORT: serialize progress to a downloadable JSON file
function exportProgress() {
  const data = {
    exportedAt: new Date().toISOString(),
    progress: JSON.parse(localStorage.getItem('userProgress') || '{}')
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'learnapp-progress.json';
  a.click();
  URL.revokeObjectURL(url);
}

// IMPORT: read a JSON file and load it into localStorage
function importProgress(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      localStorage.setItem('userProgress', JSON.stringify(data.progress));
      alert('Progress imported successfully.');
    } catch {
      alert('Invalid file. Please select a valid export.');
    }
  };
  reader.readAsText(file);
}

