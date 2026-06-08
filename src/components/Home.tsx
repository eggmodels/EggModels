import React, { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import welcomeMarkdown from '../markdown/home.md';
import '../css/Home.css';

function Home() {
  const [content, setContent] = useState('');

  useEffect(() => {
    fetch(welcomeMarkdown)
      .then((res) => res.text())
      .then((text) => setContent(text))
      .catch((err) => console.error('Error loading markdown:', err));
  }, []);

  return (
    <div className="markdown-container">
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}

export default Home;
