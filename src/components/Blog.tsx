import React, { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import '../css/Blog.css';

const EXCLUDED_FILES = ['home.md'];

/* eslint-disable @typescript-eslint/no-explicit-any */
const importAll = (r: any): string[] =>
  r
    .keys()
    .filter((filename: string) => !EXCLUDED_FILES.some((ex) => filename.includes(ex)))
    .map(r) as string[];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const markdownFiles: string[] = importAll(
  (require as any).context('../markdown', false, /\.md$/),
)
  .sort()
  .reverse();

function Blog() {
  const [posts, setPosts] = useState<string[]>([]);

  useEffect(() => {
    Promise.all(
      markdownFiles.map((file) => fetch(file).then((res) => res.text())),
    )
      .then((loaded) => setPosts(loaded))
      .catch(console.error);
  }, []);

  return (
    <div className="blog">
      <div className="intros">
        <h1>EggModels</h1>
        <h4>
          jacques.morris@eggmodels.com | durie@eggmodels.com | egg@eggmodels.com |
          sebastian.garzagarcia@eggmodels.com | philip@eggmodels.com
        </h4>
      </div>

      <div className="posts-container">
        {posts.map((post, idx) => (
          <div key={idx} className="post-box">
            <ReactMarkdown>{post}</ReactMarkdown>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Blog;
